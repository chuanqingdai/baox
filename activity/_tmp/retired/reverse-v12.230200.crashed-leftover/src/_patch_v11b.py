#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""门禁同步：build.py 的 MUST/MUST_NOT 清单 + probe-interactions.cjs 新增第 ⑤ 节。

原则（本项目沿用）：
  · 每项必须双向断言 —— 把条目从「必须在场」删掉，等于**放弃断言**，
    而不是「断言它没回来」。所以 v1.1 删掉的三块内容必须显式进 MUST_NOT。
  · 断言要落在被测对象上。判据一律带引号（id="xxx"），不用裸标识符：
    「weekStrip」这种裸串会命中注释、命中 CSS 类名，判定随即失真。
"""
import io
import sys

BUILD = '/Users/jaydenkong/Desktop/活动量/src/build.py'
PROBE = '/Users/jaydenkong/Desktop/活动量/src/probe-interactions.cjs'


# ────────────────────────────────────────────── build.py 替换项 ──
BUILD_REPL = [
    # A. 今日打卡 / 周维度
    ("""        # ── 今日打卡 ──
        '计分网格': 'id="checkGrid"',
        '今日得分条': 'id="wkScoreVal"',
        '今日保费条': 'id="wkPremVal"',
        '保存按钮': 'id="btnSaveToday"',
        '沿用昨日按钮': 'id="btnCopyYest"',
        '保存提示': 'id="saveHint"',
        # ── 周进度 ──
        '本周逐日格': 'id="weekStrip"',
        '周汇总表体': 'id="wkBody"',
        '周次筛选条': 'id="weekChips"',
        '导航今日徽标': 'id="nbToday"',
""",
     """        # ── 今日打卡 ──
        '计分网格': 'id="checkGrid"',
        '今日得分条': 'id="wkScoreVal"',
        '今日保费条': 'id="wkPremVal"',
        '本周保费目标标签': 'id="wkPremTgt"',
        '保存按钮': 'id="btnSaveToday"',
        '沿用昨日按钮': 'id="btnCopyYest"',
        '保存提示': 'id="saveHint"',
        # ── 周维度（v1.1 只保留这三项）────────────────────────────────────
        # 周进度区块本体（#weekStrip 逐日条 / #wkBody 周汇总表 / #wScore 四卡）
        # 已按用户裁定移除。以下三项**必须留着**：它们是「周」这个维度还活着的
        # 证据 —— 源模板的 O/P/Q/S 列纵向合并块本来就是按周切分的，
        # 三项若一并删掉，页面上就再也看不到「周」，等于丢掉源表骨架。
        # 判据一律带引号（id="xxx"）：裸标识符 weekStrip 会命中 app.js 里的
        # 墓碑注释与「已移除」说明文字，于是「必须缺席」判在注释上，
        # 正确的删除反被自己的说明文字判成违规（本项目真实踩过一次）。
        '周次筛选条': 'id="weekChips"',
        '导航今日徽标': 'id="nbToday"',
"""),

    # B. 导出按钮 → 设置数据
    ("""        '导出按钮': 'id="btnExport"',
        # ── 源表口径校验（本页最有价值的披露）──
        '口径校验（总览）': 'id="auditBox"',
        '口径校验（明细）': 'id="auditFull"',
        '计分说明原文': 'id="rulesText"',
        '计分项表体': 'id="rulesTbody"',
""",
     """        # ── 设置数据（顶栏按钮 → 抽屉全量编辑）──
        '设置数据按钮': 'id="btnSettings"',
        '设置抽屉': 'id="setDrawer"',
        '设置抽屉内容': 'id="setBody"',
        '设置保存按钮': 'id="btnSetSave"',
        '恢复源模板按钮': 'id="btnRestore"',
        '逐日数据网格': 'class="dg-tb"',
        '设置数据模块': 'function buildSettings',
        '抽屉内重算预演': 'function refreshSettings',
        # ── 源表口径校验（只留总览摘要）────────────────────────────────────
        # v1.1 按用户裁定删掉「逐列对照」证据表（#auditFull / rules-tb col-tb）：
        # 页面不再逐格披露源表公式缺陷。
        # ⚠️ 删的是**展示**，不是**口径**：src/core.js 的 sourceComparison().columns
        #    仍在场，并仍由 verify-runtime.cjs 第 ⑦ 关逐列比对判定标签（三分支
        #    一致 / 截断 / 未纳入）。这里若把「源表口径对照」一并拿掉，
        #    整条口径证明链就断了 —— 页面变干净，代价是再也没人守着这件事。
        '口径校验（总览）': 'id="auditBox"',
