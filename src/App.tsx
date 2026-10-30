import { useEffect, useMemo, useState } from "react";
import {
  buildPublishPack,
  downloadText,
  fetchYouTubeStats,
  fmt,
  loadApiKey,
  loadData,
  parseYouTubeId,
  saveApiKey,
  saveData,
  skillsToMarkdown,
  statusLabel,
  today,
  uid,
} from "./lib";
import type { Account, Draft, Idea, Skill, Status, WorkbenchData } from "./types";

type Section = "ideas" | "drafts" | "accounts" | "traffic" | "skills";


const PLATFORMS = ["all", "douyin", "xiaohongshu", "youtube", "tiktok", "instagram", "news"];
const EMPTY: WorkbenchData = { ideas: [], drafts: [], accounts: [], skills: [] };

export function App() {
  const [data, setData] = useState<WorkbenchData>(() => loadData());
  const [section, setSection] = useState<Section>("drafts");
  const SECTIONS: Array<{ key: Section; label: string; sub: string }> = [
    { key: "ideas", label: "Ideas", sub: "Inspiration · Sources · Heat" },
    { key: "drafts", label: "Drafts", sub: "Bilingual · Publish packs" },
    { key: "accounts", label: "Accounts", sub: "Open homepage in one click" },
    { key: "traffic", label: "Traffic", sub: "Views / Likes ranking" },
    { key: "skills", label: "Skill Collection", sub: "Organize · Export Markdown" },
  ];
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => saveData(data), [data]);

  const update = (patch: Partial<WorkbenchData>) => setData((d) => ({ ...d, ...patch }));
  /** Functional draft updater, so sequential auto-syncs never overwrite each other's results with a stale snapshot. */
  const updateDrafts = (fn: (drafts: Draft[]) => Draft[]) => setData((d) => ({ ...d, drafts: fn(d.drafts) }));
  const counts: Record<Section, number> = {
    ideas: data.ideas.length,
    drafts: data.drafts.length,
    accounts: data.accounts.filter((a) => a.url).length,
    traffic: data.drafts.filter((d) => d.views > 0).length,
    skills: data.skills.length,
  };
  const selectedDraft = data.drafts.find((d) => d.id === selectedDraftId) ?? null;
  const selectedSkill = data.skills.find((s) => s.id === selectedSkillId) ?? null;

  return (
    <div className="layout">
      <aside aria-label="Main navigation">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`navbtn ${section === s.key ? "active" : ""}`}
            onClick={() => setSection(s.key)}
            aria-pressed={section === s.key}
          >
            <b>
              {s.label} <span>{counts[s.key]}</span>
            </b>
            <span>{s.sub}</span>
          </button>
        ))}
        <p className="hint">
          Flow: find ideas → write bilingual drafts → generate a publish pack (draft, edit by hand) → fill in traffic after publishing → double down on what performs.
          Data lives only in your browser. Nothing is uploaded to any server.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => downloadText("creator-workbench-backup.json", JSON.stringify(data, null, 2))}
          >
            Export backup
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (window.confirm("Clear all data? Export a backup first.")) update(EMPTY);
            }}
          >
            Clear examples
          </button>
        </div>
      </aside>

      <main>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Creator Workbench</h2>
            <p className="sub">Personal creator workbench · Minimal version · Text first, video second</p>
          </div>
          <input
            aria-label="Search"
            placeholder="Search titles / keywords…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 220 }}
          />
        </div>

        {section === "ideas" && <Ideas data={data} query={query} update={update} />}
        {section === "drafts" && (
          <Drafts data={data} query={query} update={update} onOpen={setSelectedDraftId} />
        )}
        {section === "accounts" && <Accounts data={data} update={update} />}
        {section === "traffic" && <Traffic data={data} update={update} updateDrafts={updateDrafts} onOpen={(id) => { setSection("drafts"); setSelectedDraftId(id); }} />}
        {section === "skills" && <Skills data={data} update={update} onOpen={setSelectedSkillId} />}
      </main>

      {selectedDraft && (
        <DraftDetail
          draft={selectedDraft}
          onClose={() => setSelectedDraftId(null)}
          onSave={(next) =>
            update({ drafts: data.drafts.map((d) => (d.id === next.id ? { ...next, updatedAt: today() } : d)) })
          }
          onDelete={() => {
            update({ drafts: data.drafts.filter((d) => d.id !== selectedDraft.id) });
            setSelectedDraftId(null);
          }}
        />
      )}
      {selectedSkill && (
        <SkillDetail
          skill={selectedSkill}
          onClose={() => setSelectedSkillId(null)}
          onSave={(next) => update({ skills: data.skills.map((s) => (s.id === next.id ? next : s)) })}
          onDelete={() => {
            update({ skills: data.skills.filter((s) => s.id !== selectedSkill.id) });
            setSelectedSkillId(null);
          }}
        />
      )}
    </div>
  );
}

