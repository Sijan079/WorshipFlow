"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines,
  AlertTriangle,
  CalendarDays,
  Captions,
  ChevronDown,
  ListMusic,
  LogOut,
  Sparkles,
  MonitorPlay,
  Users,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/planner", label: "Dashboard", shortLabel: "Dashboard", icon: ListMusic },
  { href: "/services", label: "Services", shortLabel: "Services", icon: CalendarDays },
  { href: "/songs/upload", label: "Formatter", shortLabel: "Formatter", icon: AudioLines },
  { href: "/assets", label: "Media Tools", shortLabel: "Media", icon: MonitorPlay },
  { href: "/automation", label: "Sermon Captions", shortLabel: "Captions", icon: Captions },
  { href: "/services#team", label: "Team", shortLabel: "Team", icon: Users },
] as const;

const MEDIA_TOOL_NAV = [
  { href: "/assets/phone-transfer", label: "Phone Transfer" },
  { href: "/assets/qr-generator", label: "QR Generator" },
] as const;

const IN_PROGRESS_WARNINGS = {
  "/planner": "Dashboard",
  "/services": "Services",
  "/automation": "Sermon Captions",
  "/services#team": "Team",
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
    return "/services#team";
  }

  if (pathname === "/planner" || pathname === "/services" || pathname === "/automation") {
    return pathname;
  }

  return null;
}

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const formatterMode = pathname === "/songs/upload" || pathname === "/songs/format";
  const shellNavItems = NAV_ITEMS;
  const [mediaToolsOpen, setMediaToolsOpen] = useState(() => pathname === "/assets" || pathname.startsWith("/assets/"));
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const warningKey = getWarningKey(pathname, currentHash);
  const warningTitle = warningKey ? IN_PROGRESS_WARNINGS[warningKey] : null;
  const [dismissedWarningKey, setDismissedWarningKey] = useState<InProgressWarningKey | null>(null);
  const showInProgressWarning = Boolean(warningTitle && dismissedWarningKey !== warningKey);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-text-primary)] lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen border-r border-[var(--color-brand-border)] bg-[#060e20] px-4 py-4 lg:flex lg:flex-col">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-accent-ink)]">
              {formatterMode ? <Sparkles className="h-5 w-5" /> : <ListMusic className="h-5 w-5" />}
          </div>
          <div>
            <Link href="/planner" className="block text-2xl font-bold leading-none text-[var(--color-focus)]">
              Tech Suite
            </Link>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {formatterMode ? "Song Formatter" : "Production Hub"}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Production workspace">
          {shellNavItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/services#team"
                ? pathname === "/services" && currentHash === "#team"
                : href === "/services"
                  ? pathname === "/services" && currentHash !== null && currentHash !== "#team"
                  : isActivePath(pathname, href);
            const isMediaTools = href === "/assets";
            const showMediaChildren = isMediaTools && mediaToolsOpen;
            return (
              <div key={`${href}-${label}`}>
                <div
                  className={`flex items-center rounded-lg border-l-4 ${
                    active
                      ? "border-l-[var(--color-focus)] bg-[var(--color-brand-panel-strong)] text-[var(--color-focus)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel)] hover:text-[var(--color-brand-ink)]"
                  }`}
                >
                  <Link
                    href={href}
                    className="pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-semibold"
                    aria-current={active && !isMediaTools ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{label}</span>
                  </Link>
                  {isMediaTools ? (
                    <button
                      type="button"
                      onClick={() => setMediaToolsOpen((current) => !current)}
                      className="pressable mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-current hover:bg-[var(--color-brand-panel)]"
                      aria-label={mediaToolsOpen ? "Collapse media tools" : "Expand media tools"}
                      aria-expanded={mediaToolsOpen}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${mediaToolsOpen ? "rotate-180" : ""}`} />
                    </button>
                  ) : null}
                </div>

                {showMediaChildren ? (
                  <div className="ml-7 mt-1 flex flex-col gap-1 border-l border-[var(--color-brand-border)] pl-3">
                    {MEDIA_TOOL_NAV.map((item) => {
                      const childActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`pressable rounded-md px-3 py-2 text-xs font-semibold ${
                            childActive
                              ? "bg-[var(--color-brand-panel-strong)] text-[var(--color-focus)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel)] hover:text-[var(--color-brand-ink)]"
                          }`}
                          aria-current={childActive ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--color-brand-border)] pt-4">
          <div className="rounded-xl bg-[var(--color-brand-panel)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-accent)] font-bold text-[var(--color-accent-ink)]">
                {formatterMode ? "AU" : "CH"}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-brand-ink)]">
                  {formatterMode ? "Admin User" : "Central Church"}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[var(--color-danger)]">
                  {formatterMode ? null : <span className="status-pip status-pip-live" />}
                  {formatterMode ? "Production Mode" : "Live Booth"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="pressable mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-brand-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel-strong)] hover:text-[var(--color-brand-ink)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] lg:hidden">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/planner" className="text-sm font-semibold text-[var(--color-brand-ink)]">
                Worship Production OS
              </Link>
              <button
                type="button"
                onClick={logout}
                className="pressable inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-brand-border)] text-[var(--color-text-secondary)]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-[var(--color-brand-border)] px-3 py-2" aria-label="Production workspace">
            {shellNavItems.map(({ href, shortLabel, icon: Icon }) => {
              const active =
                href === "/services#team"
                  ? pathname === "/services" && currentHash === "#team"
                  : href === "/services"
                    ? pathname === "/services" && currentHash !== null && currentHash !== "#team"
                    : isActivePath(pathname, href);
              return (
                <Link
                  key={`${href}-${shortLabel}`}
                  href={href}
                  className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                    active
                      ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-panel-strong)] text-[var(--color-brand-ink)] shadow-[0_4px_12px_color-mix(in_oklab,var(--color-brand-accent)_10%,transparent)]"
                      : "border-[var(--color-brand-border)] text-[var(--color-text-secondary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {shortLabel}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto min-h-screen max-w-[1540px] px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>

      {showInProgressWarning ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-20" role="alertdialog" aria-modal="true" aria-labelledby="in-progress-warning-title">
          <div className="w-full max-w-md rounded-lg border border-[var(--color-rule-strong)] bg-[var(--color-brand-panel-strong)] p-4 shadow-[0_12px_32px_color-mix(in_oklab,black_36%,transparent)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="in-progress-warning-title" className="text-base font-semibold text-[var(--color-brand-ink)]">
                  {warningTitle} is in progress
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  This part of the site is not fully working or has not been developed yet, so do not expect that you can use it already.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedWarningKey(warningKey)}
                className="pressable inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-panel)] hover:text-[var(--color-brand-ink)]"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDismissedWarningKey(warningKey)}
                className="pressable rounded-md bg-[var(--color-brand-accent)] px-3 py-2 text-sm font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-brand-accent-hover)]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
