import { useEffect, useMemo, useState } from "react";
import {
  buildPublishPack,
  downloadText,
  fmt,
  loadData,
  saveData,
  skillsToMarkdown,
  STATUS_LABEL,
  today,
  uid,
} from "./lib";
import type { Account, Draft, Idea, Skill, Status, WorkbenchData } from "./types";

type Section = "ideas" | "drafts" | "accounts" | "traffic" | "skills";

const SECTIONS: Array<{ key: Section; label: string; sub: string }> = [
  { key: "ideas", label: "选题", sub: "灵感 · 依据 · 热度" },
  { key: "drafts", label: "草稿", sub: "中英双语 · 发布包" },
  { key: "accounts", label: "账号", sub: "一键打开主页" },
  { key: "traffic", label: "流量", sub: "播放 / 点赞排行" },
  { key: "skills", label: "Skill 合集", sub: "整理 · 导出 Markdown" },
];

const PLATFORMS = ["全部", "douyin", "xiaohongshu", "youtube", "tiktok", "instagram", "news"];
const EMPTY: WorkbenchData = { ideas: [], drafts: [], accounts: [], skills: [] };

export function App() {
  const [data, setData] = useState<WorkbenchData>(() => loadData());
  const [section, setSection] = useState<Section>("drafts");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => saveData(data), [data]);

  const update = (patch: Partial<WorkbenchData>) => setData((d) => ({ ...d, ...patch }));
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
      <aside aria-label="主导航">
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
          流程：选题找灵感 → 草稿写中英双语 → 生成发布包（草稿，需人工改）→ 发完回流量填数据 → 哪个火就续哪个。
          数据只存在你的浏览器本地，不上传任何服务器。
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => downloadText("creator-workbench-backup.json", JSON.stringify(data, null, 2))}
          >
            导出备份
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (window.confirm("清空全部数据？请先导出备份。")) update(EMPTY);
            }}
          >
            清空示例
          </button>
        </div>
      </aside>

      <main>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Creator Workbench</h2>
            <p className="sub">个人创作者工作台 · 最小可用版 · 文字先行，成片后置</p>
          </div>
          <input
            aria-label="搜索"
            placeholder="搜索标题 / 关键词…"
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
        {section === "traffic" && <Traffic data={data} update={update} onOpen={(id) => { setSection("drafts"); setSelectedDraftId(id); }} />}
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

