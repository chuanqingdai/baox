#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2d 补丁 · 「去注释」要把三种注释语法都剥掉

由来（反例验证 B 例抓到，是 v1.2b 那次修复的**遗漏**）：

  v1.2b 把断言从「判未去注释的 html」改成「判 probe_html（去注释）」，
  当时 `probe_html` 只剥一种注释：`/* */`（CSS / JS 块注释）。

  而产物里混着**三种**注释语法。漏掉的那两种里，HTML 注释立刻被反例抓到：

    body.html:128  <!-- g-self-top：列表按自身内容收住（见 panel.css ⓪b-2）。 -->

  于是把真代码 `<div class="panel g-self-top">` 里的类**删掉**、
  连 panel.css 的 `.g-self-top{align-self:start;}` 一起删掉，
  产物里只剩那条 HTML 注释提到 g-self-top —— MUST_RE `\\bg-self-top\\b`
  照样命中，构建**全绿**。

  同一个假绿，只是换了注释语法。教训写成一句：
  **「去注释」不是一个动作，而是一组动作 —— 该语言有几种注释形态，
  就要剥几次；少剥一种 = 留一扇假绿的后门。**

本次修一处（probe_html 的定义），影响面已逐点核过：
  · 443/446/449  MUST / MUST_NOT / MUST_RE  —— 正是要修的对象
  · 469           fi_gate_violations()      —— 剥 HTML 注释只会减少假阳性
  · 481           threshold 校验            —— 同上
  · 509           data-theme 挂载点计数      —— 注释里的挂载点本就不该计数
  改前全量体检：剥三种后 68 项 MUST 里「仅在注释里在场」**0 项**、
  MUST_NOT 假红 **0 项**，故改判不会把本来正确的构建变红。

`//` 只剥**整行**（沿用本项目 js_probe 的既有做法），不剥行内的 ——
产物里有 `https://` 这类序列，行内剥会误伤。
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'build.py')


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


CHECKS = [
    ('§G 剥 CSS/JS 块注释', "probe_html = re.sub(r'/\\*.*?\\*/', '', html, flags=re.S)", True),
    ('§G 剥 HTML 注释', "probe_html = re.sub(r'<!--.*?-->', '', probe_html, flags=re.S)", True),
    ('§G 剥整行 JS 行注释', "probe_html = re.sub(r'^\\s*//.*$', '', probe_html, flags=re.M)", True),
]


def selfcheck(text):
    bad = []
    for label, needle, want in CHECKS:
        got = needle in text
        if got != want:
            bad.append('%s：期望%s，实测%s'
                       % (label, '在场' if want else '缺席', '在场' if got else '缺席'))
    return bad


def patch(src):
    pre = [
        ("probe_html 的定义处",
         "    probe_html = re.sub(r'/\\*.*?\\*/', '', html, flags=re.S)"),
        ("probe_html 之后紧跟的 MUST 判定",
         "        if need not in probe_html:"),
    ]
    for label, needle in pre:
        if needle not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, needle[:90]))

    old = """    probe_html = re.sub(r'/\\*.*?\\*/', '', html, flags=re.S)"""
    new = """    # 「去注释」不是一个动作，而是一组动作 —— 产物里混着三种注释语法，
    # 每种各要剥一次；漏一种就等于留了一扇假绿的后门：
    #   /* */     CSS / JS 块注释
    #   <!-- -->  HTML 注释
    #   整行 //   JS 行注释（只剥整行，避免误伤 https:// 这类行内序列）
    # 实测（v1.2d，由反例 B 抓到）：上一版只剥了 /* */，于是 body.html 里
    # `<!-- g-self-top：列表按自身内容收住 -->` 一直在替真代码背书 ——
    # 把 <div class="panel g-self-top"> 的类真删掉，MUST_RE 照样通过。
    # 改前全量体检：剥三种后 68 项 MUST「仅在注释里在场」0 项、
    # MUST_NOT 假红 0 项，故改判不会把本来正确的构建变红。
    probe_html = re.sub(r'/\\*.*?\\*/', '', html, flags=re.S)
    probe_html = re.sub(r'<!--.*?-->', '', probe_html, flags=re.S)
    probe_html = re.sub(r'^\\s*//.*$', '', probe_html, flags=re.M)"""
    assert src.count(old) == 1, '§G 命中数不是 1'
    src = src.replace(old, new, 1)
    return src


def main():
    verify_only = '--verify-only' in sys.argv
    src = rd(P)
    orig_len = len(src)

    if verify_only:
        print('— 只回查，不改文件 —')
    else:
        src = patch(src)
        wr(P, src)

    back = rd(P)
    bad = selfcheck(back)
    if bad:
        print('!! 自检失败')
        for b in bad:
            print('   - ' + b)
        return 1

    print('build.py: %d → %d 字符' % (orig_len, len(back)))
    print('自检通过：%d 项 —— 三种注释形态（/* */ · <!-- --> · 整行 //）全部剥离'
          % len(CHECKS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
