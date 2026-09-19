#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 改造 · app.js（设置/启动层 §⑰–§⑱）。

与 _patch_v12_app_a.py 的分工：
  脚本 a（已执行）= 渲染层 §③–§⑬ + __ACT_SNAPSHOT__
  脚本 b（本文件）= 设置抽屉 §⑰ + 绑定与启动 §⑱

本脚本最重要的一件事：**把这一层自带的存储代码整段删掉**。
v1.1 的 app.js 里有一份完整的 readOverlay / writeOverlay / applyOverlay /
diffOverlay / baseSnapshot 与私有键 baox.act.data；而「今日打卡」写的是
baox.act.log。两条路都声称在写「今天」，于是同一天有两个真相 ——
症状是「保存了却不生效」，且**不会报错**。现在全部收敛到 core.js 的
单一覆盖层（baox.act.data.v2），本层只调用 A.*。

自检的两条纪律（本项目踩过坑的）：
  · 「必须缺席」一律判在**去注释**文本上 —— 墓碑注释里写着被删掉的函数名，
    判在原文上会把自己的说明文字当成残留（本轮已第七次复现）。
  · 「必须缺席」一律用**正则 + 词边界/后视**，不判裸字符串 ——
    `diffOverlay(` 是 `A.diffOverlay(` 的子串，裸判会把新调用当成旧残留。
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
# ① §⑰ 头部注释：说明「实现为什么不在这一层」
# ══════════════════════════════════════════════════════════════════════════
sub('§⑰ 生效机制段落',
    '''     ⚠️ 生效机制：基线 + 覆盖层（本模块唯一的难点）
     面板的权威数据是 src/data.js 内嵌的 ACT_SEED（源模板 30 天实绩）。core.js 在
     加载时按引用持有它，computeAll() 每次调用都直接读它 —— 这是「唯一口径」的根基。
     所以「让编辑生效」只有两条路：
       ① 在 core.js 里加一层「读取时合并覆盖层」—— 改动唯一口径文件，风险外溢；
       ② 在应用层把覆盖层**并回 SEED 对象本身** —— core.js 一行不动，
          computeAll() 自然算出新结果，口径仍然只有一份实现。
     本模块走 ②：启动时深拷贝一份 BASE（源模板基线），每次 applyOverlay() 都是
     「先从 BASE 还原、再叠加覆盖层」，而不是在已改过的值上继续改。
     于是 applyOverlay() 幂等，「恢复源模板数据」天然可行 ——
     若在已改过的值上叠加，那个按钮根本无从实现。''',
    '''     ⚠️ 生效机制：基线 + 覆盖层 —— 但**实现不在这一层**（v1.2 改动）
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
       A.applyOverlay()   A.commit(ov)   A.overlaySize()   A.diffOverlay(...)   A.readOverlay()''')

# ══════════════════════════════════════════════════════════════════════════
# ② 声明区：删私有 LS_DATA / BASE，标量目标参数换成业务指标六项
# ══════════════════════════════════════════════════════════════════════════
sub('声明区：删 LS_DATA/BASE',
    '''  var LS_DATA = 'baox.act.data';   /* 覆盖层：只存**改过的**天与目标，未改的键不落盘 */
  var BASE = null;                 /* 源模板基线（深拷贝，只读） */
  var DRAFT = null;                /* 抽屉打开期间的编辑草稿 */''',
    '''  /* 本层只留「抽屉打开期间的编辑草稿」。覆盖层与基线都搬进了 core.js ——
     它们是**口径**的一部分：基线决定「什么算改过」，那是判断，不是交互。
     放在应用层时，「本机改过的值算不算权威」就成了应用层的自由裁量，
     两份实现随即开始分叉。 */
  var DRAFT = null;                /* 抽屉打开期间的编辑草稿 */''')

sub('标量目标参数 → 业务指标六项',
    '''  /* 可用 set-row 表达的标量目标参数。key 直接就是 targets 上的字段名 ——
     刻意不用 'a.b' 这样的路径串：调用点只有三处，getPath/setPath 那层间接
     除了多一处写错的机会，什么也没换来。 */
  var TGT_ROWS = [
    { key: 'month',     label: '月保费目标',     hint: '月达标率的分母',           step: 1000 },
    { key: 'weekShort', label: '当前周保费目标', hint: '今日打卡「本周保费」进度条', step: 500 },
    { key: 'mdrtCarry', label: 'MDRT 期初结余',  hint: '计入 MDRT 的起点',          step: 1000 }
  ];''',
    '''  /* 业务指标六项：**全部手动维护**，在设置抽屉里改。
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
  }''')

