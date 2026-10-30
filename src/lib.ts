import type { Draft, PublishPack, WorkbenchData } from "./types";

export const STORAGE_KEY = "creator-workbench-v1";

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function today(): string {
  return new Date().toISOString();
}

/** Two clearly-labelled generic examples. Delete them in one click. No real scripts are shipped. */
export const EXAMPLE_DATA: WorkbenchData = {
  ideas: [
    {
      id: "example-idea-1",
      title: "示例：一个 AI 工具，我先替你试了 7 天",
      hook: "示例钩子：先说结论，再讲 3 个真实使用场景，最后说它不适合谁。",
      platform: "youtube",
      sourceNote: "示例卡片：把你刷到的视频 / 新闻链接记在这里，方便回查依据。",
      views: null,
      likes: null,
      starred: true,
      createdAt: today(),
    },
  ],
  drafts: [
    {
      id: "example-draft-1",
      title: "示例：一个 AI 工具，我先替你试了 7 天",
      summary: "示例简介：这条讲一个工具的 3 个用法和 1 个坑，适合刚入门的观众。",
      scriptZh: "示例中文稿（请替换成你自己的稿子）：\n第一段：先说结论。\n第二段：讲 3 个场景。\n第三段：说它不适合谁，结尾留一个互动问题。",
      scriptEn: "",
      status: "scripting",
      keywords: "示例, AI工具",
      views: 0,
      likes: 0,
      starred: false,
      pack: null,
      createdAt: today(),
      updatedAt: today(),
    },
  ],
  accounts: [
    { id: "example-account-1", platform: "youtube", label: "YouTube", handle: "", url: "" },
    { id: "example-account-2", platform: "douyin", label: "抖音", handle: "", url: "" },
    { id: "example-account-3", platform: "xiaohongshu", label: "小红书", handle: "", url: "" },
    { id: "example-account-4", platform: "tiktok", label: "TikTok", handle: "", url: "" },
    { id: "example-account-5", platform: "instagram", label: "Instagram", handle: "", url: "" },
  ],
  skills: [
    {
      id: "example-skill-1",
      name: "示例 Skill：口播分段表",
      description: "示例：先出文字分段表，确认后再渲染——文字先行，成片后置。",
      category: "video",
      status: "draft",
      tags: "口播, 分段表",
      content: "# 口播分段表（示例）\n\n1. 先写每一段的文案和画面\n2. 确认无误后再剪辑\n3. 不确定的段落先留空，不编造",
      starred: false,
    },
  ],
};

export function loadData(): WorkbenchData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EXAMPLE_DATA);
    const parsed = JSON.parse(raw) as WorkbenchData;
    if (!parsed || !Array.isArray(parsed.drafts)) return structuredClone(EXAMPLE_DATA);
    return parsed;
  } catch {
    return structuredClone(EXAMPLE_DATA);
  }
}

export function saveData(data: WorkbenchData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export const STATUS_LABEL: Record<Draft["status"], string> = {
  idea: "想法 · 待录",
  scripting: "写稿中 · 待录",
  recorded: "已录制",
  editing: "剪辑中",
  final: "定稿",
  published: "已发布",
};

/**
 * Build a publish pack from a draft's own script.
 *
 * Honest rule, kept on purpose:
 * - Only the language that actually has a script gets a title/description.
 * - A missing language stays blank. It is never auto-translated or filled in.
 * - The result is always a draft for you to edit, never auto-published.
 */
export function buildPublishPack(draft: Draft): PublishPack {
  const firstLine = (text: string) => text.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  const zh = draft.scriptZh.trim();
  const en = draft.scriptEn.trim();
  return {
    titleZh: zh ? draft.title : "",
    descZh: zh ? `${draft.summary || firstLine(zh)}` : "",
    titleEn: en ? draft.title : "",
    descEn: en ? `${draft.summary || firstLine(en)}` : "",
    tags: draft.keywords,
  };
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function skillsToMarkdown(skills: typeof EXAMPLE_DATA.skills): string {
  const lines = ["# Skill 合集\n"];
  for (const s of skills) {
    lines.push(`## ${s.name}\n\n${s.description}\n\n${s.content}\n`);
  }
  return lines.join("\n");
}
