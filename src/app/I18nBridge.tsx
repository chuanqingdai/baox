"use client";

import { useEffect, useState } from "react";

type Lang = "zh" | "en";

const STORAGE_KEY = "baox-lang";
const textOriginals = new WeakMap<Text, string>();

const seoCopy = {
  zh: {
    "/": {
      title: "保罗万相｜保险人的一站式AI引擎",
      description: "保罗万相面向保险从业者提供AI保险大师课、「展页」和AI工具包，帮助保险人用人工智能完成内容、获客、服务和成交。"
    },
    "/masterclass": {
      title: "AI保险大师课 · 保罗万相",
      description: "5天21+工具18+实战项目，从图文、视频、知识库、智能体到个人网站，构建完整AI保险工作流。"
    },
    "/poster": {
      title: "「展页」专业保险海报模版 · 保罗万相",
      description: "「展页」面向保险人高频展业场景，提供专业保险海报模版与出图能力，覆盖节气问候、保障科普、产品说明和客户服务。"
    },
    "/tool": {
      title: "AI工具包 · 保罗万相",
      description: "保险人常用AI工具集合，覆盖智能体、内容生成、研究分析、视觉创作与自动化工作流。"
    },
    "/lab": {
      title: "往期优秀学员作品 · 保罗万相",
      description: "保罗万相AI保险大师课学员作品集，展示学员围绕保险产品研究、方案对比和客户沟通完成的实战页面。"
    },
    "/about": {
      title: "关于我们 · 保罗万相",
      description: "保罗万相专注智能保险科技，帮助保险从业者用AI更清楚地表达价值、更稳定地服务客户。"
    }
  },
  en: {
    "/": {
      title: "BAOX.AI | The AI Engine for Insurance Advisors",
      description:
        "BAOX.AI brings together the AI Masterclass, ZhanYe poster platform, advisor tools, and student work to help insurance professionals create content, earn attention, and serve clients with AI."
    },
    "/masterclass": {
      title: "AI Insurance Masterclass | BAOX.AI",
      description:
        "A practical five-day AI masterclass for insurance advisors, built around real workflows for content, video, knowledge bases, agents, and client-ready deliverables."
    },
    "/poster": {
      title: "ZhanYe Poster Platform | BAOX.AI",
      description:
        "Create premium, ready-to-post insurance marketing posters with reusable templates for client education, product explanation, seasonal greetings, and campaigns."
    },
    "/tool": {
      title: "Advisor AI Toolkit | BAOX.AI",
      description:
        "A curated AI toolkit for insurance professionals, covering agents, content creation, research, visual production, and automation workflows."
    },
    "/lab": {
      title: "Student-Built Insurance Work | BAOX.AI",
      description:
        "Explore real deliverables built by AI Insurance Masterclass students, from product comparison pages to client-ready insurance sales assets."
    },
    "/about": {
      title: "About BAOX.AI | Insurance Intelligence",
      description:
        "BAOX.AI builds AI-powered insurance intelligence systems that help advisors communicate value, create better assets, and serve clients with clarity and trust."
    }
  }
} as const;

