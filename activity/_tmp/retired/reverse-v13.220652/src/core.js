/* ============================================================================
   core.js · 活动量面板 · 唯一口径计算层
   ----------------------------------------------------------------------------
   ⚠️ 本文件是「计分与聚合」的唯一实现。
     构建期（build.py 用 node 跑它导出快照做断言）
     与运行期（浏览器直接加载它）
     读的是同一个文件、同一组函数 —— 从结构上根除
     「前后端两份口径分叉、数字全对但结论整体倒置」这类缺陷。

   口径约定
     · 单日得分 = Σ(次数 × 分值)，12 项计分项，单轮满分 23 分
     · 统计窗口自 2026-09-18 起 30 天；周区间按**自然周**（周一–周日）切分
       （首周 3 天、末周 6 天 —— 自然周的定义使然，不是缺陷）
     · 各周保费目标逐周给出（默认 17500），可在「设置数据」里逐周改
     · 业务指标六项手动维护；唯一派生值「季度目标完成率」
       = 本季度业绩 / 季度目标业绩 × 100%

   两条贯穿全文件的结构约束（v1.2 立）
     ① **面板就是窗口**：种子恰好覆盖 30 天，窗口外的日期不属于本面板。
        于是「今天不在窗口内」必须有声音 —— saveDay() 返回 out-of-window，
        调用方据此提示，绝不静默丢弃。曾经的做法（窗口外日期追加进日集合）
        会让天数变成 31、周聚合收到一个不属于任何周的日子，
        而症状只是「天数多了一天」，没有任何一处报错。
     ② **本机数据只有一份**：覆盖层 baox.act.data.v2。「今日打卡」与
        「设置数据」是同一条落盘路径（commit）的两个入口，不是两个存储 ——
        v1.1 里两者各写各的（baox.act.log / baox.act.data），
        却指向同一天，于是同一天有两个真相，谁后写谁赢、且互不知情。
   ============================================================================ */
