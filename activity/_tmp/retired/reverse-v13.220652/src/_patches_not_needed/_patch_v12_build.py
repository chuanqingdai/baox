#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 补丁 · src/build.py（构建期门禁同步）

为什么要走脚本而不是手改：
  ① build.py 的断言分处五段（文档串 / meta / MUST / MUST_NOT / 门禁 D），
     手改五处容易漏，且漏掉的那处**不会报错** —— 门禁照跑、照绿，
     只是从今以后不再守着那个事实（断言缺失是静默的）。
  ② 每条替换都配「前置条件 + 落地自检」：前置条件证明**上游改造已完成**
     （否则我把 MUST 改成 id="kScore" 而 body.html 里没有，构建立刻红，
     定位成本全落在这一层）；落地自检证明**本次替换真的写进了文件**
     （同一文件的多次写入曾静默丢失，见项目教训）。

改了什么（v1.2）：
  §① VERSION v1.1 → v1.2（归档名里的版本号 = 归档的自我声明，铁律 17）
  §② 文档串：门禁 E 的基准降级说明（删掉源表口径校验的代价）
  §③ meta description：去掉已删模块「源表口径校验」
  §④ MUST 的 7 个旧 KPI id → 8 个新 id（用户裁定：总览 8 项重定义）
  §⑤ 删 MUST['口径校验（总览）']，并写清口径证明链现在落在哪
  §⑥ 删 MUST['源表口径对照']；基线键 baox.act.data → baox.act.data.v2
  §⑦ MUST_NOT 新增 10 条反向断言：7 个旧 KPI id + auditBox + sourceComparison
      （只把条目从 MUST 删掉 = 放弃断言，不是「断言它没回来」）
  §⑧ 门禁 D：targets 键集合恰好 {week}；周目标改为「各周统一」
      （v1.1 判的是相反的事 —— 首周不满 7 天应折半；种子重建后首周 3 天
       却统一 17500，旧断言会把**正确数据**判成违规）
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
P = os.path.join(BASE, 'build.py')


