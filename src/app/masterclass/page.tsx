import type { Metadata } from "next";
import Link from "next/link";
import type { ElementType } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  DatabaseZap,
  FileText,
  Globe2,
  Image as ImageIcon,
  Lightbulb,
  Megaphone,
  Mic2,
  MonitorPlay,
  Music2,
  Network,
  PenLine,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Table2,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { BaoxPageChrome } from "../BaoxPageChrome";

export const metadata: Metadata = {
  title: "AI保险大师课",
  description: "5天21+工具18+实战项目，从图文、视频、知识库、智能体到个人网站，构建完整AI保险工作流。",
};

const stats = [
  ["5", "天密集实战"],
  ["21+", "AI工具掌握"],
  ["18+", "实战项目"],
  ["1套", "完整AI工作流"],
] as const;

const values = [
  [FileText, "批量生产文章", "10分钟1000篇公众号文章，告别日更焦虑", "100倍", "内容产出效率提升"],
  [Video, "数字分身+短视频", "一个人就是一个内容团队，视频播客全搞定", "5种", "视频内容形态掌握"],
  [Brain, "智能知识库", "客户问什么，3秒给出专业解答", "3秒", "客户问题响应时间"],
  [Bot, "自动化工作流", "Agent智能体帮你干活，省出时间谈客户", "80%", "内容生产时间节省"],
] as const;