(function (global) {
  'use strict';

  var SEED = global.ACT_SEED || { rules: [], days: [], weeks: [], targets: {} };
  var RULES = SEED.rules || [];
  var UNSCORED = SEED.unscored || [];
  /* targets / biz 这里补成对象而不是「读时兜底」：applyOverlay 是按引用
     就地改写的（否则 computeAll 那一侧持有的引用会指向旧对象），
     所以这两个容器必须在加载期就保证存在。 */
  var TARGETS = SEED.targets || (SEED.targets = {});
  var BIZ = SEED.biz || (SEED.biz = {});

  /* ------------------------------------------------------------------ 工具 */

  /* 方向写进函数名：只收「目标日」，未来为正、过去为负。
     绝不暴露 daysBetween(a,b) 这种「谁是 a 谁是 b 靠记忆」的签名 —— 传反不报错。 */
  function daysFromToday(target, base) {
    var t0 = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    var t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    return Math.round((t1 - t0) / 86400000);
  }

  function parseDay(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function isoOf(d) {
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }

  function round(n, p) {
    var f = Math.pow(10, p || 0);
    return Math.round(n * f) / f;
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  /* ------------------------------------------------------- 单日 / 集合聚合 */

  /** 单日得分（唯一实现）。rec 中每个计分项存的是「次数」。 */
  function dayScore(rec) {
    var s = 0;
    for (var i = 0; i < RULES.length; i++) {
      s += num(rec[RULES[i].key]) * RULES[i].pts;
    }
    return s;
  }

  /** 把一个日集合聚合成各项次数、加权得分、保费与成交计数。 */
  function aggregate(list) {
    var counts = {}, score = 0, premium = 0, closeCount = 0;
    for (var i = 0; i < RULES.length; i++) { counts[RULES[i].key] = 0; }
    for (var j = 0; j < UNSCORED.length; j++) { counts[UNSCORED[j].key] = 0; }
    for (var k = 0; k < list.length; k++) {
      var d = list[k];
      for (var a = 0; a < RULES.length; a++) {
        counts[RULES[a].key] += num(d[RULES[a].key]);
      }
      for (var b = 0; b < UNSCORED.length; b++) {
        counts[UNSCORED[b].key] += num(d[UNSCORED[b].key]);
      }
      score += dayScore(d);
      premium += num(d.premium);
      closeCount += num(d.close);
    }
    return {
      days: list.length,
      counts: counts,
      score: score,
      premium: round(premium, 2),
      closeCount: closeCount,
      avgScore: list.length ? round(score / list.length, 1) : 0,
      perDeal: closeCount ? round(premium / closeCount, 2) : 0
    };
  }

  /* ------------------------------------------------------------- 周维度聚合 */

  /** 按 seed.weeks 的分块（自然周切分），给出每周聚合与达标率。 */
  function weekRows(days) {
    var byDate = {};
    for (var i = 0; i < days.length; i++) { byDate[days[i].date] = days[i]; }
    return (SEED.weeks || []).map(function (w) {
      var seg = w.days.map(function (d) { return byDate[d]; }).filter(Boolean);
      var agg = aggregate(seg);
      var target = w.target || TARGETS.week;
      return {
        idx: w.idx, from: w.from, to: w.to, dayCount: w.dayCount,
        /* days 必须随行带出：调用方按「某天属于哪一周」反查时要用它。
           曾经漏掉这个字段，症状是 weekOfDate() 里 .indexOf 撞上 undefined ——
           整个 boot 抛异常中断，页面 DOM 全空、KPI 全为占位符「—」，
           而静态门禁（内容断言 / 语法 / 图标 / 数据计数）一个都没报错。
           这正是运行期门禁 E 存在的理由。 */
        days: w.days,
        target: target, targetNote: w.targetNote,
        score: agg.score, premium: agg.premium,
        closeCount: agg.closeCount,
        perDeal: agg.perDeal,
        rate: target ? round(agg.premium / target * 100, 1) : 0,
        avgScore: agg.avgScore,
        counts: agg.counts
      };
    });
  }

  /* --------------------------------------------------------- 成功方程式/漏斗 */

  /**
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
   * id（S1/S2/S3）是一套**自有的**稳定标识：v1.1 用的是源模板单元格坐标
   * （F35/F36/F37）。源模板已不再被本面板引用，再用单元格坐标当标识，
   * 就是留着一个指向不存在之物的名字 —— 门禁比对起来也仍然「通过」，
   * 因为两边抄的是同一个早已失去意义的字符串。
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
        label: d.label, ref: d.ref, id: d.id,
        numerator: n, denominator: den,
        ratio: ratio,
        pct: round(ratio * 100, 1),
        stdPct: round(ratio * 100, 0),
        ok: ratio * 100 >= parseFloat(d.ref.replace(/[^0-9.]/g, ''))
      };
    });
  }

  /** 目标比率「约访：需求分析：方案呈现：促成签单 = 15：9：6：3」 */
  function targetRatio() {
    return { visit: 15, need: 9, plan: 6, close: 3 };
  }

  /* --------------------------------------------------------------- 连续打卡 */

  /** 从给定日集合的**末位**往前数：连续「得分 > 0」的天数。
      参数刻意是「一段日集合」而不是「全部天数」：
        · 传整窗 → 「窗口末位连续」，本窗口末日在未来，它恒为 0，没有意义；
        · 传「截止到今天的那一段」→ **当前连续**，这才是页面上要显示的值
          （app.js 就是这么用的：R.days.slice(0, 今天的位置 + 1)）。
      两者差一天都会被看成 bug（「今天打了卡，连续还是 0」），
      所以这个区别写在签名上：函数只认「你给的那一段的末位」。 */
  function streakEndingAt(days) {
    var n = 0;
    for (var i = days.length - 1; i >= 0; i--) {
      if (dayScore(days[i]) > 0) { n++; } else { break; }
    }
    return n;
  }

  /** 一段日集合里最长的连续打卡。与末位无关，故整窗即为窗口内最长。 */
  function longestStreak(days) {
    var best = 0, cur = 0;
    for (var i = 0; i < days.length; i++) {
      if (dayScore(days[i]) > 0) { cur++; best = Math.max(best, cur); }
      else { cur = 0; }
    }
    return best;
  }

  /* ================================================== 覆盖层 · 本机唯一写入口 */

  /* 键名带 .v2：v1.2 换了存储形态（v1 的 {targets:{month,weekShort,mdrtCarry}}
     三项已不存在，且「今日打卡」不再是独立存储）。不删旧键、也不做数据迁移 ——
     改名即可让新代码看不见它，旧数据仍在浏览器里可查。
     迁移的代价与收益完全不成比例：v1 的窗口是 2022 年，跟本窗口没有一天的
     交集，可迁移的东西是零。 */
  var LS_DATA = 'baox.act.data.v2';
  var LS_THEME = 'baox.act.theme';

  function readJSON(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, val) {
    try { global.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ======================================================== 身份 · 头像与品牌字样 */

  /* 身份走**独立键**，不并进 overlay。并进去有三个具体后果，一个比一个难解释：
       ① 头像是几十 KB 的 dataURL，会把「活动量数据备份」的导出文件撑大，
          而那份 JSON 的语义是「业绩数据」，混入个人形象属于语义污染；
       ② 换台机器导入别人的备份，会把对方的头像一并带过来；
       ③ overlaySize() 决定「恢复初始数据」按钮露不露面 —— 改个头像就让
          「有改动待恢复」亮起来，而那个按钮**恢复不了头像**，纯误导。
     独立键之后，「恢复初始数据」只动活动量 overlay，身份纹丝不动；
     反之改身份也不会让那个按钮误亮。两个语义各自干净。 */
  var LS_ID = 'baox.act.identity.v1';

  var ID_DEFAULT = { name: '公子的', avatar: '' };

  /* 字样长度上限。标题是 nowrap 的一行，且品牌区 flex:0 0 auto **不参与压缩**，
     超长会直接挤压右侧动作区（搜索 / 皮肤 / 设置）。
     8 字 × 最大 38px ≈ 304px，是实测不挤的安全值。 */
  var ID_NAME_MAX = 8;

  /** 头像是否是可接受的内联图片。只认 data:image/*;base64 ——
      本机 JSON 是可以被手工编辑的，不能让外链或伪协议灌进 img.src。
      零外链（铁律 8）对头像同样成立，不开例外。 */
  function isInlineImage(s) {
    return typeof s === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(s);
  }

  /** 身份的唯一读入口。任何非法值一律退回默认 ——
      读到半个坏值比读不到更糟：它会带着 undefined 一路走进 DOM。 */
  function readIdentity() {
    var o = readJSON(LS_ID, null);
    var out = { name: ID_DEFAULT.name, avatar: '' };
    if (!o || typeof o !== 'object') { return out; }
    if (typeof o.name === 'string') {
      var n = o.name.replace(/\s+/g, ' ').trim();
      if (n) { out.name = n.slice(0, ID_NAME_MAX); }
    }
    if (isInlineImage(o.avatar)) { out.avatar = o.avatar; }
    return out;
  }

  /** 身份的唯一写入口。只落**与默认不同的键**，全默认则删键 ——
      与 overlay 同一套思路（空对象不落盘），于是「键存在」恒等于「有自定义」，
      「恢复默认」因此天然可判定，不必再存一个 boolean。 */
  function writeIdentity(id) {
    var raw = {};
    if (id && typeof id.name === 'string') {
      var n = id.name.replace(/\s+/g, ' ').trim().slice(0, ID_NAME_MAX);
      if (n && n !== ID_DEFAULT.name) { raw.name = n; }
    }
    if (id && isInlineImage(id.avatar)) { raw.avatar = id.avatar; }
    var empty = (Object.keys(raw).length === 0);
    try {
      if (empty) { global.localStorage.removeItem(LS_ID); }
      else { global.localStorage.setItem(LS_ID, JSON.stringify(raw)); }
      return { ok: true, keys: empty ? 0 : Object.keys(raw).length };
    } catch (e) {
      /* 配额溢出必须单独报。头像是本面板唯一可能撑爆 localStorage 的数据
         （每域通常 5MB，且按 UTF-16 计 —— 100KB 的 dataURL 实占约 200KB）。
         把它混进「保存失败」里，用户只会以为是自己点错了。 */
      var quota = /quota|exceed|storage is full/i.test(
        String(e && e.name) + ' ' + String(e && e.message));
      return { ok: false, reason: quota ? 'quota' : 'storage' };
    }
  }

  /** 改**一部分**：读 → 合并 → 写。两个交互入口（换头像 / 改字样）都走这里。
      各自读-改-写一遍的话，「改字样」会拿旧头像覆盖刚换的头像（反之亦然）——
      而这个竞态只在两处几乎同时写入时才现形，极难复现。 */
  function patchIdentity(patch) {
    var cur = readIdentity();
    if (patch && typeof patch.name === 'string') { cur.name = patch.name; }
    if (patch && patch.avatar !== undefined) {
      cur.avatar = isInlineImage(patch.avatar) ? patch.avatar : '';
    }
    var r = writeIdentity(cur);
    if (r.ok) { r.id = readIdentity(); }
    return r;
  }

  /* 一天里允许被写入的键：12 个计分项 + 当日保费 + 备注。
     刻意**不用** `k in seedDay` 当白名单：种子里没有 note（它只存在于本机），
     于是备注会被自己的白名单挡在门外，而症状是「备注保存了但刷新就没了」。 */
  var DAY_KEYS = ['premium', 'note'];
  (function () {
    for (var i = 0; i < RULES.length; i++) { DAY_KEYS.push(RULES[i].key); }
    for (var j = 0; j < UNSCORED.length; j++) { DAY_KEYS.push(UNSCORED[j].key); }
  })();
  var DAY_KEY_SET = {};
  DAY_KEYS.forEach(function (k) { DAY_KEY_SET[k] = 1; });

  /* ---------------------------------------------------------------- 基线快照 */

  /* 加载期把种子逐值深拷贝成基线。applyOverlay() 每次「先从基线还原、再叠加」，
     于是它幂等 —— 「恢复初始数据」因此天然可实现（若在已改过的值上继续叠加，
     那个按钮根本无从实现）。
     为什么基线放在 core 而不是应用层：基线是**唯一口径**的一部分。放在应用层
     时，「本机改过的值算不算权威」就成了应用层的判断，两份实现随即开始分叉。 */
  var BASE = (function () {
    function cp(o) { return JSON.parse(JSON.stringify(o)); }
    var days = (SEED.days || []).map(cp);
    var byDate = {}, index = {};
    for (var i = 0; i < days.length; i++) { byDate[days[i].date] = days[i]; index[days[i].date] = i; }
    var b = {
      days: days, byDate: byDate, index: index,
      weeks: (SEED.weeks || []).map(function (w) { return cp(w); }),
      targets: cp(TARGETS),
      biz: cp(BIZ)
    };
    b.agg = aggregate(days);   /* 抽屉预演时的「旧值」，算一次即够 */
    return b;
  })();

  /** 该日期是否属于本面板的统计窗口。窗口外的打卡要**说出来**，不能静默丢弃。 */
  function inWindow(iso) { return !!BASE.byDate[iso]; }

  /* ------------------------------------------------------------ 覆盖层读写 */

  function readOverlay() {
    var o = readJSON(LS_DATA, null);
    if (!o || typeof o !== 'object') { o = {}; }
    return { days: o.days || {}, weeks: o.weeks || {}, biz: o.biz || {} };
  }

  /** 覆盖层条目总数。用来决定「恢复初始数据」按钮该不该露面。 */
  function overlaySize(ov) {
    ov = ov || readOverlay();
    return Object.keys(ov.days).length + Object.keys(ov.weeks).length +
           Object.keys(ov.biz).length;
  }

  /* 空覆盖层**不落盘**（删键）。否则会写出一个 {} —— 于是「恢复初始数据」
     按钮永远亮着，而它其实什么都不会恢复：状态显示在自欺欺人。 */
  function writeOverlay(ov) {
    try {
      if (overlaySize(ov) === 0) { global.localStorage.removeItem(LS_DATA); }
      else { global.localStorage.setItem(LS_DATA, JSON.stringify(ov)); }
      return true;
    } catch (e) { return false; }
  }

  /** 覆盖层并回种子。幂等：每次都从 BASE 重放，而不是在已改值上再改。
      全程**就地改写**（不重新赋值 SEED.days / SEED.biz 等）——
      computeAll 与 bizMetrics 都按引用持有这些容器，换掉引用等于两边看不同的数据。 */
  function applyOverlay() {
    var ov = readOverlay();
    var i, k;

    /* ① 逐日：整表还原成基线 */
    for (i = 0; i < BASE.days.length; i++) {
      var bd = BASE.days[i], node = SEED.days[i];
      if (!node) { continue; }
      for (k in bd) { if (k !== 'date') { node[k] = bd[k]; } }
    }
    /* ② 逐日：叠加覆盖层。不认识的日期与键一律丢弃 ——
       本机 JSON 是可以被手工编辑的，不能让它往种子里塞字段。 */
    for (var dt in ov.days) {
      var j = BASE.index[dt], rec = ov.days[dt];
      if (j === undefined || !rec) { continue; }
      for (k in rec) {
        if (!DAY_KEY_SET[k]) { continue; }
        SEED.days[j][k] = (k === 'note') ? String(rec[k] || '') : num(rec[k]);
      }
    }
    /* ③ 各周保费目标 */
    for (i = 0; i < BASE.weeks.length; i++) {
      var bw = BASE.weeks[i], wn = SEED.weeks[i];
      if (!wn) { continue; }
      wn.target = (ov.weeks[bw.idx] === undefined) ? bw.target : num(ov.weeks[bw.idx]);
    }
    /* ④ 业务指标六项。派生值「季度目标完成率」不落盘、不在此处 ——
       它由 bizMetrics() 现算，存下来就会出现「存的率与算的率不一致」。 */
    for (k in BASE.biz) {
      BIZ[k] = (ov.biz[k] === undefined) ? BASE.biz[k] : num(ov.biz[k]);
    }
    return ov;
  }

  /** 唯一的落盘路径：写覆盖层 → 并回种子。
     两个写入口（今日打卡 saveDay / 设置数据）都收敛到这里，
     所以「谁的改动最后生效」永远只有一个答案。 */
  function commit(ov) {
    if (!writeOverlay(ov)) { return false; }
    applyOverlay();
    return true;
  }

  /** 「今日打卡」的写路径：只把**与基线不同的键**并进覆盖层那一天。
      返回值带 ok/reason 而不是布尔：窗口外必须能与「存储不可写」区分开 ——
      两者的提示语完全不同，合并成一个 false 就只能说「保存失败」。 */
  function saveDay(date, rec) {
    if (!inWindow(date)) { return { ok: false, reason: 'out-of-window' }; }
    var ov = readOverlay();
    var bd = BASE.byDate[date];
    var diff = {}, k;
    for (k in rec) {
      if (!DAY_KEY_SET[k]) { continue; }
      if (k === 'note') {
        if (String(rec[k] || '') !== String(bd[k] || '')) { diff[k] = String(rec[k] || ''); }
        continue;
      }
      if (num(rec[k]) !== num(bd[k])) { diff[k] = num(rec[k]); }
    }
    if (Object.keys(diff).length) { ov.days[date] = diff; }
    else { delete ov.days[date]; }   /* 全 0 不留空记录污染覆盖层 */
    if (!commit(ov)) { return { ok: false, reason: 'storage' }; }
    return { ok: true, changed: Object.keys(diff).length };
  }

  /** 把「一组完整值」diff 成覆盖层。保存与导入共用同一份判定：
      两处各写一遍必然分叉 —— 导入的备份会多出「等于基线却仍记为改动」的幽灵键。 */
  function diffOverlay(daysMap, bizMap, weeksMap) {
    var ov = { days: {}, weeks: {}, biz: {} };

    BASE.days.forEach(function (bd) {
      var src = daysMap && daysMap[bd.date];
      if (!src) { return; }
      var rec = null;
      DAY_KEYS.forEach(function (k) {
        if (!(k in src)) { return; }
        if (k === 'note') {
          if (String(src[k] || '') !== String(bd[k] || '')) { rec = rec || {}; rec[k] = String(src[k] || ''); }
          return;
        }
        if (num(src[k]) !== num(bd[k])) { rec = rec || {}; rec[k] = num(src[k]); }
      });
      if (rec) { ov.days[bd.date] = rec; }
    });

    if (bizMap) {
      for (var bk in BASE.biz) {
        if (bizMap[bk] === undefined) { continue; }
        if (num(bizMap[bk]) !== num(BASE.biz[bk])) { ov.biz[bk] = num(bizMap[bk]); }
      }
    }
    if (weeksMap) {
      BASE.weeks.forEach(function (bw) {
        var v = weeksMap[bw.idx];
        if (v === undefined) { return; }
        if (num(v) !== num(bw.target)) { ov.weeks[bw.idx] = num(v); }
      });
    }
    return ov;
  }

  /* --------------------------------------------------------------- 业务指标 */

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

  /**
   * 全量结果。**只有一份日集合**：种子的 30 天（覆盖层已并回）。
   *
   * v1.1 这里分了两路：hist（历史样本）与 local（本机新增日期），
   * 周聚合 / 漏斗 / 连续打卡全部只读 hist。当时那样做有个前提 ——
   * 历史样本是一段与「今天」不相交的过去。v1.2 窗口起点就是今天，
   * 两路合流的后果立刻暴露：打卡写进 local，而总分读 hist，
   * 于是「打卡保存成功、累计总分不动」。两份数据、两条读路径，
   * 是这类缺陷的温床；既然窗口固定为 30 天，日集合本就该只有一份。
   */
  function computeAll() {
    var days = (SEED.days || []).slice();
    var agg = aggregate(days);
    return {
      days: days,
      agg: agg,
      weeks: weekRows(days),
      funnel: funnelOf(agg),
      targetRatio: targetRatio(),
      streakEnd: streakEndingAt(days),
      streakLongest: longestStreak(days),
      biz: bizMetrics()
    };
  }

  /* ------------------------------------------------------------------ 导出 */

  global.ACT = {
    SEED: SEED,
    BASE: BASE,
    RULES: RULES,
    UNSCORED: UNSCORED,
    TARGETS: TARGETS,
    dayScore: dayScore,
    aggregate: aggregate,
    weekRows: weekRows,
    funnelOf: funnelOf,
    targetRatio: targetRatio,
    streakEndingAt: streakEndingAt,
    longestStreak: longestStreak,
    computeAll: computeAll,
    bizMetrics: bizMetrics,
    /* 存储层：单一存储 + 单一路径，两个写入口（saveDay / commit）都在这层 */
    inWindow: inWindow,
    readOverlay: readOverlay,
    writeOverlay: writeOverlay,
    overlaySize: overlaySize,
    applyOverlay: applyOverlay,
    commit: commit,
    saveDay: saveDay,
    diffOverlay: diffOverlay,
    LS_DATA: LS_DATA,
    LS_THEME: LS_THEME,
    /* 身份层：与活动量数据**完全独立**的一份存储（另一个键、另一条读写路径）。
       放在 core 的理由与 overlay 相同 —— 它是唯一口径的一部分：
       应用层只该「读出来刷到 DOM」或「调 patch 改值」，不该自己碰 localStorage。 */
    LS_ID: LS_ID,
    ID_DEFAULT: ID_DEFAULT,
    ID_NAME_MAX: ID_NAME_MAX,
    readIdentity: readIdentity,
    writeIdentity: writeIdentity,
    patchIdentity: patchIdentity,
    isInlineImage: isInlineImage,
    helpers: { parseDay: parseDay, isoOf: isoOf, daysFromToday: daysFromToday, round: round, num: num }
  };
})(typeof window !== 'undefined' ? window : globalThis);