# ══════════════════════════════════════════════════════════════════════════
# ③ 删掉六个存储函数（baseSnapshot / 覆盖层读写全套）
# ══════════════════════════════════════════════════════════════════════════
sub('删除存储层六函数',
    '''  /* ------------------------------------------------------------ 基线快照 */

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
  }''',
    '''  /* ------------------------------------------- 基线 / 覆盖层 —— 已移交 core.js
     这里原本是六个函数、约 120 行：baseSnapshot()、readOverlay()、overlaySize()、
     writeOverlay()、applyOverlay()、diffOverlay()，外加私有键 baox.act.data。

     删掉它们不是「顺手精简」。core.js 里现在有**同名同职责**的一整套，
     而两份实现必然分叉 —— 并且这种分叉是静默的：不抛异常、不报错，
     只是数字安静地对不上（抽屉里预演正确、页面上数字不动）。
     保留这段墓碑说明，是因为「这一层为什么没有存储实现」会被反复问到，
     而一个只有结论没有原因的注释，下一个人会当成疏漏直接补回去。 */''')

# ══════════════════════════════════════════════════════════════════════════
# ④ buildDraft：从「当前种子」取值，并带走备注
# ══════════════════════════════════════════════════════════════════════════
sub('buildDraft',
    '''  /** 基线 + 覆盖层 → 可编辑草稿（只含允许编辑的键）。 */
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
  }''',
    '''  /** 当前值 → 可编辑草稿（只含允许编辑的键）。
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
  }''')

# ══════════════════════════════════════════════════════════════════════════
# ⑤ buildSettings ①：目标参数 → 业务指标（6 手动 + 2 只读派生）
# ══════════════════════════════════════════════════════════════════════════
sub('buildSettings ① 业务指标组',
    '''    /* ① 标量目标参数 */
    html += '<div class="set-group"><div class="set-group-title">目标参数' +
      '<span>顶栏 KPI、进度条与图表推算的基准</span></div>' +
      TGT_ROWS.map(function (r) {
        return '<div class="set-row"><label class="set-label" for="st-' + r.key + '">' +
          esc(r.label) + '<em>' + esc(r.hint) + '</em></label>' +
          '<input class="set-input" id="st-' + r.key + '" type="number" min="0" step="' +
          r.step + '" value="' + DRAFT.targets[r.key] + '" data-tgt="' + r.key +
          '" aria-label="' + esc(r.label) + '"></div>';
      }).join('') + '</div>';''',
    '''    /* ① 业务指标：六项手动 + 两项只读派生。
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
      '</div>';''')

# 网格组标题：天数随窗口；说明去掉「成交家庭数」
sub('网格组标题（天数随窗口）',
    """      '<span>30 天 × ' + keys.length + ' 项 + 当日保费 · 改动过的格子亮金色描边</span></div>' +""",
    """      '<span>' + period().days + ' 天 × ' + keys.length +
      ' 项 + 当日保费 · 改动过的格子亮金色描边</span></div>' +""")

sub('网格说明文案',
    """      '<div class="dg-note">得分 = Σ(次数 × 分值)，走的是页面同一个 <b>dayScore</b> 实现，' +
      '不在抽屉里另写一套；「成交家庭数」计入合计但不计分。改动只写本机浏览器，' +
      '点<b>保存并应用</b>后才生效。</div></div>';""",
    """      '<div class="dg-note">得分 = Σ(次数 × 分值)，走的是页面同一个 <b>dayScore</b> 实现，' +
      '不在抽屉里另写一套；12 个计分项**全部计分**（v1.2 起不再有「仅记录」项）。' +
      '改动只写本机浏览器，点<b>保存并应用</b>后才生效。</div></div>';""")

# ══════════════════════════════════════════════════════════════════════════
# ⑤b buildSettings / markDirty 里的基线引用
#   这两处是**第一轮真实漏掉的**：sub() 全部命中、语法也过，但自检拦住了 ——
#   「漏改」不会在替换期报错，只会在自检里现形。所以自检必须覆盖
#   「被删掉的本地符号还有没有人在用」，而不只是「新字段有没有出现」。
# ══════════════════════════════════════════════════════════════════════════
sub('buildSettings 基线引用',
    '''  function buildSettings() {
    var b = baseSnapshot();''',
    '''  function buildSettings() {
    var b = A.BASE;''')

sub('markDirty 基线引用',
    '''  function markDirty(inp, dt) {
    var bd = BASE.byDate[dt];''',
    '''  function markDirty(inp, dt) {
    var bd = A.BASE.byDate[dt];''')