/* ── 选题 ── */
function Ideas({ data, query, update }: { data: WorkbenchData; query: string; update: (p: Partial<WorkbenchData>) => void }) {
  const [platform, setPlatform] = useState("全部");
  const [title, setTitle] = useState("");
  const [hook, setHook] = useState("");
  const [sourceNote, setSourceNote] = useState("");

  const visible = data.ideas.filter((i) => {
    if (platform !== "全部" && i.platform !== platform) return false;
    if (query && !`${i.title} ${i.hook}`.includes(query)) return false;
    return true;
  });

  return (
    <section aria-label="选题">
      <div className="card">
        <h3>＋ 新选题</h3>
        <label>标题<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：一个工具，我先替你试了 7 天" /></label>
        <label>钩子 / 一句话亮点<input value={hook} onChange={(e) => setHook(e.target.value)} /></label>
        <div className="grid2">
          <label>平台
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>依据 / 链接备注<input value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="视频链接、新闻链接，或 App 里搜什么" /></label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button" className="btn" disabled={!title.trim()}
            onClick={() => {
              const idea: Idea = { id: uid(), title: title.trim(), hook: hook.trim(), platform: platform === "全部" ? "youtube" : platform, sourceNote: sourceNote.trim(), views: null, likes: null, starred: false, createdAt: today() };
              update({ ideas: [idea, ...data.ideas] });
              setTitle(""); setHook(""); setSourceNote("");
            }}
          >
            保存选题
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {PLATFORMS.map((p) => (
          <button key={p} type="button" className={`pill ${platform === p ? "active" : ""}`} onClick={() => setPlatform(p)}>{p}</button>
        ))}
      </div>

      {visible.length === 0 && <p className="note">还没有选题。上面加一条，或去「草稿」直接新建。</p>}
      {visible.map((idea) => (
        <article key={idea.id} className="card">
          <h3>{idea.starred ? "★ " : ""}{idea.title}</h3>
          <p>{idea.hook}</p>
          <p><span className="tag">{idea.platform}</span> {idea.sourceNote}</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => {
              const draft: Draft = { id: uid(), title: idea.title, summary: idea.hook, scriptZh: "", scriptEn: "", status: "idea", keywords: "", views: 0, likes: 0, starred: idea.starred, pack: null, createdAt: today(), updatedAt: today() };
              update({ drafts: [draft, ...data.drafts], ideas: data.ideas.filter((i) => i.id !== idea.id) });
            }}>→ 移到草稿</button>
            <button type="button" className="btn ghost" onClick={() => update({ ideas: data.ideas.map((i) => i.id === idea.id ? { ...i, starred: !i.starred } : i) })}>{idea.starred ? "取消 ★" : "★ 收藏"}</button>
            <button type="button" className="btn ghost" onClick={() => { if (window.confirm("删除这条选题？")) update({ ideas: data.ideas.filter((i) => i.id !== idea.id) }); }}>删除</button>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ── 草稿 ── */
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
    <section aria-label="草稿">
      <div className="grid2">
        <div className="stat"><b>{todo}</b><span>准备录（想法 / 写稿中）</span></div>
        <div className="stat"><b>{data.drafts.length - todo}</b><span>已完成（已录 / 剪辑 / 发布）</span></div>
      </div>
      <div className="card">
        <h3>＋ 新草稿</h3>
        <div className="row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="草稿标题" style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn" disabled={!title.trim()} onClick={() => {
            const draft: Draft = { id: uid(), title: title.trim(), summary: "", scriptZh: "", scriptEn: "", status: "scripting", keywords: "", views: 0, likes: 0, starred: false, pack: null, createdAt: today(), updatedAt: today() };
            update({ drafts: [draft, ...data.drafts] });
            setTitle("");
            onOpen(draft.id);
          }}>新建并编辑</button>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {(["all", "todo", "done", "starred"] as const).map((f) => (
          <button key={f} type="button" className={`pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "全部" : f === "todo" ? "准备录" : f === "done" ? "已完成" : "★ 优先"}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="note">这里还是空的 — 去「选题」移一条进来，或上面新建草稿。</p>}
      {visible.map((d) => (
        <article key={d.id} className="card">
          <h3>{d.starred ? "★ " : ""}{d.title}</h3>
          <p><span className="tag">{STATUS_LABEL[d.status]}</span> {d.pack ? <span className="tag">发布包草稿</span> : null} {!d.scriptEn.trim() ? <span className="tag">英文版待补</span> : null}</p>
          <p>{d.summary || "点开补简介和完整文案"}</p>
          <p><strong>{fmt(d.views)}</strong> 播放 · <strong>{fmt(d.likes)}</strong> 点赞</p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => onOpen(d.id)}>编辑中英文 →</button>
            <button type="button" className="btn ghost" onClick={() => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, starred: !x.starred } : x) })}>{d.starred ? "取消 ★" : "★"}</button>
            {(d.scriptZh.trim() || d.scriptEn.trim()) && (
              <button type="button" className="btn" onClick={() => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, pack: buildPublishPack(x) } : x) })}>{d.pack ? "重新生成发布包" : "生成发布包"}</button>
            )}
          </div>
          {d.pack && (
            <p className="note">发布包草稿已生成：中文{d.pack.titleZh ? "有" : "空（原文无中文稿，不自动翻译）"} · 英文{d.pack.titleEn ? "有" : "空（原文无英文稿，不自动翻译）"}。点开详情编辑后再手动发布。</p>
          )}
        </article>
      ))}
    </section>
  );
}

/* ── 账号 ── */
function Accounts({ data, update }: { data: WorkbenchData; update: (p: Partial<WorkbenchData>) => void }) {
  const [label, setLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  return (
    <section aria-label="账号">
      <div className="card">
        <h3>＋ 添加账号</h3>
        <div className="grid2">
          <label>名称<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例：我的 YouTube" /></label>
          <label> handle<input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname（可选）" /></label>
        </div>
        <label>主页链接<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></label>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={!label.trim()} onClick={() => {
            update({ accounts: [...data.accounts, { id: uid(), platform: label.trim(), label: label.trim(), handle: handle.trim(), url: url.trim() }] });
            setLabel(""); setHandle(""); setUrl("");
          }}>保存</button>
        </div>
      </div>
      <div className="grid2">
        {data.accounts.map((a) => (
          <div key={a.id} className="card">
            <h3>{a.label}</h3>
            <p>{a.handle || (a.url ? "点开账号 ↗" : "还没填链接")}</p>
            <div className="row">
              {a.url && <a className="btn ghost" href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>打开主页 ↗</a>}
              <button type="button" className="btn ghost" onClick={() => { const next = window.prompt("新主页链接（留空则清除）", a.url); if (next !== null) update({ accounts: data.accounts.map((x) => x.id === a.id ? { ...x, url: next.trim() } : x) }); }}>编辑链接</button>
              <button type="button" className="btn ghost" onClick={() => update({ accounts: data.accounts.filter((x) => x.id !== a.id) })}>删除</button>
            </div>
          </div>
        ))}
      </div>
      <p className="note">已填链接 {data.accounts.filter((a) => a.url).length}/{data.accounts.length} 个。只存你自己填的链接，不自动抓取任何账号数据。</p>
    </section>
  );
}

/* ── 流量 ── */
function Traffic({ data, update, onOpen }: { data: WorkbenchData; update: (p: Partial<WorkbenchData>) => void; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<"views" | "likes" | "recent">("views");
  const sorted = useMemo(() => {
    const arr = [...data.drafts];
    if (sort === "views") arr.sort((a, b) => b.views - a.views);
    else if (sort === "likes") arr.sort((a, b) => b.likes - a.likes);
    else arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return arr;
  }, [data.drafts, sort]);
  const totalViews = data.drafts.reduce((s, d) => s + d.views, 0);
  const totalLikes = data.drafts.reduce((s, d) => s + d.likes, 0);
  return (
    <section aria-label="流量">
      <div className="grid2">
        <div className="stat"><b>{fmt(totalViews)}</b><span>总播放（手动填写）</span></div>
        <div className="stat"><b>{fmt(totalLikes)}</b><span>总点赞（手动填写）</span></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {(["views", "likes", "recent"] as const).map((k) => (
          <button key={k} type="button" className={`pill ${sort === k ? "active" : ""}`} onClick={() => setSort(k)}>{k === "views" ? "播放最高" : k === "likes" ? "点赞最高" : "最近更新"}</button>
        ))}
      </div>
      <p className="note">这里不接任何平台 API：发完片后，手动把各平台看到的播放 / 点赞填进来，排行自动重排。</p>
      {sorted.map((d) => (
        <article key={d.id} className="card">
          <h3>{d.title}</h3>
          <p><strong>{fmt(d.views)}</strong> 播放 · <strong>{fmt(d.likes)}</strong> 点赞 · {STATUS_LABEL[d.status]}</p>
          <div className="row">
            <label style={{ flex: 1 }}>播放<input type="number" min={0} value={d.views} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, views: Math.max(0, Number(e.target.value) || 0) } : x) })} /></label>
            <label style={{ flex: 1 }}>点赞<input type="number" min={0} value={d.likes} onChange={(e) => update({ drafts: data.drafts.map((x) => x.id === d.id ? { ...x, likes: Math.max(0, Number(e.target.value) || 0) } : x) })} /></label>
            <button type="button" className="btn ghost" onClick={() => onOpen(d.id)}>打开草稿 →</button>
          </div>
        </article>
      ))}
    </section>
  );
}

/* ── Skill 合集 ── */
function Skills({ data, update, onOpen }: { data: WorkbenchData; update: (p: Partial<WorkbenchData>) => void; onOpen: (id: string) => void }) {
  const [name, setName] = useState("");
  return (
    <section aria-label="Skill 合集">
      <div className="card">
        <h3>＋ 新 Skill</h3>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Skill 名称" style={{ flex: 1, minWidth: 200 }} />
          <button type="button" className="btn" disabled={!name.trim()} onClick={() => {
            const s: Skill = { id: uid(), name: name.trim(), description: "", category: "general", status: "draft", tags: "", content: "", starred: false };
            update({ skills: [s, ...data.skills] });
            setName("");
            onOpen(s.id);
          }}>新建并编辑</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={() => downloadText("skills.md", skillsToMarkdown(data.skills))}>导出 skills.md</button>
        </div>
        <p className="note">导出前请逐条核实：未核实的内容不要公开。公开仓库里只放通用版，不放个人风格、未核实笔记和私人信息。</p>
      </div>
      {data.skills.map((s) => (
        <article key={s.id} className="card">
          <h3>{s.starred ? "★ " : ""}{s.name}</h3>
          <p><span className="tag">{s.status}</span> {s.tags}</p>
          <p>{s.description || "点开补说明和正文"}</p>
          <button type="button" className="btn ghost" onClick={() => onOpen(s.id)}>编辑 →</button>
        </article>
      ))}
    </section>
  );
}

/* ── 草稿详情（全屏覆盖式编辑，用简单弹窗层实现） ── */
function DraftDetail({ draft, onClose, onSave, onDelete }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => void; onDelete: () => void }) {
  const [d, setD] = useState(draft);
  useEffect(() => setD(draft), [draft.id]);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", overflowY: "auto", zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 760, margin: "24px auto", padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>编辑草稿</h2>
          <button type="button" className="btn ghost" onClick={onClose}>关闭 ×</button>
        </div>
        <label>标题<input value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label>简介<input value={d.summary} onChange={(e) => set({ summary: e.target.value })} /></label>
        <div className="grid2">
          <label>状态
            <select value={d.status} onChange={(e) => set({ status: e.target.value as Status })}>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label>关键词（逗号分隔）<input value={d.keywords} onChange={(e) => set({ keywords: e.target.value })} /></label>
        </div>
        <label>中文稿<textarea value={d.scriptZh} onChange={(e) => set({ scriptZh: e.target.value })} placeholder="中文口播稿全文…" /></label>
        <label>英文稿 / English script<textarea value={d.scriptEn} onChange={(e) => set({ scriptEn: e.target.value })} placeholder="English script (optional — leave blank if you don't have one)" /></label>

        <h3 style={{ marginTop: 20 }}>发布包（草稿）</h3>
        <p className="note">规则：有哪种语言的稿子，就生成哪种语言的标题和简介；缺的语言留空，不自动翻译凑数。生成后请人工改完再手动发布，本工具不自动上传任何平台。</p>
        <div className="row">
          <button type="button" className="btn" disabled={!d.scriptZh.trim() && !d.scriptEn.trim()} onClick={() => set({ pack: buildPublishPack(d) })}>{d.pack ? "重新生成发布包" : "生成发布包"}</button>
          {d.pack && <button type="button" className="btn ghost" onClick={() => {
            const p = d.pack!;
            const text = `标题（中文）：${p.titleZh || "（空）"}\n简介（中文）：${p.descZh || "（空）"}\n标题（英文）：${p.titleEn || "（空）"}\n简介（英文）：${p.descEn || "（空）"}\n标签：${p.tags}`;
            navigator.clipboard?.writeText(text).catch(() => downloadText("publish-pack.txt", text));
            alert("发布包已复制（若浏览器不允许复制，已改为下载 publish-pack.txt）");
          }}>复制发布包</button>}
        </div>
        {d.pack && (
          <>
            <label>标题（中文）<input value={d.pack.titleZh} onChange={(e) => set({ pack: { ...d.pack!, titleZh: e.target.value } })} /></label>
            <label>简介（中文）<textarea value={d.pack.descZh} onChange={(e) => set({ pack: { ...d.pack!, descZh: e.target.value } })} /></label>
            <label>标题（英文）<input value={d.pack.titleEn} onChange={(e) => set({ pack: { ...d.pack!, titleEn: e.target.value } })} /></label>
            <label>简介（英文）<textarea value={d.pack.descEn} onChange={(e) => set({ pack: { ...d.pack!, descEn: e.target.value } })} /></label>
            <label>标签<input value={d.pack.tags} onChange={(e) => set({ pack: { ...d.pack!, tags: e.target.value } })} /></label>
          </>
        )}

        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => { onSave(d); onClose(); }}>保存</button>
          <button type="button" className="btn danger" onClick={() => { if (window.confirm("删除这条草稿？")) onDelete(); }}>删除草稿</button>
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
          <h2>编辑 Skill</h2>
          <button type="button" className="btn ghost" onClick={onClose}>关闭 ×</button>
        </div>
        <label>名称<input value={s.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>说明<input value={s.description} onChange={(e) => set({ description: e.target.value })} /></label>
        <div className="grid2">
          <label>分类<input value={s.category} onChange={(e) => set({ category: e.target.value })} /></label>
          <label>状态
            <select value={s.status} onChange={(e) => set({ status: e.target.value as Skill["status"] })}>
              <option value="draft">草稿</option>
              <option value="ready">可发布</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>
        <label>标签<input value={s.tags} onChange={(e) => set({ tags: e.target.value })} /></label>
        <label>正文（Markdown）<textarea value={s.content} onChange={(e) => set({ content: e.target.value })} style={{ minHeight: 200 }} /></label>
        <div className="row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={() => { onSave(s); onClose(); }}>保存</button>
          <button type="button" className="btn danger" onClick={() => { if (window.confirm("删除这个 Skill？")) onDelete(); }}>删除</button>
        </div>
      </div>
    </div>
  );
}

// Keep Account type referenced for future account-edit UI.
export type { Account };
