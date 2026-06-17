"use client";

import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default function LoginForm({ nextPath: rawNextPath }: { nextPath?: string }) {
  const router = useRouter();
  const nextPath = useMemo(() => getSafeNextPath(rawNextPath ?? null), [rawNextPath]);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, user }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not sign in.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitLogin} className="space-y-4 pt-5">
      <label className="block">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">User</span>
        <input
          value={user}
          onChange={(event) => setUser(event.target.value)}
          autoComplete="username"
          className="mt-2 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-focus)]"
          placeholder="Optional"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">Password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          type="password"
          required
          className="mt-2 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-panel-alt)] px-3 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-focus)]"
        />
      </label>

      {error ? (
        <p className="rounded-[var(--radius-control)] border border-[color-mix(in_oklab,var(--state-danger)_28%,transparent)] bg-[var(--state-danger-soft)] px-3 py-2 text-sm text-[var(--state-danger)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="pressable ui-btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in
      </button>
    </form>
  );
}
