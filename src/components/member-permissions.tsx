"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { CONFIGURABLE_MODULE_ACTIONS, resolveModuleAction } from "@/lib/module-access";

type Member = { role: "OWNER" | "ADMIN" | "MEMBER"; user: { id: string; email: string; displayName: string | null } };
type PermissionRow = { module: string; action: string };
type OverrideRow = PermissionRow & { userId: string; allowed: boolean };
type PermissionsResponse = { defaults: PermissionRow[]; overrides: OverrideRow[] };
type Change = { userId?: string; module: string; action: string; enabled: boolean };

function permissionsPath() {
  const slug = window.location.pathname.match(/^\/w\/([^/]+)/)?.[1];
  return `/api/workspaces/${encodeURIComponent(slug || "")}/members/permissions`;
}

export function MemberPermissions({ members }: { members: Member[] }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const memberAccounts = members.filter((member) => member.role === "MEMBER");
  const currentId = memberAccounts.some((member) => member.user.id === selectedId) ? selectedId : (memberAccounts[0]?.user.id ?? "");
  const permissions = useQuery({ queryKey: ["settings", "member-permissions"], queryFn: () => apiFetch<PermissionsResponse>(permissionsPath()) });
  const save = useMutation({
    mutationFn: (change: Change) => apiFetch(permissionsPath(), { method: "PUT", body: JSON.stringify(change) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings", "member-permissions"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return <section className="space-y-4">
    <div>
      <h4 className="text-base font-semibold text-[var(--text-primary)]">Module access</h4>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Admins have full access. Set the Member defaults, then adjust individual Members. Only available actions appear here.</p>
    </div>
    {permissions.isLoading ? <p className="text-sm text-[var(--text-muted)]">Loading permissions…</p> : null}
    {permissions.isError ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not load permissions.</p> : null}
    {permissions.data ? <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)]">
      <div className="border-b border-[var(--border-default)] px-4 py-4 sm:px-6">
        <h5 className="text-sm font-semibold text-[var(--text-primary)]">Member defaults</h5>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Applies to existing and new Members unless a personal setting overrides it.</p>
      </div>
      {CONFIGURABLE_MODULE_ACTIONS.map((entry) => <div key={entry.module} className="border-b border-[var(--border-default)] px-4 py-4 last:border-b-0 sm:px-6">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.label}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          {entry.actions.map(({ action, label }) => {
            const enabled = permissions.data!.defaults.some((item) => item.module === entry.module && item.action === action);
            return <label key={action} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={enabled} disabled={save.isPending} onChange={(event) => save.mutate({ module: entry.module, action, enabled: event.target.checked })} className="h-4 w-4 accent-[var(--action-primary-bg)]" />
              {label}
            </label>;
          })}
        </div>
      </div>)}
      <div className="border-t border-[var(--border-default)] px-4 py-4 sm:px-6">
        <h5 className="text-sm font-semibold text-[var(--text-primary)]">Individual access</h5>
        {memberAccounts.length ? <>
          <label htmlFor="member-permission-person" className="mt-3 block text-xs font-medium text-[var(--text-secondary)]">Member</label>
          <select id="member-permission-person" value={currentId} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 h-11 w-full max-w-sm rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 text-sm text-[var(--text-primary)]">
            {memberAccounts.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.displayName || member.user.email}</option>)}
          </select>
          {CONFIGURABLE_MODULE_ACTIONS.map((entry) => <div key={entry.module} className="mt-5">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.label}</p>
            <div className="mt-2 divide-y divide-[var(--border-default)]">
              {entry.actions.map(({ action, label }) => {
                const defaultEnabled = permissions.data!.defaults.some((item) => item.module === entry.module && item.action === action);
                const override = permissions.data!.overrides.find((item) => item.userId === currentId && item.module === entry.module && item.action === action);
                const enabled = resolveModuleAction("MEMBER", defaultEnabled, override?.allowed ?? null);
                return <div key={action} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm text-[var(--text-secondary)]">{label} <span className="text-xs text-[var(--text-muted)]">({override ? "custom" : "default"})</span></span>
                  <div className="flex items-center gap-3">
                    {override ? <button type="button" disabled={save.isPending} onClick={() => save.mutate({ userId: currentId, module: entry.module, action, enabled: defaultEnabled })} className="min-h-10 text-xs font-medium text-[var(--text-accent)] hover:underline disabled:opacity-50">Use default</button> : null}
                    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-primary)]">
                      <input type="checkbox" aria-label={`${label} for ${memberAccounts.find((member) => member.user.id === currentId)?.user.email}`} checked={enabled} disabled={save.isPending} onChange={(event) => save.mutate({ userId: currentId, module: entry.module, action, enabled: event.target.checked })} className="h-4 w-4 accent-[var(--action-primary-bg)]" />
                      {enabled ? "Allowed" : "Blocked"}
                    </label>
                  </div>
                </div>;
              })}
            </div>
          </div>)}
        </> : <p className="mt-2 text-sm text-[var(--text-muted)]">Invite a Member to set individual access.</p>}
      </div>
    </div> : null}
    {save.isError ? <p role="alert" className="text-sm text-[var(--text-danger)]">Could not save permission. Try again.</p> : null}
  </section>;
}
