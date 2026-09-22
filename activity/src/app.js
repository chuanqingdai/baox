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

  /* -------------------------------------------- 观测窗口草稿（v1.4 新增）
     窗口是**数据的坐标系**：同一批日数据在不同窗口下，总分、周数、达标率
     全都不同。所以抽屉里改窗口不能只改两个 input —— 逐日表格、周次切分、
     合计行都必须按新窗口重建。

     下面这一组函数只做「把窗口与草稿对应起来」，规则本身（怎么切周、
     怎么兜底非法输入）**一律走 core.js**，应用层不自己算日期。 */

  /** 一条日记录 → 草稿行（只含可编辑的键 + 备注）。 */
  function draftRow(rec) {
    var keys = cellNames(), o = {}, x = 0;
    for (x = 0; x < keys.length; x++) { o[keys[x]] = H.num(rec[keys[x]]); }
    /* 备注不在网格里显示，但**必须原样带走**：
       保存走的是「整份覆盖层重写」，草稿里没有 note 就等于把这一天的备注
       抹掉 —— 用户在今日打卡里写的备注，会因为他后来去设置里改了一个格子
       而消失，而且没有任何提示。这是统一存储之后新出现的风险点，
       旧版之所以没暴露，是因为打卡与设置本来写在两个不同的键里。 */
    o.note = (rec.note === undefined || rec.note === null) ? '' : String(rec.note);
    return o;
  }

  /** 某一天「当前已保存值」的样子 = 基线 + 覆盖层。

      ⚠️ 重建草稿时**必须**用它，不能用基线（这是 v1.4 最容易写错的一处）：
      某天可能此刻在窗口外（因此不在草稿里），但覆盖层里存着用户先前的记录
      —— 用户裁定的「窗口外数据保留不删」正是这个意思。窗口一切回来，
      若草稿从**基线**取，那些格子会显示 0；而保存时 diffOverlay 判
      「与基线相同」→ 把覆盖层里那天的记录**删掉**。
      症状是「换个窗口再换回来，数据没了」：不可逆、无提示，
      而且当次操作看起来完全成功。 */
  function savedDayOf(iso, ovDays) {
    var row = draftRow(A.baseDayOf(iso));
    var rec = ovDays && ovDays[iso];
    if (rec) {
      for (var k in rec) {
        if (k === 'note') { row[k] = String(rec[k] || ''); }
        else if (k in row) { row[k] = H.num(rec[k]); }
      }
    }
    return row;
  }

  /** 按一个窗口形状铺满草稿。prev 为现有草稿（可为 null）。

      保留 prev 的重叠部分是**正确性**要求，不是便利：用户在旧窗口里改了 20 个
      格子，然后只想把终点往后挪一天 —— 若重建时一律从已保存值取，那 20 处
      改动会静默归零，而画面看起来只是表格多了一行。 */
  function fillDraft(shape, prev) {
    var ov = A.readOverlay();
    var days = {}, wks = {}, bizv = {}, i, k, copy;
    for (i = 0; i < shape.days.length; i++) {
      var iso = shape.days[i];
      var row = (prev && prev.days[iso]) ? prev.days[iso] : savedDayOf(iso, ov.days);
      /* 逐行**另存一份**：草稿必须与来源脱钩。共用对象的话，用户在草稿里
         改一个格子会连带改掉 A.SEED 里那条记录 —— 于是「取消（Esc）后
         改动仍然生效」，「预演正确、结果不对」。 */
      copy = {};
      for (k in row) { copy[k] = row[k]; }
      days[iso] = copy;
    }
    for (i = 0; i < shape.weeks.length; i++) {
      var wk = shape.weeks[i];
      if (prev && prev.weeks[wk.from] !== undefined) { wks[wk.from] = prev.weeks[wk.from]; }
      else if (ov.weeks[wk.from] !== undefined) { wks[wk.from] = H.num(ov.weeks[wk.from]); }
      else { wks[wk.from] = H.num(wk.baseTarget); }
    }
    BIZ_ROWS.forEach(function (r) {
      bizv[r.key] = prev ? H.num(prev.biz[r.key]) : H.num(A.SEED.biz[r.key]);
    });
    return { win: { start: shape.start, end: shape.end }, shape: shape,
             days: days, weeks: wks, biz: bizv };
  }

  /** 当前值 → 可编辑草稿。窗口取**当前已保存**的窗口。 */
  function buildDraft() { return fillDraft(A.currentWindow(), null); }

  /** 窗口外还留着多少天记录。用来在抽屉里把「数据没被删」这件事说出来 ——
      不说的话，用户切换窗口看到表格变短，会合理怀疑窗口外的数据已经丢了。 */
  function outWindowDays(shape) {
    var ov = A.readOverlay(), n = 0, k;
    for (k in ov.days) { if (!shape.daySet[k]) { n++; } }
    return n;
  }

  /* 快捷预设的日期算术。用 H.parseDay / H.isoOf 走本机时区，
     不自己拼字符串 —— 月末、季度末、跨年都由 Date 兜底。 */
  function shiftDay(iso, n) {
    var d = H.parseDay(iso);
    d.setDate(d.getDate() + n);
    return H.isoOf(d);
  }
  function monthBounds(iso) {
    var d = H.parseDay(iso);
    return [H.isoOf(new Date(d.getFullYear(), d.getMonth(), 1)),
            H.isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  }
  function quarterBounds(iso) {
    var d = H.parseDay(iso), q = Math.floor(d.getMonth() / 3);
    return [H.isoOf(new Date(d.getFullYear(), q * 3, 1)),
            H.isoOf(new Date(d.getFullYear(), q * 3 + 3, 0))];
  }
  function presets() {
    var t = todayISO();
    var lastM = monthBounds(shiftDay(monthBounds(t)[0], -1));
    return [
      { key: 'd7',  label: '近 7 天',  range: [shiftDay(t, -6), t] },
      { key: 'd30', label: '近 30 天', range: [shiftDay(t, -29), t] },
      { key: 'tm',  label: '本月',     range: monthBounds(t) },
      { key: 'lm',  label: '上月',     range: lastM },
      { key: 'tq',  label: '本季度',   range: quarterBounds(t) }
    ];
  }

  /** 日期框 / 预设按钮 → 重建草稿。窗口规则全在 core.js（唯一口径），
      这里只负责「把用户意图转成一次 normalize + 重建」，以及**把兜底说出来**：
      起止颠倒被对调、超 90 天被截断，都必须让用户看见 ——
      静默改写输入，下次打开抽屉日期与自己填的不一样，会以为界面记错了。 */
  function setWindowDraft(raw) {
    if (!DRAFT) { return; }
    var notices = [];
    if (raw.start && raw.end && raw.start > raw.end) { notices.push('起止颠倒，已自动对调'); }
    if (raw.start && raw.end && raw.end >= raw.start) {
      var span = Math.round((H.parseDay(raw.end) - H.parseDay(raw.start)) / 86400000) + 1;
      if (span > A.WIN_MAX_DAYS) {
        notices.push(span + ' 天超过 ' + A.WIN_MAX_DAYS + ' 天上限，已截到 ' + A.WIN_MAX_DAYS + ' 天');
      }
    }
    var norm = A.normalizeWindow(raw);
    /* 落在默认窗口上就不必重建 DOM（日期框连点两下、或点了「本月」又点回来
       都会走到这里）—— 重建会丢焦点，而这些点击本来什么都不该发生。 */
    if (norm.start === DRAFT.win.start && norm.end === DRAFT.win.end) {
      if (notices.length) { toast(notices.join(' · ')); }
      return;
    }
    DRAFT = fillDraft(A.shapeWindow(norm), DRAFT);
    buildSettings();
    if (notices.length) { toast(notices.join(' · ')); }
  }

  function onWindowChange(e) {
    var t = e.target;
    if (!t || !t.getAttribute) { return; }
    var f = t.getAttribute('data-win');
    if (!f) { return; }
    var raw = { start: DRAFT.win.start, end: DRAFT.win.end };
    raw[f] = t.value;
    /* 清空日期框（value 为空）交给 normalizeWindow 兜底成默认值 ——
       与「用户手工清空」的直觉一致：空 = 用默认。 */
    if (!raw.start || !raw.end) { raw = { start: raw.start, end: raw.end }; }
    setWindowDraft(raw);
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

  /* ------------------------------------------------------------ 渲染抽屉 */

  function buildSettings() {
    var win = DRAFT.shape;
    var keys = cellKeys();
    var html = '';

    /* ⓪ 观测窗口 —— 放在最前：窗口是**数据的坐标系**，它决定下面每一组的
       日集合与周次切分。排在业务指标之后的话，用户改完日期往下滚，
       会发现自己刚填的表格已经换成另一段区间了，而滚动条不告诉他这件事。 */
    var outN = outWindowDays(win);
    html += '<div class="set-group"><div class="set-group-title">观测窗口' +
      '<span>决定逐日表格与周次切分 · 1–' + A.WIN_MAX_DAYS + ' 天</span></div>' +
      '<div class="win-presets">' +
      presets().map(function (p) {
        var on = (p.range[0] === win.start && p.range[1] === win.end);
        return '<button type="button" class="win-p' + (on ? ' sel' : '') + '" data-preset="' +
          p.key + '" title="' + p.range[0] + ' – ' + p.range[1] + '">' + p.label + '</button>';
      }).join('') +
      '</div>' +
      '<div class="set-row"><label class="set-label" for="winStart">起始日期' +
      '<em>窗口第一天所在的那一周算首周</em></label>' +
      '<input class="set-input set-date" id="winStart" type="date" value="' + win.start +
      '" data-win="start" aria-label="观测窗口起始日期"></div>' +
      '<div class="set-row"><label class="set-label" for="winEnd">结束日期' +
      '<em>末日不足一周时为末周</em></label>' +
      '<input class="set-input set-date" id="winEnd" type="date" value="' + win.end +
      '" data-win="end" aria-label="观测窗口结束日期"></div>' +
      '<div class="set-row"><label class="set-label">当前窗口' +
      '<em>改日期后逐日表格会立刻按新窗口重建，重叠部分的已填值保留</em></label>' +
      '<output class="set-ro" id="winInfo">' + win.days.length + ' 天 · ' +
      win.weeks.length + ' 周</output></div>' +
      '<div class="dg-note" id="winNote">周次按自然周（周一–周日）切分：' +
      win.weeks.map(function (w, i) {
        return 'W' + w.idx + ' ' + w.from.slice(5).replace('-', '/') + '–' +
          w.to.slice(5).replace('-', '/') + '（' + w.dayCount + '天）';
      }).join(' · ') +
      (outN ? '<br>窗口外另有 <b>' + outN + ' 天</b>记录：它们<b>不会被删除</b>，' +
        '把窗口调回去即完整重现。' : '') +
      '</div></div>';

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
       不能归纳成「首周 / 常规周」两个值：那样一改就会把 W5 改错。

       ⚠️ v1.4：周目标按**该周起始日**存取（键 = wk.from），不再用周序号。
       周序号只是**顺序**、不是身份 —— 换了窗口，同一个 W2 指向的是另一周，
       按序号存会让目标套到别的周上，达标率整体偏移，而且不报错。 */
    html += '<div class="set-group"><div class="set-group-title">各周保费目标' +
      '<span>对应「周保费 vs 周目标」图 · 随窗口重切</span></div>' +
      win.weeks.map(function (w) {
        return '<div class="set-row"><label class="set-label" for="sw-' + w.from + '">W' + w.idx +
          '<em>' + w.from.replace(/-/g, '/') + ' – ' + w.to.replace(/-/g, '/') + ' · ' +
          w.dayCount + ' 天</em></label>' +
          '<input class="set-input" id="sw-' + w.from + '" type="number" min="0" step="500" value="' +
          DRAFT.weeks[w.from] + '" data-wkt="' + w.from + '" aria-label="W' + w.idx +
          ' 周保费目标"></div>';
      }).join('') + '</div>';

    /* ③ 逐日数据网格（吸顶表头 + 吸顶日期列 + 吸顶合计行） */
    html += '<div class="set-group"><div class="set-group-title">逐日数据' +
      '<span>' + win.days.length + ' 天 × ' + keys.length +
      ' 项 + 当日保费 · 改动过的格子亮金色描边</span></div>' +
      '<div class="dg-wrap"><table class="dg-tb"><thead><tr><th class="dg-d">日期</th>' +
      keys.map(function (r) {
        return '<th class="n" title="' + esc(r.name + '（' +
          (r.pts > 0 ? r.pts + ' 分 / 次' : '不计分')) + '）">' + esc(r.name) + '</th>';
      }).join('') +
      '<th class="n" title="当日成交保费（元）">保费</th><th class="n">得分</th>' +
      '</tr></thead><tbody>' +
      win.days.map(function (iso) {
        var d = A.baseDayOf(iso);
        return '<tr><td class="dg-d">' + iso.slice(5).replace('-', '/') +
          '<em>' + esc(d.dow || '') + '</em></td>' +
          keys.map(function (r) {
            return '<td class="n"><input class="dg-in" type="number" min="0" step="1" value="' +
              DRAFT.days[iso][r.key] + '" data-d="' + iso + '" data-k="' + r.key +
              '" aria-label="' + iso + ' ' + esc(r.name) + '"></td>';
          }).join('') +
          '<td class="n"><input class="dg-in wide" type="number" min="0" step="1000" value="' +
          DRAFT.days[iso].premium + '" data-d="' + iso + '" data-k="premium" aria-label="' +
          iso + ' 当日保费"></td>' +
          '<td class="n dg-sc" data-sc="' + iso + '">—</td></tr>';
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
    win.days.forEach(function (iso) { DG.sc[iso] = body.querySelector('[data-sc="' + iso + '"]'); });

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

  /** 草稿相对**基线**的改动量。基线用 A.baseDayOf —— 窗口可以超出种子范围，
      那些日期的基线是「全 0 空白天」；查 A.BASE.byDate 会拿到 undefined，
      然后 H.num(undefined)=0 恰好也算对，但一旦哪天基线改成非零就会静默错位。 */
  function countDirty() {
    var cells = 0, days = 0, tgt = 0;
    var keys = cellNames();
    DRAFT.shape.days.forEach(function (iso) {
      var dr = DRAFT.days[iso], bd = A.baseDayOf(iso), n = 0;
      keys.forEach(function (k) { if (H.num(dr[k]) !== H.num(bd[k])) { n++; } });
      if (n) { days++; cells += n; }
    });
    /* 两侧都过 H.num：备份 JSON 里可能是字符串 '1000'，
       用 !== 比会把它算成「改过」（幽灵改动），而画面上的值一模一样。 */
    BIZ_ROWS.forEach(function (r) {
      if (H.num(DRAFT.biz[r.key]) !== H.num(A.BASE.biz[r.key])) { tgt++; }
    });
    /* 周目标按**周起始日**比对：基线的周次是种子声明的那一段，草稿的周次
       随窗口重切，两边只有按日期才对齐得上（按序号比会把「换窗口后
       W2 其实是另一周」算成改动，凭空多计数）。 */
    DRAFT.shape.weeks.forEach(function (wk) {
      if (H.num(DRAFT.weeks[wk.from]) !== H.num(wk.baseTarget)) { tgt++; }
    });
    return { cells: cells, days: days, tgt: tgt };
  }

  /** 实时合计 + 重算预演。90 天 × 12 项的重算是纯算术，无需防抖到「感觉迟钝」的程度；
      130ms 只是为了让连续输入时不在每个 keydown 都重排一次 DOM。

      ⚠️ 「原值」必须按**草稿窗口**重算基线聚合并与草稿比 —— 不能用
      A.BASE.agg（那是固定种子的 30 天聚合）。窗口一动，两边就不同区间了，
      但差值照样显示出来，看上去像个正常结果。 */
  function refreshSettings() {
    if (!DRAFT || !DG) { return; }
    var keys = cellKeys();
    var win = DRAFT.shape;
    var baseList = win.days.map(function (iso) { return A.baseDayOf(iso); });
    var list = win.days.map(function (iso) { return DRAFT.days[iso]; });
    var baseAgg = A.aggregate(baseList);
    var agg = A.aggregate(list);

    win.days.forEach(function (iso) {
      var cell = DG.sc[iso];
      if (cell) { cell.textContent = A.dayScore(DRAFT.days[iso]); }
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
    var wi = el('winInfo');
    if (wi) { wi.textContent = win.days.length + ' 天 · ' + win.weeks.length + ' 周'; }

    if (DG.preview) {
      /* 「原值」的季完成率取自 A.BASE.biz（业务指标不随窗口变，它是四项
         手动值 + 一项派生），所以这里不需要像上面那样按窗口重算。 */
      var bB = A.BASE.biz;
      var bRate = H.num(bB.quarterGoal)
        ? H.num(bB.quarterPerf) / H.num(bB.quarterGoal) * 100 : 0;
      var nRate = H.num(DRAFT.biz.quarterGoal)
        ? H.num(DRAFT.biz.quarterPerf) / H.num(DRAFT.biz.quarterGoal) * 100 : 0;
      var n = countDirty();
      DG.preview.innerHTML =
        pv('总分', baseAgg.score, agg.score) +
        pv('保费', baseAgg.premium, agg.premium, 'currency') +
        pv('件均', baseAgg.perDeal, agg.perDeal, 'currency') +
        pv('季完成率', bRate, nRate, 'percent') +
        '<span style="margin-left:auto">改动 <b>' + n.cells + '</b> 处 / <b>' + n.days +
        '</b> 天' + (n.tgt ? ' · 业务指标 <b>' + n.tgt + '</b> 项' : '') + '</span>';
    }
  }

  function markDirty(inp, dt) {
    var bd = A.baseDayOf(dt);
    var k = inp.getAttribute('data-k');
    var v = inp.value === '' ? 0 : H.num(inp.value);
    inp.setAttribute('data-dirty', (v !== H.num(bd[k])) ? '1' : '0');
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
      /* wk 是**周起始日**（data-wkt 由 buildSettings 写成 wk.from）。 */
      DRAFT.weeks[wk] = v;
      var bw = null;
      DRAFT.shape.weeks.forEach(function (x) { if (x.from === wk) { bw = x; } });
      t.setAttribute('data-dirty',
        H.num(v) !== H.num(bw ? bw.baseTarget : 0) ? '1' : '0');
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
      /* 窗口改动用**单独的 change 监听**，不走 onSettingInput：
         date 输入每次改动都要重建整张逐日表格（行数变了），
         挂在 input 上会在用户还没选完时就重排 DOM、把焦点打断。 */
      body.addEventListener('change', onWindowChange);
      body.addEventListener('click', onPresetClick);
    }
    if (!bindSettings._esc) {
      bindSettings._esc = true;
      document.addEventListener('keydown', function (e) {
        var d = el('setDrawer');
        if (e.key === 'Escape' && d && d.classList.contains('open')) { closeSettings(); }
      });
    }
  }

  /** 预设按钮：取区间 → 交给 setWindowDraft（规则仍在 core.js）。 */
  function onPresetClick(e) {
    if (!DRAFT) { return; }
    var t = e.target;
    var btn = (t && t.closest) ? t.closest('[data-preset]') : null;
    if (!btn) { return; }
    var key = btn.getAttribute('data-preset');
    var hit = presets().filter(function (p) { return p.key === key; })[0];
    if (hit) { setWindowDraft({ start: hit.range[0], end: hit.range[1] }); }
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
    /* 第四个参数是**草稿窗口**：窗口与数据必须一起提交。
       只提交数据、窗口留给「关抽屉时顺手写一下」是行不通的 ——
       diffOverlay 要按窗口判断「哪些日期在范围内」，
       拿旧窗口去 diff 新窗口的数据，窗口外的改动会整片丢失。 */
    var ov = A.diffOverlay(DRAFT.days, DRAFT.biz, DRAFT.weeks, DRAFT.win);
    var nDay = Object.keys(ov.days).length, nCell = 0, k;
    for (var dt in ov.days) { for (k in ov.days[dt]) { nCell++; } }
    var nBiz = Object.keys(ov.biz).length + Object.keys(ov.weeks).length;
    var winChanged = ov.window !== null;   /* readOverlay 的约定：键存在 = 有自定义 */

    /* A.commit = 写覆盖层 + 并回种子，两步**不可拆**。只写盘不并回的话，
       页面上还是旧值、刷新后却是新值 —— 「保存了却不生效」的经典错位。
       旧版这里正是拆成 writeOverlay() + applyOverlay() 两行调的。 */
    if (!A.commit(ov)) { toast('保存失败：本机存储不可写（可能处于隐私模式）'); return; }
    closeSettings();
    refreshAll();
    fitCharts();
    /* 提示语按「有哪几部分就报哪几部分」拼装，**连接符由拼装决定**。
       v1.4 之前这里是三段手写拼接，于是「只改窗口」这一支漏了分隔符，
       toast 读作「已应用窗口 09/14–09/20其余数据无改动」——
       信息都在，但一句读不通的提示会被当成乱码扫过去，等于没提示。 */
    var w = A.currentWindow();
    var parts = [];
    if (winChanged) {
      parts.push('窗口 ' + w.start.slice(5).replace('-', '/') + '–' +
                 w.end.slice(5).replace('-', '/'));
    }
    if (nDay || nBiz) {
      parts.push(nDay + ' 天 / ' + nCell + ' 处改动' +
                 (nBiz ? ' · 业务指标 ' + nBiz + ' 项' : ''));
    } else if (winChanged) {
      /* 只改窗口时也要把「数据没动」说出来：否则用户改完窗口关掉抽屉，
         不知道那次保存到底（只）动了什么。 */
      parts.push('其余数据无改动');
    }
    /* '已应用' 后统一留一个空格 —— 三段各自的形态不同（「窗口 10/01–10/17」
       以汉字起、「30 天 / 3 处改动」以数字起），粘着写总有一段读不顺。 */
    toast(parts.length ? '已应用 ' + parts.join(' · ') : '数据与初始值一致，无需改动');
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
      version: 3,
      exportedAt: new Date().toISOString(),
      period: (A.SEED.meta && A.SEED.meta.period) || null,
      /* 窗口是数据的坐标系：不带窗口的备份，换一个窗口还原后总分、
         周数、达标率全都对不上 —— 那样「完整复原」这句话就不成立。 */
      window: A.windowSetting(),
      biz: (function () {
        var o = {};
        BIZ_ROWS.forEach(function (r) { o[r.key] = H.num(A.SEED.biz[r.key]); });
        return o;
      })(),
      /* idx 留着只为**人读**（备份文件打开时能看出是第几周）；
         机器读的一律是 from。v1.3 及更早的备份只有 idx，导入端按默认窗口
         的周次把它还原成起始日（见 importData）—— 两处若各推一套映射，
         同一个备份在两台机器上会还原成不同的周目标。 */
      weeks: A.SEED.weeks.map(function (w) {
        return { idx: w.idx, from: w.from, to: w.to, dayCount: w.dayCount, target: H.num(w.target) };
      }),
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
    toast('已导出完整数据（JSON 备份 · ' + period().days + ' 天 · 含窗口设置）');
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
        var defWeeks = A.naturalWeeks(A.WIN_DEFAULT.start, A.WIN_DEFAULT.end);
        obj.weeks.forEach(function (w) {
          if (!w) { return; }
          if (w.from) { weeksMap[w.from] = w.target; return; }
          /* v1.3 及更早的备份只有周序号。按**默认窗口**的周次还原成起始日 ——
             这份映射是唯一确定的（旧版只可能有一个窗口：种子声明的那个），
             与 core.js 的 migrateWeekKeys 依据同一套规则。
             不还原的话，旧备份的周目标会被整片丢弃，而导入提示照样说「已导入」。 */
          if (w.idx === undefined) { return; }
          var dw = defWeeks[H.num(w.idx) - 1];
          if (dw) { weeksMap[dw.from] = w.target; }
        });
      }
      /* 备份里的窗口一并还原（旧备份没有这个字段 → null → 落回默认窗口）。
         第 4 个参数必须传：不传就沿用**当前**窗口，
         于是「导入一份 10 月窗口的备份」会变成「把 10 月的数据塞进 9 月的窗口」。 */
      var ov = A.diffOverlay(daysMap, obj.biz || null, weeksMap, obj.window || null);
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
     ⑰b 身份 · 头像上传 + 品牌字样就地编辑
     ========================================================================
     两个交互（点头像换图、点字样改名）共用**同一份存储与同一条刷新路径**：

         交互 → A.patchIdentity() → applyIdentity()
                                      ↑
                             唯一写 brand 的地方

     为什么不让两个交互各自改 DOM：那样「恢复默认」就得再写第三处，
     三处迟早分叉（典型症状是恢复后存储已清空、界面还是旧头像）。
     applyIdentity 是**幂等**的 —— 从存储读、逐项对齐 DOM，调几次都一样。
     ======================================================================== */

  /** 把身份刷到 DOM。幂等：只按存储对齐界面，不读界面当前值。 */
  function applyIdentity(id) {
    var img = el('brandAvatar');
    if (img) {
      var src = id.avatar || 'assets/avatar.png';
      /* 先比再赋值：无脑 setAttribute 在 src 未变时也会让浏览器重新解码 dataURL */
      if (img.getAttribute('src') !== src) { img.setAttribute('src', src); }
    }

    var nm = el('brandName');
    if (nm && !nm.isContentEditable && nm.textContent !== id.name) {
      nm.textContent = id.name;
    }

    /* 「恢复默认头像」按钮只在**有自定义头像**时存在。
       看不见的按钮等于没有回滚路径（铁律 15）——
       所以它随 has-custom 类出现，而不是靠 disabled 藏起来。 */
    var mark = el('brandMark');
    if (mark) { mark.classList.toggle('has-custom', !!id.avatar); }
  }

  /* ------------------------------------------------------- 头像：压缩后入库 */

  /* 上传的图在**入库前**就压到 256px 正方形。三步缺一不可：
       ① localStorage 每域通常只有 5MB，且配额按 UTF-16 计 —— 手机原图
          动辄 3–8MB，直接存必然抛配额错，而错误文案只会是「保存失败」；
       ② 显示端最大只要 58px（2x 屏 116px），256 已留足余量；
       ③ CSS 是 border-radius:50% + object-fit:cover —— 非正方形图**本来就会被裁**，
          不如入库时裁好，省得每次渲染让浏览器重算裁剪。 */
  var AV_SIDE = 256;          /* 压缩后边长 */
  var AV_CAP = 60 * 1024;     /* dataURL 字符上限（≈120KB 实占）。256px JPEG 通常 20–35KB，
                                 触发降质说明原图细节极多，那也该压 —— 否则配额告急 */

  function compressAvatar(file, cb) {
    var rd = new FileReader();
    rd.onerror = function () { cb('read-failed'); };
    rd.onload = function () {
      var im = new Image();
      im.onerror = function () { cb('decode-failed'); };
      im.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = AV_SIDE; c.height = AV_SIDE;
          var g = c.getContext('2d');
          /* 居中裁正方形：按短边铺满 */
          var side = Math.min(im.width, im.height);
          var sx = (im.width - side) / 2, sy = (im.height - side) / 2;
          /* 先铺底色再画：透明 PNG 压成 JPEG 时透明区会变黑，
             而浅色皮肤下黑边极其显眼。这里铺深色，与两套皮肤都不冲突。 */
          g.fillStyle = '#17130f';
          g.fillRect(0, 0, AV_SIDE, AV_SIDE);
          g.drawImage(im, sx, sy, side, side, 0, 0, AV_SIDE, AV_SIDE);

          /* 降质重试：一档到底不算完。「压完还是太大」是会真的发生的，
             而那时的症状是保存失败，用户只会觉得「怎么传不上去」。 */
          var q = 0.86, url = c.toDataURL('image/jpeg', q);
          while (url.length > AV_CAP && q > 0.4) {
            q -= 0.12;
            url = c.toDataURL('image/jpeg', q);
          }
          cb(null, url, Math.round(url.length / 1024));
        } catch (e) { cb('compress-failed'); }
      };
      im.src = String(rd.result);
    };
    rd.readAsDataURL(file);
  }

  function pickAvatar() {
    var f = el('avatarFile');
    if (!f) { return; }
    /* 先清空：选了同一个文件时 change 不触发，用户会以为「点了没反应」 */
    f.value = '';
    f.click();
  }

  function onAvatarPicked(input) {
    var f = input && input.files && input.files[0];
    if (!f) { return; }
    if (!/^image\//.test(f.type || '')) { toast('请选择图片文件'); return; }
    compressAvatar(f, function (err, url, kb) {
      if (err) {
        toast(err === 'decode-failed' ? '这张图无法解码，换一张试试'
                                      : '头像处理失败，换一张试试');
        return;
      }
      var r = A.patchIdentity({ avatar: url });
      if (!r.ok) {
        toast(r.reason === 'quota' ? '本机存储空间不足，头像未能保存'
                                   : '保存失败：本机存储不可写');
        return;
      }
      applyIdentity(r.id);
      toast('头像已更新（' + kb + ' KB · 已压缩至 ' + AV_SIDE + 'px）');
    });
  }

  /** 恢复默认头像。必须 stopPropagation —— 否则冒泡到 .brand__mark 的点击处理器，
      文件选择框会紧接着弹出来，看起来像「点了还原反而要你选图」。 */
  function resetAvatar(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var r = A.patchIdentity({ avatar: '' });
    if (!r.ok) { toast('恢复失败：本机存储不可写'); return; }
    applyIdentity(r.id);
    toast('已恢复默认头像');
  }

  /** 存进去的 dataURL 解不开（浏览器清过存储 / 手工改过 JSON / 截图工具写坏）。
      处置：回退默认图并**把坏值清掉** —— 不清的话每次加载都要再失败一遍。 */
  function onAvatarError() {
    var img = el('brandAvatar');
    if (!img) { return; }
    if (A.readIdentity().avatar) {
      A.patchIdentity({ avatar: '' });
      img.setAttribute('src', 'assets/avatar.png');
      toast('头像数据已损坏，已恢复默认');
    } else {
      /* 连默认图都加载不出来：断开监听，否则 onerror 会被自己无限触发 */
      img.onerror = null;
    }
  }

  /* --------------------------------------------------- 品牌字样：就地实时编辑 */

  var NAME_BEFORE = null;       /* 进入编辑态前的值，Esc 取消要还回去 */
  var nameSaveT = null;
  var nameCapTold = false;

  function insertPlainText(t) {
    var s = window.getSelection();
    if (!s || !s.rangeCount) { return; }
    var r = s.getRangeAt(0);
    r.deleteContents();
    var node = document.createTextNode(t);
    r.insertNode(node);
    r.setStartAfter(node); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  }

  function caretToEnd(node) {
    var r = document.createRange();
    r.selectNodeContents(node); r.collapse(false);
    var s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
  }

  function enterNameEdit() {
    var nm = el('brandName');
    if (!nm || nm.isContentEditable) { return; }
    NAME_BEFORE = nm.textContent;
    nm.setAttribute('contenteditable', 'true');
    nm.setAttribute('spellcheck', 'false');
    nm.classList.add('is-editing');
    nm.focus();
    /* 全选：改的是「公子的」这种短词，全选后直接打字覆盖是主流意图 */
    var r = document.createRange();
    r.selectNodeContents(nm);
    var s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
  }

  /** 落盘。空值 = 回默认（这条在编辑态用灰色占位符写在界面上 —— 否则用户
      清空后失焦发现名字自己回来了，会以为没保存成功）。 */
  function saveNameNow() {
    if (nameSaveT) { clearTimeout(nameSaveT); nameSaveT = null; }
    var nm = el('brandName');
    if (!nm) { return; }
    var name = (nm.textContent || '').replace(/\s+/g, ' ').trim();
    var r = A.patchIdentity({ name: name || A.ID_DEFAULT.name });
    if (!r.ok) {
      toast(r.reason === 'quota' ? '本机存储空间不足，字样未能保存'
                                 : '保存失败：本机存储不可写');
    }
  }

  function queueNameSave() {
    if (nameSaveT) { clearTimeout(nameSaveT); }
    nameSaveT = setTimeout(saveNameNow, 420);
  }

  function onNameInput(e) {
    var nm = el('brandName');
    if (!nm) { return; }

    /* 长度上限在**输入时**就截，不在落盘时静默截 ——
       后者会让用户打完 10 个字、看到 10 个字，刷新后只剩 8 个，中间毫无提示。 */
    var t = nm.textContent || '';
    if (t.length > A.ID_NAME_MAX) {
      nm.textContent = t.slice(0, A.ID_NAME_MAX);
      caretToEnd(nm);          /* 不重定位光标的话，contenteditable 会把光标弹回开头 */
      if (!nameCapTold) {
        nameCapTold = true;
        toast('品牌字样最多 ' + A.ID_NAME_MAX + ' 个字');
      }
    }

    /* 中文输入法未上屏时**不落盘也不清理 DOM**：
       此刻 textContent 是拼音串（如 "gongzide"），
       写进存储会存下这个半成品，而用户看到的是候选框，毫无察觉。 */
    if (e.isComposing || nm.dataset.composing === '1') { return; }

    /* 删空后浏览器常留下一个 <br>，那会让 CSS :empty 占位符失效 ——
       于是「留空回默认」这条提示在视觉上消失。清理它，但只在非输入法状态下做。 */
    if (!(nm.textContent || '').length && nm.innerHTML) { nm.innerHTML = ''; }

    queueNameSave();
  }

  function onNameKey(e) {
    if (!el('brandName') || !el('brandName').isContentEditable) { return; }
    if (e.key === 'Enter') { e.preventDefault(); el('brandName').blur(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      var nm = el('brandName');
      if (nameSaveT) { clearTimeout(nameSaveT); nameSaveT = null; }
      nm.textContent = NAME_BEFORE || A.ID_DEFAULT.name;   /* 未落盘的编辑一并丢弃 */
      nm.blur();
    }
  }

  function onNamePaste(e) {
    e.preventDefault();
    /* 只取纯文本：直接粘贴会带进 <span style=…> 等富文本，而这段文本最终
       要回到 textContent，富文本没有意义，还会让长度统计与显示不一致。 */
    var t = (e.clipboardData || window.clipboardData);
    insertPlainText((t ? t.getData('text') : '').replace(/\s+/g, ' '));
  }

  function exitNameEdit(commit) {
    var nm = el('brandName');
    if (!nm || !nm.isContentEditable) { return; }
    nm.removeAttribute('contenteditable');
    nm.removeAttribute('spellcheck');
    nm.classList.remove('is-editing');
    if (!commit) { return; }        /* Esc 已还原过，这里只收尾 */
    saveNameNow();
    applyIdentity(A.readIdentity());   /* 空值回默认要**立刻**反映到界面 */
  }

  function initIdentity() {
    applyIdentity(A.readIdentity());

    var mark = el('brandMark');
    if (mark) {
      mark.addEventListener('click', function (e) {
        /* 还原按钮自己有处理器，别再顺手打开文件选择框 */
        if (e.target && e.target.closest && e.target.closest('.brand__mark__reset')) { return; }
        pickAvatar();
      });
      mark.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          pickAvatar();
        }
      });
    }

    var rst = el('brandReset');
    if (rst) { rst.addEventListener('click', resetAvatar); }

    var avf = el('avatarFile');
    if (avf) { avf.addEventListener('change', function () { onAvatarPicked(avf); }); }

    var avi = el('brandAvatar');
    if (avi) { avi.addEventListener('error', onAvatarError); }

    var nm = el('brandName');
    if (nm) {
      nm.addEventListener('click', function () { enterNameEdit(); });
      nm.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !nm.isContentEditable) { e.preventDefault(); enterNameEdit(); }
        else { onNameKey(e); }
      });
      nm.addEventListener('input', onNameInput);
      nm.addEventListener('paste', onNamePaste);
      nm.addEventListener('compositionstart', function () { nm.dataset.composing = '1'; });
      nm.addEventListener('compositionend', function () {
        nm.dataset.composing = '0';
        queueNameSave();      /* 输入法上屏即落盘，不等 debounce 到期 */
      });
      nm.addEventListener('blur', function () { exitNameEdit(true); });
    }
  }

  /* 供运行期门禁取证：身份的唯一入口 + 当前值。
     与 __ACT_SETTINGS__ 同一模式 —— 只暴露用户真正会走的那条路，
     不另外提供 set()，否则门禁测的不是真实路径。 */
  window.__ACT_IDENTITY__ = {
    read: A.readIdentity,
    patch: A.patchIdentity,
    apply: applyIdentity,
    compress: compressAvatar,
    enterEdit: enterNameEdit,
    exitEdit: exitNameEdit,
    LS_ID: A.LS_ID,
    DEFAULT: A.ID_DEFAULT,
    NAME_MAX: A.ID_NAME_MAX
  };

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

    /* 身份要在**数据渲染之前**刷。它不是「顺手也刷一下」的那类初始化：
       HTML 里硬编码的是默认字样与默认头像，自定义过的用户如果等到
       refreshAll() 之后再换，中间那段时间足够浏览器绘制一帧 —— 于是
       「先闪过默认名、再跳成自己改过的名」。身份只改两处文本/属性，
       成本几乎为零，就该排在所有重活前头。 */
    initIdentity();

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
