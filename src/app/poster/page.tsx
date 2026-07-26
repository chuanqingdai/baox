import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Download,
  FileCheck2,
  Images,
  MessageCircle,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { BaoxPageChrome } from "../BaoxPageChrome";

export const metadata: Metadata = {
  title: "展页",
  description: "展页面向保险人高频展业场景，提供海报模板与出图能力，覆盖节气问候、保障科普、产品说明和客户服务。",
};

const promises = ["专业可靠", "高效便捷", "一键下载", "多场景分享"] as const;

const metrics = [
  ["1000+", "保险场景模板"],
  ["10类+", "核心展业内容"],
  ["2分钟", "快速改文出图"],
  ["高清", "无水印下载"],
] as const;

const scenes = [
  ["节气问候", "节日、节气、早安问候，让朋友圈保持温度。", "/insurance/posters/jieqi-liqiu-brush-01.png"],
  ["保障科普", "把医疗险、重疾险、意外险讲得更容易懂。", "/insurance/posters/kepu-01.png"],
  ["产品说明", "用结构化画面讲清投保重点、配置逻辑和风险提示。", "/insurance/posters/chanpin-45.png"],
  ["家庭配置", "围绕父母、孩子、养老、教育等场景建立需求感。", "/insurance/posters/pinxuan-10.png"],
  ["客户服务", "续保、理赔、保单检视，用专业内容承接服务。", "/insurance/posters/yewu-31.png"],
  ["活动邀约", "沙龙、直播、咨询活动预热，帮客户更快理解主题。", "/insurance/posters/huodong-18.png"],
] as const;

const workflow = [
  [PenLine, "选模板", "先按节气、科普、产品、服务等场景选择海报。"],
  [Images, "可改文案", "需要个性化时，替换标题、日期、客户场景和行动引导。"],
  [Download, "直接下载", "不想改也可以直接保存发布，用于朋友圈、社群和客户私聊。"],
] as const;

const capability = [
  [CalendarDays, "日常可发", "节日、节气、早晚安、客户关怀，让账号保持稳定出现。"],
  [ShieldCheck, "专业可信", "医疗、重疾、意外、养老等保险主题，表达更像专业顾问。"],
  [MessageCircle, "便于沟通", "画面先讲清需求，再承接私聊、咨询、配置和服务。"],
  [FileCheck2, "团队复用", "统一模板、统一表达，新人也能快速跟上团队内容标准。"],
] as const;

const painPoints = [
  ["不知道发什么", "每天临时找选题，内容容易断更，也很难形成专业印象。", "按保险场景直接选模板，节气、科普、产品、服务都有内容可发。"],
  ["做图太耗时间", "找图、排版、改字号，常常半小时过去还不满意。", "成熟版式直接复用，轻量改文后即可下载发布。"],
  ["客户看不懂", "条款和方案太专业，单靠文字解释容易失去耐心。", "用画面先建立场景，再把保障重点讲得更直观。"],
  ["团队难统一", "每个人审美和表达不一致，新人很难快速跟上标准。", "统一模板和内容框架，团队素材能复用、能沉淀。"],
] as const;

const deliverables = [
  ["场景模板库", "覆盖节气问候、保障科普、产品说明、家庭配置、客户服务和活动邀约。"],
  ["可发布海报", "成品图可直接保存，适合朋友圈、客户私聊、社群和活动预热。"],
  ["可改文案框架", "标题、卖点、行动引导都可以按客户场景做轻量调整。"],
  ["团队素材标准", "新人照着发，团队统一表达，管理者更容易做内容复盘。"],
] as const;

const gallery = [
  ["科普", "/insurance/posters/kepu-01.png"],
  ["科普", "/insurance/posters/female-kepu-04.png"],
  ["产品", "/insurance/posters/chanpin-45.png"],
  ["产品", "/insurance/posters/chanpin-47.png"],
  ["家庭", "/insurance/posters/pinxuan-10.png"],
  ["家庭", "/insurance/posters/father-17.png"],
  ["服务", "/insurance/posters/yewu-126.png"],
  ["服务", "/insurance/posters/yewu-31.png"],
  ["活动", "/insurance/posters/huodong-18.png"],
  ["活动", "/insurance/posters/female-huodong-05.png"],
  ["科普", "/insurance/posters/yingxiao-61.png"],
  ["家庭", "/insurance/posters/licai-11.png"],
] as const;