const curriculum = [
  {
    day: "DAY 01",
    title: "AI图文创作实战",
    meta: "6个工具 · 6个实战项目",
    intro: "掌握保险行业高质量图文内容的AI创作技术：批量生产文章、AI配图、信息图、早报、爆款定制，一站式搞定内容营销。",
    image: "/insurance/baox-original/images/01.jpg",
    tools: ["飞书+AI", "Gemini", "NotebookLM", "AI Studio", "Claude Code", "ChatGPT Image"],
    projects: [
      [Table2, "飞书多维表格 + AI", "文案批量生产", "10分钟生成1000篇保险科普文章", ["飞书多维表格AI功能介绍", "保险文章内容模板设计", "批量生成与内容优化技巧"]],
      [ImageIcon, "Gemini 图像生成", "图片创作", "个人品牌海报 + 小红书风格信息图", ["Gemini图像生成技能包介绍", "保险海报设计规范与风格选择", "图像生成参数调整技巧"]],
      [BookOpenCheck, "NotebookLM", "高质量信息图", "保险产品对比信息图", ["多模态处理能力", "保险数据可视化", "信息图布局与配色"]],
      [Sparkles, "AI Studio", "创意早报生成器", "保险科技日报模板", ["工作流程介绍", "保险新闻聚合策略", "早报内容自动排版"]],
      [Code2, "Claude Code", "爆款文章定制", "符合自己风格的保险文章", ["写作风格训练方法", "爆款文章结构分析", "个性化写作风格设置"]],
      [PenLine, "ChatGPT Image 2", "一句话生海报", "高密度中文内容海报", ["ChatGPT生图模型介绍", "商业海报提示词分析", "图像生成参数调整技巧"]],
    ],
  },
  {
    day: "DAY 02",
    title: "AI视频制作全方位",
    meta: "6个工具 · 6个实战项目",
    intro: "一个人就是一个内容团队：数字分身帮你出镜，AI帮你剪辑，播客帮你传播，音乐帮你造势。",
    image: "/insurance/baox-original/images/02.jpg",
    tools: ["即梦模板", "Seedance", "Coze AI播客", "Hera", "Suno", "声音模型"],
    projects: [
      [MonitorPlay, "即梦模板", "数字分身 · 产品讲解视频", "保险产品讲解数字分身视频", ["数字分身技术原理", "即梦模板使用方法", "保险场景数字分身应用"]],
      [Video, "Seedance", "保险宣传片 · 视觉风格优化", "制作保险服务宣传片", ["Seedance视频制作功能介绍", "保险宣传片脚本结构", "视觉风格与配音优化"]],
      [Mic2, "Coze AI播客", "音频内容 · 保险问答节目", "保险问答播客节目", ["AI播客制作流程", "保险话题策划", "声音风格与语速调整"]],
      [DatabaseZap, "Hera", "数据可视化 · 理赔分析短片", "理赔数据可视化短片", ["数据驱动视频制作", "理赔数据可视化呈现", "保险分析短视频脚本"]],
      [Music2, "Suno", "音乐生成 · 保险主题专辑", "保险品牌主题音乐", ["AI音乐生成提示词技巧", "保险品牌主题音乐创作", "短视频BGM自动匹配"]],
      [Mic2, "声音模型", "自定义播客", "制作批量产出播客的Skill", ["MiniMax Speech模型介绍", "Doubao语音播客模型介绍", "用WorkBuddy制作播客工作流"]],
    ],
  },
  {
    day: "DAY 03",
    title: "智能化展业工具",
    meta: "4个工具 · 4个实战项目",
    intro: "知识库是保险人的第二大脑：客户问什么，3秒给出专业解答，不再是翻资料找半天。",
    tools: ["NotebookLM", "IMA", "AnyGen", "Obsidian"],
    projects: [
      [BookOpenCheck, "NotebookLM", "多模态知识库", "保险产品知识库", ["多格式解析与自动摘要", "保险知识分类与标签", "多模态内容整合与PPT生成"]],
      [DatabaseZap, "IMA", "轻量化私域", "客户服务知识库", ["轻量化私域知识库搭建", "私域场景知识库设计", "快速搜索与内容推送"]],
      [Network, "AnyGen", "定制化智能", "保险理赔知识库", ["定制化功能优势", "保险场景知识库搭建", "智能问答系统配置"]],
      [Brain, "Obsidian", "AI时代专属", "个人知识管理系统", ["Obsidian + AI 集成", "保险知识网络构建", "自动关联与内容推荐"]],
    ],
  },
  {
    day: "DAY 04",
    title: "智能体 Agent 实战",
    meta: "4个模块 · 4个实战项目",
    intro: "AI智能体是保险人的超级助手：WorkBuddy多智能体协作、Codex代码自动化，让AI替你干活，真正实现一人即团队。",
    tools: ["WorkBuddy", "Codex", "Agent Skill", "工作流编排"],
    projects: [
      [Network, "模块一：WorkBuddy 多智能体协作", "Agent团队编排", "搭建保险内容生产Agent团队", ["WorkBuddy平台介绍与安装配置", "多Agent协作原理与任务分工", "保险场景Agent团队编排实战"]],
      [Code2, "模块二：Codex 编程智能体", "自然语言写代码", "自动生成保险客户数据看板", ["Codex CLI工具介绍与使用", "用自然语言指挥AI写代码", "保险数据处理脚本自动化生成"]],
      [Bot, "模块三：Agent 技能包开发", "保险专用技能包", "开发保险文章自动发布Skill", ["WorkBuddy Skill开发基础", "保险专用技能包设计与实现", "技能包调试与优化技巧"]],
      [DatabaseZap, "模块四：Agent 工作流编排", "端到端自动化", "端到端保险内容自动化管线", ["多Agent工作流设计与编排", "保险全流程自动化管线搭建", "定时任务与触发条件配置"]],
    ],
  },
  {
    day: "DAY 05",
    title: "搭建个人网站",
    meta: "4个模块 · 4个实战项目",
    intro: "保险人的数字名片：从域名到上线，亲手搭建属于自己的个人品牌网站，告别第三方平台依赖，打造专业线上形象。",
    image: "/insurance/baox-original/images/03.jpg",
    tools: ["云服务器", "Node.js + Nginx", "DNS + SSL", "网站发布"],
    projects: [
      [Server, "模块一：选择服务器", "云服务器选型", "选购并配置一台个人云服务器", ["云服务器对比与选型指南", "轻量应用服务器配置入门", "保险从业者建站场景分析"]],
      [Code2, "模块二：开发环境部署", "网站运行环境", "部署网站运行环境", ["服务器基础环境搭建", "Node.js + Nginx 安装配置", "Git 版本管理与代码同步"]],
      [Globe2, "模块三：域名解析", "DNS 与证书", "域名绑定与HTTPS配置", ["域名注册与选购技巧", "DNS解析原理与配置实操", "A记录/CNAME/SSL证书配置"]],
      [Rocket, "模块四：网站发布", "正式上线", "发布你的个人品牌网站", ["网站文件上传与部署", "Nginx反向代理与静态站点配置", "上线检查清单与持续维护"]],
    ],
  },
] as const;