# ══════════════════════════════════════════════════════════════════════════
# ⑥ 抽屉内的「季完成率」文案工具 + countDirty / refreshSettings / onSettingInput
# ══════════════════════════════════════════════════════════════════════════
sub('新增 rateText()（预演用）',
    '''  function pv(label, a, b, unit) {''',
    '''  /** 抽屉里那一行只读的「季度目标完成率」。取草稿值而非落盘值 ——
      要等到「保存并应用」才变的话，用户就没有任何办法在落盘前确认它算得对不对。
      分母为 0 给「—」而不是 0.0%：0.0% 是一个结论（「一点都没做」），
      而这里的事实是「还没有分母」。 */
  function rateText() {
    var qp = H.num(DRAFT.biz.quarterPerf), qg = H.num(DRAFT.biz.quarterGoal);
    return qg ? (qp / qg * 100).toFixed(1) + '%' : '—';
  }

  function pv(label, a, b, unit) {''')

sub('countDirty',
    '''  function countDirty() {
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
  }''',
    '''  function countDirty() {
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
  }''')

sub('refreshSettings',
    '''    var list = BASE.days.map(function (d) { return DRAFT.days[d.date]; });
    var agg = A.aggregate(list);

    BASE.days.forEach(function (d) {''',
    '''    var list = A.BASE.days.map(function (d) { return DRAFT.days[d.date]; });
    var agg = A.aggregate(list);

    A.BASE.days.forEach(function (d) {''')

sub('refreshSettings 预演指标',
    '''    if (DG.preview) {
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
    }''',
    '''    /* 只读派生值跟着草稿实时走（见 rateText 的说明） */
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
    }''')

sub('onSettingInput',
    '''    var dt = t.getAttribute('data-d');
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
    } else { return; }''',
    '''    var dt = t.getAttribute('data-d');
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
    } else { return; }''')

# ══════════════════════════════════════════════════════════════════════════
# ⑦ openSettings / saveSettings / restoreSource
# ══════════════════════════════════════════════════════════════════════════
sub('openSettings',
    '''  function openSettings() {
    baseSnapshot();
    DRAFT = buildDraft();
    buildSettings();
    var btn = el('btnRestore');
    if (btn) { disarmRestore(); btn.hidden = overlaySize() === 0; }''',
    '''  function openSettings() {
    DRAFT = buildDraft();
    buildSettings();
    var btn = el('btnRestore');
    if (btn) { disarmRestore(); btn.hidden = A.overlaySize() === 0; }''')

sub('saveSettings',
    '''    var ov = diffOverlay(DRAFT.days, DRAFT.targets, DRAFT.weeks);
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
      : '数据与源模板一致，无需改动');''',
    '''    var ov = A.diffOverlay(DRAFT.days, DRAFT.biz, DRAFT.weeks);
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
      : '数据与初始值一致，无需改动');''')

sub('restoreSource 注释',
    '''  /* 恢复源模板：**两次点击确认**，不做单点即执行。
     单点执行是静默破坏性操作 —— 点错一次，30 天数据连同目标参数一起消失，''',
    '''  /* 恢复初始数据：**两次点击确认**，不做单点即执行。
     单点执行是静默破坏性操作 —— 点错一次，30 天数据连同业务指标一起消失，''')

sub('restoreSource 按钮文案',
    """    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span>恢复源模板数据</span>';""",
    """    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span>恢复初始数据</span>';""")

sub('restoreSource 主体',
    '''    clearTimeout(restoreSource._tm);
    disarmRestore();
    try { localStorage.removeItem(LS_DATA); } catch (e) {}
    applyOverlay();
    closeSettings();
    refreshAll();
    fitCharts();
    toast('已恢复源模板数据');''',
    '''    clearTimeout(restoreSource._tm);
    disarmRestore();
    /* 不直接删键，而是**提交一份空覆盖层**：commit 见到空覆盖层会主动
       removeItem。于是「清空」只有一条路径，不必在这里再写一遍删键逻辑 ——
       写两遍必然分叉（比如某天只清了 days 忘了 biz）。 */
    A.commit({ days: {}, weeks: {}, biz: {} });
    closeSettings();
    refreshAll();
    fitCharts();
    toast('已恢复初始数据');''')

# ══════════════════════════════════════════════════════════════════════════
# ⑧ 导出 / 导入
# ══════════════════════════════════════════════════════════════════════════
sub('collectExport',
    '''      targets: {
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
      changedDays: Object.keys(readOverlay().days).length''',
    '''      biz: (function () {
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
      changedDays: Object.keys(A.readOverlay().days).length''')

sub('collectExport 版本号',
    """      app: 'baox-activity',
      version: 1,""",
    """      app: 'baox-activity',
      version: 2,""")

sub('exportData 文件名',
    """    a.download = '公子的活动量数据_' + todayISO() + '.json';""",
    """    a.download = '展业活动量数据_' + todayISO() + '.json';""")

sub('exportData 提示',
    """    toast('已导出完整数据（JSON 备份 · 30 天）');""",
    """    toast('已导出完整数据（JSON 备份 · ' + period().days + ' 天）');""")

