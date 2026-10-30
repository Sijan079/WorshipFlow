import type { SITE_LIMITS } from "../blocks/block-validation";

export type PageStatus = "DRAFT" | "PUBLISHED";

export type PageListItem = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  isPublic: boolean;
  sortOrder: number;
  blockCount: number;
  updatedAt: string;
};

export type PageListResponse = {
  items: PageListItem[];
  limits: typeof SITE_LIMITS;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
};

export type PageDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  showTitle: boolean;
  status: PageStatus;
  isPublic: boolean;
  sortOrder: number;
  updatedAt: string;
  blocks: Array<{ id: string; type: string; content: unknown }>;
  sentBackToDraft?: boolean;
};
