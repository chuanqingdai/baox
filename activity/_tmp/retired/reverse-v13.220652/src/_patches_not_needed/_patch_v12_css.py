#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 改造 · panel.css（专有组件层）。

四件事：
  ① 删掉「源表口径校验」的样式（.audit* / 窄屏两行）—— 死 CSS 是有害的：
     它会让下一个人以为「这个组件还在，只是没渲染」。
  ② 今日打卡计分项从 11 → 12，`.ck-grid` 的分列说明连同注释一起更正。
  ③ 新增两处样式：窗口外提示（#todayHint）、抽屉里的只读派生值（.set-ro）。
  ④ 把注释里残留的旧文案（「文章|视频」「月目标 / MDRT 结余」）改成当下的。
"""
import io
import os
import re
import sys

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'panel.css')
src = io.open(P, encoding='utf-8').read()
orig_len = len(src)
STEPS = []


def sub(label, old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('!! [%s] 期望命中 %d 次，实际 %d 次：\n%s' % (label, count, n, old[:240]))
    src = src.replace(old, new, count)
    STEPS.append(label)


# ── ① 删「源表口径校验」样式 ────────────────────────────────────────────
AUDIT = '''/* ---------------------------------------------------------------------------
   ⑧ 源表口径校验
   --------------------------------------------------------------------------- */
.audit{display:flex;flex-direction:column;gap:10px;}
.audit-row{
  display:grid;grid-template-columns:112px 1fr auto;align-items:center;gap:12px;
  background:var(--ck-bg);border:1px solid var(--border);border-radius:5px;padding:11px 13px;
  min-width:0;
}
.audit-k{font-size:11.5px;color:var(--dim);}
.audit-v{font-size:12px;color:var(--sub);min-width:0;line-height:1.5;}
.audit-v b{color:var(--text);font-variant-numeric:tabular-nums;}
.audit-v .old{color:var(--bad-fg);font-variant-numeric:tabular-nums;}
.audit-v .new{color:var(--ok-fg);font-weight:700;font-variant-numeric:tabular-nums;}
.audit-why{font-size:10.5px;color:var(--dim);margin-top:3px;}

'''
NEW_AUDIT = '''/* ---------------------------------------------------------------------------
   ⑧ 窗口外提示（#todayHint）与抽屉只读派生值（.set-ro）
   ---------------------------------------------------------------------------
   原 ⑧ 是「源表口径校验」的样式，随该模块一并删除。**删样式不是收尾小事**：
   留着 .audit-row 这类规则，下一个人会以为组件还在、只是没渲染，
   然后再去 app.js 里找那个已经不存在的 renderAudit。
   --------------------------------------------------------------------------- */
.today-out{
  margin-bottom:16px;padding:11px 14px;border-radius:5px;
  background:var(--warn-bg);border:1px solid var(--warn-bd);color:var(--warn-fg);
  font-size:12px;line-height:1.6;
}
.today-out b{color:var(--text);font-variant-numeric:tabular-nums;}

/* 只读派生值（累计活动量总分 / 季度目标完成率）：
   与可编辑的 .set-input 用同一尺寸与对齐，但底色与描边换成金色 ——
   差别必须一眼可见，否则用户会去点它，然后以为「输入框坏了」。 */
.set-ro{
  width:136px;flex-shrink:0;padding:7px 11px;border-radius:9px;
  background:var(--hl-bg);border:1px solid var(--gold-rgba);
  color:var(--gold1);font-size:12.5px;font-weight:700;
  text-align:right;font-variant-numeric:tabular-nums;
}

'''
sub('删源表口径校验样式并新增两处', AUDIT, NEW_AUDIT)

sub('删窄屏 audit-row 覆写',
    '''  .audit-row{grid-template-columns:1fr;gap:6px;align-items:flex-start;}
  .audit-row>.bd{justify-self:start;}
''', '')

# ── ② 计分项分列说明（11 → 12）───────────────────────────────────────────
sub('计分项分列注释',
    '''   原为 repeat(2,1fr)，嵌在 1fr : 1.55fr 双栏的左半。
   改通栏后必须同步加列：不加列会让 11 个计分项变成两列超宽卡片，
   信息密度反而下降 —— 通栏的收益会被「格子被拉宽」吃掉。
   11 是质数，无论几列都会剩 1 个尾格，这是网格的常态，不算留白。''',
    '''   原为 repeat(2,1fr)，嵌在 1fr : 1.55fr 双栏的左半。
   改通栏后必须同步加列：不加列会让 12 个计分项变成两列超宽卡片，
   信息密度反而下降 —— 通栏的收益会被「格子被拉宽」吃掉。
   12 在四个断点上都能整除（6 / 4 / 3 / 2 列），四档全部排满、无尾格，
   这是 v1.2 把「文章/视频」拆成两项之后顺带得到的好处：
   v1.1 的 11 项是质数，每档都会剩下一个孤格。''')

# ── ③ 注释里的旧文案 ────────────────────────────────────────────────────
sub('构成横条注释',
    '把「名称」列加宽到 200px（容纳「文章|视频」这类\n   较长项名而不省略）',
    '把「名称」列加宽到 200px（容纳「视频号/抖音」这类\n   较长项名而不省略）')
sub('set-input 注释',
    '/* 标量目标参数（月目标 / 周目标 / MDRT 结余）沿用同一套反馈语言。',
    '/* 抽屉里的数值输入（业务指标六项 / 各周目标）沿用同一套反馈语言。')

# ── 自检 ────────────────────────────────────────────────────────────────
probe = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
GONE = ['audit', 'MDRT', 'mdrt', '月目标', '源表', '源模板', '文章|视频', '11 个计分项']
NEED = ['.today-out{', '.set-ro{', '.ck-grid{display:grid', '--warn-bg)', '--hl-bg)']
bad = []
for t in GONE:
    if t in probe:
        bad.append('旧内容未清: %s（%d 处）' % (t, probe.count(t)))
for t in NEED:
    if t not in src:
        bad.append('缺少: %s' % t)
if bad:
    print('!! 自检失败：')
    for b in bad:
        print('   -', b)
    sys.exit(1)

io.open(P, 'w', encoding='utf-8').write(src)
print('panel.css: %d → %d 字符' % (orig_len, len(src)))
for s in STEPS:
    print('  ✅', s)
print('   ✅ 自检：%d 项旧内容已清 / %d 项新样式在场' % (len(GONE), len(NEED)))