/* ── Ideas ── */
function Ideas({ data, query, update }: { data: WorkbenchData; query: string; update: (p: Partial<WorkbenchData>) => void }) {
  const [platform, setPlatform] = useState("all");
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [sourceNote, setSourceNote] = useState("");

  const visible = data.ideas.filter((i) => {
    if (platform !== "all" && i.platform !== platform) return false;
    if (query && !`${i.title} ${i.hook}`.includes(query)) return false;
    return true;
  });

  return (
    <section aria-label="Ideas">
      <div className="card">
        <h3>+ New idea</h3>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: an AI tool I tested for 7 days" /></label>
        <label>Hook / one-line highlight<input value={hook} onChange={(e) => setHook(e.target.value)} /></label>
        <div className="grid2">
          <label>Platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p === "all" ? "All" : p}</option>)}
            </select>
          </label>
          <label>Source / link note<input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="Video link, news link, or what to search for in the app" /></label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button" className="btn" disabled={!title.trim()}
            onClick={() => {
              const idea: Idea = { id: uid(), title: title.trim(), hook: hook.trim(), platform: platform === "all" ? "youtube" : platform, sourceNote: sourceNote.trim(), views: null, likes: null, starred: false, createdAt: today() };
              update({ ideas: [idea, ...data.ideas] });
              setTitle(""); setHook(""); setSourceNote("");
            }}
          >
            Save idea
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {PLATFORMS.map((p) => (
          <button key={p} type="button" className={`pill ${platform === p ? "active" : ""}`} onClick={() => setPlatform(p)}>{p === "all" ? "All" : p}</button>
        ))}
      </div>

      {visible.length === 0 && <p className="note">No ideas yet. Add one above, or create a draft directly in Drafts.</p>}
      {visible.map((idea) => (
        <article key={idea.id} className="card">
          <h3>{idea.starred ? "★ " : ""}{idea.title}</h3>
          <p>{idea.hook}</p>
          <p><span className="tag">{idea.platform}</span> {idea.sourceNote}</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => {
              const draft: Draft = { id: uid(), title: idea.title, summary: idea.hook, scriptZh: "", scriptEn: "", status: "idea", keywords: "", views: 0, likes: 0, starred: idea.starred, pack: null, createdAt: today(), updatedAt: today() };
              update({ drafts: [draft, ...data.drafts], ideas: data.ideas.filter((i) => i.id !== idea.id) });
            }}>→ Move to Drafts</button>
            <button type="button" className="btn ghost" onClick={() => update({ ideas: data.ideas.map((i) => i.id === idea.id ? { ...i, starred: !i.starred } : i) })}>{idea.starred ? "Unstar ★" : "★ Star"}</button>
            <button type="button" className="btn ghost" onClick={() => { if (window.confirm("Delete this idea?")) update({ ideas: data.ideas.filter((i) => i.id !== idea.id) }); }}>Delete</button>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ── Drafts ── */
function Drafts({ data, query, update, onOpen }: { data: WorkbenchData; query: string; update: (p: Partial<WorkbenchData>) => void; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | "todo" | "done" | "starred">("all");
  const [title, setTitle] = useState("");
  const isDone = (d: Draft) => ["recorded", "editing", "final", "published"].includes(d.status);
  const visible = data.drafts.filter((d) => {
    if (filter === "todo" && isDone(d)) return false;
    if (filter === "done" && !isDone(d)) return false;
    if (filter === "starred" && !d.starred) return false;
    if (query && !`${d.title} ${d.summary} ${d.keywords}`.includes(query)) return false;
    return true;
  });
  const todo = data.drafts.filter((d) => !isDone(d)).length;

  return (
    <section aria-label="Drafts">
      <div className="grid2">
        <div className="stat"><b>{todo}</b><span>To record (idea / scripting)</span></div>
        <div className="stat"><b>{data.drafts.length - todo}</b><span>Done (recorded / editing / published)</span></div>
      </div>
      <div className="card">
        <h3>+ New draft</h3>
        <div className="row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Draft title" style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn" disabled={!title.trim()} onClick={() => {
            const draft: Draft = { id: uid(), title: title.trim(), summary: "", scriptZh: "", scriptEn: "", status: "scripting", keywords: "", views: 0, likes: 0, starred: false, pack: null, createdAt: today(), updatedAt: today() };
            update({ drafts: [draft, ...data.drafts] });
            setTitle("");
            onOpen(draft.id);
          }}>Create and edit</button>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {(["all", "todo", "done", "starred"] as const).map((f) => (
          <button key={f} type="button" className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "todo" ? "To record" : f === "done" ? "Done" : "★ Priority"}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="note">Nothing here yet — move an idea in from Ideas, or create a draft above.</p>}
      {visible.map((d) => (
        <article key={d.id} className="card">
          <h3>{d.starred ? "★ " : ""}{d.title}</h3>
          <p><span className="tag">{statusLabel(d.status)}</span> {d.pack ? <span className="tag">Publish pack draft</span> : null} {d.trafficSource === "youtube" ? <span className="tag">Auto traffic · YouTube</span> : null} {!d.scriptEn.trim() ? <span className="tag">English version pending</span> : null}</p>
          <p>{d.summary || "Open to add a summary and full script"}</p>
          <p><strong>{fmt(d.views)}</strong> Views · <strong>{fmt(d.likes)}</strong> Likes</p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => onOpen(d.id)}>Edit Chinese / English →</button>
            <button type="button" className="btn ghost" onClick={() => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, starred: !x.starred } : x) })}>{d.starred ? "Unstar ★" : "★"}</button>
            {(d.scriptZh.trim() || d.scriptEn.trim()) && (
              <button type="button" className="btn" onClick={() => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, pack: buildPublishPack(x) } : x) })}>{d.pack ? "Regenerate publish pack" : "Generate publish pack"}</button>
            )}
          </div>
          {d.pack && (
            <p className="note">Publish pack draft generated: Chinese {d.pack.titleZh ? "present" : "blank (no Chinese script, never auto-translated)"} · English {d.pack.titleEn ? "present" : "blank (no English script, never auto-translated)"}. Open the detail to edit, then publish manually.</p>
          )}
        </article>
      ))}
    </section>
  );
}

