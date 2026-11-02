import { useMemo, useState } from "react";
import { addMonths, monthGrid, monthLabel, projectStatusLabel, publishedCount, toISODateLocal } from "./lib";
import type { Project, ProjectStatus } from "./types";

const COLUMNS: ProjectStatus[] = ["idea", "writing", "to-record", "editing", "ready-to-publish", "published"];

/* ── Board: six columns, drag to move (desktop) + Move-to select (all devices) ── */
export function Board({
  projects, saveProject, onOpen, notify,
}: {
  projects: Project[];
  saveProject: (p: Project) => void;
  onOpen: (id: string) => void;
  notify: (msg: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const active = projects.filter((p) => !p.archived);
  const move = (p: Project, status: ProjectStatus) => {
    if (p.status === status) return;
    saveProject({ ...p, status });
    notify(`Moved to ${projectStatusLabel(status)}`);
  };
  return (
    <section aria-label="Board">
      <p className="note">Drag a card between columns on desktop, or use the “Move to” menu on any device. Every change syncs to the list and calendar — they share the same projects.</p>
      <div className="board">
        {COLUMNS.map((col) => {
          const items = active.filter((p) => p.status === col);
          return (
            <div
              key={col}
              className="board-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const p = active.find((x) => x.id === dragId);
                if (p) move(p, col);
                setDragId(null);
              }}
            >
              <h4>{projectStatusLabel(col)} <span>({items.length})</span></h4>
              {items.length === 0 && <p className="note">Empty — drag a card here or use “Move to”.</p>}
              {items.map((p) => (
                <article
                  key={p.id}
                  className="board-card"
                  draggable
                  onDragStart={(e) => { setDragId(p.id); e.dataTransfer.setData("text/plain", p.id); }}
                  onDragEnd={() => setDragId(null)}
                >
                  <b>{p.title}</b>
                  <p>
                    <span className="tag">Priority: {p.priority}</span>
                    <span className="tag">{p.plannedDate ? `Planned ${p.plannedDate}` : "Unscheduled"}</span>
                    <span className="tag">{publishedCount(p)}/5 published</span>
                  </p>
                  <div className="row">
                    <button type="button" className="btn ghost" onClick={() => onOpen(p.id)}>Open →</button>
                    <label style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12 }}>Move to</span>
                      <select value={p.status} style={{ width: "auto", marginTop: 0 }} onChange={(e) => move(p, e.target.value as ProjectStatus)}>
                        {COLUMNS.map((s) => <option key={s} value={s}>{projectStatusLabel(s)}</option>)}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          );
        })}
      </div>
      <p className="note">Archived projects are hidden here; find them in Projects with “Show archived”.</p>
    </section>
  );
}

/* ── Calendar: month view, project dates or per-platform schedule ── */
export function Calendar({
  projects, saveProject, onOpen,
}: {
  projects: Project[];
  saveProject: (p: Project) => void;
  onOpen: (id: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [mode, setMode] = useState<"project" | "platform">("project");
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const todayIso = toISODateLocal(now);
  const active = projects.filter((p) => !p.archived);

  const chipsFor = (iso: string): Array<{ key: string; label: string; project: Project }> => {
    if (mode === "project") {
      return active.filter((p) => p.plannedDate === iso).map((p) => ({ key: p.id, label: p.title, project: p }));
    }
    const out: Array<{ key: string; label: string; project: Project }> = [];
    for (const p of active) {
      for (const [key, pack] of Object.entries(p.platforms)) {
        if (pack.scheduledTime && pack.scheduledTime.slice(0, 10) === iso) {
          out.push({ key: `${p.id}-${key}`, label: `${key.toUpperCase()} · ${p.title}`, project: p });
        }
      }
    }
    return out;
  };

  const go = (delta: number) => { const [y, m] = addMonths(year, month, delta); setYear(y); setMonth(m); };
  const unscheduled = active.filter((p) => !p.plannedDate);

  return (
    <section aria-label="Calendar">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>{monthLabel(year, month)}</h3>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => go(-1)}>‹ Prev</button>
            <button type="button" className="btn ghost" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>Today</button>
            <button type="button" className="btn ghost" onClick={() => go(1)}>Next ›</button>
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className={`pill ${mode === "project" ? "active" : ""}`} onClick={() => setMode("project")}>Project dates</button>
          <button type="button" className={`pill ${mode === "platform" ? "active" : ""}`} onClick={() => setMode("platform")}>Platform schedule</button>
        </div>
        <p className="note">
          {mode === "project"
            ? "Shows each project's planned publish date. Click a card to open it and change the date."
            : "Shows each platform's own scheduled time. Click a card to open the project and edit that platform."}
        </p>
      </div>
      <div className="cal">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="cal-head">{d}</div>)}
        {cells.map((iso) => {
          const inMonth = iso.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`;
          const chips = chipsFor(iso);
          return (
            <div key={iso} className={`cal-cell ${inMonth ? "" : "other"} ${iso === todayIso ? "today" : ""}`}>
              <span className="cal-day">{Number(iso.slice(8, 10))}</span>
              {chips.map((c) => (
                <button key={c.key} type="button" className="cal-chip" onClick={() => onOpen(c.project.id)} title={c.label}>{c.label}</button>
              ))}
            </div>
          );
        })}
      </div>
      <h3 style={{ marginTop: 20 }}>Unscheduled ({unscheduled.length})</h3>
      <p className="note">Projects without a planned date. Pick a date here or set it inside the project.</p>
      {unscheduled.length === 0 && <p className="note">Everything has a date.</p>}
      {unscheduled.map((p) => (
        <article key={p.id} className="card">
          <h3>{p.title}</h3>
          <p><span className="tag">{projectStatusLabel(p.status)}</span> <span className="tag">{publishedCount(p)}/5 published</span></p>
          <div className="row">
            <label style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>Planned date</span>
              <input type="date" value={p.plannedDate} style={{ width: "auto", marginTop: 0 }} onChange={(e) => saveProject({ ...p, plannedDate: e.target.value })} />
            </label>
            <button type="button" className="btn ghost" onClick={() => onOpen(p.id)}>Open project →</button>
          </div>
        </article>
      ))}
    </section>
  );
}
