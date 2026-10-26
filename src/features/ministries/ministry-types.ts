export type MinistryRecord = {
  id: string;
  code: string;
  label: string;
  active: boolean;
  leaderId: string | null;
  leaderName: string | null;
  memberCount: number;
};

export type MinistryListResponse = { items: MinistryRecord[]; permissions: { canEdit: boolean } };
