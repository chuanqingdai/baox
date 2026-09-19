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
  · 产物流水：先写 _build_stage.html → 跑门禁 E → 全绿才改名落盘
    （门禁失败不留半成品，避免下次误开半成品页面）。

用法：
    python3 src/build.py            # 组装并跑全部门禁
    python3 src/build.py --no-gate  # 只组装（调试用）
"""
import datetime
import io
import json
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

VERSION = 'v1.0'
TODAY = datetime.date.today().strftime('%y%m%d')


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
        '周目标达成、成功方程式转化与源表口径校验">\n'
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
        'KPI打卡天数': 'id="kDays"',
        'KPI累计总分': 'id="kScore"',
        'KPI本期保费': 'id="kPrem"',
        'KPI MDRT': 'id="kMdrt"',
        'KPI月达标率': 'id="kRate"',
        'KPI成交单数': 'id="kDeals"',
        'KPI单日峰值': 'id="kPeak"',
        'KPI零分天数': 'id="kZero"',
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
        # ── 源表口径校验（只留总览摘要）────────────────────────────────────
        # v1.1 按用户裁定删掉「逐列对照」证据表（#auditFull / rules-tb col-tb）：
        # 页面不再逐格披露源表公式缺陷。
        # ⚠️ 删的是**展示**，不是**口径**：src/core.js 的 sourceComparison().columns
        #    仍在场，并仍由 verify-runtime.cjs 第 ⑦ 关逐列比对判定标签（三分支
        #    一致 / 截断 / 未纳入）。这里若把「源表口径对照」一并拿掉，
        #    整条口径证明链就断了 —— 页面变干净，代价是再也没人守着这件事。
        '口径校验（总览）': 'id="auditBox"',
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
        '源表口径对照': 'function sourceComparison',
        '基线覆盖层键': 'baox.act.data',
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
    }
    # 「必须缺席」要在**去掉注释**的产物上判定：
    # base.css 的注释里正好写着「旧写法 .fi{opacity:0} 会导致白屏」这句说明，
    # 若连注释一起查，会把正确的代码误判为违规。
    probe_html = re.sub(r'/\*.*?\*/', '', html, flags=re.S)

    bad = []
    for label, need in MUST.items():
        if need not in html:
            bad.append('缺少 %s（%s）' % (label, need))
    for label, no in MUST_NOT.items():
        if no in probe_html:
            bad.append('不应出现 %s（%s）' % (label, no))
    for label, rx in MUST_RE.items():
        if not re.search(rx, html):
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
    if not tg.get('week') or not tg.get('month'):
        dstat.append('targets 缺少 week/month 目标值')
    # 首周目标口径：首周不满 7 天时周目标应折半（源表就是这么定的）
    for w in weeks:
        if w.get('dayCount', 0) < 7 and w.get('target') == tg.get('week'):
            dstat.append('第 %s 周只有 %s 天，却用了整周目标 %s'
                         % (w.get('idx'), w.get('dayCount'), tg.get('week')))

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
    shutil.copyfile(STAGE, arch)
    print('\n产物已落盘：%s' % OUT)
    print('版本归档：%s' % arch)


if __name__ == '__main__':
    main()
