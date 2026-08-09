"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { Ban, ChevronsRight, CircleUserRound, MailPlus, Pencil, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, type WorkspaceIntegrationRecord, type WorkspaceSettingsRecord } from "@/lib/api-client";
import { canManageMember, type WorkspaceRole } from "@/lib/workspace-auth";

function workspaceApiPath(path: string) {
  const slug = window.location.pathname.match(/^\/w\/([^/]+)/)?.[1];
  return slug ? `/api/workspaces/${encodeURIComponent(slug)}${path}` : path;
}

export function WorkspaceSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "workspace"], queryFn: () => apiFetch<WorkspaceSettingsRecord>("/api/settings/workspace") });
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: () => apiFetch<WorkspaceSettingsRecord>("/api/settings/workspace", { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: (record) => { setName(record.name); setEditingName(false); void queryClient.invalidateQueries({ queryKey: ["settings", "workspace"] }); },
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<WorkspaceSettingsRecord>("/api/settings/workspace/logo", { method: "POST", body: formData });
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "workspace"] }); },
  });
  if (query.isLoading) return <p className="text-sm text-[var(--text-secondary)]">Loading workspace…</p>;
  if (query.error) return <p role="alert" className="text-sm text-[var(--text-danger)]">Could not load workspace settings.</p>;
  const value = name || query.data?.name || "";
  const hasLogo = Boolean(query.data?.logoDataUrl);
  return <section className="space-y-3">
    <div>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">Workspace Identity</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Set the name and visual identity your team sees across the workspace.</p>
    </div>
    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
    <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-strong)] text-lg font-semibold text-[var(--text-accent)]">
          {query.data?.logoDataUrl ? <Image src={query.data.logoDataUrl} alt="" fill unoptimized className="object-cover" /> : value.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="ui-technical-label">Workspace identity</p>
          {editingName ? <input autoFocus aria-label="Workspace name" value={value} onChange={(event) => setName(event.target.value)} className="mt-1 h-9 w-full max-w-md border-0 border-b border-[var(--border-focus)] bg-transparent px-0 text-lg font-semibold text-[var(--text-primary)] outline-none" /> : <h2 className="mt-1 truncate text-lg font-semibold text-[var(--text-primary)]">{value}</h2>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {editingName ? value !== query.data?.name ? <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !value.trim()} className="ui-btn-primary h-10 px-3 text-sm font-semibold">{mutation.isPending ? "Saving…" : "Save"}</button> : null : <button type="button" onClick={() => setEditingName(true)} className="ui-btn-secondary pressable inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold" aria-label="Edit workspace name"><Pencil className="h-4 w-4" />Edit name</button>}
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); event.target.value = ""; }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} className="ui-btn-secondary pressable inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold disabled:opacity-60" aria-label="Upload workspace image"><Upload className="h-4 w-4" />{uploadMutation.isPending ? "Uploading…" : hasLogo ? "Change image" : "Upload image"}</button>
      </div>
    </div>
    {mutation.isError || uploadMutation.isError ? <p role="alert" className="px-5 pb-5 text-sm text-[var(--text-danger)] sm:px-6">Could not save workspace identity.</p> : null}
    </div>
  </section>;
}

type MemberRecord = { id: string; role: "OWNER" | "ADMIN" | "MEMBER"; status: "ACTIVE" | "SUSPENDED"; user: { id: string; email: string; displayName: string | null } };
type InvitationRecord = { id: string; email: string; role: "OWNER" | "ADMIN" | "MEMBER"; status: string; expiresAt: string };
type MembersResponse = { members: MemberRecord[]; viewerRole: WorkspaceRole };
type ConfirmationTarget =
  | { kind: "invitation"; id: string; email: string }
  | { kind: "member"; userId: string; email: string };
const MEMBERSHIP_PAGE_SIZE = 5;