"""),

    # C. 数据与计算层
    ("""        '源表口径对照': 'function sourceComparison',
        '逐列对照判定': 'verdict:',
        '逐列对照表': 'class="rules-tb col-tb',
        '静默破坏防护': 'function bindChips',
""",
     """        '源表口径对照': 'function sourceComparison',
        '基线覆盖层键': 'baox.act.data',
        '覆盖层并回种子': 'function applyOverlay',
        '覆盖层差异收敛': 'function diffOverlay',
        '静默破坏防护': 'function bindChips',
"""),

    # D. MUST_NOT：把 v1.1 删掉的三块内容锁死
    ("""        '筛选全清按钮残留': 'resetLedger',
    }
""",
     """        '筛选全清按钮残留': 'resetLedger',
        # ── v1.1 移除的内容，必须有反向断言 ────────────────────────────────
        # 只把条目从 MUST 里删掉，等于放弃断言；下次谁把区块从别处复制回来，
        # 门禁一声不响。判据带 id=" 前缀：墓碑注释里写的是 #weekStrip 这种
        # 带井号的引用，不会误命中；而注释在 probe_html 里已被剥离。
        '周进度区块残留': 'id="weekStrip"',
        '周汇总表残留': 'id="wkBody"',
        '计分说明表残留': 'id="rulesTbody"',
        '计分说明原文残留': 'id="rulesText"',
        '逐列对照表残留': 'id="auditFull"',
        '导出CSV残留': 'exportCSV',
    }
"""),
]


# ────────────────────────────────────── probe-interactions.cjs ──
PROBE_DOC_OLD = r"""   ③ 「今日打卡」步进器 → 保存 → 存档落盘 → 减回去能清空
      这是全页唯一的写路径。它的失败模式是「看着保存了、刷新就没了」，
      或者「减到 0 却留着一条空记录污染样本」。
"""

PROBE_DOC_NEW = PROBE_DOC_OLD + r"""
   ④ 「设置数据」抽屉改一格 → 保存 → 面板联动 → 恢复源模板
      这是全页第二条写路径，也是唯一会**整体改口径**的一条。失败模式分三层，
      而且每层都能单独成立 —— 所以判据必须逐层取证，不能只测「能不能保存」：
        a. 抽屉里预演正确、页面数字不动（覆盖层没并回种子，或 boot 顺序反了）；
        b. 落盘了，但把 30 天整表写进覆盖层（覆盖层退化成快照，基线一变就错位）；
        c. 「恢复源模板」单点即执行 —— 点错一次数据全没，而画面只是数字变小。
      故本节断言：覆盖层只含**改过的那一天** · 面板四组指标按预期联动 ·
      恢复需要两次点击且第一次不构成破坏性操作。
