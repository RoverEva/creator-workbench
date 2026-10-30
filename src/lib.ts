import type { Draft, PublishPack, WorkbenchData } from "./types";

export const STORAGE_KEY = "creator-workbench-v1";
/** Kept separate from the workbench backup on purpose: the backup export never includes the API key. */
export const SETTINGS_KEY = "creator-workbench-settings-v1";

export function loadApiKey(): string {
  try {
    return localStorage.getItem(SETTINGS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  localStorage.setItem(SETTINGS_KEY, key.trim());
}

/** Extract a YouTube video ID from a full URL, a Shorts/embed/live URL, or a bare ID. Returns null when it cannot be parsed. */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes("youtu.be") && parts[0]) return parts[0];
    if ((parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") && parts[1]) return parts[1];
  } catch {
    return null;
  }
  return null;
}

export interface YouTubeStats {
  views: number;
  likes: number;
  comments: number;
}

/** Read public statistics for one YouTube video via the official Data API v3. Runs in the browser; the key goes only to Google, never to this app's server (there is none). */
export async function fetchYouTubeStats(apiKey: string, videoId: string): Promise<YouTubeStats> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Network request failed: check your connection, or confirm the browser is not blocking googleapis.com");
  }
  const json = (await res.json().catch(() => null)) as { items?: Array<{ statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }>; error?: { message?: string } } | null;
  if (!res.ok) {
    const msg = json?.error?.message ?? `YouTube API returned ${res.status}`;
    if (res.status === 400) throw new Error(`Wrong API key or video ID: ${msg}`);
    if (res.status === 403) throw new Error(`API rejected (the key may not have YouTube Data API v3 enabled, or the daily quota may be used up): ${msg}`);
    throw new Error(msg);
  }
  const stats = json?.items?.[0]?.statistics;
  if (!stats) throw new Error("Video not found: confirm it is public and the link / ID is correct");
  return {
    views: Number(stats.viewCount ?? 0) || 0,
    likes: Number(stats.likeCount ?? 0) || 0,
    comments: Number(stats.commentCount ?? 0) || 0,
  };
}

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
      title: "Example: an AI tool I tested for 7 days",
      hook: "Example hook: lead with the conclusion, then 3 real use cases, then who it is not for.",
      platform: "youtube",
      sourceNote: "Example card: note the video / news link you found here so you can check the source later.",
      views: null,
      likes: null,
      starred: true,
      createdAt: today(),
    },
  ],
  drafts: [
    {
      id: "example-draft-1",
      title: "Example: an AI tool I tested for 7 days",
      summary: "Example summary: this one covers 3 uses and 1 pitfall of a tool, for beginners.",
      scriptZh: "Chinese script goes here (example — replace with your own script):\nParagraph 1: lead with the conclusion.\nParagraph 2: cover 3 scenarios.\nParagraph 3: say who it is not for, and end with a question for viewers.",
      scriptEn: "",
      status: "scripting",
      keywords: "example, AI tools",
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
    { id: "example-account-2", platform: "douyin", label: "Douyin", handle: "", url: "" },
    { id: "example-account-3", platform: "xiaohongshu", label: "RedNote", handle: "", url: "" },
    { id: "example-account-4", platform: "tiktok", label: "TikTok", handle: "", url: "" },
    { id: "example-account-5", platform: "instagram", label: "Instagram", handle: "", url: "" },
  ],
  skills: [
    {
      id: "example-skill-1",
      name: "Example Skill: Talking-head outline",
      description: "Example: write the text outline first, then render — text first, video second.",
      category: "video",
      status: "draft",
      tags: "talking-head, outline",
      content: "# Talking-head outline (example)\n\n1. Write the script and visuals for each segment\n2. Confirm before editing\n3. Leave uncertain segments blank — do not invent",
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
    // Backward compatibility: drafts saved by v0.1 have no traffic fields.
    return {
      ...parsed,
      drafts: parsed.drafts.map((d) => ({
        ...d,
        trafficSource: d.trafficSource ?? "manual",
        videoUrl: d.videoUrl ?? "",
        accountId: d.accountId ?? "",
        lastSyncedAt: d.lastSyncedAt ?? null,
        syncError: d.syncError ?? "",
      })),
    };
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

export function statusLabel(status: Draft["status"]): string {
  const map: Record<Draft["status"], string> = {
    idea: "Idea · To record",
    scripting: "Scripting · To record",
    recorded: "Recorded",
    editing: "Editing",
    final: "Final",
    published: "Published",
  };
  return map[status];
}

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
  const lines = ["# Skill Collection" + "\n"];
  for (const s of skills) {
    lines.push(`## ${s.name}\n\n${s.description}\n\n${s.content}\n`);
  }
  return lines.join("\n");
}
