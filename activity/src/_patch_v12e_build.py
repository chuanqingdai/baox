#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2e 补丁 · 「去注释」要**按语言分段**剥，不能拿一把正则刷全篇

由来（v1.2 身份功能落地时，构建第一次跑就炸）：

    !! 内容断言失败:
         - 缺少 轻提示（id="toast"）

  而 `id="toast"` 在 body.html:365 与产物 index.html 里**都在场**。

根因（已复现、已定位到字符）：

  产物 HTML 区里有**真代码**（不是注释、不是笔误）：

      body.html:363  <input type="file" id="avatarFile" accept="image/*" hidden>
      body.html:360  <!-- 头像选择的文件框。刻意**不做** accept="image/*" 之外的格式限制， -->

  这一对 `/*` 在 HTML 里是**合法字面量**（MIME 通配），它没有配对的 `*/`。
  于是 v1.2d 的「全局剥 /* */」从第 120308 字符开始一路吃到第 120582 字符，
  直到 data.js 里某段块注释的结尾才收住 —— 被吞掉 274 个字符，
  里面正好有 `<div id="toast"></div>` 与 `<input id="avatarFile" …>`。

  所以判据「id=\"toast\" 必须在场」判在探针上就成了**假的缺失**；
  而判据本身没错、`id` 也真的在场 —— 错的是**探针不是产物的忠实去注释版**。

这一条比前一版（v1.2d 漏剥 HTML 注释）更值得记住，因为它是**换了个方向**的同一个病：

  · v1.2d 的病：**漏剥一种语法** → 注释替真代码背书 → 假绿；
  · v1.2e 的病：**多剥了不属于本语言的东西** → 真代码被注释规则吃掉 → 假红。

两者共同的根：**剥的时候不知道自己在哪段语言里**。
一句可复用的判据：**「去注释」不是三次 re.sub，而是「按语言分区、各剥各的」。**

修法（本补丁）：

  按 `<style>…</style>` / `<script>…</script>` 把产物切开，
  段内只剥该段语言的注释，段外（HTML 标记）只剥 `<!-- -->`、**绝不碰 `/* */`**。

  为什么不能在 HTML 区顺带剥 `/* */`：如上，HTML 里 `/*` 是合法字面量。
  同理，段内剥也**不能**反过来顺便剥 `<!-- -->` ——
  CSS 里 `<!--` 是历史遗留的兼容写法、JS 字符串里更可能是内容。

附带：新增一条 MUST_RE，把 `accept="image/*"` 这个字面量钉死。
  它同时干两件事：① 断言头像文件框在场且只收图片；
  ② 让「谁把探针写回全局剥离」这件事**必然会红灯**（该串会被吃掉 → 判据不命中）。
  即：把本次的 bug 变成下一次的**回归测试**。

影响面已逐点核过（probe_html 的全部消费者）：
  · MUST / MUST_NOT / MUST_RE  —— 正是要修的对象；
  · fi_gate_violations(probe_html) —— 分段后 CSS 段剥离结果与全局一致；
  · threshold 校验、data-theme 挂载点计数 —— 判在 JS / HTML 段，只会更准；
  · 门禁 A-3 跨文件一致性 —— 读的是源文件，不经 probe。
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'build.py')

OLD = """    probe_html = re.sub(r'/\\*.*?\\*/', '', html, flags=re.S)
    probe_html = re.sub(r'<!--.*?-->', '', probe_html, flags=re.S)
    probe_html = re.sub(r'^\\s*//.*$', '', probe_html, flags=re.M)"""