const dictionary: Record<string, string> = {
  "首页": "Home",
  "保险大师课": "Course",
  "展页": "ZhanYe",
  "工具包": "Tools",
  "作品集": "Works",
  "关于我们": "About",
  "保罗万相首页": "BAOX.AI Home",
  "了解保罗万相": "Explore BAOX.AI",
  "查看大师课": "Discover the Masterclass",
  "查看展页": "Explore ZhanYe",
  "上一个 banner": "Previous banner",
  "下一个 banner": "Next banner",
  "切换到保罗万相 BAOX": "Switch to BAOX.AI",
  "切换到AI保险大师课": "Switch to AI Insurance Masterclass",
  "切换到展页": "Switch to ZhanYe",
  "© 2026 保罗万相": "© 2026 BAOX.AI",
  "中": "CN",

  "保险人专属 AI 实战课": "Built for Modern Insurance Advisors",
  "AI保险": "AI-Powered",
  "大师课": "Masterclass",
  "实战演练，终身陪跑，人人都是AI保险大师。": "Hands-on training. Long-term support. Built to turn every advisor into an AI-powered performer.",
  "5天密集实战，从图文创作到全流程自动化，构建你的完整AI保险工作流。": "In five focused days, build a practical AI workflow for content, client conversations, and daily insurance growth.",
  "查看课程大纲": "See the 5-Day Blueprint",
  "天密集实战": "Days of Intensive Practice",
  "AI工具掌握": "AI Tools Covered",
  "实战项目": "Practice Projects",
  "完整AI工作流": "Complete AI Workflow",
  "核心价值": "Why It Works",
  "5天掌握保险行业AI全链路能力": "Build Your AI Growth System in Five Days",
  "批量生产文章": "Content at Scale",
  "10分钟1000篇公众号文章，告别日更焦虑": "Turn daily posting from a bottleneck into a repeatable content engine.",
  "内容产出效率提升": "Content Output Efficiency",
  "数字分身+短视频": "Avatar-Led Video",
  "一个人就是一个内容团队，视频播客全搞定": "Create the output of a content team without building one.",
  "视频内容形态掌握": "Video Formats",
  "智能知识库": "Advisor Knowledge OS",
  "客户问什么，3秒给出专业解答": "Turn scattered expertise into instant, client-ready answers.",
  "客户问题响应时间": "Response Time",
  "自动化工作流": "Agent Workflows",
  "Agent智能体帮你干活，省出时间谈客户": "Let agents handle the busywork while you stay focused on relationships.",
  "内容生产时间节省": "Time Saved",
  "五天课程": "The Five-Day Build",
  "每天一个主题，逐步构建完整能力": "Five Days. Five Systems. Real Output.",
  "从图文到视频，从知识库到Agent，再到个人网站，把AI真正接入保险展业现场。": "Move from content and video to knowledge bases, agents, and personal websites, all tied to real advisory work.",
  "课程亮点": "What Makes It Different",
  "6大核心优势，让每一分钟都有价值": "Designed for Advisors Who Need Results, Not Theory",
  "适合这些保险从业者": "Who This Is For",
  "不管你在保险行业哪个岗位，AI都能帮你降本增效。": "For insurance professionals who want sharper content, faster preparation, and more consistent client conversations.",
  "学习资源": "Learning Resources",
  "课程配套完整，学有所依": "Complete Supporting Materials",
  "评估方式": "Assessment",
  "实战驱动，作品说话": "Practice Driven, Results Proven",
  "学员评价": "Student Reviews",
  "学完以后，开始真正把AI用在展业里": "From Learning AI to Winning With AI",
  "5天 · 21+工具 · 18+实战项目": "5 Days · 21+ Tools · 18+ Projects",
  "不是学AI，而是用AI。": "Stop studying AI. Start shipping with it.",
  "5天，从0到1，成为AI时代的保险超级个体。": "Build the workflows, assets, and confidence to stand out in the AI era.",
  "进入海报工作台": "Open Poster Workspace",
  "实战：": "Practice:",
  "1套": "1 Set",
  "100倍": "100x",
  "5种": "5 Types",
  "3秒": "3 sec",
  "AI图文创作实战": "AI Article and Visual Creation",
  "6个工具 · 6个实战项目": "6 Tools · 6 Practice Projects",
  "掌握保险行业高质量图文内容的AI创作技术：批量生产文章、AI配图、信息图、早报、爆款定制，一站式搞定内容营销。": "Master AI techniques for high-quality insurance content: batch articles, AI visuals, infographics, newsletters, and viral-style posts in one practical workflow.",
  "飞书+AI": "Feishu + AI",
  "飞书多维表格 + AI": "Feishu Base + AI",
  "文案批量生产": "Batch Copywriting",
  "飞书多维表格AI功能介绍": "Feishu Base AI Features",
  "保险文章内容模板设计": "Insurance Article Template Design",
  "批量生成与内容优化技巧": "Batch Generation and Optimization",
  "实战： 10分钟生成1000篇保险科普文章": "Practice: Generate 1,000 Insurance Education Articles in 10 Minutes",
  "10分钟生成1000篇保险科普文章": "Generate 1,000 Insurance Education Articles in 10 Minutes",
  "Gemini 图像生成": "Gemini Image Generation",
  "图片创作": "Visual Creation",
  "Gemini图像生成技能包介绍": "Gemini Image Skill Pack",
  "保险海报设计规范与风格选择": "Insurance Poster Design Rules and Styles",
  "图像生成参数调整技巧": "Image Generation Parameter Tuning",
  "实战： 个人品牌海报 + 小红书风格信息图": "Practice: Personal Brand Poster + Social-Style Infographic",
  "个人品牌海报 + 小红书风格信息图": "Personal Brand Poster + Social-Style Infographic",
  "高质量信息图": "High-Quality Infographics",
  "多模态处理能力": "Multimodal Processing",
  "保险数据可视化": "Insurance Data Visualization",
  "信息图布局与配色": "Infographic Layout and Color",
  "实战： 保险产品对比信息图": "Practice: Insurance Product Comparison Infographic",
  "保险产品对比信息图": "Insurance Product Comparison Infographic",
  "创意早报生成器": "Creative Newsletter Generator",
  "工作流程介绍": "Workflow Overview",
  "保险新闻聚合策略": "Insurance News Aggregation",
  "早报内容自动排版": "Automated Newsletter Layout",
  "实战： 保险科技日报模板": "Practice: Insurtech Daily Newsletter Template",
  "保险科技日报模板": "Insurtech Daily Newsletter Template",
  "爆款文章定制": "High-Impact Article Customization",
  "写作风格训练方法": "Writing Style Training",
  "爆款文章结构分析": "Viral Article Structure Analysis",
  "个性化写作风格设置": "Personalized Writing Style Setup",
  "实战： 符合自己风格的保险文章": "Practice: Insurance Articles in Your Own Style",
  "符合自己风格的保险文章": "Insurance Articles in Your Own Style",
  "一句话生海报": "Poster from One Prompt",
  "ChatGPT生图模型介绍": "ChatGPT Image Model Overview",
  "商业海报提示词分析": "Commercial Poster Prompt Analysis",
  "实战： 高密度中文内容海报": "Practice: High-Density Chinese Content Poster",
  "高密度中文内容海报": "High-Density Chinese Content Poster",
  "AI视频制作全方位": "Full-Stack AI Video Production",
  "一个人就是一个内容团队：数字分身帮你出镜，AI帮你剪辑，播客帮你传播，音乐帮你造势。": "One person can run like a content team: avatars on camera, AI editing, podcasts for distribution, and music for branding.",
  "即梦模板": "Jimeng Templates",
  "Coze AI播客": "Coze AI Podcast",
  "声音模型": "Voice Models",
  "数字分身 · 产品讲解视频": "Digital Avatar · Product Explainer Video",
  "数字分身技术原理": "Digital Avatar Principles",
  "即梦模板使用方法": "How to Use Jimeng Templates",
  "保险场景数字分身应用": "Avatar Applications in Insurance",
  "实战： 保险产品讲解数字分身视频": "Practice: Digital Avatar Explainer for Insurance Products",
  "保险产品讲解数字分身视频": "Digital Avatar Explainer for Insurance Products",
  "保险宣传片 · 视觉风格优化": "Insurance Promo Video · Visual Style",
  "Seedance视频制作功能介绍": "Seedance Video Features",
  "保险宣传片脚本结构": "Insurance Promo Script Structure",
  "视觉风格与配音优化": "Visual Style and Voiceover Optimization",
  "实战： 制作保险服务宣传片": "Practice: Create an Insurance Service Promo Video",
  "制作保险服务宣传片": "Create an Insurance Service Promo Video",
  "音频内容 · 保险问答节目": "Audio Content · Insurance Q&A Show",
  "AI播客制作流程": "AI Podcast Production Workflow",
  "保险话题策划": "Insurance Topic Planning",
  "声音风格与语速调整": "Voice Style and Pace Tuning",
  "实战： 保险问答播客节目": "Practice: Insurance Q&A Podcast",
  "保险问答播客节目": "Insurance Q&A Podcast",
  "数据可视化 · 理赔分析短片": "Data Visualization · Claims Analysis Short Video",
  "数据驱动视频制作": "Data-Driven Video Production",
  "理赔数据可视化呈现": "Claims Data Visualization",
  "保险分析短视频脚本": "Insurance Analysis Short-Video Script",
  "实战： 理赔数据可视化短片": "Practice: Claims Data Visualization Short Video",
  "理赔数据可视化短片": "Claims Data Visualization Short Video",
  "音乐生成 · 保险主题专辑": "Music Generation · Insurance Brand Music",
  "AI音乐生成提示词技巧": "AI Music Prompting",
  "保险品牌主题音乐创作": "Insurance Brand Music Creation",
  "短视频BGM自动匹配": "Short-Video BGM Matching",
  "实战： 保险品牌主题音乐": "Practice: Insurance Brand Theme Music",
  "保险品牌主题音乐": "Insurance Brand Theme Music",
  "自定义播客": "Custom Podcast",
  "MiniMax Speech模型介绍": "MiniMax Speech Model",
  "Doubao语音播客模型介绍": "Doubao Voice Podcast Model",
  "用WorkBuddy制作播客工作流": "Build Podcast Workflows with WorkBuddy",
  "实战： 制作批量产出播客的Skill": "Practice: Build a Skill for Batch Podcast Production",
  "制作批量产出播客的Skill": "Build a Skill for Batch Podcast Production",
  "智能化展业工具": "Smart Insurance Sales Tools",
  "4个工具 · 4个实战项目": "4 Tools · 4 Practice Projects",
  "知识库是保险人的第二大脑：客户问什么，3秒给出专业解答，不再是翻资料找半天。": "A knowledge base is the advisor's second brain: answer clients in seconds without digging through documents.",
  "多模态知识库": "Multimodal Knowledge Base",
  "多格式解析与自动摘要": "Multi-Format Parsing and Summaries",
  "保险知识分类与标签": "Insurance Knowledge Taxonomy",
  "多模态内容整合与PPT生成": "Multimodal Content and PPT Generation",
  "实战： 保险产品知识库": "Practice: Insurance Product Knowledge Base",
  "保险产品知识库": "Insurance Product Knowledge Base",
  "轻量化私域": "Lightweight Private-Domain Knowledge Base",
  "轻量化私域知识库搭建": "Build a Lightweight Private-Domain KB",
  "私域场景知识库设计": "Private-Domain Knowledge Base Design",
  "快速搜索与内容推送": "Fast Search and Content Push",
  "实战： 客户服务知识库": "Practice: Client Service Knowledge Base",
  "客户服务知识库": "Client Service Knowledge Base",
  "定制化智能": "Customized Intelligence",
  "定制化功能优势": "Customized Capability Advantages",
  "保险场景知识库搭建": "Insurance Scenario Knowledge Base Setup",
  "智能问答系统配置": "Smart Q&A System Configuration",
  "实战： 保险理赔知识库": "Practice: Insurance Claims Knowledge Base",
  "保险理赔知识库": "Insurance Claims Knowledge Base",
  "AI时代专属": "Built for the AI Era",
  "Obsidian + AI 集成": "Obsidian + AI Integration",
  "保险知识网络构建": "Insurance Knowledge Network",
  "自动关联与内容推荐": "Automatic Linking and Recommendations",
  "实战： 个人知识管理系统": "Practice: Personal Knowledge Management System",
  "个人知识管理系统": "Personal Knowledge Management System",
  "智能体 Agent 实战": "AI Agent Practice",
  "4个模块 · 4个实战项目": "4 Modules · 4 Practice Projects",
  "AI智能体是保险人的超级助手：WorkBuddy多智能体协作、Codex代码自动化，让AI替你干活，真正实现一人即团队。": "AI agents are super assistants for insurance advisors: WorkBuddy multi-agent collaboration and Codex automation help one person operate like a team.",
  "工作流编排": "Workflow Orchestration",
  "模块一：WorkBuddy 多智能体协作": "Module 1: WorkBuddy Multi-Agent Collaboration",
  "Agent团队编排": "Agent Team Orchestration",
  "WorkBuddy平台介绍与安装配置": "WorkBuddy Setup and Configuration",
  "多Agent协作原理与任务分工": "Multi-Agent Collaboration and Task Roles",
  "保险场景Agent团队编排实战": "Agent Team Practice for Insurance Scenarios",
  "实战： 搭建保险内容生产Agent团队": "Practice: Build an Insurance Content Agent Team",
  "搭建保险内容生产Agent团队": "Build an Insurance Content Agent Team",
  "模块二：Codex 编程智能体": "Module 2: Codex Coding Agent",
  "自然语言写代码": "Code with Natural Language",
  "Codex CLI工具介绍与使用": "Codex CLI Overview and Usage",
  "用自然语言指挥AI写代码": "Direct AI Coding with Natural Language",
  "保险数据处理脚本自动化生成": "Automated Insurance Data Scripts",
  "实战： 自动生成保险客户数据看板": "Practice: Generate an Insurance Client Data Dashboard",
  "自动生成保险客户数据看板": "Generate an Insurance Client Data Dashboard",
  "模块三：Agent 技能包开发": "Module 3: Agent Skill Development",
  "保险专用技能包": "Insurance-Specific Skills",
  "WorkBuddy Skill开发基础": "WorkBuddy Skill Development Basics",
  "保险专用技能包设计与实现": "Design and Build Insurance-Specific Skills",
  "技能包调试与优化技巧": "Skill Debugging and Optimization",
  "实战： 开发保险文章自动发布Skill": "Practice: Build an Auto-Publishing Skill for Insurance Articles",
  "开发保险文章自动发布Skill": "Build an Auto-Publishing Skill for Insurance Articles",
  "模块四：Agent 工作流编排": "Module 4: Agent Workflow Orchestration",
  "端到端自动化": "End-to-End Automation",
  "多Agent工作流设计与编排": "Multi-Agent Workflow Design",
  "保险全流程自动化管线搭建": "Insurance Automation Pipeline Setup",
  "定时任务与触发条件配置": "Scheduled Tasks and Trigger Setup",
  "实战： 端到端保险内容自动化管线": "Practice: End-to-End Insurance Content Automation Pipeline",
  "端到端保险内容自动化管线": "End-to-End Insurance Content Automation Pipeline",
  "搭建个人网站": "Build a Personal Website",
  "保险人的数字名片：从域名到上线，亲手搭建属于自己的个人品牌网站，告别第三方平台依赖，打造专业线上形象。": "Create your digital business card: from domain to launch, build your personal brand website and reduce reliance on third-party platforms.",
  "云服务器": "Cloud Server",
  "网站发布": "Website Launch",
  "模块一：选择服务器": "Module 1: Choose a Server",
  "云服务器选型": "Cloud Server Selection",
  "云服务器对比与选型指南": "Cloud Server Comparison and Selection",
  "轻量应用服务器配置入门": "Lightweight Server Setup",
  "保险从业者建站场景分析": "Website Scenarios for Insurance Professionals",
  "实战： 选购并配置一台个人云服务器": "Practice: Select and Configure a Personal Cloud Server",
  "选购并配置一台个人云服务器": "Select and Configure a Personal Cloud Server",
  "模块二：开发环境部署": "Module 2: Deploy the Development Environment",
  "网站运行环境": "Website Runtime Environment",
  "服务器基础环境搭建": "Basic Server Environment Setup",
  "Node.js + Nginx 安装配置": "Node.js + Nginx Installation and Configuration",
  "Git 版本管理与代码同步": "Git Version Control and Code Sync",
  "实战： 部署网站运行环境": "Practice: Deploy the Website Runtime",
  "部署网站运行环境": "Deploy the Website Runtime",
  "模块三：域名解析": "Module 3: Domain Resolution",
  "DNS 与证书": "DNS and SSL",
  "域名注册与选购技巧": "Domain Registration and Selection",
  "DNS解析原理与配置实操": "DNS Principles and Configuration",
  "A记录/CNAME/SSL证书配置": "A Record, CNAME, and SSL Setup",
  "实战： 域名绑定与HTTPS配置": "Practice: Bind Domain and Configure HTTPS",
  "域名绑定与HTTPS配置": "Bind Domain and Configure HTTPS",
  "模块四：网站发布": "Module 4: Website Launch",
  "正式上线": "Go Live",
  "网站文件上传与部署": "Upload and Deploy Website Files",
  "Nginx反向代理与静态站点配置": "Nginx Reverse Proxy and Static Site Setup",
  "上线检查清单与持续维护": "Launch Checklist and Ongoing Maintenance",
  "实战： 发布你的个人品牌网站": "Practice: Launch Your Personal Brand Website",
  "发布你的个人品牌网站": "Launch Your Personal Brand Website",
  "实战驱动": "Practice Driven",
  "每个工具都有实战项目，学完就能用，不做纸上谈兵": "Every tool is tied to a practical project, so you can use it immediately.",
  "工具覆盖": "Tool Coverage",
  "图文、视频、知识库、自动化，保险AI全链路工具一网打尽": "Articles, videos, knowledge bases, automation, and the full insurance AI workflow.",
  "编程门槛": "Coding Barrier",
  "所有工具无需编程基础，配置即用，保险人友好设计": "No coding background required. Configure and use with insurance-friendly workflows.",
  "5天": "5 Days",
  "密集交付": "Intensive Delivery",
  "5天从0到1构建完整AI保险工作流，快速出成果": "Build a complete AI insurance workflow from zero to one in five days.",
  "答疑": "Q&A",
  "社群陪伴": "Community Support",
  "专属社群答疑，长期陪伴成长，不是上完就散": "Dedicated community Q&A and long-term support after the course.",
  "智能体协作": "Agent Collaboration",
  "WorkBuddy + Codex多智能体协作，让AI Agent替你干活": "WorkBuddy + Codex multi-agent workflows that let AI handle real tasks.",
  "保险经纪人/代理人": "Insurance Brokers and Agents",
  "内容营销获客、知识库提效、自动化省时，AI是你最强的搭档": "Use AI for content acquisition, knowledge-base efficiency, and automation.",
  "保险团队管理者": "Insurance Team Leaders",
  "给团队装备AI工具，整体效率提升，让每个人都成为超级个体": "Equip teams with AI tools and turn every member into a high-output individual.",
  "保险公司营销人员": "Insurance Marketing Teams",
  "批量生产营销内容，AI视频+播客打造品牌影响力": "Produce marketing content at scale and build influence through AI video and podcasts.",
  "保险产品经理": "Insurance Product Managers",
  "用AI加速产品研究、竞品分析、数据可视化，效率翻倍": "Use AI to speed up product research, competitor analysis, and data visualization.",
  "对AI应用感兴趣的保险从业者": "Insurance Professionals Interested in AI",
  "不管你在保险行业哪个岗位，这门课让你从0到1掌握AI应用": "No matter your role, this course helps you apply AI from zero to one.",
  "课件与代码": "Slides and Code",
  "课程配套课件、全部代码示例、工具配置模板": "Course slides, code samples, and tool setup templates.",
  "案例库": "Case Library",
  "保险行业AI应用案例库、持续更新": "Continuously updated insurance AI case library.",
  "使用文档": "Documentation",
  "工具使用说明、操作指南、常见问题FAQ": "Tool guides, operating instructions, and FAQs.",
  "社群答疑": "Community Q&A",
  "学员交流社群、专属答疑服务、长期陪伴成长": "Student community, dedicated Q&A, and long-term support.",
  "实战作业": "Practice Assignments",
  "每天实战作业完成情况，即学即练": "Daily assignments that turn learning into practice.",
  "作品展示": "Work Showcase",
  "课程项目作品展示，成果可视化": "Course projects that make progress visible.",
  "知识考核": "Knowledge Checks",
  "在线测验，检验工具掌握程度": "Online quizzes to validate tool mastery.",
  "心得分享": "Reflection Sharing",
  "学习心得与应用效果分享": "Share learning reflections and application results.",
  "以前只是零散试工具，学完后知道每天内容怎么选题、怎么生成、怎么承接客户咨询。": "Before this, I only tried tools randomly. Now I know how to choose topics, generate content, and follow up with clients every day.",
  "寿险顾问 · 王同学": "Life Insurance Advisor · Student Wang",
  "最有价值的是流程，不是单个工具。新人照着课程交付作业，团队素材和话术都能统一起来。": "The most valuable part is the workflow, not any single tool. New team members can follow the assignments and align materials and scripts.",
  "团队主管 · 李同学": "Team Leader · Student Li",
  "图文、视频、知识库和智能体串起来之后，感觉终于有了一套自己的AI展业系统。": "Once articles, videos, knowledge bases, and agents were connected, I finally had my own AI selling system.",
  "保险经纪人 · 陈同学": "Insurance Broker · Student Chen",
  "课程不是讲概念，每天都有实战项目，做出来的内容可以直接改成团队日常素材。": "The course is not abstract. Every day has a practical project, and the output can become real team content.",
  "私域运营 · 周同学": "Private-Domain Operator · Student Zhou",

  "专业保险海报模版": "Premium Insurance Poster Templates",
  "专业海报，": "Ready-to-Post Campaigns,",
  "用「展页」轻松搞定": "Powered by “ZhanYe”",
  "做海报用「展页」，省心！面向保险人高频展业场景，把文案、画面和传播目的打包成可复用模板，快速产出专业素材。": "Create polished insurance marketing assets without starting from a blank canvas. ZhanYe packages strategy, copy, and visuals into reusable templates built for real advisory work.",
  "面向保险人高频展业场景，把文案、画面和传播目的打包成可复用模板，快速产出专业素材。": "Built for recurring insurance marketing moments, with reusable templates that combine copy, visuals, and a clear communication goal.",
  "打开海报工作台": "Launch ZhanYe",
  "打开「展页」": "Open “ZhanYe”",
  "查看海报案例": "See Live Examples",
  "查看案例": "View Cases",
  "专业可靠": "Professional",
  "高效便捷": "Efficient",
  "一键下载": "One-Click Download",
  "多场景分享": "Multi-Channel Sharing",
  "保险场景模板": "Insurance Templates",
  "核心展业内容": "Core Selling Scenarios",
  "4类": "4 Types",
  "10类+": "10+ Types",
  "2分钟": "2 Minutes",
  "快速改文出图": "Edit and Export",
  "高清": "HD",
  "无水印下载": "Watermark-Free Download",
  "保险内容每天都能发": "Never Run Out of Client-Ready Content",
  "模板不是为了好看而好看，而是围绕客户沟通、信任建立和咨询承接来设计。": "Each template is designed to do more than look good: it opens conversations, builds trust, and supports follow-up.",
  "为什么保险人需要一套海报系统": "The Poster System Behind Consistent Visibility",
  "不是为了多一张图，而是为了让专业内容更稳定地出现、更容易被客户理解。": "This is not about more graphics. It is about showing up with clear, trusted insurance content again and again.",
  "问题": "Pain Point",
  "不知道发什么": "No Idea What to Post",
  "每天临时找选题，内容容易断更，也很难形成专业印象。": "Choosing topics at the last minute leads to inconsistent content and a weak professional image.",
  "海报系统解决": "Poster System Solution",
  "按保险场景直接选模板，节气、科普、产品、服务都有内容可发。": "Choose templates by insurance scenario: seasonal greetings, education, products, and service content are all ready.",
  "做图太耗时间": "Design Takes Too Long",
  "找图、排版、改字号，常常半小时过去还不满意。": "Finding images, adjusting layouts, and tweaking type can take half an hour with poor results.",
  "成熟版式直接复用，轻量改文后即可下载发布。": "Reuse polished layouts, make light copy edits, then download and publish.",
  "客户看不懂": "Clients Do Not Understand",
  "条款和方案太专业，单靠文字解释容易失去耐心。": "Terms and plans can be too technical; text-only explanations often lose attention.",
  "用画面先建立场景，再把保障重点讲得更直观。": "Use visuals to create context first, then explain protection points more clearly.",
  "团队难统一": "Hard to Align the Team",
  "每个人审美和表达不一致，新人很难快速跟上标准。": "Different visual styles and wording make it hard for new members to follow team standards.",
  "统一模板和内容框架，团队素材能复用、能沉淀。": "Standardize templates and content frameworks so team materials can be reused and improved.",
  "模板能力": "What ZhanYe Delivers",
  "不是图片库，是展业素材系统": "More Than Templates. A Marketing Asset System.",
  "从“今天发什么”到“发完如何承接”，让海报真正服务获客、沟通和长期服务。": "From what to post today to how to follow up after engagement, ZhanYe turns posters into a real advisory workflow.",
  "日常可发": "Ready for Daily Posting",
  "节日、节气、早晚安、客户关怀，让账号保持稳定出现。": "Festivals, seasonal greetings, morning/evening posts, and client care keep your account visible.",
  "专业可信": "Professional and Trustworthy",
  "医疗、重疾、意外、养老等保险主题，表达更像专业顾问。": "Medical, critical illness, accident, and retirement topics are framed like professional advice.",
  "便于沟通": "Easy to Discuss",
  "画面先讲清需求，再承接私聊、咨询、配置和服务。": "Visuals clarify needs first, then lead into chats, consultations, planning, and service.",
  "团队复用": "Team Reuse",
  "统一模板、统一表达，新人也能快速跟上团队内容标准。": "Unified templates and expression help new members match the team's content standards.",
  "交付物清单": "What You Get",
  "打开就能用，发出去才有价值": "Built to Be Published, Not Just Previewed",
  "每一类素材都围绕真实展业动作设计，不只是展示效果，而是帮助客户理解、咨询和转发。": "Every content type is mapped to a real business action: educate, explain, invite, remind, and convert.",
  "场景模板库": "Scenario Template Library",
  "覆盖节气问候、保障科普、产品说明、家庭配置、客户服务和活动邀约。": "Covers seasonal greetings, education, product explanations, family planning, client service, and event invitations.",
  "可发布海报": "Publishable Posters",
  "成品图可直接保存，适合朋友圈、客户私聊、社群和活动预热。": "Finished posters can be saved directly for Moments, private chats, groups, and event warm-ups.",
  "可改文案框架": "Editable Copy Framework",
  "标题、卖点、行动引导都可以按客户场景做轻量调整。": "Titles, selling points, and calls to action can be lightly adjusted for each client scenario.",
  "团队素材标准": "Team Content Standard",
  "新人照着发，团队统一表达，管理者更容易做内容复盘。": "New members can post from templates, teams stay aligned, and managers can review content more easily.",
  "案例展示": "Template Gallery",
  "让专业看得见": "Make Expertise Instantly Visible",
  "朋友圈、客户私聊、社群和活动页都可用": "Works for Moments, private chats, communities, and event pages.",
  "先让内容被看见，再让专业被理解。": "Let content be seen first, then let expertise be understood.",
  "保险经纪人": "Insurance Broker",
  "每天需要稳定发内容，想让客户更快看懂保障价值。": "Needs consistent daily content that helps clients understand protection value faster.",
  "团队管理者": "Team Leader",
  "需要统一新人素材标准，让团队出图和表达更可复制。": "Needs standardized materials so team visuals and messaging become repeatable.",
  "私域运营": "Private-Domain Operator",
  "需要节气、活动、科普、服务素材持续承接客户触点。": "Needs seasonal, event, education, and service content to maintain client touchpoints.",
  "真实使用用户评价": "What Advisors Are Saying",
  "用户更相信看得见的专业": "When Expertise Looks Clear, Clients Pay Attention",
  "以前每天最怕想选题，现在看到模板就知道今天能发什么。节气问候和保障科普发出去后，客户更愿意点开看。": "I used to worry about topics every day. Now templates tell me exactly what to post, and clients are more willing to open seasonal and education posts.",
  "上海 · 保险经纪人": "Shanghai · Insurance Broker",
  "用于朋友圈日更": "For Daily Moments Posts",
  "新人不用再从零设计海报，先按模板发起来，再逐步训练文案表达。团队素材质量比以前稳定很多。": "New members no longer design from scratch. They start with templates, then gradually improve copy. Team content quality is much more stable.",
  "杭州 · 团队主管": "Hangzhou · Team Leader",
  "用于新人训练": "For New Member Training",
  "活动预热、科普解释、服务提醒都能接上，素材周转明显快了。最关键是能直接保存发布。": "Event warm-ups, education posts, and service reminders all connect. Material turnaround is much faster, and direct download matters most.",
  "深圳 · 私域运营": "Shenzhen · Private-Domain Operator",
  "用于社群运营": "For Community Operations",
  "产品说明类海报很适合发给客户做预沟通，正式见面前客户已经知道大概重点，沟通效率更高。": "Product explanation posters work well before client meetings, so clients already understand the basics and discussions become more efficient.",
  "南京 · 寿险顾问": "Nanjing · Life Insurance Advisor",
  "用于客户私聊": "For Private Client Chats",
  "我不擅长设计，直接下载就能发。需要个性化时只改标题和时间，几分钟就能出一张。": "I am not good at design, but I can download and post directly. When I need customization, I only change the title and time.",
  "成都 · 保险代理人": "Chengdu · Insurance Agent",
  "用于日常展业": "For Daily Selling",
  "我们更需要统一表达，而不是每个人随便做图。模板库能让团队内容看起来更专业。": "We need consistent expression, not random graphics from everyone. The template library makes team content look more professional.",
  "广州 · 营销负责人": "Guangzhou · Marketing Lead",
  "用于团队素材库": "For Team Content Library",
  "常见问题": "FAQ",
  "发布前，你可能想知道": "Before Publishing, You May Want to Know",
  "这些海报适合直接发布吗？": "Are these posters ready to publish?",
  "适合。页面展示的是面向保险展业场景整理的成品方向，进入工作台后可以按自己的客户、产品和场景调整文案。": "Yes. They are designed for insurance selling scenarios, and you can adjust the copy by client, product, and context in the workspace.",
  "是否只能做朋友圈海报？": "Are they only for Moments?",
  "不只是朋友圈，也适合客户私聊、社群、活动预热、服务提醒和团队素材库沉淀。": "No. They also work for private client chats, communities, event warm-ups, service reminders, and team content libraries.",
  "和大师课是什么关系？": "How is this related to the masterclass?",
  "保险海报负责快速交付可发布素材，大师课负责训练选题、文案、沟通、知识库和团队复用方法。": "ZhanYe helps deliver publishable materials quickly, while the masterclass trains topic selection, copywriting, communication, knowledge bases, and team reuse.",
  "开始使用": "Start Creating",
  "先把内容发出去，": "Ship Your First Campaign,",
  "再让专业被看见。": "Then Build the System Behind It.",
  "海报模板可以直接下载发布，也可以按客户场景微调文案。先跑起来，再用大师课把选题、沟通和服务流程系统化。": "Start with ready-to-post assets, then use the masterclass to turn topic planning, client communication, and service follow-up into a repeatable growth system.",
  "成品可发": "Ready to Publish",
  "文案可改": "Editable Copy",
  "团队可复用": "Reusable by Teams",
  "查看保险大师课": "View AI Insurance Masterclass",
  "高频场景": "High-Frequency Scenarios",
  "不用从零设计，先选一个能发的场景。": "Start from a ready-to-use scenario instead of designing from scratch.",
  "节气问候": "Seasonal Greetings",
  "节日、节气、早安问候，让朋友圈保持温度。": "Seasonal and daily greetings that keep your social presence warm.",
  "保障科普": "Insurance Education",
  "把医疗险、重疾险、意外险讲得更容易懂。": "Explain medical, critical illness, and accident insurance clearly.",
  "产品说明": "Product Explanation",
  "用结构化画面讲清投保重点、配置逻辑和风险提示。": "Use structured visuals to explain product priorities and risks.",
  "家庭配置": "Family Planning",
  "围绕父母、孩子、养老、教育等场景建立需求感。": "Build demand around parents, children, retirement, and education.",
  "客户服务": "Client Service",
  "续保、理赔、保单检视，用专业内容承接服务。": "Support renewals, claims, and policy reviews with professional content.",
  "活动邀约": "Event Invitation",
  "沙龙、直播、咨询活动预热，帮客户更快理解主题。": "Warm up salons, livestreams, and consultation events.",
  "出图流程": "Creation Flow",
  "想改就改，不改也能直接发": "Edit if needed. Publish directly if not.",
  "海报模板已经完成版式、视觉和基础文案整理，轻量编辑后可发布，也可以直接下载用于日常展业。": "Templates already include layouts, visuals, and base copy. Edit lightly or download directly for daily selling.",
  "选模板": "Choose Template",
  "先按节气、科普、产品、服务等场景选择海报。": "Pick a poster by seasonal, education, product, or service scenario.",
  "可改文案": "Editable Copy",
  "需要个性化时，替换标题、日期、客户场景和行动引导。": "Customize titles, dates, client scenarios, and calls to action.",
  "直接下载": "Download Directly",
  "不想改也可以直接保存发布，用于朋友圈、社群和客户私聊。": "Save and publish directly for Moments, groups, and private chats.",
  "真实使用反馈": "Real User Feedback",
  "从日常展业到团队素材库，展页帮助保险人把内容交付变得更稳定。": "From daily selling to team content libraries, ZhanYe makes content delivery more consistent.",
  "下一步": "Next Step",
  "选择一个模板，马上生成第一张海报。": "Choose a template and create your first poster.",

  "AI TOOLKIT": "AI TOOLKIT",
  "AI工具包": "The Advisor AI Toolkit",
  "保险人常用 AI 工具集合，一键直达超省心。": "A curated launchpad for the AI tools insurance professionals actually use to create, research, automate, and serve clients.",
  "智能体": "Agent Workbench",
  "智能体、技能市场与自动化工作流入口，适合把重复任务交给AI执行。": "Agent platforms and workflow systems for turning repetitive advisory work into repeatable automation.",
  "不用魔法": "Everyday AI Stack",
  "国内可直达的高频 AI 工具，适合日常内容、知识库、图像和团队协作。": "Reliable tools for daily content, knowledge work, visual creation, and team collaboration.",
  "需要魔法": "Global Creative Stack",
  "海外创作、研究与多模态工具，适合进阶图像、视频、音乐和应用开发。": "Advanced global tools for visual direction, video, research, music, and AI application development.",
  "一键直达": "Open",
  "智能体工作流平台": "AI Agent Workflow Platform",
  "官方 Skills 技能市场": "Official Skills Marketplace",
  "字节跳动方舟智能体体验": "ByteDance Ark Agent Experience",
  "腾讯 CodeBuddy 智能协作助手": "Tencent CodeBuddy Collaboration Assistant",
  "腾讯微信智能体工具": "Tencent WeChat Agent Tool",
  "Minimax 智能体平台": "Minimax Agent Platform",
  "豆包": "Doubao",
  "字节跳动自研的旗舰级多模态大模型，兼具智能交互、深度理解与全场景适配能力。": "ByteDance's flagship multimodal model for intelligent interaction, deep understanding, and broad scenario coverage.",
  "深度求索打造的国产标杆级通用 AI 大模型体系，可实现高效推理与低成本训练。": "A leading general-purpose AI model system from DeepSeek, known for efficient reasoning and cost-effective training.",
  "腾讯推出的以知识库为核心的 AI 智能工作台，支持个性化知识管理。": "Tencent's AI workspace centered on knowledge bases and personalized knowledge management.",
  "月之暗面 Moonshot AI 推出的旗舰级多模态大模型，性能对标国际顶尖模型。": "Moonshot AI's flagship multimodal model, benchmarked against leading global models.",
  "飞书": "Feishu",
  "字节跳动推出的 AI 原生一站式企业协作与办公平台。": "ByteDance's AI-native enterprise collaboration and office platform.",
  "即梦": "Jimeng",
  "字节跳动旗下的一站式 AI 视觉创作平台，依托自研模型打造 AI 片场全流程工作流。": "ByteDance's AI visual creation platform for end-to-end creative production workflows.",
  "可灵": "Kling",
  "快手自研的多模态创作平台，支持文 / 图生视频、视频续写及高清图像生成。": "Kuaishou's multimodal creation platform for text/image-to-video, video continuation, and HD image generation.",
  "扣子": "Coze",
  "字节跳动推出的 AI 原生智能协作助手，深度融合飞书生态。": "ByteDance's AI-native collaboration assistant deeply integrated with Feishu.",
  "元宝": "Yuanbao",
  "腾讯旗下混元 + DeepSeek 双模型驱动 C 端全能 AI 助手。": "Tencent's consumer AI assistant powered by Hunyuan and DeepSeek models.",
  "千问": "Qianwen",
  "阿里巴巴旗下基于 Qwen 系列大模型打造的旗舰级 C 端全能 AI 助手。": "Alibaba's flagship consumer AI assistant based on the Qwen model family.",
  "文心": "Wenxin",
  "百度文心大模型驱动的旗舰级原生全模态生成式 AI 助手。": "Baidu's flagship multimodal generative AI assistant powered by ERNIE.",
  "创意独立工具站，专注于将 AI 转化为真正创造价值的生产力。": "An independent creative tool site focused on turning AI into practical productivity.",
  "谷歌旗舰级原生多模态大模型，主打深度推理与百万级上下文，高效处理多模态数据。": "Google's flagship native multimodal model for deep reasoning and million-token context.",
  "全球领先的 AI 图像生成工具，基于扩散模型实现文生图与多图创作。": "A leading AI image generation tool for text-to-image and multi-image creation.",
  "OpenAI 推出的标杆式对话大模型，具备超强的自然语言理解与逻辑推理能力。": "OpenAI's benchmark conversational AI with strong language understanding and reasoning.",
  "AI 智能研究笔记工具，主打专属知识库闭环交互，支持多格式多模态输入。": "An AI research notebook built around private knowledge-base interaction and multimodal inputs.",
  "AI 动效设计云端平台，支持文生专业级动态图形与动画，内置海量模板。": "A cloud-based AI motion design platform for professional graphics and animation templates.",
  "字节跳动推出的 AI 办公协作平台，覆盖办公全链路并生成可编辑可交付的结构化成果。": "ByteDance's AI office collaboration platform for editable, structured deliverables.",
  "AI 集成开发平台，主打免费低代码 / 无代码体验，实现 AI 应用快速开发。": "An AI development platform for low-code and no-code application building.",
  "全球领先的 AI 多模态创意视频创作平台，支持文 / 图生专业级视频。": "A leading AI multimodal video creation platform for professional text/image-to-video workflows.",
  "xAI 打造的旗舰级多模态 AI 大模型，深度整合 X 平台实现实时联网检索。": "xAI's flagship multimodal model with real-time web retrieval through X integration.",
  "麻省理工团队打造的全球顶尖 AI 音乐创作平台，实现文 / 图 / 视频生完整歌曲。": "A leading AI music creation platform for generating complete songs from prompts and media.",
  "全球领先的 AI 数字人视频创作平台，低门槛实现内容创建、本地化与个性化。": "A leading AI avatar video platform for content creation, localization, and personalization.",
  "谷歌打造的新一代 AI 图像编辑工具，零设计门槛即可实现专业级图像创作与修改。": "A next-generation AI image editing tool for professional creation and modification without design barriers.",
  "Anthropic 推出的旗舰级多模态大模型，具备超顶尖推理编码与多模态解析能力。": "Anthropic's flagship multimodal model for advanced reasoning, coding, and media understanding.",
  "Liblib 海外子公司研发的全球首个设计领域 AI 智能 Agent。": "A design-focused AI agent developed by Liblib's overseas team.",

  "往期优秀学员作品": "Student-Built Insurance Work",
  "往期优秀": "Real Student",
  "学员作品": "Deliverables",
  "这些不是概念演示，而是AI保险大师课学员完成的真实作业。把增额寿、年金、重疾等复杂产品做成可展示、可转发、可讲解的专业页面。": "Real masterclass assignments, built by students and shaped into client-facing pages for complex insurance topics.",
  "实战主题": "Business Themes",
  "一页": "One Page",
  "交付成果": "Deliverable",
  "查看学员作品": "View the Work",
  "学员实战成果": "Proof of Practice",
  "从课程训练，到可展示的展业页面": "From Classroom Practice to Client-Ready Pages",
  "学员围绕增额终身寿、即期年金、养老年金、少儿重疾与快返年金等主题完成交付，把产品研究、方案对比和客户沟通沉淀成能直接展示的页面。": "Students turn product research, plan comparison, and client communication into polished pages that can be shown, shared, and reused.",
  "你也可以做出这样的保险展业作品。": "Build Work Like This, Then Use It With Clients.",
  "AI保险大师课不只教工具，而是带你完成图文、海报、知识库、网页和客户沟通素材，把AI能力变成保险业务里的真实交付。": "The masterclass turns AI into tangible assets: articles, posters, knowledge bases, websites, and client communication materials.",
  "了解AI保险大师课": "Join the Masterclass",
  "增": "WL",
  "年": "AN",
  "养": "RT",
  "岁": "HL",
  "星": "VS",
  "青": "CI",
  "快": "FR",
  "增额寿": "Whole Life",
  "即期年金": "Immediate Annuity",
  "养老年金": "Retirement Annuity",
  "老人养老": "Senior Retirement",
  "产品解析": "Product Analysis",
  "版本对比": "Version Comparison",
  "少儿重疾": "Child Critical Illness",
  "快返年金": "Fast-Return Annuity",
  "2026年5月6日": "May 6, 2026",
  "75款增额终身寿全维度对比": "75 Whole Life Products Compared",
  "一页看清长期现金价值、缴费节奏和适配场景，展业前快速筛选重点产品。": "See long-term cash value, payment rhythm, and suitable scenarios on one page before client meetings.",
  "21款即期年金全维度对比": "21 Immediate Annuity Products Compared",
  "聚焦领取时间、现金流节奏和适合人群，让年金沟通更容易讲清楚。": "Focus on payout timing, cash-flow rhythm, and suitable users to make annuity communication clearer.",
  "22款养老年金全维度对比": "22 Retirement Annuity Products Compared",
  "把养老现金流、领取方式和长期确定性放在同一框架里比较。": "Compare retirement cash flow, payout methods, and long-term certainty in one framework.",
  "39款老人专属养老年金全维度对比": "39 Senior Retirement Annuity Products Compared",
  "面向高龄客户的养老年金专题，快速识别可投边界和沟通重点。": "A retirement annuity topic for senior clients, clarifying eligibility boundaries and discussion points.",
  "平安健康岁月长安": "Ping An Health Suiyue Changan",
  "拆解产品责任、亮点和适用人群，见客户前先把讲解逻辑理顺。": "Break down product coverage, highlights, and suitable users before client meetings.",
  "复星保德信星海赢家三版本对比": "Fosun Prudential Xinghai Winner: Three Versions Compared",
  "同一产品多版本横向对照，帮助说明差异、优势和选择建议。": "Compare multiple versions of one product to explain differences, advantages, and selection logic.",
  "招商仁和青云卫6": "China Merchants Renhe Qingyunwei 6",
  "围绕少儿重疾保障责任和家庭配置逻辑，让方案沟通更清楚。": "Explain child critical illness protection and family planning logic more clearly.",
  "推荐三款3.75%-4.0%演示快返年金": "Three Fast-Return Annuities with 3.75%-4.0% Illustrations",
  "提前准备快返年金的现金流演示，把客户关注点讲得更直观。": "Prepare fast-return annuity cash-flow illustrations to make client priorities more intuitive.",

  "关于": "Built for",
  "我们": "Insurance Intelligence",
  "心有山海 ｜ 万相燎原": "Human Trust, Amplified by AI",
  "保罗万相": "BAOX.AI",
  "保罗万相（BaoX）是一家专注于智能保险科技的创新型企业，致力于通过人工智能和大数据技术，为个人和企业客户提供专业、高效、透明的保险解决方案。": "BAOX.AI is an innovative insurtech company focused on intelligent insurance services, using AI and data technologies to provide professional, efficient, and transparent solutions.",
  "我们相信，保险的本质是爱与责任。在数字化浪潮中，保罗万相坚持科技赋能与人文关怀并重，打造了一支由资深保险专家、AI产品专家、数据科学家和顶级设计师组成的精英团队。": "We believe insurance is rooted in love and responsibility. In the digital era, BAOX.AI combines technology with human care through a team of insurance experts, AI product experts, data scientists, and designers.",
  "从智能投保、风险测评到理赔服务，我们全流程以客户需求为中心，让保险回归保障本源，让每一位客户都能享受到量身定制的保障方案。": "From intelligent application and risk assessment to claims service, we keep customer needs at the center and bring insurance back to protection.",
  "心有山海，万相燎原。保罗万相期待与您携手，共创美好未来。": "BAOX.AI looks forward to building a better future with you.",
  "团队成员": "The Team Behind BAOX.AI",
  "孔晶": "Jayden Kong",
  "保罗万相创始人": "Founder of BAOX.AI",
  "高级人工智能训练师": "Senior AI Trainer",
  "COT全球寿险百万圆桌": "COT, Million Dollar Round Table",
  "俞璐": "Ruru Yu",
  "MDRT全球寿险百万圆桌": "MDRT, Million Dollar Round Table",
  "RFP国际注册财务规划师": "RFP International Registered Financial Planner",
  "前字节跳动设计总监": "Former Design Director at ByteDance",
  "王斯瑶": "Sharon Wang",
  "前互联网产品总监": "Former Internet Product Director",
  "潘玉婷": "Janice Pan",
  "十年外资药企采购专家": "10 Years in Global Pharma Procurement",
  "海外寿险专家": "Overseas Life Insurance Specialist",
  "封韵灵": "Ophelia Feng",
  "英国高校海归硕士": "Master's Graduate from the UK",
  "前美团体验设计师专家": "Former Senior Experience Designer at Meituan",
  "前字节体验设计师专家": "Former Senior Experience Designer at ByteDance",
  "卞琳彦": "Grace Bian",
  "资深寿险专家": "Senior Life Insurance Specialist",
  "前互联网金融产品总监": "Former Internet Finance Product Director",
  "前互联网交互设计专家": "Former Internet Interaction Design Specialist",
  "赵荷明": "Heming Zhao",
  "复旦大学软件工程硕士": "M.S. in Software Engineering, Fudan University",
  "资深人力资源专家": "Senior Human Resources Specialist",
  "资深连续创业合伙人": "Senior Serial Entrepreneur Partner",
  "郭刘飞": "Liufei Guo",
  "资深大健康专家": "Senior Healthcare Specialist",
  "前头部新能源高级AI产品专家": "Former Senior AI Product Expert in New Energy",
  "前阿里巴巴产品专家": "Former Product Expert at Alibaba",
  "戴异": "Aurora Dai",
  "武汉大学金融学本科": "B.A. in Finance, Wuhan University",
  "前互联网运营经理": "Former Internet Operations Manager",
  "马安琪": "Ella Ma",
  "前互联网高级产品经理": "Former Senior Internet Product Manager",
  "前互联网数据工程师": "Former Internet Data Engineer",
  "曾志华": "Ehua Zeng",
  "高级健康管理师": "Senior Health Manager",
  "前互联网数据架构师": "Former Internet Data Architect",
  "程文顺": "Verson Cheng",
  "金融产品专家": "Financial Product Expert",
  "WEB3产品经理": "Web3 Product Manager",
  "品牌愿景": "Our Vision",
  "用科技重塑保险服务体验": "Make Insurance Advice Clearer, Faster, and More Trusted",
  "保罗万相致力于把人工智能、大数据能力与保险专业服务结合起来，为个人、家庭和企业客户提供更专业、更高效、更透明的保险解决方案。": "BAOX.AI brings together AI, data, and insurance expertise to help advisors deliver clearer recommendations and more confident client experiences.",
  "我们相信，保险的核心是爱与责任。数字化时代，科技不应取代人的温度，而应帮助保险从业者更清楚地表达价值、更稳定地服务客户。": "We believe technology should not replace trust. It should help advisors communicate value with more clarity, consistency, and care.",
  "从风险评估、方案沟通到长期服务，保罗万相始终以客户需求为中心，让保险回归保障本源，也让每一次专业建议都更容易被看见、被理解、被信任。": "From risk assessment to long-term service, BAOX.AI helps professional advice become easier to see, understand, and trust."
};

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh";
}

