import { useEffect, useState } from "react";
import {
  PLATFORM_LIST,
  copyPlatformPackFields,
  downloadText,
  fillEmptyPlatformsFromProject,
  newProject,
  platformPackToText,
  projectPackToMarkdown,
  projectStatusLabel,
  publishedCount,
  today,
  uid,
} from "./lib";
import type { AssetKind, PlatformKey, Project, ProjectPriority, ProjectStatus, WorkbenchData } from "./types";

export function slugify(text: string, fallback: string): string {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}

/* ── Projects list ── */
export function ProjectsList({
  data, query, saveProject, onOpen, notify,
}: {
  data: WorkbenchData;
  query: string;
  saveProject: (p: Project) => void;
  onOpen: (id: string) => void;
  notify: (msg: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ProjectPriority>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [title, setTitle] = useState("");

  const visible = data.projects.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
    if (tagFilter && !p.tags.toLowerCase().includes(tagFilter.toLowerCase())) return false;
    if (query && !`${p.title} ${p.summary} ${p.tags}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const active = data.projects.filter((p) => !p.archived);
  const unscheduled = active.filter((p) => !p.plannedDate).length;

  return (
    <section aria-label="Projects">
      <div className="grid2">
        <div className="stat"><b>{active.length}</b><span>Active projects</span></div>
        <div className="stat"><b>{unscheduled}</b><span>Unscheduled (no planned date)</span></div>
      </div>
      <div className="card">
        <h3>+ New project</h3>
        <div className="row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn" disabled={!title.trim()} onClick={() => {
            const p = newProject({ title: title.trim() });
            saveProject(p);
            setTitle("");
            onOpen(p.id);
            notify("Project created — fill in the sections, then Save");
          }}>Create and edit</button>
        </div>
      </div>
      <div className="card">
        <div className="grid2">
          <label>Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectStatus)}>
              <option value="all">All statuses</option>
              {(["idea", "writing", "to-record", "editing", "ready-to-publish", "published"] as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{projectStatusLabel(s)}</option>
              ))}
            </select>
          </label>
          <label>Priority
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "all" | ProjectPriority)}>
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        <div className="grid2">
          <label>Filter by tag<input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="Tag substring…" /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} style={{ width: "auto", marginTop: 0 }} />
            Show archived
          </label>
        </div>
      </div>
      {visible.length === 0 && <p className="note">Nothing here yet — create a project above, or move an idea in from Ideas.</p>}
      {visible.map((p) => (
        <article key={p.id} className="card">
          <h3>{p.starred ? "★ " : ""}{p.title}{p.archived ? " (archived)" : ""}</h3>
          <p>
            <span className="tag">{projectStatusLabel(p.status)}</span>
            <span className="tag">Priority: {p.priority}</span>
            <span className="tag">{p.plannedDate ? `Planned ${p.plannedDate}` : "Unscheduled"}</span>
            <span className="tag">{publishedCount(p)}/5 published</span>
            {p.legacyStatus ? <span className="tag">Migrated from draft</span> : null}
          </p>
          <p>{p.summary || "Open to add a summary, scripts, research, and platform packs."}</p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => onOpen(p.id)}>Open project →</button>
            <label style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>Status</span>
              <select value={p.status} style={{ width: "auto", marginTop: 0 }} onChange={(e) => { saveProject({ ...p, status: e.target.value as ProjectStatus }); notify(`Moved to ${projectStatusLabel(e.target.value as ProjectStatus)}`); }}>
                {(["idea", "writing", "to-record", "editing", "ready-to-publish", "published"] as ProjectStatus[]).map((s) => (
                  <option key={s} value={s}>{projectStatusLabel(s)}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn ghost" onClick={() => { saveProject({ ...p, archived: !p.archived }); notify(p.archived ? "Project restored" : "Project archived"); }}>{p.archived ? "Restore" : "Archive"}</button>
            <button type="button" className="btn ghost" onClick={() => saveProject({ ...p, starred: !p.starred })}>{p.starred ? "Unstar ★" : "★"}</button>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ── Project detail editor (overlay) ── */
export function ProjectDetail({
  project, onClose, onSave, onDelete, notify,
}: {
  project: Project;
  onClose: () => void;
  onSave: (p: Project) => void;
  onDelete: () => void;
  notify: (msg: string) => void;
}) {
  const [p, setP] = useState(project);
  useEffect(() => setP(project), [project.id]);
  const dirty = JSON.stringify(p) !== JSON.stringify(project);
  const set = (patch: Partial<Project>) => setP((x) => ({ ...x, ...patch }));
  const setPlatform = (key: PlatformKey, patch: Partial<Project["platforms"][PlatformKey]>) =>
    setP((x) => ({ ...x, platforms: { ...x.platforms, [key]: { ...x.platforms[key], ...patch } } }));

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const close = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onClose();
  };

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(okMsg);
    } catch {
      downloadText("creator-dashboard-copy.txt", text);
      notify("Copy blocked by the browser — downloaded as a text file instead");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", overflowY: "auto", zIndex: 50 }} onClick={close}>
      <div className="card" style={{ maxWidth: 820, margin: "24px auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Edit project</h2>
          <button type="button" className="btn ghost" onClick={close}>Close ×</button>
        </div>
        {dirty && <p className="note">You have unsaved changes — Save before leaving, or they will be lost.</p>}

        <h3 style={{ marginTop: 20 }}>Overview</h3>
        <label>Title<input value={p.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label>Summary<textarea value={p.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="One-paragraph brief…" /></label>
        <div className="grid2">
          <label>Status
            <select value={p.status} onChange={(e) => set({ status: e.target.value as ProjectStatus })}>
              {(["idea", "writing", "to-record", "editing", "ready-to-publish", "published"] as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{projectStatusLabel(s)}</option>
              ))}
            </select>
          </label>
          <label>Priority
            <select value={p.priority} onChange={(e) => set({ priority: e.target.value as ProjectPriority })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        <div className="grid2">
          <label>Tags (comma-separated)<input value={p.tags} onChange={(e) => set({ tags: e.target.value })} /></label>
          <label>Target audience<input value={p.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Who is this for?" /></label>
        </div>
        <label>Planned publish date<input type="date" value={p.plannedDate} onChange={(e) => set({ plannedDate: e.target.value })} /></label>
        {p.legacyStatus && <p className="note">Migrated from a draft (original status: {p.legacyStatus}). The original status is kept here so the mapping never silently loses meaning.</p>}

        <h3 style={{ marginTop: 20 }}>Research</h3>
        <p className="note">Reference links, source notes, and working notes. Add as many as you need.</p>
        {p.research.map((r) => (
          <div key={r.id} className="card" style={{ marginTop: 8 }}>
            <label>Link<input value={r.url} onChange={(e) => set({ research: p.research.map((x) => x.id === r.id ? { ...x, url: e.target.value } : x) })} placeholder="https://…" /></label>
            <div className="grid2">
              <label>Source<input value={r.source} onChange={(e) => set({ research: p.research.map((x) => x.id === r.id ? { ...x, source: e.target.value } : x) })} placeholder="Video, article, account…" /></label>
              <label>Note<input value={r.note} onChange={(e) => set({ research: p.research.map((x) => x.id === r.id ? { ...x, note: e.target.value } : x) })} placeholder="What to use from it" /></label>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => set({ research: p.research.filter((x) => x.id !== r.id) })}>Remove</button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={() => set({ research: [...p.research, { id: uid(), url: "", source: "", note: "" }] })}>+ Add research item</button>
        </div>

        <h3 style={{ marginTop: 20 }}>Scripts</h3>
        <p className="note">Chinese and English scripts are edited and saved separately. A missing language stays blank — never auto-filled.</p>
        <label>Chinese script<textarea value={p.scriptZh} onChange={(e) => set({ scriptZh: e.target.value })} placeholder="Full Chinese script…" /></label>
        <label>English script<textarea value={p.scriptEn} onChange={(e) => set({ scriptEn: e.target.value })} placeholder="English script (optional — leave blank if you don't have one)" /></label>

        <h3 style={{ marginTop: 20 }}>Assets</h3>
        <p className="note">Links + notes only. Video files are never stored in this app's browser storage — paste a drive / cloud link instead.</p>
        {p.assets.map((a) => (
          <div key={a.id} className="card" style={{ marginTop: 8 }}>
            <div className="grid2">
              <label>Type
                <select value={a.kind} onChange={(e) => set({ assets: p.assets.map((x) => x.id === a.id ? { ...x, kind: e.target.value as AssetKind } : x) })}>
                  <option value="cover">Cover</option>
                  <option value="raw-video">Raw video</option>
                  <option value="srt">SRT subtitles</option>
                  <option value="final-video">Final video</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>Link<input value={a.url} onChange={(e) => set({ assets: p.assets.map((x) => x.id === a.id ? { ...x, url: e.target.value } : x) })} placeholder="https://…" /></label>
            </div>
            <label>Note<input value={a.note} onChange={(e) => set({ assets: p.assets.map((x) => x.id === a.id ? { ...x, note: e.target.value } : x) })} placeholder="Version, resolution, anything to remember" /></label>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => set({ assets: p.assets.filter((x) => x.id !== a.id) })}>Remove</button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={() => set({ assets: [...p.assets, { id: uid(), kind: "other" as AssetKind, url: "", note: "" }] })}>+ Add asset link</button>
        </div>

        <h3 style={{ marginTop: 20 }}>Publishing — {publishedCount(p)}/5 published</h3>
        <p className="note">Production status (above) and per-platform status (below) are saved separately. Marking one platform published never marks the others. This tool never posts to any platform for you — copy a pack out and publish it by hand.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => { setP(fillEmptyPlatformsFromProject(p)); notify("Empty platform fields filled from this project's own title, summary, and tags — review before use"); }}>Fill empty platforms from project</button>
          <button type="button" className="btn ghost" onClick={() => downloadText(`creator-dashboard-publish-pack-${slugify(p.title, p.id)}.md`, projectPackToMarkdown(p))}>Export full pack (.md)</button>
        </div>
        {PLATFORM_LIST.map(({ key, label }) => {
          const pack = p.platforms[key];
          return (
            <div key={key} className="card" style={{ marginTop: 8 }}>
              <h3>{label} <span className="tag">{pack.status}</span>{pack.publishedUrl ? <span className="tag">Link saved</span> : null}</h3>
              <div className="grid2">
                <label>Status
                  <select value={pack.status} onChange={(e) => setPlatform(key, { status: e.target.value as Project["platforms"][PlatformKey]["status"] })}>
                    <option value="not-ready">Not Ready</option>
                    <option value="ready">Ready</option>
                    <option value="published">Published</option>
                  </select>
                </label>
                <label>Scheduled time<input type="datetime-local" value={pack.scheduledTime} onChange={(e) => setPlatform(key, { scheduledTime: e.target.value })} /></label>
              </div>
              <label>Title<input value={pack.title} onChange={(e) => setPlatform(key, { title: e.target.value })} /></label>
              <label>Body / Description<textarea value={pack.body} onChange={(e) => setPlatform(key, { body: e.target.value })} style={{ minHeight: 90 }} /></label>
              <label>Hashtags<input value={pack.hashtags} onChange={(e) => setPlatform(key, { hashtags: e.target.value })} placeholder="#tag1 #tag2" /></label>
              <label>Cover URL<input value={pack.coverUrl} onChange={(e) => setPlatform(key, { coverUrl: e.target.value })} placeholder="https://…" /></label>
              <div className="grid2">
                <label>Published time<input value={pack.publishedTime ? new Date(pack.publishedTime).toLocaleString("en-US") : ""} readOnly placeholder="Set by Mark as Published" /></label>
                <label>Published URL<input value={pack.publishedUrl} onChange={(e) => setPlatform(key, { publishedUrl: e.target.value })} placeholder="https://… (optional)" /></label>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => copyText(platformPackToText(label, pack), `${label} copy copied`)}>Copy {label} copy</button>
                <button type="button" className="btn ghost" onClick={() => {
                  const fromKey = window.prompt(`Copy copy from which platform? Type one of: ${PLATFORM_LIST.filter((x) => x.key !== key).map((x) => x.label).join(", ")}`);
                  const found = PLATFORM_LIST.find((x) => x.label.toLowerCase() === (fromKey ?? "").trim().toLowerCase());
                  if (!found || found.key === key) { if (fromKey !== null) notify("Copy cancelled — unknown platform"); return; }
                  setP((x) => ({ ...x, platforms: { ...x.platforms, [key]: copyPlatformPackFields(x.platforms[found.key], x.platforms[key]) } }));
                  notify(`Copied from ${found.label} — now edit independently`);
                }}>Copy from…</button>
                <button type="button" className="btn" onClick={() => {
                  const url = window.prompt("Published URL (optional — leave blank to skip)", pack.publishedUrl);
                  if (url === null) return;
                  setPlatform(key, { status: "published", publishedTime: new Date().toISOString(), publishedUrl: url.trim() });
                  notify(`${label} marked as published — other platforms untouched`);
                }}>Mark as Published</button>
              </div>
            </div>
          );
        })}

        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" disabled={!p.title.trim()} onClick={() => { onSave({ ...p, updatedAt: today() }); notify("Project saved ✓"); onClose(); }}>Save</button>
          <button type="button" className="btn ghost" onClick={() => { onSave({ ...p, archived: !p.archived, updatedAt: today() }); notify(p.archived ? "Project restored" : "Project archived"); onClose(); }}>{p.archived ? "Restore" : "Archive"}</button>
          <button type="button" className="btn danger" onClick={() => { if (window.confirm("Delete this project? Its scripts and platform packs will be gone. Export a backup first if you need them.")) onDelete(); }}>Delete project</button>
        </div>
      </div>
    </div>
  );
}
