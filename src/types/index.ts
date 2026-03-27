export interface Clip {
  id: number;
  workspace_id: string;
  name: string;
  fullname: string;
  path: string;
  category: string;
  type: string;
  sub_type: string | null;
  style: string | null;
  ratio: string;
  width: number;
  height: number;
  duration: number;
  size_mb: number;
  graded: boolean;
  drive_file_id: string | null;
  drive_url: string | null;
  thumbnail_url: string | null;
  proxy_url: string | null;
  approved: boolean;
  rejected: boolean;
  archived: boolean;
  hook_eligible: boolean;
  trim_in: number | null;
  trim_out: number | null;
  curation_note: string | null;
  tags: string[];
  star_rating: number | null;
  colour_grade: ColourGrade | null;
  updated_by: string | null;
  updated_at: string | null;
  created_at: string;
}

export interface ColourGrade {
  brightness: number;
  contrast: number;
  saturate: number;
  temperature: number;
  shadows: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  invited_by: string | null;
  joined_at: string;
}

export type ClipType = 'hook' | 'body' | 'cta' | 'product' | 'social_proof' | 'transition';
export type SubType = 'food-action' | 'food-beauty' | 'lifestyle' | 'product' | 'stop-motion';
export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'duration' | 'size_mb' | 'category' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  search: string;
  category: string;
  type: string;
  subType: string;
  approved: 'all' | 'approved' | 'rejected' | 'pending';
  ratio: string;
}