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