NEW = """    # ⚠️ v1.2e：只是「三种语法各剥一次」还不够 —— **要按语言分段剥**。
    #    拿同一把正则往整篇产物上刷，会在语言边界处误配。实测踩到的坑：
    #      产物 HTML 区里有**真代码** accept="image/*"（头像文件框），
    #      这一对 /* 在 HTML 里是合法字面量、没有配对的 */，于是它一路吃到
    #      data.js 某段块注释的结尾，吞掉 274 字符 —— 含 <div id="toast">。
    #      断言 `id="toast"` 因此报「缺少」，而它在 body.html 与产物里都在场。
    #    病根不是「漏剥一种语法」（v1.2d 那个），而是**多剥了别的语言的东西**；
    #    两者共同的根是：剥的时候不知道自己在哪段语言里。
    #    故：段内只剥本语言的注释，段外（HTML 标记）只剥 <!-- -->、不碰 /* */。
    def _strip_block(s):
        return re.sub(r'/\\*.*?\\*/', '', s, flags=re.S)

    def _strip_js(s):
        return re.sub(r'^\\s*//.*$', '', _strip_block(s), flags=re.M)

    def _strip_markup(s):
        # HTML 标记段只剥 HTML 注释：`/*` 在这里是合法字面量（accept="image/*"），
        # 把它当注释起点就会吃掉后面的真代码。
        return re.sub(r'<!--.*?-->', '', s, flags=re.S)

    def probe_of(doc):
        \"\"\"按语言分段去注释；返回与 doc 同构、仅注释被移除的探针文本。\"\"\"
        out, i = [], 0
        for m in re.finditer(r'<(style|script)\\b[^>]*>(.*?)</\\1>', doc,
                             flags=re.S | re.I):
            out.append(_strip_markup(doc[i:m.start()]))
            out.append(m.group(0)[:m.start(2) - m.start()])   # 开标签原样
            out.append(_strip_block(m.group(2)) if m.group(1).lower() == 'style'
                       else _strip_js(m.group(2)))
            out.append('</%s>' % m.group(1).lower())
            i = m.end()
        out.append(_strip_markup(doc[i:]))
        return ''.join(out)

    probe_html = probe_of(html)"""

MUST_RE_OLD = """        '基线覆盖层键': r"var\\s+LS_DATA\\s*=\\s*'baox\\.act\\.data\\.v2'",
    }"""

MUST_RE_NEW = """        '基线覆盖层键': r"var\\s+LS_DATA\\s*=\\s*'baox\\.act\\.data\\.v2'",
        # v1.2e：把 accept="image/*" 这个字面量钉死。它一次干两件事 ——
        #   ① 断言头像文件框在场，且 accept 只放图片（零外链铁律 8 的延伸：
        #      头像走 canvas 压成 dataURL，既不外链，也不该放开任意类型）；
        #   ② 它是全篇**唯一一处「无配对的 /*」**，因此是探针正确性的试纸：
        #      谁把去注释写回「全局剥 /* */」，这一串就会被吃掉 → 本判据立刻红灯。
        #      即：把本次的 bug 直接变成下一次的回归测试。
        '头像文件框 accept 字面量': r'id="avatarFile"[^>]*accept="image/\\*"',
    }"""

CHECKS = [
    ('§A 分段剥离函数在场', 'def probe_of(doc):', True),
    ('§A 探针由分段函数生成', 'probe_html = probe_of(html)', True),
    ('§A 旧的三条全局 re.sub 已移除', "probe_html = re.sub(r'/\\*.*?\\*/', '', html", False),
    ('§A HTML 标记段只剥 <!-- -->', 'def _strip_markup(s):', True),
    ('§B accept 字面量判据在场', 'id="avatarFile"[^>]*accept="image/\\*"', True),
]


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


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
        ('§A 需要替换的三条全局剥离', OLD),
        ('§B MUST_RE 的收尾锚点', MUST_RE_OLD),
        ('§A 之后紧跟的 MUST 判定', '        if need not in probe_html:'),
    ]
    for label, needle in pre:
        if needle not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, needle[:110]))

    assert src.count(OLD) == 1, '§A 命中数不是 1（实测 %d）' % src.count(OLD)
    src = src.replace(OLD, NEW, 1)

    assert src.count(MUST_RE_OLD) == 1, '§B 命中数不是 1（实测 %d）' % src.count(MUST_RE_OLD)
    src = src.replace(MUST_RE_OLD, MUST_RE_NEW, 1)
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
    print('自检通过：%d 项 —— 探针改为按 <style>/<script> 分段剥离，'
          'HTML 标记段不再碰 /* */' % len(CHECKS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
