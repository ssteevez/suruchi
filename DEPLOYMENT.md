# DEPLOYMENT.md

Deployment reference for the Suruchi Website (Netlify) and the Supabase-backed
shared admin panel.

**Status:** Supabase integration is **implemented** (JSONB-first, Phase 1).
The admin requires a configured Supabase project; it never silently falls back
to localStorage. localStorage remains a backup mirror + restore path only.

---

## 1. Deployment command

```bash
cd /Volumes/Steevez2025/SuruchiWebsite/Cursor
npm run build
npx netlify deploy --prod --dir=dist
```

`npm run build` runs `tsc && vite build`, then a `postbuild` step strips
macOS `._*` metadata files from `dist/` (this project lives on an exFAT
volume which generates them).

---

## 2. Asset strategy — media is committed (git deploys supported)

All required media is committed to the repo (~63 MB: `public/video-1..6.mp4`
+ `public/images/`). **Git-connected Netlify deployment is therefore
supported** — Netlify builds with `npm run build` per `netlify.toml`.

One exception stays gitignored: `public/video.mp4` (170 MB) — it exceeds
GitHub's 100 MB hard limit and is referenced nowhere in the code. It exists
only on the local disk. Do not reference it without resolving hosting first.

For git-based builds, the two `VITE_SUPABASE_*` variables (section 3) must be
set in Netlify: **Site configuration → Environment variables**. The repo must
stay **private** — it contains the full source.

CLI deploys of a locally built `dist/` (section 1) remain a valid fallback.

---

## 3. Environment variables

Set in the local `.env` (gitignored). They are read **at build time** and
inlined into the JS bundle. Nothing needs to be configured in Netlify's
environment settings while deploys are pre-built locally — but if a git-based
build is ever set up, add the two `VITE_*` vars in Netlify too.

| Variable | Frontend-safe? | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anon key — safe **only** because Row Level Security restricts every table to allowlisted, authenticated users |
| `SUPABASE_SERVICE_ROLE_KEY` | **NEVER** | Bypasses all RLS. Must never appear in any `VITE_*` variable, any frontend code, or any file that reaches the bundle. Not needed anywhere in this project — even the data migration runs as the signed-in admin user. |

If the two `VITE_SUPABASE_*` vars are missing at build time, the admin
renders a clear "Admin Not Configured" notice — it does not crash and does
not pretend to sync.

`VITE_SURUCHI_ADMIN_PASSWORD` is **retired** — the old frontend soft gate was
replaced by real Supabase Auth. It can be deleted from `.env`.

---

## 4. Supabase setup (one-time)

1. Create a Supabase project (region close to both users).
2. SQL editor → paste and run the whole of [`supabase/schema.sql`](supabase/schema.sql).
   This creates `projects`, `activity_logs`, `review_messages`,
   `allowed_admins`, the `admin_role()` helper, the **locked-approval
   trigger**, all RLS policies, and enables realtime on the three data tables.
3. Authentication → Users → create **two** users (email + password):
   Steevez and Suruchi. Email confirmation can be disabled for simplicity.
4. SQL editor → allowlist both accounts:
   ```sql
   insert into public.allowed_admins (email, role) values
     ('steevez@example.com', 'admin'),
     ('suruchi@example.com', 'client');
   ```
