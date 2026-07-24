import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRight,
  Beaker,
  BookOpenCheck,
  FileText,
  Layers3,
  MessageSquareText,
  WandSparkles,
  Wrench,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "保罗万相｜保险人的人工智能增长系统",
  description: "保罗万相面向保险从业者提供保险大师课与保险海报，帮助保险人用人工智能完成内容、获客、服务和成交。",
  alternates: {
    canonical: "https://baox.ai/",
  },
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/masterclass", label: "保险大师课" },
  { href: "/poster", label: "保险海报" },
  { href: "/tool", label: "工具包" },
  { href: "/lab", label: "作品集" },
  { href: "/about", label: "关于我们" },
] as const;

const heroBanners = [
  {
    title: "海量保险模板下载即用",
    image: "/insurance/landing/baox-home-poster-banner.png",
    href: "/poster",
    cta: "查看保险海报",
  },
  {
    title: "保险行业大师课",
    image: "/insurance/landing/baox-home-masterclass-banner.png",
    href: "/masterclass",
    cta: "查看保险大师课",
  },
] as const;

const pillars = [
  { icon: BookOpenCheck, title: "保险大师课", body: "学会保险人真正用得上的智能方法" },
  { icon: WandSparkles, title: "保险海报", body: "高频展业素材随时生成、随时发布" },
  { icon: Wrench, title: "工具包", body: "把提示词和模板沉淀成团队资产" },
  { icon: Beaker, title: "作品集", body: "真实案例截图展示，点击查看完整页面" },
] as const;

const outcomes = [
  { icon: FileText, title: "持续出内容", body: "选题、文案、视觉一体完成，私域每天有话题。" },
  { icon: MessageSquareText, title: "沟通更专业", body: "把条款、需求和方案讲清楚，客户更容易理解。" },
  { icon: Layers3, title: "团队可复制", body: "新人有流程，团队有标准，管理者有抓手。" },
  { icon: Zap, title: "成交先预热", body: "用内容建立信任，再进入咨询、配置和服务。" },
] as const;

const courseDays = [
  ["第 1 天", "AI图文创作实战", "文章、配图、信息图、早报与爆款定制，一站式搭好内容营销"],
  ["第 2 天", "AI视频制作全方位", "数字分身、产品讲解、短视频脚本与视频内容形态训练"],
  ["第 3 天", "智能知识库", "搭建保险产品、客户服务与理赔知识库，快速调用专业答案"],
  ["第 4 天", "智能体 Agent 实战", "WorkBuddy 多智能体协作与自动化，让 AI 替你处理重复工作"],
  ["第 5 天", "搭建个人网站", "沉淀个人品牌阵地，承接咨询、案例展示与长期信任"],
] as const;

const posterCases = [
  ["/insurance/posters/kepu-01.png", "医疗险科普", "把复杂保障讲清楚"],
  ["/insurance/posters/pinxuan-10.png", "家庭保障", "让配置逻辑更直观"],
  ["/insurance/posters/chanpin-45.png", "老年意外", "用场景建立需求感"],
  ["/insurance/posters/female-baoxian-02.png", "意外与寿险", "适合客户教育与转发"],
  ["/insurance/posters/female-kepu-04.png", "免责条款", "把风险提醒做得专业"],
  ["/insurance/posters/huodong-18.png", "退休规划", "承接咨询与活动邀约"],
] as const;

const reviews = [
  ["寿险顾问 · 王同学", "以前只是零散试工具，学完后知道每天内容怎么选题、怎么生成、怎么承接客户咨询。"],
  ["团队主管 · 李同学", "最有价值的是流程，不是单个工具。新人照着课程交付作业，团队素材和话术都能统一起来。"],
  ["保险经纪人 · 陈同学", "图文、视频、知识库和智能体串起来之后，终于有了一套自己的AI展业系统。"],
  ["私域运营 · 周同学", "课程不是讲概念，每天都有实战项目，做出来的内容可以直接改成团队日常素材。"],
  ["新人代理人 · 林同学", "不用从零摸索工具，跟着五天课程做完，就能交付第一批朋友圈海报和客户沟通素材。"],
  ["保险培训师 · 赵同学", "大师课适合拿来做团队训练，方法、工具和作业能接在一起，不只是听完热闹。"],
  ["产品经理 · 孙同学", "知识库和产品信息图模块很实用，把复杂保障拆成可视化内容，客户理解门槛明显降低。"],
  ["营销负责人 · 黄同学", "不是炫技，而是把AI接到获客、转化和服务上，团队知道下一步该怎么落地。"],
] as const;