const highlights = [
  ["100%", "实战驱动", "每个工具都有实战项目，学完就能用，不做纸上谈兵"],
  ["18+", "工具覆盖", "图文、视频、知识库、自动化，保险AI全链路工具一网打尽"],
  ["0", "编程门槛", "所有工具无需编程基础，配置即用，保险人友好设计"],
  ["5天", "密集交付", "5天从0到1构建完整AI保险工作流，快速出成果"],
  ["答疑", "社群陪伴", "专属社群答疑，长期陪伴成长，不是上完就散"],
  ["Agent", "智能体协作", "WorkBuddy + Codex多智能体协作，让AI Agent替你干活"],
] as const;

const audiences = [
  [ShieldCheck, "保险经纪人/代理人", "内容营销获客、知识库提效、自动化省时，AI是你最强的搭档"],
  [Users, "保险团队管理者", "给团队装备AI工具，整体效率提升，让每个人都成为超级个体"],
  [Megaphone, "保险公司营销人员", "批量生产营销内容，AI视频+播客打造品牌影响力"],
  [Lightbulb, "保险产品经理", "用AI加速产品研究、竞品分析、数据可视化，效率翻倍"],
  [Rocket, "对AI应用感兴趣的保险从业者", "不管你在保险行业哪个岗位，这门课让你从0到1掌握AI应用"],
] as const;

const resources = [
  [BookOpenCheck, "课件与代码", "课程配套课件、全部代码示例、工具配置模板"],
  [DatabaseZap, "案例库", "保险行业AI应用案例库、持续更新"],
  [FileText, "使用文档", "工具使用说明、操作指南、常见问题FAQ"],
  [Users, "社群答疑", "学员交流社群、专属答疑服务、长期陪伴成长"],
] as const;

const assessments = [
  [CheckCircle2, "实战作业", "每天实战作业完成情况，即学即练"],
  [Trophy, "作品展示", "课程项目作品展示，成果可视化"],
  [PenLine, "知识考核", "在线测验，检验工具掌握程度"],
  [Lightbulb, "心得分享", "学习心得与应用效果分享"],
] as const;

const studentReviews = [
  ["寿险顾问 · 王同学", "以前只是零散试工具，学完后知道每天内容怎么选题、怎么生成、怎么承接客户咨询。"],
  ["团队主管 · 李同学", "最有价值的是流程，不是单个工具。新人照着课程交付作业，团队素材和话术都能统一起来。"],
  ["保险经纪人 · 陈同学", "图文、视频、知识库和智能体串起来之后，感觉终于有了一套自己的AI展业系统。"],
  ["私域运营 · 周同学", "课程不是讲概念，每天都有实战项目，做出来的内容可以直接改成团队日常素材。"],
] as const;

