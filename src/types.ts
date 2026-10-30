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

export interface WorkbenchData {
  ideas: Idea[];
  drafts: Draft[];
  accounts: Account[];
  skills: Skill[];
}
