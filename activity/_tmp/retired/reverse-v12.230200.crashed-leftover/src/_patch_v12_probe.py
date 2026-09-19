#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 补丁 · src/probe-interactions.cjs（⑤ 节件均口径）

背景（首跑实测的两条红）：
  ❌ 预演件均按新分母重算 = ¥10,000 ÷ 2 单 = ¥5,000     （实测 ¥0 → ¥0）
  ❌ 面板件均联动 = ¥5,000                              （实测 0）

我原来的假设错了：以为把业务指标 quarterDeals 填成 2 就会让件均变成
¥10,000 ÷ 2。实际上「件均」走的是另一条链 ——

    A. 日记录口径：每天的 close（促成签单）计分项次数
       → A.aggregate(list).closeCount → perDeal = premium / closeCount
    B. 业务指标口径：抽屉里手填的 quarterDeals（季度成交单数）
       → 只喂 kQuarterDeals 那张卡，不参与 aggregate

两者同名不同源，是**设计如此**（6 项业务指标是独立手填的季度视角，
日记录是活动量视角）。所以件均要联动，必须改**日记录里的 close**。

修法顺手做了一件事：让两条口径取**不同的数值**（日记录 close=4 → 件均
¥2,500；业务指标 quarterDeals=2 → 卡上「2 单」）。若两边都用 2，
即使有人把它们接成一条链、断言也照样绿 —— 数值错开才让「未串线」
成为一条真的会失败的断言。

