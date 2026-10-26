export type MinistryRecord = {
  id: string;
  code: string;
  label: string;
  active: boolean;
  /** Offered only on services (such as Mixed); never something a person belongs to. */
  serviceOnly: boolean;
  leaderId: string | null;
  leaderName: string | null;
  memberCount: number;
};

export type MinistryListResponse = { items: MinistryRecord[]; permissions: { canEdit: boolean } };
