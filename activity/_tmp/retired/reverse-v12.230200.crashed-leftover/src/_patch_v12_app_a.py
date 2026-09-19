#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 改造 · app.js（渲染层 §③–§⑬）。

为什么分两个脚本：app.js 是本轮改动最大的文件，把它拆成「渲染层」与
「设置/启动层」两段各自断言、各自落盘，任一步失败时blast radius 都只有一半。

本脚本的改造范围：
  §③ KPI 8 卡（1 自动累计 + 6 手动业务指标 + 1 自动派生率）
  §④ 洞察：删源表口径条 + 全零数据走空态（不再生造洞察）
  §⑤ 删 renderAudit
  §⑥ 今日打卡：统一存储 + 窗口外否决 + 修「沿用昨日」被 renderToday 抹掉
  §⑩ 漏斗第 4 级改促成签单 + 清掉 F35/F36/F37 + 说明按数据形状分支
  §⑦§⑫ 墓碑注释里已经失效的陈述（sourceComparison 仍在场 → 已删）
  余下各节：R.histAgg→R.agg、R.hist→R.days（统一日集合）走机械替换 + 计数断言
"""
import io
import os
import re
import sys

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.js')
src = io.open(P, encoding='utf-8').read()
orig_len = len(src)
STEPS = []


def sub(label, old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('!! [%s] 期望命中 %d 次，实际 %d 次：\n----\n%s\n----'
                 % (label, count, n, old[:400]))
    src = src.replace(old, new, count)
    STEPS.append(label)


# ══════════════════════════════════════════════════════════════════════════
# ① 文件头 + §② 小工具（新增本层共用的三个查询）
# ══════════════════════════════════════════════════════════════════════════
sub('文件头',
    '''/* ============================================================================
   app.js · 公子的活动量面板 · 应用层
   ----------------------------------------------------------------------------
   依赖：src/data.js（权威数据）→ src/core.js（唯一口径计算）→ 本文件（渲染与交互）
   本文件不含任何计分/聚合逻辑 —— 全部走 window.ACT，避免口径分叉（铁律 12）
   ============================================================================ */''',
    '''/* ============================================================================
   app.js · 展业活动量面板 · 应用层
   ----------------------------------------------------------------------------
   依赖：src/data.js（种子）→ src/core.js（唯一口径计算与存储）→ 本文件（渲染与交互）
   本文件不含任何计分/聚合/落盘逻辑 —— 全部走 window.ACT，避免口径分叉（铁律 12）

   两条本层必须守住的边界（v1.2 立）：
     · 面板的日集合**只有一份**（R.days = 窗口 30 天，覆盖层已并回）。
       v1.1 分了 hist（历史样本）与 local（本机新增），周聚合只读 hist，
       于是「保存了却不生效」——那正是两份数据、两条读路径的产物。
     · 页面上的「今天」必须能不在窗口内。窗口固定在种子里，会到期。
       到期后要**说出来**（#todayHint + 禁用按钮），不能让它看起来像保存成功。
   ============================================================================ */''')

sub('§② 小工具新增查询',
    '''  /* 周区间（周一–周日） */
  function weekRangeOf(date) {''',
    '''  /** 种子里的统计窗口。缺 meta 时给零值对象而不是抛错 ——
      页面宁可少一行副标题，也不该整页白屏。 */
  function period() {
    return (A.SEED.meta && A.SEED.meta.period) || { start: '', end: '', days: 0 };
  }

  /** 今日在日集合里的下标；不在窗口内返回 -1。 */
  function todayIndex() {
    var iso = todayISO();
    for (var i = 0; i < R.days.length; i++) { if (R.days[i].date === iso) { return i; } }
    return -1;
  }

  /** 取某天的日记录（覆盖层已并回）。窗口外返回 null。 */
  function dayRecOf(iso) {
    for (var i = 0; i < R.days.length; i++) { if (R.days[i].date === iso) { return R.days[i]; } }
    return null;
  }

  /** 当前连续打卡天数。
      ⚠️ 必须**以今天为末位**去数：本窗口末日在未来（10/17），
      拿整窗去数恒为 0 —— 症状是「今天打了卡，连续天数还是 0」，
      看起来像 streak 算错，其实是喂错了区间。 */
  function curStreak() {
    var idx = todayIndex();
    return A.streakEndingAt(idx >= 0 ? R.days.slice(0, idx + 1) : R.days);
  }

  /** a 占 b 的百分比。分母为 0 时给「—」而不是 0% ——
      0% 是一个结论（「一点都没做」），而这里的事实是「还没有分母」。 */
  function pctOf(a, b) {
    b = Number(b) || 0;
    return b ? (a / b * 100).toFixed(1) + '%' : '—';
  }

  /* 周区间（周一–周日） */
  function weekRangeOf(date) {''')

# ══════════════════════════════════════════════════════════════════════════
# ② §③ KPI 8 卡
# ══════════════════════════════════════════════════════════════════════════
OLD_KPI = '''  /* ========================================================================
     ③ 渲染 · KPI 概览
     ======================================================================== */
  function renderKPI() {
    var a = R.histAgg;
    var scores = R.hist.map(A.dayScore);
    var peak = Math.max.apply(null, scores);
    var peakIdx = scores.indexOf(peak);
    var zero = scores.filter(function (s) { return s === 0; }).length;

    el('kDays').textContent = a.days;
    el('kDaysFoot').innerHTML = '连续 <b>' + R.streakEnd + '</b> 天 · 最长 <b>' +
      R.streakLongest + '</b> 天';
    el('kScore').textContent = a.score;
    el('kScoreFoot').innerHTML = '日均 <b>' + a.avgScore + '</b> 分';
    el('kPrem').textContent = money(a.premium);
    el('kPremFoot').innerHTML = '人民币口径 · 件均 <b>' + money(a.perDeal) + '</b>';
    el('kMdrt').textContent = money(R.mdrt);
    el('kMdrtFoot').innerHTML = '含期初结余 <b>' +
      money(A.TARGETS.mdrtCarry, 0) + '</b>';
    el('kRate').textContent = R.monthRate + '%';
    el('kRateFoot').innerHTML = '月目标 ' + money(A.TARGETS.month, 0) +
      ' · 实收 <b>' + money(a.premium, 0) + '</b>';
    el('kDeals').textContent = R.histAgg.closeCount + ' / ' + a.familyCount;
    el('kDealsFoot').textContent = '促成签单次数 / 成交家庭数';
    el('kPeak').textContent = peak;
    el('kPeakFoot').innerHTML = peakIdx >= 0 ?
      H.parseDay(R.hist[peakIdx].date).getMonth() + 1 + ' 月 ' +
      H.parseDay(R.hist[peakIdx].date).getDate() + ' 日 · ' + R.hist[peakIdx].dow : '—';
    el('kZero').textContent = zero;
    el('kZeroFoot').textContent = '得分为 0 的日期';

    el('ovSub').textContent = '历史样本 ' + A.SEED.meta.period.start.replace(/-/g, '/') +
      ' – ' + A.SEED.meta.period.end.replace(/-/g, '/') +
      ' · ' + A.SEED.meta.period.days + ' 天';
    el('tbSub').textContent = '样本期 ' + mdShort(A.SEED.meta.period.start) +
      ' – ' + mdShort(A.SEED.meta.period.end);
  }
'''

NEW_KPI = '''  /* ========================================================================
     ③ 渲染 · KPI 概览（8 卡）
     ------------------------------------------------------------------------
     8 张卡有两种来源，混在一起最容易被当成同类：
       · 自动 2 张 —— 累计活动量总分（打卡累计）、季度目标完成率（派生）；
       · 手动 6 张 —— 在「设置数据」抽屉里维护。
     卡脚一律写**派生对比**，不写「手动维护」四个字：那是按钮的功能，
     四张卡都说同一句话等于把位置白占掉。真正的派生值要能被一眼验算 ——
     「缺口 ¥X」「件均 ¥X」都可以拿卡上的两个数当场对上。

     v1.1 的 8 卡里有 4 张是回溯样本的统计量（打卡天数 / 单日峰值 / 零打卡
     天数 / 件均），样本清零后它们恒为 0，且第 9、10 项（MDRT / 月达标率）
     是外部目标口径 —— 一起换掉，换成本季度口径的 6 项业务指标。
     ======================================================================== */
  function renderKPI() {
    var a = R.agg, b = R.biz;

    el('kScore').textContent = a.score;
    el('kScoreFoot').innerHTML = '连续 <b>' + curStreak() + '</b> 天 · 最长 <b>' +
      R.streakLongest + '</b> 天';

    el('kMonthPerf').textContent = money(b.monthPerf);
    el('kMonthPerfFoot').innerHTML = '占本季度业绩 <b>' +
      pctOf(b.monthPerf, b.quarterPerf) + '</b>';
    el('kQuarterPerf').textContent = money(b.quarterPerf);
    el('kQuarterPerfFoot').innerHTML = '占本年度业绩 <b>' +
      pctOf(b.quarterPerf, b.yearPerf) + '</b>';
    el('kYearPerf').textContent = money(b.yearPerf);

    el('kQuarterGoal').textContent = money(b.quarterGoal);
    el('kQuarterRate').textContent = b.quarterRate.toFixed(1) + '%';
    el('kQuarterRateFoot').innerHTML = b.quarterGoal
      ? (b.quarterPerf >= b.quarterGoal
          ? '已超目标 <b>' + money(b.quarterPerf - b.quarterGoal, 0) + '</b>'
          : '缺口 <b>' + money(b.quarterGoal - b.quarterPerf, 0) + '</b>')
      : '未设季度目标业绩';

    el('kQuarterDeals').textContent = b.quarterDeals + ' 单';
    el('kQuarterDealsFoot').innerHTML = '件均 <b>' +
      (b.quarterDeals ? money(b.quarterPremium / b.quarterDeals, 0) : '—') + '</b>';
    el('kQuarterPremium').textContent = money(b.quarterPremium);

    el('ovSub').textContent = '统计窗口 ' + period().start.replace(/-/g, '/') + ' – ' +
      period().end.replace(/-/g, '/') + ' · ' + period().days + ' 天 · 按自然周切分';
    el('tbSub').textContent = '窗口 ' + mdShort(period().start) + ' – ' +
      mdShort(period().end);
  }
'''
sub('§③ KPI 8 卡', OLD_KPI, NEW_KPI)

# ══════════════════════════════════════════════════════════════════════════
# ③ §④ 洞察
# ══════════════════════════════════════════════════════════════════════════
OLD_INS = '''  /* ========================================================================
     ④ 渲染 · 关键洞察
     ======================================================================== */
  function renderInsights() {
    var out = [];
    var a = R.histAgg;

    /* 周维度极值 */
    var byPrem = R.weeks.slice().sort(function (x, y) { return y.premium - x.premium; });
    var best = byPrem[0], worst = byPrem[byPrem.length - 1];
    out.push({
      c: 'g', i: 'fa-trophy',
      t: '第 ' + best.idx + ' 周是保费峰值周，达标率 ' + best.rate + '%',
      s: mdShort(best.from) + ' – ' + mdShort(best.to) + ' 入账 <b>' + money(best.premium) +
         '</b>，占样本期总额 <em>' +
         (a.premium ? (best.premium / a.premium * 100).toFixed(1) : '0') + '%</em>'
    });
    if (worst.premium < worst.target) {
      out.push({
        c: 'o', i: 'fa-triangle-exclamation',
        t: '第 ' + worst.idx + ' 周未达周目标，缺口 ' + money(worst.target - worst.premium),
        s: mdShort(worst.from) + ' – ' + mdShort(worst.to) + ' 达标率仅 <b>' +
           worst.rate + '%</b>，该周活动量得分 <em>' + worst.score + '</em> 分'
      });
    }

    /* 星期维度 */
    var byDow = dowStats();
    var sorted = byDow.filter(function (d) { return d.n > 0; })
      .sort(function (x, y) { return y.avg - x.avg; });
    if (sorted.length) {
      out.push({
        c: 'b', i: 'fa-calendar-day',
        t: '活动量最高的是' + sorted[0].dow + '（日均 ' + sorted[0].avg + ' 分）',
        s: '最低是' + sorted[sorted.length - 1].dow + '（日均 ' +
           sorted[sorted.length - 1].avg + ' 分），差值 <b>' +
           (sorted[0].avg - sorted[sorted.length - 1].avg).toFixed(1) + '</b> 分'
      });
    }

    /* 结构失衡 */
    var c = a.counts;
    var serviceShare = a.score ? c.service * 1 / a.score * 100 : 0;
    var frontShare = a.score ? (c.visit * 1 + c.need * 2) / a.score * 100 : 0;
    out.push({
      c: serviceShare > 25 ? 'o' : 'b', i: 'fa-scale-unbalanced',
      t: '「客户服务」占活动量得分 ' + serviceShare.toFixed(1) + '%',
      s: '累计 <b>' + c.service + '</b> 次、<b>' + c.service + '</b> 分；' +
         '前端开发动作（约访 + 需求分析）合计仅占 <em>' + frontShare.toFixed(1) + '%</em>，' +
         '收入结构偏维护、轻开拓'
    });

    /* 源表口径 */
    var cmp = A.sourceComparison();
    out.push({
      c: 'r', i: 'fa-triangle-exclamation',
      t: '源模板「总」行少计 ' + cmp.scoreGap + ' 分、' + money(cmp.premiumGap) + ' 保费',
      s: '总分行公式为 <code>' + esc(cmp.srcFormula) + '</code>，漏计「新增好友」「约聊增员」两列且区间止于第 30 行；' +
         '周保费公式 <code>' + esc(cmp.srcPremiumFormula) + '</code> 漏掉第 ' +
         cmp.premiumMissedWeek.idx + ' 周。详见「源表口径校验」'
    });

    /* 连续打卡 */
    out.push({
      c: R.streakLongest >= 10 ? 'g' : 'b', i: 'fa-fire',
      t: '最长连续打卡 ' + R.streakLongest + ' 天（样本期末 ' + R.streakEnd + ' 天）',
      s: '30 天样本中零打卡 <b>' +
         R.hist.map(A.dayScore).filter(function (s) { return s === 0; }).length +
         '</b> 天，日均得分 <em>' + a.avgScore + '</em> 分'
    });

    el('insights').innerHTML = out.map(function (o) {
      return '<div class="ins"><div class="ins-ico ' + o.c + '"><i class="fa-solid ' + o.i +
        '"></i></div><div class="ins-b"><div class="ins-t">' + o.t +
        '</div><div class="ins-s">' + o.s + '</div></div></div>';
    }).join('');
  }
'''

NEW_INS = '''  /* ========================================================================
     ④ 渲染 · 关键洞察
     ------------------------------------------------------------------------
     洞察是「对数据下结论」，所以必须**先判断值不值得下结论**。
     v1.1 的洞察条一律硬下：样本清零之后，它会输出「第 1 周是保费峰值周，
     达标率 0%」「客户服务占活动量得分 0.0%」这种句子 —— 每个数都对，
     但每一句都在把一个不存在的事实说成结论。空态不是缺陷，硬下结论才是。
     ======================================================================== */
  function renderInsights() {
    var out = [];
    var a = R.agg;

    if (!a.score && !a.premium) {
      out.push({
        c: 'b', i: 'fa-seedling',
        t: '统计窗口刚开始，还没有活动量记录',
        s: '窗口 <b>' + period().start.replace(/-/g, '/') + ' – ' +
           period().end.replace(/-/g, '/') + '</b>（' + period().days +
           ' 天）。完成今日打卡后，这里会自动派生周峰值、高效日、结构占比与连续打卡四类洞察。'
      });
      paintInsights(out);
      return;
    }

    /* 周维度极值：只在**有保费**时才成立。
       score > 0 而 premium = 0 是常态（打卡不一定当天成交），
       此时「保费峰值周」是一个四舍五入到 0 的伪结论。 */
    if (a.premium > 0) {
      var byPrem = R.weeks.slice().sort(function (x, y) { return y.premium - x.premium; });
      var best = byPrem[0], worst = byPrem[byPrem.length - 1];
      out.push({
        c: 'g', i: 'fa-trophy',
        t: '第 ' + best.idx + ' 周是保费峰值周，达标率 ' + best.rate + '%',
        s: mdShort(best.from) + ' – ' + mdShort(best.to) + ' 入账 <b>' +
           money(best.premium) + '</b>，占窗口总额 <em>' +
           (best.premium / a.premium * 100).toFixed(1) + '%</em>'
      });
      if (worst.premium < worst.target) {
        out.push({
          c: 'o', i: 'fa-triangle-exclamation',
          t: '第 ' + worst.idx + ' 周未达周目标，缺口 ' + money(worst.target - worst.premium),
          s: mdShort(worst.from) + ' – ' + mdShort(worst.to) + ' 达标率 <b>' +
             worst.rate + '%</b>，该周活动量得分 <em>' + worst.score + '</em> 分'
        });
      }
    }

    /* 星期维度 */
    var sorted = dowStats().slice().sort(function (x, y) { return y.avg - x.avg; });
    out.push({
      c: 'b', i: 'fa-calendar-day',
      t: '活动量最高的是' + sorted[0].dow + '（日均 ' + sorted[0].avg + ' 分）',
      s: '最低是' + sorted[sorted.length - 1].dow + '（日均 ' +
         sorted[sorted.length - 1].avg + ' 分），差值 <b>' +
         (sorted[0].avg - sorted[sorted.length - 1].avg).toFixed(1) + '</b> 分'
    });

    /* 结构失衡：权重写在公式里，跟着 RULES 的 pts 走而不是硬编码 1 / 2 ——
       分值一改（本轮就改过一次），硬编码的占比会静默算错。 */
    var c = a.counts;
    var ptsOf = {};
    RULES.forEach(function (r) { ptsOf[r.key] = r.pts; });
    var serviceShare = a.score ? (c.service * ptsOf.service) / a.score * 100 : 0;
    var frontShare = a.score
      ? (c.visit * ptsOf.visit + c.need * ptsOf.need) / a.score * 100 : 0;
    out.push({
      c: serviceShare > 25 ? 'o' : 'b', i: 'fa-scale-unbalanced',
      t: '「客户服务」占活动量得分 ' + serviceShare.toFixed(1) + '%',
      s: '累计 <b>' + c.service + '</b> 次、<b>' + (c.service * ptsOf.service) +
         '</b> 分；前端开发动作（约访 + 需求分析）合计占 <em>' +
         frontShare.toFixed(1) + '%</em>'
    });

    /* 连续打卡：显示「当前连续」（截止今天），不是「窗口末位连续」 ——
       窗口末日在未来，后者恒为 0。 */
    out.push({
      c: curStreak() >= 7 ? 'g' : 'b', i: 'fa-fire',
      t: '当前连续打卡 ' + curStreak() + ' 天 · 窗口内最长 ' + R.streakLongest + ' 天',
      s: '窗口 ' + period().days + ' 天中零打卡 <b>' +
         R.days.map(A.dayScore).filter(function (s) { return s === 0; }).length +
         '</b> 天，日均得分 <em>' + a.avgScore + '</em> 分'
    });

    paintInsights(out);
  }

  function paintInsights(out) {
    el('insights').innerHTML = out.map(function (o) {
      return '<div class="ins"><div class="ins-ico ' + o.c + '"><i class="fa-solid ' + o.i +
        '"></i></div><div class="ins-b"><div class="ins-t">' + o.t +
        '</div><div class="ins-s">' + o.s + '</div></div></div>';
    }).join('');
  }
'''
sub('§④ 洞察', OLD_INS, NEW_INS)

# ══════════════════════════════════════════════════════════════════════════
# ④ §⑤ 删 renderAudit（改墓碑）
# ══════════════════════════════════════════════════════════════════════════
OLD_AUDIT = '''  /* ========================================================================
     ⑤ 渲染 · 源表口径校验
     ======================================================================== */
  function renderAudit() {
    var c = A.sourceComparison();
    var rows = [
      ['累计总分', c.srcTotalScore + ' 分', c.recomputed + ' 分',
        '公式 ' + c.srcFormula + ' 漏计「新增好友」' + c.scoreMissed[0].count +
        ' 次（' + c.scoreMissed[0].lost + ' 分）与「约聊增员」' + c.scoreMissed[1].count +
        ' 次（' + c.scoreMissed[1].lost + ' 分），且求和区间止于第 30 行，末 2 天 ' +
        c.scoreMissed[2].lost + ' 分未计入'],
      ['本期保费', money(c.srcPremium), money(c.recomputedPremium),
        '公式 ' + c.srcPremiumFormula + ' 只累加到第 4 周，漏掉第 ' +
        c.premiumMissedWeek.idx + ' 周 ' + money(c.premiumMissedWeek.premium)],
      ['月达标率', (c.srcRatio * 100).toFixed(1) + '%',
        (c.recomputedRatio * 100).toFixed(1) + '%',
        '沿用 ' + c.srcRatioFormula + '，分母 ¥70,000；分子随保费口径修正'],
      ['件均保费', money(c.srcPerDeal), money(c.recomputedPerDeal),
        '源公式 ' + c.srcPerDealFormula + ' 的分母 H33=' + c.srcCloseCount +
        ' 只统计到第 30 行；重算用全 30 天促成签单 ' + c.recomputedCloseCount + ' 次'],
      ['计入 MDRT 总保费', money(c.srcMdrt), money(c.recomputedMdrt),
        '源公式 ' + c.srcMdrtFormula + '；期初结余 ¥178,103 加上本期保费']
    ];
    var html = rows.map(function (r) {
      return '<div class="audit-row"><div class="audit-k">' + r[0] + '</div>' +
        '<div class="audit-v">源表 <span class="old">' + r[1] +
        '</span> → 重算 <span class="new">' + r[2] + '</span>' +
        '<div class="audit-why">' + esc(r[3]) + '</div></div>' +
        '<span class="bd ' + (r[0] === '累计总分' || r[0] === '本期保费' ? 'bad' : 'warn') +
        '">口径不一致</span></div>';
    }).join('');

    el('auditBox').innerHTML = html;
  }
'''

NEW_AUDIT = '''  /* ========================================================================
     ⑤ 源表口径校验 —— 已移除（v1.2）
     ------------------------------------------------------------------------
     按公子指令整体去掉。随之消失的不只是展示：core.js 的 sourceComparison()
     与 verify-runtime 第 ⑦ 关也一并删除 —— 那是本面板与源模板之间**唯一**的
     引用点，拆掉之后「源模板」在本项目里再无任何引用。
     保留计算、只删展示（v1.1 的做法）看似稳妥，实际是留着一份不再被任何人
     比对的证据表：它不会报错，也不会有人看，却让每个后来者以为「这件事还有人守着」。
     #auditBox 已从 body.html 删除，同行原本并排的「周保费 vs 周目标」改通栏。
     ======================================================================== */
'''
sub('§⑤ 删 renderAudit', OLD_AUDIT, NEW_AUDIT)

# ══════════════════════════════════════════════════════════════════════════
# ⑤ §⑥ 今日打卡
# ══════════════════════════════════════════════════════════════════════════
OLD_TODAY = '''  function renderToday() {
    var iso = todayISO();
    var log = A.localLog();
    var rec = log[iso] || {};
    var d = H.parseDay(iso);
    var dow = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    el('todayDateLab').textContent = iso.replace(/-/g, '/') + ' ' + dow;

    todayCounts = {};
    RULES.concat(UNSCORED).forEach(function (r) {
      todayCounts[r.key] = H.num(rec[r.key]);
    });
    el('todayNote').value = rec.note || '';

    el('checkGrid').innerHTML = RULES.map(function (r) {
      var v = todayCounts[r.key];
      return '<div class="ck' + (v > 0 ? ' on' : ' zero') + '" data-key="' + r.key + '">' +
        '<div class="ck-top"><span class="ck-nm">' + esc(r.name) +
        '</span><span class="ck-pt">' + r.pts + ' 分</span></div>' +
        '<div class="ck-ctl">' +
        '<button class="ck-btn" type="button" data-d="-1"' + (v <= 0 ? ' disabled' : '') +
        ' aria-label="减少' + esc(r.name) + '">−</button>' +
        '<b class="ck-cnt">' + v + '</b>' +
        '<span class="ck-unit">次</span>' +
        '<button class="ck-btn" type="button" data-d="1" aria-label="增加' +
        esc(r.name) + '">＋</button>' +
        '</div>' +
        '<div class="ck-bar"><i style="width:' + Math.min(100, v * 12) + '%"></i></div>' +
        '<div class="ck-unit" style="margin-top:7px;">' + v + ' × ' + r.pts +
        ' = <b style="color:var(--gold1)">' + (v * r.pts) + '</b> 分</div>' +
        '</div>';
    }).join('');

    paintTodayScore();
  }
'''

NEW_TODAY = '''  function renderToday() {
    var iso = todayISO();
    var live = A.inWindow(iso);
    /* 从**日集合**取今日记录（覆盖层已并回），不再读第二个存储 ——
       v1.1 这里读 baox.act.log，而设置抽屉写 baox.act.data，
       同一天有两个真相，谁后写谁赢，两个入口互不知情。 */
    var rec = dayRecOf(iso) || {};
    var d = H.parseDay(iso);
    var dow = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    el('todayDateLab').textContent = iso.replace(/-/g, '/') + ' ' + dow +
      (live ? '' : ' · 不在窗口内');

    todayCounts = {};
    RULES.concat(UNSCORED).forEach(function (r) { todayCounts[r.key] = H.num(rec[r.key]); });
    todayCounts.premium = H.num(rec.premium);
    el('todayNote').value = rec.note || '';

    /* 窗口外必须有**双重**痕迹：提示条 + 按钮禁用。
       只弹一个 toast 是不够的 —— 它 1.9 秒后消失，而按钮还亮着，
       点下去什么都不发生，看起来像点击失效。 */
    var btn = el('btnSaveToday');
    if (btn) { btn.disabled = !live; }
    var hint = el('todayHint');
    if (hint) {
      hint.hidden = live;
      hint.innerHTML = live ? '' :
        '今天 <b>' + iso.replace(/-/g, '/') + '</b> 不在本面板的统计窗口内（<b>' +
        period().start.replace(/-/g, '/') + ' – ' + period().end.replace(/-/g, '/') +
        '</b>）。窗口外的打卡不会保存，也不能通过「设置数据」补录 —— ' +
        '面板的数据边界就是这 ' + period().days + ' 天。';
    }

    paintCheckGrid();
    paintTodayScore();
  }

  /** 只重画计分项网格，**不动 todayCounts**。
      为什么要把「重画」与「重读」拆开：v1.1 的「沿用昨日」是先改内存态
      （todayCounts = 昨日）再调 renderToday()，而 renderToday 第一件事就是
      todayCounts = 从存储读今日 —— 于是刚复制进来的昨日数据被自己的重画抹掉，
      按钮点了像没点。拆开后：renderToday = 重读 + 重画；沿用昨日 = 只重画。 */
  function paintCheckGrid() {
    el('checkGrid').innerHTML = RULES.map(function (r) {
      var v = todayCounts[r.key];
      return '<div class="ck' + (v > 0 ? ' on' : ' zero') + '" data-key="' + r.key + '">' +
        '<div class="ck-top"><span class="ck-nm">' + esc(r.name) +
        '</span><span class="ck-pt">' + r.pts + ' 分</span></div>' +
        '<div class="ck-ctl">' +
        '<button class="ck-btn" type="button" data-d="-1"' + (v <= 0 ? ' disabled' : '') +
        ' aria-label="减少' + esc(r.name) + '">−</button>' +
        '<b class="ck-cnt">' + v + '</b>' +
        '<span class="ck-unit">次</span>' +
        '<button class="ck-btn" type="button" data-d="1" aria-label="增加' +
        esc(r.name) + '">＋</button>' +
        '</div>' +
        '<div class="ck-bar"><i style="width:' + Math.min(100, v * 12) + '%"></i></div>' +
        '<div class="ck-unit" style="margin-top:7px;">' + v + ' × ' + r.pts +
        ' = <b style="color:var(--gold1)">' + (v * r.pts) + '</b> 分</div>' +
        '</div>';
    }).join('');
  }
'''
sub('§⑥ renderToday', OLD_TODAY, NEW_TODAY)

OLD_PAINT = '''  function paintTodayScore() {
    var s = 0;
    RULES.forEach(function (r) { s += todayCounts[r.key] * r.pts; });
    el('todayScore').textContent = s;
    var base = R.histAgg.avgScore || 0;
    var d = base ? ((s / base - 1) * 100) : 0;
    el('todayCompare').innerHTML = s >= base
      ? '高于样本日均 <b>' + base + '</b> 分，幅度 <b>+' + d.toFixed(0) + '%</b>'
      : '距样本日均 <b>' + base + '</b> 分还差 <b>' + (base - s).toFixed(1) + '</b> 分';

    /* 本周累计 */
    var wk = weekRangeOf(new Date());
    var log = A.localLog();
    var sum = 0, prem = 0;
    for (var i = 0; i < 7; i++) {
      var dd = new Date(wk.from); dd.setDate(wk.from.getDate() + i);
      var iso = H.isoOf(dd);
      if (iso === todayISO()) { sum += s; prem += H.num(todayCounts.premium); continue; }
      var rec = log[iso];
      if (!rec) { continue; }
      var tmp = {}; RULES.forEach(function (r) { tmp[r.key] = H.num(rec[r.key]); });
      sum += A.dayScore(tmp);
      prem += H.num(rec.premium);
    }
    el('wkScoreVal').textContent = sum;
    el('wkPremVal').textContent = money(prem);
    var maxScore = R.weeks.reduce(function (m, w) { return Math.max(m, w.score); }, 1);
    el('wkScoreBar').style.width = Math.min(100, sum / maxScore * 100) + '%';
    var tgt = A.TARGETS.weekShort;
    /* 目标值也是「设置数据」的可编辑项 —— 每次从 TARGETS 现读，写死在标记里改不动 */
    el('wkPremTgt').textContent = money(tgt, 0);
    el('wkPremBar').style.width = Math.min(100, prem / tgt * 100) + '%';
    el('wkPremBar').classList.toggle('over', prem > tgt);
  }

  window.saveToday = function () {
    var iso = todayISO();
    var rec = { note: el('todayNote').value.trim() };
    RULES.concat(UNSCORED).forEach(function (r) { rec[r.key] = todayCounts[r.key]; });
    A.saveLocalDay(iso, rec);
    var s = 0; RULES.forEach(function (r) { s += todayCounts[r.key] * r.pts; });
    el('saveHint').innerHTML = '已于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) +
      ' 保存 · 今日 <b style="color:var(--gold1)">' + s + '</b> 分';
    refreshAll();
    toast('打卡已保存 · ' + s + ' 分');
  };

  window.copyYesterday = function () {
    var y = new Date(); y.setDate(y.getDate() - 1);
    var rec = A.localLog()[H.isoOf(y)];
    if (!rec) { toast('昨日没有打卡记录'); return; }
    RULES.concat(UNSCORED).forEach(function (r) { todayCounts[r.key] = H.num(rec[r.key]); });
    renderToday();
    toast('已沿用昨日数据，记得点保存');
  };
'''

NEW_PAINT = '''  function paintTodayScore() {
    var s = 0;
    RULES.forEach(function (r) { s += todayCounts[r.key] * r.pts; });
    el('todayScore').textContent = s;

    /* 对照基线 = 本窗日均。窗口中段以后它才有信息量：
       窗口刚开始时日均 = 0（分子 0 / 分母 30），
       拿它去说「高于日均 +0%」是一句听着像结论的废话。 */
    var base = R.agg.avgScore || 0;
    el('todayCompare').innerHTML = base
      ? (s >= base
          ? '高于本窗日均 <b>' + base + '</b> 分，幅度 <b>+' +
            ((s / base - 1) * 100).toFixed(0) + '%</b>'
          : '距本窗日均 <b>' + base + '</b> 分还差 <b>' + (base - s).toFixed(1) + '</b> 分')
      : '本窗日均还是 0 分 —— 打卡后它才成为有效对照';

    /* 本周累计：全部从**日集合**现读，今日用内存里尚未保存的值。
       ⚠️ v1.1 这里有一个静默 bug：它从 todayCounts.premium 取今日保费，
       而 todayCounts 里从来没有 premium 这个键（只填了 12 个计分项），
       于是「本周保费」永远读不到今天的入账 —— 不报错，就是不涨。 */
    var wk = weekRangeOf(new Date());
    var sum = 0, prem = 0;
    for (var i = 0; i < 7; i++) {
      var dd = new Date(wk.from); dd.setDate(wk.from.getDate() + i);
      var iso = H.isoOf(dd);
      if (iso === todayISO()) { sum += s; prem += H.num(todayCounts.premium); continue; }
      var rec = dayRecOf(iso);
      if (!rec) { continue; }
      sum += A.dayScore(rec);
      prem += H.num(rec.premium);
    }
    el('wkScoreVal').textContent = sum;
    el('wkPremVal').textContent = money(prem);
    var maxScore = R.weeks.reduce(function (m, w) { return Math.max(m, w.score); }, 1);
    el('wkScoreBar').style.width = Math.min(100, sum / maxScore * 100) + '%';

    /* 目标取**当前周**那一周的 target。v1.1 读的是 TARGETS.weekShort ——
       一个独立标量，与「各周保费目标」是两套值，改了一处另一处不动。 */
    var w = weekOfDate(todayISO());
    var tgt = (w ? w.target : A.TARGETS.week) || 0;
    el('wkPremTgt').textContent = tgt ? money(tgt, 0) : '未设目标';
    el('wkPremBar').style.width = tgt ? Math.min(100, prem / tgt * 100) + '%' : '0%';
    el('wkPremBar').classList.toggle('over', tgt > 0 && prem > tgt);
  }

  window.saveToday = function () {
    var iso = todayISO();
    var rec = { note: el('todayNote').value.trim(), premium: H.num(todayCounts.premium) };
    RULES.concat(UNSCORED).forEach(function (r) { rec[r.key] = todayCounts[r.key]; });
    var res = A.saveDay(iso, rec);
    if (!res.ok) {
      /* 窗口外与「存储不可写」是两件事，提示语必须分开 ——
         合并成一句「保存失败」，用户会去查浏览器隐私设置，而真正的原因是日期。 */
      toast(res.reason === 'out-of-window'
        ? '今天不在统计窗口内，未保存' : '保存失败：本机存储不可写（可能处于隐私模式）');
      return;
    }
    var s = 0; RULES.forEach(function (r) { s += todayCounts[r.key] * r.pts; });
    el('saveHint').innerHTML = '已于 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) +
      ' 保存 · 今日 <b style="color:var(--gold1)">' + s + '</b> 分';
    refreshAll();
    toast('打卡已保存 · ' + s + ' 分');
  };

  window.copyYesterday = function () {
    var y = new Date(); y.setDate(y.getDate() - 1);
    var rec = dayRecOf(H.isoOf(y));
    if (!rec) { toast('昨日不在统计窗口内，没有可沿用的数据'); return; }
    RULES.concat(UNSCORED).forEach(function (r) { todayCounts[r.key] = H.num(rec[r.key]); });
    todayCounts.premium = H.num(rec.premium);
    el('todayNote').value = rec.note || '';
    /* 只重画，不重读 —— 重读会把刚复制进来的值抹掉（见 paintCheckGrid 的说明） */
    paintCheckGrid();
    paintTodayScore();
    toast('已沿用昨日数据，记得点保存');
  };
'''
sub('§⑥ paintTodayScore/saveToday/copyYesterday', OLD_PAINT, NEW_PAINT)

# ══════════════════════════════════════════════════════════════════════════
# ⑥ §⑦ / §⑫ 墓碑注释里已经失效的陈述
# ══════════════════════════════════════════════════════════════════════════
sub('§⑦ 墓碑陈述',
    '''     刻意保留的「周」维度（若一并删掉，「周」在页面上就无迹可寻，
     而源模板的 O/P/Q/S 列纵向合并块正是按周切分的，等于丢掉源表骨架）：''',
    '''     刻意保留的「周」维度（若一并删掉，「周」在页面上就无迹可寻，
     而周目标与周达标率本就是这套活动量管理的基本单位，等于丢掉面板骨架）：''')

OLD_RULES_TOMB = '''  /* ========================================================================
     ⑫ 计分说明 —— 已移除（v1.1）
     ------------------------------------------------------------------------
     移除范围：分值表（#rulesTbody）、源模板字段清单（#tplBox）、
     原始计分说明文本（#rulesText），以及 renderAudit 里那张「逐列对照」证据表
     （#auditFull / class="rules-tb col-tb"）。

     ⚠️ 只删**展示**，不删**计算**：src/core.js 的 sourceComparison().columns
     仍在，且仍由 src/verify-runtime.cjs 第 ⑦ 关逐列比对判定标签。
     也就是说「源表『总』行 5 列有误」这个事实依然被机器守着，
     只是不再逐格摊在页面上 —— 页面只保留总览那 5 行摘要（#auditBox）。
     ======================================================================== */'''
NEW_RULES_TOMB = '''  /* ========================================================================
     ⑫ 计分说明 · 源表口径 —— 均已移除
     ------------------------------------------------------------------------
     v1.1 删的是**展示**（#rulesTbody / #tplBox / #rulesText / #auditFull），
     并刻意留下计算侧的 sourceComparison() 与 verify-runtime 第 ⑦ 关，
     守着「源表『总』行有误」这个事实。
     v1.2 把整个「源表口径校验」模块去掉，**计算侧随之消失** ——
     面板与源模板之间再无任何引用点，那些还写着「仍在场」的注释也一并清掉：
     注释里的过期陈述比没有注释更糟，它会让下一个人按错误的前提做判断。
     ======================================================================== */'''
sub('§⑫ 墓碑陈述', OLD_RULES_TOMB, NEW_RULES_TOMB)

# ══════════════════════════════════════════════════════════════════════════
# ⑦ §⑩ 漏斗
# ══════════════════════════════════════════════════════════════════════════
OLD_FUNNEL = '''  function renderFunnel() {
    var c = R.histAgg.counts;
    var stages = [
      { k: 'visit', n: '约访', i: 'fa-handshake' },
      { k: 'need', n: '需求分析', i: 'fa-magnifying-glass-chart' },
      { k: 'plan', n: '方案呈现', i: 'fa-file-lines' },
      { k: 'family', n: '成交家庭', i: 'fa-house-circle-check' }
    ];
    var max = Math.max.apply(null, stages.map(function (s) { return c[s.k] || 0; })) || 1;
    el('funnelBox').innerHTML = stages.map(function (s) {
      var v = c[s.k] || 0;
      return '<div class="fn-row"><span class="fn-stage"><i class="fa-solid ' + s.i +
        '"></i>' + s.n + '</span>' +
        '<div class="fn-track"><div class="fn-fill" style="width:' +
        Math.max(4, v / max * 100) + '%">' + v + ' 次</div></div>' +
        '<span class="fn-rate">' + (v / max * 100).toFixed(0) + '%</span></div>';
    }).join('');
    el('funnelNote').innerHTML =
      '漏斗自「约访」向下**逐级放大**（约访 ' + (c.visit || 0) + ' 次 → 需求分析 ' +
      (c.need || 0) + ' 次 → 方案呈现 ' + (c.plan || 0) + ' 次 → 成交家庭 ' +
      (c.family || 0) + ' 个），说明上游「约访」记录相对下游动作严重偏低，' +
      '而非转化异常。建议先补齐约访登记，再据此判断真实转化。'.replace(/\\*\\*/g, '');

    el('fnCards').innerHTML = R.funnel.map(function (f) {
      return '<div class="fn-card"><div class="fn-lab">' + esc(f.label) + '</div>' +
        '<div class="fn-big">' + f.pct + '<small>%</small></div>' +
        '<div class="fn-meta">' + f.numerator + ' / ' + f.denominator +
        ' · 参考 <b style="color:var(--sub)">' + esc(f.ref) + '</b>' +
        '<span class="bd ' + (f.ok ? 'ok' : 'bad') + '">' + (f.ok ? '达标' : '未达') +
        '</span></div>' +
        '<div class="fn-meta" style="margin-top:5px;color:var(--dim)">源表 ' + f.srcCell +
        '（存比值 ' + f.ratio.toFixed(3) + '）</div></div>';
    }).join('');

    var tr = A.targetRatio();
    var actual = { visit: c.visit || 0, need: c.need || 0, plan: c.plan || 0, family: c.family || 0 };
    var base = actual.visit || 1;
    var norm = { visit: 15, need: Math.round(actual.need / base * 15),
                 plan: Math.round(actual.plan / base * 15),
                 family: Math.round(actual.family / base * 15) };
    var labels = { visit: '约访', need: '需求分析', plan: '方案呈现', family: '成交' };
    el('ratioGrid').innerHTML = ['visit', 'need', 'plan', 'family'].map(function (k) {
      return '<div class="ratio-cell"><div class="rc-l">' + labels[k] +
        '</div><div class="rc-t">' + tr[k] + '</div>' +
        '<div class="rc-a">实际（归一到约访=15）<br><b style="color:var(--text)">' +
        norm[k] + '</b></div></div>';
    }).join('');
    el('ratioSrc').textContent = A.SEED.funnelRatioText;
    el('funnelSub').textContent = '三段转化 · 口径严格镜像源模板 F35 / F36 / F37';
  }
'''

NEW_FUNNEL = '''  function renderFunnel() {
    var c = R.agg.counts;
    /* 第 4 级由「成交家庭」改为「促成签单」（公子指令 ⑤）：
       文案与数值一起换 —— 只改文案会留下「两个促成签单数值不同」的死结。
       换掉之后，漏斗第 4 级与三段转化率第 3 段的分子是同一个数，
       界面上不再有任何一处需要解释「这两个为什么不一样」。 */
    var stages = [
      { k: 'visit', n: '约访', i: 'fa-handshake' },
      { k: 'need', n: '需求分析', i: 'fa-magnifying-glass-chart' },
      { k: 'plan', n: '方案呈现', i: 'fa-file-lines' },
      { k: 'close', n: '促成签单', i: 'fa-house-circle-check' }
    ];
    var vals = stages.map(function (s) { return c[s.k] || 0; });
    var max = Math.max.apply(null, vals) || 1;
    el('funnelBox').innerHTML = stages.map(function (s) {
      var v = c[s.k] || 0;
      return '<div class="fn-row"><span class="fn-stage"><i class="fa-solid ' + s.i +
        '"></i>' + s.n + '</span>' +
        '<div class="fn-track"><div class="fn-fill" style="width:' +
        Math.max(4, v / max * 100) + '%">' + v + ' 次</div></div>' +
        '<span class="fn-rate">' + (v / max * 100).toFixed(0) + '%</span></div>';
    }).join('');

    /* 漏斗说明按**数据形状**分支：v1.1 那句话是给「上游记录偏低」这一种形状
       写的，换到全 0 或正常递减的数据上，就成了一句与事实相反的断言。 */
    var total = vals.reduce(function (s, v) { return s + v; }, 0);
    var desc;
    if (!total) {
      desc = '本期还没有漏斗动作：四级累计均为 0。完成今日打卡后，' +
             '这里的横条与下方三段转化率会随之变化。';
    } else if (vals[0] >= vals[1] && vals[1] >= vals[2] && vals[2] >= vals[3]) {
      desc = '四级逐级收窄（约访 ' + vals[0] + ' → 需求分析 ' + vals[1] +
             ' → 方案呈现 ' + vals[2] + ' → 促成签单 ' + vals[3] +
             '），是正常的转化形状；各段转化率见下方卡片。';
    } else {
      desc = '漏斗自「约访」向下逐级放大（约访 ' + vals[0] + ' 次 → 需求分析 ' +
             vals[1] + ' 次 → 方案呈现 ' + vals[2] + ' 次 → 促成签单 ' +
             vals[3] + ' 次），说明上游「约访」的记录相对下游动作偏低，' +
             '而非转化异常。建议先补齐约访登记，再据此判断真实转化率。';
    }
    el('funnelNote').innerHTML = desc;

    el('fnCards').innerHTML = R.funnel.map(function (f) {
      var gap = f.pct - parseFloat(f.ref.replace(/[^0-9.]/g, ''));
      return '<div class="fn-card"><div class="fn-lab">' + esc(f.label) + '</div>' +
        '<div class="fn-big">' + f.pct + '<small>%</small></div>' +
        '<div class="fn-meta">' + f.numerator + ' / ' + f.denominator +
        ' · 参考 <b style="color:var(--sub)">' + esc(f.ref) + '</b>' +
        '<span class="bd ' + (f.ok ? 'ok' : 'bad') + '">' + (f.ok ? '达标' : '未达') +
        '</span></div>' +
        '<div class="fn-meta" style="margin-top:5px;color:var(--dim)">' +
        (f.denominator
          ? (gap >= 0 ? '超参考下限 <b>' + gap.toFixed(1) + '</b> pt'
                      : '距参考下限还差 <b>' + Math.abs(gap).toFixed(1) + '</b> pt')
          : '分母为 0 · 本段上游还没有动作') +
        '</div></div>';
    }).join('');

    var tr = A.targetRatio();
    var actual = { visit: c.visit || 0, need: c.need || 0, plan: c.plan || 0, close: c.close || 0 };
    /* 「归一到约访 = 15」的分母是约访。约访为 0 时归一没有意义 ——
       不能拿 |1| 当分母凑出一个「实际 0 / 3 / 6 / 9」这种凭空生成的比例。 */
    var hasData = actual.visit > 0;
    var base = actual.visit || 1;
    var norm = { visit: 15, need: Math.round(actual.need / base * 15),
                 plan: Math.round(actual.plan / base * 15),
                 close: Math.round(actual.close / base * 15) };
    var labels = { visit: '约访', need: '需求分析', plan: '方案呈现', close: '促成签单' };
    el('ratioGrid').innerHTML = ['visit', 'need', 'plan', 'close'].map(function (k) {
      return '<div class="ratio-cell"><div class="rc-l">' + labels[k] +
        '</div><div class="rc-t">' + tr[k] + '</div>' +
        '<div class="rc-a">实际（归一到约访=15）<br><b style="color:var(--text)">' +
        (hasData ? norm[k] : '—') + '</b></div></div>';
    }).join('');
    el('ratioSrc').textContent = A.SEED.funnelRatioText;
    el('funnelSub').textContent = '三段转化 · 分子分母均取自计分项';
  }
'''
sub('§⑩ 漏斗', OLD_FUNNEL, NEW_FUNNEL)

# ══════════════════════════════════════════════════════════════════════════
# ⑧ 机械替换：统一日集合（必须在上面几处整体重写**之后**做）
# ══════════════════════════════════════════════════════════════════════════
n_agg = src.count('R.histAgg')
n_hist = src.count('R.hist')
src = src.replace('R.histAgg', 'R.agg').replace('R.hist', 'R.days')
STEPS.append('统一日集合引用（R.histAgg→R.agg %d 处 / R.hist→R.days %d 处）' % (n_agg, n_hist))

# trendSub：30 天改为随窗口
sub('热力图副标题',
    "el('trendSub').textContent = '30 天逐日得分强度 · 最高 ' + max + ' 分 · 均值 ' +\n      R.agg.avgScore + ' 分';",
    "el('trendSub').textContent = period().days + ' 天逐日得分强度 · 最高 ' + max +\n      ' 分 · 均值 ' + R.agg.avgScore + ' 分';")

# 构成副标题：补上满分口径
sub('构成副标题',
    "el('mixSub').textContent = '加权得分合计 ' + a.score + ' 分 · 共 ' +\n      RULES.length + ' 个计分项';",
    "el('mixSub').textContent = '加权得分合计 ' + a.score + ' 分 · ' +\n      RULES.length + ' 个计分项 · 单轮满分 ' +\n      RULES.reduce(function (s, r) { return s + r.pts; }, 0) + ' 分';")

# 明细副标题：R.days 的长度口径
sub('明细副标题',
    "el('ledgerSummary').textContent = '显示 ' + list.length + ' / ' + R.days.length +\n      ' 天 · 得分合计 ' + tot.score + ' 分 · 保费 ' + money(tot.premium);",
    "el('ledgerSummary').textContent = '显示 ' + list.length + ' / ' + R.days.length +\n      ' 天 · 得分合计 ' + tot.score + ' 分 · 保费 ' + money(tot.premium);")

# ══════════════════════════════════════════════════════════════════════════
# ⑨ __ACT_SNAPSHOT__：整段重写
# ══════════════════════════════════════════════════════════════════════════
# 为什么必须重写而不是「顺手改两个字段名」：
#   这是运行期门禁**唯一的取证面**，而原版引用了 5 个 core.js 已经删掉的 API
#   （A.sourceComparison 已不存在；r.histAgg / r.mdrt / r.monthRate / f.srcCell
#   随 v1.2 一起消失）。它不会在构建期报错 —— 只有门禁真去调它时才抛异常，
#   而症状是「运行期一致性整关失败」，看起来像数据分叉，实际是取证函数自己坏了。
sub('§⑨ __ACT_SNAPSHOT__ 重写',
    '''    /* 供运行期数据门禁取证（铁律 12） */
    window.__ACT_SNAPSHOT__ = function () {
      var r = A.computeAll();
      return {
        days: r.histAgg.days,
        score: r.histAgg.score,
        premium: r.histAgg.premium,
        mdrt: r.mdrt,
        monthRate: r.monthRate,
        closeCount: r.histAgg.closeCount,
        familyCount: r.histAgg.familyCount,
        perDeal: r.histAgg.perDeal,
        avgScore: r.histAgg.avgScore,
        rowMax: Math.max.apply(null, r.hist.map(A.dayScore)),
        rowMin: Math.min.apply(null, r.hist.map(A.dayScore)),
        streakEnd: r.streakEnd,
        streakLongest: r.streakLongest,
        dayScores: r.hist.map(function (d) { return { date: d.date, s: A.dayScore(d) }; }),
        weeks: r.weeks.map(function (w) {
          return { idx: w.idx, score: w.score, premium: w.premium, rate: w.rate };
        }),
        funnel: r.funnel.map(function (f) {
          return { srcCell: f.srcCell, ratio: f.ratio, pct: f.pct };
        }),
        cmp: A.sourceComparison()
      };
    };''',
    '''    /* 供运行期数据门禁取证（铁律 12）。
       ------------------------------------------------------------------
       这是「运行期重算」**唯一的取证面**，字段口径与构建期 expected.py 一一对应。
       两侧是**共享数据、不共享代码**的两份实现，所以任何一侧改了字段名或口径，
       都必须同时改另一侧 —— 只改一边不会报错，只会让门禁拿旧口径去比新实现，
       结果是「整关全绿，但比的根本不是同一件事」。这比不查更坏。

       三条口径要写在这里，改的人才知道不能顺手动：
         · days  = 窗口天数（agg.days），不是「有记录的天数」
         · score/premium 取自 agg（唯一一份日集合，覆盖层已并回）
         · funnel 用自有 id（S1/S2/S3）而非源模板单元格坐标 */
    window.__ACT_SNAPSHOT__ = function () {
      var r = A.computeAll();
      var a = r.agg;
      var rows = r.days.map(function (d) { return { date: d.date, s: A.dayScore(d) }; });
      var sc = rows.map(function (x) { return x.s; });
      return {
        days: a.days,
        score: a.score,
        premium: a.premium,
        closeCount: a.closeCount,
        perDeal: a.perDeal,
        avgScore: a.avgScore,
        counts: a.counts,
        biz: r.biz,
        rows: rows.length,
        rowMax: sc.length ? Math.max.apply(null, sc) : 0,
        rowMin: sc.length ? Math.min.apply(null, sc) : 0,
        streakEnd: r.streakEnd,
        streakLongest: r.streakLongest,
        curStreak: curStreak(),
        dayScores: rows,
        weeks: r.weeks.map(function (w) {
          return { idx: w.idx, dayCount: w.dayCount, target: w.target,
                   score: w.score, premium: w.premium, rate: w.rate };
        }),
        funnel: r.funnel.map(function (f) {
          return { id: f.id, numerator: f.numerator, denominator: f.denominator,
                   ratio: f.ratio, pct: f.pct };
        }),
        ratio: r.targetRatio,
        inWindow: A.inWindow(todayISO()),
        windowDays: period().days
      };
    };''')

# ══════════════════════════════════════════════════════════════════════════
# 自检
# ══════════════════════════════════════════════════════════════════════════
probe = re.sub(r'/\*.*?\*/', '', src, flags=re.S)

GONE = [
    'R.histAgg', 'R.hist', 'r.histAgg',
    'A.sourceComparison', 'sourceComparison',
    'A.localLog', 'saveLocalDay', 'mergedDays', 'localAgg',
    'kDays', 'kPrem"', 'kMdrt', 'kPeak', 'kZero', 'monthRate',
    'familyCount', 'srcCell',
]
# 上面这批是「换了实现之后不该再出现的旧 API」。
bad = []
for t in GONE:
    if t in probe:
        bad.append('旧 API/旧字段未清: %s（%d 处）' % (t, probe.count(t)))

# 下面这批**属于设置/启动层**（§⑰ 及其调用点），本脚本一刀都不碰。
# 把它们塞进 GONE 是本脚本第一版的真实错误：那会让脚本在**正确的中间状态**下
# 误报失败 —— 一个总在报警的探针等于没有探针，人很快会学会忽略它的输出。
# 所以它们只做信息性打印，不参与成败判定；清理归 _patch_v12_app_b.py。
# 注意 app.js 的设置层此刻自带一份**私有**的 readOverlay/writeOverlay/
# applyOverlay/diffOverlay/TGT_ROWS 与 LS_DATA —— 与 core.js 里的新实现重复。
# 这不是「漏改」，是刻意的分步：脚本 b 要把这层整体删掉、改为全部委托 A.*。
DEFERRED = [
    'renderAudit', 'TGT_ROWS', 'mdrtCarry', 'A.TARGETS.weekShort',
    'A.TARGETS.month', 'diffOverlay(', 'overlaySize()', 'writeOverlay(',
    "baox.act.data'",
]

NEED = [
    'windowDays: period().days', 'el(\'kMonthPerf\')', 'el(\'kQuarterRate\')',
    'el(\'kQuarterPremium\')',
    'A.saveDay(', 'A.inWindow(', 'paintCheckGrid', 'paintInsights', 'curStreak()',
    'dayRecOf(', 'A.SEED.meta', "n: '促成签单'",
]
# ⚠️ 这里第一版写的是 'id="kScore"' —— 那是**判错了对象**：DOM 的 id 属 body.html，
# 本文件里对应的写法是 el('kScore')。断言一旦落到「另一个文件才有的字符串」上，
# 它永远不成立（误报），或者改个检查方式就永远成立（假绿）。两样都不能要。
for t in NEED:
    if t not in src:
        bad.append('缺少: %s' % t)

if bad:
    print('!! 自检失败：')
    for b in bad:
        print('   -', b)
    sys.exit(1)

io.open(P, 'w', encoding='utf-8').write(src)
print('app.js（渲染层）: %d → %d 字符' % (orig_len, len(src)))
for s in STEPS:
    print('  ✅', s)
print('   ✅ 自检：%d 项旧 API 已清 / %d 项新调用在场' % (len(GONE), len(NEED)))
rest = [t for t in DEFERRED if t in probe]
if rest:
    print('   ⏭ 留给设置/启动层（不算失败，但必须清）:')
    for t in rest:
        print('        %s（%d 处）' % (t, probe.count(t)))
else:
    print('   ✅ 设置/启动层待清项也已是 0')