"""


PROBE5 = r"""  /* ---------- ⑤ 设置数据 · 编辑 → 应用 → 面板联动 → 撤销回源模板 ---------- */
  console.log('\n⑤ 设置数据 · 改一格 → 保存并应用 → 面板联动 → 两次点击恢复源模板');
  const snap = () => p.evaluate(() => {
    const s = window.__ACT_SNAPSHOT__();
    return { score: s.score, premium: s.premium, monthRate: s.monthRate, mdrt: s.mdrt };
  });
  const base0 = await snap();
  ok(stBase.score === 454, '初始累计总分 = 源模板权威值 454，实为 ' + stBase.score);

  ok(await click('#btnSettings'), '点顶栏「设置数据」按钮');
  await sleep(360);
  const stDg = await p.evaluate(() => {
    const d = document.getElementById('setDrawer');
    return {
      open: d.classList.contains('open'),
      rows: document.querySelectorAll('#setBody .dg-tb tbody tr').length,
      cols: document.querySelectorAll('#setBody .dg-tb thead th').length,
      cells: document.querySelectorAll('#setBody .dg-in').length,
      tgt: document.querySelectorAll('#setBody .set-input').length,
      foot: document.querySelectorAll('#setBody .dg-tb tfoot td').length,
      stickyH: document.querySelector('#setBody .dg-tb thead th').getBoundingClientRect().width
    };
  });
  ok(stDg.open, '抽屉已打开（#setDrawer.open）');
  ok(stDg.rows === 30, '逐日数据 30 行（= 权威 30 天），实为 ' + stDg.rows);
  ok(stDg.cols === 15, '表头 15 列（日期 + 12 项 + 当日保费 + 得分），实为 ' + stDg.cols);
  ok(stDg.cells === 390, '可编辑格子 30 × 13 = 390 个，实为 ' + stDg.cells);
  ok(stDg.tgt === 8, '目标参数输入 8 个（3 标量 + 5 周目标），实为 ' + stDg.tgt);
  ok(stDg.foot === 15, '吸底合计行 15 格，实为 ' + stDg.foot);
  ok(stDg.stickyH > 0, '表头可见（未因 sticky + 零宽而塌陷）');

  /* 改三处：第 1 天「朋友圈」1→11（+10 分）、当日保费 0→10000、月目标 70000→140000。
     三处分别打在「计分项 / 保费 / 目标参数」三条不同的传导链上，只改一格测不出
     目标参数是否也会联动。 */
  await p.evaluate(() => {
    const set = (sel, v) => {
      const e = document.querySelector(sel);
      e.value = String(v);
      e.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('#setBody .dg-in[data-d="2022-05-26"][data-k="circle"]', 11);
    set('#setBody .dg-in[data-d="2022-05-26"][data-k="premium"]', 10000);
    set('#st-month', 140000);
  });
  await sleep(460);

  const stDirty = await p.$$eval('#setBody [data-dirty="1"]', e => e.length);
  ok(stDirty === 3, '3 个改动过的输入带金色描边（data-dirty=1），实为 ' + stDirty);
  const stFtScore = await p.$eval('#setBody .dg-tb tfoot td[data-ft="score"]', e => e.textContent.trim());
  ok(stFtScore === '464', '抽屉内吸底合计行实时重算 = 454+10 = 464，实为 ' + stFtScore);
  const stFtPrem = await p.$eval('#setBody .dg-tb tfoot td[data-ft="premium"]', e => e.textContent.trim());
  ok(/98,476/.test(stFtPrem), '抽屉内保费合计 = 88,476+10,000 = ¥98,476，实为 ' + stFtPrem);

  const stPrev = await p.$eval('#setPreview', e => e.textContent.replace(/\s+/g, ' ').trim());
  ok(/464/.test(stPrev), '预演总分含 464 —— ' + stPrev.slice(0, 150));
  ok(/98,476/.test(stPrev), '预演保费含 ¥98,476');
  ok(/70\.3%/.test(stPrev), '预演月达标率按新分母 140,000 重算 = 70.3%（实测文本：' +
     (stPrev.match(/[\d.]+%/g) || []).join(' / ') + '）');

  ok(await click('#btnSetSave'), '点「保存并应用」');
  await sleep(560);
  const stAfter = await snap();
  ok(stAfter.score === 464, '面板总分联动 = 464，实为 ' + stAfter.score);
  ok(Math.abs(stAfter.premium - 98476.38) < 0.01, '面板保费联动 = ¥98,476.38，实为 ' + stAfter.premium);
  ok(Math.abs(stAfter.monthRate - 70.3) < 0.05, '面板月达标率联动 = 70.3%，实为 ' + stAfter.monthRate);
  ok(Math.abs(stAfter.mdrt - (178103 + 98476.38)) < 0.01,
     '面板 MDRT 累计联动 = ¥276,579.38，实为 ' + stAfter.mdrt);
  ok(await p.evaluate(() => !document.getElementById('setDrawer').classList.contains('open')),
     '保存后抽屉自动关闭');

  const stOvRaw = await p.evaluate(() => localStorage.getItem('baox.act.data'));
  ok(!!stOvRaw, '覆盖层已落盘 baox.act.data：' + String(stOvRaw).slice(0, 170));
  let stOv = {};
  try { stOv = JSON.parse(stOvRaw || '{}'); } catch (e) { stOv = {}; }
  ok(Object.keys(stOv.days || {}).length === 1,
     '覆盖层只存**改过的那 1 天**（30 天未改的不落盘），实为 ' +
     Object.keys(stOv.days || {}).length + ' 天');
  ok(!('circle' in ((stOv.days || {})['2022-05-27'] || {})), '未改的天里没有顺手写进去的键');
  ok((stOv.targets || {}).month === 140000, '目标参数改动单独成键（targets.month = 140000）');

  const stLed = await p.$eval('#ledgerBody tr:last-child', e => e.textContent.replace(/\s+/g, ' '));
  ok(/464/.test(stLed), '明细表合计行同步为 464 —— ' + stLed.slice(0, 80));

  /* 恢复源模板：两次点击确认。第一次点击必须**只武装、不执行** ——
     若第一次就把数据清了，那它就是一个单点触发的破坏性操作（铁律 15）。 */
  ok(await click('#btnSettings'), '重新打开设置抽屉');
  await sleep(360);
  const stR0 = await p.$eval('#btnRestore', e => ({ hidden: e.hidden, label: e.textContent.trim() }));
  ok(stR0.hidden === false, '有改动时「恢复源模板数据」按钮可见（' + stR0.label + '）');
  await click('#btnRestore');
  await sleep(200);
  const stR1 = await p.$eval('#btnRestore', e => ({ armed: e.getAttribute('data-armed'),
                                                    label: e.textContent.trim() }));
  ok(stR1.armed === '1', '第一次点击只武装（label 变为「' + stR1.label + '」）');
  ok(await p.evaluate(() => !!localStorage.getItem('baox.act.data')),
     '第一次点击后覆盖层仍在 —— 单点不构成破坏性操作');
  ok((await snap()).score === 464, '第一次点击后面板数据未变（仍为 464）');

  await click('#btnRestore');
  await sleep(560);
  const stBack = await snap();
  ok(stBack.score === 454, '第二次点击后总分回到源模板 454，实为 ' + stBack.score);
  ok(Math.abs(stBack.premium - stBase.premium) < 0.01, '保费回到 ' + stBase.premium);
  ok(Math.abs(stBack.monthRate - stBase.monthRate) < 0.05, '月达标率回到 ' + stBase.monthRate + '%');
  ok(await p.evaluate(() => localStorage.getItem('baox.act.data')) === null,
     '恢复后覆盖层键被清除（空覆盖层不落盘，不留一个「看着还在、其实什么都没恢复」的空对象）');

  /* 导出载荷自检。不测下载动作本身：无痕浏览器里文件会落到临时目录，
     断言不到；而真正会错的是**载荷内容**（少一列、把 30 天写成了 12 项…）。 */
  const stExp = await p.evaluate(() => {
    const o = window.__ACT_SETTINGS__.collect();
    return { app: o.app, ver: o.version, days: o.days.length, weeks: o.weeks.length,
             month: o.targets.month,
             keys: Object.keys(o.days[0]).sort().join(',') };
  });
  ok(stExp.app === 'baox-activity' && stExp.ver === 1, '导出载荷带 app 标识与版本号（防误导入别家的 JSON）');
  ok(stExp.days === 30, '导出 30 天全量当前值，实为 ' + stExp.days);
  ok(stExp.weeks === 5 && stExp.month === 70000, '导出含目标参数（月 70000 · 5 周目标）');
  ok(stExp.keys === 'article,circle,close,date,family,friend,need,plan,premium,recJoin,recTalk,refer,service,visit',
     '导出字段 = date + 12 项活动量 + premium，实为：' + stExp.keys);

  ok(errs.length === 0, '全程无 JS 错误' + (errs.length ? '：' + errs.join(' | ') : ''));
"""


def patch(path, repls):
    src = io.open(path, encoding='utf-8').read()
    for old, new in repls:
        c = src.count(old)
        if c != 1:
            sys.exit('!! %s：锚点出现 %d 次（期望 1），不写盘\n---\n%s'
                     % (path, c, old[:200]))
        src = src.replace(old, new)
    io.open(path, 'w', encoding='utf-8').write(src)
    print('✅ %s 已更新' % path)


def main():
    patch(BUILD, BUILD_REPL)

    # 探针：文档注释 + 新增 ⑤ 节 + 收尾文案
    doc_old = PROBE_DOC_OLD
    tail_old = "  ok(errs.length === 0, '全程无 JS 错误' + (errs.length ? '：' + errs.join(' | ') : ''));\n"
    sum_old = r"  console.log('\n🎉 交互实测通过：冷启动锚点 / 撤销式筛选 / 无破坏性按钮 / 打卡写路径');"
    sum_new = (r"  console.log('\n🎉 交互实测通过：冷启动锚点 / 撤销式筛选 / 无破坏性按钮 / "
               r"打卡写路径 / 设置数据可编辑且可撤销');")
    patch(PROBE, [
        (doc_old, PROBE_DOC_NEW),
        (tail_old, PROBE5),
        (sum_old, sum_new),
    ])

    # 回查：落地文本必须与预期一致
    b = io.open(BUILD, encoding='utf-8').read()
    p = io.open(PROBE, encoding='utf-8').read()
    for s, why in [
        ("'设置数据按钮': 'id=\"btnSettings\"'", 'build.py 新增加'),
        ("'周进度区块残留': 'id=\"weekStrip\"'", 'build.py 反向断言'),
        ("'基线覆盖层键': 'baox.act.data'", 'build.py 覆盖层'),
    ]:
        if s not in b:
            sys.exit('!! build.py 回查失败：%s' % why)
    for s, why in [
        ('⑤ 设置数据 · 改一格', 'probe 第 ⑤ 节'),
        ("stR1.armed === '1'", 'probe 二次确认判据'),
        ('覆盖层只存**改过的那 1 天**', 'probe 覆盖层粒度判据'),
    ]:
        if s not in p:
            sys.exit('!! probe 回查失败：%s' % why)
    n_must = b.count("': '") + b.count("': r'")
    print('✅ 回查通过（build.py 断言条目约 %d 条 / probe 新增 %d 行）'
          % (n_must, len(PROBE5.split('\n'))))


if __name__ == '__main__':
    main()
