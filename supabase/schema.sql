-- ============================================================
-- Suruchi Admin — Supabase schema (JSONB-first, Phase 1)
-- Run this once in the Supabase SQL editor of the project.
--
-- Source of truth: projects.project_data holds the COMPLETE
-- Project object (current localStorage shape, schemaVersion 3.4),
-- including nested checklists, mini pages, pilgrim photos, poet
-- pages, euphemism structures/requests, painter series/artworks,
-- review threads and activity. activity_logs and review_messages
-- are append-only synchronized streams for audit, querying and
-- realtime granularity — they duplicate (never replace) the JSONB.
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

create table if not exists public.projects (
  id             text primary key,          -- TEXT: preserves existing ids exactly
  title          text not null default '',
  section_type   text not null default 'other',
  project_data   jsonb not null,
  schema_version integer not null default 1,
  updated_at     timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id         uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  message    text not null,
  actor      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.review_messages (
  id           uuid primary key default gen_random_uuid(),
  project_id   text not null references public.projects(id) on delete cascade,
  context_type text not null default 'project',  -- project | poetPage | euphemismStructure | painterSeries
  context_id   text not null default '',
  author       text not null default '',
  message      text not null,
  created_at   timestamptz not null default now()
);

-- Allowlist: insert exactly two rows via the dashboard (no app writes):
--   insert into public.allowed_admins (email, role) values
--     ('steevez@example.com', 'admin'),
--     ('suruchi@example.com', 'client');
create table if not exists public.allowed_admins (
  email text primary key,
  role  text not null check (role in ('admin', 'client'))
);

-- ── Helper: role of the signed-in user (null = not allowlisted) ──
-- SECURITY DEFINER so it can read allowed_admins while that table
-- itself remains fully locked down (no RLS policies = no access).
create or replace function public.admin_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.allowed_admins
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke all on function public.admin_role() from public;
grant execute on function public.admin_role() to authenticated;

-- ── Locked-approval enforcement ─────────────────────────────
-- Collects every approval that is currently locked (true) inside
-- project_data. Any of these going true -> false is rejected, for
-- every role, on every update path (UI or direct API).
create or replace function public.approval_locks(data jsonb)
returns table(kind text, item_id text)
language sql immutable
as $$
  -- checklist items of type lockedApproval (top level)
  select 'checklist', it->>'id'
  from jsonb_array_elements(coalesce(data->'checklist', '[]'::jsonb)) it
  where it->>'type' = 'lockedApproval' and it->>'value' = 'true'
  union all
  -- checklist children one level deep (grouped items)
  select 'checklist', ch->>'id'
  from jsonb_array_elements(coalesce(data->'checklist', '[]'::jsonb)) it,
       jsonb_array_elements(coalesce(it->'children', '[]'::jsonb)) ch
  where ch->>'type' = 'lockedApproval' and ch->>'value' = 'true'
  union all
  -- homepage mini pages
  select 'miniPage.approved', mp->>'id'
  from jsonb_array_elements(coalesce(data->'miniPages', '[]'::jsonb)) mp
  where mp->>'approved' = 'true'
  union all
  -- poet pages
  select 'poetPage.structureApproved', pp->>'id'
  from jsonb_array_elements(coalesce(data->'poetPages', '[]'::jsonb)) pp
  where pp->>'structureApproved' = 'true'
  union all
  select 'poetPage.finalApproval', pp->>'id'
  from jsonb_array_elements(coalesce(data->'poetPages', '[]'::jsonb)) pp
  where pp->>'finalApproval' = 'true'
  union all
  -- euphemism structures (same shape as poet pages)
  select 'euphemism.structureApproved', es->>'id'
  from jsonb_array_elements(coalesce(data->'euphemismStructures', '[]'::jsonb)) es
  where es->>'structureApproved' = 'true'
  union all
  select 'euphemism.finalApproval', es->>'id'
  from jsonb_array_elements(coalesce(data->'euphemismStructures', '[]'::jsonb)) es
  where es->>'finalApproval' = 'true'
  union all
  -- painter series
  select 'painterSeries.structureApproved', ps->>'id'
  from jsonb_array_elements(coalesce(data->'painterSeries', '[]'::jsonb)) ps
  where ps->>'structureApproved' = 'true'
  union all
  select 'painterSeries.finalApproval', ps->>'id'
  from jsonb_array_elements(coalesce(data->'painterSeries', '[]'::jsonb)) ps
  where ps->>'finalApproval' = 'true';
$$;

create or replace function public.enforce_locked_approvals()
returns trigger
language plpgsql
as $$
declare
  withdrawn record;
begin
  -- Escape hatch used exclusively by admin_unlock_approval()
  -- (see admin-unlock.sql); transaction-local, never client-settable.
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

drop trigger if exists trg_enforce_locked_approvals on public.projects;
create trigger trg_enforce_locked_approvals
  before update on public.projects
  for each row
  execute function public.enforce_locked_approvals();

-- ── Row Level Security ──────────────────────────────────────

alter table public.projects        enable row level security;
alter table public.activity_logs   enable row level security;
alter table public.review_messages enable row level security;
alter table public.allowed_admins  enable row level security;
-- allowed_admins: NO policies on purpose — nobody can read/write it
-- through the API; manage rows only in the Supabase dashboard.
-- The app learns its role via rpc('admin_role').

-- projects: both allowlisted users read & write; only admin deletes.
create policy projects_select on public.projects
  for select to authenticated
  using (public.admin_role() is not null);

create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.admin_role() is not null);

create policy projects_update on public.projects
  for update to authenticated
  using (public.admin_role() is not null)
  with check (public.admin_role() is not null);

create policy projects_delete on public.projects
  for delete to authenticated
  using (public.admin_role() = 'admin');

-- activity_logs: append-only for both; only admin can delete; no updates.
create policy activity_select on public.activity_logs
  for select to authenticated
  using (public.admin_role() is not null);

create policy activity_insert on public.activity_logs
  for insert to authenticated
  with check (public.admin_role() is not null);

create policy activity_delete on public.activity_logs
  for delete to authenticated
  using (public.admin_role() = 'admin');

-- review_messages: append-only for both; only admin can delete; no updates.
create policy review_select on public.review_messages
  for select to authenticated
  using (public.admin_role() is not null);

create policy review_insert on public.review_messages
  for insert to authenticated
  with check (public.admin_role() is not null);

create policy review_delete on public.review_messages
  for delete to authenticated
  using (public.admin_role() = 'admin');

-- ── Realtime ────────────────────────────────────────────────
-- Enable postgres_changes broadcasts for the three data tables.
do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.activity_logs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.review_messages;
exception when duplicate_object then null;
end $$;

-- ── Post-setup ──────────────────────────────────────────────
-- After running this file, also run admin-unlock.sql to install
-- the audited admin-only approval unlock RPC.