/* ── Accounts ── */
function Accounts({ data, update }: { data: WorkbenchData; update: (p: Partial<WorkbenchData>) => void }) {
  const [label, setLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  return (
    <section aria-label="Accounts">
      <div className="card">
        <h3>+ Add account</h3>
        <div className="grid2">
          <label>Name<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Example: My YouTube" /></label>
          <label> handle<input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname (optional)" /></label>
        </div>
        <label>Homepage link<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={!label.trim()} onClick={() => {
            update({ accounts: [...data.accounts, { id: uid(), platform: label.trim(), label: label.trim(), handle: handle.trim(), url: url.trim() }] });
            setLabel(""); setHandle(""); setUrl("");
          }}>Save</button>
        </div>
      </div>
      <div className="grid2">
        {data.accounts.map((a) => (
          <div key={a.id} className="card">
            <h3>{a.label}</h3>
            <p>{a.handle || (a.url ? "Open account ↗" : "No link yet")}</p>
            <div className="row">
              {a.url && <a className="btn ghost" href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Open homepage ↗</a>}
              <button type="button" className="btn ghost" onClick={() => { const next = window.prompt("New homepage link (leave blank to clear)", a.url); if (next !== null) update({ accounts: data.accounts.map((x) => x.id === a.id ? { ...x, url: next.trim() } : x) }); }}>Edit link</button>
              <button type="button" className="btn ghost" onClick={() => update({ accounts: data.accounts.filter((x) => x.id !== a.id) })}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <p className="note">Links filled {data.accounts.filter((a) => a.url).length}/{data.accounts.length} . Only links you enter yourself are stored; no account data is fetched automatically.</p>
    </section>
  );
}

/* ── Traffic: manual + YouTube auto ── */
function Traffic({ data, update, updateDrafts, onOpen }: { data: WorkbenchData; update: (p: Partial<WorkbenchData>) => void; updateDrafts: (fn: (drafts: Draft[]) => Draft[]) => void; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<"views" | "likes" | "recent">("views");
  const [apiKey, setApiKey] = useState(() => loadApiKey());
  const [keySaved, setKeySaved] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncAll, setSyncAll] = useState(false);
  const sorted = useMemo(() => {
    const arr = [...data.drafts];
    if (sort === "views") arr.sort((a, b) => b.views - a.views);
    else if (sort === "likes") arr.sort((a, b) => b.likes - a.likes);
    else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return arr;
  }, [data.drafts, sort]);
  const totalViews = data.drafts.reduce((s, d) => s + d.views, 0);
  const totalLikes = data.drafts.reduce((s, d) => s + d.likes, 0);
  const youtubeDrafts = data.drafts.filter((d) => d.trafficSource === "youtube");

  const syncOne = async (draft: Draft) => {
    const videoId = parseYouTubeId(draft.videoUrl ?? "");
    if (!apiKey.trim()) {
      updateDrafts((ds) => ds.map((x) => x.id === draft.id ? { ...x, syncError: "Enter a YouTube API Key above first, then auto-refresh" } : x));
      return;
    }
    if (!videoId) {
      updateDrafts((ds) => ds.map((x) => x.id === draft.id ? { ...x, syncError: "Could not parse the video link / ID: paste a watch?v=, youtu.be, or Shorts link" } : x));
      return;
    }
    setSyncing(draft.id);
    try {
      const stats = await fetchYouTubeStats(apiKey.trim(), videoId);
      updateDrafts((ds) => ds.map((x) => x.id === draft.id ? { ...x, views: stats.views, likes: stats.likes, lastSyncedAt: today(), syncError: "", updatedAt: today() } : x));
    } catch (err) {
      updateDrafts((ds) => ds.map((x) => x.id === draft.id ? { ...x, syncError: err instanceof Error ? err.message : "Sync failed" } : x));
    } finally {
      setSyncing(null);
    }
  };

  const syncAllYoutube = async () => {
    if (youtubeDrafts.length === 0) return;
    setSyncAll(true);
    // Sequential on purpose: one videos.list call is cheap, but a burst is easy to avoid.
    // Each syncOne uses the functional updater, so later results never clobber earlier ones.
    for (const draft of youtubeDrafts) {
      await syncOne(draft);
    }
    setSyncAll(false);
  };

  return (
    <section aria-label="Traffic">
      <div className="grid2">
        <div className="stat"><b>{fmt(totalViews)}</b><span>Total views</span></div>
        <div className="stat"><b>{fmt(totalLikes)}</b><span>Total likes</span></div>
      </div>

      <div className="card">
        <h3>Auto-read · YouTube</h3>
        <p>Paste a video link into a draft below, choose Auto · YouTube, then auto-refresh, and views and likes come back from the official YouTube API. Manual mode stays as it is and needs no key.</p>
        <label>YouTube Data API Key (stored only in this browser)
          <input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); setKeySaved(false); }} placeholder="AIza… (create in Google Cloud Console after enabling YouTube Data API v3)" autoComplete="off" />
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => { saveApiKey(apiKey); setKeySaved(true); }}>Save key locally</button>
          <button type="button" className="btn ghost" disabled={syncAll || youtubeDrafts.length === 0} onClick={syncAllYoutube}>{syncAll ? "Refreshing all…" : `Refresh all YouTube in one click (${youtubeDrafts.length} items)`}</button>
          {keySaved && <span style={{ fontSize: 12, color: "var(--accent-strong)" }}>Saved locally ✓ Backup export does not include the key</span>}
        </div>
        <p className="note">The key is never included in a backup export and never sent to any server of this tool (there is none); it goes from your browser straight to googleapis.com. The default quota is 10,000 units per day and one videos.list call costs 1 unit. Without a key, or for an unpublished video, auto-refresh errors and that item stays manual.</p>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {(["views", "likes", "recent"] as const).map((k) => (
          <button key={k} type="button" className={`pill ${sort === k ? "active" : ""}`} onClick={() => setSort(k)}>{k === "views" ? "Most views" : k === "likes" ? "Most likes" : "Recently updated"}</button>
        ))}
      </div>
      <p className="note">Douyin / TikTok / RedNote / Instagram are manual in this minimal version: they have no public, review-free read API, and scraping them would be unstable and against their terms, so no fake automation is included. Outside YouTube, enter the numbers you see on each platform by hand and the ranking still re-sorts itself.</p>

      {sorted.map((d) => {
        const linked = data.accounts.find((a) => a.id === d.accountId);
        return (
          <article key={d.id} className="card">
            <h3>{d.title}</h3>
            <p>
              <strong>{fmt(d.views)}</strong> Views · <strong>{fmt(d.likes)}</strong> Likes · {statusLabel(d.status)}
              <span className="tag">{d.trafficSource === "youtube" ? "Auto · YouTube" : "Manual"}</span>
              {linked ? <span className="tag">Linked account: {linked.label}</span> : null}
            </p>
            <div className="grid2">
              <label>Traffic source
                <select value={d.trafficSource ?? "manual"} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, trafficSource: e.target.value as Draft["trafficSource"], syncError: "" } : x) })}>
                  <option value="manual">Manual entry</option>
                  <option value="youtube">Auto · YouTube</option>
                </select>
              </label>
              <label>Linked account (optional, from Accounts)
                <select value={d.accountId ?? ""} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, accountId: e.target.value } : x) })}>
                  <option value="">No linked account</option>
                  {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}{a.handle ? ` ${a.handle}` : ""}</option>)}
                </select>
              </label>
            </div>
            {d.trafficSource === "youtube" && (
              <>
                <label>Video link / ID
                  <input value={d.videoUrl ?? ""} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, videoUrl: e.target.value, syncError: "" } : x) })} placeholder="https://www.youtube.com/watch?v=… or youtu.be/… or a Shorts link" />
                </label>
                <div className="row" style={{ marginTop: 12 }}>
                  <button type="button" className="btn" disabled={syncing === d.id} onClick={() => syncOne(d)}>{syncing === d.id ? "Syncing…" : "Auto-refresh this one"}</button>
                  {d.lastSyncedAt && <span style={{ fontSize: 12, color: "var(--dim)" }}>Last synced: {new Date(d.lastSyncedAt).toLocaleString("en-US")}</span>}
                </div>
                {d.syncError && <p style={{ fontSize: 12, color: "#dc2626" }}>{d.syncError}</p>}
                <p className="note">Auto-refresh overwrites the manually entered views / likes above. To keep manual numbers, switch the source back to Manual entry.</p>
              </>
            )}
            <div className="row">
              <label style={{ flex: 1 }}>Views<input type="number" min={0} value={d.views} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, views: Math.max(0, Number(e.target.value) || 0) } : x) })} /></label>
              <label style={{ flex: 1 }}>Likes<input type="number" min={0} value={d.likes} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, likes: Math.max(0, Number(e.target.value) || 0) } : x) })} /></label>
              <button type="button" className="btn ghost" onClick={() => onOpen(d.id)}>Open draft →</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

