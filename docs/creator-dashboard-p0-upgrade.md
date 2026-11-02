# Creator Dashboard — P0 Upgrade Notes (v0.4.0, local only, not pushed)

Date: 2026-10-31. Source: the local repo next to this file. No GitHub push was made for this upgrade.

## What changed

- **Product renamed to Creator Dashboard** (was Creator Workbench): page `<title>` / browser tab,
  header brand, sidebar copy, backup/export filenames (`creator-dashboard-backup-YYYY-MM-DD.json`,
  `creator-dashboard-publish-pack-<title>.md`, `creator-dashboard-skills.md`), and README.
  The browser storage key stays `creator-workbench-v1` on purpose: renaming it would orphan
  existing browser data. The GitHub repo name is unchanged.
- **Projects (one project per piece of content)**: Overview (title, summary, status, priority,
  tags, audience, planned date), Research (multiple link + source + note rows), Scripts
  (Chinese / English edited and saved separately), Assets (cover / raw video / SRT / final
  video as link + note — video files are never stored in localStorage), Publishing
  (per-platform packs, see below). Create, edit, search, filter (status / priority / tag),
  archive / restore. Save shows a toast; leaving the editor with unsaved changes prompts,
  and the browser also warns on page leave while dirty.
- **List / Board / Calendar share the same projects**: List has search + status / priority /
  tag filters; Board has six columns (Idea, Writing, To Record, Editing, Ready to Publish,
  Published) with drag-to-move on desktop and a Move-to menu on every device; Calendar is a
  month view with a Project-dates / Platform-schedule toggle, click-to-open, and an
  Unscheduled section with a quick date picker.
- **Per-platform publish packs** for X, Douyin, Xiaohongshu, TikTok, YouTube, each with
  Title, Body / Description, Hashtags, Cover URL, Scheduled Time, Status
  (Not Ready / Ready / Published), Published Time, Published URL. Actions: Copy one
  platform's full copy, Copy from another platform (copy fields only, then independent),
  Export full pack as Markdown, Mark as Published (sets time + optional link, only that
  platform). Header shows `n/5 published`. Production status and platform statuses are
  saved separately; marking one platform never marks the others.
- **"Fill empty platforms from project" is organizing, not AI generation**: it copies the
  project's own title / summary / tags into platform fields that are still empty and never
  overwrites hand-edited copy. No placeholder copy is ever presented as generated.
- **Migration**: opening v0.4 with older data converts each draft into one project
  (idea → Idea, scripting → Writing, recorded → Editing, editing → Editing,
  final → Ready to Publish, published → Published; original draft status kept on the
  project as `legacyStatus`). A bilingual legacy publish pack prefills Douyin / Xiaohongshu
  (Chinese) and X / TikTok / YouTube (English); no platform is auto-marked published.
  Migration is idempotent (tracked by draft id + project link) and snapshots the
  pre-migration JSON in the browser once (`creator-dashboard-pre-migration-backup-v1`).
  Drafts are kept, because Traffic still reads them; Ideas now move to Projects.
- **Existing features kept**: Ideas, Drafts (incl. legacy publish packs and Ego Lite .json
  export), Accounts, Traffic (manual + YouTube auto-read), Skill Collection.

## Backup and restore

- **Export**: sidebar “Export backup” downloads `creator-dashboard-backup-YYYY-MM-DD.json`
  (all ideas, drafts, accounts, skills, projects). Your YouTube API key is stored separately
  and is never included.
- **Restore**: sidebar “Import backup” reads a backup file, validates its shape
  (JSON object; each section a list; every project/draft has id + title; project statuses
  known), and asks for confirmation before replacing current data. A file that fails
  validation changes nothing. A pre-P0 backup (drafts, no projects) imports with migration
  applied, so old backups still yield projects.
- **Data location**: this browser only, `localStorage`. Nothing syncs across devices and
  nothing is uploaded to any server. Export a backup before switching browsers, clearing
  site data, or reinstalling.

## Verification (logic level, 2026-10-31)

- `npm run build` passes (tsc + vite, single-file `dist/index.html`, 290 KB).
- 33 Node checks pass (`~/workspace/creator-dashboard-p0-tests/test.mjs`, against a
  bundled `lib.ts`): migration mapping + legacy status + pack prefill + no auto-publish,
  idempotent re-migration, platform independence, copy-from field scope, 2/5 counting,
  fill-empty non-overwrite, Markdown export completeness, backup round-trip + rejection
  of malformed / bad-status / non-list files, calendar grid + month arithmetic.

## Browser end-to-end verification (Playwright, local preview, 2026-10-31)

- 40/40 checks passed (`~/workspace/creator-dashboard-p0-tests/e2e.mjs`, Chromium
  against the built app on localhost:4173). Covered: header/nav rename; migrated
  example project opens with Overview / Research / Scripts / Assets / Publishing;
  create project with summary, status, priority, tags, audience, planned date, CN + EN
  scripts, research item, cover asset, and save toast; reload persistence; board move
  to To Record syncing to the list; calendar Nov 5 → Nov 6 move; Publishing starts
  0/5; X and Douyin edited independently; copy-from X → TikTok then independent
  TikTok edit; Markdown export contains all five platforms + title; Mark X Published
  → 1/5 with Douyin still Not Ready; platform-schedule calendar shows the X entry;
  backup export filename `creator-dashboard-backup-2026-10-31.json` + import
  round-trip with both projects intact; unsaved-changes guard (dismiss keeps the
  editor, then save works); 390px viewport with zero horizontal overflow and a
  usable editor.
- Bug found by the run and fixed: the sidebar had no scroll, so on shorter windows
  the Export / Import / Clear buttons sat below the fold and were unreachable.
  Fixed with `overflow-y: auto` on the sidebar; the re-run passed 40/40.
- Two earlier verification attempts did not run: the remote browser could not reach
  this machine's localhost preview, and a hosted-copy upload was blocked by an
  expired egress approval (nothing was uploaded). The Playwright run above replaces
  both; no user action was needed.

## Known limits

- No social-platform auto-publishing and no new AI dependency (per P0 scope). Publishing
  is copy-out + manual publish, same as before.
- The preview build starts with generic example data (or whatever is in that browser's
  storage). Your real data moves via Export backup (old) → Import backup (new).
- Board drag-and-drop needs a mouse/trackpad; on touch devices use the per-card
  “Move to” menu, which does the same thing.
- “Copy from…” uses a typed platform name prompt (no dropdown) to keep the editor
  compact; an unknown name cancels with a notice.
- Calendar editing of a platform's scheduled time happens inside the project editor,
  not by dragging chips between days.
- The single-file preview link (Muse storage) expires; the repo + `npm run dev` /
  `npm run preview` remain the permanent runnable copies.
