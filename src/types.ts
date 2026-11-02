export type Status =
  | "idea"
  | "scripting"
  | "recorded"
  | "editing"
  | "final"
  | "published";

export interface Idea {
  id: string;
  title: string;
  hook: string;
  platform: string;
  sourceNote: string;
  views: number | null;
  likes: number | null;
  starred: boolean;
  createdAt: string;
}

export interface PublishPack {
  titleZh: string;
  descZh: string;
  titleEn: string;
  descEn: string;
  tags: string;
}

export type TrafficSource = "manual" | "youtube";

export interface Draft {
  id: string;
  title: string;
  summary: string;
  scriptZh: string;
  scriptEn: string;
  status: Status;
  keywords: string;
  views: number;
  likes: number;
  starred: boolean;
  pack: PublishPack | null;
  /** Traffic mode. Old drafts without this field are treated as manual. */
  trafficSource?: TrafficSource;
  /** Full YouTube video URL, or a bare 11-char video ID. Only used when trafficSource is youtube. */
  videoUrl?: string;
  /** Optional linked account (from the Accounts section) for this video. */
  accountId?: string;
  lastSyncedAt?: string | null;
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  platform: string;
  label: string;
  handle: string;
  url: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "draft" | "ready" | "published";
  tags: string;
  content: string;
  starred: boolean;
}

/* ── Projects (P0): one project = one piece of content, end to end ── */

export type ProjectStatus =
  | "idea"
  | "writing"
  | "to-record"
  | "editing"
  | "ready-to-publish"
  | "published";

export type ProjectPriority = "low" | "medium" | "high";

export interface ResearchItem {
  id: string;
  url: string;
  source: string;
  note: string;
}

export type AssetKind = "cover" | "raw-video" | "srt" | "final-video" | "other";

/** Links + notes only. Video files are never stored in localStorage. */
export interface AssetLink {
  id: string;
  kind: AssetKind;
  url: string;
  note: string;
}

export type PlatformKey = "x" | "douyin" | "xiaohongshu" | "tiktok" | "youtube";

export type PlatformPublishStatus = "not-ready" | "ready" | "published";

export interface PlatformPack {
  title: string;
  body: string;
  hashtags: string;
  coverUrl: string;
  /** YYYY-MM-DDTHH:mm local input value, or "" */
  scheduledTime: string;
  status: PlatformPublishStatus;
  /** ISO timestamp, or "" */
  publishedTime: string;
  publishedUrl: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  /** Original draft status at migration time, kept when the mapping is inexact. */
  legacyStatus?: string;
  priority: ProjectPriority;
  tags: string;
  audience: string;
  /** YYYY-MM-DD, or "" when unscheduled */
  plannedDate: string;
  research: ResearchItem[];
  scriptZh: string;
  scriptEn: string;
  assets: AssetLink[];
  platforms: Record<PlatformKey, PlatformPack>;
  views: number;
  likes: number;
  starred: boolean;
  archived: boolean;
  /** Draft id this project was migrated from, if any. Drives idempotent migration. */
  migratedFromDraftId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbenchData {
  ideas: Idea[];
  drafts: Draft[];
  accounts: Account[];
  skills: Skill[];
  projects: Project[];
  /** Draft ids already migrated into projects. Migration skips these on re-run. */
  migratedDraftIds: string[];
}
