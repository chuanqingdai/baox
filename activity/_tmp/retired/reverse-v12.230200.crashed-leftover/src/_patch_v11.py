#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""app.js 第二版改造（一次性、带断言的切分-替换）。

为什么用脚本而不是逐个手工编辑：
  同一个文件的多处编辑如果并行发出，只有最后一次会存活，前面的**静默丢失**
  —— 返回全是成功、没有 diff、没有报错。本脚本对每个锚点断言「出现次数」，
  次数不符立即终止且不写盘，把「静默」变成「响亮」。

改动清单（对应用户第 1/3/5 项优化）：
  C1 删除 §⑦ 周进度区块本体 + 其 6 个函数（用户裁定：只删区块本体，
     保留今日打卡的两条本周进度条、总览周保费图、明细周次筛选）
  C2 删除 §⑫ 计分说明区块 + renderRules
  C3 renderAudit 删除「逐列对照」证据表写入（#auditFull）
  C4/C6 去掉 renderWeekStrip / renderWeekKPI 的两处调用
  C5 今日打卡横带的「本周保费目标」改为从 TARGETS 现读（可被设置数据改）
  C7 refreshAll 去掉 renderWeekSummary / renderRules
  C8 boot 先 applyOverlay() 再 refreshAll()，并把 bindWeekInputs 换成 bindSettings
  C9 用「设置数据」模块整体替换 window.exportCSV
  C10 清理随分区删除而失去消费者的 moneyWan / dowOf
