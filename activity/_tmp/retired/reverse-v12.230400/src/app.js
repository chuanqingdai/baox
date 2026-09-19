/* ============================================================================
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

  /** 种子里的统计窗口。缺 meta 时给零值对象而不是抛错 ——
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
  function weekRangeOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var wd = (d.getDay() + 6) % 7;              /* 周一 = 0 */
    var mon = new Date(d); mon.setDate(d.getDate() - wd);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: mon, to: sun };
  }

  /* ========================================================================
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

  /* ========================================================================
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

  function dowStats() {
    var order = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var sum = {}, n = {};
    order.forEach(function (d) { sum[d] = 0; n[d] = 0; });
    R.days.forEach(function (d) {
      sum[d.dow] += A.dayScore(d);
      n[d.dow] += 1;
    });
    return order.map(function (d) {
      return { dow: d, sum: sum[d], n: n[d], avg: n[d] ? +(sum[d] / n[d]).toFixed(1) : 0 };
    });
  }

  /* ========================================================================
     ⑤ 源表口径校验 —— 已移除（v1.2）
     ------------------------------------------------------------------------
     按公子指令整体去掉。随之消失的不只是展示：core.js 的 sourceComparison()
     与 verify-runtime 第 ⑦ 关也一并删除 —— 那是本面板与源模板之间**唯一**的
     引用点，拆掉之后「源模板」在本项目里再无任何引用。
     保留计算、只删展示（v1.1 的做法）看似稳妥，实际是留着一份不再被任何人
     比对的证据表：它不会报错，也不会有人看，却让每个后来者以为「这件事还有人守着」。
     #auditBox 已从 body.html 删除，同行原本并排的「周保费 vs 周目标」改通栏。
     ======================================================================== */

  /* ========================================================================
     ⑥ 渲染 · 今日打卡
     ======================================================================== */
  function renderToday() {
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

  function paintTodayScore() {
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

  /* ========================================================================
     ⑦ 周进度 —— 已移除（v1.1）
     ------------------------------------------------------------------------
     移除范围 = **该区块本体**：本周 6 格逐日条（#weekStrip）、周汇总可录入表
     （#wkHead/#wkBody）、周进度 KPI 四卡（#wScore/#wPrem/#wRate/#wLeft），
     连同它们的 store（baox.act.week）、bindWeekInputs 与 renderWeekSummary。

     刻意保留的「周」维度（若一并删掉，「周」在页面上就无迹可寻，
     而周目标与周达标率本就是这套活动量管理的基本单位，等于丢掉面板骨架）：
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
    R.days.forEach(function (d) { max = Math.max(max, A.dayScore(d)); });
    el('heatGrid').innerHTML = R.days.map(function (d) {
      var s = A.dayScore(d);
      return '<div class="heat-cell lv' + heatLevel(s) + '" title="' + d.date + ' ' + d.dow +
        ' · ' + s + ' 分 · ' + money(d.premium) + '">' +
        '<span class="hc-d">' + mdShort(d.date) + '</span>' +
        '<span class="hc-v">' + s + '</span></div>';
    }).join('');
    el('trendSub').textContent = period().days + ' 天逐日得分强度 · 最高 ' + max +
      ' 分 · 均值 ' + R.agg.avgScore + ' 分';
  }

  /* ========================================================================
     ⑨ 渲染 · 活动量构成
     ======================================================================== */
  function renderMix() {
    var a = R.agg;
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

    el('mixSub').textContent = '加权得分合计 ' + a.score + ' 分 · ' +
      RULES.length + ' 个计分项 · 单轮满分 ' +
      RULES.reduce(function (s, r) { return s + r.pts; }, 0) + ' 分';
  }

  /* ========================================================================
     ⑩ 渲染 · 成功方程式
     ======================================================================== */
  function renderFunnel() {
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

    var list = R.days.filter(function (d) {
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
    el('ledgerSummary').textContent = '显示 ' + list.length + ' / ' + R.days.length +
      ' 天 · 得分合计 ' + tot.score + ' 分 · 保费 ' + money(tot.premium);
    el('ledgerSub').textContent = '共 ' + R.days.length + ' 天 · ' +
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
     ⑫ 计分说明 · 源表口径 —— 均已移除
     ------------------------------------------------------------------------
     v1.1 删的是**展示**（#rulesTbody / #tplBox / #rulesText / #auditFull），
     并刻意留下计算侧的 sourceComparison() 与 verify-runtime 第 ⑦ 关，
     守着「源表『总』行有误」这个事实。
     v1.2 把整个「源表口径校验」模块去掉，**计算侧随之消失** ——
     面板与源模板之间再无任何引用点，那些还写着「仍在场」的注释也一并清掉：
     注释里的过期陈述比没有注释更糟，它会让下一个人按错误的前提做判断。
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

    var labels = R.days.map(function (d) { return mdShort(d.date); });
    var scores = R.days.map(A.dayScore);

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
              return '保费 ' + money(R.days[i].premium) + ' · ' + R.days[i].dow;
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
              return d.avg >= R.agg.avgScore ? gold : gold2; }),
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
            label: '理想匀速（日均 ' + R.agg.avgScore + '）',
            data: scores.map(function (_, i) { return +((i + 1) * R.agg.avgScore).toFixed(1); }),
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
      var hits = R.days.filter(function (d) {
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

     ⚠️ 生效机制：基线 + 覆盖层 —— 但**实现不在这一层**（v1.2 改动）
     面板的权威数据是 src/data.js 内嵌的 ACT_SEED。core.js 按引用持有它，
     computeAll() 每次直接读它 —— 这是「唯一口径」的根基。让编辑生效只有一条路：
     把覆盖层**并回 SEED 对象本身**，core.js 一行不动，computeAll() 自然算出新结果。

     ⚠️ 为什么这一层的存储代码整段删掉了（本轮最关键的一次删除）
     v1.1 里本文件自带一份完整的 readOverlay / writeOverlay / applyOverlay /
     diffOverlay / baseSnapshot，用的私有键是 baox.act.data；而「今日打卡」写的是
     baox.act.log。两条路都声称在写「今天」，于是：
       · 同一天有两个真相，谁后写谁赢，且互不知情（打卡能盖掉设置，反之亦然）；
       · 抽屉里预演正确、页面上数字不动，看起来像「没保存成功」。
     这种分叉不报错、不抛异常，只是数字安静地对不上。全部收敛到 core.js 之后，
     本层只调用五个入口，且不再持有任何存储代码：
       A.applyOverlay()   A.commit(ov)   A.overlaySize()   A.diffOverlay(...)   A.readOverlay()
     ======================================================================== */

  /* 本层只留「抽屉打开期间的编辑草稿」。覆盖层与基线都搬进了 core.js ——
     它们是**口径**的一部分：基线决定「什么算改过」，那是判断，不是交互。
     放在应用层时，「本机改过的值算不算权威」就成了应用层的自由裁量，
     两份实现随即开始分叉。 */
  var DRAFT = null;                /* 抽屉打开期间的编辑草稿 */
  var DG = null;                   /* 抽屉内 DOM 复用缓存（否则每键要做 480 次查询） */

  /* 业务指标六项：**全部手动维护**，在设置抽屉里改。
     为什么不再有「月保费目标 / 当前周保费目标 / MDRT 期初结余」三个标量：
     公子裁定删掉 MDRT 与月目标，只保留周目标（5 个周各自一个，见下一组）。
     「全局周目标」与「逐周目标」并存时，前者只是兜底值、永远不参与计算，
     却会出现在 UI 里让人以为改了它有用 —— 那是主动制造出来的困惑。
     key 就是 biz 上的字段名；刻意不用 'a.b' 路径串：调用点只有四处，
     getPath/setPath 那层间接除了多一处写错的机会，什么也没换来。 */
  var BIZ_ROWS = [
    { key: 'monthPerf',      label: '本月业绩',     hint: '本月累计保费',          step: 1000 },
    { key: 'quarterPerf',    label: '本季度业绩',   hint: '季度目标完成率的分子',  step: 1000 },
    { key: 'yearPerf',       label: '本年度业绩',   hint: '本年累计保费',          step: 1000 },
    { key: 'quarterGoal',    label: '季度目标业绩', hint: '季度目标完成率的分母',  step: 1000 },
    { key: 'quarterDeals',   label: '季度成交单数', hint: '本季度累计件数',        step: 1 },
    { key: 'quarterPremium', label: '季度成交保费', hint: '本季度累计保费',        step: 1000 }
  ];

  /** 按 idx 取基线周目标。
      **刻意不写 A.BASE.weeks[idx - 1].target** —— 那是「数组下标恰好等于
      idx 减一」的隐式假设。一旦周次编号方式变了（从 W0 起、或补一个汇总周），
      它不会报错，只会静默地拿错一周的目标去比对，于是「改动」计数凭空多一项。 */
  function bwTarget(idx) {
    var w = null;
    A.BASE.weeks.forEach(function (x) { if (String(x.idx) === String(idx)) { w = x; } });
    return w ? H.num(w.target) : 0;
  }

  function cellKeys() { return RULES.concat(UNSCORED); }
  function cellNames() {
    return cellKeys().map(function (r) { return r.key; }).concat(['premium']);
  }

  /* ------------------------------------------- 基线 / 覆盖层 —— 已移交 core.js
     这里原本是六个函数、约 120 行：baseSnapshot()、readOverlay()、overlaySize()、
     writeOverlay()、applyOverlay()、diffOverlay()，外加私有键 baox.act.data。

     删掉它们不是「顺手精简」。core.js 里现在有**同名同职责**的一整套，
     而两份实现必然分叉 —— 并且这种分叉是静默的：不抛异常、不报错，
     只是数字安静地对不上（抽屉里预演正确、页面上数字不动）。
     保留这段墓碑说明，是因为「这一层为什么没有存储实现」会被反复问到，
     而一个只有结论没有原因的注释，下一个人会当成疏漏直接补回去。 */

  /** 当前值 → 可编辑草稿（只含允许编辑的键）。
      取值来源是 **A.SEED 当前值**（覆盖层已并回），而不是「基线 + 覆盖层」——
      两者对网格里的键等价，但对**备注**不等价，见下。 */
  function buildDraft() {
    var keys = cellNames();
    var days = {};
    A.SEED.days.forEach(function (d) {
      var o = {}, x = 0;
      for (x = 0; x < keys.length; x++) { o[keys[x]] = H.num(d[keys[x]]); }
      /* 备注不在网格里显示，但**必须原样带走**：
         保存走的是「整份覆盖层重写」，草稿里没有 note 就等于把这一天的备注
         抹掉 —— 用户在今日打卡里写的备注，会因为他后来去设置里改了一个格子
         而消失，而且没有任何提示。这是统一存储之后新出现的风险点，
         旧版之所以没暴露，是因为打卡与设置本来写在两个不同的键里。 */
      o.note = (d.note === undefined || d.note === null) ? '' : String(d.note);
      days[d.date] = o;
    });
    var wks = {};
    A.SEED.weeks.forEach(function (w) { wks[w.idx] = H.num(w.target); });
    var bizv = {};
    BIZ_ROWS.forEach(function (r) { bizv[r.key] = H.num(A.SEED.biz[r.key]); });
    return { days: days, weeks: wks, biz: bizv };
  }

  /* ------------------------------------------------------------ 渲染抽屉 */

  function buildSettings() {
    var b = A.BASE;
    var keys = cellKeys();
    var html = '';

    /* ① 业务指标：六项手动 + 两项只读派生。
       只读的两项刻意用 <output> 而不是 disabled 的 <input>：
       一个能聚焦、却又改不动的输入框，会反复招来「为什么我改了它又弹回来」，
       而正确答案（「它是算出来的」）没有任何地方说得清楚。 */
    html += '<div class="set-group"><div class="set-group-title">业务指标' +
      '<span>六项手动维护 · 两项自动派生</span></div>' +
      '<div class="set-row"><label class="set-label" for="st-roScore">累计活动量总分' +
      '<em>12 项计分项自动累计 · 不可手改</em></label>' +
      '<output class="set-ro" id="st-roScore">' + A.computeAll().agg.score +
      '</output></div>' +
      BIZ_ROWS.map(function (r) {
        return '<div class="set-row"><label class="set-label" for="st-' + r.key + '">' +
          esc(r.label) + '<em>' + esc(r.hint) + '</em></label>' +
          '<input class="set-input" id="st-' + r.key + '" type="number" min="0" step="' +
          r.step + '" value="' + DRAFT.biz[r.key] + '" data-biz="' + r.key +
          '" aria-label="' + esc(r.label) + '"></div>';
      }).join('') +
      '<div class="set-row"><label class="set-label" for="st-roRate">季度目标完成率' +
      '<em>本季度业绩 ÷ 季度目标业绩 × 100% · 自动计算</em></label>' +
      '<output class="set-ro" id="st-roRate">' + rateText() + '</output></div>' +
      '</div>';

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
      '<span>' + period().days + ' 天 × ' + keys.length +
      ' 项 + 当日保费 · 改动过的格子亮金色描边</span></div>' +
      '<div class="dg-wrap"><table class="dg-tb"><thead><tr><th class="dg-d">日期</th>' +
      keys.map(function (r) {
        return '<th class="n" title="' + esc(r.name + '（' +
          (r.pts > 0 ? r.pts + ' 分 / 次' : '不计分')) + '）">' + esc(r.name) + '</th>';
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
      '不在抽屉里另写一套；12 个计分项**全部计分**（v1.2 起不再有「仅记录」项）。' +
      '改动只写本机浏览器，点<b>保存并应用</b>后才生效。</div></div>';

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

  /** 抽屉里那一行只读的「季度目标完成率」。取草稿值而非落盘值 ——
      要等到「保存并应用」才变的话，用户就没有任何办法在落盘前确认它算得对不对。
      分母为 0 给「—」而不是 0.0%：0.0% 是一个结论（「一点都没做」），
      而这里的事实是「还没有分母」。 */
  function rateText() {
    var qp = H.num(DRAFT.biz.quarterPerf), qg = H.num(DRAFT.biz.quarterGoal);
    return qg ? (qp / qg * 100).toFixed(1) + '%' : '—';
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
    A.BASE.days.forEach(function (bd) {
      var dr = DRAFT.days[bd.date], n = 0;
      keys.forEach(function (k) { if (H.num(dr[k]) !== H.num(bd[k])) { n++; } });
      if (n) { days++; cells += n; }
    });
    /* 两侧都过 H.num：备份 JSON 里可能是字符串 '1000'，
       用 !== 比会把它算成「改过」（幽灵改动），而画面上的值一模一样。 */
    BIZ_ROWS.forEach(function (r) {
      if (H.num(DRAFT.biz[r.key]) !== H.num(A.BASE.biz[r.key])) { tgt++; }
    });
    A.BASE.weeks.forEach(function (bw) {
      if (H.num(DRAFT.weeks[bw.idx]) !== H.num(bw.target)) { tgt++; }
    });
    return { cells: cells, days: days, tgt: tgt };
  }

  /** 实时合计 + 重算预演。30 天 × 12 项的重算是纯算术，无需防抖到「感觉迟钝」的程度；
      130ms 只是为了让连续输入时不在每个 keydown 都重排一次 DOM。 */
  function refreshSettings() {
    if (!DRAFT || !DG) { return; }
    var keys = cellKeys();
    var list = A.BASE.days.map(function (d) { return DRAFT.days[d.date]; });
    var agg = A.aggregate(list);

    A.BASE.days.forEach(function (d) {
      var cell = DG.sc[d.date];
      if (cell) { cell.textContent = A.dayScore(DRAFT.days[d.date]); }
    });
    keys.forEach(function (r) {
      var td = DG.foot[r.key];
      if (td) { td.textContent = agg.counts[r.key] || 0; }
    });
    if (DG.foot.premium) { DG.foot.premium.textContent = money(agg.premium, 0); }
    if (DG.foot.score) { DG.foot.score.textContent = agg.score; }

    /* 只读派生值跟着草稿实时走（见 rateText 的说明） */
    var roScore = el('st-roScore'), roRate = el('st-roRate');
    if (roScore) { roScore.textContent = agg.score; }
    if (roRate) { roRate.textContent = rateText(); }

    if (DG.preview) {
      var bA = A.BASE.agg, bB = A.BASE.biz;
      var bRate = bB.quarterGoal ? bB.quarterPerf / bB.quarterGoal * 100 : 0;
      var nRate = H.num(DRAFT.biz.quarterGoal)
        ? H.num(DRAFT.biz.quarterPerf) / H.num(DRAFT.biz.quarterGoal) * 100 : 0;
      var n = countDirty();
      DG.preview.innerHTML =
        pv('总分', bA.score, agg.score) +
        pv('保费', bA.premium, agg.premium, 'currency') +
        pv('件均', bA.perDeal, agg.perDeal, 'currency') +
        pv('季完成率', bRate, nRate, 'percent') +
        '<span style="margin-left:auto">改动 <b>' + n.cells + '</b> 处 / <b>' + n.days +
        '</b> 天' + (n.tgt ? ' · 业务指标 <b>' + n.tgt + '</b> 项' : '') + '</span>';
    }
  }

  function markDirty(inp, dt) {
    var bd = A.BASE.byDate[dt];
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
    var bz = t.getAttribute('data-biz');
    var wk = t.getAttribute('data-wkt');
    if (dt && DRAFT.days[dt]) {
      DRAFT.days[dt][t.getAttribute('data-k')] = v;
      markDirty(t, dt);
    } else if (bz) {
      DRAFT.biz[bz] = v;
      t.setAttribute('data-dirty', H.num(v) !== H.num(A.BASE.biz[bz]) ? '1' : '0');
    } else if (wk) {
      DRAFT.weeks[wk] = v;
      t.setAttribute('data-dirty', H.num(v) !== bwTarget(wk) ? '1' : '0');
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
    DRAFT = buildDraft();
    buildSettings();
    var btn = el('btnRestore');
    if (btn) { disarmRestore(); btn.hidden = A.overlaySize() === 0; }
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
    var ov = A.diffOverlay(DRAFT.days, DRAFT.biz, DRAFT.weeks);
    var nDay = Object.keys(ov.days).length, nCell = 0, k;
    for (var dt in ov.days) { for (k in ov.days[dt]) { nCell++; } }
    var nBiz = Object.keys(ov.biz).length + Object.keys(ov.weeks).length;

    /* A.commit = 写覆盖层 + 并回种子，两步**不可拆**。只写盘不并回的话，
       页面上还是旧值、刷新后却是新值 —— 「保存了却不生效」的经典错位。
       旧版这里正是拆成 writeOverlay() + applyOverlay() 两行调的。 */
    if (!A.commit(ov)) { toast('保存失败：本机存储不可写（可能处于隐私模式）'); return; }
    closeSettings();
    refreshAll();
    fitCharts();
    toast(nDay || nBiz
      ? '已应用 ' + nDay + ' 天 / ' + nCell + ' 处改动' + (nBiz ? ' · 业务指标 ' + nBiz + ' 项' : '')
      : '数据与初始值一致，无需改动');
  }

  /* 恢复初始数据：**两次点击确认**，不做单点即执行。
     单点执行是静默破坏性操作 —— 点错一次，30 天数据连同业务指标一起消失，
     而画面「看起来只是数字变小了」。第一次点击把按钮改成红色问句，
     4 秒内没有第二次点击就自动解除武装（避免长时间悬停的误触）。 */
  function disarmRestore() {
    var btn = el('btnRestore');
    if (!btn) { return; }
    btn.removeAttribute('data-armed');
    btn.classList.remove('danger');
    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span>恢复初始数据</span>';
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
    /* 不直接删键，而是**提交一份空覆盖层**：commit 见到空覆盖层会主动
       removeItem。于是「清空」只有一条路径，不必在这里再写一遍删键逻辑 ——
       写两遍必然分叉（比如某天只清了 days 忘了 biz）。 */
    A.commit({ days: {}, weeks: {}, biz: {} });
    closeSettings();
    refreshAll();
    fitCharts();
    toast('已恢复初始数据');
  }

  /* --------------------------------------------------------- 导出 / 导入 */

  /** 导出**全量当前值**而不是覆盖层 diff：备份的语义是「搬到另一台机器能完整复原」，
      而 diff 只有在基线也一致时才有意义，换个面板版本就会错位。 */
  function collectExport() {
    return {
      app: 'baox-activity',
      version: 2,
      exportedAt: new Date().toISOString(),
      period: (A.SEED.meta && A.SEED.meta.period) || null,
      biz: (function () {
        var o = {};
        BIZ_ROWS.forEach(function (r) { o[r.key] = H.num(A.SEED.biz[r.key]); });
        return o;
      })(),
      weeks: A.SEED.weeks.map(function (w) { return { idx: w.idx, target: H.num(w.target) }; }),
      days: A.SEED.days.map(function (d) {
        var o = { date: d.date, premium: H.num(d.premium) };
        cellKeys().forEach(function (r) { o[r.key] = H.num(d[r.key]); });
        /* 备注一起导出：否则「换台机器完整复原」这句话对备注不成立，
           而备注是用户手写的、不可再生的内容。 */
        if (d.note) { o.note = String(d.note); }
        return o;
      }),
      changedDays: Object.keys(A.readOverlay().days).length
    };
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(collectExport(), null, 2)],
      { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '展业活动量数据_' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    toast('已导出完整数据（JSON 备份 · ' + period().days + ' 天）');
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
      var ov = A.diffOverlay(daysMap, obj.biz || null, weeksMap);
      /* 即便备份与当前值完全一致也要走 commit：它会把旧覆盖层清成空键 ——
         「导入一份干净的备份」的语义就是「回到那份备份」，不是「在现状上再叠一层」。
         v1 备份里的 targets（month/weekShort/mdrtCarry）在本版已无对应字段，
         会被 diffOverlay 直接忽略：那三个值在 v1.2 里不参与任何计算，
         硬塞进覆盖层只会留下谁也解释不清的幽灵键。 */
      if (!A.commit(ov)) { toast('导入失败：本机存储不可写'); return; }
      closeSettings();
      refreshAll();
      fitCharts();
      var n = A.overlaySize(ov);
      toast(n ? '已导入 ' + Object.keys(ov.days).length + ' 天数据' +
        (Object.keys(ov.biz).length + Object.keys(ov.weeks).length ? ' + 业务指标' : '')
        : '已导入：内容与初始值一致');
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
  window.__ACT_SETTINGS__ = { collect: collectExport, overlay: A.readOverlay };

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
    renderToday();
    renderHeat();
    renderMix();
    renderFunnel();
    renderLedger();
    /* 天数取自 R.days —— 唯一一份日集合。v1.1 这里写的是
       R.agg.days + R.local.length，「两路相加」正是两套数据在 UI 上留下的痕迹：
       它永远对得上，所以永远不会有人发现底下是两份。 */
    el('nbToday').textContent = R.days.length + '天';
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
    A.applyOverlay();
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

    /* 供运行期数据门禁取证（铁律 12）。
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
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
