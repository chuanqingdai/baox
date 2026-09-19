/* ============================================================================
   app.js · 公子的活动量面板 · 应用层
   ----------------------------------------------------------------------------
   依赖：src/data.js（权威数据）→ src/core.js（唯一口径计算）→ 本文件（渲染与交互）
   本文件不含任何计分/聚合逻辑 —— 全部走 window.ACT，避免口径分叉（铁律 12）
   ============================================================================ */
(function () {
  'use strict';

  var A = window.ACT;
  var H = A.helpers;
  var RULES = A.RULES;
  var UNSCORED = A.UNSCORED;
  var charts = {};
  var R = null;                 /* computeAll() 结果 */
  var state = { week: 'all', band: 'all', kw: '' };
  var todayCounts = {};         /* 今日打卡的内存状态 */

  /* ========================================================================
     ① 主题 —— 运行期唯一写入口，函数内两处锚点同写（铁律 13）
     ======================================================================== */
  function applyThemeAttr(name) {
    var t = name === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    var shell = document.querySelector('.app-shell');
    if (shell) { shell.setAttribute('data-theme', t); }
    return t;
  }

  function curTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function setTheme(name) {
    var t = applyThemeAttr(name);
    try { localStorage.setItem(A.LS_THEME, t); } catch (e) {}
    var btns = document.querySelectorAll('.theme-sw .ts-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-theme-set') === t);
    }
    /* getComputedStyle 读色值有滞后（实测约 300ms），图表重建须等沉降 */
    setTimeout(function () { buildCharts(); }, 360);
  }
  window.setTheme = setTheme;

  function tok(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ========================================================================
     ② 小工具
     ======================================================================== */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n, dp) {
    var v = Number(n) || 0;
    return '¥' + v.toLocaleString('zh-CN', {
      minimumFractionDigits: dp == null ? (v % 1 ? 2 : 0) : dp,
      maximumFractionDigits: dp == null ? 2 : dp
    });
  }
  function mdShort(iso) {
    var p = iso.split('-');
    return (+p[1]) + '/' + (+p[2]);
  }
  function todayISO() { return H.isoOf(new Date()); }
  function toast(msg) {
    var t = el('toast');
    if (!t) { return; }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* 周区间（周一–周日） */
  function weekRangeOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var wd = (d.getDay() + 6) % 7;              /* 周一 = 0 */
    var mon = new Date(d); mon.setDate(d.getDate() - wd);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: mon, to: sun };
  }

  /* ========================================================================
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

  /* ========================================================================
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

  function dowStats() {
    var order = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var sum = {}, n = {};
    order.forEach(function (d) { sum[d] = 0; n[d] = 0; });
    R.hist.forEach(function (d) {
      sum[d.dow] += A.dayScore(d);
      n[d.dow] += 1;
    });
    return order.map(function (d) {
      return { dow: d, sum: sum[d], n: n[d], avg: n[d] ? +(sum[d] / n[d]).toFixed(1) : 0 };
    });
  }

  /* ========================================================================
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

  /* ========================================================================
     ⑥ 渲染 · 今日打卡
     ======================================================================== */
  function renderToday() {
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

  function paintTodayScore() {
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

  /* ========================================================================
     ⑦ 周进度 —— 已移除（v1.1）
     ------------------------------------------------------------------------
     移除范围 = **该区块本体**：本周 6 格逐日条（#weekStrip）、周汇总可录入表
     （#wkHead/#wkBody）、周进度 KPI 四卡（#wScore/#wPrem/#wRate/#wLeft），
     连同它们的 store（baox.act.week）、bindWeekInputs 与 renderWeekSummary。

     刻意保留的「周」维度（若一并删掉，「周」在页面上就无迹可寻，
     而源模板的 O/P/Q/S 列纵向合并块正是按周切分的，等于丢掉源表骨架）：
       · 今日打卡横带里的两条本周进度条（#wkScoreVal / #wkPremVal）
       · 总览「周保费 vs 周目标」图（#chWeekGoal，读 R.weeks[].target）
       · 明细的「周次」筛选 chip（renderWeekChips —— 撤销式筛选的唯一入口）
     ======================================================================== */

  /* ========================================================================
     ⑧ 渲染 · 趋势热力
     ======================================================================== */
  function heatLevel(s) {
    if (s <= 0) { return 0; }
    if (s < 10) { return 1; }
    if (s < 20) { return 2; }
    if (s < 35) { return 3; }
    return 4;
  }

  function renderHeat() {
    var max = 0;
    R.hist.forEach(function (d) { max = Math.max(max, A.dayScore(d)); });
    el('heatGrid').innerHTML = R.hist.map(function (d) {
      var s = A.dayScore(d);
      return '<div class="heat-cell lv' + heatLevel(s) + '" title="' + d.date + ' ' + d.dow +
        ' · ' + s + ' 分 · ' + money(d.premium) + '">' +
        '<span class="hc-d">' + mdShort(d.date) + '</span>' +
        '<span class="hc-v">' + s + '</span></div>';
    }).join('');
    el('trendSub').textContent = '30 天逐日得分强度 · 最高 ' + max + ' 分 · 均值 ' +
      R.histAgg.avgScore + ' 分';
  }

  /* ========================================================================
     ⑨ 渲染 · 活动量构成
     ======================================================================== */
  function renderMix() {
    var a = R.histAgg;
    var rows = RULES.map(function (r) {
      var cnt = a.counts[r.key] || 0;
      return { r: r, cnt: cnt, score: cnt * r.pts,
               share: a.score ? cnt * r.pts / a.score * 100 : 0 };
    }).sort(function (x, y) { return y.score - x.score; });
    var top = rows[0] ? rows[0].score : 1;

    el('mixBars').innerHTML = rows.map(function (o) {
      return '<div class="mix-row"><div class="mix-nm">' + esc(o.r.name) +
        '<em>' + o.r.pts + '分</em></div>' +
        '<div class="mix-track"><div class="mix-fill" style="width:' +
        (top ? o.score / top * 100 : 0) + '%"></div></div>' +
        '<div class="mix-val"><b>' + o.score + '</b> 分<em>' +
        o.share.toFixed(1) + '%</em></div></div>';
    }).join('');

    el('mixTbody').innerHTML = rows.map(function (o) {
      return '<tr><td><b>' + esc(o.r.name) + '</b></td>' +
        '<td><span class="bd mute">' + esc(o.r.group) + '</span></td>' +
        '<td class="n">' + o.cnt + '</td>' +
        '<td class="n">' + o.r.pts + '</td>' +
        '<td class="n"><b>' + o.score + '</b></td>' +
        '<td class="n">' + o.share.toFixed(1) + '%</td>' +
        '<td class="n">' + (a.days ? (o.cnt / a.days).toFixed(2) : '0') + '</td></tr>';
    }).join('') + UNSCORED.map(function (u) {
      var cnt = a.counts[u.key] || 0;
      return '<tr><td>' + esc(u.name) + '</td><td><span class="bd mute">' + esc(u.group) +
        '</span></td><td class="n">' + cnt + '</td><td class="n">—</td>' +
        '<td class="n z">不计分</td><td class="n z">—</td><td class="n">' +
        (a.days ? (cnt / a.days).toFixed(2) : '0') + '</td></tr>';
    }).join('');

    el('mixSub').textContent = '加权得分合计 ' + a.score + ' 分 · 共 ' +
      RULES.length + ' 个计分项';
  }

  /* ========================================================================
     ⑩ 渲染 · 成功方程式
     ======================================================================== */
  function renderFunnel() {
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
      '而非转化异常。建议先补齐约访登记，再据此判断真实转化。'.replace(/\*\*/g, '');

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

  /* ========================================================================
     ⑪ 渲染 · 打卡明细
     ======================================================================== */
  var COLS = null;

  function ledgerRows() {
    if (!COLS) {
      COLS = [{ k: 'name', t: '日期' }, { k: 'dow', t: '星期' }, { k: 'week', t: '周次' }]
        .concat(RULES.map(function (r) { return { k: r.key, t: r.name, n: true }; }))
        .concat(UNSCORED.map(function (u) { return { k: u.key, t: u.name, n: true }; }))
        .concat([{ k: 'score', t: '总分', n: true }, { k: 'premium', t: '成交保费', n: true }]);
    }
    return COLS;
  }

  function weekOfDate(iso) {
    for (var i = 0; i < R.weeks.length; i++) {
      if (R.weeks[i].days.indexOf(iso) >= 0) { return R.weeks[i]; }
    }
    return null;
  }

  function filterBand(s, band) {
    if (band === 'all') { return true; }
    if (band === 'zero') { return s <= 0; }
    if (band === 'low') { return s >= 1 && s < 10; }
    if (band === 'mid') { return s >= 10 && s < 20; }
    if (band === 'high') { return s >= 20 && s < 35; }
    if (band === 'top') { return s >= 35; }
    return true;
  }

  function renderLedger() {
    var cols = ledgerRows();
    el('ledgerHead').innerHTML = cols.map(function (c) {
      return '<th' + (c.n ? ' class="n"' : '') + '>' + esc(c.t) + '</th>';
    }).join('');

    var list = R.hist.filter(function (d) {
      var s = A.dayScore(d);
      if (!filterBand(s, state.band)) { return false; }
      var w = weekOfDate(d.date);
      if (state.week !== 'all' && (!w || String(w.idx) !== String(state.week))) { return false; }
      if (state.kw) {
        var hay = d.date + ' ' + d.dow + ' 第' + (w ? w.idx : '?') + '周';
        if (hay.toLowerCase().indexOf(state.kw.toLowerCase()) < 0) { return false; }
      }
      return true;
    });

    var tot = { score: 0, premium: 0 };
    RULES.forEach(function (r) { tot[r.key] = 0; });
    UNSCORED.forEach(function (u) { tot[u.key] = 0; });

    var body = list.map(function (d) {
      var s = A.dayScore(d);
      var w = weekOfDate(d.date);
      tot.score += s; tot.premium += H.num(d.premium);
      var cells = '<td><b>' + d.date.replace(/-/g, '/') + '</b></td>' +
        '<td><span class="dow-tag">' + d.dow + '</span></td>' +
        '<td>' + (w ? '<span class="wk-chip">W' + w.idx + '</span>' : '—') + '</td>';
      RULES.forEach(function (r) {
        var v = H.num(d[r.key]);
        tot[r.key] += v;
        cells += '<td class="n' + (v ? '' : ' z') + '">' + (v || '·') + '</td>';
      });
      UNSCORED.forEach(function (u) {
        var v = H.num(d[u.key]);
        tot[u.key] += v;
        cells += '<td class="n' + (v ? '' : ' z') + '">' + (v || '·') + '</td>';
      });
      cells += '<td class="n"><b>' + s + '</b></td>' +
        '<td class="n">' + (d.premium ? money(d.premium) : '·') + '</td>';
      return '<tr>' + cells + '</tr>';
    }).join('');

    var totCells = '<td><b>合计 ' + list.length + ' 天</b></td><td>—</td><td>—</td>';
    RULES.forEach(function (r) {
      totCells += '<td class="n">' + tot[r.key] + '</td>';
    });
    UNSCORED.forEach(function (u) {
      totCells += '<td class="n">' + tot[u.key] + '</td>';
    });
    totCells += '<td class="n">' + tot.score + '</td><td class="n">' +
      money(tot.premium) + '</td>';

    el('ledgerBody').innerHTML = body +
      (list.length ? '<tr class="tot">' + totCells + '</tr>' : '');
    if (!list.length) {
      el('ledgerBody').innerHTML = '<tr><td colspan="' + cols.length +
        '"><div class="empty"><i class="fa-solid fa-filter-circle-xmark"></i>' +
        '当前筛选没有匹配的日期 · 再点一次已选中的标签即可取消</div></td></tr>';
    }
    el('ledgerSummary').textContent = '显示 ' + list.length + ' / ' + R.hist.length +
      ' 天 · 得分合计 ' + tot.score + ' 分 · 保费 ' + money(tot.premium);
    el('ledgerSub').textContent = '共 ' + R.hist.length + ' 天 · ' +
      cols.length + ' 列 · 空单元格以「·」表示';
  }

  function renderWeekChips() {
    var box = el('weekChips');
    var html = '<span class="chip' + (state.week === 'all' ? ' sel' : '') +
      '" data-week="all">全部</span>';
    html += R.weeks.map(function (w) {
      return '<span class="chip' + (String(state.week) === String(w.idx) ? ' sel' : '') +
        '" data-week="' + w.idx + '" title="' + w.from + ' – ' + w.to + ' · ' +
        w.dayCount + ' 天">W' + w.idx + '<em style="font-style:normal;color:var(--dim);margin-left:4px">' +
        mdShort(w.from) + '</em></span>';
    }).join('');
    box.innerHTML = '<span class="f-lab">周次</span>' + html;
  }

  /* ========================================================================
     ⑫ 计分说明 —— 已移除（v1.1）
     ------------------------------------------------------------------------
     移除范围：分值表（#rulesTbody）、源模板字段清单（#tplBox）、
     原始计分说明文本（#rulesText），以及 renderAudit 里那张「逐列对照」证据表
     （#auditFull / class="rules-tb col-tb"）。

     ⚠️ 只删**展示**，不删**计算**：src/core.js 的 sourceComparison().columns
     仍在，且仍由 src/verify-runtime.cjs 第 ⑦ 关逐列比对判定标签。
     也就是说「源表『总』行 5 列有误」这个事实依然被机器守着，
     只是不再逐格摊在页面上 —— 页面只保留总览那 5 行摘要（#auditBox）。
     ======================================================================== */

  /* ========================================================================
     ⑬ 图表（Chart.js）
     ======================================================================== */
  function chartFont() {
    return { family: '-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif', size: 11 };
  }

  function gridColor() {
    return curTheme() === 'light' ? 'rgba(90,74,42,.14)' : 'rgba(255,255,255,.07)';
  }

  function buildCharts() {
    if (typeof Chart === 'undefined') { return; }
    Object.keys(charts).forEach(function (k) {
      if (charts[k]) { charts[k].destroy(); }
    });
    charts = {};

    var text = tok('--text') || '#eee5db';
    var sub = tok('--sub') || '#aea198';
    var dim = tok('--dim') || '#887e76';
    var gold = tok('--gold1') || '#edbd87';
    var gold2 = tok('--gold2') || '#d28b57';
    var okc = tok('--ok-fg') || '#7fc79a';
    var badc = tok('--bad-fg') || '#ff6b60';
    var grid = gridColor();
    Chart.defaults.font.family = chartFont().family;
    Chart.defaults.font.size = 11;
    Chart.defaults.color = sub;

    var labels = R.hist.map(function (d) { return mdShort(d.date); });
    var scores = R.hist.map(A.dayScore);

    /* ① 逐日得分 + 7 日移动均线 */
    var ma = scores.map(function (_, i) {
      var s = 0, n = 0;
      for (var j = Math.max(0, i - 6); j <= i; j++) { s += scores[j]; n++; }
      return +(s / n).toFixed(1);
    });
    var cv1 = el('chDaily');
    if (cv1) {
      charts.daily = new Chart(cv1.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: '当日得分', data: scores, backgroundColor: gold2,
              borderColor: gold2, borderWidth: 0, borderRadius: 2, maxBarThickness: 22,
              order: 2 },
            { type: 'line', label: '7 日均线', data: ma, borderColor: gold,
              backgroundColor: gold, borderWidth: 2, pointRadius: 0,
              tension: .35, order: 1 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: sub, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
            tooltip: { callbacks: { afterBody: function (items) {
              var i = items[0].dataIndex;
              return '保费 ' + money(R.hist[i].premium) + ' · ' + R.hist[i].dow;
            } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: dim, maxRotation: 0, autoSkipPadding: 12 } },
            y: { beginAtZero: true, grid: { color: grid },
                 ticks: { color: dim, precision: 0 }, border: { display: false } }
          }
        }
      });
    }

    /* ② 周保费 vs 周目标 */
    var cv2 = el('chWeekGoal');
    if (cv2) {
      charts.weekGoal = new Chart(cv2.getContext('2d'), {
        type: 'bar',
        data: {
          labels: R.weeks.map(function (w) { return 'W' + w.idx; }),
          datasets: [
            { label: '周保费', data: R.weeks.map(function (w) { return w.premium; }),
              backgroundColor: R.weeks.map(function (w) {
                return w.premium >= w.target ? okc : gold2; }),
              borderRadius: 2, maxBarThickness: 44, order: 2 },
            { type: 'line', label: '周目标', data: R.weeks.map(function (w) { return w.target; }),
              borderColor: badc, borderWidth: 1.5, borderDash: [5, 4],
              pointRadius: 0, tension: 0, order: 1 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: sub, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
            tooltip: { callbacks: {
              label: function (c) {
                var w = R.weeks[c.dataIndex];
                return c.dataset.label + '：' + money(c.parsed.y) +
                  (c.datasetIndex === 0 ? '（达标率 ' + w.rate + '%）' : '');
              } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: dim } },
            y: { beginAtZero: true, grid: { color: grid }, border: { display: false },
                 ticks: { color: dim, callback: function (v) { return (v / 1000) + 'k'; } } }
          }
        }
      });
    }

    /* ③ 按星期平均得分 */
    var ds = dowStats();
    var cv3 = el('chDow');
    if (cv3) {
      charts.dow = new Chart(cv3.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ds.map(function (d) { return d.dow.slice(1); }),
          datasets: [{ label: '平均得分', data: ds.map(function (d) { return d.avg; }),
            backgroundColor: ds.map(function (d) {
              return d.avg >= R.histAgg.avgScore ? gold : gold2; }),
            borderRadius: 2, maxBarThickness: 36 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { afterBody: function (items) {
              var d = ds[items[0].dataIndex];
              return d.sum + ' 分 / ' + d.n + ' 天'; } } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: dim } },
            y: { beginAtZero: true, grid: { color: grid }, border: { display: false },
                 ticks: { color: dim } }
          }
        }
      });
    }

    /* ④ 累计得分曲线 */
    var cum = [], acc = 0;
    scores.forEach(function (s) { acc += s; cum.push(acc); });
    var cv4 = el('chCum');
    if (cv4) {
      charts.cum = new Chart(cv4.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: '累计得分', data: cum, borderColor: gold, borderWidth: 2,
            backgroundColor: 'transparent', pointRadius: 0, tension: .18, fill: false
          }, {
            label: '理想匀速（日均 ' + R.histAgg.avgScore + '）',
            data: scores.map(function (_, i) { return +((i + 1) * R.histAgg.avgScore).toFixed(1); }),
            borderColor: dim, borderWidth: 1, borderDash: [4, 4], pointRadius: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: sub, boxWidth: 10, boxHeight: 10, usePointStyle: true } } },
          scales: {
            x: { grid: { display: false }, ticks: { color: dim, maxRotation: 0, autoSkipPadding: 12 } },
            y: { beginAtZero: true, grid: { color: grid }, border: { display: false },
                 ticks: { color: dim } }
          }
        }
      });
    }
  }

  /* 主动重算：约束只让容器能缩，Chart.js 仍需外部踢一脚才重画（铁律 5） */
  function fitCharts() {
    Object.keys(charts).forEach(function (k) { if (charts[k]) { charts[k].resize(); } });
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* ========================================================================
     ⑭ 进场动画 —— 先 show 首屏、后挂 anim-ready；threshold:0 + 存活兜底（铁律 1/2）
     ======================================================================== */
  function initReveal() {
    var fits = [].slice.call(document.querySelectorAll('.fi'));
    if (!fits.length) { return; }
    function show(x) { x.classList.add('on'); }

    if (typeof IntersectionObserver !== 'function') { fits.forEach(show); return; }

    var vh = window.innerHeight || 800;
    fits.forEach(function (x) {
      var r = x.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) { show(x); }
    });

    document.documentElement.classList.add('anim-ready');

    var ioFired = false;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        ioFired = true;
        if (e.isIntersecting) { show(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    fits.forEach(function (x) { obs.observe(x); });

    setTimeout(function () { if (!ioFired) { fits.forEach(show); } }, 1500);
  }

  /* ========================================================================
     ⑮ 锚点滚动 —— 用 offsetTop 算布局位置，偏移按吸顶实测底部（铁律 11）
     ======================================================================== */
  function docTop(node) {
    var y = 0, n = node;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }

  function stickyBottom() {
    var maxB = 0;
    var bar = document.querySelector('.sidebar');
    if (bar && getComputedStyle(bar).position === 'fixed') {
      maxB = Math.max(maxB, Math.round(bar.getBoundingClientRect().bottom));
    }
    var tb = document.querySelector('.topbar');
    if (tb) { maxB = Math.max(maxB, Math.round(tb.getBoundingClientRect().bottom)); }
    return maxB;
  }

  function calibrateSticky() {
    var h = stickyBottom();
    if (h > 0) {
      document.documentElement.style.setProperty('--sticky-h', (h + 18) + 'px');
    }
    var pop = document.querySelector('.search-pop');
    if (pop) {
      pop.style.top = 'calc(' + (h + 4) + 'px + 100%)';
    }
  }

  function go(hash, instant) {
    var sec = document.querySelector(hash);
    if (!sec) { return false; }
    sec.classList.add('on');
    var top = Math.max(0, docTop(sec) - stickyBottom() - 16);
    window.scrollTo({ top: top, behavior: instant ? 'auto' : 'smooth' });
    return true;
  }

  function initNav() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a.nav-item') : null;
      if (!a) { return; }
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '#') { return; }
      if (go(href, false)) {
        e.preventDefault();
        var navs = document.querySelectorAll('.sidebar .nav-item');
        for (var i = 0; i < navs.length; i++) { navs[i].classList.toggle('active', navs[i] === a); }
        try { history.replaceState(null, '', href); } catch (err) {}
      }
    });

    /* 深链：原生 hash 只认 CSS scroll-margin-top，且发生在 JS 之前。
       这里 JS 启动后再精确校正一次（补显现 + instant 定位）。 */
    if (location.hash && location.hash.length > 1) {
      var target = document.querySelector(location.hash);
      if (target && target.classList.contains('section')) {
        target.classList.add('on');
        setTimeout(function () { go(location.hash, true); }, 90);
      }
    }

    /* 滚动高亮当前区块 */
    var secs = [].slice.call(document.querySelectorAll('section.section'));
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        var id = '#' + en.target.id;
        var navs = document.querySelectorAll('.sidebar .nav-item');
        for (var i = 0; i < navs.length; i++) {
          navs[i].classList.toggle('active', navs[i].getAttribute('href') === id);
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ========================================================================
     ⑯ 搜索
     ======================================================================== */
  function initSearch() {
    var input = el('searchInput');
    var pop = el('searchPop');
    var clear = el('searchClear');
    if (!input || !pop) { return; }

    function close() { pop.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); }
    function open() { pop.classList.add('open'); input.setAttribute('aria-expanded', 'true'); }

    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { close(); pop.innerHTML = ''; return; }
      var hits = R.hist.filter(function (d) {
        var w = weekOfDate(d.date);
        var hay = (d.date + ' ' + d.date.replace(/-/g, '/') + ' ' + d.dow +
          ' w' + (w ? w.idx : '') + ' 第' + (w ? w.idx : '') + '周 ' +
          Math.round(H.parseDay(d.date).getMonth() + 1) + '月').toLowerCase();
        return hay.indexOf(q) >= 0;
      }).slice(0, 12);
      pop.innerHTML = hits.length ? hits.map(function (d) {
        var w = weekOfDate(d.date);
        return '<button type="button" class="sp-item" data-go="' + d.date + '">' +
          '<span class="sp-ico acc"><i class="fa-solid fa-calendar-day"></i></span>' +
          '<span class="sp-txt"><b>' + d.date.replace(/-/g, '/') + ' · ' + d.dow + '</b>' +
          '<em>第 ' + (w ? w.idx : '?') + ' 周 · ' + A.dayScore(d) + ' 分 · ' +
          money(d.premium) + '</em></span>' +
          '<span class="sp-tag acc">' + (w ? 'W' + w.idx : '—') + '</span></button>';
      }).join('') : '<div class="sp-empty"><i class="fa-solid fa-magnifying-glass"></i>没有匹配的日期</div>';
      open();
    }

    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    clear.addEventListener('click', function () {
      input.value = ''; state.kw = ''; close(); renderLedger(); input.focus();
    });
    pop.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.sp-item');
      if (!b) { return; }
      state.kw = '';
      input.value = '';
      close();
      var date = b.getAttribute('data-go');
      var tr = el('ledgerBody').querySelector('tr');
      go('#ledger', false);
      toast('已定位到 ' + date.replace(/-/g, '/'));
    });
    document.addEventListener('click', function (e) {
      if (!el('tbSearch').contains(e.target)) { close(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); } });
  }

  /* ========================================================================
     ⑰ 设置数据 · 全量编辑 / 导入 / 导出（顶栏「设置数据」）
     ------------------------------------------------------------------------
     与 CRM / GEO 的设置抽屉共用同一套设计系统（.drawer / .set-group / .btn-gold），
     但数据形态不同，交互语言必须重设计：

       · CRM / GEO 存的是几十个标量，改一个存一个，即时可见。
       · 本页是 30 天 × 12 项 = 360 个格子 + 目标参数。若每敲一键就落盘并整页重算，
         会引发成百次重渲染竞争：光标跳、图表闪，还可能与本机打卡的写路径互相覆盖。
         → 一次性打开 → 抽屉内预演重算 → 点「保存并应用」才落盘。

     ⚠️ 生效机制：基线 + 覆盖层（本模块唯一的难点）
     面板的权威数据是 src/data.js 内嵌的 ACT_SEED（源模板 30 天实绩）。core.js 在
     加载时按引用持有它，computeAll() 每次调用都直接读它 —— 这是「唯一口径」的根基。
     所以「让编辑生效」只有两条路：
       ① 在 core.js 里加一层「读取时合并覆盖层」—— 改动唯一口径文件，风险外溢；
       ② 在应用层把覆盖层**并回 SEED 对象本身** —— core.js 一行不动，
          computeAll() 自然算出新结果，口径仍然只有一份实现。
     本模块走 ②：启动时深拷贝一份 BASE（源模板基线），每次 applyOverlay() 都是
     「先从 BASE 还原、再叠加覆盖层」，而不是在已改过的值上继续改。
     于是 applyOverlay() 幂等，「恢复源模板数据」天然可行 ——
     若在已改过的值上叠加，那个按钮根本无从实现。
     ======================================================================== */

  var LS_DATA = 'baox.act.data';   /* 覆盖层：只存**改过的**天与目标，未改的键不落盘 */
  var BASE = null;                 /* 源模板基线（深拷贝，只读） */
  var DRAFT = null;                /* 抽屉打开期间的编辑草稿 */
  var DG = null;                   /* 抽屉内 DOM 复用缓存（否则每键要做 480 次查询） */

  /* 可用 set-row 表达的标量目标参数。key 直接就是 targets 上的字段名 ——
     刻意不用 'a.b' 这样的路径串：调用点只有三处，getPath/setPath 那层间接
     除了多一处写错的机会，什么也没换来。 */
  var TGT_ROWS = [
    { key: 'month',     label: '月保费目标',     hint: '月达标率的分母',           step: 1000 },
    { key: 'weekShort', label: '当前周保费目标', hint: '今日打卡「本周保费」进度条', step: 500 },
    { key: 'mdrtCarry', label: 'MDRT 期初结余',  hint: '计入 MDRT 的起点',          step: 1000 }
  ];

  function cellKeys() { return RULES.concat(UNSCORED); }
  function cellNames() {
    return cellKeys().map(function (r) { return r.key; }).concat(['premium']);
  }

  /* ------------------------------------------------------------ 基线快照 */

  function baseSnapshot() {
    if (BASE) { return BASE; }
    var src = A.SEED;
    var days = (src.days || []).map(function (d) {
      var o = {}, k;
      for (k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) { o[k] = d[k]; } }
      return o;
    });
    var byDate = {};
    days.forEach(function (d) { byDate[d.date] = d; });
    var weeks = (src.weeks || []).map(function (w) {
      return { idx: w.idx, from: w.from, to: w.to, dayCount: w.dayCount, target: H.num(w.target) };
    });
    BASE = {
      days: days, byDate: byDate, weeks: weeks,
      targets: {
        month: H.num(A.TARGETS.month),
        weekShort: H.num(A.TARGETS.weekShort),
        mdrtCarry: H.num(A.TARGETS.mdrtCarry)
      },
      agg: A.aggregate(days)      /* 基线聚合，预演时当「旧值」用，不必每次重算 */
    };
    return BASE;
  }

  /* -------------------------------------------------------- 覆盖层读写 */

  function readOverlay() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(LS_DATA) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object') { o = {}; }
    return { days: o.days || {}, targets: o.targets || {}, weeks: o.weeks || {} };
  }

  /** 覆盖层条目总数。用来决定「恢复源模板数据」按钮该不该露面。 */
  function overlaySize(ov) {
    ov = ov || readOverlay();
    return Object.keys(ov.days).length + Object.keys(ov.targets).length +
           Object.keys(ov.weeks).length;
  }

  /* 空覆盖层**不落盘**（删键）。否则会写出一个 {} —— 于是「恢复源模板数据」
     按钮永远亮着，而它其实什么都不会恢复：状态显示在自欺欺人。 */
  function writeOverlay(ov) {
    try {
      if (overlaySize(ov) === 0) { localStorage.removeItem(LS_DATA); }
      else { localStorage.setItem(LS_DATA, JSON.stringify(ov)); }
      return true;
    } catch (e) { return false; }
  }

  /** 覆盖层并回 SEED。幂等：每次都从 BASE 重放，而不是在已改值上再改。 */
  function applyOverlay() {
    var b = baseSnapshot();
    var ov = readOverlay();
    var idx = {}, i, k;
    for (i = 0; i < b.days.length; i++) { idx[b.days[i].date] = i; }

    /* ① 逐日：整表还原成基线 */
    for (i = 0; i < b.days.length; i++) {
      var bd = b.days[i], node = A.SEED.days[i];
      if (!node) { continue; }
      for (k in bd) { if (k !== 'date') { node[k] = bd[k]; } }
    }
    /* ② 逐日：叠加覆盖层（不认识的键一律丢弃，不让外部 JSON 往种子里塞字段） */
    for (var dt in ov.days) {
      var j = idx[dt], rec = ov.days[dt];
      if (j === undefined || !rec) { continue; }
      for (k in rec) {
        if (k === 'date' || !(k in b.days[j])) { continue; }
        A.SEED.days[j][k] = rec[k];
      }
    }
    /* ③ 各周保费目标 */
    for (i = 0; i < b.weeks.length; i++) {
      var bw = b.weeks[i], wn = A.SEED.weeks[i];
      if (!wn) { continue; }
      wn.target = (ov.weeks[bw.idx] === undefined) ? bw.target : ov.weeks[bw.idx];
    }
    /* ④ 标量目标参数（A.TARGETS 与 SEED.targets 是同一个对象） */
    TGT_ROWS.forEach(function (r) {
      A.TARGETS[r.key] = (ov.targets[r.key] === undefined) ? b.targets[r.key] : ov.targets[r.key];
    });
    /* A.TARGETS.week 保持原值：weekRows() 里它只是 w.target 的兜底，
       而 5 个周都自带 target，所以它实际不参与任何计算 —— 因此不进 UI。 */
    return ov;
  }

  /** 把「一组完整值」diff 成覆盖层。保存与导入共用同一份判定：
      两处各写一遍必然分叉 —— 导入的备份会多出「等于源值却仍记为改动」的幽灵键。 */
  function diffOverlay(daysMap, targets, weeks) {
    var b = baseSnapshot();
    var ov = { days: {}, targets: {}, weeks: {} };
    var keys = cellNames();

    b.days.forEach(function (bd) {
      var src = daysMap && daysMap[bd.date];
      if (!src) { return; }
      var rec = null;
      keys.forEach(function (k) {
        if (!(k in src)) { return; }
        if (H.num(src[k]) !== H.num(bd[k])) { rec = rec || {}; rec[k] = H.num(src[k]); }
      });
      if (rec) { ov.days[bd.date] = rec; }
    });
    if (targets) {
      TGT_ROWS.forEach(function (r) {
        if (targets[r.key] === undefined) { return; }
        if (H.num(targets[r.key]) !== b.targets[r.key]) { ov.targets[r.key] = H.num(targets[r.key]); }
      });
    }
    if (weeks) {
      b.weeks.forEach(function (bw) {
        var v = weeks[bw.idx];
        if (v === undefined) { return; }
        if (H.num(v) !== bw.target) { ov.weeks[bw.idx] = H.num(v); }
      });
    }
    return ov;
  }

  /** 基线 + 覆盖层 → 可编辑草稿（只含允许编辑的键）。 */
  function buildDraft() {
    var b = baseSnapshot();
    var ov = readOverlay();
    var keys = cellNames();
    var days = {};
    b.days.forEach(function (bd) {
      var o = {}, k, rec = ov.days[bd.date];
      keys.forEach(function (x) { o[x] = H.num(bd[x]); });
      if (rec) { for (k in rec) { if (k in o) { o[k] = H.num(rec[k]); } } }
      days[bd.date] = o;
    });
    var wks = {};
    b.weeks.forEach(function (bw) {
      wks[bw.idx] = (ov.weeks[bw.idx] === undefined) ? bw.target : H.num(ov.weeks[bw.idx]);
    });
    var tgt = {};
    TGT_ROWS.forEach(function (r) {
      tgt[r.key] = (ov.targets[r.key] === undefined) ? b.targets[r.key] : H.num(ov.targets[r.key]);
    });
    return { days: days, weeks: wks, targets: tgt };
  }

  /* ------------------------------------------------------------ 渲染抽屉 */

  function buildSettings() {
    var b = baseSnapshot();
    var keys = cellKeys();
    var html = '';

    /* ① 标量目标参数 */
    html += '<div class="set-group"><div class="set-group-title">目标参数' +
      '<span>顶栏 KPI、进度条与图表推算的基准</span></div>' +
      TGT_ROWS.map(function (r) {
        return '<div class="set-row"><label class="set-label" for="st-' + r.key + '">' +
          esc(r.label) + '<em>' + esc(r.hint) + '</em></label>' +
          '<input class="set-input" id="st-' + r.key + '" type="number" min="0" step="' +
          r.step + '" value="' + DRAFT.targets[r.key] + '" data-tgt="' + r.key +
          '" aria-label="' + esc(r.label) + '"></div>';
      }).join('') + '</div>';

    /* ② 各周保费目标 —— 源模板是**逐周**给的（W1 首周 4 天 8750，W5 末周 5 天也 8750），
       不能归纳成「首周 / 常规周」两个值：那样一改就会把 W5 改错。 */
    html += '<div class="set-group"><div class="set-group-title">各周保费目标' +
      '<span>对应「周保费 vs 周目标」图</span></div>' +
      b.weeks.map(function (w) {
        return '<div class="set-row"><label class="set-label" for="sw-' + w.idx + '">W' + w.idx +
          '<em>' + w.from.replace(/-/g, '/') + ' – ' + w.to.replace(/-/g, '/') + ' · ' +
          w.dayCount + ' 天</em></label>' +
          '<input class="set-input" id="sw-' + w.idx + '" type="number" min="0" step="500" value="' +
          DRAFT.weeks[w.idx] + '" data-wkt="' + w.idx + '" aria-label="W' + w.idx +
          ' 周保费目标"></div>';
      }).join('') + '</div>';

    /* ③ 逐日数据网格（吸顶表头 + 吸顶日期列 + 吸顶合计行） */
    html += '<div class="set-group"><div class="set-group-title">逐日数据' +
      '<span>30 天 × ' + keys.length + ' 项 + 当日保费 · 改动过的格子亮金色描边</span></div>' +
      '<div class="dg-wrap"><table class="dg-tb"><thead><tr><th class="dg-d">日期</th>' +
      keys.map(function (r) {
        return '<th class="n" title="' + esc(r.name + '（源表列 ' + r.col + '）· ' +
          (r.pts > 0 ? r.pts + ' 分 / 次' : '不计分')) + '">' + esc(r.name) + '</th>';
      }).join('') +
      '<th class="n" title="当日成交保费（元）">保费</th><th class="n">得分</th>' +
      '</tr></thead><tbody>' +
      b.days.map(function (d) {
        return '<tr><td class="dg-d">' + d.date.slice(5).replace('-', '/') +
          '<em>' + esc(d.dow || '') + '</em></td>' +
          keys.map(function (r) {
            return '<td class="n"><input class="dg-in" type="number" min="0" step="1" value="' +
              DRAFT.days[d.date][r.key] + '" data-d="' + d.date + '" data-k="' + r.key +
              '" aria-label="' + d.date + ' ' + esc(r.name) + '"></td>';
          }).join('') +
          '<td class="n"><input class="dg-in wide" type="number" min="0" step="1000" value="' +
          DRAFT.days[d.date].premium + '" data-d="' + d.date + '" data-k="premium" aria-label="' +
          d.date + ' 当日保费"></td>' +
          '<td class="n dg-sc" data-sc="' + d.date + '">—</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td class="dg-d">合计</td>' +
      keys.map(function (r) { return '<td class="n" data-ft="' + r.key + '">—</td>'; }).join('') +
      '<td class="n" data-ft="premium">—</td><td class="n" data-ft="score">—</td>' +
      '</tr></tfoot></table></div>' +
      '<div class="dg-preview" id="setPreview">正在预演…</div>' +
      '<div class="dg-note">得分 = Σ(次数 × 分值)，走的是页面同一个 <b>dayScore</b> 实现，' +
      '不在抽屉里另写一套；「成交家庭数」计入合计但不计分。改动只写本机浏览器，' +
      '点<b>保存并应用</b>后才生效。</div></div>';

    el('setBody').innerHTML = html;

    /* DOM 复用缓存：不缓存的话每敲一键都要做 30×15 次 querySelector，白白拖慢输入 */
    var body = el('setBody');
    DG = { rows: {}, foot: {}, sc: {}, preview: el('setPreview') };
    keys.forEach(function (r) { DG.foot[r.key] = body.querySelector('[data-ft="' + r.key + '"]'); });
    DG.foot.premium = body.querySelector('[data-ft="premium"]');
    DG.foot.score = body.querySelector('[data-ft="score"]');
    b.days.forEach(function (d) { DG.sc[d.date] = body.querySelector('[data-sc="' + d.date + '"]'); });

    refreshSettings();
  }

  function pv(label, a, b, unit) {
    var f = function (v) {
      return unit === 'currency' ? money(v, 0)
        : unit === 'percent' ? (Number(v) || 0).toFixed(1) + '%'
        : String(Math.round((Number(v) || 0) * 100) / 100);
    };
    var chg = Math.abs(Number(a) - Number(b)) > 1e-9;
    return '<span style="white-space:nowrap">' + label +
      ' <span class="dg-ar">' + f(a) + ' →</span> <b' +
      (chg ? ' style="color:var(--gold1)"' : '') + '>' + f(b) + '</b></span>';
  }

  function countDirty() {
    var cells = 0, days = 0, tgt = 0;
    var keys = cellNames();
    BASE.days.forEach(function (bd) {
      var dr = DRAFT.days[bd.date], n = 0;
      keys.forEach(function (k) { if (H.num(dr[k]) !== H.num(bd[k])) { n++; } });
      if (n) { days++; cells += n; }
    });
    TGT_ROWS.forEach(function (r) {
      if (DRAFT.targets[r.key] !== BASE.targets[r.key]) { tgt++; }
    });
    BASE.weeks.forEach(function (bw) {
      if (DRAFT.weeks[bw.idx] !== bw.target) { tgt++; }
    });
    return { cells: cells, days: days, tgt: tgt };
  }

  /** 实时合计 + 重算预演。30 天 × 12 项的重算是纯算术，无需防抖到「感觉迟钝」的程度；
      130ms 只是为了让连续输入时不在每个 keydown 都重排一次 DOM。 */
  function refreshSettings() {
    if (!DRAFT || !DG) { return; }
    var keys = cellKeys();
    var list = BASE.days.map(function (d) { return DRAFT.days[d.date]; });
    var agg = A.aggregate(list);

    BASE.days.forEach(function (d) {
      var cell = DG.sc[d.date];
      if (cell) { cell.textContent = A.dayScore(DRAFT.days[d.date]); }
    });
    keys.forEach(function (r) {
      var td = DG.foot[r.key];
      if (td) { td.textContent = agg.counts[r.key] || 0; }
    });
    if (DG.foot.premium) { DG.foot.premium.textContent = money(agg.premium, 0); }
    if (DG.foot.score) { DG.foot.score.textContent = agg.score; }

    if (DG.preview) {
      var bA = BASE.agg;
      var bMdrt = BASE.targets.mdrtCarry + bA.premium;
      var nMdrt = DRAFT.targets.mdrtCarry + agg.premium;
      var bRate = BASE.targets.month ? bA.premium / BASE.targets.month * 100 : 0;
      var nRate = DRAFT.targets.month ? agg.premium / DRAFT.targets.month * 100 : 0;
      var n = countDirty();
      DG.preview.innerHTML =
        pv('总分', bA.score, agg.score) +
        pv('保费', bA.premium, agg.premium, 'currency') +
        pv('月达标率', bRate, nRate, 'percent') +
        pv('MDRT 累计', bMdrt, nMdrt, 'currency') +
        pv('件均', bA.perDeal, agg.perDeal, 'currency') +
        '<span style="margin-left:auto">改动 <b>' + n.cells + '</b> 处 / <b>' + n.days +
        '</b> 天' + (n.tgt ? ' · 目标参数 <b>' + n.tgt + '</b> 项' : '') + '</span>';
    }
  }

  function markDirty(inp, dt) {
    var bd = BASE.byDate[dt];
    var k = inp.getAttribute('data-k');
    var v = inp.value === '' ? 0 : H.num(inp.value);
    inp.setAttribute('data-dirty', (bd && v !== H.num(bd[k])) ? '1' : '0');
  }

  function onSettingInput(e) {
    if (!DRAFT) { return; }
    var t = e.target;
    if (!t || t.tagName !== 'INPUT') { return; }
    var v = t.value === '' ? 0 : H.num(t.value);
    var dt = t.getAttribute('data-d');
    var tg = t.getAttribute('data-tgt');
    var wk = t.getAttribute('data-wkt');
    if (dt && DRAFT.days[dt]) {
      DRAFT.days[dt][t.getAttribute('data-k')] = v;
      markDirty(t, dt);
    } else if (tg) {
      DRAFT.targets[tg] = v;
      t.setAttribute('data-dirty', v !== BASE.targets[tg] ? '1' : '0');
    } else if (wk) {
      DRAFT.weeks[wk] = v;
      t.setAttribute('data-dirty', v !== BASE.weeks[Number(wk) - 1].target ? '1' : '0');
    } else { return; }
    clearTimeout(onSettingInput._tm);
    onSettingInput._tm = setTimeout(refreshSettings, 130);
  }

  function bindSettings() {
    var body = el('setBody');
    if (body && !body.getAttribute('data-bound')) {
      body.setAttribute('data-bound', '1');
      body.addEventListener('input', onSettingInput);
      body.addEventListener('change', onSettingInput);
    }
    if (!bindSettings._esc) {
      bindSettings._esc = true;
      document.addEventListener('keydown', function (e) {
        var d = el('setDrawer');
        if (e.key === 'Escape' && d && d.classList.contains('open')) { closeSettings(); }
      });
    }
  }

  /* ---------------------------------------------------------------- 开合 */

  function openSettings() {
    baseSnapshot();
    DRAFT = buildDraft();
    buildSettings();
    var btn = el('btnRestore');
    if (btn) { disarmRestore(); btn.hidden = overlaySize() === 0; }
    el('setMask').classList.add('open');
    el('setDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSettings() {
    var m = el('setMask'), d = el('setDrawer');
    if (m) { m.classList.remove('open'); }
    if (d) { d.classList.remove('open'); }
    document.body.style.overflow = '';
    DRAFT = null;
  }

  /* ------------------------------------------------------------- 保存应用 */

  function saveSettings() {
    if (!DRAFT) { return; }
    var ov = diffOverlay(DRAFT.days, DRAFT.targets, DRAFT.weeks);
    var nDay = Object.keys(ov.days).length, nCell = 0, k;
    for (var dt in ov.days) { for (k in ov.days[dt]) { nCell++; } }
    var nTgt = Object.keys(ov.targets).length + Object.keys(ov.weeks).length;

    if (!writeOverlay(ov)) { toast('保存失败：本机存储不可写（可能处于隐私模式）'); return; }
    applyOverlay();
    closeSettings();
    refreshAll();
    fitCharts();
    toast(nDay || nTgt
      ? '已应用 ' + nDay + ' 天 / ' + nCell + ' 处改动' + (nTgt ? ' · 目标参数 ' + nTgt + ' 项' : '')
      : '数据与源模板一致，无需改动');
  }

  /* 恢复源模板：**两次点击确认**，不做单点即执行。
     单点执行是静默破坏性操作 —— 点错一次，30 天数据连同目标参数一起消失，
     而画面「看起来只是数字变小了」。第一次点击把按钮改成红色问句，
     4 秒内没有第二次点击就自动解除武装（避免长时间悬停的误触）。 */
  function disarmRestore() {
    var btn = el('btnRestore');
    if (!btn) { return; }
    btn.removeAttribute('data-armed');
    btn.classList.remove('danger');
    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span>恢复源模板数据</span>';
  }

  function restoreSource() {
    var btn = el('btnRestore');
    if (!btn) { return; }
    if (btn.getAttribute('data-armed') !== '1') {
      btn.setAttribute('data-armed', '1');
      btn.classList.add('danger');
      btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' +
        '<span>再点一次确认恢复</span>';
      clearTimeout(restoreSource._tm);
      restoreSource._tm = setTimeout(disarmRestore, 4000);
      return;
    }
    clearTimeout(restoreSource._tm);
    disarmRestore();
    try { localStorage.removeItem(LS_DATA); } catch (e) {}
    applyOverlay();
    closeSettings();
    refreshAll();
    fitCharts();
    toast('已恢复源模板数据');
  }

  /* --------------------------------------------------------- 导出 / 导入 */

  /** 导出**全量当前值**而不是覆盖层 diff：备份的语义是「搬到另一台机器能完整复原」，
      而 diff 只有在基线也一致时才有意义，换个面板版本就会错位。 */
  function collectExport() {
    return {
      app: 'baox-activity',
      version: 1,
      exportedAt: new Date().toISOString(),
      period: (A.SEED.meta && A.SEED.meta.period) || null,
      targets: {
        month: H.num(A.TARGETS.month),
        weekShort: H.num(A.TARGETS.weekShort),
        mdrtCarry: H.num(A.TARGETS.mdrtCarry)
      },
      weeks: A.SEED.weeks.map(function (w) { return { idx: w.idx, target: H.num(w.target) }; }),
      days: A.SEED.days.map(function (d) {
        var o = { date: d.date, premium: H.num(d.premium) };
        cellKeys().forEach(function (r) { o[r.key] = H.num(d[r.key]); });
        return o;
      }),
      changedDays: Object.keys(readOverlay().days).length
    };
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(collectExport(), null, 2)],
      { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '公子的活动量数据_' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    toast('已导出完整数据（JSON 备份 · 30 天）');
  }

  function triggerImport() {
    var f = el('importFile');
    if (f) { f.value = ''; f.click(); }
  }

  function importData(input) {
    var f = input && input.files && input.files[0];
    if (!f) { return; }
    var rd = new FileReader();
    rd.onload = function () {
      var obj = null;
      try { obj = JSON.parse(String(rd.result)); } catch (e) { obj = null; }
      if (!obj || obj.app !== 'baox-activity' || !obj.days || !obj.days.length) {
        toast('导入失败：不是本面板导出的 JSON 备份');
        return;
      }
      var daysMap = {};
      obj.days.forEach(function (d) { if (d && d.date) { daysMap[d.date] = d; } });
      var weeksMap = null;
      if (obj.weeks && obj.weeks.length) {
        weeksMap = {};
        obj.weeks.forEach(function (w) { if (w && w.idx !== undefined) { weeksMap[w.idx] = w.target; } });
      }
      var ov = diffOverlay(daysMap, obj.targets || null, weeksMap);
      /* 即便备份与源模板完全一致也要走 writeOverlay：它会把旧覆盖层清成空键 ——
         「导入一份干净的备份」的语义就是「回到那份备份」，不是「在现状上再叠一层」。 */
      if (!writeOverlay(ov)) { toast('导入失败：本机存储不可写'); return; }
      applyOverlay();
      closeSettings();
      refreshAll();
      fitCharts();
      var n = overlaySize(ov);
      toast(n ? '已导入 ' + Object.keys(ov.days).length + ' 天数据' +
        (Object.keys(ov.targets).length + Object.keys(ov.weeks).length ? ' + 目标参数' : '')
        : '已导入：内容与源模板一致');
    };
    rd.readAsText(f);
  }

  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.saveSettings = saveSettings;
  window.restoreSource = restoreSource;
  window.exportData = exportData;
  window.triggerImport = triggerImport;
  window.importData = importData;

  /* 供运行期门禁取证（与 __ACT_SNAPSHOT__ 同一模式，铁律 12）：
     只读引用 + 入口，不提供「绕过二次确认」的捷径 ——
     若提供一个 clear()，门禁测到的就不是用户真正会走的那条路。 */
  window.__ACT_SETTINGS__ = { collect: collectExport, overlay: readOverlay };

  /* ========================================================================
     ⑱ 绑定与启动
     ======================================================================== */
  function bindChips() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.chip') : null;
      if (!t) { return; }
      var wk = t.getAttribute('data-week');
      var bd = t.getAttribute('data-band');
      if (wk !== null) {
        /* 再点一次已选中的标签 = 取消筛选（撤销动作自带可见反馈，无需「重置」按钮） */
        state.week = (state.week === wk || (state.week !== 'all' && wk === 'all')) ? 'all' : wk;
        renderWeekChips(); renderLedger(); return;
      }
      if (bd !== null) {
        state.band = (state.band === bd) ? 'all' : bd;
        var sib = t.parentNode.querySelectorAll('.chip');
        for (var i = 0; i < sib.length; i++) {
          sib[i].classList.toggle('sel',
            sib[i].getAttribute('data-band') === state.band ||
            (state.band === 'all' && sib[i].getAttribute('data-band') === 'all'));
        }
        renderLedger();
      }
    });
  }

  function bindToday() {
    el('checkGrid').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ck-btn') : null;
      if (!b || b.disabled) { return; }
      var card = b.closest('.ck');
      var key = card.getAttribute('data-key');
      var d = parseInt(b.getAttribute('data-d'), 10);
      todayCounts[key] = Math.max(0, H.num(todayCounts[key]) + d);
      var v = todayCounts[key];
      card.classList.toggle('on', v > 0);
      card.classList.toggle('zero', v <= 0);
      card.querySelector('.ck-cnt').textContent = v;
      card.querySelector('.ck-bar i').style.width = Math.min(100, v * 12) + '%';
      var unit = card.querySelectorAll('.ck-unit');
      var pts = 0;
      for (var i = 0; i < RULES.length; i++) { if (RULES[i].key === key) { pts = RULES[i].pts; } }
      if (unit.length > 1) {
        unit[unit.length - 1].innerHTML = v + ' × ' + pts +
          ' = <b style="color:var(--gold1)">' + (v * pts) + '</b> 分';
      }
      var minus = card.querySelector('.ck-btn[data-d="-1"]');
      if (minus) { minus.disabled = v <= 0; }
      paintTodayScore();
    });

    el('todayNote').addEventListener('input', function () { paintTodayScore(); });
  }

  function refreshAll() {
    R = A.computeAll();
    renderKPI();
    renderInsights();
    renderAudit();
    renderToday();
    renderHeat();
    renderMix();
    renderFunnel();
    renderLedger();
    el('nbToday').textContent = (R.histAgg.days + R.local.length) + '天';
    buildCharts();
  }

  function boot() {
    /* 主题：单一写入口 */
    var saved = null;
    try { saved = localStorage.getItem(A.LS_THEME); } catch (e) {}
    var t = applyThemeAttr(saved === 'light' ? 'light' : 'dark');
    var btns = document.querySelectorAll('.theme-sw .ts-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-theme-set') === t);
    }

    var d = new Date();
    var dows = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    el('todayStr').textContent = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' +
      d.getDate() + ' 日 · ' + dows[d.getDay()];

    /* 覆盖层必须先并回种子，再渲染 —— 顺序反了就是「保存了却不生效」，
       而且症状极具欺骗性：抽屉里预演正确、页面数字不动，像没保存成功。 */
    applyOverlay();
    refreshAll();
    renderWeekChips();
    bindChips();
    bindToday();
    bindSettings();
    initSearch();
    initNav();
    initReveal();
    calibrateSticky();

    window.addEventListener('resize', debounce(function () { fitCharts(); calibrateSticky(); }, 120));
    window.addEventListener('orientationchange', debounce(function () {
      fitCharts(); calibrateSticky();
    }, 120));

    /* 供运行期数据门禁取证（铁律 12） */
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
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
