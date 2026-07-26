import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, FlaskConical } from "lucide-react";
import { BaoxPageChrome } from "../BaoxPageChrome";

export const metadata: Metadata = {
  title: "学员作品集",
  description: "保罗万相AI保险大师课学员作品集，展示学员围绕保险产品研究、方案对比和客户沟通完成的实战页面。",
};

const labs = [
  ["增", "75款增额终身寿全维度对比", "增额寿", "一页看清长期现金价值、缴费节奏和适配场景，展业前快速筛选重点产品。", "2026年5月6日", "https://baox.ai/zengeshou.html", "/insurance/lab-cases/zengeshou.png"],
  ["年", "21款即期年金全维度对比", "即期年金", "聚焦领取时间、现金流节奏和适合人群，让年金沟通更容易讲清楚。", "2026年5月6日", "https://baox.ai/nianjin1.html", "/insurance/lab-cases/nianjin1.png"],
  ["养", "22款养老年金全维度对比", "养老年金", "把养老现金流、领取方式和长期确定性放在同一框架里比较。", "2026年5月6日", "https://baox.ai/nianjin2.html", "/insurance/lab-cases/nianjin2.png"],
  ["养", "39款老人专属养老年金全维度对比", "老人养老", "面向高龄客户的养老年金专题，快速识别可投边界和沟通重点。", "2026年5月6日", "https://baox.ai/oldnj.html", "/insurance/lab-cases/oldnj.png"],
  ["岁", "平安健康岁月长安", "产品解析", "拆解产品责任、亮点和适用人群，见客户前先把讲解逻辑理顺。", "2026年5月6日", "https://baox.ai/suiyuechangan.html", "/insurance/lab-cases/suiyuechangan.png"],
  ["星", "复星保德信星海赢家三版本对比", "版本对比", "同一产品多版本横向对照，帮助说明差异、优势和选择建议。", "2026年5月6日", "https://baox.ai/xhyj3.html", "/insurance/lab-cases/xhyj3.png"],
  ["青", "招商仁和青云卫6", "少儿重疾", "围绕少儿重疾保障责任和家庭配置逻辑，让方案沟通更清楚。", "2026年5月6日", "https://baox.ai/qingyunwei6.html", "/insurance/lab-cases/qingyunwei6.png"],
  ["快", "推荐三款3.75%-4.0%演示快返年金", "快返年金", "提前准备快返年金的现金流演示，把客户关注点讲得更直观。", "2026年5月6日", "https://baox.ai/kuaifan.html", "/insurance/lab-cases/kuaifan.png"],
] as const;

const metrics = [
  ["8", "学员作品"],
  ["5", "实战主题"],
  ["一页", "交付成果"],
] as const;

export default function LabPage() {
  return (
    <BaoxPageChrome active="/lab">
      <section className="baox-subhero relative overflow-hidden px-4 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(245,158,11,0.2),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.16),transparent_32%),linear-gradient(180deg,#12100b_0%,#070707_82%)]" />
        <div className="baox-subhero-grid relative mx-auto flex w-full max-w-[1280px] flex-col items-center justify-center text-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-5 py-2 text-sm font-black text-amber-200">
              <FlaskConical size={16} />
              往期优秀学员作品
            </p>
            <h1 className="baox-subhero-title mt-5 font-black tracking-tight sm:mt-6">
              往期优秀
              <span className="block text-amber-300">学员作品</span>
            </h1>
            <p className="baox-subhero-copy mx-auto max-w-3xl text-base leading-8 text-white/62 sm:text-lg">
              这些不是概念演示，而是AI保险大师课学员完成的真实作业。把增额寿、年金、重疾等复杂产品做成可展示、可转发、可讲解的专业页面。
            </p>
          </div>

          <div className="mt-6 w-full max-w-3xl sm:mt-7">
            <div className="grid overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.045] backdrop-blur-xl sm:grid-cols-3">
              {metrics.map(([value, label]) => (
                <div key={label} className="border-b border-white/10 px-6 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <div className="text-3xl font-black text-amber-300 sm:text-4xl">{value}</div>
                  <div className="mt-2 text-sm font-bold text-white/48">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="#lab-topics" className="baox-subhero-action inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-7 text-sm font-black text-black transition hover:bg-amber-300">
                查看学员作品
                <ArrowRight size={17} />
              </Link>
              <Link href="/masterclass" className="baox-subhero-action inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-black transition hover:bg-zinc-100">
                查看大师课
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="lab-topics" className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-8">
        <div className="mb-9 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black text-amber-300">学员实战成果</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">从课程训练，到可展示的展业页面</h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-white/54">
            学员围绕增额终身寿、即期年金、养老年金、少儿重疾与快返年金等主题完成交付，把产品研究、方案对比和客户沟通沉淀成能直接展示的页面。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {labs.map(([icon, title, category, desc, date, href, image]) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.045] text-white transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-white/[0.065]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#111]">
                <img src={image} alt={`${title}网页截图`} className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.035]" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/72 to-transparent" />
                <span className="absolute left-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-black shadow-[0_16px_38px_rgba(245,158,11,0.28)]">{icon}</span>
                <span className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/45 text-amber-300 backdrop-blur transition group-hover:bg-amber-400 group-hover:text-black">
                  <ArrowUpRight size={18} />
                </span>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200">{category}</span>
                <span className="text-sm font-bold text-white/38">{date}</span>
                </div>
                <h3 className="mt-5 text-2xl font-black leading-tight">{title}</h3>
                <p className="mt-4 text-base leading-7 text-white/52">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 pb-24 pt-14 sm:px-8">
        <div className="relative overflow-hidden rounded-[3rem] bg-[#fff5df] p-8 text-black sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_28%,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.24),transparent_28%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black text-amber-700">下一步</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                你也可以做出这样的保险展业作品。
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">
                AI保险大师课不只教工具，而是带你完成图文、海报、知识库、网页和客户沟通素材，把AI能力变成保险业务里的真实交付。
              </p>
            </div>
            <Link href="/masterclass" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-black px-8 text-base font-black text-white transition hover:bg-zinc-900">
              了解AI保险大师课
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </BaoxPageChrome>
  );
}
