import type { Metadata } from "next";
import { BaoxPageChrome } from "../BaoxPageChrome";

export const metadata: Metadata = {
  title: "关于我们",
  description: "保罗万相是一家专注于智能保险科技的创新型企业。",
};

const team = [
  ["孔晶", "JAYDEN KONG", "jk.jpg", ["保罗万相创始人", "高级人工智能训练师", "COT全球寿险百万圆桌"]],
  ["俞璐", "RURU YU", "ruru.jpg", ["MDRT全球寿险百万圆桌", "RFP国际注册财务规划师", "前字节跳动设计总监"]],
  ["王斯瑶", "SHARON WANG", "siyao.jpg", ["MDRT全球寿险百万圆桌", "RFP国际注册财务规划师", "前互联网产品总监"]],
  ["潘玉婷", "JANICE PAN", "panyuting.png", ["MDRT全球寿险百万圆桌", "十年外资药企采购专家", "海外寿险专家"]],
  ["封韵灵", "OPHELIA FENG", "lingzi.jpg", ["英国高校海归硕士", "前美团体验设计师专家", "前字节体验设计师专家"]],
  ["卞琳彦", "GRACE BIAN", "ly.jpg", ["资深寿险专家", "前互联网金融产品总监", "前互联网交互设计专家"]],
  ["赵荷明", "HEMING ZHAO", "zhaoheming.png", ["复旦大学软件工程硕士", "资深人力资源专家", "资深连续创业合伙人"]],
  ["郭刘飞", "LIUFEI GUO", "guoliufei.png", ["资深大健康专家", "前头部新能源高级AI产品专家", "前阿里巴巴产品专家"]],
  ["戴异", "AURORA DAI", "daidai.jpg", ["RFP国际注册财务规划师", "武汉大学金融学本科", "前互联网运营经理"]],
  ["马安琪", "ELLA MA", "aq.jpg", ["资深寿险专家", "前互联网高级产品经理", "前互联网数据工程师"]],
  ["曾志华", "EHUA ZENG", "zengzhihua.png", ["资深寿险专家", "高级健康管理师", "前互联网数据架构师"]],
  ["程文顺", "VERSON CHENG", "ws.jpg", ["资深寿险专家", "金融产品专家", "WEB3产品经理"]],
] as const;

const asset = (name: string) => `/insurance/baox-original/images/${name}`;

export default function AboutPage() {
  return (
    <BaoxPageChrome active="/about">
      <section className="baox-simple-hero relative overflow-hidden px-5 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.18),transparent_42%)]" />
        <div className="relative mx-auto max-w-[1500px] text-center">
          <p className="text-sm font-black tracking-[0.24em] text-amber-300">ABOUT BAOX.AI</p>
          <h1 className="baox-simple-hero-title mt-5 font-black tracking-tight">
            关于<span className="text-amber-300">我们</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl font-semibold text-white/66">心有山海 ｜ 万相燎原</p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1500px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="rounded-[2.8rem] border border-white/10 bg-white/[0.045] p-8 sm:p-10">
          <p className="text-sm font-black tracking-[0.18em] text-amber-300">WANXIANG</p>
          <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">保罗万相</h2>
          <div className="mt-7 space-y-4 text-base leading-8 text-white/58">
            <p>保罗万相（BaoX）是一家专注于智能保险科技的创新型企业，致力于通过人工智能和大数据技术，为个人和企业客户提供专业、高效、透明的保险解决方案。</p>
            <p>我们相信，保险的本质是爱与责任。在数字化浪潮中，保罗万相坚持科技赋能与人文关怀并重，打造了一支由资深保险专家、AI产品专家、数据科学家和顶级设计师组成的精英团队。</p>
            <p>从智能投保、风险测评到理赔服务，我们全流程以客户需求为中心，让保险回归保障本源，让每一位客户都能享受到量身定制的保障方案。</p>
            <p>心有山海，万相燎原。保罗万相期待与您携手，共创美好未来。</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-[2.8rem] bg-white">
          <img src={asset("wanxiang.jpg")} alt="保罗万相" className="aspect-[4/3] w-full object-cover" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1500px] px-5 py-16 sm:px-8">
        <div className="mb-9 text-center">
          <p className="text-sm font-black tracking-[0.22em] text-amber-300">OUR TEAM</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">团队成员</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {team.map(([name, enName, image, lines]) => (
            <article key={name} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-white/[0.07]">
              <img src={asset(image)} alt={name} className="mx-auto h-24 w-24 rounded-full border border-amber-300/30 object-cover" />
              <h3 className="mt-5 text-xl font-black">{name}</h3>
              <p className="mt-1 text-xs font-black tracking-[0.18em] text-amber-300">{enName}</p>
              <div className="mt-4 space-y-1 text-sm leading-6 text-white/50">
                {lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1500px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="overflow-hidden rounded-[2.8rem] bg-white">
          <img src={asset("changjng003.jpg")} alt="保罗万相场景" className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="space-y-5 text-base leading-8 text-white/56">
          <p className="text-sm font-black tracking-[0.18em] text-amber-300">品牌愿景</p>
          <h2 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">用科技重塑保险服务体验</h2>
          <p>保罗万相致力于把人工智能、大数据能力与保险专业服务结合起来，为个人、家庭和企业客户提供更专业、更高效、更透明的保险解决方案。</p>
          <p>我们相信，保险的核心是爱与责任。数字化时代，科技不应取代人的温度，而应帮助保险从业者更清楚地表达价值、更稳定地服务客户。</p>
          <p>从风险评估、方案沟通到长期服务，保罗万相始终以客户需求为中心，让保险回归保障本源，也让每一次专业建议都更容易被看见、被理解、被信任。</p>
        </div>
      </section>
    </BaoxPageChrome>
  );
}
