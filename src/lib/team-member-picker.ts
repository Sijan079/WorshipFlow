export type TeamMemberOption = { id: string; name: string };

export function filterTeamMembers(
  members: TeamMemberOption[],
  search: string,
  selectedIds: string[],
) {
  const query = search.trim().toLocaleLowerCase();
  const selected = new Set(selectedIds);
  return members.filter((member) => !selected.has(member.id) && member.name.toLocaleLowerCase().includes(query));
}

export function addTeamMember(personIds: string[], personId: string) {
  return personIds.includes(personId) ? personIds : [...personIds, personId];
}

export function removeTeamMember(personIds: string[], personId: string) {
  return personIds.filter((id) => id !== personId);
}

const DROPDOWN_ROW_HEIGHT = 40;
const DROPDOWN_MAX_ROWS = 5;
// List padding (8) + gap under the field (4) + breathing room above a dialog footer (16).
const DROPDOWN_EXTRA_SPACE = 28;

// How many pixels to reserve under the field so the open list, up to five rows, never sits
// flush against the bottom of a dialog's scroll area. Zero when there is already room.
export function dropdownReserve(spaceBelow: number, rowCount: number) {
  const rows = Math.min(DROPDOWN_MAX_ROWS, Math.max(1, rowCount));
  return Math.max(0, Math.ceil(rows * DROPDOWN_ROW_HEIGHT + DROPDOWN_EXTRA_SPACE - spaceBelow));
}
