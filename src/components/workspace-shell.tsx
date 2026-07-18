"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import BrandLogo from "@/components/brand-logo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AudioLines,
  AlertTriangle,
  CalendarDays,
  Captions,
  ChevronDown,
  ListMusic,
  LogOut,
  Settings2,
  MonitorPlay,
  Users,
  X,
} from "lucide-react";

const SERVICE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: ListMusic },
  { href: "/services", label: "Services", shortLabel: "Services", icon: CalendarDays },
  { href: "/teams", label: "Teams", shortLabel: "Teams", icon: Users },
] as const;

const PRODUCTION_NAV_ITEMS = [
  { href: "/songs/upload", label: "Formatter", shortLabel: "Formatter", icon: AudioLines },
  { href: "/media-tools", label: "Media Tools", shortLabel: "Media", icon: MonitorPlay },
  { href: "/automation", label: "Sermon Captions", shortLabel: "Captions", icon: Captions },
] as const;

const WORKSPACE_NAV_ITEMS = [
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings2 },
] as const;

const NAV_GROUPS = [
  { label: "Service", items: SERVICE_NAV_ITEMS },
  { label: "Production", items: PRODUCTION_NAV_ITEMS },
  { label: "Workspace", items: WORKSPACE_NAV_ITEMS },
] as const;

const NAV_ITEMS = [...SERVICE_NAV_ITEMS, ...PRODUCTION_NAV_ITEMS, ...WORKSPACE_NAV_ITEMS];

const MEDIA_TOOL_NAV = [
  { href: "/media-tools/phone-transfer", label: "Phone Transfer" },
  { href: "/media-tools/qr-generator", label: "QR Generator" },
  { href: "/media-tools/background-generator", label: "Background Generator" },
  { href: "/media-tools/resize-image", label: "Resize Image" },
] as const;

const IN_PROGRESS_WARNINGS = {
  "/dashboard": "Dashboard",
  "/automation": "Sermon Captions",
} as const;

type InProgressWarningKey = keyof typeof IN_PROGRESS_WARNINGS;

function isActivePath(pathname: string, href: string) {
  const [hrefPath] = href.split("#");

  if (href === "/songs/upload") {
    return pathname === "/songs" || pathname === "/songs/upload" || pathname === "/songs/format";
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

  if (pathname === "/dashboard" || pathname === "/automation") {
    return pathname;
  }

  return null;
}

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const formatterMode = pathname === "/songs/upload" || pathname === "/songs/format";
  const shellNavItems = NAV_ITEMS;
  const [mediaToolsOpen, setMediaToolsOpen] = useState(() => pathname === "/media-tools" || pathname.startsWith("/media-tools/"));
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const warningKey = getWarningKey(pathname, currentHash);
  const warningTitle = warningKey ? IN_PROGRESS_WARNINGS[warningKey] : null;
  const [dismissedWarningKey, setDismissedWarningKey] = useState<InProgressWarningKey | null>(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const showInProgressWarning = Boolean(warningTitle && dismissedWarningKey !== warningKey);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  async function logout() {
    setSigningOut(true);
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--surface-app)] text-[var(--text-primary)] lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-[var(--action-primary-bg)] px-4 py-3 font-semibold text-[var(--action-primary-ink)] focus:not-sr-only"
      >
        Skip to workspace content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] border-r border-[var(--border-default)] bg-[var(--surface-canvas)] px-4 py-4 lg:flex lg:flex-col">
        <div className="ui-stage-enter mb-4 border-b border-[var(--border-default)] px-2 pb-4">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center"
              aria-label="WorshipFlow dashboard"
            >
              <BrandLogo className="h-11 w-[216px]" />
            </Link>
            <p className="ui-technical-label mt-2 text-[var(--text-secondary)]">
              {formatterMode ? "Song formatter workspace" : "Production workspace"}
            </p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Production workspace">
          {NAV_GROUPS.map((group, groupIndex) => (
            <section
              key={group.label}
              aria-labelledby={`nav-group-${group.label.toLowerCase()}`}
              className={groupIndex === 0 ? "" : "mt-4"}
            >
              <p
                id={`nav-group-${group.label.toLowerCase()}`}
                className="ui-technical-label px-3 text-[var(--text-muted)]"
              >
                {group.label}
              </p>
              <div className="mt-1.5 flex flex-col gap-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === "/services"
                      ? pathname === "/services" && currentHash !== "#team"
                      : isActivePath(pathname, href);
                  const isMediaTools = href === "/media-tools";
                  const showMediaChildren = isMediaTools && mediaToolsOpen;

                  return (
                    <div key={`${href}-${label}`}>
                      <div
                        className={`group flex items-center rounded-lg border transition-colors ${
                          active
                            ? "border-[color-mix(in_oklab,var(--border-focus)_38%,var(--border-default))] bg-[var(--surface-panel-strong)] text-[var(--text-primary)] shadow-[var(--elevation-subtle)]"
                            : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Link
                          href={href}
                          className="pressable-subtle flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-sm font-semibold"
                          aria-current={active && !isMediaTools ? "page" : undefined}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                              active
                                ? "bg-[color-mix(in_oklab,var(--action-primary-bg)_22%,transparent)] text-[var(--text-accent)]"
                                : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
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
                            className="pressable-subtle mr-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-current hover:bg-[var(--surface-panel-elevated)]"
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
                            className="ml-6 mt-1 flex flex-col gap-1 overflow-hidden border-l border-[var(--border-default)] pl-3"
                          >
                            {MEDIA_TOOL_NAV.map((item) => {
                              const childActive = pathname === item.href;
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={`pressable-subtle flex min-h-11 items-center rounded-md px-3 py-2 text-xs font-semibold ${
                                    childActive
                                      ? "bg-[var(--surface-panel-strong)] text-[var(--text-accent)]"
                                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
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

        <div className="mt-auto border-t border-[var(--border-default)] pt-4">
          <button
            type="button"
            onClick={() => setSignOutConfirmOpen(true)}
            className="pressable-subtle inline-flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="border-b border-[var(--border-default)] bg-[var(--surface-canvas)] lg:hidden">
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center"
                aria-label="WorshipFlow dashboard"
              >
                <BrandLogo className="h-9 w-40" />
              </Link>
              <button
                type="button"
                onClick={() => setSignOutConfirmOpen(true)}
                className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav
            className="grid grid-cols-3 gap-1 border-t border-[var(--border-default)] px-2 py-2"
            aria-label="Production workspace"
          >
            {shellNavItems.map(({ href, shortLabel, icon: Icon }) => {
              const active =
                href === "/services"
                  ? pathname === "/services" && currentHash !== "#team"
                  : isActivePath(pathname, href);
              return (
                <Link
                  key={`${href}-${shortLabel}`}
                  href={href}
                  className={`pressable-subtle flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-[10px] font-semibold last:col-start-2 ${
                    active
                      ? "border-[color-mix(in_oklab,var(--border-focus)_38%,var(--border-default))] bg-[var(--surface-panel-strong)] text-[var(--text-accent)] shadow-[var(--elevation-subtle)]"
                      : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--surface-panel)]"
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
          <div className="mx-auto max-w-[1540px] px-4 pt-4 lg:px-6" role="status">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel-strong)] p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--state-warning-soft)] text-[var(--text-warning)]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{warningTitle} is still in development</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Some actions may be unavailable or incomplete.</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedWarningKey(warningKey)}
                className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
                aria-label="Dismiss development notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <main id="workspace-content" className="ui-stage-enter mx-auto min-h-screen max-w-[1540px] px-4 py-5 lg:px-6 lg:py-6">{children}</main>
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
    </div>
  );
}
