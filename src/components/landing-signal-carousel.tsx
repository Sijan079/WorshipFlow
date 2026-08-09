"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

const slides = [
  { src: "/mockups/purple-editorial-signal.png", label: "Purple Editorial Signal" },
  { src: "/mockups/isms/08-material.png", label: "Material study" },
  { src: "/mockups/isms/06-swiss.png", label: "Swiss study" },
] as const;

export default function LandingSignalCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

  const activeSlide = slides[activeIndex];

  return (
    <div
      className="relative mx-auto aspect-[3/2] w-full max-w-[860px] border border-[#a875ff]/50 bg-[#10091c] p-3 shadow-[12px_12px_0_rgba(25,8,42,0.35)] sm:p-4"
      role="region"
      aria-roledescription="carousel"
      aria-label="Visual direction studies"
    >
      <div className="relative h-full overflow-hidden border border-[#a875ff]/25 bg-[#090512]">
        {slides.map((slide, index) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.label}
            fill
            sizes="(min-width: 1024px) 70vw, 94vw"
            aria-hidden={index !== activeIndex}
            className={`object-cover object-top p-0 transition-opacity duration-500 ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
            priority={index === 0}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-[#090512]/90 px-3 py-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#cdb5ef] sm:px-4" aria-live="polite">
          <span>{activeSlide.label}</span>
          <span className="text-[#a875ff]">0{activeIndex + 1} / 0{slides.length}</span>
        </div>
      </div>
      <div className="absolute -bottom-5 right-4 flex items-center gap-1.5 bg-[#090512] p-1">
        <button
          type="button"
          onClick={() => setActiveIndex((index) => (index - 1 + slides.length) % slides.length)}
          className="inline-flex h-11 w-11 touch-manipulation items-center justify-center border border-[#a875ff]/45 text-[#cdb5ef] transition-colors hover:border-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a875ff]"
          aria-label="Previous visual study"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setActiveIndex((index) => (index + 1) % slides.length)}
          className="inline-flex h-11 w-11 touch-manipulation items-center justify-center border border-[#a875ff]/45 text-[#cdb5ef] transition-colors hover:border-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a875ff]"
          aria-label="Next visual study"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
