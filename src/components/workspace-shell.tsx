"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, PanelLeftClose, PanelLeftOpen, Upload, Users, WandSparkles, Music4 } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/services", label: "Services", icon: Users },
  { href: "/songs", label: "Songs", icon: Music4 },
  { href: "/assets", label: "Assets", icon: Upload },
  { href: "/automation", label: "Automation", icon: WandSparkles },
] as const;

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] text-[var(--color-text-primary)]">
      <div className="min-h-screen">
        <aside
          className={`fixed left-0 top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-4 transition-all lg:flex ${
            collapsed ? "w-[88px]" : "w-[272px]"
          }`}
        >
          <div className={`mb-6 flex ${collapsed ? "flex-col items-center gap-3" : "items-start justify-between gap-3"}`}>
            <div className={collapsed ? "text-center" : ""}>
              <p className="font-[var(--font-plex-mono)] text-xs uppercase tracking-[0.24em] text-[var(--color-brand-olive)]">
                WFO
              </p>
              {!collapsed ? <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">Worship Flow OS</h1> : null}
              {!collapsed ? (
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  Worship service preparation for the tech team.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-3 text-[var(--color-brand-accent)]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center rounded-lg border px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "border-[#000000] bg-[#000000] text-white"
                      : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-brand-border)] hover:bg-[var(--color-brand-panel-alt)]"
                  } ${collapsed ? "justify-center" : "gap-3"}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{label}</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] p-4">
            {!collapsed ? (
              <>
                <p className="text-sm font-semibold">Module navigation</p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  Each workflow now has its own page so the prep team can move faster with less clutter.
                </p>
              </>
            ) : (
              <div className="flex justify-center">
                <WandSparkles className="h-4 w-4 text-[var(--color-brand-accent)]" />
              </div>
            )}
          </div>
        </aside>

        <nav className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--color-brand-border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-black text-white" : "text-[var(--color-text-secondary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div
          className={`min-w-0 transition-[padding] ${
            collapsed ? "lg:pl-[88px]" : "lg:pl-[272px]"
          }`}
        >
          <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
