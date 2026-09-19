#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""组装「公子的活动量面板」。

设计要点（对齐 mianban skill）：
  · 样式层复用 CRM 面板的同一套设计系统源码（base.css / theme.css），
    保证「公子的活动量面板」与既有 CRM / GEO 面板视觉与框架一致；
    活动量专属规则单独成 panel.css，追加在最后 —— 其末尾的窄屏覆写因而
    位于整个样式表最末，符合同优先级「靠后写者胜」的铁律 6。
  · 零外链：FontAwesome 与 Chart.js 全部走本地 libs/ 相对路径（铁律 8）。
  · 构建双闸（静态四道 + 结构闸三道具名）：
      A. 内容断言 —— 关键结构 id / 主题切换器 / 版本徽章 / 取证接口必须在场，
                     且「重置」类静默破坏性删除必须缺席（铁律 15）；
      A2. 主题锚点唯一性 —— 静态挂载点只允许 <html> 一个，
                     运行期改主题只能经由 applyThemeAttr()（铁律 13）；
      A3. 动效门控 —— 凡隐藏 .fi 的规则必须带 html.anim-ready 前缀，
                     JS 失灵时不得白屏（铁律 1/3）；
      B. 语法门禁 —— 内联脚本先过 `node --check`，语法错不许出产物；
      B2. 顶层函数唯一 —— 后一个同名声明会静默覆盖前一个（铁律 10）；
      C. 图标反查 —— 产物里每个 fa-* 都回查本地 CSS，查不到即失败（铁律 9）；
      D. 数据断言 —— meta 计数与 days/weeks 实际长度一致，防「页面跑起来数不对」。
  · 运行期门禁（一道，静态门禁结构上拦不住它）：
      E. 运行期数据一致性 —— 计分与聚合存在「同一口径两份实现」：
         构建期 Python（src/expected.py）与运行期 JS（src/core.js）。
         二者一旦分叉，静态门禁全绿、页面不报错、图表照画，
         只是数字整体偏移且**静默**。本关在无痕浏览器里载入产物，
         取 window.__ACT_SNAPSHOT__()，与 Python 侧期望值逐值比对 ——
         总量、单日、单周、漏斗三段、KPI 文本，不是「条数相等」这种弱判定。
         ⚠️ v1.2 删掉「源表口径校验」后，本关的基准**降级**了：
         原先尚可拿源表「总」行当外部权威，如今只剩两份实现互比 ——
         抓得住分叉，抓不住两边一起错。这是删模块的真实代价，写在这里
         免得后人以为「本关通过 = 数字一定对」。
  · 产物流水：先写 _build_stage.html → 跑门禁 E → 全绿才改名落盘
    （门禁失败不留半成品，避免下次误开半成品页面）。

用法：
    python3 src/build.py            # 组装并跑全部门禁
    python3 src/build.py --no-gate  # 只组装（调试用）