/* ── Skill Collection ── */
function Skills({ data, update, onOpen }: { data: WorkbenchData; update: (p: Partial<WorkbenchData>) => void; onOpen: (id: string) => void }) {
  const [name, setName] = useState("");
  return (
    <section aria-label="Skill Collection">
      <div className="card">
        <h3>+ New skill</h3>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Skill name" style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn" disabled={!name.trim()} onClick={() => {
            const s: Skill = { id: uid(), name: name.trim(), description: "", category: "general", status: "draft", tags: "", content: "", starred: false };
            update({ skills: [s, ...data.skills] });
            setName("");
            onOpen(s.id);
          }}>Create and edit</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={() => downloadText("skills.md", skillsToMarkdown(data.skills))}>Export skills.md</button>
        </div>
        <p className="note">Verify each item before exporting: do not publish unverified content. A public repo should hold only generic versions — no personal style, unverified notes, or private information.</p>
      </div>
      {data.skills.map((s) => (
        <article key={s.id} className="card">
          <h3>{s.starred ? "★ " : ""}{s.name}</h3>
          <p><span className="tag">{s.status}</span> {s.tags}</p>
          <p>{s.description || "Open to add a description and body"}</p>
          <button type="button" className="btn ghost" onClick={() => onOpen(s.id)}>Edit →</button>
        </article>
      ))}
    </section>
  );
}