export default function BaoxNewHomePage() {
  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes baoxBannerCycle {
              0%, 45% { opacity: 1; transform: scale(1); }
              50%, 95% { opacity: 0; transform: scale(1.018); }
              100% { opacity: 1; transform: scale(1); }
            }
            .baox-banner-slide { animation: baoxBannerCycle 8s infinite ease-in-out; }
            .baox-banner-slide:nth-child(2) { animation-delay: 4s; }
            @keyframes baoxHeroFloat {
              0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
              50% { transform: translate3d(0, -7px, 0) rotate(0.35deg); }
            }
            .baox-hero-media {
              animation: baoxHeroFloat 7s ease-in-out infinite;
            }
            .baox-magnet {
              transition: transform 260ms ease, box-shadow 260ms ease, background-color 260ms ease;
            }
            [data-baox-reveal] {
              opacity: 0;
              transform: translateY(28px);
              transition: opacity 760ms ease, transform 760ms cubic-bezier(0.22, 1, 0.36, 1);
              transition-delay: var(--baox-delay, 0ms);
            }
            [data-baox-reveal].is-visible {
              opacity: 1;
              transform: translateY(0);
            }
            .baox-tilt {
              transform-style: preserve-3d;
              transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
            }
            @media (prefers-reduced-motion: reduce) {
              .baox-banner-slide, [data-baox-reveal], .baox-tilt, .baox-hero-media, .baox-magnet {
                animation: none !important;
                opacity: 1 !important;
                transform: none !important;
                transition: none !important;
              }
            }
          `,
        }}
      />
      <Script id="baox-new-motion" strategy="afterInteractive">
        {`
            (() => {
              const initBaoxMotion = () => {
                const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                const revealItems = [...document.querySelectorAll("[data-baox-reveal]")];
                if (reduceMotion) {
                  revealItems.forEach((item) => item.classList.add("is-visible"));
                  return;
                }
                const showReveal = (item) => {
                  item.classList.add("is-visible");
                  if (observer) observer.unobserve(item);
                };
                const revealNearbyItems = () => {
                  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                  revealItems.forEach((item) => {
                    if (item.classList.contains("is-visible")) return;
                    const rect = item.getBoundingClientRect();
                    if (rect.top < viewportHeight * 1.12 && rect.bottom > -viewportHeight * 0.18) {
                      showReveal(item);
                    }
                  });
                };
                let ticking = false;
                let observer = null;
                observer = new IntersectionObserver((entries) => {
                  entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                      showReveal(entry.target);
                    }
                  });
                }, { rootMargin: "18% 0px 18% 0px", threshold: 0.01 });
                revealItems.forEach((item) => observer.observe(item));
                revealNearbyItems();
                window.setTimeout(revealNearbyItems, 120);
                window.setTimeout(revealNearbyItems, 520);
                window.setTimeout(() => revealItems.forEach(showReveal), 1800);
                window.addEventListener("scroll", () => {
                  if (ticking) return;
                  ticking = true;
                  window.requestAnimationFrame(() => {
                    revealNearbyItems();
                    ticking = false;
                  });
                }, { passive: true });

                document.querySelectorAll("[data-baox-tilt]").forEach((card) => {
                  card.addEventListener("mousemove", (event) => {
                    const rect = card.getBoundingClientRect();
                    const x = (event.clientX - rect.left) / rect.width - 0.5;
                    const y = (event.clientY - rect.top) / rect.height - 0.5;
                    card.style.transform = \`perspective(1200px) rotateX(\${-y * 4}deg) rotateY(\${x * 5}deg) translateY(-4px)\`;
                  });
                  card.addEventListener("mouseleave", () => {
                    card.style.transform = "";
                  });
                });

              };

              if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => window.setTimeout(initBaoxMotion, 120), { once: true });
              } else {
                window.setTimeout(initBaoxMotion, 120);
              }
            })();
        `}
      </Script>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/78 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 md:h-16 md:flex-nowrap md:py-0">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="保罗万相首页">
            <img
              src="/insurance/baox-original/BOAX-LOGO-W.png"
              alt="BAOX.AI"
              className="h-6 w-auto max-w-[128px] object-contain sm:h-7 sm:max-w-[150px]"
            />
          </Link>
          <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 pb-1 md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0 md:pb-0">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  item.href === "/" ? "bg-white text-black" : "text-white/54 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="https://baox.ai/index.html"
            className="inline-flex h-9 items-center justify-center rounded-full bg-amber-400 px-4 text-xs font-black text-black shadow-[0_16px_36px_rgba(245,158,11,0.28)] transition hover:bg-amber-300 sm:h-10 sm:px-5 sm:text-sm"
          >
            开始出图
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <h1 className="sr-only">保罗万相｜保险人的人工智能增长系统</h1>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(20,184,166,0.13),transparent_30%),linear-gradient(180deg,#111_0%,#070707_86%)]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070707] to-transparent" />
        <div className="relative flex w-full flex-col justify-start">
          <div className="baox-hero-media baox-hero-frame relative w-full overflow-hidden rounded-none bg-black shadow-[0_44px_120px_rgba(0,0,0,0.52)]">
            {heroBanners.map((banner, index) => (
              <Link
                key={banner.title}
                href={banner.href}
                aria-label={banner.cta}
                className={`baox-banner-slide group absolute inset-0 overflow-hidden rounded-none bg-[#fff1d6] outline-none transition ${
                  index === 0 ? "" : "opacity-0"
                }`}
              >
                <img src={banner.image} alt={banner.title} className="h-full w-full !rounded-none object-contain transition duration-700 group-hover:scale-[1.01]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-20 items-end justify-center bg-gradient-to-t from-black/62 via-black/24 to-transparent p-3 sm:h-28 sm:p-5">
                  <span
                    className={`inline-flex h-11 min-w-[190px] items-center justify-center gap-2 rounded-full px-5 text-sm font-black shadow-[0_24px_58px_rgba(245,158,11,0.42)] transition group-hover:-translate-y-1 sm:h-14 sm:min-w-[260px] sm:gap-3 sm:px-7 sm:text-lg ${
                      index === 0 ? "bg-amber-400 text-black" : "bg-white text-black"
                    }`}
                  >
                    {banner.cta}
                    <ArrowRight className="h-4 w-4 sm:h-[22px] sm:w-[22px]" />
                  </span>
                </div>
              </Link>
            ))}
            <div className="absolute bottom-6 right-6 z-20 hidden gap-2 sm:flex" aria-hidden="true">
              <span className="h-2 w-8 rounded-full bg-amber-300" />
              <span className="h-2 w-2 rounded-full bg-white/60" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 py-18 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div data-baox-reveal>
            <p className="text-sm font-black text-amber-300">增长入口</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              学会方法，
              <span className="block text-white/48">马上交付。</span>
            </h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-white/56" data-baox-reveal>
            从课程训练到素材生产，从个人展业到团队复制，保罗万相把人工智能真正放进保险业务现场。
          </p>
        </div>
        <div className="mt-12 grid overflow-hidden rounded-[2.4rem] border border-white/10 bg-white/[0.045] lg:grid-cols-4" data-baox-reveal>
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.title === "保险海报" ? "/poster" : item.title === "保险大师课" ? "/masterclass" : item.title === "工具包" ? "/tool" : "/lab"}
                className="group min-h-[230px] border-b border-white/10 p-7 transition hover:bg-white/[0.07] lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <Icon size={30} className="text-amber-300" />
                <h3 className="mt-16 text-2xl font-black">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-white/52">{item.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 py-18 sm:px-8">
        <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-[#10100d] shadow-[0_38px_120px_rgba(0,0,0,0.36)]" data-baox-reveal>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(245,158,11,0.18),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(20,184,166,0.16),transparent_34%),linear-gradient(135deg,#17130b_0%,#070707_52%,#071412_100%)]" />
          <div className="relative grid gap-0 xl:grid-cols-2">
            <div className="relative overflow-hidden bg-white text-black">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_20%,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_72%_82%,rgba(20,184,166,0.18),transparent_34%),linear-gradient(120deg,#fffaf3_0%,#ffffff_48%,#effdfb_100%)]" />
              <div className="relative grid min-h-[600px] gap-8 p-8 sm:p-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
                <div className="relative z-10 max-w-[330px] pt-1">
                  <p className="text-sm font-black text-amber-700">主理人</p>
                  <h2 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">孔晶</h2>
                  <p className="mt-5 text-xl font-semibold text-zinc-900">保罗万相创始人</p>
                  <p className="mt-5 text-base leading-8 text-zinc-600">
                    长期深耕寿险与人工智能训练，把复杂技术拆成保险人每天能执行、能交付、能复盘的工作流。
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {["保险实战", "AI训练", "百万圆桌经验"].map((item) => (
                      <span key={item} className="rounded-full border border-zinc-200 bg-white/78 px-3 py-1.5 text-xs font-black text-zinc-700 shadow-sm">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative z-0 mx-auto w-full max-w-[410px] lg:mx-0 lg:justify-self-end">
                  <div className="absolute -inset-8 rounded-[3rem] bg-[radial-gradient(circle_at_50%_20%,rgba(251,191,36,0.2),transparent_30%),radial-gradient(circle_at_72%_86%,rgba(20,184,166,0.28),transparent_42%)] blur-2xl" />
                  <img
                    src="/insurance/landing/kong-jing.jpg"
                    alt="孔晶"
                    className="relative aspect-square w-full rounded-[2.2rem] object-cover object-center shadow-[0_30px_90px_rgba(15,23,42,0.16)]"
                  />
                </div>
              </div>
            </div>

            <div className="relative flex min-h-[600px] flex-col justify-center p-8 sm:p-12 xl:border-l xl:border-white/10">
              <div className="max-w-[560px] pt-1">
                <p className="text-sm font-black text-amber-300">课程定位</p>
                <h3 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                  不止会用工具，
                  <span className="block text-amber-300">更能持续获客。</span>
                </h3>
                <p className="mt-5 max-w-xl text-base leading-8 text-white/56">
                  由方法训练进入素材交付，把内容、沟通、团队复制和成交预热放在同一套展业流程里。
                </p>
              </div>
              <div className="mt-8 grid min-w-0 gap-px overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/10 sm:grid-cols-2">
                {outcomes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="min-h-[158px] min-w-0 bg-[#151513]/92 p-7 transition hover:bg-[#1b1a16]" data-baox-reveal>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/12 text-amber-300">
                          <Icon size={20} />
                        </span>
                        <h4 className="text-xl font-black">{item.title}</h4>
                      </div>
                      <p className="mt-5 text-base leading-7 text-white/52">{item.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 py-18 sm:px-8">
        <div className="relative overflow-hidden rounded-[2.8rem] border border-white/10 bg-[#11100d] text-white shadow-[0_34px_100px_rgba(0,0,0,0.32)]" data-baox-reveal>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),transparent_34%),radial-gradient(circle_at_88%_76%,rgba(20,184,166,0.12),transparent_30%)]" />
          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[0.62fr_1.38fr] lg:p-14">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-sm font-black text-amber-300">保险大师课</p>
                <h2 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                  五天搭好
                  <span className="block text-amber-300">智能展业底盘</span>
                </h2>
                <p className="mt-6 max-w-md text-base leading-8 text-white/58">
                  从内容生产、客户沟通到个人品牌，完成一套能反复使用的工作流。
                </p>
              </div>
              <div>
                <Link href="/masterclass" className="mt-6 inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-amber-400 px-7 text-base font-black text-black transition hover:bg-amber-300">
                  查看完整课程
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-amber-300">训练路线</p>
              <h3 className="mt-2 text-2xl font-black">五个关键能力，逐步成型</h3>
              <div className="mt-8 space-y-0">
                {courseDays.map(([day, title, result], index) => (
                  <article key={day} className="grid gap-4 border-t border-white/10 py-5 last:border-b sm:grid-cols-[64px_210px_1fr] sm:items-center">
                    <div className="flex items-center gap-3 sm:block">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-black">
                        {index + 1}
                      </span>
                      <span className="text-xs font-black text-amber-200 sm:hidden">{day}</span>
                    </div>
                    <div>
                      <p className="hidden text-xs font-black text-amber-200 sm:block">{day}</p>
                      <h4 className="mt-1 text-xl font-black">{title}</h4>
                    </div>
                    <p className="text-sm leading-7 text-white/58">{result}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 py-18 sm:px-8">
        <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl" data-baox-reveal>
            <p className="text-sm font-black text-amber-300">保险海报</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">让专业看得见</h2>
            <p className="mt-5 text-lg leading-8 text-white/56">
              面向保险高频场景的宣传案例，让节气问候、保障科普、产品说明和客户服务更容易被看见。
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:items-end" data-baox-reveal>
            <div className="flex flex-wrap gap-2 text-xs font-bold text-white/58 lg:justify-end">
              {["医疗险", "家庭保障", "理赔服务", "客户教育"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2">
                  {item}
                </span>
              ))}
            </div>
            <Link href="/poster" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-amber-400 px-7 text-base font-black text-black transition hover:bg-amber-300">
              查看保险海报
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
        <div className="rounded-[2.4rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-baox-reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posterCases.map(([image, title, desc]) => (
              <article
                key={image}
                className="group overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/30 transition hover:-translate-y-1 hover:border-amber-300/35"
              >
                <div className="aspect-[4/5] overflow-hidden bg-[#111]">
                  <img src={image} alt={title} className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105" />
                </div>
                <div className="border-t border-white/10 p-5">
                  <h3 className="text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm text-white/50">{desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 py-18 sm:px-8">
        <div className="mb-10 max-w-3xl" data-baox-reveal>
          <p className="text-sm font-black text-amber-300">学员评价</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">学完以后，开始真正把AI用在展业里</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reviews.map(([role, quote]) => (
            <article key={role} className="min-h-[230px] rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-6" data-baox-reveal>
              <div className="text-4xl leading-none text-amber-300">“</div>
              <p className="mt-5 text-base font-semibold leading-7 text-white/82">{quote}</p>
              <p className="mt-7 text-sm font-black text-amber-200">{role}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-14 sm:px-8">
        <div className="relative overflow-hidden rounded-[3rem] bg-zinc-950 p-8 text-white shadow-[0_44px_120px_rgba(0,0,0,0.42)] sm:p-12 lg:p-14" data-baox-reveal>
          <img src="/insurance/landing/baox-cta-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.84)_0%,rgba(0,0,0,0.62)_48%,rgba(0,0,0,0.38)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,158,11,0.22),transparent_28%),radial-gradient(circle_at_90%_82%,rgba(20,184,166,0.18),transparent_30%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black text-amber-300">现在开始</p>
              <h2 className="mt-5 max-w-5xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                把保险展业，升级成智能增长系统。
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/64">
                用大师课搭建方法，用保险海报交付内容，让获客、服务和成交持续运转。
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
              <Link href="/masterclass" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-black text-black transition hover:bg-zinc-100">
                查看保险大师课
                <ArrowRight size={18} />
              </Link>
              <Link href="https://baox.ai/index.html" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-amber-400 px-8 text-base font-black text-black transition hover:bg-amber-300">
                打开海报出图
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="保罗万相首页">
              <img
                src="/insurance/baox-original/BOAX-LOGO-W.png"
                alt="BAOX.AI"
                className="h-7 w-auto max-w-[150px] object-contain"
              />
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/48">
              面向保险从业者的人工智能增长系统，连接课程训练、海报生成、工具模板与业务实验。
            </p>
          </div>
          <div>
            <h3 className="text-sm font-black text-white">核心入口</h3>
            <div className="mt-5 grid gap-3 text-sm text-white/50">
              <Link href="/masterclass" className="transition hover:text-amber-300">保险大师课</Link>
              <Link href="/poster" className="transition hover:text-amber-300">保险海报</Link>
              <Link href="/tool" className="transition hover:text-amber-300">工具包</Link>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-black text-white">了解更多</h3>
            <div className="mt-5 grid gap-3 text-sm text-white/50">
              <Link href="/lab" className="transition hover:text-amber-300">作品集</Link>
              <Link href="/about" className="transition hover:text-amber-300">关于我们</Link>
              <span>© 2026 保罗万相</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
