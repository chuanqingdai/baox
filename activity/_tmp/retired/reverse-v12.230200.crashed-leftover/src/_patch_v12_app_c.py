#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 改造 · app.js（收尾）：清掉设置抽屉里对「源表列」的悬空引用。

为什么单独一个小脚本而不是塞回 a/b：
  a、b 都已经跑过、且各自断言的是**它们执行前**的文本；往里追加步骤会让
  那两个脚本从此不可重放（重放必然在第一步就命中 0 次）。收尾改动另起一个
  脚本，保证「谁改的、改前是什么、怎么验证」三段齐全。

这一处是什么：设置抽屉里逐日网格的列头 tooltip 写着
  「公众号（源表列 A）· 1 分 / 次」
而「源表口径校验」模块已按指令整体移除，面板从此不再与源表有任何比对关系。
留着一个指向已删除模块的列号，与 core.js 里清掉漏斗 F35/F36/F37 的理由同类：
**它不会报错，只是让后来者以为这件事还有人守着。**
（种子里的 col 字段保留 —— 那是数据来源的痕迹，不属于面板展示内容。）
"""
import io
import os
import sys

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.js')
src = io.open(P, encoding='utf-8').read()
orig_len = len(src)

OLD = """        return '<th class="n" title="' + esc(r.name + '（源表列 ' + r.col + '）· ' +
          (r.pts > 0 ? r.pts + ' 分 / 次' : '不计分')) + '">' + esc(r.name) + '</th>';"""
NEW = """        return '<th class="n" title="' + esc(r.name + '（' +
          (r.pts > 0 ? r.pts + ' 分 / 次' : '不计分')) + '）">' + esc(r.name) + '</th>';"""

n = src.count(OLD)
if n != 1:
    sys.exit('!! 期望命中 1 次，实际 %d 次' % n)
src = src.replace(OLD, NEW, 1)

if '源表列' in src:
    sys.exit('!! 仍有「源表列」字样残留')
# 旧文案确实没了、新文案确实在（判在原文上即可：这里没有墓碑注释会毒化判定）
if '（' not in NEW or '分 / 次' not in NEW:
    sys.exit('!! 新文案结构不对')

io.open(P, 'w', encoding='utf-8').write(src)
print('app.js（收尾）: %d → %d 字符' % (orig_len, len(src)))
print('  ✅ 设置抽屉列头 tooltip 去掉「源表列」悬空引用')
print('  ✅ 自检：源表列 0 处 / 分值说明在场')
