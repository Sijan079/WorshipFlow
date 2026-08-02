import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, FileMusic, ListChecks, UsersRound } from "lucide-react";
import LandingSignalCarousel from "@/components/landing-signal-carousel";

const workflowSteps = [
  ["01", "Prepare", "Set the service context.", FileMusic],
  ["02", "Order", "Keep every block in sequence.", ListChecks],
  ["03", "Assign", "Give each detail an owner.", UsersRound],
  ["04", "Hand off", "Make the room ready to run.", Check],
] as const;

export default function Home() {
  return (
    <main className="landing-editorial min-h-screen overflow-x-hidden bg-[#090512] text-[#f7f1ff] selection:bg-[#8f4dff] selection:text-white">
      <div className="relative mx-auto max-w-[1440px] border-x border-[#a875ff]/15 bg-[linear-gradient(to_right,transparent_0,transparent_calc(25%_-_1px),rgba(168,117,255,.13)_25%,transparent_calc(25%_+_1px),transparent_calc(50%_-_1px),rgba(168,117,255,.13)_50%,transparent_calc(50%_+_1px),transparent_calc(75%_-_1px),rgba(168,117,255,.13)_75%,transparent_calc(75%_+_1px))] px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-16 items-center justify-between border-b border-[#a875ff]/25">
          <Link href="/" aria-label="WorshipFlow home" className="inline-flex min-h-11 items-center font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f7f1ff]">WorshipFlow</Link>
          <nav className="flex items-center gap-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#cdb5ef]" aria-label="Primary navigation">
            <a href="#workflow" className="hidden transition-colors hover:text-white sm:inline">How it works</a>
            <Link href="/login?next=%2Fworkspaces" className="inline-flex min-h-11 items-center border border-[#f7f1ff] bg-[#8f4dff] px-4 text-[11px] font-bold tracking-[0.14em] text-white transition-colors hover:bg-white hover:text-[#090512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a875ff]">Sign in</Link>
          </nav>
        </header>

        <section className="mx-auto max-w-4xl px-0 py-14 text-center sm:py-16 lg:py-16">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a875ff]">Worship production OS / 01</p>
          <h1 className="landing-editorial-title mx-auto mt-6 max-w-4xl font-black uppercase leading-[0.8] tracking-[-0.08em] text-[#f7f1ff]">Make the <span className="text-[#a875ff]">service</span> visible.</h1>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-[#cdb5ef] sm:text-lg">WorshipFlow gives church tech and production teams one calm place to build the order, coordinate the people, and hand off a service that is ready to run.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/login?next=%2Fworkspaces" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#8f4dff] px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#b58aff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Enter workspace <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
            <a href="#workflow" className="inline-flex min-h-12 items-center justify-center px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#cdb5ef] hover:text-white">See the workflow ↓</a>
          </div>
        </section>

        <section className="-mt-2 border-y border-[#a875ff]/25 py-8 sm:py-10" aria-label="WorshipFlow product preview">
          <div className="mb-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#9f84c7]"><span>One clear view of the service</span><span className="text-[#a875ff]">Live preparation / 02</span></div>
          <LandingSignalCarousel />
        </section>

        <section id="workflow" className="scroll-mt-6 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-3xl text-center"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a875ff]">How it works / 03</p><h2 className="mt-5 text-4xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-[#f7f1ff] sm:text-6xl">Fits the way your team already prepares.</h2><p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-[#cdb5ef] sm:text-base">No complicated setup, no changing how you work. WorshipFlow slots between your service planning and the room, keeping the structured first pass clear for everyone.</p></div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {workflowSteps.map(([number, title, description, Icon], index) => <div key={number} className="relative"><div className={`min-h-52 border p-5 text-center transition-colors ${index === 2 ? "border-[#b58aff] bg-gradient-to-br from-[#211334] via-[#3b1d68] to-[#6f35c5]" : "border-[#a875ff]/35 bg-[#10091c]"}`}><div className={`mx-auto flex h-14 w-14 items-center justify-center ${index === 2 ? "bg-gradient-to-br from-[#d6c2ff] to-[#8f4dff] text-[#150a27]" : "bg-[#432680] text-[#f7f1ff]"}`}><Icon className="h-6 w-6" aria-hidden="true" /></div><p className="mt-6 font-semibold text-[#f7f1ff]">{title}</p><p className={`mt-5 font-mono text-[10px] uppercase leading-5 tracking-[0.08em] ${index === 2 ? "text-[#f0e7ff]" : "text-[#bda6db]"}`}>{description}</p></div>{index < workflowSteps.length - 1 ? <ArrowRight className="absolute -right-5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#a875ff]/45 lg:block" aria-hidden="true" /> : null}</div>)}
          </div>
          <p className="mt-6 text-center font-mono text-[10px] italic uppercase tracking-[0.12em] text-[#9f84c7]">WorshipFlow supports professional judgment; it keeps the service order visible.</p>
        </section>

        <section className="overflow-hidden border-y border-[#a875ff]/25 py-10" aria-label="WorshipFlow workflow areas"><div className="landing-workflow-viewport focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a875ff]" tabIndex={0} aria-label="Moving workflow labels; focus to pause"><div className="landing-workflow-track flex w-max items-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9f84c7]"><div className="flex shrink-0 items-center gap-12 pr-12 sm:gap-24 sm:pr-24"><span className="text-[#a875ff]">Works with your workflow</span><span>Order</span><span>People</span><span>Songs</span><span>Outputs</span></div><div aria-hidden="true" className="landing-workflow-duplicate flex shrink-0 items-center gap-12 pr-12 sm:gap-24 sm:pr-24"><span className="text-[#a875ff]">Works with your workflow</span><span>Order</span><span>People</span><span>Songs</span><span>Outputs</span></div><div aria-hidden="true" className="landing-workflow-duplicate flex shrink-0 items-center gap-12 pr-12 sm:gap-24 sm:pr-24"><span className="text-[#a875ff]">Works with your workflow</span><span>Order</span><span>People</span><span>Songs</span><span>Outputs</span></div></div></div></section>

        <section className="py-16 text-center sm:py-24"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a875ff]">Ready when you are / 04</p><h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.85] tracking-[-0.06em] text-[#f7f1ff] sm:text-6xl">Make Sunday easier to run.</h2><p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-[#cdb5ef]">Build one clear service, give every detail a home, and walk into the room with confidence.</p><Link href="/login?next=%2Fworkspaces" className="mt-8 inline-flex min-h-12 items-center gap-2 bg-[#8f4dff] px-5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#b58aff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Enter your workspace <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></section>

        <footer className="flex flex-col gap-3 border-t border-[#a875ff]/25 py-6 font-mono text-[10px] uppercase tracking-[0.12em] text-[#9f84c7] sm:flex-row sm:items-center sm:justify-between"><span>WorshipFlow · Production clarity for Sunday morning.</span><Link href="/login?next=%2Fworkspaces" className="text-[#f7f1ff] hover:text-[#a875ff]">Sign in to continue →</Link></footer>
      </div>
    </main>
  );
}