function preserveWhitespace(original: string, translated: string) {
  const prefix = original.match(/^\s*/)?.[0] ?? "";
  const suffix = original.match(/\s*$/)?.[0] ?? "";
  return `${prefix}${translated}${suffix}`;
}

function getSeoPath() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return path in seoCopy.zh ? (path as keyof typeof seoCopy.zh) : "/";
}

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  if (meta.getAttribute("content") === content) return;
  meta.setAttribute("content", content);
}

function syncSeo(lang: Lang) {
  const copy = seoCopy[lang][getSeoPath()];
  if (document.title !== copy.title) document.title = copy.title;

  upsertMeta('meta[name="description"]', "name", "description", copy.description);
  upsertMeta('meta[property="og:title"]', "property", "og:title", copy.title);
  upsertMeta('meta[property="og:description"]', "property", "og:description", copy.description);
  upsertMeta('meta[property="og:locale"]', "property", "og:locale", lang === "en" ? "en_US" : "zh_CN");
  upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", copy.title);
  upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", copy.description);
}

function translateDocument(lang: Lang) {
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.lang = lang;
  syncSeo(lang);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((node) => {
    const original = textOriginals.get(node) ?? node.textContent ?? "";
    if (!textOriginals.has(node)) textOriginals.set(node, original);
    const key = original.trim();
    node.textContent = lang === "en" && dictionary[key] ? preserveWhitespace(original, dictionary[key]) : original;
  });

  document.querySelectorAll<HTMLElement>("[aria-label], [alt], [title]").forEach((element) => {
    ["aria-label", "alt", "title"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      const dataKey = `i18nOriginal${attribute.replace(/[^a-z]/gi, "")}`;
      const original = element.dataset[dataKey] ?? value;
      element.dataset[dataKey] = original;
      element.setAttribute(attribute, lang === "en" && dictionary[original] ? dictionary[original] : original);
    });
  });
}

