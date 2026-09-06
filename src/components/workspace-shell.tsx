"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { apiFetch, createErrorNotification, fetchErrorNotifications, removeErrorNotification, type ErrorNotificationRecord } from "@/lib/api-client";
import { AnimatePresence, motion } from "motion/react";
import BrandLogo from "@/components/brand-logo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PAPToastViewport, usePAPToasts } from "@/features/pap/components/pap-toasts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AudioLines,
  AlertTriangle,
  Bell,
  CalendarDays,
  Captions,
  ChevronDown,
  CircleUserRound,
  ListMusic,
  LogOut,
  MessageSquare,
  Settings2,
  MonitorPlay,
  Users,
  X,
} from "lucide-react";

const SERVICE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: ListMusic },
  { href: "/services", label: "Services", shortLabel: "Services", icon: CalendarDays },
] as const;

const PRODUCTION_NAV_ITEMS = [
  { href: "/song-formatter/upload", label: "Formatter", shortLabel: "Formatter", icon: AudioLines },
  { href: "/media-tools", label: "Media Tools", shortLabel: "Media", icon: MonitorPlay },
  { href: "/automation", label: "Sermon Captions", shortLabel: "Captions", icon: Captions },
] as const;

const WORKSPACE_NAV_ITEMS = [
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings2 },
] as const;

const NAV_GROUPS = [
  { label: "Prepare", items: SERVICE_NAV_ITEMS },
  { label: "People", items: [{ href: "/teams", label: "Teams", shortLabel: "Teams", icon: Users }] as const },
  { label: "Tools", items: PRODUCTION_NAV_ITEMS },
  { label: "Workspace", items: WORKSPACE_NAV_ITEMS },
] as const;

const NAV_ITEMS = [...SERVICE_NAV_ITEMS, ...PRODUCTION_NAV_ITEMS, ...WORKSPACE_NAV_ITEMS];

const MEDIA_TOOL_NAV = [
  { href: "/media-tools/phone-transfer", label: "Phone Transfer" },
  { href: "/media-tools/qr-generator", label: "QR Generator" },
  { href: "/media-tools/background-generator", label: "Background Generator" },
  { href: "/media-tools/resize-image", label: "Resize Image" },
  { href: "/media-tools/background-removal", label: "Remove Background" },
] as const;

const IN_PROGRESS_WARNINGS = {
  "/automation": "Sermon Captions",
} as const;

