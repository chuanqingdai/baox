#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 改造 · body.html（页面结构层）。

对应公子六条指令里的：
  ② 活动量总览 8 卡 → 累计活动量总分 / 本月业绩 / 本季度业绩 / 本年度业绩 /
     季度目标业绩 / 季度目标完成率 / 季度成交单数 / 季度成交保费
  ③ 去除「源表口径校验」模块
  ④ 今日打卡 12 个模块（文案同步）
  ⑥ 页脚改为「展业活动量面板 · 数据仅存本机浏览器」

做法与 core.js 改造一致：**小块替换 + 每条替换自己断言**。
落地前自检 GONE（旧字样一个不留）与 NEED（新结构全在场）。
"""
import io
import os
import re
import sys

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'body.html')
src = io.open(P, encoding='utf-8').read()
orig_len = len(src)

STEPS = []


def sub(label, old, new, count=1):
    """必须命中恰好 count 次，否则就地失败。"""
    global src
    n = src.count(old)
    if n != count:
        sys.exit('!! [%s] 期望命中 %d 次，实际 %d 次：\n%s' % (label, count, n, old[:200]))
    src = src.replace(old, new, count)
    STEPS.append(label)


# ── ① 顶栏设置按钮 title ──────────────────────────────────────────────────
sub('设置按钮 title',
    'title="全量编辑 30 天活动量数据与目标参数"',
    'title="全量编辑 30 天活动量数据、各周目标与 6 项业务指标"')

# ── ② 总览副标题 ────────────────────────────────────────────────────────
sub('总览副标题',
    '<span class="sec-sub" id="ovSub">历史样本 · 读取中…</span>',
    '<span class="sec-sub" id="ovSub">统计窗口 · 读取中…</span>')

# ── ③ 版本徽章（与原 VERSION 对齐；构建期另有断言锁住取值）────────────────
sub('品牌版本徽章', '<em class="ver-badge" id="verBadge">v1.0</em>',
    '<em class="ver-badge" id="verBadge">v1.2</em>')
sub('侧栏版本', '<strong id="footVer">V1.0</strong>', '<strong id="footVer">V1.2</strong>')

# ── ④ 总览 8 卡整体重写 ─────────────────────────────────────────────────
OLD_CARDS = '''        <div class="grid g4" style="margin-bottom:16px;">
          <div class="stat">
            <div class="stat-top"><span class="stat-label">打卡天数</span><span class="stat-ico"><i class="fa-solid fa-calendar-check"></i></span></div>
            <div class="stat-num gold-text" id="kDays">—</div>
            <div class="stat-foot"><span id="kDaysFoot">连续 <b>—</b> 天 · 最长 <b>—</b> 天</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">累计活动量总分</span><span class="stat-ico"><i class="fa-solid fa-star"></i></span></div>
            <div class="stat-num gold-text" id="kScore">—</div>
            <div class="stat-foot"><span id="kScoreFoot">日均 <b>—</b> 分</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">本期成交保费</span><span class="stat-ico"><i class="fa-solid fa-coins"></i></span></div>
            <div class="stat-num gold-text" id="kPrem">—</div>
            <div class="stat-foot"><span id="kPremFoot">人民币口径 · 件均 <b>—</b></span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">计入 MDRT 总保费</span><span class="stat-ico"><i class="fa-solid fa-trophy"></i></span></div>
            <div class="stat-num gold-text" id="kMdrt">—</div>
            <div class="stat-foot"><span id="kMdrtFoot">含期初结余 <b>—</b></span></div>
          </div>
        </div>

        <div class="grid g4">
          <div class="stat">
            <div class="stat-top"><span class="stat-label">月目标完成率</span><span class="stat-ico"><i class="fa-solid fa-bullseye"></i></span></div>
            <div class="stat-num gold-text" id="kRate">—</div>
            <div class="stat-foot"><span id="kRateFoot">月目标 ¥70,000</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">成交单数 / 家庭数</span><span class="stat-ico"><i class="fa-solid fa-file-signature"></i></span></div>
            <div class="stat-num gold-text" id="kDeals">—</div>
            <div class="stat-foot"><span id="kDealsFoot">促成签单次数 / 成交家庭数</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">单日最高得分</span><span class="stat-ico"><i class="fa-solid fa-bolt"></i></span></div>
            <div class="stat-num gold-text" id="kPeak">—</div>
            <div class="stat-foot"><span id="kPeakFoot">—</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">零打卡天数</span><span class="stat-ico"><i class="fa-solid fa-circle-minus"></i></span></div>
            <div class="stat-num gold-text" id="kZero">—</div>
            <div class="stat-foot"><span id="kZeroFoot">得分为 0 的日期</span></div>
          </div>
        </div>
'''

NEW_CARDS = '''        <!-- 8 卡：1 张活动量（自动累计）+ 6 张业务指标（手动维护）+ 1 张派生率（自动）
             v1.1 的 8 卡里有 4 张是「回溯样本」的统计量（打卡天数 / 单日峰值 /
             零打卡天数 / 件均），样本清零后它们恒为 0，全部换掉。
             「季度目标完成率」与「累计活动量总分」不可手改，其余 6 项在
             「设置数据」抽屉里改 —— 所以只有这两张卡不带「手动维护」的语义。 -->
        <div class="grid g4" style="margin-bottom:16px;">
          <div class="stat">
            <div class="stat-top"><span class="stat-label">累计活动量总分</span><span class="stat-ico"><i class="fa-solid fa-star"></i></span></div>
            <div class="stat-num gold-text" id="kScore">—</div>
            <div class="stat-foot"><span id="kScoreFoot">连续 <b>—</b> 天 · 最长 <b>—</b> 天</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">本月业绩</span><span class="stat-ico"><i class="fa-solid fa-calendar-day"></i></span></div>
            <div class="stat-num gold-text" id="kMonthPerf">—</div>
            <div class="stat-foot"><span id="kMonthPerfFoot">占本季度业绩 <b>—</b></span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">本季度业绩</span><span class="stat-ico"><i class="fa-solid fa-chart-simple"></i></span></div>
            <div class="stat-num gold-text" id="kQuarterPerf">—</div>
            <div class="stat-foot"><span id="kQuarterPerfFoot">占本年度业绩 <b>—</b></span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">本年度业绩</span><span class="stat-ico"><i class="fa-solid fa-chart-line"></i></span></div>
            <div class="stat-num gold-text" id="kYearPerf">—</div>
            <div class="stat-foot"><span id="kYearPerfFoot">年度累计</span></div>
          </div>
        </div>

        <div class="grid g4">
          <div class="stat">
            <div class="stat-top"><span class="stat-label">季度目标业绩</span><span class="stat-ico"><i class="fa-solid fa-bullseye"></i></span></div>
            <div class="stat-num gold-text" id="kQuarterGoal">—</div>
            <div class="stat-foot"><span id="kQuarterGoalFoot">完成率的分母</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">季度目标完成率</span><span class="stat-ico"><i class="fa-solid fa-percent"></i></span></div>
            <div class="stat-num gold-text" id="kQuarterRate">—</div>
            <div class="stat-foot"><span id="kQuarterRateFoot">本季度业绩 ÷ 季度目标业绩</span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">季度成交单数</span><span class="stat-ico"><i class="fa-solid fa-file-signature"></i></span></div>
            <div class="stat-num gold-text" id="kQuarterDeals">—</div>
            <div class="stat-foot"><span id="kQuarterDealsFoot">件均 <b>—</b></span></div>
          </div>
          <div class="stat">
            <div class="stat-top"><span class="stat-label">季度成交保费</span><span class="stat-ico"><i class="fa-solid fa-coins"></i></span></div>
            <div class="stat-num gold-text" id="kQuarterPremium">—</div>
            <div class="stat-foot"><span id="kQuarterPremiumFoot">本季度累计</span></div>
          </div>
        </div>
'''
sub('总览 8 卡重写', OLD_CARDS, NEW_CARDS)

# ── ⑤ 「源表口径校验」整块删除 → 该行改通栏 ───────────────────────────────
OLD_ROW = '''        <!-- g-fill：图表长满面板；同行伙伴「源表口径校验」是列表，高度由它决定 -->
        <div class="grid g2-13 g-fill" style="margin-top:16px;">
          <div class="panel">
            <div class="panel-head"><span class="pt"><i class="fa-solid fa-flag-checkered"></i>周保费 vs 周目标</span><span class="pl">首周 4 天按 ¥8,750 计</span></div>
            <div class="chart-box sm"><canvas id="chWeekGoal"></canvas></div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="pt"><i class="fa-solid fa-clipboard-check"></i>源表口径校验</span><span class="pl">重算 vs 源模板</span></div>
            <div class="audit" id="auditBox"><div class="empty"><i class="fa-solid fa-hourglass-half"></i>正在核对…</div></div>
          </div>
        </div>
'''
# 墓碑：一律用块注释（构建门禁的 probe_html 只剥 /* */，行注释里的字样会
# 被「必须缺席」断言命中 —— 正确删除反被自己的说明文字判成违规）。
NEW_ROW = '''        <!-- 通栏（原为 1fr : 1.55fr 双栏，右半是「源表口径校验」）。
             该模块按公子指令整体移除，并排的伙伴随之消失 ——
             这里不是「补留白」，而是并排本身没了，留白从结构上不存在。 -->
        <div class="panel" style="margin-top:16px;">
          <div class="panel-head"><span class="pt"><i class="fa-solid fa-flag-checkered"></i>周保费 vs 周目标</span><span class="pl">各周目标可在「设置数据」里逐周调整</span></div>
          <div class="chart-box sm"><canvas id="chWeekGoal"></canvas></div>
        </div>
'''
sub('删源表口径校验并改通栏', OLD_ROW, NEW_ROW)

# ── ⑥ 今日打卡：计分项说明（12 项 / 23 分）──────────────────────────────
sub('计分项说明',
    '<span class="pl">分值取自源模板计分说明 · 11 项计分 · 1 项仅记录</span>',
    '<span class="pl">12 项计分 · 单轮满分 23 分 · 点「＋」即计入今日得分</span>')

# ── ⑦ 今日打卡：窗口外提示（窗口到期后「今天」不在面板内）──────────────────
sub('窗口外提示',
    '''          <div class="sd-band">
            <div class="score-big">''',
    '''          <div class="today-out" id="todayHint" hidden></div>

          <div class="sd-band">
            <div class="score-big">''')

# 「样本日均」参照文案：窗口清零后不再有「样本」，改为中性说法
sub('今日对照文案默认值',
    '<div class="sb-sub" id="todayCompare">样本日均 <b>15.1</b> 分为参照</div>',
    '<div class="sb-sub" id="todayCompare">与本窗日均对照</div>')

# ── ⑧ 成功方程式：去掉源表坐标 ──────────────────────────────────────────
sub('方程式副标题',
    '<span class="sec-sub" id="funnelSub">三段转化 · 口径严格镜像源模板 F35 / F36 / F37</span>',
    '<span class="sec-sub" id="funnelSub">三段转化 · 分子分母均取自计分项</span>')
sub('目标比率默认文案',
    '<span class="pl" id="ratioSrc">源表：约访：需求分析：方案呈现：成交=15：9：6：3</span>',
    '<span class="pl" id="ratioSrc">约访：需求分析：方案呈现：促成签单 = 15：9：6：3</span>')
sub('三段转化率参考值说明',
    '<span class="pt"><i class="fa-solid fa-percent"></i>三段转化率</span><span class="pl">参考值沿用源表文本</span>',
    '<span class="pt"><i class="fa-solid fa-percent"></i>三段转化率</span><span class="pl">参考下限 50% / 67% / 50%</span>')

# ── ⑨ 页脚（公子指令 ⑥ 的原文）──────────────────────────────────────────
sub('页脚文案',
    '<div class="footer-note">公子的活动量面板 · 口径源自活动量模板 v1 · 数据仅存本机浏览器</div>',
    '<div class="footer-note">展业活动量面板 · 数据仅存本机浏览器</div>')

# ── ⑩ 设置抽屉：副标题 + 恢复按钮 ───────────────────────────────────────
sub('抽屉副标题',
    '<div class="dh-sub">逐日 30 天的 12 项活动量与当日保费、以及目标参数<br>改动先在此抽屉内预演重算结果，点「保存并应用」才写入本机浏览器</div>',
    '<div class="dh-sub">逐日 30 天的 12 项活动量、当日保费、各周目标，以及 6 项业务指标<br>改动先在此抽屉内预演重算结果，点「保存并应用」才写入本机浏览器</div>')
# 按钮文案：既不许出现「重置」（铁律 15 的探针会红），也不该再叫「源模板」
# （源模板已不在本面板的口径里，那个名字指向不存在之物）。
sub('恢复按钮文案',
    'title="清空改动，回到源模板数据" hidden><i class="fa-solid fa-rotate-left"></i><span>恢复源模板数据</span>',
    'title="放弃本机改动，回到初始数据" hidden><i class="fa-solid fa-rotate-left"></i><span>恢复初始数据</span>')

# ── 自检：GONE（旧字样一个不留）/ NEED（新结构全在场）────────────────────
# ⚠️ GONE 必须判在**去掉注释**的文本上（铁律 10 第 ④ 类假绿）：
#    上面新增的墓碑注释里就写着被删模块的名字（那是刻意的说明），
#    拿原文去查，「正确的删除」会被自己的说明文字判成违规。
#    注释的两类写法都要剥：CSS/JS 的 /* */ 与 HTML 的 <!-- -->。
probe = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
probe = re.sub(r'<!--.*?-->', '', probe, flags=re.S)

GONE = [
    '源表口径校验', '源模板', '源表', 'auditBox',
    # 裸 'kPrem' 不能作判据：今日打卡的进度条 id 是 wkPremVal / wkPremTgt，
    # 里面含子串 kPrem —— 这正是「断言判在文中出现过的字符序列上」那类假绿
    # （反向也一样：假红）。判据必须带引号，落到 id="..." 这个对象上。
    'id="kPrem"', 'id="kDays"', 'id="kMdrt"', 'id="kRate"', 'id="kDeals"',
    'id="kPeak"', 'id="kZero"',
    'MDRT', 'mdrt', 'F35', 'F36', 'F37', '成交家庭', '家庭数',
    '月目标完成率', '本期成交保费', '打卡天数', '零打卡天数', '单日最高得分',
    '文章/视频', '朋友圈', '11 项计分', '15.1',
]
NEED = [
    'id="kScore"', 'id="kMonthPerf"', 'id="kQuarterPerf"', 'id="kYearPerf"',
    'id="kQuarterGoal"', 'id="kQuarterRate"', 'id="kQuarterDeals"', 'id="kQuarterPremium"',
    'id="kScoreFoot"', 'id="kMonthPerfFoot"', 'id="kQuarterPerfFoot"', 'id="kYearPerfFoot"',
    'id="kQuarterGoalFoot"', 'id="kQuarterRateFoot"', 'id="kQuarterDealsFoot"',
    'id="kQuarterPremiumFoot"',
    'id="todayHint"', 'id="chWeekGoal"', 'id="checkGrid"', 'id="weekChips"',
    'id="ledgerHead"', 'id="setDrawer"', 'id="btnRestore"', 'id="toast"',
    '展业活动量面板 · 数据仅存本机浏览器', '12 项计分 · 单轮满分 23 分',
    'v1.2', 'V1.2',
]
bad = []
for t in GONE:
    if t in probe:
        bad.append('旧字样未清: %s' % t)
for t in NEED:
    if t not in probe:
        bad.append('缺少: %s' % t)
if bad:
    print('!! 自检失败：')
    for b in bad:
        print('   -', b)
    sys.exit(1)

io.open(P, 'w', encoding='utf-8').write(src)
print('body.html: %d → %d 字符' % (orig_len, len(src)))
for s in STEPS:
    print('  ✅', s)
print('   ✅ 自检：%d 项旧字样已清 / %d 项新结构在场（均判在去注释文本上）'
      % (len(GONE), len(NEED)))