export function I18nBridge() {
  useEffect(() => {
    let current = getInitialLang();
    translateDocument(current);

    const observer = new MutationObserver(() => translateDocument(current));
    observer.observe(document.body, { childList: true, subtree: true });

    const headObserver = new MutationObserver(() => syncSeo(current));
    headObserver.observe(document.head, { attributes: true, childList: true, subtree: true });

    const onLangChange = (event: Event) => {
      current = (event as CustomEvent<Lang>).detail === "en" ? "en" : "zh";
      window.localStorage.setItem(STORAGE_KEY, current);
      translateDocument(current);
    };

    window.addEventListener("baox-language-change", onLangChange);
    return () => {
      observer.disconnect();
      headObserver.disconnect();
      window.removeEventListener("baox-language-change", onLangChange);
    };
  }, []);

  return null;
}

export function LanguageToggle() {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const initial = getInitialLang();
    setLang(initial);
    window.requestAnimationFrame(() => translateDocument(initial));
  }, []);

  const changeLang = (next: Lang) => {
    setLang(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    translateDocument(next);
    window.dispatchEvent(new CustomEvent("baox-language-change", { detail: next }));
  };

  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] p-1 text-xs font-black text-white/58 shadow-[0_12px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      {(["zh", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => changeLang(item)}
          className={`h-8 min-w-10 rounded-full px-3 transition ${
            lang === item ? "bg-amber-400 text-black shadow-[0_8px_22px_rgba(245,158,11,0.26)]" : "hover:bg-white/10 hover:text-white"
          }`}
          aria-label={item === "zh" ? "切换到中文" : "Switch to English"}
        >
          {item === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
