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
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">User</span>
        <input
          value={user}
          onChange={(event) => setUser(event.target.value)}
          autoComplete="username"
          className="mt-2 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-3 text-sm outline-none focus:border-[var(--color-focus)]"
          placeholder="Optional"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">Password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          type="password"
          required
          className="mt-2 w-full rounded-md border border-[var(--color-brand-border)] bg-[var(--color-brand-panel-alt)] px-3 py-3 text-sm outline-none focus:border-[var(--color-focus)]"
        />
      </label>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-focus)] px-4 py-3 text-sm font-bold text-[#3f008e] shadow-[0_16px_36px_rgba(210,187,255,0.2)] disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Sign in
      </button>
    </form>
  );
}
