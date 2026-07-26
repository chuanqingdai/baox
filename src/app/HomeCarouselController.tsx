"use client";

import { useEffect } from "react";

const TOTAL_SLIDES = 3;

export function HomeCarouselController() {
  useEffect(() => {
    const stage = document.querySelector<HTMLElement>("[data-baox-carousel]");
    if (!stage) return;

    let active = Number(stage.getAttribute("data-active") || "0");
    let timer: number | undefined;

    const setActive = (next: number) => {
      active = (next + TOTAL_SLIDES) % TOTAL_SLIDES;
      stage.setAttribute("data-active", String(active));
    };

    const restart = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => setActive(active + 1), 6200);
    };

    const onClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;

      const dot = target.closest<HTMLElement>("[data-baox-dot]");
      if (dot && stage.contains(dot)) {
        event.preventDefault();
        setActive(Number(dot.getAttribute("data-baox-dot")));
        restart();
        return;
      }

      const prev = target.closest<HTMLElement>("[data-baox-prev]");
      if (prev && stage.contains(prev)) {
        event.preventDefault();
        setActive(active - 1);
        restart();
        return;
      }

      const next = target.closest<HTMLElement>("[data-baox-next]");
      if (next && stage.contains(next)) {
        event.preventDefault();
        setActive(active + 1);
        restart();
      }
    };

    stage.addEventListener("click", onClick);
    restart();

    return () => {
      window.clearInterval(timer);
      stage.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