export function MembershipSection() {
  const queryClient = useQueryClient();
  const members = useQuery({ queryKey: ["settings", "members"], queryFn: () => apiFetch<MembersResponse>(workspaceApiPath("/members")) });
  const invitations = useQuery({ queryKey: ["settings", "invitations"], enabled: members.data?.viewerRole !== "MEMBER", queryFn: () => apiFetch<InvitationRecord[]>(workspaceApiPath("/members/invitations")) });
  const [email, setEmail] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [roleDialogMember, setRoleDialogMember] = useState<MemberRecord | null>(null);
  const [roleDialogValue, setRoleDialogValue] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [confirmationTarget, setConfirmationTarget] = useState<ConfirmationTarget | null>(null);
  const [invitationPageIndex, setInvitationPageIndex] = useState(0);
  const [memberPageIndex, setMemberPageIndex] = useState(0);
  const invite = useMutation({ mutationFn: () => apiFetch(workspaceApiPath("/members/invitations"), { method: "POST", body: JSON.stringify({ email, role: "MEMBER" }) }), onSuccess: () => { setEmail(""); setInviteDialogOpen(false); void queryClient.invalidateQueries({ queryKey: ["settings", "invitations"] }); } });
  const updateMember = useMutation({ mutationFn: ({ userId, data }: { userId: string; data: { role?: "ADMIN" | "MEMBER"; status?: "ACTIVE" | "SUSPENDED" } }) => apiFetch(workspaceApiPath(`/members/${userId}`), { method: "PATCH", body: JSON.stringify(data) }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "members"] }); } });
  const removeMember = useMutation({ mutationFn: (userId: string) => apiFetch(workspaceApiPath(`/members/${userId}`), { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "members"] }); } });
  const revokeInvitation = useMutation({ mutationFn: (invitationId: string) => apiFetch(workspaceApiPath(`/members/invitations/${invitationId}`), { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "invitations"] }); } });
  const viewerRole = members.data?.viewerRole;
  const canManage = viewerRole === "OWNER" || viewerRole === "ADMIN";
  const ownerMembers = (members.data?.members ?? []).filter((member) => member.role === "OWNER");
  const otherMembers = (members.data?.members ?? []).filter((member) => member.role !== "OWNER");
  const pendingInvitations = invitations.data?.filter((item) => item.status === "PENDING") ?? [];
  const invitationPageCount = Math.max(1, Math.ceil(pendingInvitations.length / MEMBERSHIP_PAGE_SIZE));
  const memberPageCount = Math.max(1, Math.ceil(otherMembers.length / MEMBERSHIP_PAGE_SIZE));
  const invitationPage = Math.min(invitationPageIndex, invitationPageCount - 1);
  const memberPage = Math.min(memberPageIndex, memberPageCount - 1);
  const confirmationPending = confirmationTarget?.kind === "invitation" ? revokeInvitation.isPending : removeMember.isPending;
  const confirmDestructiveAction = () => {
    if (!confirmationTarget) return;
    if (confirmationTarget.kind === "invitation") {
      revokeInvitation.mutate(confirmationTarget.id, { onSuccess: () => setConfirmationTarget(null) });
      return;
    }
    removeMember.mutate(confirmationTarget.userId, { onSuccess: () => setConfirmationTarget(null) });
  };
  return (
    <section className="space-y-10">
      <div className="space-y-10">
        {members.isLoading ? (
          <div className="overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
            <p className="px-5 py-6 text-sm text-[var(--text-secondary)] sm:px-6">Loading members…</p>
          </div>
        ) : members.error ? (
          <div role="alert" className="border-y border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--text-danger)]">Could not load members.</div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-[var(--text-primary)]">Invitations</h4>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Invite people who need access to this workspace.</p>
                </div>
                {canManage ? (
                  <button type="button" onClick={() => setInviteDialogOpen(true)} className="pressable inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold text-[var(--text-accent)] hover:text-[var(--text-primary)]" aria-label="Invite a member">
                    <MailPlus className="h-4 w-4" aria-hidden="true" />
                    Invite member
                  </button>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
                <div className="min-w-0 divide-y divide-[var(--border-default)]">
                  {invitations.isLoading ? <p className="px-4 py-6 text-sm text-[var(--text-secondary)] sm:px-6">Loading invitations…</p> : null}
                  {!invitations.isLoading && pendingInvitations.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)] sm:px-6">No pending invitations.</p> : null}
                  {pendingInvitations.slice(invitationPage * MEMBERSHIP_PAGE_SIZE, (invitationPage + 1) * MEMBERSHIP_PAGE_SIZE).map((item) => (
                    <div key={item.id} className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] sm:px-6 sm:py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <CircleUserRound className="h-8 w-8 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        <p className="min-w-0 truncate text-[var(--text-primary)]">{item.email}</p>
                      </div>
                      <button type="button" onClick={() => setConfirmationTarget({ kind: "invitation", id: item.id, email: item.email })} disabled={revokeInvitation.isPending} className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)] disabled:opacity-40" aria-label={`Revoke invitation for ${item.email}`} title="Revoke invitation">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {invitationPageCount > 1 ? (
                    <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm sm:px-6">
                      {Array.from({ length: invitationPageCount }, (_, pageNumber) => (
                        <button key={pageNumber} type="button" onClick={() => setInvitationPageIndex(pageNumber)} className={`pressable inline-flex h-9 min-w-9 items-center justify-center px-1 ${pageNumber === invitationPage ? "border-b border-current text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`} aria-current={pageNumber === invitationPage ? "page" : undefined} aria-label={`Invitations page ${pageNumber + 1}`}>{pageNumber + 1}</button>
                      ))}
                      <button type="button" onClick={() => setInvitationPageIndex((page) => Math.min(invitationPageCount - 1, page + 1))} disabled={invitationPage === invitationPageCount - 1} className="pressable inline-flex h-9 w-9 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40" aria-label="Next invitations page">
                        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h4 className="text-base font-semibold text-[var(--text-primary)]">Current members</h4>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">People who help prepare and run worship services, including the workspace owner.</p>
              </div>
              <div className="overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--surface-panel)] shadow-[var(--elevation-subtle)]">
                <div className="border-b border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-3 sm:px-6">
                  <p className="technical-label">Owner</p>
                </div>
                <div className="min-w-0 divide-y divide-[var(--border-default)]">
                  {ownerMembers.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)] sm:px-6">No owner found.</p> : ownerMembers.map((member) => (
                    <div key={member.id} className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-[var(--surface-panel-alt)] sm:px-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <CircleUserRound className="h-9 w-9 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{member.user.displayName || member.user.email}</p>
                          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{member.user.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-y border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 py-3 sm:px-6">
                  <p className="technical-label">Members</p>
                </div>
                <div className="min-w-0 divide-y divide-[var(--border-default)]">
                  {otherMembers.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)] sm:px-6">No members yet. Use the invite action above.</p> : otherMembers.slice(memberPage * MEMBERSHIP_PAGE_SIZE, (memberPage + 1) * MEMBERSHIP_PAGE_SIZE).map((member) => {
                  const editable = viewerRole ? canManageMember(viewerRole, member.role) : false;
                  return (
                    <div key={member.id} className={`flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2 transition-colors sm:px-6 ${member.status === "SUSPENDED" ? "bg-[var(--surface-panel-alt)] opacity-60" : "hover:bg-[var(--surface-panel-alt)]"}`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <CircleUserRound className="h-9 w-9 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{member.user.displayName || member.user.email}</p>
                          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{member.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        {member.role === "ADMIN" ? <span className="mr-1 font-mono text-xs text-[var(--text-muted)]">ADMIN</span> : null}
                        <button type="button" disabled={!editable || updateMember.isPending} onClick={() => { setRoleDialogMember(member); setRoleDialogValue(member.role === "ADMIN" ? "ADMIN" : "MEMBER"); }} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)] disabled:opacity-40" aria-label={`Reassign role for ${member.user.email}`} title="Reassign role">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button type="button" disabled={!editable || updateMember.isPending} onClick={() => updateMember.mutate({ userId: member.user.id, data: { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } })} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)] disabled:opacity-40" aria-label={`${member.status === "ACTIVE" ? "Suspend" : "Reactivate"} ${member.user.email}`} title={member.status === "ACTIVE" ? "Suspend" : "Reactivate"}>
                          {member.status === "ACTIVE" ? <Ban className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                        </button>
                        <button type="button" disabled={!editable || removeMember.isPending} onClick={() => setConfirmationTarget({ kind: "member", userId: member.user.id, email: member.user.email })} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--text-danger)] hover:bg-[var(--state-danger-soft)] disabled:opacity-40" aria-label={`Remove ${member.user.email}`} title="Remove member">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                  {memberPageCount > 1 ? (
                    <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm sm:px-6">
                      {Array.from({ length: memberPageCount }, (_, pageNumber) => (
                        <button key={pageNumber} type="button" onClick={() => setMemberPageIndex(pageNumber)} className={`pressable inline-flex h-9 min-w-9 items-center justify-center px-1 ${pageNumber === memberPage ? "border-b border-current text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`} aria-current={pageNumber === memberPage ? "page" : undefined} aria-label={`Members page ${pageNumber + 1}`}>{pageNumber + 1}</button>
                      ))}
                      <button type="button" onClick={() => setMemberPageIndex((page) => Math.min(memberPageCount - 1, page + 1))} disabled={memberPage === memberPageCount - 1} className="pressable inline-flex h-9 w-9 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40" aria-label="Next members page">
                        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        )}

        {invite.isError || updateMember.isError || removeMember.isError || revokeInvitation.isError ? (
          <p role="alert" className="border-y border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-4 py-3 text-sm text-[var(--text-danger)]">Could not save membership changes.</p>
        ) : null}
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={(open) => { if (!invite.isPending) setInviteDialogOpen(open); }}>
        <DialogContent className="ui-modal max-w-md p-5">
          <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Invite a member</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Send an invitation link to an existing email account.</DialogDescription>
          <form onSubmit={(event) => { event.preventDefault(); invite.mutate(); }} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Email address
              <input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" className="mt-2 h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)]" />
            </label>
            {invite.isError ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not send invitation.</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInviteDialogOpen(false)} disabled={invite.isPending} className="pressable h-10 rounded-md px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)]">Cancel</button>
              <button type="submit" disabled={invite.isPending || !email.trim()} className="ui-btn-primary h-10 px-3 text-sm font-semibold disabled:opacity-40">{invite.isPending ? "Sending…" : "Send invitation"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(roleDialogMember)} onOpenChange={(open) => { if (!open && !updateMember.isPending) setRoleDialogMember(null); }}>
        <DialogContent className="ui-modal max-w-md p-5">
          <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Reassign role</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Choose the workspace role for {roleDialogMember?.user.email}.</DialogDescription>
          <form onSubmit={(event) => { event.preventDefault(); if (roleDialogMember) updateMember.mutate({ userId: roleDialogMember.user.id, data: { role: roleDialogValue } }, { onSuccess: () => setRoleDialogMember(null) }); }} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Role
              <Select value={roleDialogValue} onValueChange={(value) => setRoleDialogValue(value as "ADMIN" | "MEMBER")}>
                <SelectTrigger aria-label="New workspace role" className="mt-2 h-11 w-full border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel-strong)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="workspace-content-light border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-1.5 text-[var(--text-primary)] shadow-[var(--elevation-raised)]">
                  <SelectItem value="ADMIN" className="px-2 py-2 pr-8 font-medium data-[highlighted]:bg-[color-mix(in_oklab,var(--action-primary-bg)_14%,var(--surface-panel))] data-[highlighted]:text-[var(--text-primary)] focus:bg-[color-mix(in_oklab,var(--action-primary-bg)_14%,var(--surface-panel))] focus:text-[var(--text-primary)] focus:**:text-[var(--text-primary)]">Admin</SelectItem>
                  <SelectItem value="MEMBER" className="px-2 py-2 pr-8 font-medium data-[highlighted]:bg-[color-mix(in_oklab,var(--action-primary-bg)_14%,var(--surface-panel))] data-[highlighted]:text-[var(--text-primary)] focus:bg-[color-mix(in_oklab,var(--action-primary-bg)_14%,var(--surface-panel))] focus:text-[var(--text-primary)] focus:**:text-[var(--text-primary)]">Member</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRoleDialogMember(null)} disabled={updateMember.isPending} className="pressable h-10 rounded-md px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)]">Cancel</button>
              <button type="submit" disabled={updateMember.isPending || !roleDialogMember} className="ui-btn-primary h-10 px-3 text-sm font-semibold disabled:opacity-40">{updateMember.isPending ? "Saving…" : "Save role"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmationTarget)} onOpenChange={(open) => { if (!open && !confirmationPending) setConfirmationTarget(null); }}>
        <DialogContent className="ui-modal max-w-md p-5">
          <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">{confirmationTarget?.kind === "invitation" ? "Revoke invitation?" : "Remove member?"}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {confirmationTarget?.kind === "invitation"
              ? <>This will cancel the invitation for <span className="font-medium text-[var(--text-primary)]">{confirmationTarget.email}</span>.</>
              : <>This will remove <span className="font-medium text-[var(--text-primary)]">{confirmationTarget?.email}</span> from this workspace. They will need a new invitation to return.</>}
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmationTarget(null)} disabled={confirmationPending} className="pressable h-10 rounded-md px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)]">Cancel</button>
            <button type="button" onClick={confirmDestructiveAction} disabled={confirmationPending || !confirmationTarget} className="pressable h-10 rounded-md border border-[var(--state-danger)] bg-[var(--state-danger-soft)] px-3 text-sm font-semibold text-[var(--text-danger)] hover:opacity-90 disabled:opacity-40" aria-label="Confirm action">{confirmationPending ? "Saving…" : confirmationTarget?.kind === "invitation" ? "Revoke invitation" : "Remove member"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function IntegrationsSection() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "integrations"], queryFn: () => apiFetch<WorkspaceIntegrationRecord[]>("/api/settings/integrations") });
  const [provider, setProvider] = useState<"OPENAI" | "GEMINI">("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const mutation = useMutation({ mutationFn: () => apiFetch(`/api/settings/integrations`, { method: "PUT", body: JSON.stringify({ provider, apiKey: apiKey || undefined, enabled }) }), onSuccess: () => { setApiKey(""); void queryClient.invalidateQueries({ queryKey: ["settings", "integrations"] }); } });
  if (query.isLoading) return <p className="text-sm text-[var(--text-secondary)]">Loading integrations…</p>;
  const current = query.data?.find((item) => item.provider === provider);
  return <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4"><div className="border-b border-[var(--border-default)] pb-3"><h2 className="text-base font-semibold text-[var(--text-primary)]">AI integrations</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Keys are stored server-side and are never displayed after saving.</p></div><div className="grid gap-3 pt-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto]"><select value={provider} onChange={(event) => setProvider(event.target.value as "OPENAI" | "GEMINI")} className="h-11 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)]"><option value="OPENAI">OpenAI</option><option value="GEMINI">Gemini</option></select><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={current?.apiKeyConfigured ? "Key configured — enter replacement" : "API key"} className="h-11 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)]" /><button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || (!apiKey && !current)} className="ui-btn-primary h-11 px-3 text-sm font-semibold">{mutation.isPending ? "Saving…" : "Save"}</button></div><label className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>{mutation.isError ? <p role="alert" className="mt-3 text-sm text-[var(--text-danger)]">Could not save integration settings.</p> : null}</section>;
}