const audience = [
  ["保险经纪人", "每天需要稳定发内容，想让客户更快看懂保障价值。"],
  ["团队管理者", "需要统一新人素材标准，让团队出图和表达更可复制。"],
  ["私域运营", "需要节气、活动、科普、服务素材持续承接客户触点。"],
] as const;

const reviews = [
  ["上海 · 保险经纪人", "以前每天最怕想选题，现在看到模板就知道今天能发什么。节气问候和保障科普发出去后，客户更愿意点开看。", "用于朋友圈日更"],
  ["杭州 · 团队主管", "新人不用再从零设计海报，先按模板发起来，再逐步训练文案表达。团队素材质量比以前稳定很多。", "用于新人训练"],
  ["深圳 · 私域运营", "活动预热、科普解释、服务提醒都能接上，素材周转明显快了。最关键是能直接保存发布。", "用于社群运营"],
  ["南京 · 寿险顾问", "产品说明类海报很适合发给客户做预沟通，正式见面前客户已经知道大概重点，沟通效率更高。", "用于客户私聊"],
  ["成都 · 保险代理人", "我不擅长设计，直接下载就能发。需要个性化时只改标题和时间，几分钟就能出一张。", "用于日常展业"],
  ["广州 · 营销负责人", "我们更需要统一表达，而不是每个人随便做图。模板库能让团队内容看起来更专业。", "用于团队素材库"],
] as const;

const faqs = [
  ["这些海报适合直接发布吗？", "适合。页面展示的是面向保险展业场景整理的成品方向，进入工作台后可以按自己的客户、产品和场景调整文案。"],
  ["是否只能做朋友圈海报？", "不只是朋友圈，也适合客户私聊、社群、活动预热、服务提醒和团队素材库沉淀。"],
  ["和大师课是什么关系？", "保险海报负责快速交付可发布素材，大师课负责训练选题、文案、沟通、知识库和团队复用方法。"],
] as const;