type InProgressWarningKey = keyof typeof IN_PROGRESS_WARNINGS;
type SessionResponse = { authenticated: boolean; user: { email?: string | null; displayName?: string | null; avatarUrl?: string | null; role?: string | null } | null };
function isActivePath(pathname: string, href: string) {
  const [hrefPath] = href.split("#");

  if (href === "/song-formatter/upload") {
    return pathname === "/song-formatter/upload" || pathname === "/song-formatter/format";
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function getWarningKey(pathname: string, hash: string | null): InProgressWarningKey | null {
  if (hash === null) {
    return null;
  }

  if (pathname === "/services" && hash === "#team") {
    return null;
  }

  if (pathname === "/automation") {
    return pathname;
  }

  return null;
}

function formatWorkspaceRole(role?: string | null) {
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : "Member";
}

function toSafeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error && typeof error.message === "string" ? error.message : typeof error === "string" ? error : "Something went wrong.";
  return message.trim().slice(0, 500) || "Something went wrong.";
}

function toErrorDetails(error: unknown, message: string) {
  const context = typeof error === "object" && error ? error as { path?: unknown; status?: unknown; requestId?: unknown } : {};
  return [
    `What happened:\n${message}`,
    typeof context.status === "number" ? `HTTP status: ${context.status}` : null,
    typeof context.path === "string" ? `Endpoint: ${context.path}` : null,
    typeof context.requestId === "string" ? `Vercel request ID: ${context.requestId}` : null,
  ].filter(Boolean).join("\n\n");
}

function AccountMenu({ name, email, role, avatarUrl, onSignOut }: { name: string; email: string; role: string; avatarUrl?: string | null; onSignOut: () => void }) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="pressable inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-[var(--surface-panel)] hover:text-white"
          aria-label="Open account menu"
        >
          {avatarUrl && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} className="h-8 w-8 rounded-full object-cover" />
          ) : <CircleUserRound className="h-7 w-7" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border border-[var(--border-default)] bg-[var(--surface-panel-elevated)] p-2">
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{name}</span>
          {email ? <span className="mt-0.5 block truncate font-[var(--font-mono)] text-[10px] font-normal text-[var(--text-muted)]">{email}</span> : null}
          <span className="mt-1 block text-xs font-normal text-[var(--text-secondary)]">{role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="min-h-10 px-2 text-[var(--text-secondary)] focus:text-[var(--text-primary)]">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function WorkspaceShell({ children, workspaceSlug }: { children: React.ReactNode; workspaceSlug?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const workspaceBasePath = workspaceSlug ? `/w/${encodeURIComponent(workspaceSlug)}` : "";
  const localPathname = workspaceBasePath && pathname.startsWith(workspaceBasePath)
    ? pathname.slice(workspaceBasePath.length) || "/"
    : pathname;
  const toWorkspacePath = (href: string) => `${workspaceBasePath}${href}`;
  const shellNavItems = NAV_ITEMS;
  const [mediaToolsOpen, setMediaToolsOpen] = useState(() => localPathname === "/media-tools" || localPathname.startsWith("/media-tools/"));
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const warningKey = getWarningKey(localPathname, currentHash);
  const warningTitle = warningKey ? IN_PROGRESS_WARNINGS[warningKey] : null;
  const sessionQuery = useQuery({ queryKey: ["auth", "session", workspaceSlug], queryFn: () => apiFetch<SessionResponse>(`/api/auth/session${workspaceSlug ? `?workspaceSlug=${encodeURIComponent(workspaceSlug)}` : ""}`) });
  const errorNotificationsQuery = useQuery({ queryKey: ["error-notifications"], queryFn: fetchErrorNotifications });
  const accountName = sessionQuery.data?.user?.displayName || sessionQuery.data?.user?.email || "Workspace user";
  const accountEmail = sessionQuery.data?.user?.email || "";
  const accountRole = formatWorkspaceRole(sessionQuery.data?.user?.role);
  const accountAvatarUrl = sessionQuery.data?.user?.avatarUrl;
  const [dismissedWarningKey, setDismissedWarningKey] = useState<InProgressWarningKey | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<"ISSUE" | "FEEDBACK">("ISSUE");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [reportNotificationId, setReportNotificationId] = useState<string | null>(null);
  const reportNotificationIdRef = useRef<string | null>(null);
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const alertCount = errorNotificationsQuery.data?.length ?? 0;
  const showInProgressWarning = Boolean(warningTitle && dismissedWarningKey !== warningKey);
  const openReportWithError = useCallback((details: string, notificationId: string | null) => {
    setFeedbackKind("ISSUE");
    setFeedbackMessage(details);
    setReportNotificationId(notificationId);
    setFeedbackOpen(true);
  }, []);
  const showErrorReport = useCallback(async (error: unknown) => {
    const message = toSafeErrorMessage(error);
    const page = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const details = `${toErrorDetails(error, message)}\n\nPage: ${page}`;
    showToast(message, "error", {
      durationMs: null,
      action: { label: "Report issue", onClick: () => openReportWithError(details, reportNotificationIdRef.current) },
    });
    try {
      const notification = await createErrorNotification({ message, details, page });
      reportNotificationIdRef.current = notification.id;
      await queryClient.invalidateQueries({ queryKey: ["error-notifications"] });
    } catch {
      // The original error remains actionable in the toast even if persistence is temporarily unavailable.
    }
  }, [openReportWithError, queryClient, showToast]);
  const feedbackMutation = useMutation({
    mutationFn: (payload: { kind: "ISSUE" | "FEEDBACK"; message: string }) => apiFetch("/api/feedback", { method: "POST", body: JSON.stringify(payload) }),
    onMutate: () => showToast("Sending report…"),
    onSuccess: () => {
      if (reportNotificationId) void removeErrorNotification(reportNotificationId).then(() => queryClient.invalidateQueries({ queryKey: ["error-notifications"] })).catch(() => undefined);
      setReportNotificationId(null);
      reportNotificationIdRef.current = null;
      setFeedbackMessage("");
      setFeedbackOpen(false);
      showToast("Report sent to GitHub.", "success");
    },
    onError: () => undefined,
  });

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const showClientError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: unknown; path?: string; status?: number; requestId?: string }>).detail;
      if (detail?.path?.startsWith("/api/error-notifications")) return;
      void showErrorReport(detail);
    };
    const showUnhandledError = (event: ErrorEvent) => void showErrorReport(event.error ?? event.message);
    const showUnhandledRejection = (event: PromiseRejectionEvent) => void showErrorReport(event.reason);
    window.addEventListener("worshipflow:error", showClientError);
    window.addEventListener("error", showUnhandledError);
    window.addEventListener("unhandledrejection", showUnhandledRejection);
    const openNotificationReport = (event: Event) => {
      const notification = (event as CustomEvent<ErrorNotificationRecord>).detail;
      if (!notification) return;
      setFeedbackKind("ISSUE");
      setFeedbackMessage(notification.details);
      setReportNotificationId(notification.id);
      setFeedbackOpen(true);
    };
    window.addEventListener("worshipflow:report-error", openNotificationReport);
    return () => {
      window.removeEventListener("worshipflow:error", showClientError);
      window.removeEventListener("error", showUnhandledError);
      window.removeEventListener("unhandledrejection", showUnhandledRejection);
      window.removeEventListener("worshipflow:report-error", openNotificationReport);
    };
  }, [showErrorReport]);

  async function logout() {
    setSigningOut(true);
    await createSupabaseClient().auth.signOut().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="workspace-shell min-h-screen bg-white text-[var(--text-primary)] lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-[var(--action-primary-bg)] px-4 py-3 font-semibold text-[var(--action-primary-ink)] focus:not-sr-only"
      >
        Skip to workspace content
      </a>
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
      <aside className="workspace-nav-surface workspace-rail hidden overflow-x-hidden border-r border-[var(--border-default)] bg-[var(--surface-canvas)] px-3 py-4 lg:row-start-1 lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0 lg:self-start">
        <div className="mb-4 border-b border-[var(--border-default)] px-2 pb-4">
          <Link href={toWorkspacePath("/dashboard")} className="inline-flex min-h-11 items-center" aria-label="WorshipFlow dashboard">
            <BrandLogo className="h-9 w-[190px]" />
          </Link>
        </div>
        <div className="workspace-nav-account mb-4 flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-2 pb-4" aria-label="Account">
          <div className="flex min-w-0 items-center gap-2">
            <AccountMenu name={accountName} email={accountEmail} role={accountRole} avatarUrl={accountAvatarUrl} onSignOut={() => setSignOutConfirmOpen(true)} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{accountName}</p>
              <p className="mt-0.5 text-[10px] text-white/70">{accountRole}</p>
            </div>
          </div>
          <Link href={toWorkspacePath("/notifications")} className="pressable relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-[var(--surface-panel)] hover:text-white" aria-label={`Error notifications${alertCount > 0 ? `, ${alertCount} unresolved` : ""}`}>
            <Bell className="h-5 w-5" />
            {alertCount > 0 ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[var(--action-primary-bg)] px-1 text-center font-[var(--font-mono)] text-[9px] font-bold leading-4 text-[var(--action-primary-ink)]">{alertCount > 99 ? "99+" : alertCount}</span> : null}
          </Link>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden" aria-label="Production workspace">
          {NAV_GROUPS.map((group, groupIndex) => (
            <section
              key={group.label}
              aria-labelledby={`nav-group-${group.label.toLowerCase()}`}
              className={groupIndex === 0 ? "" : "mt-4"}
            >
              <p
                id={`nav-group-${group.label.toLowerCase()}`}
                className="workspace-nav-group-label ui-technical-label px-3 text-white/60"
              >
                {group.label}
              </p>
              <div className="mt-1.5 flex flex-col gap-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const resolvedHref = toWorkspacePath(href);
                  const active =
                    href === "/services"
                      ? localPathname === "/services" && currentHash !== "#team"
                      : isActivePath(localPathname, href);
                  const isMediaTools = href === "/media-tools";
                  const showMediaChildren = isMediaTools && mediaToolsOpen;

                  return (
                    <div
                      key={`${href}-${label}`}
                      className={isMediaTools ? "workspace-media-nav-item" : undefined}
                    >
                      <div
                        className={`group flex items-center border-l-2 transition-colors ${
                          active
                            ? "border-[var(--border-focus)] bg-[var(--surface-panel-strong)] text-white"
                            : "border-transparent text-white/80 hover:border-[var(--border-default)] hover:bg-[var(--surface-panel-alt)] hover:text-white"
                        }`}
                      >
                        <Link
                          href={resolvedHref}
                          className="workspace-nav-link pressable-subtle flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-sm font-semibold"
                          aria-current={active && !isMediaTools ? "page" : undefined}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center ${
                              active
                                ? "bg-[color-mix(in_oklab,var(--action-primary-bg)_22%,transparent)] text-white"
                                : "text-white/70 group-hover:text-white"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 truncate">{label}</span>
                        </Link>
                        {isMediaTools ? (
                          <button
                            type="button"
                            onClick={() => setMediaToolsOpen((current) => !current)}
                            className="workspace-media-toggle pressable-subtle mr-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-current hover:bg-[var(--surface-panel-elevated)]"
                            aria-label={mediaToolsOpen ? "Collapse media tools" : "Expand media tools"}
                            aria-expanded={mediaToolsOpen}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${mediaToolsOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        ) : active ? (
                          <span
                            className="mr-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-focus)]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>

                      <AnimatePresence initial={false}>
                        {showMediaChildren ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="workspace-media-children ml-6 mt-1 flex flex-col gap-1 overflow-hidden border-l border-[var(--border-default)] pl-3"
                          >
                            {MEDIA_TOOL_NAV.map((item) => {
                              const childActive = localPathname === item.href;
                              return (
                                <Link
                                  key={item.href}
                                  href={toWorkspacePath(item.href)}
                                  className={`pressable-subtle flex min-h-11 items-center rounded-md px-3 py-2 text-xs font-semibold ${
                                    childActive
                                      ? "bg-[var(--surface-panel-strong)] text-white"
                                      : "text-white/80 hover:bg-[var(--surface-panel)] hover:text-white"
                                  }`}
                                  aria-current={childActive ? "page" : undefined}
                                >
                                  {item.label}
                                </Link>
                              );
                            })}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="mt-4 border-t border-[var(--border-default)] pt-3">
          <button
            type="button"
            onClick={() => { setReportNotificationId(null); setFeedbackOpen(true); }}
            className="workspace-nav-link pressable-subtle flex min-h-11 w-full items-center gap-3 border-l-2 border-transparent px-2 py-1.5 text-sm font-semibold text-white/80 hover:border-[var(--border-default)] hover:bg-[var(--surface-panel-alt)] hover:text-white"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-white/70">
              <MessageSquare className="h-4 w-4" />
            </span>
            Report
          </button>
        </div>
      </aside>

      <div className="workspace-main min-w-0 lg:col-start-2 lg:row-start-1">
        <header className="workspace-nav-surface workspace-mobile-header bg-[var(--surface-canvas)] lg:hidden">
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={toWorkspacePath("/dashboard")}
                className="inline-flex min-h-11 items-center"
                aria-label="WorshipFlow dashboard"
              >
                <BrandLogo className="h-9 w-40" />
              </Link>
              <div className="flex items-center gap-2">
                <Link href={toWorkspacePath("/notifications")} className="pressable relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-[var(--surface-panel)] hover:text-white" aria-label={`Error notifications${alertCount > 0 ? `, ${alertCount} unresolved` : ""}`}>
                  <Bell className="h-5 w-5" />
                  {alertCount > 0 ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[var(--action-primary-bg)] px-1 text-center font-[var(--font-mono)] text-[9px] font-bold leading-4 text-[var(--action-primary-ink)]">{alertCount > 99 ? "99+" : alertCount}</span> : null}
                </Link>
                <AccountMenu name={accountName} email={accountEmail} role={accountRole} avatarUrl={accountAvatarUrl} onSignOut={() => setSignOutConfirmOpen(true)} />
              </div>
            </div>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto border-t border-[var(--border-default)] px-2 py-2"
            aria-label="Production workspace"
          >
            {shellNavItems.map(({ href, shortLabel, icon: Icon }) => {
                const active =
                  href === "/services"
                  ? localPathname === "/services" && currentHash !== "#team"
                  : isActivePath(localPathname, href);
              return (
                <Link
                  key={`${href}-${shortLabel}`}
                  href={toWorkspacePath(href)}
                  className={`pressable-subtle flex min-h-14 min-w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-md border px-3 py-2 text-[10px] font-semibold ${
                    active
                      ? "border-[color-mix(in_oklab,var(--border-focus)_38%,var(--border-default))] bg-[var(--surface-panel-strong)] text-[var(--text-accent)] shadow-[var(--elevation-subtle)]"
                      : "border-transparent text-white/80 hover:border-[var(--border-default)] hover:bg-[var(--surface-panel)] hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="max-w-full truncate">{shortLabel}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        {showInProgressWarning ? (
          <div className="workspace-content-light mx-auto max-w-[1540px] px-4 pt-4 lg:px-6" role="status">
            <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[color-mix(in_oklab,var(--state-danger)_28%,transparent)] bg-[var(--state-danger-soft)] p-4 text-[var(--text-danger)] shadow-[var(--elevation-subtle)]">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-danger)]">{warningTitle} is still in development</p>
                <p className="mt-1 text-sm text-[color-mix(in_oklab,var(--text-danger)_82%,var(--text-primary))]">Some actions may be unavailable or incomplete.</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedWarningKey(warningKey)}
                className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--text-danger)] hover:bg-[color-mix(in_oklab,var(--state-danger)_10%,transparent)]"
                aria-label="Dismiss development notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <main id="workspace-content" className="workspace-content workspace-content-light ui-stage-enter mx-auto min-h-screen max-w-[1540px] bg-[var(--surface-app)] px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>

      <Dialog open={signOutConfirmOpen} onOpenChange={(open) => !signingOut && setSignOutConfirmOpen(open)}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="flex items-start gap-4 px-5 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_srgb,var(--action-primary-bg)_16%,var(--surface-panel-alt))] text-[var(--text-accent)]">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Sign out?</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">
                You will return to the login screen.
              </DialogDescription>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-[var(--rule-default)] bg-[var(--surface-panel-strong)] px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(false)}
              disabled={signingOut}
              className="pressable min-h-11 rounded-md border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={signingOut}
              className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--action-primary-bg)] px-4 text-sm font-semibold text-[var(--action-primary-ink)] disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={(open) => !feedbackMutation.isPending && setFeedbackOpen(open)}>
        <DialogContent className="ui-modal max-w-md p-5">
          <DialogTitle className="text-xl font-semibold text-[var(--text-primary)]">Report issue or feedback</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Send this directly to the WorshipFlow team. No GitHub account is needed.</DialogDescription>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              feedbackMutation.mutate({ kind: feedbackKind, message: feedbackMessage });
            }}
          >
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              Type
              <select value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value as "ISSUE" | "FEEDBACK")} className="mt-1.5 h-11 w-full rounded-md border border-[var(--border-default)] px-3 text-sm">
                <option value="ISSUE">Report an issue</option>
                <option value="FEEDBACK">Share feedback</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              Message
              <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} rows={5} maxLength={5000} required className="mt-1.5 w-full resize-y rounded-md border border-[var(--border-default)] px-3 py-2 text-sm" placeholder="Tell us what happened or what would help." />
            </label>
            {feedbackMutation.error instanceof Error ? <p className="text-sm text-[var(--text-danger)]">{feedbackMutation.error.message}</p> : null}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setFeedbackOpen(false)} disabled={feedbackMutation.isPending} className="pressable h-10 rounded-md px-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-primary)]">Cancel</button>
              <button type="submit" disabled={feedbackMutation.isPending || !feedbackMessage.trim()} className="ui-btn-primary h-10 px-3 text-sm font-semibold disabled:opacity-40">{feedbackMutation.isPending ? "Sending…" : "Send"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
