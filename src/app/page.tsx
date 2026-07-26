import type { Metadata } from "next";
import Link from "next/link";
import { Menu } from "lucide-react";
import { HomeCarouselController } from "./HomeCarouselController";
import { LanguageToggle } from "./I18nBridge";

export const metadata: Metadata = {
  title: "保罗万相｜保险人的一站式AI引擎",
  description: "保罗万相面向保险从业者提供AI保险大师课、展页和AI工具包，帮助保险人用人工智能完成内容、获客、服务和成交。",
  alternates: {
    canonical: "https://baox.ai/",
  },
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/masterclass", label: "保险大师课" },
  { href: "/poster", label: "展页" },
  { href: "/tool", label: "工具包" },
  { href: "/lab", label: "作品集" },
  { href: "/about", label: "关于我们" },
] as const;

const slides = [
  {
    title: "保罗万相 BAOX",
    image: "/insurance/landing/baox-brand-banner.png",
  },
  {
    title: "AI保险大师课",
    image: "/insurance/landing/baox-home-masterclass-banner.png",
    href: "/masterclass",
    cta: "查看大师课",
  },
  {
    title: "展页",
    image: "/insurance/landing/baox-home-poster-banner.png",
    href: "https://knowlens.ai/baox",
    cta: "查看展页",
  },
] as const;

