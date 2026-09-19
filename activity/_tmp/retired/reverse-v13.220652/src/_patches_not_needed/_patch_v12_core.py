#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 改造 · core.js（唯一口径计算层）

每步断言锚点唯一，不符即 sys.exit 且**不写盘** ——
半改的文件比没改更危险：它会带着「改过了」的假象继续进构建。

语义提醒（本项目踩过）：下面的删除一律是 [start, end) —— **end 锚点本身会被保留**。
所以 end 必须取「下一段的起始标记」，不能取「要删的最后一行」。
"""
import ast  # noqa: F401  (仅为了与本项目其它脚本保持同一自检习惯)
import os
import re
import sys

P = 'src/core.js'
src = open(P, encoding='utf-8').read()
orig = len(src)

CUTS = []   # (start, end, label)
REPL = []   # (old, new, label)


# ─────────────────────────────── 删除段（[start, end)）
CUTS.append((
    '  /** 源表口径对照（用于把源模板的口径缺陷摊开讲清楚） */',
    '  /* ------------------------------------------------------------------ 导出 */',
    '删 sourceComparison（源表口径校验的唯一实现）',
))


# ─────────────────────────────── 替换段
REPL.append((
    """   口径约定
     · 单日得分 = Σ(次数 × 分值)，分值取自源模板活动量 3.xlsx 的计分说明
     · 「成交家庭数」不计分（源表标注「不计」）
     · 周区间沿用源表 O/P/Q/S 列的纵向合并块（首周 4 天、末周 5 天）
     · 首周周目标 8750、其余周 17500、月目标 70000（源表 P35）""",
    """   口径约定
     · 单日得分 = Σ(次数 × 分值)，12 项计分项，单轮满分 23 分
     · 统计窗口自 2026-09-18 起 30 天；周区间按**自然周**（周一–周日）切分
       （首周 3 天、末周 6 天 —— 自然周的定义使然，不是缺陷）
     · 各周保费目标逐周给出（默认 17500），可在「设置数据」里逐周改
     · 业务指标六项手动维护；唯一派生值「季度目标完成率」
       = 本季度业绩 / 季度目标业绩 × 100%""",
    '更新口径约定注释（去源模板引用）',
))

REPL.append((
    """  var UNSCORED = SEED.unscored || [];
  var TARGETS = SEED.targets || {};""",
    """  var UNSCORED = SEED.unscored || [];
  var TARGETS = SEED.targets || {};
  var BIZ = SEED.biz || {};""",
    '引入 SEED.biz',
))

REPL.append((
    "    var counts = {}, score = 0, premium = 0, closeCount = 0, familyCount = 0;",
    "    var counts = {}, score = 0, premium = 0, closeCount = 0;",
    'aggregate 去掉 familyCount 累加器',
))

REPL.append((
    """      closeCount += num(d.close);
      familyCount += num(d.family);""",
    """      closeCount += num(d.close);""",
    'aggregate 去掉 family 累加',
))

REPL.append((
    """      closeCount: closeCount,
      familyCount: familyCount,""",
    """      closeCount: closeCount,""",
    'aggregate 返回值去掉 familyCount',
))

REPL.append((
    """        closeCount: agg.closeCount, familyCount: agg.familyCount,""",
    """        closeCount: agg.closeCount,""",
    'weekRows 去掉 familyCount',
))

REPL.append((
    """  /**
   * 三段转化率。严格镜像源表 F35/F36/F37 的公式方向：
   *   约访成功率   = 需求分析 / 约访      （源 F35 = F33/E33）
   *   面谈成功率   = 方案呈现 / 需求分析  （源 F36 = G33/F33）
   *   方案促成率   = 成交家庭数 / 方案呈现（源 F37 = I33/G33）
   * 源表存的是比值（3.667），面板按百分比呈现（366.7%），参考值直接沿用源表文本。
   */
  function funnelOf(agg) {
    var c = agg.counts;
    var defs = [
      { label: '约访 → 需求分析', numKey: 'need', denKey: 'visit', ref: '≥50%', srcCell: 'F35' },
      { label: '需求分析 → 方案呈现', numKey: 'plan', denKey: 'need', ref: '≥67%', srcCell: 'F36' },
      { label: '方案呈现 → 促成签单', numKey: 'family', denKey: 'plan', ref: '≥50%', srcCell: 'F37' }
    ];
    return defs.map(function (d) {
      var n = c[d.numKey] || 0, den = c[d.denKey] || 0;
      var ratio = den ? n / den : 0;
      return {
        label: d.label, ref: d.ref, srcCell: d.srcCell,""",
    """  /**
   * 三段转化率。三段的分子分母**全部落在计分项上**，不再有「仅记录项」参与：
   *   约访成功率 = 需求分析 / 约访
   *   面谈成功率 = 方案呈现 / 需求分析
   *   方案促成率 = 促成签单 / 方案呈现
   *
   * 第 3 段原为 成交家庭数 / 方案呈现。公子指令把漏斗第 4 级「成交家庭」改为
   * 「促成签单」，数值来源一并切换 —— 于是「成交家庭数」这个仅记录项失去了
   * 唯一用途，已从种子里删除。留下的好处：漏斗与三段转化率的口径同源，
   * 明细表里的「促成签单」次数就是漏斗第 4 级的数值，不会再出现
   * 「两个『促成签单』数值不同」这种解释不清的状态。
   *
   * id（S1/S2/S3）取代了原 srcCell（F35/F36/F37）：源模板已不再被引用，
   * 再用单元格坐标当标识就是留着一个指向不存在之物的名字。
   */
  function funnelOf(agg) {
    var c = agg.counts;
    var defs = [
      { label: '约访 → 需求分析', numKey: 'need', denKey: 'visit', ref: '≥50%', id: 'S1' },
      { label: '需求分析 → 方案呈现', numKey: 'plan', denKey: 'need', ref: '≥67%', id: 'S2' },
      { label: '方案呈现 → 促成签单', numKey: 'close', denKey: 'plan', ref: '≥50%', id: 'S3' }
    ];
    return defs.map(function (d) {
      var n = c[d.numKey] || 0, den = c[d.denKey] || 0;
      var ratio = den ? n / den : 0;
      return {
        label: d.label, ref: d.ref, id: d.id,""",
    'funnelOf 第 3 段改用 close，srcCell → id',
))

REPL.append((
    """  /** 源表 A38 的目标比率「约访：需求分析：方案呈现：成交=15：9：6：3」 */
  function targetRatio() {
    return { visit: 15, need: 9, plan: 6, family: 3 };
  }""",
    """  /** 目标比率「约访：需求分析：方案呈现：促成签单 = 15：9：6：3」 */
  function targetRatio() {
    return { visit: 15, need: 9, plan: 6, close: 3 };
  }""",
    'targetRatio 的 family 键改 close',
))

REPL.append((
    """  var LS_LOG = 'baox.act.log';""",
    """  /* 键名带 .v2：v1.2 把统计窗口整体挪到 2026-09-18 起，旧记录里的 2022 年日期
     已不属于本窗口。不删旧键（改名即可让新代码看不见它），也不做「按日期过滤」——
     过滤要在每个读点都写一遍，漏一处就冒出一个 2022 年的幽灵日期。
     换键是一次性的，且旧数据仍在浏览器里可查。 */
  var LS_LOG = 'baox.act.log.v2';""",
    'LS_LOG 升版 .v2',
))

REPL.append((
    """      var rec = { date: d, dow: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][p.getDay()],
                  serial: 0, premium: num(log[d].premium), local: true, note: log[d].note || '' };""",
    """      var rec = { date: d, dow: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][p.getDay()],
                  premium: num(log[d].premium), local: true, note: log[d].note || '' };""",
    'mergedDays 去掉 Excel serial 遗留字段',
))

REPL.append((
    """  /* ------------------------------------------------------------------ 汇总 */

  function computeAll() {""",
    """  /* --------------------------------------------------------------- 业务指标 */

  /**
   * 六项业务指标全部手动维护（在「设置数据」里改），本函数只做两件事：
   *   ① 把存储值规整成数字（空 / 非法一律按 0，避免 NaN 渗进渲染）
   *   ② 算出唯一的派生值「季度目标完成率」
   *
   * 除法方向写死在函数内、不暴露参数：
   *   本季度业绩 ÷ 季度目标业绩 —— 反过来是「离目标还差多少倍」，
   *   两者数值相近但含义相反，属于「传错不报错」的那一类，不该留出传反的入口。
   *   分母为 0 时返回 0（而非 Infinity / NaN）：页面上统一显示 0.0%。
   */
  function bizMetrics() {
    var qp = num(BIZ.quarterPerf), qg = num(BIZ.quarterGoal);
    return {
      monthPerf: num(BIZ.monthPerf),
      quarterPerf: qp,
      yearPerf: num(BIZ.yearPerf),
      quarterGoal: qg,
      quarterDeals: num(BIZ.quarterDeals),
      quarterPremium: num(BIZ.quarterPremium),
      quarterRate: qg ? round(qp / qg * 100, 1) : 0
    };
  }

  /* ------------------------------------------------------------------ 汇总 */

  function computeAll() {""",
    '新增 bizMetrics()',
))

REPL.append((
    """    var localAgg = aggregate(localDates);
    var monthRate = TARGETS.month ? round(histAgg.premium / TARGETS.month * 100, 1) : 0;
    var mdrt = round(num(TARGETS.mdrtCarry) + histAgg.premium, 2);
    return {""",
    """    var localAgg = aggregate(localDates);
    return {""",
    'computeAll 去掉 monthRate / mdrt 计算',
))

REPL.append((
    """      streakLongest: longestStreak(hist),
      monthRate: monthRate,
      mdrt: mdrt,
      weekRowsAll: weekRows(all),""",
    """      streakLongest: longestStreak(hist),
      biz: bizMetrics(),
      weekRowsAll: weekRows(all),""",
    'computeAll 返回值换成 biz',
))

REPL.append((
    """    computeAll: computeAll,
    sourceComparison: sourceComparison,
    localLog: localLog,""",
    """    computeAll: computeAll,
    bizMetrics: bizMetrics,
    localLog: localLog,""",
    '导出表去掉 sourceComparison、加 bizMetrics',
))


# ─────────────────────────────── 执行
def apply():
    global src
    for start, end, label in CUTS:
        i = src.find(start)
        j = src.find(end)
        assert i >= 0, '删除起点未找到：%s（%s）' % (start[:40], label)
        assert j > i, '删除终点未找到或位于起点之前：%s（%s）' % (end[:40], label)
        assert src.count(start) == 1, '删除起点不唯一：%s' % start[:40]
        n = j - i
        src = src[:i] + src[j:]
        print('  ✅ %-46s 删除 %d 字符' % (label, n))
    for old, new, label in REPL:
        c = src.count(old)
        assert c == 1, '锚点命中 %d 次（应为 1）：%s' % (c, label)
        src = src.replace(old, new)
        print('  ✅ %-46s 替换 1 处' % label)


apply()

# ─────────────────────────────── 落地前自检
probe = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
probe = re.sub(r'^\s*//.*$', '', probe, flags=re.M)

GONE = ['sourceComparison', 'familyCount', 'monthRate', 'mdrtCarry', 'srcCell',
        "num(d.family)", "'F35'", "'F36'", "'F37'", 'baox.act.log\'']
print('\n【被删符号 · 应在场于去注释文本之外的残留为 0】')
for g in GONE:
    hit = g in probe
    assert not hit, '残留：%s' % g
    print('  ✅ 无残留  %s' % g)

NEED = ['function bizMetrics', 'biz: bizMetrics()', "id: 'S1'", "id: 'S3'",
        "numKey: 'close'", 'plan: 6, close: 3', "baox.act.log.v2",
        'quarterRate: qg ? round(qp / qg * 100, 1) : 0']
print('\n【新增符号 · 应全部在场】')
for n in NEED:
    hit = n in src
    assert hit, '缺失：%s' % n
    print('  ✅ 在场    %s' % n)

open(P, 'w', encoding='utf-8').write(src)
print('\n%s: %d → %d 字符' % (P, orig, len(src)))