def sub(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit('!! %s：期望命中 1 处，实为 %d 处 —— 源码已变，先核对再改。'
                 % (label, n))
    print('   ✓ %s' % label)
    return text.replace(old, new, 1)


def main():
    src = io.open(P, encoding='utf-8').read()
    orig = src

    # ---------- 前置条件：上游（body.html / app.js）改造必须已落地 ----------
    # 这些 id 若还在上游，说明渲染层没删干净；此时把 MUST_NOT 加上去，
    # 只会让构建在我这一层报「不应出现」，指向完全错误的地方。
    import re as _re

    def decomment(t):
        """剥掉块注释与整行注释 —— 前置条件必须判在**去注释**文本上。

        由来（本轮实测）：app.js 有两处块注释**刻意**写着
        「core.js 的 sourceComparison() 与 verify-runtime 第 ⑦ 关已一并删除」，
        那是历史陈述、过去时、准确。若拿原文做前置检查，这两条说明文字会把
        「改造已完成」判成「改造未完成」—— 与产物门禁里「必须缺席判在去注释
        文本上」是同一条道理，只是这次踩在**前置检查**上。
        """
        t = _re.sub(r'/\*.*?\*/', '', t, flags=_re.S)
        t = _re.sub(r'^\s*//.*$', '', t, flags=_re.M)
        return t

    upstream = {}
    for f in ('body.html', 'app.js'):
        upstream[f] = io.open(os.path.join(BASE, f), encoding='utf-8').read()
    # 判据落在这份「去注释」文本上；原文另存一份用于最后核对该标识符
    # 只出现在注释里（若出现在真实代码里，说明上游没删干净）。
    alltxt = decomment(upstream['body.html']) + '\n' + decomment(upstream['app.js'])

    old_ids = ['id="kDays"', 'id="kPrem"', 'id="kMdrt"', 'id="kRate"',
               'id="kDeals"', 'id="kPeak"', 'id="kZero"', 'id="auditBox"']
    stale = [s for s in old_ids if s in alltxt]
    if stale:
        sys.exit('!! 前置条件不满足：上游仍含 %s —— 请先完成 body.html / app.js '
                 '的删除，再同步本层门禁。' % stale)
    if 'sourceComparison' in alltxt:
        sys.exit('!! 前置条件不满足：上游仍含 sourceComparison')
    # 真实代码里必须为零（注释里那两处历史陈述不算）：门禁 A 的「必须缺席」
    # 判在 probe_html（已剥块注释）上，所以只要**代码**里没有，断言就安全。
    core_real = decomment(io.open(os.path.join(BASE, 'core.js'), encoding='utf-8').read())
    if 'sourceComparison' in core_real:
        sys.exit('!! 前置条件不满足：core.js 真实代码仍含 sourceComparison')
    new_ids = ['id="kScore"', 'id="kMonthPerf"', 'id="kQuarterPerf"',
               'id="kYearPerf"', 'id="kQuarterGoal"', 'id="kQuarterRate"',
               'id="kQuarterDeals"', 'id="kQuarterPremium"']
    miss = [s for s in new_ids if s not in upstream['body.html']]
    if miss:
        sys.exit('!! 前置条件不满足：body.html 缺新 KPI 卡 %s' % miss)
    print('前置条件通过：旧 %d 个锚点已在上游消失，新 8 卡已在上游就位'
          % len(old_ids))

    # ---------- §① 版本号 ----------
    src = sub(src, "VERSION = 'v1.1'", "VERSION = 'v1.2'", '§① VERSION → v1.2')

    # ---------- §② 门禁 E 的基准降级说明 ----------
    src = sub(
        src,
        "         总量、单日、单周、漏斗三段、KPI 文本，不是「条数相等」这种弱判定。\n",
        "         总量、单日、单周、漏斗三段、KPI 文本，不是「条数相等」这种弱判定。\n"
        "         ⚠️ v1.2 删掉「源表口径校验」后，本关的基准**降级**了：\n"
        "         原先尚可拿源表「总」行当外部权威，如今只剩两份实现互比 ——\n"
        "         抓得住分叉，抓不住两边一起错。这是删模块的真实代价，写在这里\n"
        "         免得后人以为「本关通过 = 数字一定对」。\n",
        '§② 门禁 E 基准降级说明')

    # ---------- §③ meta description ----------
    src = sub(
        src,
        "'周目标达成、成功方程式转化与源表口径校验\">\\n'",
        "'周目标达成、成功方程式转化与业务指标看板\">\\n'",
        '§③ meta description 去「源表口径校验」')

    # ---------- §④ MUST 的 KPI 卡 ----------
    src = sub(
        src,
        "        # ── 首屏 KPI（渲染是否落地的直接证据）──\n"
        "        'KPI打卡天数': 'id=\"kDays\"',\n"
        "        'KPI累计总分': 'id=\"kScore\"',\n"
        "        'KPI本期保费': 'id=\"kPrem\"',\n"
        "        'KPI MDRT': 'id=\"kMdrt\"',\n"
        "        'KPI月达标率': 'id=\"kRate\"',\n"
        "        'KPI成交单数': 'id=\"kDeals\"',\n"
        "        'KPI单日峰值': 'id=\"kPeak\"',\n"
        "        'KPI零分天数': 'id=\"kZero\"',\n",
        "        # ── 首屏 KPI（渲染是否落地的直接证据）──\n"
        "        # v1.2 按用户裁定整体重定义：v1.1 的 8 卡里有 4 张（打卡天数 /\n"
        "        # 单日峰值 / 零分天数 / 月达标率）是「回溯样本」的统计量，\n"
        "        # 数据清空后它们恒为 0/空，占着首屏却不提供任何决策信息。\n"
        "        # 换成「总分 + 3 档业绩 + 季度目标口径」后，8 张全部有值。\n"
        "        # ⚠️ 判据必须一一列出 id，不能用「有 8 个 k 开头的 id」这种\n"
        "        #    计数式断言：计数命中 0 也算通过（本项目已有先例）。\n"
        "        'KPI累计活动量总分': 'id=\"kScore\"',\n"
        "        'KPI本月业绩': 'id=\"kMonthPerf\"',\n"
        "        'KPI本季度业绩': 'id=\"kQuarterPerf\"',\n"
        "        'KPI本年度业绩': 'id=\"kYearPerf\"',\n"
        "        'KPI季度目标业绩': 'id=\"kQuarterGoal\"',\n"
        "        'KPI季度目标完成率': 'id=\"kQuarterRate\"',\n"
        "        'KPI季度成交单数': 'id=\"kQuarterDeals\"',\n"
        "        'KPI季度成交保费': 'id=\"kQuarterPremium\"',\n",
        '§④ MUST 8 张新 KPI 卡')

    # ---------- §⑤ 删「口径校验（总览）」 ----------
    src = sub(
        src,
        "        # ── 源表口径校验（只留总览摘要）────────────────────────────────────\n"
        "        # v1.1 按用户裁定删掉「逐列对照」证据表（#auditFull / rules-tb col-tb）：\n"
        "        # 页面不再逐格披露源表公式缺陷。\n"
        "        # ⚠️ 删的是**展示**，不是**口径**：src/core.js 的 sourceComparison().columns\n"
        "        #    仍在场，并仍由 verify-runtime.cjs 第 ⑦ 关逐列比对判定标签（三分支\n"
        "        #    一致 / 截断 / 未纳入）。这里若把「源表口径对照」一并拿掉，\n"
        "        #    整条口径证明链就断了 —— 页面变干净，代价是再也没人守着这件事。\n"
        "        '口径校验（总览）': 'id=\"auditBox\"',\n"
        "        # ── 四张图表 ──\n",
        "        # ── v1.2：源表口径校验整模块移除 ───────────────────────────────\n"
        "        # v1.1 还留着一个总览摘要（#auditBox），v1.2 按用户裁定连摘要一并删除，\n"
        "        # core.js 的 sourceComparison() 与其逐列比对也同步下线。\n"
        "        # ⚠️ 于是「唯一口径」的证明链**只剩一条**：expected.py（构建期）与\n"
        "        #    core.js（运行期）两份实现逐值互比。它是互比、不是对照外部权威，\n"
        "        #    两边一起错时不响 —— 这个代价已写进门禁 E 的文档串与\n"
        "        #    verify-runtime.cjs 的文件头，此处不再重复断言已不存在的模块。\n"
        "        # ── 四张图表 ──\n",
        '§⑤ 删「口径校验（总览）」+ 改写说明')

    # ---------- §⑥ 删「源表口径对照」+ 基线键改 v2 ----------
    src = sub(
        src,
        "        '源表口径对照': 'function sourceComparison',\n"
        "        '基线覆盖层键': 'baox.act.data',\n",
        "        # v1.2 的持久化键带版本号：旧键（baox.act.data / baox.act.log）里\n"
        "        # 存着上一版窗口（2022 年样本）的 390 格数据，若沿用同一键，\n"
        "        # 覆盖层会按**旧日期**并回**新种子**，得到一份两边都不对的混合体。\n"
        "        # 换键让旧数据自然失效（不删、不迁移），代价只是用户需重新打卡 ——\n"
        "        # 而本次用户要求的正是「清空所有活动数据」。\n"
        "        '基线覆盖层键': 'baox.act.data.v2',\n",
        '§⑥ 删「源表口径对照」+ 基线键 → v2')

    # ---------- §⑦ MUST_NOT 反向断言 ----------
    src = sub(
        src,
        "        '周进度区块残留（锚点）': 'id=\"weekly\"',\n"
        "        '计分说明区块残留（锚点）': 'id=\"rules\"',\n",
        "        '周进度区块残留（锚点）': 'id=\"weekly\"',\n"
        "        '计分说明区块残留（锚点）': 'id=\"rules\"',\n"
        "        # ── v1.2 移除的内容，同 v1.1 一样必须有反向断言 ────────────────\n"
        "        # 只把条目从 MUST 里删掉，等于放弃断言：下次谁把旧 KPI 卡复制回来，\n"
        "        # 页面会多出一张**永久空白**的卡（渲染层已无对应写值函数），\n"
        "        # 而门禁一声不响。\n"
        "        '旧 KPI 打卡天数残留': 'id=\"kDays\"',\n"
        "        '旧 KPI 本期保费残留': 'id=\"kPrem\"',\n"
        "        '旧 KPI MDRT 残留': 'id=\"kMdrt\"',\n"
        "        '旧 KPI 月达标率残留': 'id=\"kRate\"',\n"
        "        '旧 KPI 成交单数残留': 'id=\"kDeals\"',\n"
        "        '旧 KPI 单日峰值残留': 'id=\"kPeak\"',\n"
        "        '旧 KPI 零分天数残留': 'id=\"kZero\"',\n"
        "        '源表口径校验模块残留': 'id=\"auditBox\"',\n"
        "        # 这条判据不带引号，所以必须确认它不会命中墓碑注释：产物里确有\n"
        "        # 两处 `/* */` 块注释提到该标识符（在讲清「已删除」）。门禁 A 的\n"
        "        # 「必须缺席」一律判在**去注释**文本（probe_html）上，故不会假阳性 ——\n"
        "        # 前提是它只出现在注释里，这一点由本补丁的前置检查逐文件核对。\n"
        "        '源表口径对照实现残留': 'sourceComparison',\n",
        '§⑦ MUST_NOT 新增 10 条反向断言')

    # ---------- §⑧ 门禁 D：目标参数与周目标口径 ----------
    src = sub(
        src,
        "    if not tg.get('week') or not tg.get('month'):\n"
        "        dstat.append('targets 缺少 week/month 目标值')\n"
        "    # 首周目标口径：首周不满 7 天时周目标应折半（源表就是这么定的）\n"
        "    for w in weeks:\n"
        "        if w.get('dayCount', 0) < 7 and w.get('target') == tg.get('week'):\n"
        "            dstat.append('第 %s 周只有 %s 天，却用了整周目标 %s'\n"
        "                         % (w.get('idx'), w.get('dayCount'), tg.get('week')))\n",
        "    # v1.2 目标参数只剩「周目标」：MDRT 与月目标已按用户裁定删除。\n"
        "    # 这里断言键集合**恰好**是 {week}：只判 tg.get('week') 在场的话，\n"
        "    # 谁把 month/mdrt 加回来都不会响，而它们是被明确删掉的口径。\n"
        "    if set(tg.keys()) != {'week'}:\n"
        "        dstat.append('targets 键应恰为 {week}，实为 %s（MDRT/月目标已删除）'\n"
        "                     % sorted(tg.keys()))\n"
        "    if not num(tg.get('week')):\n"
        "        dstat.append('targets.week 缺失或为 0 —— 周目标图会整条贴地')\n"
        "    # 周目标口径（v1.2 起为「各周统一」）：\n"
        "    # v1.1 这里判的是**相反**的事 ——「首周不满 7 天则周目标应折半」。\n"
        "    # 种子重建后窗口自 2026-09-18（周五）起算，首周只有 3 天、末周 6 天，\n"
        "    # 但用户裁定各周目标统一 17500；旧断言会把这份**正确**数据判成违规。\n"
        "    # 教训：口径随数据重建而变时，门禁里那条「描述旧口径」的断言必须\n"
        "    #       跟着改 —— 否则它会在下一次正确的重建上炸，看起来像数据错了。\n"
        "    for w in weeks:\n"
        "        if num(w.get('target')) != num(tg.get('week')):\n"
        "            dstat.append('第 %s 周目标 %s 与 targets.week=%s 不一致'\n"
        "                         % (w.get('idx'), w.get('target'), tg.get('week')))\n",
        '§⑧ 门禁 D 目标参数与周目标口径')

    if src == orig:
        sys.exit('!! 没有任何改动落地')

    io.open(P, 'w', encoding='utf-8').write(src)

    # ---------- 落地自检：逐条回查**文件里的真实文本** ----------
    got = io.open(P, encoding='utf-8').read()
    NEED = [
        "VERSION = 'v1.2'",
        '业务指标看板',
        "        'KPI累计活动量总分': 'id=\"kScore\"',",
        "        'KPI季度成交保费': 'id=\"kQuarterPremium\"',",
        "'基线覆盖层键': 'baox.act.data.v2',",
        "'源表口径校验模块残留': 'id=\"auditBox\"',",
        "'源表口径对照实现残留': 'sourceComparison',",
        "if set(tg.keys()) != {'week'}:",
        '各周统一',
    ]
    GONE = [
        "VERSION = 'v1.1'",
        "'KPI打卡天数': 'id=\"kDays\"',",
        "'KPI MDRT': 'id=\"kMdrt\"',",
        "'口径校验（总览）': 'id=\"auditBox\"',",
        "'源表口径对照': 'function sourceComparison',",
        "'基线覆盖层键': 'baox.act.data',",
        "targets 缺少 week/month 目标值",
    ]
    # 「必须缺席」判在**去注释**文本上：
    # 本轮新写的说明注释里刻意提到了 'id="auditBox"' 这类字符串（讲清删了什么），
    # 若连注释一起查，正确的改动会被自己的说明文字判成违规（本项目反复踩过）。
    import re as _re
    stripped = _re.sub(r'#.*$', '', got, flags=_re.M)

    bad = []
    for s in NEED:
        if s not in got:
            bad.append('缺少: %s' % s)
    for s in GONE:
        if s in stripped:
            bad.append('未清除: %s' % s)
    # 关键：'baox.act.data' 是 'baox.act.data.v2' 的子串，单看会判不出差异 ——
    # 所以把带引号的完整键单独判一次（这正是「断言判在子串上」的老陷阱）。
    if "'baox.act.data'," in stripped or "'baox.act.data'" in stripped:
        bad.append('旧基线键仍以完整字面量出现（不能靠子串判等）')
    # 计数类断言：有没有那 10 条 MUST_NOT（连计数本身一起断言）
    n_not = stripped.count('残留')
    if n_not < 20:
        bad.append('MUST_NOT 条目数异常偏少（含"残留"字样仅 %d 处）' % n_not)

    if bad:
        # 自检失败即回滚，绝不留下半改状态：fail-safe 比 fail-fast 重要 ——
        # 半改的 build.py 会在下一次构建里以「断言失败」的形式炸，
        # 指向的是页面，而问题其实在这一层。
        io.open(P, 'w', encoding='utf-8').write(orig)
        sys.exit('!! 自检失败（已回滚 build.py）：\n     - ' + '\n     - '.join(bad))

    print('build.py: %d → %d 字符' % (len(orig), len(got)))
    print('自检通过：%d 项必须在场 / %d 项必须清除（去注释后判定）'
          % (len(NEED), len(GONE)))


if __name__ == '__main__':
    main()
