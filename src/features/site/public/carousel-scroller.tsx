"use client";

import { useEffect, useRef, useState } from "react";

// The sideways scrolling of a Carousel. The cards are server-rendered and scroll by themselves with swipe, the
// keyboard or the mouse wheel; these two buttons are only a help. There is no autoplay.
export function CarouselScroller({ label, perView, children }: { label: string; perView: 2 | 3 | 4; children: React.ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => setEdges({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, []);

  const go = (direction: -1 | 1) => {
    const element = track.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: reduced ? "auto" : "smooth" });
  };

  // Nothing to scroll: every card is already in view, so the buttons would do nothing.
  const fits = edges.start && edges.end;
  return (
    <div className="site-carousel" data-per-view={perView}>
      {/* A scrollable area must be reachable by keyboard so its cards can be scrolled with the arrow keys. */}
      <ul ref={track} className="site-carousel-track" role="region" aria-label={label} tabIndex={0}>
        {children}
      </ul>
      {fits ? null : (
        <div className="site-carousel-buttons">
          <button type="button" onClick={() => go(-1)} disabled={edges.start} aria-label="Previous cards" className="site-carousel-button">‹</button>
          <button type="button" onClick={() => go(1)} disabled={edges.end} aria-label="Next cards" className="site-carousel-button">›</button>
        </div>
      )}
    </div>
  );
}
