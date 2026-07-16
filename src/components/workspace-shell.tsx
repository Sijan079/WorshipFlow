"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AudioLines,
  AlertTriangle,
  CalendarDays,
  Captions,
  ChevronDown,
  ListMusic,
  LogOut,
  Settings2,
  Sparkles,
  MonitorPlay,
  Users,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: ListMusic },
  { href: "/services", label: "Services", shortLabel: "Services", icon: CalendarDays },
  { href: "/teams", label: "Teams", shortLabel: "Teams", icon: Users },
  { href: "/songs/upload", label: "Formatter", shortLabel: "Formatter", icon: AudioLines },
  { href: "/media-tools", label: "Media Tools", shortLabel: "Media", icon: MonitorPlay },
  { href: "/automation", label: "Sermon Captions", shortLabel: "Captions", icon: Captions },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings2 },
] as const;

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
  const showInProgressWarning = Boolean(warningTitle && dismissedWarningKey !== warningKey);
  const activeMobileNavRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    activeMobileNavRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  async function logout() {
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
      <aside className="hidden min-h-screen border-r border-[var(--border-default)] bg-[var(--surface-canvas)] px-4 py-4 lg:flex lg:flex-col">
        <div className="ui-stage-enter mb-10 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--action-primary-bg)] text-[var(--action-primary-ink)] shadow-[var(--elevation-subtle)]">
              {formatterMode ? <Sparkles className="h-5 w-5" /> : <ListMusic className="h-5 w-5" />}
          </div>
          <div>
            <Link href="/dashboard" className="inline-flex min-h-11 items-center text-xl font-bold leading-none text-[var(--text-accent)]">
              Worship Production OS
            </Link>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {formatterMode ? "Song Formatter" : "Production Hub"}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Production workspace">
          {shellNavItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/services"
                ? pathname === "/services" && currentHash !== "#team"
                : isActivePath(pathname, href);
            const isMediaTools = href === "/media-tools";
            const showMediaChildren = isMediaTools && mediaToolsOpen;
            return (
              <div key={`${href}-${label}`}>
                <div
                  className={`flex items-center rounded-lg border-l-4 transition-colors ${
                    active
                      ? "border-l-[var(--border-focus)] bg-[var(--surface-panel-strong)] text-[var(--text-accent)]"
                      : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Link
                    href={href}
                    className="pressable-subtle flex min-h-11 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-semibold"
                    aria-current={active && !isMediaTools ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{label}</span>
                  </Link>
                  {isMediaTools ? (
                    <button
                      type="button"
                      onClick={() => setMediaToolsOpen((current) => !current)}
                      className="pressable-subtle mr-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-current hover:bg-[var(--surface-panel)]"
                      aria-label={mediaToolsOpen ? "Collapse media tools" : "Expand media tools"}
                      aria-expanded={mediaToolsOpen}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${mediaToolsOpen ? "rotate-180" : ""}`} />
                    </button>
                  ) : null}
                </div>

                <AnimatePresence initial={false}>
                {showMediaChildren ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="ml-7 mt-1 flex flex-col gap-1 overflow-hidden border-l border-[var(--border-default)] pl-3"
                  >
                    {MEDIA_TOOL_NAV.map((item) => {
                      const childActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`pressable-subtle rounded-md px-3 py-2 text-xs font-semibold ${
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
        </nav>

        <div className="mt-auto border-t border-[var(--border-default)] pt-4">
          <div className="ui-stage-enter ui-surface-panel p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--action-primary-bg)] font-bold text-[var(--action-primary-ink)]">
                {formatterMode ? "AU" : "CH"}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatterMode ? "Admin User" : "Central Church"}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[var(--state-danger)]">
                  {formatterMode ? null : <span className="status-pip status-pip-live" />}
                  {formatterMode ? "Production Mode" : "Live Booth"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="pressable-subtle mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border-default)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-panel-strong)] hover:text-[var(--text-primary)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--border-default)] bg-[var(--surface-panel-alt)] lg:hidden">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="text-sm font-semibold text-[var(--text-primary)]">
                Worship Production OS
              </Link>
              <button
                type="button"
                onClick={logout}
                className="pressable inline-flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-secondary)]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative border-t border-[var(--border-default)] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-10 after:bg-gradient-to-l after:from-[var(--surface-panel-alt)] after:to-transparent">
          <nav className="flex gap-2 overflow-x-auto px-3 py-2 pr-10" aria-label="Production workspace">
            {shellNavItems.map(({ href, shortLabel, icon: Icon }) => {
              const active =
                href === "/services"
                  ? pathname === "/services" && currentHash !== "#team"
                  : isActivePath(pathname, href);
              return (
                <Link
                  key={`${href}-${shortLabel}`}
                  href={href}
                  ref={active ? activeMobileNavRef : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                    active
                      ? "border-[var(--border-focus)] bg-[var(--surface-panel-strong)] text-[var(--text-primary)] shadow-[var(--elevation-subtle)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {shortLabel}
                </Link>
              );
            })}
          </nav>
          </div>
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
    </div>
  );
}