5. Project Settings → API → copy the URL and anon key into `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
6. Rebuild and deploy (section 1).

### Auth model

- Email + password via Supabase Auth; sessions persist per browser.
- Sign-in alone is not enough: the account's email must exist in
  `allowed_admins` or the app shows "not authorized" and every table read is
  denied by RLS anyway.
- Roles: `admin` (Steevez — full edit + delete) and `client` (Suruchi —
  read/write project data and review messages; cannot delete projects).
- **Locked approvals cannot be withdrawn by anyone** — a database trigger
  rejects any update that flips a locked approval (`lockedApproval`
  checklist items, homepage mini-page `approved`, poet/euphemism
  `structureApproved`/`finalApproval`, painter series approvals) from
  true back to false. UI and direct API calls alike.

---

## 5. Data architecture (JSONB-first)

- `projects.project_data` holds the **complete Project object** (current
  localStorage shape, schemaVersion 3.6) — source of truth. Nested data
  (checklists, homepage mini pages, pilgrim photos, poet pages, euphemism
  structures/requests, painter series/artworks, review threads, activity)
  stays inside the JSONB. Not over-normalized by design.
- `activity_logs` and `review_messages` are **append-only synchronized
  streams** (audit + queryability + granular realtime). They duplicate, never
  replace, the JSONB.
- The admin store keeps its synchronous API: writes update the in-memory
  cache + localStorage backup instantly (optimistic UI), then push to
  Supabase in the background with retry. Realtime subscriptions apply the
  other user's changes live (projects + both stream tables → Today panel
  updates without reload).
- Sync indicator in the admin header: **Synced** / **Saving…** /
  **Offline / local backup** (offline writes retry automatically and on
  the browser's `online` event).

---

## 6. First-run migration (localStorage → Supabase)

Built into the admin — no scripts, no service key:

1. Configure Supabase (section 4), rebuild, open the admin, sign in as the
   admin account.
2. If the cloud is empty and the browser holds existing local data, the
   **Migration Panel** appears automatically.
3. It force-downloads a JSON backup, uploads every project (full JSONB),
   backfills the activity/review streams, re-fetches everything from the
   cloud, and shows a **side-by-side count verification**: projects,
   homepage mini pages, pilgrim photos, poet pages, euphemism
   structures/requests, painter series, painter artworks, review messages,
   activity entries.
4. The "Switch to live shared data" button stays disabled until **all
   counts match**.
5. If both browsers (Steevez + Suruchi) hold divergent local data, migrate
   from the canonical one; reconcile the other via Export/Import afterwards.

## 7. Backup / restore

- **Export JSON** (admin footer): downloads the current live dataset.
  Keep dated backups, especially before big editing sessions.
- **Import JSON**: replaces the live dataset (cache + localStorage) and
  pushes everything to Supabase. This is the restore path — use with a
  trusted backup file only.
- localStorage mirrors the latest known state automatically as a local
  backup; it is never read as live state while Supabase is configured.

---

## 8. Netlify settings

| Setting | Value |
|---|---|
| Build command | `npm run build` (run **locally** — see section 2) |
| Publish directory | `dist` |
| Admin route | `/suruchi-admin/` (static file — refresh-safe, no redirects needed) |
| Source maps | Disabled (Vite production default; verified absent from `dist`) |

Indexing protection for the admin panel (all three layers in place):

- `suruchi-admin/index.html` → `<meta name="robots" content="noindex, nofollow">`
- `public/robots.txt` → `Disallow: /suruchi-admin/`
- `public/_headers` → `X-Robots-Tag: noindex, nofollow` for `/suruchi-admin/*`,
  plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer` site-wide.

---

## 9. Future phases (not yet implemented)

- Normalize individual JSONB structures into dedicated tables only if
  querying demands it (`homepage_mini_pages`, `pilgrim_photos`, `poet_pages`,
  `euphemism_structures`, `euphemism_requests`, `painter_series`,
  `painter_artworks`).
- Per-field RLS for the `client` role (today field-level limits for Suruchi
  are enforced by the UI plus the locked-approval trigger; the JSONB blob
  cannot express column-level policies).
- Presence indicators / "last synced" timestamps per project.

---

## 10. Final notes

- The public site is completely independent of Supabase — nothing about its
  behavior changed.
- The admin is now genuinely shared infrastructure: approvals, review
  threads, checklists and activity sync live between Steevez and Suruchi.
- The remaining trust boundary: both allowlisted users can edit broadly by
  design; the database enforces authentication, the allowlist, role-based
  deletes, and locked approvals.