export default function BaoxHomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#060606] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .baox-carousel-card {
              left: 50%;
              top: 50%;
              width: min(84vw, 1280px);
              aspect-ratio: 16 / 9;
              opacity: 0;
              pointer-events: none;
              transform: translate3d(-50%, -50%, 0) scale(.74);
              transition: transform 780ms cubic-bezier(.22,1,.36,1), opacity 520ms ease, filter 520ms ease;
              filter: blur(3px) saturate(.82) brightness(.55);
              will-change: transform, opacity, filter;
            }
            .baox-carousel-stage[data-active="0"] [data-slide-index="0"],
            .baox-carousel-stage[data-active="1"] [data-slide-index="1"],
            .baox-carousel-stage[data-active="2"] [data-slide-index="2"] {
              z-index: 30;
              opacity: 1;
              pointer-events: auto;
              transform: translate3d(-50%, -50%, 0) scale(1);
              filter: saturate(1.04) brightness(1);
            }
            .baox-carousel-stage[data-active="0"] [data-slide-index="2"],
            .baox-carousel-stage[data-active="1"] [data-slide-index="0"],
            .baox-carousel-stage[data-active="2"] [data-slide-index="1"] {
              z-index: 20;
              opacity: .48;
              transform: translate3d(calc(-50% - min(40vw, 620px)), -50%, 0) scale(.66) rotateY(10deg);
            }
            .baox-carousel-stage[data-active="0"] [data-slide-index="1"],
            .baox-carousel-stage[data-active="1"] [data-slide-index="2"],
            .baox-carousel-stage[data-active="2"] [data-slide-index="0"] {
              z-index: 20;
              opacity: .48;
              transform: translate3d(calc(-50% + min(40vw, 620px)), -50%, 0) scale(.66) rotateY(-10deg);
            }
            .baox-carousel-stage[data-active="0"] [data-baox-dot="0"],
            .baox-carousel-stage[data-active="1"] [data-baox-dot="1"],
            .baox-carousel-stage[data-active="2"] [data-baox-dot="2"] {
              width: 1.75rem;
              background: rgba(252, 211, 77, .62);
            }
            .baox-mobile-slide-cta {
              display: none;
            }
            @media (min-width: 768px) and (min-height: 820px) {
              .baox-carousel-cta {
                display: none;
              }
              .baox-mobile-slide-cta {
                top: calc(50% + min(23.625vw, 360px) + 1.1rem);
              }
              .baox-carousel-stage[data-active="0"] [data-mobile-cta="0"],
              .baox-carousel-stage[data-active="1"] [data-mobile-cta="1"],
              .baox-carousel-stage[data-active="2"] [data-mobile-cta="2"] {
                display: inline-flex;
              }
              .baox-carousel-dots {
                bottom: auto;
                top: calc(50% + min(23.625vw, 360px) + 5.35rem);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .baox-carousel-card {
                transition: none !important;
              }
            }
            @media (max-width: 767px) {
              .baox-carousel-stage {
                min-height: 100svh !important;
              }
              .baox-carousel-card {
                top: 46%;
                width: 100vw;
                border-left-width: 0;
                border-right-width: 0;
                box-shadow: 0 28px 86px rgba(0,0,0,.58);
              }
              .baox-carousel-stage[data-active="0"] [data-slide-index="0"],
              .baox-carousel-stage[data-active="1"] [data-slide-index="1"],
              .baox-carousel-stage[data-active="2"] [data-slide-index="2"] {
                transform: translate3d(-50%, -50%, 0) scale(1);
              }
              .baox-carousel-stage[data-active="0"] [data-slide-index="2"],
              .baox-carousel-stage[data-active="1"] [data-slide-index="0"],
              .baox-carousel-stage[data-active="2"] [data-slide-index="1"] {
                opacity: .1;
                filter: blur(8px) saturate(.65) brightness(.38);
                transform: translate3d(calc(-50% - 58vw), -50%, 0) scale(.82);
              }
              .baox-carousel-stage[data-active="0"] [data-slide-index="1"],
              .baox-carousel-stage[data-active="1"] [data-slide-index="2"],
              .baox-carousel-stage[data-active="2"] [data-slide-index="0"] {
                opacity: .1;
                filter: blur(8px) saturate(.65) brightness(.38);
                transform: translate3d(calc(-50% + 58vw), -50%, 0) scale(.82);
              }
              .baox-carousel-cta {
                display: none;
              }
              .baox-mobile-slide-cta {
                top: calc(46% + 28.125vw + 1.25rem);
              }
              .baox-carousel-stage[data-active="0"] [data-mobile-cta="0"],
              .baox-carousel-stage[data-active="1"] [data-mobile-cta="1"],
              .baox-carousel-stage[data-active="2"] [data-mobile-cta="2"] {
                display: inline-flex;
              }
              .baox-carousel-controls {
                top: 46%;
                width: calc(100vw - 1.25rem);
                padding-inline: 0;
              }
              .baox-carousel-controls button {
                height: 2.75rem;
                width: 2.75rem;
                font-size: 2rem;
              }
              .baox-carousel-dots {
                bottom: auto;
                top: calc(46% + 28.125vw + 5.85rem);
              }
            }
          `,
        }}
      />
      <HomeCarouselController />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/35 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-16 md:py-0">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="保罗万相首页">
            <img
              src="/insurance/baox-original/BOAX-LOGO-W.png"
              alt="BAOX.AI"
              className="h-6 w-auto max-w-[128px] object-contain sm:h-7 sm:max-w-[150px]"
            />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  item.href === "/" ? "bg-white text-black" : "text-white/62 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <LanguageToggle />
          </div>
          <details className="baox-mobile-menu relative md:hidden">
            <summary className="inline-flex h-10 w-10 list-none items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white transition hover:bg-white/12">
              <Menu size={20} />
            </summary>
            <nav className="absolute right-0 top-12 z-50 w-56 rounded-[1.4rem] border border-white/10 bg-[#090909]/96 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
              <div className="mb-2 px-2">
                <LanguageToggle />
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold transition ${
                    item.href === "/" ? "bg-white text-black" : "text-white/62 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </header>

      <section className="baox-carousel-stage relative h-[100svh] min-h-[620px] overflow-hidden pt-16" data-active="0" data-baox-carousel>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(245,158,11,0.2),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.16),transparent_28%),linear-gradient(135deg,#030303_0%,#100c06_48%,#031511_100%)]" />
        <div className="absolute inset-x-0 top-16 h-px bg-gradient-to-r from-transparent via-amber-300/30 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />

        {slides.map((slide, index) => {
          const cardContent = (
            <div className="relative h-full bg-black">
              <img
                src={slide.image}
                alt={slide.title}
                className={`h-full w-full object-cover transition duration-700 ${"href" in slide ? "group-hover:scale-[1.02]" : ""}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/8" />
              {"cta" in slide && (
                <span className="baox-carousel-cta absolute bottom-6 left-1/2 inline-flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-7 py-3 text-sm font-black text-black shadow-[0_18px_48px_rgba(245,158,11,0.42)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_24px_64px_rgba(245,158,11,0.55)] sm:bottom-8 sm:px-9 sm:py-3.5 sm:text-base">
                  {slide.cta}
                  <span className="ml-2 text-lg leading-none">→</span>
                </span>
              )}
            </div>
          );

          return "href" in slide ? (
            <Link
              key={slide.title}
              href={slide.href}
              aria-label={slide.cta}
              data-slide-index={index}
              className="baox-carousel-card group absolute overflow-hidden border border-white/12 bg-black shadow-[0_46px_140px_rgba(0,0,0,0.62)]"
            >
              {cardContent}
            </Link>
          ) : (
            <div
              key={slide.title}
              aria-label={slide.title}
              data-slide-index={index}
              className="baox-carousel-card absolute overflow-hidden border border-white/12 bg-black shadow-[0_46px_140px_rgba(0,0,0,0.62)]"
            >
              {cardContent}
            </div>
          );
        })}

        {slides.map((slide, index) => "href" in slide && (
          <Link
            key={`${slide.title}-mobile-cta`}
            href={slide.href}
            data-mobile-cta={index}
            className="baox-mobile-slide-cta absolute left-1/2 z-40 -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-8 py-4 text-base font-black text-black shadow-[0_18px_48px_rgba(245,158,11,0.42)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(245,158,11,0.5)] active:scale-[0.98]"
            aria-label={slide.cta}
          >
            {slide.cta}
            <span className="ml-2 text-lg leading-none">→</span>
          </Link>
        ))}

        <div className="baox-carousel-controls pointer-events-none absolute left-1/2 top-1/2 z-40 flex w-[min(88vw,1360px)] -translate-x-1/2 -translate-y-1/2 items-center justify-between px-2 sm:px-4">
          <button type="button" data-baox-prev className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/18 bg-black/42 text-3xl font-light text-white shadow-[0_18px_54px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition hover:-translate-x-1 hover:border-amber-300/50 hover:bg-white hover:text-black sm:h-14 sm:w-14" aria-label="上一个 banner">
            ‹
          </button>
          <button type="button" data-baox-next className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/28 bg-black/38 text-3xl font-light text-amber-200 shadow-[0_18px_54px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition hover:translate-x-1 hover:border-amber-200/48 hover:bg-amber-300/18 hover:text-amber-100 sm:h-14 sm:w-14" aria-label="下一个 banner">
            ›
          </button>
        </div>

        <div className="baox-carousel-dots absolute bottom-[calc(50%-min(23.625vw,360px)+0.25rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 px-2 py-2 opacity-70 transition hover:opacity-100 max-md:bottom-[calc(50%-25.875vw+0.75rem)]">
          {slides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              data-baox-dot={index}
              className="h-1.5 w-1.5 rounded-full bg-white/24 transition-all hover:bg-white/60"
              aria-label={`切换到${slide.title}`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