/* ── Draft detail (full-screen overlay editor, simple modal layer) ── */
function DraftDetail({ draft, onClose, onSave, onDelete }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => void; onDelete: () => void }) {
  const [d, setD] = useState(draft);
  useEffect(() => setD(draft), [draft.id]);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", overflowY: "auto", zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 760, margin: "24px auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Edit draft</h2>
          <button type="button" className="btn ghost" onClick={onClose}>Close ×</button>
        </div>
        <label>Title<input value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label>Summary<input value={d.summary} onChange={(e) => set({ summary: e.target.value })} /></label>
        <div className="grid2">
          <label>Status
            <select value={d.status} onChange={(e) => set({ status: e.target.value as Status })}>
              {(["idea", "scripting", "recorded", "editing", "final", "published"] as Status[]).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>
          <label>Keywords (comma-separated)<input value={d.keywords} onChange={(e) => set({ keywords: e.target.value })} /></label>
        </div>
        <label>Chinese script<textarea value={d.scriptZh} onChange={(e) => set({ scriptZh: e.target.value })} placeholder="Full Chinese script…" /></label>
        <label>English script<textarea value={d.scriptEn} onChange={(e) => set({ scriptEn: e.target.value })} placeholder="English script (optional — leave blank if you don't have one)" /></label>

        <h3 style={{ marginTop: 20 }}>Publish pack (draft)</h3>
        <p className="note">Rule: only the language that actually has a script gets a title and description; a missing language stays blank and is never auto-translated to fill the gap. Edit the result by hand, then publish manually — this tool never uploads to any platform.</p>
        <div className="row">
          <button type="button" className="btn" disabled={!d.scriptZh.trim() && !d.scriptEn.trim()} onClick={() => set({ pack: buildPublishPack(d) })}>{d.pack ? "Regenerate publish pack" : "Generate publish pack"}</button>
          {d.pack && <button type="button" className="btn ghost" onClick={() => {
            const p = d.pack!;
            const text = `$Title (Chinese): ${p.titleZh || "(blank)"}\nDescription (Chinese): ${p.descZh || "(blank)"}\nTitle (English): ${p.titleEn || "(blank)"}\nDescription (English): ${p.descEn || "(blank)"}\nTags：${p.tags}`;
            navigator.clipboard?.writeText(text).catch(() => downloadText("publish-pack.txt", text));
            alert("Publish pack copied (if the browser blocks copying, it was downloaded as publish-pack.txt instead)");
          }}>Copy publish pack</button>}
        </div>
        {d.pack && (
          <>
            <label>Title (Chinese)<input value={d.pack.titleZh} onChange={(e) => set({ pack: { ...d.pack!, titleZh: e.target.value } })} /></label>
            <label>Description (Chinese)<textarea value={d.pack.descZh} onChange={(e) => set({ pack: { ...d.pack!, descZh: e.target.value } })} /></label>
            <label>Title (English)<input value={d.pack.titleEn} onChange={(e) => set({ pack: { ...d.pack!, titleEn: e.target.value } })} /></label>
            <label>Description (English)<textarea value={d.pack.descEn} onChange={(e) => set({ pack: { ...d.pack!, descEn: e.target.value } })} /></label>
            <label>Tags<input value={d.pack.tags} onChange={(e) => set({ pack: { ...d.pack!, tags: e.target.value } })} /></label>
          </>
        )}

        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => { onSave(d); onClose(); }}>Save</button>
          <button type="button" className="btn danger" onClick={() => { if (window.confirm("Delete this draft?")) onDelete(); }}>Delete draft</button>
        </div>
      </div>
    </div>
  );
}

