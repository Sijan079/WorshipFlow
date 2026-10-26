"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { apiFetch, createErrorNotification, fetchErrorNotifications, removeErrorNotification, type ErrorNotificationRecord } from "@/lib/api-client";
import { AnimatePresence, motion } from "motion/react";
import BrandLogo from "@/components/brand-logo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { notificationDeleteScope, useErrorNotificationDeleteQueue } from "@/features/error-notifications/use-delete-queue";
import { ProductionSelect } from "@/components/ui/production-select";
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
  Bell,
  CalendarDays,
  CalendarRange,
  Captions,
  ChevronDown,
  CircleUserRound,
  ListMusic,
  LogOut,
  Menu,
  MessageSquare,
  Settings2,
  MonitorPlay,
  Palette,
  Users,
  X,
} from "lucide-react";
import { canViewDesignSystem } from "@/lib/design-system-access";
import { canShowModuleNavigation } from "@/lib/module-access";

const SERVICE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: ListMusic },
  { href: "/services", label: "Services", shortLabel: "Services", icon: CalendarDays },
  { href: "/events", label: "Events", shortLabel: "Events", icon: CalendarRange },
] as const;

const PRODUCTION_NAV_ITEMS = [
  { href: "/song-formatter/upload", label: "Formatter", shortLabel: "Formatter", icon: AudioLines },
  { href: "/media-tools", label: "Media Tools", shortLabel: "Media", icon: MonitorPlay },
  { href: "/captions", label: "Sermon Captions", shortLabel: "Captions", icon: Captions },
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

const MEDIA_TOOL_NAV = [
  { href: "/media-tools/phone-transfer", label: "Phone Transfer" },
  { href: "/media-tools/qr-generator", label: "QR Generator" },
  { href: "/media-tools/background-generator", label: "Background Generator" },
  { href: "/media-tools/comment-card", label: "Comment Card" },
  { href: "/media-tools/resize-image", label: "Resize Image" },
  { href: "/media-tools/background-removal", label: "Remove Background" },
] as const;

const DEV_NAV_PATHS = new Set(["/captions", "/media-tools/background-generator", "/media-tools/background-removal", "/media-tools/resize-image"]);

function NavDevPill() {
  return <span className="ml-auto shrink-0 rounded-full border border-[var(--rail-border-strong)] bg-[var(--rail-ghost-hover)] px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] font-bold leading-none tracking-[0.08em] text-[var(--rail-text-secondary)]" title="In development" aria-label="In development">DEV</span>;
}

const SETTINGS_NAV = [
  { id: "general", label: "Workspace" },
  { id: "membership", label: "Membership" },
  { id: "templates", label: "Templates" },
  { id: "tags", label: "Tags" },
  { id: "checklist", label: "Checklist" },
  { id: "integrations", label: "Integrations" },
  { id: "usage", label: "Usage" },
] as const;

function SettingsSubnav({ localPathname, workspaceBasePath, onNavigate, canViewUsage }: { localPathname: string; workspaceBasePath: string; onNavigate: () => void; canViewUsage: boolean }) {
  const searchParams = useSearchParams();

  return SETTINGS_NAV.filter((item) => item.id !== "usage" || canViewUsage).map((item) => {
    const selected = localPathname === "/settings" && (searchParams.get("tab") || "general") === item.id;
    const href = `${workspaceBasePath}${item.id === "general" ? "/settings" : `/settings?tab=${item.id}`}`;

    return <Link key={item.id} href={href} onClick={onNavigate} aria-current={selected ? "page" : undefined} className={`pressable-subtle flex min-h-11 items-center rounded-md px-3 py-2 text-xs font-semibold ${selected ? "bg-[var(--surface-panel-strong)] text-white" : "text-white/80 hover:bg-[var(--surface-panel)] hover:text-white"}`}>{item.label}</Link>;
  });
}

type SessionResponse = { authenticated: boolean; user: { id: string; email?: string | null; displayName?: string | null; avatarUrl?: string | null; role?: string | null; canViewEvents?: boolean; canViewCaptions?: boolean; canViewPeople?: boolean } | null };
function isActivePath(pathname: string, href: string) {
  const [hrefPath] = href.split("#");

  if (href === "/song-formatter/upload") {
    return pathname === "/song-formatter/upload" || pathname === "/song-formatter/format";
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
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

function AccountMenu({
  name,
  email,
  role,
  avatarUrl,
  designSystemHref,
  onSignOut,
}: {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  designSystemHref?: string;
  onSignOut: () => void;
}) {
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
        {designSystemHref ? (
          <DropdownMenuItem asChild className="min-h-10 px-2 text-[var(--text-secondary)] focus:text-[var(--text-primary)]">
            <Link href={designSystemHref}>
              <Palette className="h-4 w-4" />
              Design system
            </Link>
          </DropdownMenuItem>
        ) : null}
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
  const [navOpen, setNavOpen] = useState(false);
  const navRailRef = useRef<HTMLElement>(null);
  const navCloseRef = useRef<HTMLButtonElement>(null);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const [mediaToolsOpen, setMediaToolsOpen] = useState(() => localPathname === "/media-tools" || localPathname.startsWith("/media-tools/"));
  const [settingsOpen, setSettingsOpen] = useState(() => localPathname === "/settings");
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const sessionQuery = useQuery({ queryKey: ["auth", "session", workspaceSlug], queryFn: () => apiFetch<SessionResponse>(`/api/auth/session${workspaceSlug ? `?workspaceSlug=${encodeURIComponent(workspaceSlug)}` : ""}`) });
  const notificationScope = notificationDeleteScope(workspaceSlug, sessionQuery.data?.user?.id);
  const notificationDeleteQueue = useErrorNotificationDeleteQueue(notificationScope);
  const errorNotificationsQuery = useQuery({ queryKey: ["error-notifications"], queryFn: fetchErrorNotifications });
  const accountName = sessionQuery.data?.user?.displayName || sessionQuery.data?.user?.email || "Workspace user";
  const accountEmail = sessionQuery.data?.user?.email || "";
  const designSystemHref = workspaceSlug && canViewDesignSystem(accountEmail)
    ? toWorkspacePath("/design-system")
    : undefined;
  const accountRole = formatWorkspaceRole(sessionQuery.data?.user?.role);
  const accountAvatarUrl = sessionQuery.data?.user?.avatarUrl;
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<"ISSUE" | "FEEDBACK">("ISSUE");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [reportNotificationId, setReportNotificationId] = useState<string | null>(null);
  const reportNotificationIdRef = useRef<string | null>(null);
  const { dismissToast, showToast, toasts } = usePAPToasts();
  const pendingNotificationDeletes = new Set(notificationDeleteQueue.pendingIds);
  const alertCount = errorNotificationsQuery.data?.filter((item) => !pendingNotificationDeletes.has(item.id)).length ?? 0;
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
      if (reportNotificationId) {
        if (!notificationDeleteQueue.enqueue([reportNotificationId])) {
          void removeErrorNotification(reportNotificationId).then(() => queryClient.invalidateQueries({ queryKey: ["error-notifications"] })).catch(() => undefined);
        }
      }
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
    const frame = requestAnimationFrame(() => setNavOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;

    const desktop = window.matchMedia("(min-width: 1200px)");
    if (desktop.matches) {
      const frame = requestAnimationFrame(() => setNavOpen(false));
      return () => cancelAnimationFrame(frame);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    navCloseRef.current?.focus();

    const handleResize = () => setNavOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        navTriggerRef.current?.focus();
      }
      if (event.key !== "Tab" || !navRailRef.current) return;
      const focusable = Array.from(navRailRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("resize", handleResize);
    desktop.addEventListener("change", handleResize);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", handleResize);
      desktop.removeEventListener("change", handleResize);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [navOpen]);

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
    <div className="workspace-shell min-h-screen bg-white text-[var(--text-primary)] min-[1200px]:grid min-[1200px]:h-dvh min-[1200px]:min-h-0 min-[1200px]:grid-cols-[260px_minmax(0,1fr)] min-[1200px]:grid-rows-[minmax(0,1fr)] min-[1200px]:overflow-hidden">
      <a
        href="#workspace-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-[var(--action-primary-bg)] px-4 py-3 font-semibold text-[var(--action-primary-ink)] focus:not-sr-only"
      >
        Skip to workspace content
      </a>
      <PAPToastViewport dismissToast={dismissToast} toasts={toasts} />
      {navOpen ? <button type="button" className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--rail-surface-canvas)_70%,transparent)] min-[1200px]:hidden" aria-label="Close navigation" onClick={() => { setNavOpen(false); navTriggerRef.current?.focus(); }} /> : null}
      <aside id="workspace-navigation" ref={navRailRef} role={navOpen ? "dialog" : undefined} aria-label="Workspace navigation" aria-modal={navOpen ? true : undefined} className={`workspace-nav-surface workspace-rail fixed inset-y-0 left-0 z-50 w-[min(20rem,85vw)] overflow-x-hidden border-r border-[var(--border-default)] bg-[var(--surface-canvas)] px-3 py-4 shadow-[var(--elevation-modal)] min-[600px]:w-80 min-[1200px]:static min-[1200px]:row-start-1 min-[1200px]:flex min-[1200px]:h-full min-[1200px]:w-auto min-[1200px]:flex-col min-[1200px]:shadow-none ${navOpen ? "flex flex-col" : "hidden"}`}>
        <div className="mb-4 border-b border-[var(--border-default)] px-2 pb-4">
          <div className="mb-2 flex justify-end min-[1200px]:hidden">
            <button ref={navCloseRef} type="button" onClick={() => { setNavOpen(false); navTriggerRef.current?.focus(); }} className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-[var(--surface-panel)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] min-[1200px]:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button>
          </div>
          <Link href={toWorkspacePath("/dashboard")} onClick={() => setNavOpen(false)} className="inline-flex min-h-11 items-center" aria-label="WorshipFlow dashboard">
            <BrandLogo className="h-9 w-[190px]" />
          </Link>
        </div>
        <div className="workspace-nav-account mb-4 hidden items-center justify-between gap-3 border-b border-[var(--border-default)] px-2 pb-4 min-[1200px]:flex" aria-label="Account">
          <div className="flex min-w-0 items-center gap-2">
            <AccountMenu name={accountName} email={accountEmail} role={accountRole} avatarUrl={accountAvatarUrl} designSystemHref={designSystemHref} onSignOut={() => { setNavOpen(false); setSignOutConfirmOpen(true); }} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{accountName}</p>
              <p className="mt-0.5 text-[10px] text-white/70">{accountRole}</p>
            </div>
          </div>
          <Link href={toWorkspacePath("/notifications")} onClick={() => setNavOpen(false)} className="pressable relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-[var(--surface-panel)] hover:text-white" aria-label={`Error notifications${alertCount > 0 ? `, ${alertCount} unresolved` : ""}`}>
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
                {group.items.filter((item) => canShowModuleNavigation(item.href, sessionQuery.data?.user?.canViewEvents ?? false, sessionQuery.data?.user?.canViewCaptions ?? false, sessionQuery.data?.user?.canViewPeople ?? false)).map(({ href, label, icon: Icon }) => {
                  const resolvedHref = toWorkspacePath(href);
                  const active =
                    href === "/services"
                      ? localPathname === "/services" && currentHash !== "#team"
                      : isActivePath(localPathname, href);
                  const isMediaTools = href === "/media-tools";
                  const isSettings = href === "/settings";
                  const isDev = DEV_NAV_PATHS.has(href);
                  const showMediaChildren = isMediaTools && mediaToolsOpen;
                  const showSettingsChildren = isSettings && settingsOpen;

                  return (
                    <div
                      key={`${href}-${label}`}
                      className={isMediaTools || isSettings ? "workspace-media-nav-item" : undefined}
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
                          onClick={() => { setNavOpen(false); if (isSettings) setSettingsOpen(true); }}
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
                          {isDev ? <NavDevPill /> : null}
                        </Link>
                        {isMediaTools || isSettings ? (
                          <button
                            type="button"
                            onClick={() => isMediaTools ? setMediaToolsOpen((current) => !current) : setSettingsOpen((current) => !current)}
                            className={`workspace-media-toggle pressable-subtle mr-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-current hover:bg-[var(--surface-panel-elevated)] ${isSettings ? "min-[1200px]:hidden" : ""}`}
                            aria-label={isMediaTools ? (mediaToolsOpen ? "Collapse media tools" : "Expand media tools") : (settingsOpen ? "Collapse settings" : "Expand settings")}
                            aria-expanded={isMediaTools ? mediaToolsOpen : settingsOpen}
                          >
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${(isMediaTools ? mediaToolsOpen : settingsOpen) ? "rotate-180" : ""}`}
                            />
                          </button>
                        ) : active && !isDev ? (
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
                              const childDev = DEV_NAV_PATHS.has(item.href);
                              return (
                                <Link
                                  key={item.href}
                                  href={toWorkspacePath(item.href)}
                                  onClick={() => setNavOpen(false)}
                                  className={`pressable-subtle flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                                    childActive
                                      ? "bg-[var(--surface-panel-strong)] text-white"
                                      : "text-white/80 hover:bg-[var(--surface-panel)] hover:text-white"
                                  }`}
                                  aria-current={childActive ? "page" : undefined}
                                >
                                  <span className="min-w-0 truncate">{item.label}</span>
                                  {childDev ? <NavDevPill /> : null}
                                </Link>
                              );
                            })}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <AnimatePresence initial={false}>
                        {showSettingsChildren ? (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="workspace-media-children ml-6 mt-1 flex flex-col gap-1 overflow-hidden border-l border-[var(--border-default)] pl-3 min-[1200px]:hidden">
                            <Suspense fallback={null}>
                              <SettingsSubnav localPathname={localPathname} workspaceBasePath={workspaceBasePath} canViewUsage={sessionQuery.data?.user?.role === "OWNER" || sessionQuery.data?.user?.role === "ADMIN"} onNavigate={() => setNavOpen(false)} />
                            </Suspense>
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
            onClick={() => { setNavOpen(false); setReportNotificationId(null); setFeedbackOpen(true); }}
            className="workspace-nav-link pressable-subtle flex min-h-11 w-full items-center gap-3 border-l-2 border-transparent px-2 py-1.5 text-sm font-semibold text-white/80 hover:border-[var(--border-default)] hover:bg-[var(--surface-panel-alt)] hover:text-white"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-white/70">
              <MessageSquare className="h-4 w-4" />
            </span>
            Report
          </button>
        </div>
      </aside>

      <div className="workspace-main min-w-0 min-[1200px]:col-start-2 min-[1200px]:row-start-1 min-[1200px]:h-dvh min-[1200px]:min-h-0 min-[1200px]:overflow-y-auto">
        <header className="workspace-nav-surface workspace-mobile-header bg-[var(--surface-canvas)] min-[1200px]:hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2.5">
            <button ref={navTriggerRef} type="button" onClick={() => setNavOpen(true)} className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-[var(--surface-panel)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={navOpen}><Menu className="h-6 w-6" /></button>
            <div className="flex items-center gap-2">
              <Link href={toWorkspacePath("/notifications")} className="pressable relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-[var(--surface-panel)] hover:text-white" aria-label={`Error notifications${alertCount > 0 ? `, ${alertCount} unresolved` : ""}`}>
                <Bell className="h-5 w-5" />
                {alertCount > 0 ? <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[var(--action-primary-bg)] px-1 text-center font-[var(--font-mono)] text-[9px] font-bold leading-4 text-[var(--action-primary-ink)]">{alertCount > 99 ? "99+" : alertCount}</span> : null}
              </Link>
              <AccountMenu name={accountName} email={accountEmail} role={accountRole} avatarUrl={accountAvatarUrl} designSystemHref={designSystemHref} onSignOut={() => setSignOutConfirmOpen(true)} />
            </div>
          </div>
        </header>

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
              className="ui-btn-cancel pressable min-h-11 px-4 text-sm font-semibold disabled:opacity-50"
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
            <ProductionSelect label="Type" value={feedbackKind} onValueChange={setFeedbackKind} options={[{ value: "ISSUE", label: "Report an issue" }, { value: "FEEDBACK", label: "Share feedback" }]} labelClassName="mb-1.5 block text-sm font-semibold text-[var(--text-primary)]" triggerClassName="h-11" />
            <label className="block text-sm font-semibold text-[var(--text-primary)]">
              Message
              <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} rows={5} maxLength={5000} required className="mt-1.5 w-full resize-y rounded-md border border-[var(--border-default)] px-3 py-2 text-sm" placeholder="Tell us what happened or what would help." />
            </label>
            {feedbackMutation.error instanceof Error ? <p className="text-sm text-[var(--text-danger)]">{feedbackMutation.error.message}</p> : null}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setFeedbackOpen(false)} disabled={feedbackMutation.isPending} className="ui-btn-cancel pressable h-10 px-3 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={feedbackMutation.isPending || !feedbackMessage.trim()} className="ui-btn-primary h-10 px-3 text-sm font-semibold disabled:opacity-40">{feedbackMutation.isPending ? "Sending…" : "Send"}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
