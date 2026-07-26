"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const prefetchRoutes = ["/", "/masterclass", "/poster", "/tool", "/lab", "/about"];

const isModifiedClick = (event: MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

export function NavigationFeedback() {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const fallbackTimer = useRef<number | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    const prefetch = () => {
      prefetchRoutes.forEach((route) => router.prefetch(route));
    };

    const timer = window.setTimeout(prefetch, 350);
    return () => window.clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    const elapsed = Date.now() - startedAt.current;
    const hideDelay = isNavigating ? Math.max(0, 260 - elapsed) : 0;
    const hideTimer = window.setTimeout(() => setIsNavigating(false), hideDelay);
    if (fallbackTimer.current) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    return () => window.clearTimeout(hideTimer);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) return;

      const target = event.target as Element | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.hash) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      event.preventDefault();
      startedAt.current = Date.now();
      flushSync(() => setIsNavigating(true));
      if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = window.setTimeout(() => setIsNavigating(false), 6000);
      router.push(`${destination.pathname}${destination.search}${destination.hash}`);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  if (!isNavigating) return null;

  return <RouteSkeletonOverlay />;
}

export function RouteSkeletonOverlay() {
  return (
    <div className="baox-route-skeleton fixed inset-0 z-[999] bg-[#070707] text-white" role="status" aria-live="polite" aria-label="页面加载中">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(245,158,11,0.2),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.12),transparent_28%),linear-gradient(180deg,#0d0d0d_0%,#070707_78%)]" />
      <div className="relative mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 sm:px-8">
        <div className="h-7 w-36 rounded-full bg-white/16" />
        <div className="hidden items-center gap-2 md:flex">
          <div className="h-9 w-16 rounded-full bg-white/18" />
          <div className="h-9 w-24 rounded-full bg-white/10" />
          <div className="h-9 w-16 rounded-full bg-white/10" />
          <div className="h-9 w-20 rounded-full bg-white/10" />
        </div>
        <div className="h-10 w-10 rounded-full bg-white/12 md:w-28" />
      </div>
      <div className="relative mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-12 sm:px-8 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <div>
          <div className="h-8 w-52 rounded-full bg-amber-300/18" />
          <div className="mt-8 space-y-4">
            <div className="h-16 w-full max-w-xl rounded-xl bg-white/16" />
            <div className="h-16 w-5/6 max-w-lg rounded-xl bg-amber-300/20" />
            <div className="h-16 w-2/3 max-w-md rounded-xl bg-amber-300/14" />
          </div>
          <div className="mt-8 h-5 w-full max-w-xl rounded-full bg-white/10" />
          <div className="mt-3 h-5 w-4/5 max-w-lg rounded-full bg-white/8" />
          <div className="mt-8 flex gap-4">
            <div className="h-12 w-36 rounded-full bg-amber-300/34" />
            <div className="h-12 w-32 rounded-full bg-white/14" />
          </div>
        </div>
        <div className="min-h-[280px] rounded-[2rem] border border-white/10 bg-white/[0.045] p-3 shadow-[0_36px_100px_rgba(0,0,0,0.42)]">
          <div className="h-full min-h-[260px] rounded-[1.5rem] bg-[linear-gradient(120deg,rgba(255,255,255,0.08),rgba(245,158,11,0.18),rgba(255,255,255,0.06))]" />
        </div>
      </div>
      <span className="sr-only">页面加载中</span>
    </div>
  );
}