"""
import io
import sys

P = '/Users/jaydenkong/Desktop/活动量/src/app.js'

# ─────────────────────────────────────────────────────────── 片段：新模块 ──
SETTINGS_MODULE = r'''  /* ========================================================================
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

'''

# ───────────────────────────────────────────── 被删区块的「墓碑」注释 ──
TOMB_WEEKLY = r'''  /* ========================================================================
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

'''

TOMB_RULES = r'''  /* ========================================================================
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

'''

# ─────────────────────────────────────────────────────── 替换清单 ──
# (start_marker, end_marker, new_text, label)  —— 删除 [start, end) 区间
CUTS = [
    ("  /* ========================================================================\n     ⑦ 渲染 · 周进度\n",
     "  /* ========================================================================\n     ⑧ 渲染 · 趋势热力\n",
     TOMB_WEEKLY, 'C1 删 §⑦ 周进度区块'),

    ("  /* ========================================================================\n     ⑫ 渲染 · 计分说明\n",
     "  /* ========================================================================\n     ⑬ 图表（Chart.js）\n",
     TOMB_RULES, 'C2 删 §⑫ 计分说明区块'),

    # ⚠️ 切分语义是「删除 [start, end)」，end 锚点**本身会被保留**。
    #    所以 end 必须取在「要删的最后一行之后」。第一次写成 end=el('auditFull') 那行，
    #    结果它恰好被保留下来 —— 而 start 侧的 auditBox 行反倒被切掉，
    #    于是页面代码里留下一句引用不存在元素的写入（#auditFull 早就不在 DOM 里）。
    #    这类错误在静态检查里完全看不见，只会在运行期抛 TypeError。
    ("    /* 逐列对照 —— 把上面的结论拆成可逐格核对的证据。",
     "  /* ========================================================================\n     ⑥ 渲染 · 今日打卡\n",
     "    el('auditBox').innerHTML = html;\n  }\n\n",
     'C3 删 #auditFull 逐列对照（含计算块）'),

    ("  /* ========================================================================\n     ⑰ 导出 CSV\n",
     "  /* ========================================================================\n     ⑱ 绑定与启动\n",
     SETTINGS_MODULE, 'C9 装入「设置数据」模块'),
]

# (old, new, expected_count, label)
REPL = [
    ("    paintTodayScore();\n    renderWeekStrip();\n    renderWeekKPI();\n  }\n",
     "    paintTodayScore();\n  }\n",
     1, 'C4 renderToday 去掉两处调用'),

    ("      paintTodayScore();\n      renderWeekStrip();\n      renderWeekKPI();\n    });\n",
     "      paintTodayScore();\n    });\n",
     1, 'C6 bindToday 去掉两处调用'),

    ("    var tgt = A.TARGETS.weekShort;\n    el('wkPremBar').style.width",
     "    var tgt = A.TARGETS.weekShort;\n"
     "    /* 目标值也是「设置数据」的可编辑项 —— 每次从 TARGETS 现读，" +
     "写死在标记里改不动 */\n"
     "    el('wkPremTgt').textContent = money(tgt, 0);\n"
     "    el('wkPremBar').style.width",
     1, 'C5 本周保费目标改为现读'),

    ("    renderToday();\n    renderWeekSummary();\n    renderHeat();",
     "    renderToday();\n    renderHeat();",
     1, 'C7a refreshAll 去掉 renderWeekSummary'),

    ("    renderLedger();\n    renderRules();\n    el('nbToday')",
     "    renderLedger();\n    el('nbToday')",
     1, 'C7b refreshAll 去掉 renderRules'),

    ("    refreshAll();\n    renderWeekChips();\n    bindChips();\n    bindToday();\n"
     "    bindWeekInputs();\n    initSearch();",
     "    /* 覆盖层必须先并回种子，再渲染 —— 顺序反了就是「保存了却不生效」，\n"
     "       而且症状极具欺骗性：抽屉里预演正确、页面数字不动，像没保存成功。 */\n"
     "    applyOverlay();\n"
     "    refreshAll();\n    renderWeekChips();\n    bindChips();\n    bindToday();\n"
     "    bindSettings();\n    initSearch();",
     1, 'C8 boot 加 applyOverlay / 换 bindSettings'),

    ("  function moneyWan(n) {\n    return (Number(n) / 10000).toFixed(2);\n  }\n",
     "", 1, 'C10a 删死函数 moneyWan'),

    ("  function dowOf(iso) { return A.SEED.days.length ? null : null; }\n",
     "", 1, 'C10b 删死函数 dowOf'),
]


def main():
    src = io.open(P, encoding='utf-8').read()
    n0 = len(src)
    log = []

    for start, end, new, label in CUTS:
        cs, ce = src.count(start), src.count(end)
        if cs != 1 or ce != 1:
            sys.exit('!! %s 锚点不唯一：start=%d end=%d（不写盘）' % (label, cs, ce))
        i = src.index(start)
        j = src.index(end, i + len(start))
        removed = src[i:j]
        src = src[:i] + new + src[j:]
        log.append((label, '删除 %d 字符 → 替换为 %d 字符' % (len(removed), len(new))))

    for old, new, cnt, label in REPL:
        c = src.count(old)
        if c != cnt:
            sys.exit('!! %s 锚点出现 %d 次，期望 %d 次（不写盘）' % (label, c, cnt))
        src = src.replace(old, new)
        log.append((label, '替换 %d 处' % cnt))

    # 落地前自检：被删函数必须一个不剩；新模块的关键函数必须在场
    #
    # ⚠️ 「必须缺席」必须去注释后再判。本项目上一轮就在这件事上栽过：
    #    build.py 的 MUST_NOT 起初连注释一起查，而 base.css 的注释里正好写着
    #    「旧写法 .fi{opacity:0} 会导致白屏」这句说明 —— 于是把唯一正确的代码
    #    误判成违规。这次是同一条课换个位置：TOMB_WEEKLY 墓碑注释里为了讲清
    #    「删了什么、留了什么」，必然要写出 renderWeekSummary / bindWeekInputs
    #    这些函数名。若带注释查，正确的删除反而被自己的说明文字判成残留。
    import re as _re
    probe = _re.sub(r'/\*.*?\*/', '', src, flags=_re.S)
    probe = _re.sub(r'^\s*//.*$', '', probe, flags=_re.M)

    GONE = ['renderWeekKPI', 'renderWeekStrip', 'weekStore', 'saveWeekStore',
            'renderWeekSummary', 'bindWeekInputs', 'renderRules', 'WS_FIELDS',
            'WS_LABELS', 'auditFull', 'exportCSV', 'moneyWan', 'dowOf',
            "el('weekStrip')", "el('wkBody')", "el('rulesTbody')",
            "localStorage.getItem('baox.act.week')"]
    for g in GONE:
        if g in probe:
            io.open('/Users/jaydenkong/Desktop/活动量/_tmp/_patched_debug.js',
                    'w', encoding='utf-8').write(src)
            k = probe.index(g)
            sys.exit('!! 残留：%s（不写盘）\n   上下文：%s'
                     % (g, probe[max(0, k - 160):k + 160].replace('\n', '\n   ')))
    NEED = ['function openSettings', 'function buildSettings', 'function saveSettings',
            'function applyOverlay', 'function restoreSource', 'function collectExport',
            'function importData', "var LS_DATA = 'baox.act.data'",
            'window.__ACT_SETTINGS__', 'el(\'wkPremTgt\').textContent']
    for n in NEED:
        if n not in probe:
            sys.exit('!! 缺失：%s（不写盘）' % n)

    # 顶层函数唯一性（同内联作用域）：重名会让后者静默覆盖前者
    fns = _re.findall(r'^  function ([A-Za-z_$][\w$]*)', src, flags=_re.M)
    dup = sorted({x for x in fns if fns.count(x) > 1})
    if dup:
        sys.exit('!! 顶层函数重名：%s（不写盘）' % dup)

    io.open(P, 'w', encoding='utf-8').write(src)
    print('app.js: %d → %d 字符' % (n0, len(src)))
    for label, note in log:
        print('  ✅ %-34s %s' % (label, note))
    print('  顶层函数 %d 个，无重名' % len(fns))
    print('  ✅ 被删符号 %d 项全部无残留 / 新增符号 %d 项全部在场' % (len(GONE), len(NEED)))


if __name__ == '__main__':
    main()
