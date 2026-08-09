import LoginForm from "@/components/login-form";
import Link from "next/link";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090512] text-[#f7f1ff]">
      <div className="mx-auto min-h-screen max-w-[1440px] border-x border-[#a875ff]/15 bg-[linear-gradient(to_right,transparent_0,transparent_calc(25%_-_1px),rgba(168,117,255,.13)_25%,transparent_calc(25%_+_1px),transparent_calc(50%_-_1px),rgba(168,117,255,.13)_50%,transparent_calc(50%_+_1px),transparent_calc(75%_-_1px),rgba(168,117,255,.13)_75%,transparent_calc(75%_+_1px))] px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-16 items-center justify-between border-b border-[#a875ff]/25">
          <Link href="/" className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f7f1ff]">WorshipFlow</Link>
          <Link href="/" className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#cdb5ef] transition-colors hover:text-white">← Back home</Link>
        </header>

        <section className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-5xl items-center gap-12 py-14 lg:grid-cols-[1fr_minmax(360px,440px)] lg:gap-24 lg:py-16">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a875ff]">Workspace access / 01</p>
            <h1 className="mt-6 max-w-lg text-[clamp(3rem,8vw,5.5rem)] font-black uppercase leading-[0.82] tracking-[-0.07em] text-balance text-[#f7f1ff]">Make the room ready.</h1>
            <p className="mt-8 max-w-md border-l border-[#a875ff] pl-5 text-base leading-7 text-[#cdb5ef] sm:text-lg">Sign in to continue building the order, coordinating the team, and preparing your next worship service.</p>
            <div className="mt-10 hidden border-t border-[#a875ff]/25 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9f84c7] lg:block"><span>Order / people / outputs</span><span className="ml-8 text-[#a875ff]">Secure access</span></div>
          </div>

          <section className="border border-[#a875ff]/45 bg-[#10091c] p-5 shadow-[12px_12px_0_rgba(25,8,42,0.35)] sm:p-7" aria-labelledby="login-title">
            <div className="border-b border-[#a875ff]/25 pb-5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a875ff]">Sign in / 02</p>
              <h2 id="login-title" className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#f7f1ff]">Welcome back.</h2>
              <p className="mt-2 text-sm leading-6 text-[#cdb5ef]">We’ll email you a secure link, then take you to workspace selection.</p>
            </div>
            <LoginForm nextPath={next} />
          </section>
        </section>
      </div>
    </main>
  );
}
