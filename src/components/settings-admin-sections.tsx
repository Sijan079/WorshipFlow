"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { Pencil, Upload } from "lucide-react";
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

export function MembershipSection() {
  const queryClient = useQueryClient();
  const members = useQuery({ queryKey: ["settings", "members"], queryFn: () => apiFetch<MembersResponse>(workspaceApiPath("/members")) });
  const invitations = useQuery({ queryKey: ["settings", "invitations"], enabled: members.data?.viewerRole !== "MEMBER", queryFn: () => apiFetch<InvitationRecord[]>(workspaceApiPath("/members/invitations")) });
  const [email, setEmail] = useState("");
  const invite = useMutation({ mutationFn: () => apiFetch(workspaceApiPath("/members/invitations"), { method: "POST", body: JSON.stringify({ email, role: "MEMBER" }) }), onSuccess: () => { setEmail(""); void queryClient.invalidateQueries({ queryKey: ["settings", "invitations"] }); } });
  const updateMember = useMutation({ mutationFn: ({ userId, data }: { userId: string; data: { role?: "ADMIN" | "MEMBER"; status?: "ACTIVE" | "SUSPENDED" } }) => apiFetch(workspaceApiPath(`/members/${userId}`), { method: "PATCH", body: JSON.stringify(data) }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "members"] }); } });
  const removeMember = useMutation({ mutationFn: (userId: string) => apiFetch(workspaceApiPath(`/members/${userId}`), { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "members"] }); } });
  const revokeInvitation = useMutation({ mutationFn: (invitationId: string) => apiFetch(workspaceApiPath(`/members/invitations/${invitationId}`), { method: "DELETE" }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["settings", "invitations"] }); } });
  const viewerRole = members.data?.viewerRole;
  const canManage = viewerRole === "OWNER" || viewerRole === "ADMIN";
  return <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4"><div className="border-b border-[var(--border-default)] pb-3"><h2 className="text-base font-semibold text-[var(--text-primary)]">Membership</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Manage who can access this workspace. Teams remains for service assignments.</p></div><div className="space-y-4 pt-4">{canManage ? <div className="flex flex-wrap gap-2"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" className="h-11 min-w-64 flex-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)]" /><button type="button" onClick={() => invite.mutate()} disabled={invite.isPending || !email.trim()} className="ui-btn-primary h-11 px-3 text-sm font-semibold">{invite.isPending ? "Sending…" : "Invite member"}</button></div> : null}{members.isLoading ? <p className="text-sm text-[var(--text-secondary)]">Loading members…</p> : members.error ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not load members.</p> : <div className="divide-y divide-[var(--border-default)]">{(members.data?.members ?? []).map((member) => { const editable = viewerRole ? canManageMember(viewerRole, member.role) : false; const owner = member.role === "OWNER"; return <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="text-[var(--text-primary)]">{member.user.displayName || member.user.email}</p><p className="text-xs text-[var(--text-muted)]">{member.user.email}</p></div><div className="flex items-center gap-2">{owner ? <span className="font-mono text-xs text-[var(--text-muted)]">OWNER</span> : <select aria-label={`Role for ${member.user.email}`} value={member.role} disabled={!editable || updateMember.isPending} onChange={(event) => updateMember.mutate({ userId: member.user.id, data: { role: event.target.value as "ADMIN" | "MEMBER" } })} className="h-9 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-2 text-xs text-[var(--text-primary)]"><option value="ADMIN">ADMIN</option><option value="MEMBER">MEMBER</option></select>}{!owner ? <><button type="button" disabled={!editable || updateMember.isPending} onClick={() => updateMember.mutate({ userId: member.user.id, data: { status: member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } })} className="ui-btn-secondary h-9 px-2 text-xs">{member.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button><button type="button" disabled={!editable || removeMember.isPending} onClick={() => { if (window.confirm(`Remove ${member.user.email} from this workspace?`)) removeMember.mutate(member.user.id); }} className="ui-btn-secondary h-9 px-2 text-xs text-[var(--text-danger)]">Remove</button></> : null}</div></div>; })}</div>}{canManage && invitations.data?.length ? <div><p className="technical-label">INVITATIONS</p><div className="mt-2 divide-y divide-[var(--border-default)]">{invitations.data.filter((item) => item.status === "PENDING").map((item) => <div key={item.id} className="flex justify-between gap-3 py-2 text-sm text-[var(--text-secondary)]"><span>{item.email}<span className="ml-2 font-mono text-xs">{item.role}</span></span><button type="button" onClick={() => revokeInvitation.mutate(item.id)} disabled={revokeInvitation.isPending} className="ui-btn-secondary h-8 px-2 text-xs">Revoke</button></div>)}</div></div> : null}{invite.isError || updateMember.isError || removeMember.isError || revokeInvitation.isError ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not save membership changes.</p> : null}</div></section>;
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
