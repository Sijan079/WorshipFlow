import type { MinistryRecord } from "./ministry-types.ts";

export const MINISTRY_SELECT = {
  id: true,
  code: true,
  label: true,
  active: true,
  serviceOnly: true,
  leaderId: true,
  leader: { select: { firstName: true, lastName: true } },
  _count: { select: { members: true } },
} as const;

type MinistryRow = {
  id: string;
  code: string;
  label: string;
  active: boolean;
  serviceOnly: boolean;
  leaderId: string | null;
  leader: { firstName: string; lastName: string } | null;
  _count: { members: number };
};

export function toMinistryRecord(row: MinistryRow): MinistryRecord {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    active: row.active,
    serviceOnly: row.serviceOnly,
    leaderId: row.leaderId,
    leaderName: row.leader ? `${row.leader.firstName} ${row.leader.lastName}` : null,
    memberCount: row._count.members,
  };
}