改动清单（都落在 ⑤ 节）：
  A. 改动处数 5 → 6（新增日记录 close=4）· dirty 5 → 6
  B. 总分链期望 11 → 31（11×1 + 4×5）· 件均 5,000 → 2,500
  C. 预演文本 / 抽屉合计 / 覆盖层键数（2 → 3）逐条同步
  D. 明细摘要 11 分 → 31 分
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'probe-interactions.cjs')


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

    # ---------- A. 改动清单 + 计数 ----------
    src = sub(
        src,
        "    console.log('\\n⑤ 设置数据 · 改 5 格 → 保存并应用 → 面板联动 → 两次点击恢复初始数据');",
        "    console.log('\\n⑤ 设置数据 · 改 6 格 → 保存并应用 → 面板联动 → 两次点击恢复初始数据');",
        'A1 节标题 5 格 → 6 格')

    src = sub(
        src,
        "    /* 改 5 处，分打在三条不同的传导链上 —— 只改一格测不出后两条：\n"
        "         · 计分项 gzh 0→11        → 总分链\n"
        "         · 当日保费 0→10000       → 保费 / 件均链\n"
        "         · 季度业绩/目标/单数     → 业务指标链（含自动派生的完成率） */\n",
        "    /* 改 6 处，分打在三条不同的传导链上 —— 只改一格测不出后两条：\n"
        "         · 计分项 gzh 0→11    → 总分链\n"
        "         · 计分项 close 0→4   → **件均链**（closeCount 的口径是日记录，\n"
        "           不是业务指标 quarterDeals —— 见下方 ok() 的说明）\n"
        "         · 当日保费 0→10000   → 保费链\n"
        "         · 季度业绩/目标/单数 → 业务指标链（含自动派生的完成率） */\n",
        'A2 改动清单注释')

    src = sub(
        src,
        "      set('#setBody .dg-in[data-d=\"' + dt + '\"][data-k=\"gzh\"]', 11);\n"
        "      set('#setBody .dg-in[data-d=\"' + dt + '\"][data-k=\"premium\"]', 10000);\n",
        "      set('#setBody .dg-in[data-d=\"' + dt + '\"][data-k=\"gzh\"]', 11);\n"
        "      set('#setBody .dg-in[data-d=\"' + dt + '\"][data-k=\"close\"]', 4);\n"
        "      set('#setBody .dg-in[data-d=\"' + dt + '\"][data-k=\"premium\"]', 10000);\n",
        'A3 新增日记录 close=4')

    src = sub(
        src,
        "    ok(stDirty === 5, '5 个改动过的输入带金色描边（data-dirty=1），实为 ' + stDirty);",
        "    ok(stDirty === 6, '6 个改动过的输入带金色描边（data-dirty=1），实为 ' + stDirty);",
        'A4 dirty 计数 5 → 6')

    # ---------- B. 总分 / 件均期望值 ----------
    src = sub(
        src,
        "    ok(stFtScore === '11', '抽屉内吸底合计行实时重算 = 0+11 = 11，实为 ' + stFtScore);",
        "    ok(stFtScore === '31', '抽屉内吸底合计行实时重算 = 11×1 + 4×5 = 31，实为 ' + stFtScore);",
        'B1 抽屉合计 11 → 31')

    src = sub(
        src,
        "    ok(/总分 0 → 11/.test(stPrev), '预演总分 0 → 11 —— ' + stPrev.slice(0, 60));\n"
        "    ok(/件均 ¥0 → ¥5,000/.test(stPrev), '预演件均按新分母重算 = ¥10,000 ÷ 2 单 = ¥5,000');\n"
        "    ok(/季完成率 0\\.0% → 25\\.0%/.test(stPrev), '预演完成率 0.0% → 25.0%');\n"
        "    ok(/改动 2 处 \\/ 1 天 · 业务指标 3 项/.test(stPrev),\n"
        "       '预演改动计数分组 = 2 处 / 1 天 · 业务指标 3 项（' +\n"
        "       (stPrev.match(/改动.*$/) || [''])[0] + '）');\n",
        "    ok(/总分 0 → 31/.test(stPrev), '预演总分 0 → 31 —— ' + stPrev.slice(0, 60));\n"
        "    ok(/件均 ¥0 → ¥2,500/.test(stPrev),\n"
        "       '预演件均按**日记录 close**重算 = ¥10,000 ÷ 4 次促成签单 = ¥2,500');\n"
        "    ok(/季完成率 0\\.0% → 25\\.0%/.test(stPrev), '预演完成率 0.0% → 25.0%');\n"
        "    ok(/改动 3 处 \\/ 1 天 · 业务指标 3 项/.test(stPrev),\n"
        "       '预演改动计数分组 = 3 处 / 1 天 · 业务指标 3 项（' +\n"
        "       (stPrev.match(/改动.*$/) || [''])[0] + '）');\n",
        'B2 预演文本同步')

    src = sub(
        src,
        "    ok(stAfter.score === 11, '面板总分联动 = 11，实为 ' + stAfter.score);\n"
        "    ok(Math.abs(stAfter.premium - 10000) < 0.01, '面板保费联动 = ¥10,000，实为 ' + stAfter.premium);\n"
        "    ok(Math.abs(stAfter.perDeal - 5000) < 0.01, '面板件均联动 = ¥5,000，实为 ' + stAfter.perDeal);\n",
        "    ok(stAfter.score === 31, '面板总分联动 = 31，实为 ' + stAfter.score);\n"
        "    ok(Math.abs(stAfter.premium - 10000) < 0.01, '面板保费联动 = ¥10,000，实为 ' + stAfter.premium);\n"
        "    ok(Math.abs(stAfter.perDeal - 2500) < 0.01,\n"
        "       '面板件均联动 = ¥10,000 ÷ 4 次促成签单 = ¥2,500，实为 ' + stAfter.perDeal);\n",
        'B3 面板联动 31 / 2,500')

    src = sub(
        src,
        "    ok(k1.quarterRate === '25.0%' && k1.quarterDeals === '2 单' &&\n",
        "    /* 「成交单数」在本面板有**两套独立口径**，这里刻意让它们取不同数值：\n"
        "         · 日记录 close=4（促成签单次数）→ 累计 closeCount → 件均 ¥2,500\n"
        "         · 业务指标 quarterDeals=2（手填的季度成交单数）→ 卡上「2 单」\n"
        "       若把两者都设成 2，即便有人哪天把它们接成一条链（件均改读季度口径、\n"
        "       或反过来由日记录反推季度卡），断言照样全绿 —— 数值错开才使\n"
        "       「两条口径未串线」成为一条真的会失败的断言。 */\n"
        "    ok(k1.quarterRate === '25.0%' && k1.quarterDeals === '2 单' &&\n",
        'B4 两套成交口径的独立说明')

    # ---------- C. 覆盖层 / 摘要 ----------
    src = sub(
        src,
        "    ok(Object.keys((stOv.days || {})[TODAY] || {}).length === 2,\n"
        "       '该天只记两个改过的键（gzh / premium），实为 ' +\n"
        "       JSON.stringify(Object.keys((stOv.days || {})[TODAY] || {})));\n",
        "    ok(Object.keys((stOv.days || {})[TODAY] || {}).length === 3,\n"
        "       '该天只记三个改过的键（close / gzh / premium），实为 ' +\n"
        "       JSON.stringify(Object.keys((stOv.days || {})[TODAY] || {})));\n",
        'C1 覆盖层该天键数 2 → 3')

    src = sub(
        src,
        "    ok(/得分合计 11 分/.test(ledSum) && /保费 ¥10,000/.test(ledSum),",
        "    ok(/得分合计 31 分/.test(ledSum) && /保费 ¥10,000/.test(ledSum),",
        'C2 明细摘要 11 → 31')

    src = sub(
        src,
        "    ok((await snap()).score === 11, '第一次点击后面板数据未变（仍为 11）');",
        "    ok((await snap()).score === 31, '第一次点击后面板数据未变（仍为 31）');",
        'C3 武装后未变 11 → 31')

    if src == orig:
        sys.exit('!! 没有任何改动落地')

    io.open(P, 'w', encoding='utf-8').write(src)

    # ---------- 落地自检（判在真实文件文本上） ----------
    got = io.open(P, encoding='utf-8').read()
    NEED = ["[data-k=\"close\"]', 4", "stDirty === 6", "stFtScore === '31'",
            "件均 ¥0 → ¥2,500", "stAfter.score === 31", "perDeal - 2500",
            "length === 3", "得分合计 31 分", "改 6 格"]
    GONE = ["stDirty === 5", "=== '11'", "件均 ¥5,000", "总分 0 → 11",
            "改动 2 处", "perDeal - 5000", "得分合计 11 分", "改 5 格"]
    bad = []
    for s in NEED:
        if s not in got:
            bad.append('缺少: %s' % s)
    for s in GONE:
        if s in got:
            bad.append('未清除: %s' % s)
    if bad:
        io.open(P, 'w', encoding='utf-8').write(orig)   # fail-safe 回滚
        sys.exit('!! 自检失败（已回滚 probe）：\n     - ' + '\n     - '.join(bad))

    print('probe-interactions.cjs: %d → %d 字符' % (len(orig), len(got)))
    print('自检通过：%d 项必须在场 / %d 项必须清除' % (len(NEED), len(GONE)))


if __name__ == '__main__':
    main()