sub('importData',
    '''      var ov = diffOverlay(daysMap, obj.targets || null, weeksMap);
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
        : '已导入：内容与源模板一致');''',
    '''      var ov = A.diffOverlay(daysMap, obj.biz || null, weeksMap);
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
        : '已导入：内容与初始值一致');''')

# ══════════════════════════════════════════════════════════════════════════
# ⑨ 取证入口 / refreshAll / boot
# ══════════════════════════════════════════════════════════════════════════
sub('__ACT_SETTINGS__',
    """  window.__ACT_SETTINGS__ = { collect: collectExport, overlay: readOverlay };""",
    """  window.__ACT_SETTINGS__ = { collect: collectExport, overlay: A.readOverlay };""")

sub('refreshAll',
    '''    renderKPI();
    renderInsights();
    renderAudit();
    renderToday();
    renderHeat();
    renderMix();
    renderFunnel();
    renderLedger();
    el('nbToday').textContent = (R.agg.days + R.local.length) + '天';
    buildCharts();''',
    '''    renderKPI();
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
    buildCharts();''')

sub('boot 调 A.applyOverlay',
    '''    applyOverlay();
    refreshAll();
    renderWeekChips();''',
    '''    A.applyOverlay();
    refreshAll();
    renderWeekChips();''')

# ══════════════════════════════════════════════════════════════════════════
# 自检
# ══════════════════════════════════════════════════════════════════════════
# 去注释后判定：墓碑注释里写着被删掉的函数名，判在原文上会把自己的说明文字
# 当成残留 —— 这是本项目的常客（本轮又一次）。
probe = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
probe = re.sub(r'^\s*//.*$', '', probe, flags=re.M)

# 每条 = (人话标签, 正则)。一律带词边界或后视：
# 裸判 'diffOverlay(' 会被新的 'A.diffOverlay(' 命中 —— 把新调用当成旧残留，
# 于是「改对了却报错」，比不改更糟。
GONE = [
    ('私有键 baox.act.data', r"baox\.act\.data'"),
    ('TGT_ROWS', r'\bTGT_ROWS\b'),
    ('mdrtCarry', r'\bmdrtCarry\b'),
    ('A.TARGETS.weekShort', r'A\.TARGETS\.weekShort'),
    ('A.TARGETS.month', r'A\.TARGETS\.month'),
    ('renderAudit（函数与调用都该没了）', r'\brenderAudit\b'),
    ('R.local（两路日集合的残留）', r'\bR\.local\b'),
    ('本层私有的 baseSnapshot', r'\bbaseSnapshot\b'),
    ('本层私有的 applyOverlay', r'(?<!A\.)\bapplyOverlay\s*\('),
    ('本层私有的 writeOverlay', r'(?<!A\.)\bwriteOverlay\s*\('),
    ('本层私有的 diffOverlay', r'(?<!A\.)\bdiffOverlay\s*\('),
    ('本层私有的 readOverlay', r'(?<!A\.)\breadOverlay\s*\('),
    ('本层私有的 overlaySize', r'(?<!A\.)\boverlaySize\s*\('),
    ('本层私有的 LS_DATA / BASE', r'(?<!A\.)\b(LS_DATA|BASE)\b'),
    ('DRAFT.targets', r'DRAFT\.targets'),
    ('小写 targets（目标参数残留）', r'\btargets\b'),
    ('抽屉里的 data-tgt', r'data-tgt'),
]
bad = []
for label, pat in GONE:
    hits = re.findall(pat, probe)
    if hits:
        bad.append('旧实现未清: %s（%d 处）' % (label, len(hits)))

NEED = [
    'A.commit(', 'A.applyOverlay()', 'A.overlaySize(', 'A.diffOverlay(',
    'A.readOverlay', 'A.BASE.biz', 'A.BASE.days', 'A.SEED.biz',
    'BIZ_ROWS', "key: 'monthPerf'", "key: 'quarterPerf'", "key: 'yearPerf'",
    "key: 'quarterGoal'", "key: 'quarterDeals'", "key: 'quarterPremium'",
    'bwTarget(', 'rateText()', "data-biz=", 'st-roScore', 'st-roRate',
    'DRAFT.biz', 'o.note', '已恢复初始数据', '展业活动量数据_',
]
for t in NEED:
    if t not in src:
        bad.append('缺少: %s' % t)

if bad:
    print('!! 自检失败：')
    for b in bad:
        print('   -', b)
    sys.exit(1)

io.open(P, 'w', encoding='utf-8').write(src)
print('app.js（设置/启动层）: %d → %d 字符' % (orig_len, len(src)))
for s in STEPS:
    print('  ✅', s)
print('   ✅ 自检：%d 项旧实现已清 / %d 项新调用在场' % (len(GONE), len(NEED)))
