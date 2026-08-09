"use client";

import { Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function LoginForm({ nextPath: rawNextPath }: { nextPath?: string }) {
  const router = useRouter();
  const nextPath = useMemo(() => getSafeNextPath(rawNextPath ?? null), [rawNextPath]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageType(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: getAuthRedirectUrl(window.location.origin, nextPath) },
      });

      if (error) throw error;
      setMessage("Check your email for a secure sign-in link.");
      setMessageType("success");
      router.refresh();
    } catch (loginError) {
      setMessage(loginError instanceof Error ? loginError.message : "Could not send a sign-in link.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitGoogleLogin() {
    setMessage("");
    setMessageType(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getAuthRedirectUrl(window.location.origin, nextPath) },
      });

      if (error) throw error;
    } catch (loginError) {
      setMessage(loginError instanceof Error ? loginError.message : "Could not start Google sign-in.");
      setMessageType("error");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitLogin} className="space-y-4 pt-6">
      <button
        type="button"
        onClick={() => void submitGoogleLogin()}
        disabled={isSubmitting}
        className="ui-btn-secondary inline-flex min-h-12 w-full items-center justify-center gap-3 px-4 text-sm font-semibold text-[#f7f1ff] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 18 18" fill="none">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62Z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.82.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.46.35 2.84.96 4.05l3.01-2.33Z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.34l2.57-2.57C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33c.71-2.12 2.69-3.7 5.03-3.7Z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-[#a875ff]/25" />
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9f84c7]">Or continue with email</span>
        <span className="h-px flex-1 bg-[#a875ff]/25" />
      </div>

      <label className="block">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#cdb5ef]">Email address</span>
        <span id="login-help" className="sr-only">We’ll send a secure sign-in link to this email address.</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          name="email"
          autoComplete="email"
          aria-describedby={`login-help${message ? " login-status" : ""}`}
          type="email"
          required
          className="mt-2 min-h-12 w-full border border-[#a875ff]/45 bg-[#090512] px-3 py-3 text-sm text-[#f7f1ff] outline-none transition placeholder:text-[#765b96] focus:border-[#a875ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a875ff]"
          placeholder="you@example.com"
        />
      </label>

      {message ? (
        <p id="login-status" className={`border bg-[#090512] px-3 py-3 text-sm leading-6 ${messageType === "error" ? "border-[#ff9f8d]/60 text-[#ffb7a8]" : "border-[#a875ff]/35 text-[#cdb5ef]"}`} role={messageType === "error" ? "alert" : "status"} aria-live="polite">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#8f4dff] px-4 text-sm font-bold text-white transition-colors hover:bg-[#b58aff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7f1ff] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {isSubmitting ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
