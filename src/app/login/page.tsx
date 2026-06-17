import LoginForm from "@/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-canvas)] px-4 py-10 text-[var(--text-primary)]">
      <section className="ui-modal w-full max-w-md p-6">
        <div className="border-b border-[var(--border-default)] pb-5">
          <p className="ui-technical-label">
            WorshipFlow
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Enter the site access credentials to continue.
          </p>
        </div>
        <LoginForm nextPath={next} />
      </section>
    </main>
  );
}