function SkillDetail({ skill, onClose, onSave, onDelete }: { skill: Skill; onClose: () => void; onSave: (s: Skill) => void; onDelete: () => void }) {
  const [s, setS] = useState(skill);
  const set = (patch: Partial<Skill>) => setS((x) => ({ ...x, ...patch }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", overflowY: "auto", zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 760, margin: "24px auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Edit skill</h2>
          <button type="button" className="btn ghost" onClick={onClose}>Close ×</button>
        </div>
        <label>Name<input value={s.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>Description<input value={s.description} onChange={(e) => set({ description: e.target.value })} /></label>
        <div className="grid2">
          <label>Category<input value={s.category} onChange={(e) => set({ category: e.target.value })} /></label>
          <label>Status
            <select value={s.status} onChange={(e) => set({ status: e.target.value as Skill["status"] })}>
              <option value="draft">Drafts</option>
              <option value="ready">Ready to publish</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
        <label>Tags<input value={s.tags} onChange={(e) => set({ tags: e.target.value })} /></label>
        <label>Body (Markdown)<textarea value={s.content} onChange={(e) => set({ content: e.target.value })} style={{ minHeight: 200 }} /></label>
        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => { onSave(s); onClose(); }}>Save</button>
          <button type="button" className="btn danger" onClick={() => { if (window.confirm("Delete this skill?")) onDelete(); }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// Keep Account type referenced for future account-edit UI.
export type { Account };