export default function PosterPage() {
  return (
    <BaoxPageChrome active="/poster">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .poster-reveal {
              opacity: 0;
              translate: 0 26px;
              transition: opacity 720ms ease, translate 720ms cubic-bezier(.22,1,.36,1);
              transition-delay: var(--poster-delay, 0ms);
            }
            .poster-reveal.is-visible {
              opacity: 1;
              translate: 0 0;
            }
            .poster-tilt {
              transform-style: preserve-3d;
              transition: transform 360ms cubic-bezier(.22,1,.36,1), border-color 240ms ease, background-color 240ms ease;
            }
            .poster-spotlight {
              background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(195,161,120,.2), transparent 32%), rgba(255,255,255,.045);
            }
            .poster-gallery-item {
              transition: transform 300ms ease, border-color 300ms ease;
            }
            @media (prefers-reduced-motion: reduce) {
              .poster-reveal, .poster-tilt, .poster-gallery-item {
                opacity: 1 !important;
                translate: none !important;
                transform: none !important;
                transition: none !important;
              }
            }
          `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              const initPosterPage = () => {
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                const reveals = [...document.querySelectorAll("[data-poster-reveal]")];
                reveals.forEach((item, index) => {
                  if (item.dataset.posterRevealReady === "1") return;
                  item.dataset.posterRevealReady = "1";
                  item.classList.add("poster-reveal");
                  item.style.setProperty("--poster-delay", \`\${Math.min(index % 6, 5) * 70}ms\`);
                });
                if (reduce) {
                  reveals.forEach((item) => item.classList.add("is-visible"));
                } else {
                  const observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                      if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                      }
                    });
                  }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
                  reveals.forEach((item) => observer.observe(item));
                }

                document.querySelectorAll("[data-poster-tilt]").forEach((card) => {
                  if (card.dataset.posterTiltReady === "1") return;
                  card.dataset.posterTiltReady = "1";
                  card.classList.add("poster-tilt");
                  card.addEventListener("pointermove", (event) => {
                    const rect = card.getBoundingClientRect();
                    const x = (event.clientX - rect.left) / rect.width - .5;
                    const y = (event.clientY - rect.top) / rect.height - .5;
                    card.style.transform = \`perspective(1100px) rotateX(\${-y * 3.8}deg) rotateY(\${x * 4.8}deg) translateY(-4px)\`;
                  });
                  card.addEventListener("pointerleave", () => {
                    card.style.transform = "";
                  });
                });

                document.querySelectorAll("[data-poster-spotlight]").forEach((card) => {
                  if (card.dataset.posterSpotlightReady === "1") return;
                  card.dataset.posterSpotlightReady = "1";
                  card.classList.add("poster-spotlight");
                  card.addEventListener("pointermove", (event) => {
                    const rect = card.getBoundingClientRect();
                    card.style.setProperty("--mx", \`\${((event.clientX - rect.left) / rect.width) * 100}%\`);
                    card.style.setProperty("--my", \`\${((event.clientY - rect.top) / rect.height) * 100}%\`);
                  });
                });
              };
              const schedulePosterPage = () => window.setTimeout(initPosterPage, 1200);
              if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", schedulePosterPage, { once: true });
              } else {
                schedulePosterPage();
              }
            })();
          `,
        }}
      />

      <section className="baox-subhero relative isolate overflow-hidden px-4 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(195,161,120,0.22),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(104,119,137,0.14),transparent_30%),linear-gradient(180deg,#17171B_0%,#0D0D10_78%)]" />
        <div className="baox-subhero-grid relative mx-auto grid w-full max-w-[1280px] gap-8 px-4 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div className="max-w-4xl max-lg:mx-auto max-lg:text-center" data-poster-reveal>
            <p className="inline-flex border-l-2 border-amber-300/80 pl-3 text-sm font-black tracking-[0.18em] text-amber-200/90 max-lg:border-l-0 max-lg:border-t-2 max-lg:px-3 max-lg:pt-3">
              专业保险海报模版
            </p>
            <h1 className="baox-poster-hero-title mt-5 text-[2.55rem] font-black leading-[0.98] tracking-tight text-white sm:mt-6 sm:text-[4.6rem] lg:text-[5.25rem]">
              专业海报，
              <span className="baox-poster-hero-accent block text-amber-300">用「展页」轻松搞定</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
              面向保险人高频展业场景，把文案、画面和传播目的打包成可复用模板，快速产出专业素材。
            </p>
            <div className="baox-subhero-actions flex flex-col gap-3 sm:flex-row sm:gap-4 max-lg:justify-center">
              <Link href="https://knowlens.ai/baox" className="baox-subhero-action inline-flex items-center justify-center gap-3 rounded-full bg-amber-400 px-7 text-base font-black text-black shadow-[0_28px_70px_rgba(195,161,120,0.32)] transition hover:bg-amber-300">
                打开「展页」
                <ArrowRight size={18} />
              </Link>
              <Link href="#cases" className="baox-subhero-action inline-flex items-center justify-center gap-3 rounded-full bg-white px-7 text-base font-black text-black transition hover:bg-zinc-100">
                查看案例
                <ArrowRight size={18} />
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 sm:mt-6 sm:gap-x-6 max-lg:justify-center">
              {promises.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 text-sm font-bold text-white/66">
                  <CheckCircle2 size={15} className="text-amber-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center lg:self-center" data-poster-reveal>
            <div className="relative w-[94%] overflow-hidden rounded-[1.1rem] shadow-[0_32px_90px_rgba(0,0,0,0.38)] sm:rounded-[1.55rem]" data-poster-tilt>
              <img
                src="/insurance/landing/baox-poster-hero-template-wall.webp"
                alt="保险海报模板展示"
                className="w-full object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 pb-10 sm:px-8">
        <div className="grid overflow-hidden rounded-[2.4rem] border border-white/10 bg-white/[0.04] md:grid-cols-4" data-poster-reveal>
          {metrics.map(([value, label]) => (
            <div key={label} className="border-b border-white/10 p-7 md:border-b-0 md:border-r md:last:border-r-0">
              <p className="baox-stat-value text-4xl font-black text-amber-300">{value}</p>
              <p className="mt-2 text-sm font-bold text-white/54">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div data-poster-reveal>
            <p className="text-sm font-black text-amber-300">高频场景</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">保险内容每天都能发</h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-white/54" data-poster-reveal>
            模板不是为了好看而好看，而是围绕客户沟通、信任建立和咨询承接来设计。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {scenes.map(([title, body, image]) => (
            <article key={title} className="group overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:border-amber-300/30" data-poster-reveal data-poster-tilt>
              <img src={image} alt={title} className="aspect-[16/10] w-full object-cover object-top transition duration-700 group-hover:scale-[1.04]" />
              <div className="p-7">
                <h3 className="text-2xl font-black">{title}</h3>
                <p className="mt-3 text-base leading-7 text-white/52">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-stretch">
          <div className="rounded-[2.8rem] bg-[#F0E7DC] p-8 text-black sm:p-10" data-poster-reveal>
            <TrendingUp size={30} className="text-amber-700" />
            <h2 className="mt-8 text-4xl font-black leading-tight tracking-tight">为什么保险人需要一套海报系统</h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">
              不是为了多一张图，而是为了让专业内容更稳定地出现、更容易被客户理解。
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[2.8rem] border border-white/10 bg-white/10 md:grid-cols-2" data-poster-reveal>
            {painPoints.map(([problem, pain, solution]) => (
              <article key={problem} className="bg-[#17171B] p-7">
                <p className="text-sm font-black text-amber-300">问题</p>
                <h3 className="mt-3 text-2xl font-black">{problem}</h3>
                <p className="mt-4 text-sm leading-7 text-white/44">{pain}</p>
                <div className="mt-5 rounded-2xl border border-amber-300/16 bg-amber-300/8 p-4">
                  <p className="text-sm font-black text-amber-200">海报系统解决</p>
                  <p className="mt-2 text-sm leading-7 text-white/58">{solution}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-[#17171B] p-8 sm:p-10 lg:p-12" data-poster-reveal data-poster-spotlight>
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-amber-300">模板能力</p>
              <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">不是图片库，是展业素材系统</h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-white/54">
              从“今天发什么”到“发完如何承接”，让海报真正服务获客、沟通和长期服务。
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-2 xl:grid-cols-4">
            {capability.map(([Icon, title, body]) => (
              <article key={title} className="min-h-[250px] bg-[#12110f]/95 p-7">
                <Icon size={28} className="text-amber-300" />
                <h3 className="mt-10 text-2xl font-black">{title}</h3>
                <p className="mt-4 text-base leading-7 text-white/52">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div data-poster-reveal>
            <p className="text-sm font-black text-amber-300">交付物清单</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">打开就能用，发出去才有价值</h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-white/54" data-poster-reveal>
            每一类素材都围绕真实展业动作设计，不只是展示效果，而是帮助客户理解、咨询和转发。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {deliverables.map(([title, body], index) => (
            <article key={title} className="rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7" data-poster-reveal data-poster-tilt>
              <span className="baox-stat-value text-5xl font-black text-amber-300/90">0{index + 1}</span>
              <h3 className="mt-8 text-2xl font-black">{title}</h3>
              <p className="mt-4 text-base leading-7 text-white/52">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div data-poster-reveal>
            <p className="text-sm font-black text-amber-300">出图流程</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">想改就改，不改也能直接发</h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-white/54" data-poster-reveal>
            海报模板已经完成版式、视觉和基础文案整理，轻量编辑后可发布，也可以直接下载用于日常展业。
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3" data-poster-reveal>
          {workflow.map(([Icon, title, body], index) => (
            <article key={title} className="relative min-h-[260px] rounded-[2.2rem] border border-white/10 bg-[#fff8ea] p-8 text-black shadow-[0_24px_80px_rgba(0,0,0,0.2)] sm:p-10" data-poster-tilt>
              <div className="flex items-start justify-between gap-6">
                <span className="text-sm font-black text-black/28">0{index + 1}</span>
                <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-2xl bg-amber-400 text-black shadow-[0_16px_40px_rgba(195,161,120,0.34)]">
                  <Icon size={26} />
                </span>
              </div>
              <h2 className="mt-12 text-3xl font-black tracking-tight">{title}</h2>
              <p className="mt-4 max-w-sm text-base leading-8 text-zinc-600">{body}</p>
              {index < workflow.length - 1 ? (
                <span className="absolute -right-7 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-amber-400 text-black shadow-xl lg:flex">
                  <ArrowRight size={18} />
                </span>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section id="cases" className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div data-poster-reveal>
            <p className="text-sm font-black text-amber-300">案例展示</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">让专业看得见</h2>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-bold text-white/58" data-poster-reveal>
            <ShieldCheck size={18} className="text-amber-300" />
            朋友圈、客户私聊、社群和活动页都可用
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {gallery.map(([category, image], index) => (
            <article
              key={image}
              className={`poster-gallery-item overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.045] hover:border-amber-300/35 ${index % 2 ? "md:translate-y-8" : ""}`}
            >
              <img src={image} alt={`${category}保险海报案例`} className="aspect-[3/4] w-full object-cover object-top" />
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch">
          <div className="rounded-[2.6rem] bg-[#F0E7DC] p-8 text-black sm:p-10" data-poster-reveal>
            <Target size={30} className="text-amber-700" />
            <h2 className="mt-8 text-4xl font-black leading-tight">适合这些保险从业者</h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">先让内容被看见，再让专业被理解。</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {audience.map(([title, body]) => (
              <article key={title} className="rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7" data-poster-reveal data-poster-tilt>
                <Users size={26} className="text-amber-300" />
                <h3 className="mt-9 text-2xl font-black">{title}</h3>
                <p className="mt-4 text-base leading-7 text-white/52">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 max-w-3xl" data-poster-reveal>
          <p className="text-sm font-black text-amber-300">真实使用用户评价</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">用户更相信看得见的专业</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map(([role, quote, scene]) => (
            <article key={role} className="min-h-[270px] rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7" data-poster-reveal>
              <div className="text-5xl leading-none text-amber-300">“</div>
              <p className="mt-6 text-lg font-black leading-8 text-white/82">{quote}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <p className="text-sm font-black text-amber-200">{role}</p>
                <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/48">{scene}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-8 text-center" data-poster-reveal>
          <p className="text-sm font-black text-amber-300">常见问题</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">发布前，你可能想知道</h2>
        </div>
        <div className="space-y-4">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group rounded-[1.8rem] border border-white/10 bg-white/[0.045] p-6" data-poster-reveal>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-black">
                {question}
                <BadgeCheck size={22} className="shrink-0 text-amber-300 transition group-open:rotate-12" />
              </summary>
              <p className="mt-5 text-base leading-8 text-white/54">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 pb-24 pt-18 sm:px-8">
        <div className="relative overflow-hidden rounded-[3rem] bg-[#F0E7DC] p-6 text-black sm:p-10 lg:p-12" data-poster-reveal>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_22%,rgba(104,119,137,0.18),transparent_30%),radial-gradient(circle_at_16%_18%,rgba(195,161,120,0.24),transparent_28%),linear-gradient(120deg,#F0E7DC_0%,#F5F2ED_55%,#E7EBEF_100%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black text-amber-700">开始使用</p>
              <h2 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                先把内容发出去，
                <span className="block">再让专业被看见。</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">
                海报模板可以直接下载发布，也可以按客户场景微调文案。先跑起来，再用大师课把选题、沟通和服务流程系统化。
              </p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-black text-zinc-700">
                {["成品可发", "文案可改", "团队可复用"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href="https://knowlens.ai/baox" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-black px-8 text-base font-black text-white transition hover:bg-zinc-900">
                打开海报工作台
                <ArrowRight size={18} />
              </Link>
              <Link href="/masterclass" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-black text-black shadow-sm transition hover:bg-zinc-100">
                查看保险大师课
                <MessageCircle size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </BaoxPageChrome>
  );
}