export default function MasterclassPage() {
  return (
    <BaoxPageChrome active="/masterclass">
      <section className="baox-subhero relative isolate overflow-hidden px-4 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(245,158,11,0.24),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(20,184,166,0.14),transparent_28%),linear-gradient(180deg,#11100c_0%,#070707_78%)]" />
        <div className="baox-subhero-grid relative mx-auto grid w-full max-w-[1280px] gap-8 px-4 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div className="max-lg:mx-auto max-lg:text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-5 py-2 text-sm font-bold text-amber-200">
              <Sparkles size={16} />
              保险人专属 AI 实战课
            </div>
            <h1 className="baox-subhero-title mt-5 font-black tracking-tight sm:mt-6">
              AI保险
              <span className="block text-amber-300">大师课</span>
            </h1>
            <p className="baox-subhero-copy max-w-2xl text-lg font-semibold leading-8 text-white/72 sm:text-xl max-lg:mx-auto">实战演练，终身陪跑，人人都是AI保险大师。</p>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/50 max-lg:mx-auto">5天密集实战，从图文创作到全流程自动化，构建你的完整AI保险工作流。</p>
            <div className="baox-subhero-actions flex flex-col gap-3 sm:flex-row sm:gap-4 max-lg:justify-center">
              <Link href="#curriculum" className="baox-subhero-action inline-flex items-center justify-center gap-3 rounded-full bg-white px-7 text-base font-black text-black transition hover:bg-zinc-100">
                查看课程大纲
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
          <div className="relative lg:self-center">
            <div className="absolute -inset-4 bg-[radial-gradient(circle_at_46%_48%,rgba(245,158,11,0.18),transparent_42%),radial-gradient(circle_at_76%_78%,rgba(20,184,166,0.16),transparent_40%)] blur-3xl sm:-inset-8" />
            <img src="/insurance/landing/baox-masterclass-hero-shield-course.png" alt="保险大师课宣传图" className="baox-subhero-media relative aspect-video rounded-[1.5rem] object-cover shadow-[0_46px_130px_rgba(0,0,0,0.5)] sm:rounded-[2rem]" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 pb-10 sm:px-8">
        <div className="grid overflow-hidden rounded-[2.4rem] border border-white/10 bg-white/[0.04] md:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="border-b border-white/10 p-7 text-center md:border-b-0 md:border-r md:last:border-r-0">
              <p className="text-5xl font-black text-amber-300">{value}</p>
              <p className="mt-2 text-sm font-bold text-white/54">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-black text-amber-300">核心价值</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">5天掌握保险行业AI全链路能力</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {values.map(([Icon, title, body, metric, label]) => (
            <article key={title} className="rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7 transition hover:-translate-y-1 hover:border-amber-300/30">
              <Icon size={30} className="text-amber-300" />
              <h3 className="mt-8 text-2xl font-black">{title}</h3>
              <p className="mt-4 min-h-[4.2rem] text-base leading-7 text-white/52">{body}</p>
              <p className="mt-7 text-5xl font-black text-amber-300">{metric}</p>
              <p className="mt-2 text-sm font-bold text-white/36">{label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="overflow-hidden rounded-[3rem] border border-white/10 bg-white/[0.045] p-4">
          <img src="/insurance/baox-original/images/02.jpg" alt="BAOX.AI 工具包 V7" className="aspect-[16/7] w-full rounded-[2.3rem] object-cover object-top" />
        </div>
      </section>

      <section id="curriculum" className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-black text-amber-300">五天课程</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">每天一个主题，逐步构建完整能力</h2>
          </div>
          <p className="max-w-3xl text-lg leading-8 text-white/54">从图文到视频，从知识库到Agent，再到个人网站，把AI真正接入保险展业现场。</p>
        </div>
        <div className="space-y-10">
          {curriculum.map((day) => (
            <article key={day.day} className="overflow-hidden rounded-[2.8rem] border border-white/10 bg-[#11100d]">
              <div className="grid gap-0 xl:grid-cols-[0.7fr_1.3fr]">
                <div className="relative min-h-[360px] border-b border-white/10 p-8 sm:p-10 xl:border-b-0 xl:border-r">
                  <p className="text-sm font-black tracking-[0.18em] text-amber-300">{day.day}</p>
                  <h3 className="mt-5 text-4xl font-black tracking-tight">{day.title}</h3>
                  <p className="mt-2 text-sm font-bold text-white/38">{day.meta}</p>
                  <p className="mt-6 text-base leading-8 text-white/56">{day.intro}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {day.tools.map((tool) => (
                      <span key={tool} className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-bold text-white/62">
                        {tool}
                      </span>
                    ))}
                  </div>
                  {"image" in day && day.image ? (
                    <img src={day.image} alt={day.title} className="mt-8 aspect-video w-full rounded-[1.8rem] object-cover object-top" />
                  ) : null}
                </div>
                <div className="grid gap-px bg-white/10 md:grid-cols-2">
                  {day.projects.map(([Icon, title, type, result, bullets]) => (
                    <div key={title} className="min-h-[280px] bg-[#11100d] p-7">
                      <Icon size={26} className="text-amber-300" />
                      <h4 className="mt-6 text-xl font-black">{title}</h4>
                      <p className="mt-2 text-sm font-bold text-white/34">{type}</p>
                      <ul className="mt-5 space-y-2 text-sm leading-6 text-white/50">
                        {bullets.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 rounded-2xl border border-amber-300/18 bg-amber-300/8 px-4 py-3 text-sm font-bold text-amber-200">
                        实战：{result}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-black text-amber-300">课程亮点</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">6大核心优势，让每一分钟都有价值</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {highlights.map(([value, title, body]) => (
            <article key={title} className="rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7">
              <p className="inline-flex h-12 min-w-12 items-center justify-center rounded-2xl bg-amber-300/12 px-4 text-sm font-black text-amber-300">{value}</p>
              <h3 className="mt-8 text-2xl font-black">{title}</h3>
              <p className="mt-4 text-base leading-7 text-white/52">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.62fr_1.38fr]">
          <div className="rounded-[2.6rem] bg-[#fff5df] p-8 text-black sm:p-10">
            <Users size={30} className="text-amber-700" />
            <h2 className="mt-8 text-4xl font-black leading-tight">适合这些保险从业者</h2>
            <p className="mt-5 text-base leading-8 text-zinc-600">不管你在保险行业哪个岗位，AI都能帮你降本增效。</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {audiences.map(([Icon, title, body], index) => (
              <article key={title} className={`rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7 ${index === audiences.length - 1 ? "md:col-span-2" : ""}`}>
                <Icon size={28} className="text-amber-300" />
                <h3 className="mt-8 text-2xl font-black">{title}</h3>
                <p className="mt-4 text-base leading-7 text-white/52">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1280px] gap-6 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <ResourcePanel title="学习资源" subtitle="课程配套完整，学有所依" items={resources} />
        <ResourcePanel title="评估方式" subtitle="实战驱动，作品说话" items={assessments} />
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-black text-amber-300">学员评价</p>
          <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">学完以后，开始真正把AI用在展业里</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {studentReviews.map(([student, quote]) => (
            <article key={student} className="min-h-[260px] rounded-[2.2rem] border border-white/10 bg-white/[0.045] p-7">
              <div className="text-5xl leading-none text-amber-300">“</div>
              <p className="mt-6 text-lg font-black leading-8 text-white/82">{quote}</p>
              <p className="mt-8 text-sm font-black text-amber-200">{student}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-5 pb-24 pt-16 sm:px-8">
        <div className="relative overflow-hidden rounded-[3rem] bg-[#fff5df] p-8 text-black sm:p-12 lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_28%,rgba(20,184,166,0.16),transparent_28%),radial-gradient(circle_at_14%_18%,rgba(245,158,11,0.22),transparent_28%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black text-amber-700">5天 · 21+工具 · 18+实战项目</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                不是学AI，而是用AI。
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600">5天，从0到1，成为AI时代的保险超级个体。</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
              <Link href="https://knowlens.ai/baox" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-black px-8 text-base font-black text-white transition hover:bg-zinc-900">
                进入海报工作台
                <ArrowRight size={18} />
              </Link>
              <Link href="/about" className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-amber-400 px-8 text-base font-black text-black transition hover:bg-amber-300">
                了解保罗万相
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </BaoxPageChrome>
  );
}

type ResourcePanelProps = {
  title: string;
  subtitle: string;
  items: readonly (readonly [ElementType, string, string])[];
};

function ResourcePanel({ title, subtitle, items }: ResourcePanelProps) {
  return (
    <div className="rounded-[2.6rem] border border-white/10 bg-[#11100d] p-8 sm:p-10">
      <p className="text-sm font-black text-amber-300">{title}</p>
      <h2 className="mt-4 text-4xl font-black leading-tight">{subtitle}</h2>
      <div className="mt-8 grid gap-4">
        {items.map(([Icon, itemTitle, body]) => (
          <article key={itemTitle} className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-start gap-4">
              <Icon size={24} className="mt-1 shrink-0 text-amber-300" />
              <div>
                <h3 className="text-lg font-black">{itemTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-white/48">{body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