"""
import datetime
import io
import json
import glob
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tokenize

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
OUT = os.path.join(ROOT, 'index.html')
STAGE = os.path.join(ROOT, '_build_stage.html')
ARCHIVE = os.path.join(ROOT, 'archive')
TMP = os.path.join(ROOT, '_tmp')
NODE = '/Users/jaydenkong/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'
NODE_PATH = '/Users/jaydenkong/.workbuddy/binaries/node/workspace/node_modules'

VERSION = 'v1.2'
TODAY = datetime.date.today().strftime('%y%m%d')



def _md5(path):
    with open(path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def check_archives(out_path, cur_version):
    """门禁 F · 归档不许冒充别的版本（铁律 17）。

    判据看**事实**、不看代码：某归档的 md5 等于当前产物，但它名字里的版本号
    不是当前版本 —— 说明它已被同名的另一次构建覆盖，名字在撒谎。

    为什么必须落在门禁里：覆盖发生时**没有任何其他信号** —— 不报错、文件名不变、
    archive/ 看上去一切正常。本轮实测就是 v1.1 的产物盖掉了 v1.0 的归档，
    直到拿 md5 对了一遍才发现。而归档一旦被覆盖就不可逆（本项目无 git、
    源文件原地改写），留着一个自称 v1.0 的 v1.1 文件，比没有归档更有害。

    ⚠️ 本函数**管不住产物**：它由落盘段在 `copyfile(STAGE, OUT)` **之后**调用，
    所以它报错时 index.html 已经写盘了。原先的报错文案写着「产物不落盘」，
    那是句假话 —— 一条说假话的构建日志，和一条不响的断言一样有害，
    故 v1.2c 把文案改成陈述事实（只拦归档，产物已写盘）。
    真要「归档不过就不落盘」，得把 copyfile 挪到本函数之后；
    但那会让「产物有效但归档待修」的场景无法产出，故不采取。
    """
    h_out = _md5(out_path)
    liars = []
    for f in sorted(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html'))):
        if _md5(f) != h_out:
            continue
        if cur_version not in os.path.basename(f):
            liars.append(os.path.basename(f))
    if liars:
        sys.exit('!! 门禁 F · 归档文件名与内容不符。\n'
                 '   以下归档的内容与当前产物逐字节相同，但名字里的版本不是 %s：\n'
                 '     %s\n'
                 '   说明它们已被同名构建覆盖过。请把它们改名到真实的版本号。\n'
                 '   ⚠️ 门禁 F 只拦归档：产物 %s 在调用本函数之前**已经写盘**，'
                 % (cur_version, '\n     '.join(liars), os.path.basename(out_path))
                 + '\n      别把这条消息读成「产物没落地」。')
    # v1.2c：归档集合应当是「若干个互不相同的版本形态」——
    # 两个归档内容逐字节相同，说明其中至少有一个的名字在声称一个并不存在的
    # 新形态。这是上面「不覆盖」策略的必然配套：只防覆盖、不防重复，
    # archive/ 会悄悄堆成同内容的副本（本轮实测：连跑两次构建即多出一份
    # 与既有归档完全相同的文件）。
    by_hash = {}
    for f in sorted(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html'))):
        by_hash.setdefault(_md5(f), []).append(os.path.basename(f))
    dups = {h: fs for h, fs in by_hash.items() if len(fs) > 1}
    if dups:
        lines = []
        for h, fs in sorted(dups.items()):
            lines.append('     %s… ← %s' % (h[:12], ' / '.join(fs)))
        sys.exit('!! 门禁 F · 归档集合里存在内容相同的副本。\n'
                 '   归档文件名是版本声明，内容相同的文件里必有一个名字在说谎。\n'
                 '%s\n'
                 '   处置：把多出来的那份**改名移出**（如移到 _tmp/retired/），'
                 '不要删除。\n'
                 '   ⚠️ 门禁 F 只拦归档：产物 %s 在调用本函数之前**已经写盘**，'
                 % ('\n'.join(lines), os.path.basename(out_path))
                 + '\n      修正归档后重跑即可，产物无需重建。')
    n = len(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html')))
    print('  ✅ 门禁 F · %d 个归档，无一个冒充别的版本、无内容重复' % n)



# ── 临时文件退役：改名归档，不做删除 ────────────────────────────────────────
# 为什么不直接 os.remove：WorkBuddy 注入的安全删除护栏（sitecustomize.py 的
# _safe_remove → _check_bulk_delete_guard）按「本轮累计删除数」计数，
# 越过阈值即 raise SystemExit(1)。而 SystemExit 继承 BaseException，
# 会穿透普通异常处理把调用方一起带走。
# 护栏一旦在构建途中触发，构建就是非 0 退出、整次同步失败 ——
# 而起因居然只是「清理一个临时文件」，这是极不划算的失败。
# 改名同样能让临时文件离开工作目录，且完全不触碰删除路径。
RETIRED = os.path.join(TMP, 'retired')


def retire(path):
    """把临时文件移出工作目录（改名，不删除）。返回新路径，失败返回 None。

    故意吞掉所有异常：退役是纯粹的卫生工作，绝不能反过来搞挂构建。
    """
    try:
        if not os.path.exists(path):
            return None
        os.makedirs(RETIRED, exist_ok=True)
        dst = os.path.join(RETIRED, os.path.basename(path))
        if os.path.exists(dst):
            dst = dst + '.' + datetime.datetime.now().strftime('%H%M%S')
        os.replace(path, dst)
        return dst
    except Exception:
        return None


def read(p):
    return io.open(p, encoding='utf-8').read()


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def main():
    no_gate = '--no-gate' in sys.argv

    # ---------- 读入各层 ----------
    # 顺序即加载顺序：设计系统骨架 → 主题 token → 专属组件 → 页面结构
    parts = {}
    for f in ('base.css', 'theme.css', 'panel.css', 'body.html',
              'data.js', 'core.js', 'app.js'):
        path = os.path.join(BASE, f)
        if not os.path.exists(path):
            sys.exit('!! 缺少源文件: %s' % path)
        parts[f] = read(path)

    data_path = os.path.join(ROOT, 'data', 'activity.json')
    if not os.path.exists(data_path):
        sys.exit('!! 缺少数据层: %s\n   请先运行: python3 src/gen_data.py' % data_path)
    DATA = json.loads(read(data_path))

    css = '\n'.join(parts[f] for f in ('base.css', 'theme.css', 'panel.css'))
    body = parts['body.html']
    # 三段脚本共处同一个 <script>、同一作用域，因此顶层函数唯一性要合并起来判
    js = parts['data.js'] + '\n' + parts['core.js'] + '\n' + parts['app.js']

    # ---------- 主题引导（先于样式生效，避免首屏闪白） ----------
    # 这里只设 <html>，是**设计使然**而非疏漏：本脚本位于 <head>，先于样式与正文
    # 生效，此刻 .app-shell 根本还没解析出来，无处可同步。两层保障使其安全：
    #   ① .app-shell 在静态标记里不携带 data-theme（见 body.html），
    #      它自然继承 <html> 的值，首屏即正确；
    #   ② 后续的角色切换一律走 app.js 的 applyThemeAttr()，两处同时写。
    # JS 体单独抽出，是为了让门禁 B 的 `node --check` 也能覆盖到它 ——
    # 若只校验 data.js + core.js + app.js，这段内联脚本就是监管盲区。
    theme_boot_js = (
        '/* 首屏防闪烁：先于样式生效设置 data-theme（.app-shell 此时尚未解析） */\n'
        '(function(){try{\n'
        "  var t=localStorage.getItem('baox.act.theme');\n"
        "  document.documentElement.setAttribute('data-theme', t==='light'?'light':'dark');\n"
        "}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();\n"
    )
    theme_boot = '<script>\n' + theme_boot_js + '</script>\n'

    # body.html 只到 <div id="toast"></div> 为止，收尾标签由构建补齐
    tail = '</body>'
    if tail in body:
        body_head = body[:body.rindex(tail)]
    else:
        body_head = body

    html = (
        '<!DOCTYPE html>\n'
        '<html lang="zh-CN" data-theme="dark">\n'
        '<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '<meta name="color-scheme" content="dark light">\n'
        '<meta name="description" content="公子的活动量面板 · 逐日打卡计分、'
        '周目标达成、成功方程式转化与业务指标看板">\n'
        '<title>公子的活动量面板</title>\n'
        # 复用头像作站点图标：既消掉浏览器自动请求 /favicon.ico 的 404 噪音，
        # 也让线上部署时标签页有个正经图标。零新增体积。
        '<link rel="icon" href="assets/avatar.png">\n'
        + theme_boot +
        '<link rel="stylesheet" href="libs/fontawesome/css/all.min.css">\n'
        # Chart.js 放在 <style> 之前：图表库体积大，先发起请求让下载与样式解析并行
        '<script src="libs/chart.js/chart.umd.min.js"></script>\n'
        '<style>\n' + css + '\n</style>\n'
        '</head>\n'
        + body_head +
        '\n<script>\n' + js + '\n</script>\n'
        '</body>\n'
        '</html>\n'
    )

    # ========================================================================
    # 门禁 A · 内容断言
    # ========================================================================
    MUST = {
        # ── 六个区块（导航锚点目标，少一个就会出现「点了没反应」的死链）──
        # v1.1 从 8 个降为 6 个：#weekly 与 #rules 两个区块连同其导航项一并移除。
        # 这里若只是把两行删掉，导航与区块就不再成对可核对 ——
        # 条目数（6）本身也要断言，见下方 navCount。
        '总览区': 'id="overview"',
        '今日打卡区': 'id="today"',
        '趋势热力区': 'id="trend"',
        '活动量构成区': 'id="mix"',
        '成功方程式区': 'id="funnel"',
        '打卡明细区': 'id="ledger"',
        # ── 页面标题（用户指定的固定文案）──
        '页面标题': '<title>公子的活动量面板</title>',
        '主标题': '<strong>活动量面板</strong>',
        # ── 首屏 KPI（渲染是否落地的直接证据）──
        # v1.2 按用户裁定整体重定义：v1.1 的 8 卡里有 4 张（打卡天数 /
        # 单日峰值 / 零分天数 / 月达标率）是「回溯样本」的统计量，
        # 数据清空后它们恒为 0/空，占着首屏却不提供任何决策信息。
        # 换成「总分 + 3 档业绩 + 季度目标口径」后，8 张全部有值。
        # ⚠️ 判据必须一一列出 id，不能用「有 8 个 k 开头的 id」这种
        #    计数式断言：计数命中 0 也算通过（本项目已有先例）。
        'KPI累计活动量总分': 'id="kScore"',
        'KPI本月业绩': 'id="kMonthPerf"',
        'KPI本季度业绩': 'id="kQuarterPerf"',
        'KPI本年度业绩': 'id="kYearPerf"',
        'KPI季度目标业绩': 'id="kQuarterGoal"',
        'KPI季度目标完成率': 'id="kQuarterRate"',
        'KPI季度成交单数': 'id="kQuarterDeals"',
        'KPI季度成交保费': 'id="kQuarterPremium"',
        '关键洞察': 'id="insights"',
        # ── 今日打卡 ──
        '计分网格': 'id="checkGrid"',
        '今日得分条': 'id="wkScoreVal"',
        '今日保费条': 'id="wkPremVal"',
        '本周保费目标标签': 'id="wkPremTgt"',
        '保存按钮': 'id="btnSaveToday"',
        '沿用昨日按钮': 'id="btnCopyYest"',
        '保存提示': 'id="saveHint"',
        # ── 周维度（v1.1 只保留这三项）────────────────────────────────────
        # 周进度区块本体（#weekStrip 逐日条 / #wkBody 周汇总表 / #wScore 四卡）
        # 已按用户裁定移除。以下三项**必须留着**：它们是「周」这个维度还活着的
        # 证据 —— 源模板的 O/P/Q/S 列纵向合并块本来就是按周切分的，
        # 三项若一并删掉，页面上就再也看不到「周」，等于丢掉源表骨架。
        # 判据一律带引号（id="xxx"）：裸标识符 weekStrip 会命中 app.js 里的
        # 墓碑注释与「已移除」说明文字，于是「必须缺席」判在注释上，
        # 正确的删除反被自己的说明文字判成违规（本项目真实踩过一次）。
        '周次筛选条': 'id="weekChips"',
        '导航今日徽标': 'id="nbToday"',
        # ── 趋势 / 构成 / 方程式 ──
        '热力日历': 'id="heatGrid"',
        '构成横条': 'id="mixBars"',
        '构成明细表体': 'id="mixTbody"',
        '漏斗卡片': 'id="fnCards"',
        '目标比率对照': 'id="ratioGrid"',
        # ── 明细 ──
        '明细表头': 'id="ledgerHead"',
        '明细表体': 'id="ledgerBody"',
        '明细摘要': 'id="ledgerSummary"',
        '顶栏搜索框': 'id="searchInput"',
        '搜索结果浮层': 'id="searchPop"',
        # ── 设置数据（顶栏按钮 → 抽屉全量编辑）──
        '设置数据按钮': 'id="btnSettings"',
        '设置抽屉': 'id="setDrawer"',
        '设置抽屉内容': 'id="setBody"',
        '设置保存按钮': 'id="btnSetSave"',
        '恢复源模板按钮': 'id="btnRestore"',
        '逐日数据网格': 'class="dg-tb"',
        '设置数据模块': 'function buildSettings',
        '抽屉内重算预演': 'function refreshSettings',
        # ── v1.2：源表口径校验整模块移除 ───────────────────────────────
        # v1.1 还留着一个总览摘要（#auditBox），v1.2 按用户裁定连摘要一并删除，
        # core.js 的 sourceComparison() 与其逐列比对也同步下线。
        # ⚠️ 于是「唯一口径」的证明链**只剩一条**：expected.py（构建期）与
        #    core.js（运行期）两份实现逐值互比。它是互比、不是对照外部权威，
        #    两边一起错时不响 —— 这个代价已写进门禁 E 的文档串与
        #    verify-runtime.cjs 的文件头，此处不再重复断言已不存在的模块。
        # ── 四张图表 ──
        '逐日图': 'id="chDaily"',
        '周目标图': 'id="chWeekGoal"',
        '按星期图': 'id="chDow"',
        '累计曲线': 'id="chCum"',
        # ── 主题 / 版本 / 容器 ──
        '主题切换器': 'id="themeSw"',
        '暗夜按钮': 'data-theme-set="dark"',
        '米金按钮': 'data-theme-set="light"',
        '版本徽章': 'id="verBadge"',
        '侧栏版本': 'id="footVer"',
        '轻提示': 'id="toast"',
        '进场门控': 'html.anim-ready',
        '图表容器': 'class="chart-box',
        # ── 零外链（铁律 8）──
        '零外链 Chart': 'libs/chart.js/chart.umd.min.js',
        '零外链 图标': 'libs/fontawesome/css/all.min.css',
        '本地头像': 'assets/avatar.png',
        # ── 数据与计算层（口径证明）──
        '内嵌种子数据': 'window.ACT_SEED',
        '唯一口径导出': 'window.ACT',
        '运行期取证接口': 'window.__ACT_SNAPSHOT__',
        '主题落地函数': 'applyThemeAttr',
        '计分唯一实现': 'function dayScore',
        '聚合唯一实现': 'function aggregate',
        # v1.2 的持久化键带版本号：旧键（baox.act.data / baox.act.log）里
        # 存着上一版窗口（2022 年样本）的 390 格数据，若沿用同一键，
        # 覆盖层会按**旧日期**并回**新种子**，得到一份两边都不对的混合体。
        # 换键让旧数据自然失效（不删、不迁移），代价只是用户需重新打卡 ——
        # 而本次用户要求的正是「清空所有活动数据」。
        # ↑『基线覆盖层键』已于 v1.2b 迁到 MUST_RE（判赋值语句，判子串会假绿），
        #   理由见下方 MUST_RE 注释。
        '覆盖层并回种子': 'function applyOverlay',
        '覆盖层差异收敛': 'function diffOverlay',
        '静默破坏防护': 'function bindChips',
    }
    # ── 必须用**词边界**判定的标记（铁律 16）────────────────────────────────
    # 由来（本项目实测踩到）：这两个类名原先写成普通子串断言，结果被
    # panel.css 里的 .pg-fill / .pg-top（进度条的两个类）**意外满足** ——
    # 「pg-fill」含子串「g-fill」，「pg-top」含子串「g-top」。
    # 于是门禁显示「必须在场」通过，而 body.html 里根本没挂这两个类：
    # 图表不长、列表不收，留白探针报 14 项超阈值，门禁却一路绿灯。
    # 这就是「断言判在子串上」的典型后果 —— 判据必须落在被测对象上，
    # 而不是「文中出现过的字符序列」。改用 \b 词边界后，pg-fill 不再命中。
    MUST_RE = {
        '网格生长类 g-fill': r'\bg-fill\b',
        '网格顶对齐类 g-top': r'\bg-top\b',
        # v1.2 新增的第三个标记类：混合行（图表 + 列表）里的**列表面板**用
        # align-self:start 收住自己。它的存在理由与 g-top 不同（g-top 是整行级、
        # 会把图表也改成自然高度），详见 panel.css ⓪b-2。
        # 断言它的理由：它一旦被删，画面只是「洞察面板底部多出一块空白」——
        # 不报错、不影响功能，只有留白探针能发现；而探针不是每次构建都跑。
        '网格列表顶对齐类 g-self-top': r'\bg-self-top\b',
        # v1.2b 从 MUST 迁来，并把判据从「文中出现这串字」升级为「赋值语句」。
        # 为什么非升不可：同一串字在产物里出现 6 次，5 次在注释里，只有 1 次
        # 是真代码。判子串时，把 LS_DATA 改回旧键后注释仍能「满足」它 ——
        # 断言的在场判定被注释接管，等于没有断言。
        # 判在赋值语句上则只认那唯一一处真代码，注释写多少遍都不算。
        '基线覆盖层键': r"var\s+LS_DATA\s*=\s*'baox\.act\.data\.v2'",
    }
    # 每项必须有 / 必须无 双向断言
    MUST_NOT = {
        'CDN 残留': 'cdn.jsdelivr.net',
        'CDN 残留（unpkg）': 'unpkg.com',
        'CDN 残留（cdnjs）': 'cdnjs.cloudflare.com',
        '未本地化字体': 'fonts.googleapis.com',
        # 「重置筛选」类按钮**故意不做**：点一下清空全部筛选，而清空后的画面
        # 与「本来就没筛」一模一样 —— 用户看不出发生了什么，只发现列表变了，
        # 属于静默的破坏性操作（铁律 15）。撤销已改由「再点一次选中的 chip」
        # 承担：路径可回溯、可看见、可逆转。这里锁死不许回来。
        '筛选重置按钮残留': 'resetFilters',
        '筛选重置按钮残留（活动量）': 'resetActFilters',
        '筛选清空按钮残留': 'clearAllFilters',
        '筛选全清按钮残留': 'resetLedger',
        # ── v1.1 移除的内容，必须有反向断言 ────────────────────────────────
        # 只把条目从 MUST 里删掉，等于放弃断言；下次谁把区块从别处复制回来，
        # 门禁一声不响。判据带 id=" 前缀：墓碑注释里写的是 #weekStrip 这种
        # 带井号的引用，不会误命中；而注释在 probe_html 里已被剥离。
        '周进度区块残留': 'id="weekStrip"',
        '周汇总表残留': 'id="wkBody"',
        '计分说明表残留': 'id="rulesTbody"',
        '计分说明原文残留': 'id="rulesText"',
        '逐列对照表残留': 'id="auditFull"',
        '导出CSV残留': 'exportCSV',
        # 两个整区块的迁移（导航锚点目标）：删掉 MUST 条目只是放弃断言，
        # 不代表「断言它没回来」。靠这两条，谁把区块搬回来都会立刻红灯。
        # 判据必须带闭合引号：id="rules" 不会命中 id="rulesText"（rules 后面是 T 不是 "）。
        '周进度区块残留（锚点）': 'id="weekly"',
        '计分说明区块残留（锚点）': 'id="rules"',
        # ── v1.2 移除的内容，同 v1.1 一样必须有反向断言 ────────────────
        # 只把条目从 MUST 里删掉，等于放弃断言：下次谁把旧 KPI 卡复制回来，
        # 页面会多出一张**永久空白**的卡（渲染层已无对应写值函数），
        # 而门禁一声不响。
        '旧 KPI 打卡天数残留': 'id="kDays"',
        '旧 KPI 本期保费残留': 'id="kPrem"',
        '旧 KPI MDRT 残留': 'id="kMdrt"',
        '旧 KPI 月达标率残留': 'id="kRate"',
        '旧 KPI 成交单数残留': 'id="kDeals"',
        '旧 KPI 单日峰值残留': 'id="kPeak"',
        '旧 KPI 零分天数残留': 'id="kZero"',
        '源表口径校验模块残留': 'id="auditBox"',
        # 这条判据不带引号，所以必须确认它不会命中墓碑注释：产物里确有
        # 两处 `/* */` 块注释提到该标识符（在讲清「已删除」）。门禁 A 的
        # 「必须缺席」一律判在**去注释**文本（probe_html）上，故不会假阳性 ——
        # 前提是它只出现在注释里，这一点由本补丁的前置检查逐文件核对。
        '源表口径对照实现残留': 'sourceComparison',
    }
    # 「必须缺席」要在**去掉注释**的产物上判定：
    # base.css 的注释里正好写着「旧写法 .fi{opacity:0} 会导致白屏」这句说明，
    # 若连注释一起查，会把正确的代码误判为违规。
    # 「去注释」不是一个动作，而是一组动作 —— 产物里混着三种注释语法，
    # 每种各要剥一次；漏一种就等于留了一扇假绿的后门：
    #   /* */     CSS / JS 块注释
    #   <!-- -->  HTML 注释
    #   整行 //   JS 行注释（只剥整行，避免误伤 https:// 这类行内序列）
    # 实测（v1.2d，由反例 B 抓到）：上一版只剥了 /* */，于是 body.html 里
    # `<!-- g-self-top：列表按自身内容收住 -->` 一直在替真代码背书 ——
    # 把 <div class="panel g-self-top"> 的类真删掉，MUST_RE 照样通过。
    # 改前全量体检：剥三种后 68 项 MUST「仅在注释里在场」0 项、
    # MUST_NOT 假红 0 项，故改判不会把本来正确的构建变红。
    probe_html = re.sub(r'/\*.*?\*/', '', html, flags=re.S)
    probe_html = re.sub(r'<!--.*?-->', '', probe_html, flags=re.S)
    probe_html = re.sub(r'^\s*//.*$', '', probe_html, flags=re.M)

    bad = []
    # ⚠️ 判在 **probe_html（去注释）** 上，不判 html。铁律 10 的「判据落在
    #    字符序列上」有两个方向，这是**在场方向**的那一个：
    #    「必须缺席」判在含注释文本上 → 历史陈述注释让它**假红**；
    #    「必须在场」判在含注释文本上 → 注释里的同一串字让它**假绿**。
    #    实测（v1.2）：'基线覆盖层键' 判子串时，产物里该键 6 次出现有 5 次在
    #    注释里，把真代码改回旧键后断言照样通过 —— 一行拦不住任何东西的断言。
    #    改判前已全量体检：69 项里「仅在注释里在场」者为 0 项，故改判不会
    #    把本来正确的构建变红。
    for label, need in MUST.items():
        if need not in probe_html:
            bad.append('缺少 %s（%s）' % (label, need))
    for label, no in MUST_NOT.items():
        if no in probe_html:
            bad.append('不应出现 %s（%s）' % (label, no))
    for label, rx in MUST_RE.items():
        if not re.search(rx, probe_html):
            bad.append('缺少 %s（正则 %s）' % (label, rx))

    # 铁律 1/3 专用：不能靠字符串包含判定 ——
    # `html.anim-ready .fi{opacity:0}` 里就含有 `.fi{opacity:0` 这个子串，
    # 直接搜子串会把唯一正确的写法误判成违规。这里按「选择器 → 声明块」逐条解析：
    # 凡声明块里出现 opacity:0 且选择器命中 .fi，就必须同时带 anim-ready 门控。
    def fi_gate_violations(css_text):
        out = []
        for sel, decl in re.findall(r'([^{}]+)\{([^{}]*)\}', css_text):
            sel_s = sel.strip().replace('\n', ' ')
            decl_n = decl.replace(' ', '')
            if 'opacity:0' not in decl_n:
                continue
            if '.fi' not in sel.replace(' ', ''):
                continue
            if 'anim-ready' not in sel:
                out.append(sel_s)
        return out

    v = fi_gate_violations(probe_html)
    if v and not no_gate:
        bad.append('存在无 anim-ready 门控的 .fi 隐藏规则（会导致 JS 失灵时整页白屏）：%s'
                   % '; '.join(v[:5]))
    if v:
        print('   （诊断）裸隐藏规则:%s' % v[:5])
    else:
        print('铁律 1/3 门控通过：.fi 隐藏规则全部带 html.anim-ready 前缀')

    # 铁律 2 专用：进场观察阈值必须是 0，不许用比例阈值。
    # 比例阈值在「区块比视口还高」时永远达不到 —— 超高区块会整块隐形，
    # 而它的 DOM、数据、图表全都正常，看起来像「页面少了一块」。
    thr = [m for m in re.findall(r'threshold\s*:\s*([0-9.]+)', probe_html) if num(m) != 0]
    if thr and not no_gate:
        bad.append('存在非零进场阈值（铁律 2）：%s —— 超高区块会永远不显现'
                   % ', '.join(sorted(set(thr))))
    if not thr:
        print('铁律 2 门控通过：进场观察阈值全为 0')

    if bad and not no_gate:
        print('!! 内容断言失败:')
        for b in bad:
            print('     -', b)
        sys.exit(1)
    print('内容断言通过：%d 项必须在场 / %d 项正则必须在场 / %d 项必须缺席'
          % (len(MUST), len(MUST_RE), len(MUST_NOT)))

    # ========================================================================
    # 门禁 A2 · 主题锚点唯一性
    # ------------------------------------------------------------------------
    # 故障现象：点了「米金」，按钮已高亮，页面主体仍是深色。
    # 成因：theme.css 用的是**裸属性选择器** [data-theme="dark"]{...}，它匹配
    #       任何带该属性的元素，不限于 <html>。静态标记里 .app-shell 若也挂着
    #       data-theme="dark"，它就把整套 token 重新声明在子树根部，其内部所有
    #       var() 一律取到深色值 —— 此时 <html> 改成 light 也救不回来。
    # 判据：① 静态挂载点只允许 <html> 一个，且值必须是 dark（首屏基线）；
    #       ② 运行期改主题必须且只能经由 applyThemeAttr()，它同时写 <html> 与
    #          .app-shell；裸的 documentElement.setAttribute 出现次数须为 1。
    # ========================================================================
    a2 = []
    mounts = re.findall(r'<[a-zA-Z][^>]*?\sdata-theme="([^"]*)"', probe_html)
    if len(mounts) != 1:
        a2.append('静态 data-theme 挂载点应恰好 1 个（<html>），实为 %d 个：%s'
                  % (len(mounts), mounts))
    elif mounts[0] != 'dark':
        a2.append('<html> 首屏基线应为 dark，实为 %s' % mounts[0])

    # 判据只算应用脚本段：<head> 的首屏引导脚本位于样式与正文之前，
    # 那时 .app-shell 尚未解析，它只写 <html> 是唯一可行写法（见上方说明）。
    js_probe = re.sub(r'/\*.*?\*/', '', js, flags=re.S)
    js_probe = re.sub(r'^\s*//.*$', '', js_probe, flags=re.M)
    n_direct = js_probe.count("document.documentElement.setAttribute('data-theme'")
    if n_direct != 1:
        a2.append("应用脚本内裸的 documentElement.setAttribute('data-theme') 应恰好 1 处"
                  '（仅 applyThemeAttr 内），实为 %d 处' % n_direct)
    if "querySelector('.app-shell')" not in js_probe:
        a2.append('缺少 .app-shell 同步 —— 浅色皮肤会被 .app-shell 上的旧 token 覆盖')
    if 'applyThemeAttr' not in html:
        a2.append('未找到主题落地函数 applyThemeAttr')
    # 主题持久化键必须与首屏引导脚本读的键**字面相同**：
    # 两处各写一个字符串，改一处忘一处 → 症状是「刷新后回到深色」，
    # 而按钮态、页面态、控制台全无异常，极难定位。
    if js_probe.count("'baox.act.theme'") < 1:
        a2.append("应用脚本未使用 'baox.act.theme' 作为主题键")

    if a2 and not no_gate:
        print('!! 主题锚点唯一性门禁失败:')
        for b in a2:
            print('     -', b)
        sys.exit(1)
    if a2:
        print('   （诊断）主题锚点:%s' % a2[:3])
    else:
        print('主题锚点唯一性通过：静态挂载点 1 个 / 运行期唯一写入口，两处挂载点同步')

    # ========================================================================
    # 门禁 A-3 · 存储键字面量跨文件一致
    # ========================================================================
    # 同一个键名在三处各写一份字面量：core.js 的 LS_DATA（唯一写入口）、
    # probe-interactions.cjs 的 LS_KEY（交互探针读它）、expected.py 的口径注释。
    # 只要有一处漂移，交互探针就会去读一个**空键** —— 而「读不到覆盖层」
    # 在一部分断言里长得像正常（种子基线本来就有值），属于静默失效。
    # 与门禁 A 判主题键同源，故同样在构建期把三份字面量钉死。
    a3 = []
    probe_path = os.path.join(BASE, 'probe-interactions.cjs')
    if os.path.exists(probe_path):
        probe_js = read(probe_path)
        m_data = re.search(r"var\s+LS_DATA\s*=\s*'([^']+)'", parts['core.js'])
        m_probe = re.search(r"const\s+LS_KEY\s*=\s*'([^']+)'", probe_js)
        if not m_data:
            a3.append('core.js 未找到 LS_DATA 赋值语句')
        if not m_probe:
            a3.append('probe-interactions.cjs 未找到 LS_KEY 赋值语句')
        if m_data and m_probe and m_data.group(1) != m_probe.group(1):
            a3.append('存储键漂移：core.js LS_DATA=%r，交互探针 LS_KEY=%r —— '
                      '探针会去读空键，失败长得像通过'
                      % (m_data.group(1), m_probe.group(1)))
        if m_data and m_probe and m_data.group(1) == m_probe.group(1):
            print('存储键一致性通过：%s（core.js LS_DATA 与交互探针 LS_KEY 字面相同）'
                  % m_data.group(1))
    else:
        print('存储键一致性：跳过（未找到 probe-interactions.cjs，交互探针本就不会跑）')
    if a3 and not no_gate:
        print('!! 存储键一致性门禁失败:')
        for b in a3:
            print('     -', b)
        sys.exit(1)
    if a3:
        print('   （诊断）存储键:%s' % a3[:3])

    # ========================================================================
    # 门禁 B · 语法门禁（内联脚本先过 node --check）
    # ========================================================================
    if os.path.exists(NODE):
        probe = os.path.join(TMP, '_syntax_probe.js')
        os.makedirs(TMP, exist_ok=True)
        # theme_boot_js 与主脚本分处不同的 <script>，但同属内联脚本；
        # 一并送检才能确保「首屏主题引导」这段也不带语法错。
        io.open(probe, 'w', encoding='utf-8').write(theme_boot_js + js)
        r = subprocess.run([NODE, '--check', probe], capture_output=True, text=True)
        retire(probe)
        if r.returncode != 0 and not no_gate:
            print('!! 脚本语法门禁失败:')
            print(r.stderr[:2000])
            sys.exit(1)
        print('语法门禁通过：node --check 无错（含首屏主题引导脚本）')
    else:
        print('（跳过语法门禁：未找到 node）')

    # ========================================================================
    # 门禁 B2 · 顶层函数不得重复声明
    # ------------------------------------------------------------------------
    # 成因：给页面加功能时没有先确认同名函数是否已存在，就又写了一遍。
    # JS 里同作用域的后一个声明会**静默覆盖**前一个：不报错、node --check 通过、
    # 页面照常跑，只是既有调用点全部改走了新实现 —— 症状是「样式/行为对不上」，
    # 而语法门禁完全拦不住（两段代码单看都合法）。
    #
    # 判据：把内联 JS 的每个 `function name(` 连同**缩进层级**一起收出来，
    # 同一缩进层级下同名出现 >1 次即失败。为什么要带缩进：
    # 本项目的函数全部嵌在 IIFE 里（不是列 0 的顶层声明），只扫列 0 会一个
    # 都收不到 —— 门禁看起来在跑、实际空转，这比没有门禁更危险（给人已守住
    # 的错觉）。带缩进判定后，既能抓住「同一 IIFE 内同名覆盖」，又不会误报
    # 「不同 IIFE / 内外层同名」这种合法写法（缩进不同）。
    # 注意：data.js/core.js/app.js 三段同处一个作用域，必须合并起来判。
    fns = re.findall(r'^(\s*)function\s+([A-Za-z_$][\w$]*)\s*\(', js, flags=re.M)
    seen = {}
    for indent, name in fns:
        seen.setdefault((len(indent), name), 0)
        seen[(len(indent), name)] += 1
    dup = sorted({'%s()（缩进 %d）' % (n, ind) for (ind, n), c in seen.items() if c > 1})
    # 顺带查「全局量重复赋值」：window.X 被两处赋值，是同类静默覆盖。
    globals_assigned = re.findall(r'^\s*(?:window|global|globalThis)\.([A-Za-z_$][\w$]*)\s*=',
                                  js, flags=re.M)
    gdup = sorted({n for n in globals_assigned if globals_assigned.count(n) > 1})
    if (dup or gdup) and not no_gate:
        print('!! 声明重复 —— 后一个会静默覆盖前一个，既有调用点全被改道:')
        for n in dup:
            print('     - function %s' % n)
        for n in gdup:
            print('     - 全局 %s 被赋值 %d 次' % (n, globals_assigned.count(n)))
        sys.exit(1)
    if dup or gdup:
        print('   （诊断）重复:dup=%s gdup=%s' % (dup, gdup))
    else:
        print('声明唯一性通过：%d 个函数声明（含嵌套）、%d 个全局量均无同层重复'
              % (len(fns), len(set(globals_assigned))))

    # ========================================================================
    # 门禁 C · 图标字形反查（逐个列举会漏，反查才根除）
    # ========================================================================
    facss = os.path.join(ROOT, 'libs', 'fontawesome', 'css', 'all.min.css')
    if os.path.exists(facss):
        fac = read(facss)
        skip = {'fa-solid', 'fa-regular', 'fa-brands', 'fa-fw', 'fa-lg', 'fa-2x',
                'fa-3x', 'fa-4x', 'fa-spin', 'fa-pulse', 'fa-ul', 'fa-li',
                'fa-classic', 'fa-sharp', 'fa-display', 'fa-xl', 'fa-xs', 'fa-sm'}
        used = sorted(set(re.findall(r'fa-[a-z0-9-]+', html)))
        missing = [i for i in used
                   if i not in skip
                   and ('.' + i + ':') not in fac
                   and ('.' + i + '{') not in fac
                   and ('.' + i + ',') not in fac]
        if missing and not no_gate:
            print('!! 以下图标在本地 FontAwesome 中无字形，会静默变成 0x0:')
            for m in missing:
                print('     -', m)
            sys.exit(1)
        print('图标门禁通过：%d 个图标全在本地字形表中'
              % len([i for i in used if i not in skip]))
    else:
        print('（跳过图标门禁：未找到本地 FontAwesome CSS）')

    # ========================================================================
    # 门禁 D · 数据断言
    # ------------------------------------------------------------------------
    # 数据层自身的内部一致性。这类错误不会让页面报错，只会让数字对不上，
    # 而且往往「计数与列表打架」，看起来像渲染 bug，实际是数据就错了。
    # ========================================================================
    dstat = []
    meta = DATA.get('meta', {})
    days = DATA.get('days', [])
    weeks = DATA.get('weeks', [])
    rules = DATA.get('rules', [])
    unscored = DATA.get('unscored', [])
    tg = DATA.get('targets', {})

    period = meta.get('period', {})
    if period.get('days') not in (None, len(days)):
        dstat.append('meta.period.days=%s 与 days 实际长度 %d 不一致'
                     % (period.get('days'), len(days)))
    # 周分块必须无缝覆盖全部日期，不重不漏 —— 这是周聚合正确性的前提
    covered = []
    for w in weeks:
        covered.extend(w.get('days', []))
        if len(w.get('days', [])) != w.get('dayCount'):
            dstat.append('第 %s 周 dayCount=%s 与 days 列表长度 %d 不一致'
                         % (w.get('idx'), w.get('dayCount'), len(w.get('days', []))))
    if len(covered) != len(days):
        dstat.append('周分块覆盖 %d 天，实际 %d 天（不重不漏是周聚合的前提）'
                     % (len(covered), len(days)))
    if len(set(covered)) != len(covered):
        dstat.append('周分块存在重复日期 %d 个'
                     % (len(covered) - len(set(covered))))
    if set(covered) != set(d['date'] for d in days):
        dstat.append('周分块日期集合与实际日期集合不相符')

    # 每条日期记录必须带齐全部计分项与不计分项字段：
    # 缺字段不会报错，core.js 的 num() 会兜成 0 —— 于是分数静默少算，极难发现。
    need_keys = [r['key'] for r in rules] + [u['key'] for u in unscored]
    for d in days:
        miss = [k for k in need_keys if k not in d]
        if miss:
            dstat.append('%s 缺少字段 %s' % (d.get('date'), miss))
            break
    if not rules:
        dstat.append('rules 为空 —— 计分无法进行')
    # v1.2 目标参数只剩「周目标」：MDRT 与月目标已按用户裁定删除。
    # 这里断言键集合**恰好**是 {week}：只判 tg.get('week') 在场的话，
    # 谁把 month/mdrt 加回来都不会响，而它们是被明确删掉的口径。
    if set(tg.keys()) != {'week'}:
        dstat.append('targets 键应恰为 {week}，实为 %s（MDRT/月目标已删除）'
                     % sorted(tg.keys()))
    if not num(tg.get('week')):
        dstat.append('targets.week 缺失或为 0 —— 周目标图会整条贴地')
    # 周目标口径（v1.2 起为「各周统一」）：
    # v1.1 这里判的是**相反**的事 ——「首周不满 7 天则周目标应折半」。
    # 种子重建后窗口自 2026-09-18（周五）起算，首周只有 3 天、末周 6 天，
    # 但用户裁定各周目标统一 17500；旧断言会把这份**正确**数据判成违规。
    # 教训：口径随数据重建而变时，门禁里那条「描述旧口径」的断言必须
    #       跟着改 —— 否则它会在下一次正确的重建上炸，看起来像数据错了。
    for w in weeks:
        if num(w.get('target')) != num(tg.get('week')):
            dstat.append('第 %s 周目标 %s 与 targets.week=%s 不一致'
                         % (w.get('idx'), w.get('target'), tg.get('week')))

    if dstat and not no_gate:
        print('!! 数据断言失败:')
        for d in dstat:
            print('     -', d)
        sys.exit(1)
    print('数据断言通过：%d 天 / %d 周 / %d 计分项 / %d 不计分项，分块不重不漏'
          % (len(days), len(weeks), len(rules), len(unscored)))

    # ========================================================================
    # 门禁 K · Python 源码可编译
    # ------------------------------------------------------------------------
    # 由来：文档字符串用 `*/` 收尾（Python 要三引号）这类错误，后果不是
    # 「一个小函数坏掉」，而是**整个文件无法 import** —— 流水线直接起不来，
    # 而症状会指向完全错误的方向。
    # 编译一次是毫秒级成本，却能把整类故障前移到构建这里。
    # 位置必须在门禁 I 之前：门禁 I 用 tokenize 扫 token，源码有语法错时它自己
    # 就会崩，报出来的却是一句「门禁 I 无法解析 xxx」—— 把「你有个语法错误」
    # 说成了「工具没法解析」，指向完全错误。
    # ========================================================================
    if not no_gate:
        kbad = []
        for fn in ('gen_data.py', 'expected.py', 'xlsxdump.py', 'build.py'):
            src_path = os.path.join(BASE, fn)
            if not os.path.exists(src_path):
                continue
            try:
                with io.open(src_path, 'rb') as fh:
                    compile(fh.read(), src_path, 'exec')
            except SyntaxError as e:
                kbad.append('%s 第 %s 行：%s' % (fn, e.lineno, e.msg))
            except Exception as e:
                kbad.append('%s 无法编译：%s' % (fn, e))
        if kbad:
            sys.exit('!! 门禁 K · Python 源码不可编译：\n     %s\n'
                     '   这些文件是数据抽取与门禁的本体，坏在这里等于流水线起不来。'
                     % '\n     '.join(kbad))
        print('门禁 K · Python 源码可编译通过：gen_data/expected/xlsxdump/build 均通过 compile()')

    # ========================================================================
    # 门禁 I · 流水线不得出现删除调用
    # ------------------------------------------------------------------------
    # 由来（本项目最贵的一次故障，症状极具欺骗性）：
    #   WorkBuddy 注入的安全删除护栏（sitecustomize.py 的 _safe_remove →
    #   _check_bulk_delete_guard）会 raise SystemExit(1)。
    #   SystemExit 继承 BaseException，穿透 `except Exception`，
    #   导致 finally 里的放锁逻辑被跳过 → 锁永久泄漏、任务永久停在 running。
    #   护栏按「轮次累计删除数」计数、跨进程共享（阈值 50），
    #   所以**任何一次删除都可能在任何时刻被硬拒**，不能靠「删得少」来规避。
    # 判据用 tokenize 扫真正的调用（os.remove( 这类），注释与文档字符串不算 ——
    # 本项目的文档刻意保留了这段踩坑说明，不能因为「出现了同样的字样」就判违规。
    # ========================================================================
    if not no_gate:
        DELETE_FUNCS = {'remove', 'unlink', 'rmtree', 'rmdir'}
        offenders = []
        for fn in ('gen_data.py', 'expected.py', 'xlsxdump.py', 'build.py'):
            src_path = os.path.join(BASE, fn)
            if not os.path.exists(src_path):
                continue
            try:
                with io.open(src_path, 'rb') as fh:
                    seq = [t for t in tokenize.tokenize(fh.readline)
                           if t.type in (tokenize.NAME, tokenize.OP)]
            except Exception as e:
                sys.exit('!! 门禁 I 无法解析 %s：%s\n'
                         '   （源码疑似有语法错误；门禁 K 专查这个，'
                         '去掉 --no-gate 重跑可拿到行号）' % (src_path, e))
            for i in range(len(seq) - 3):
                a, b, c, d = seq[i], seq[i + 1], seq[i + 2], seq[i + 3]
                if (a.type == tokenize.NAME and b.string == '.'
                        and c.type == tokenize.NAME and c.string in DELETE_FUNCS
                        and d.string == '('):
                    offenders.append('%s:%d  %s.%s(' % (fn, a.start[0], a.string,
                                                        c.string))
        if offenders:
            sys.exit('!! 门禁 I · 流水线出现删除调用：\n     %s\n'
                     '   安全删除护栏会 raise SystemExit(1)，穿透普通异常处理、'
                     '让互斥锁永久泄漏。请改用 os.replace 改名归档。'
                     % '\n     '.join(offenders))
        print('门禁 I · 流水线零删除通过：gen_data/expected/xlsxdump/build 均无删除类调用')

    # ========================================================================
    # 落盘策略：先写暂存文件，跑完运行期门禁 E，全绿才改名到 index.html
    # ------------------------------------------------------------------------
    # 为什么不直接写 index.html：门禁 E 需要文件真实存在于磁盘（浏览器要访问），
    # 于是「组装」必然先于「运行期门禁」。若直接写成成品名，门禁失败时磁盘上
    # 留着一个**看起来正常**的半成品页面 —— 下次有人打开它就是一份错数据，
    # 而构建日志早已滚过。暂存名让「没通过门禁的东西」在目录里显眼地叫 stage。
    # 暂存文件必须与产物**同级**：页面用相对路径引用 libs/ 与 assets/，
    # 换目录会让这些引用全部 404，门禁 E 会因样式缺失而误判。
    # ========================================================================
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(ARCHIVE, exist_ok=True)
    io.open(STAGE, 'w', encoding='utf-8').write(html)
    print('已组装暂存产物：%s（%.1f KB）' % (STAGE, len(html.encode('utf-8')) / 1024.0))

    if not no_gate and os.path.exists(NODE):
        # ---- 生成 Python 侧期望值 ----
        exp_path = os.path.join(TMP, '_expected.json')
        r0 = subprocess.run(
            [sys.executable, os.path.join(BASE, 'expected.py'), data_path, exp_path],
            capture_output=True, text=True)
        if r0.returncode != 0:
            sys.exit('!! 期望值生成失败:\n' + (r0.stderr or r0.stdout))
        print(r0.stdout.strip())

        # ---- 门禁 E · 运行期数据一致性 ----
        gate_e = os.path.join(BASE, 'verify-runtime.cjs')
        if os.path.exists(gate_e):
            env = dict(os.environ)
            env['NODE_PATH'] = NODE_PATH
            env['PATH'] = '/opt/homebrew/bin:' + env.get('PATH', '')
            r1 = subprocess.run([NODE, gate_e, STAGE, exp_path],
                                capture_output=True, text=True, env=env)
            print(r1.stdout.strip())
            if r1.returncode != 0:
                if r1.stderr.strip():
                    print(r1.stderr.strip()[:1500])
                sys.exit('!! 门禁 E · 运行期数据一致性未通过 —— 产物不落盘。\n'
                         '   暂存文件保留在 %s 供排查；修好后重跑 build.py。' % STAGE)
        else:
            print('（跳过门禁 E：未找到 verify-runtime.cjs）')

    # ---- 全绿，落盘 ----
    shutil.copyfile(STAGE, OUT)
    # 归档一个带版本与日期的副本（历史可回溯），命名与 CRM/GEO 一致
    arch = os.path.join(ARCHIVE, 'activity-%s-%s.html' % (VERSION, TODAY))
    # 归档不覆盖。同日同版重复构建是常态（改一行就要重跑），直接 copyfile 会把
    # 「同一版本号下的历史形态」静默抹掉 —— 本轮就真的发生过：v1.1 的产物覆盖了
    # v1.0 的归档，archive/ 里那个文件看着还在、其实已经不是它名字所声称的东西。
    # 而内容一致时又另存副本，只会把 archive/ 堆成噪音。故：
    #   同内容 → 跳过（幂等重跑不留痕）；异内容 → 带时分秒另存（历史可回溯）。
    def _same_bytes(a, b):
        with open(a, 'rb') as f1, open(b, 'rb') as f2:
            return f1.read() == f2.read()

    # v1.2c：去重必须扫**全部归档**，不能只比同名的那个。
    # 实测踩到：canonical 名（activity-v1.2-260918.html）里装的是「修好之前」
    # 那一次构建，于是此后每次重跑都判「同名且内容不同」，分叉出一个新的
    # 时间戳文件 —— 而它与已存在的归档**逐字节相同**。
    dup = None
    for f in sorted(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html'))):
        if f != arch and _same_bytes(STAGE, f):
            dup = f
            break

    if dup:
        check_archives(OUT, VERSION)
        print('\n产物已落盘：%s' % OUT)
        print('版本归档：已存在同内容归档 %s（不重复归档）' % os.path.basename(dup))
    elif os.path.exists(arch) and _same_bytes(STAGE, arch):
        check_archives(OUT, VERSION)
        print('\n产物已落盘：%s' % OUT)
        print('版本归档：%s（内容一致，未重复写入）' % arch)
    else:
        if os.path.exists(arch):
            stamp = datetime.datetime.now().strftime('%H%M%S')
            arch = os.path.join(ARCHIVE, 'activity-%s-%s-%s.html' % (VERSION, TODAY, stamp))
            print('\n!! 同名归档已存在且内容不同 —— 已另存为 %s' % os.path.basename(arch))
        shutil.copyfile(STAGE, arch)
        check_archives(OUT, VERSION)
        print('\n产物已落盘：%s' % OUT)
        print('版本归档：%s' % arch)


if __name__ == '__main__':
    main()
