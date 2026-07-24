import type { Metadata } from "next";
import { ExternalLink, Sparkles } from "lucide-react";
import { BaoxPageChrome } from "../BaoxPageChrome";

export const metadata: Metadata = {
  title: "AI工具包",
  description: "保险人常用 AI 工具集合，一键直达超省心。",
};

const groups = [
  {
    eyebrow: "OPENCLAW",
    title: "小龙虾",
    desc: "Agent 与技能市场入口，适合搭建自动化工作流。",
    tools: [
      ["OpenClaw", "官方小龙虾", "openclaw.jpg", "https://openclaw.ai/"],
      ["ClawHub", "官方 Skills 技能市场", "clawhub.jpg", "https://clawhub.ai/"],
      ["ArkClaw", "字节跳动的方舟小龙虾", "arkclaw.jpg", "https://www.volcengine.com/experience/ark?mode=claw"],
      ["WorkBuddy", "腾讯的 CodeBuddy 小龙虾", "workbuddy.jpg", "https://www.codebuddy.cn/work/"],
      ["QClaw", "腾讯的微信小龙虾", "qclaw.jpg", "https://qclaw.qq.com/"],
      ["MaxClaw", "Minimax 的性价比小龙虾", "maxclaw.jpg", "https://agent.minimaxi.com/"],
    ],
  },
  {
    eyebrow: "NO MAGIC",
    title: "不用魔法",
    desc: "国内可直达的高频 AI 工具，适合日常内容、知识库、图像和团队协作。",
    tools: [
      ["豆包", "字节跳动自研的旗舰级多模态大模型，兼具智能交互、深度理解与全场景适配能力。", "doubao.jpg", "https://www.doubao.com/chat/"],
      ["DeepSeek", "深度求索打造的国产标杆级通用 AI 大模型体系，可实现高效推理与低成本训练。", "ds.jpg", "https://www.deepseek.com/"],
      ["IMA", "腾讯推出的以知识库为核心的 AI 智能工作台，支持个性化知识管理。", "ima.jpg", "https://ima.qq.com/"],
      ["Kimi", "月之暗面 Moonshot AI 推出的旗舰级多模态大模型，性能对标国际顶尖模型。", "kimi.jpg", "https://www.kimi.com/"],
      ["飞书", "字节跳动推出的 AI 原生一站式企业协作与办公平台。", "feishu.jpg", "https://www.feishu.cn/"],
      ["即梦", "字节跳动旗下的一站式 AI 视觉创作平台，依托自研模型打造 AI 片场全流程工作流。", "jimeng.jpg", "https://jimeng.jianying.com/"],
      ["可灵", "快手自研的多模态创作平台，支持文 / 图生视频、视频续写及高清图像生成。", "keling.jpg", "https://app.klingai.com/"],
      ["扣子", "字节跳动推出的 AI 原生智能协作助手，深度融合飞书生态。", "coze.jpg", "https://www.coze.cn/"],
      ["元宝", "腾讯旗下混元 + DeepSeek 双模型驱动 C 端全能 AI 助手。", "yuanbao.jpg", "https://yuanbao.tencent.com/"],
      ["千问", "阿里巴巴旗下基于 Qwen 系列大模型打造的旗舰级 C 端全能 AI 助手。", "qianwen.jpg", "https://www.qianwen.com/"],
      ["文心", "百度文心大模型驱动的旗舰级原生全模态生成式 AI 助手。", "wenx.jpg", "https://yiyan.baidu.com/"],
      ["AIsoup Lab", "创意独立工具站，专注于将 AI 转化为真正创造价值的生产力。", "aisoup.jpg", "http://aisoup.ai/"],
    ],
  },
  {
    eyebrow: "NEED MAGIC",
    title: "需要魔法",
    desc: "海外创作、研究与多模态工具，适合进阶图像、视频、音乐和应用开发。",
    tools: [
      ["Gemini3", "谷歌旗舰级原生多模态大模型，主打深度推理与百万级上下文，高效处理多模态数据。", "gemini.jpg", "https://gemini.google.com/app"],
      ["Midjourney", "全球领先的 AI 图像生成工具，基于扩散模型实现文生图与多图创作。", "mj.jpg", "https://www.midjourney.com/"],
      ["ChatGPT", "OpenAI 推出的标杆式对话大模型，具备超强的自然语言理解与逻辑推理能力。", "chatgpt.jpg", "https://chatgpt.com/"],
      ["NotebookLM", "AI 智能研究笔记工具，主打专属知识库闭环交互，支持多格式多模态输入。", "notebooklm.jpg", "https://notebooklm.google/"],
      ["Hera", "AI 动效设计云端平台，支持文生专业级动态图形与动画，内置海量模板。", "hera.jpg", "https://hera.video/"],
      ["AnyGen", "字节跳动推出的 AI 办公协作平台，覆盖办公全链路并生成可编辑可交付的结构化成果。", "anygen.jpg", "https://www.anygen.io/"],
      ["Google AI Studio", "AI 集成开发平台，主打免费低代码 / 无代码体验，实现 AI 应用快速开发。", "aistudio.jpg", "https://aistudio.google.com/"],
      ["Sora", "OpenAI 推出的旗舰级 AI 视频与音频生成模型，同步生成音画与对话。", "sora.jpg", "https://openai.com/zh-Hans-CN/sora/"],
      ["Runway", "全球领先的 AI 多模态创意视频创作平台，支持文 / 图生专业级视频。", "runway.jpg", "https://runwayml.com/"],
      ["Grok", "xAI 打造的旗舰级多模态 AI 大模型，深度整合 X 平台实现实时联网检索。", "grok.jpg", "https://grok.com/"],
      ["Suno", "麻省理工团队打造的全球顶尖 AI 音乐创作平台，实现文 / 图 / 视频生完整歌曲。", "suno.jpg", "https://suno.com/home"],
      ["HeyGen", "全球领先的 AI 数字人视频创作平台，低门槛实现内容创建、本地化与个性化。", "heygen.jpg", "https://app.heygen.com/home"],
      ["Nano Banana", "谷歌打造的新一代 AI 图像编辑工具，零设计门槛即可实现专业级图像创作与修改。", "nano.jpg", "https://opennana.com/awesome-prompt-gallery"],
      ["Claude", "Anthropic 推出的旗舰级多模态大模型，具备超顶尖推理编码与多模态解析能力。", "claude.jpg", "https://claude.ai/"],
      ["Lovart", "Liblib 海外子公司研发的全球首个设计领域 AI 智能 Agent。", "lovart.jpg", "https://www.lovart.ai/zh"],
    ],
  },
] as const;

