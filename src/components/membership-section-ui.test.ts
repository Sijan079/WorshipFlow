import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function runMembershipSectionUiTests() {
  const source = readFileSync(
    join(process.cwd(), "src", "components", "settings-admin-sections.tsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /Manage who can access this workspace/);
  assert.match(source, /<h4 className="text-base font-semibold text-\[var\(--text-primary\)\]">Invitations<\/h4>[\s\S]*overflow-hidden rounded-md border border-\[var\(--border-default\)\] bg-\[var\(--surface-panel\)\] shadow-\[var\(--elevation-subtle\)\]/);
  assert.match(source, /<h4 className="text-base font-semibold text-\[var\(--text-primary\)\]">Current members<\/h4>[\s\S]*overflow-hidden rounded-md border border-\[var\(--border-default\)\] bg-\[var\(--surface-panel\)\] shadow-\[var\(--elevation-subtle\)\][\s\S]*technical-label">Owner/);
  assert.match(source, /CircleUserRound/);
  assert.match(source, /const MEMBERSHIP_PAGE_SIZE = 5;/);
  assert.match(source, /pendingInvitations\.slice\(invitationPage \* MEMBERSHIP_PAGE_SIZE, \(invitationPage \+ 1\) \* MEMBERSHIP_PAGE_SIZE\)/);
  assert.match(source, /otherMembers\.slice\(memberPage \* MEMBERSHIP_PAGE_SIZE, \(memberPage \+ 1\) \* MEMBERSHIP_PAGE_SIZE\)/);
  assert.match(source, /ChevronsRight/);
  assert.match(source, /aria-current=\{pageNumber === invitationPage \? "page" : undefined\}/);
  assert.match(source, /aria-label="Next invitations page"/);
  assert.match(source, /aria-label="Next members page"/);
  assert.match(source, /justify-end gap-2 px-4 py-3/);
  assert.doesNotMatch(source, />Previous<\/button>/);
  assert.doesNotMatch(source, />Page \{invitationPage \+ 1\} of \{invitationPageCount\}<\/span>/);
  assert.doesNotMatch(source, /\{item\.role\}/);
  assert.doesNotMatch(source, /<span className="technical-label">Owner<\/span>/);
  assert.doesNotMatch(source, /technical-label mr-1/);
  assert.match(source, /aria-label={`Revoke invitation for \$\{item\.email\}`}/);
  assert.match(source, /aria-label={`Reassign role for \$\{member\.user\.email\}`}/);
  assert.match(source, /aria-label={`\$\{member\.status === "ACTIVE"/);
  assert.match(source, /otherMembers\.slice\([\s\S]*member\.status === "SUSPENDED" \? "bg-\[var\(--surface-panel-alt\)\] opacity-60"/);
  assert.match(source, />ADMIN<\/span>/);
  assert.match(source, /from "@\/components\/ui\/select"/);
  assert.match(source, /<Select value=\{roleDialogValue\} onValueChange=\{\(value\) => setRoleDialogValue\(value as "ADMIN" \| "MEMBER"\)\}>/);
  assert.match(source, /<SelectItem value="ADMIN"[^>]*>Admin<\/SelectItem>/);
  assert.match(source, /<SelectItem value="MEMBER"[^>]*>Member<\/SelectItem>/);
  assert.match(source, /<SelectContent position="popper" align="start" className="workspace-content-light border/);
  assert.match(source, /data-\[highlighted\]:bg-\[color-mix\(in_oklab,var\(--action-primary-bg\)_14%,var\(--surface-panel\)\)\]/);
  assert.match(source, /data-\[highlighted\]:text-\[var\(--text-primary\)\]/);
  assert.match(source, /focus:\*\*:text-\[var\(--text-primary\)\]/);
  assert.doesNotMatch(source, /<select aria-label="New workspace role"/);
  assert.match(source, /updateMember\.isPending \? "Saving…" : "Save role"/);
  assert.doesNotMatch(source, /Savingâ€¦/);
  assert.match(source, /Ban/);
  assert.match(source, /RotateCcw/);
  assert.match(source, /aria-label={`Remove \$\{member\.user\.email\}`}/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /confirmationTarget/);
  assert.match(source, /Revoke invitation\?/);
  assert.match(source, /Remove member\?/);
  assert.match(source, /Confirm action/);
  assert.match(source, /roleDialogMember/);
  assert.match(source, /Reassign role/);
  assert.doesNotMatch(source, /<select aria-label={`Role for \$\{member\.user\.email\}`}/);
}
