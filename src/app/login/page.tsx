import LoginForm from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-brand-bg)] px-4 py-10 text-[var(--color-text-primary)]">
      <section className="w-full max-w-md rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="border-b border-[var(--color-brand-border)] pb-5">
          <p className="font-[var(--font-plex-mono)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
            WorshipFlow
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            Enter the site access credentials to continue.
          </p>
        </div>
        <LoginForm nextPath={next} />
      </section>
    </main>
  );
}