const asset = (name: string) => `/insurance/baox-original/images/${name}`;

export default function ToolPage() {
  return (
    <BaoxPageChrome active="/tool">
      <section className="relative overflow-hidden px-5 py-20 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.18),transparent_42%)]" />
        <div className="relative mx-auto max-w-[1500px] text-center">
          <p className="text-sm font-black tracking-[0.24em] text-amber-300">AI TOOLKIT</p>
          <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">AI工具包</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/58">保险人常用 AI 工具集合，一键直达超省心。</p>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.title} className="mx-auto w-full max-w-[1500px] px-5 py-12 sm:px-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black tracking-[0.18em] text-amber-300">{group.eyebrow}</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{group.title}</h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-white/50">{group.desc}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map(([title, body, image, href]) => (
              <article key={title} className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
                <div className="overflow-hidden bg-white/5">
                  <img src={asset(image)} alt={title} className="aspect-[2/1] w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-2xl font-black">{title}</h3>
                    <Sparkles size={18} className="mt-1 shrink-0 text-amber-300" />
                  </div>
                  <p className="mt-3 min-h-[3.4rem] text-sm leading-7 text-white/52">{body}</p>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-black text-black transition hover:bg-amber-300"
                  >
                    一键直达
                    <ExternalLink size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </BaoxPageChrome>
  );
}
