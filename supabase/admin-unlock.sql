-- ============================================================
-- Admin approval-unlock (run once on the live database)
--
-- Adds a single, audited escape hatch for locked approvals:
--   - admin_unlock_approval(project_id, kind, item_id) RPC
--   - callable only by role 'admin' (allowed_admins)
--   - flips exactly one approval flag back to false
--   - records the action in the project activity (JSONB) AND
--     in the activity_logs audit table
--   - the lock trigger allows the change only inside this RPC
--     (transaction-local flag); raw SQL updates stay rejected.
-- ============================================================

-- 1) Trigger function: add the transaction-local escape hatch.
create or replace function public.enforce_locked_approvals()
returns trigger
language plpgsql
as $$
declare
  withdrawn record;
begin
  -- Escape hatch: set only by admin_unlock_approval(), scoped to
  -- the current transaction. Never set by normal client writes.
  if coalesce(current_setting('app.allow_approval_unlock', true), '') = 'true' then
    return new;
  end if;

  select l.kind, l.item_id into withdrawn
  from (
    select * from public.approval_locks(old.project_data)
    except
    select * from public.approval_locks(new.project_data)
  ) l
  limit 1;

  if found then
    raise exception 'Locked approval cannot be withdrawn (% on %)',
      withdrawn.kind, withdrawn.item_id
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 2) The unlock RPC.
create or replace function public.admin_unlock_approval(
  p_project_id text,
  p_kind       text,
  p_item_id    text
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_data  jsonb;
  v_arr   text;
  v_field text;
  v_note  text;
begin
  if public.admin_role() is distinct from 'admin' then
    raise exception 'Not authorized';
  end if;

  select project_data into v_data
  from public.projects
  where id = p_project_id
  for update;

  if v_data is null then
    raise exception 'Project not found: %', p_project_id;
  end if;

  -- Map kind → (array field, boolean field). Kinds mirror approval_locks().
  case p_kind
    when 'checklist'                      then v_arr := null;             v_field := null;
    when 'miniPage.approved'              then v_arr := 'miniPages';      v_field := 'approved';
    when 'poetPage.structureApproved'     then v_arr := 'poetPages';      v_field := 'structureApproved';
    when 'poetPage.finalApproval'         then v_arr := 'poetPages';      v_field := 'finalApproval';
    when 'euphemism.structureApproved'    then v_arr := 'euphemismStructures'; v_field := 'structureApproved';
    when 'euphemism.finalApproval'        then v_arr := 'euphemismStructures'; v_field := 'finalApproval';
    when 'painterSeries.structureApproved' then v_arr := 'painterSeries'; v_field := 'structureApproved';
    when 'painterSeries.finalApproval'    then v_arr := 'painterSeries';  v_field := 'finalApproval';
    else raise exception 'Unknown kind: %', p_kind;
  end case;

  if p_kind = 'checklist' then
    -- lockedApproval checklist item: top level or one level of children.
    v_data = jsonb_set(v_data, '{checklist}', (
      select coalesce(jsonb_agg(
        case
          when it->>'id' = p_item_id
            then it || jsonb_build_object('value', false)
          when (it ? 'children') and jsonb_typeof(it->'children') = 'array'
            then jsonb_set(it, '{children}', (
              select coalesce(jsonb_agg(
                case when ch->>'id' = p_item_id
                     then ch || jsonb_build_object('value', false)
                     else ch end), '[]'::jsonb)
              from jsonb_array_elements(it->'children') ch))
          else it
        end), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_data->'checklist', '[]'::jsonb)) it));
  else
    v_data = jsonb_set(v_data, array[v_arr], (
      select coalesce(jsonb_agg(
        case when el->>'id' = p_item_id
             then el || jsonb_build_object(v_field, false)
             else el end), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_data->v_arr, '[]'::jsonb)) el));
  end if;

  -- Audit: visible activity entry in the project itself…
  v_note := format('Approval unlocked by admin override (%s on %s)', p_kind, p_item_id);
  v_data := jsonb_set(v_data, '{activity}',
    jsonb_build_array(jsonb_build_object(
      'date', (extract(epoch from now()) * 1000)::bigint,
      'message', v_note
    )) || coalesce(v_data->'activity', '[]'::jsonb));

  -- …and in the append-only audit table.
  insert into public.activity_logs (project_id, message, actor)
  values (p_project_id, v_note, coalesce(auth.jwt() ->> 'email', 'admin'));

  -- Permit this one transaction through the lock trigger.
  perform set_config('app.allow_approval_unlock', 'true', true);

  update public.projects
  set project_data = v_data,
      updated_at   = now()
  where id = p_project_id;
end;
$$;

revoke all on function public.admin_unlock_approval(text, text, text) from public;
grant execute on function public.admin_unlock_approval(text, text, text) to authenticated;
