#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2b 补丁 · 修掉门禁 A 的「必须在场」假绿

由来（本轮做反例验证时临场发现，不是脚本 bug，是**门禁本身**的假绿）：

  我为「持久化键换名」写的断言是 MUST['基线覆盖层键'] = 'baox.act.data.v2'。
  但 build.py 原来是 `if need not in html:` —— 判在**未去注释**的产物上。
  产物里 baox.act.data.v2 共出现 6 次，其中 **5 次在注释里**
  （有的是别的文件在讲「v1.1 用的是旧键」），真正生效的代码只有 1 行
  `var LS_DATA = 'baox.act.data.v2';`。

  后果：**把 LS_DATA 改回旧键，这条断言照样通过。**
  它一直在构建日志里占一行「必须在场」，实际拦不住任何东西。

这是我上一轮刚立的教训的**镜像**：
  上轮修的是「必须缺席」不能判在含注释文本上（sourceComparison 的历史陈述注释
  被误判成「改造未完成」）；
  当时只想着「注释会让缺席断言假红」，没意识到**同一件事也会让在场断言假绿**。

本次修四处：
  §A  MUST 判在 probe_html（去注释）上 —— 先全量体检过：69 项里
      「仅在注释里在场」的为 **0 项**，故改判不会把绿变红。
  §B  MUST_RE 同样改判 probe_html（三项标记类在去注释文本里都仍在场）。
  §C  '基线覆盖层键' 从 MUST 移到 MUST_RE，判**赋值语句**而非子串 ——
      位置对了还不够，还得判在对的对象上：
      只判「文中出现过这串字」时，任何人新加一句提到该键的代码都会让它复活。
  §D  新增门禁 A-3：该键在 core.js（LS_DATA）与 probe-interactions.cjs（LS_KEY）
      各写一份字面量，跨文件漂移 → 交互探针去读一个空键，而「读不到数据」
      在部分断言里长得像通过。属同一类隐患，一并加锁。

用法：
  python3 src/_patch_v12b_build.py                 # 打补丁（一次性）
  python3 src/_patch_v12b_build.py --verify-only    # 只回查落地情况，不改文件
"""
import io
import os
import re as _re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'build.py')


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


# ── 落地自检的判据表：(说明, 目标文本, 期望是否在场) ───────────────────────
# 用**显式三元组**而不是靠字符串前缀去分类。
# 这里最初写成 `c[1].startswith('§A 判 html')` —— 拿 needle 比 label 的前缀，
# 过滤条件永远为假，「必须清除」的 4 项被误放进必须在场组并全部报缺失。
# 失败原因与被修的 bug 同源：**判错对象**（铁律 10 第 ③ 类）。
CHECKS = [
    ('§A MUST 判 probe_html',
     'for label, need in MUST.items():\n        if need not in probe_html:', True),
    ('§A 旧写法（判未去注释 html）已清除',
     'if need not in html:', False),
    ('§B MUST_RE 判 probe_html',
     'if not re.search(rx, probe_html):', True),
    ('§B 旧写法（判未去注释 html）已清除',
     'if not re.search(rx, html):', False),
    ('§C 子串式存储键判据已移出 MUST',
     "'基线覆盖层键': 'baox.act.data.v2',", False),
    ('§C MUST_RE 赋值语句判据',
     r"""'基线覆盖层键': r"var\s+LS_DATA\s*=\s*'baox\.act\.data\.v2'",""", True),
    ('§D A-3 漂移判据', '存储键漂移：core.js LS_DATA=', True),
    ('§D A-3 通过分支', '存储键一致性通过', True),
    ('§D A-3 跳过分支', '存储键一致性：跳过', True),
    # 补丁**首跑**时这条抓到了真错：我照抄补丁脚本自己的 `import re as _re`，
    # 往 build.py 里写了 `_re.search` —— 而 build.py 用的是 `import re`。
    # 构建期才 NameError 炸出来（改断言不改产物，静态门禁全绿，
    # 只有真跑一遍才知道）。凡「改了使用点」就必须重跑，这条断言把
    # 「引用了未导入的名字」变成构建期可查的事实。
    ('§D 判据不得引用未导入的 _re', '_re.', False),
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
    # ── 前置条件：确认上游仍是我以为的样子 ──────────────────────────────
    pre = [
        ("MUST 判在未去注释的 html 上", 'if need not in html:'),
        ("MUST_RE 判在未去注释的 html 上", 'if not re.search(rx, html):'),
        ("基线覆盖层键 MUST 条目", "'基线覆盖层键': 'baox.act.data.v2',"),
        ("MUST_RE 字典收尾",
         "        '网格列表顶对齐类 g-self-top': r'\\bg-self-top\\b',\n    }"),
        ("门禁 A 通过后的打印行",
         "print('主题锚点唯一性通过：静态挂载点 1 个 / 运行期唯一写入口，两处挂载点同步')"),
    ]
    for label, needle in pre:
        if needle not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, needle[:90]))

    # ── §A MUST 改判去注释文本 ──────────────────────────────────────────
    old = """    bad = []
    for label, need in MUST.items():
        if need not in html:
            bad.append('缺少 %s（%s）' % (label, need))"""
    new = """    bad = []
    # ⚠️ 判在 **probe_html（去注释）** 上，不判 html。铁律 10 的「判据落在
    #    字符序列上」有两个方向，这是**在场方向**的那一个：
    #    「必须缺席」判在含注释文本上 → 历史陈述注释让它**假红**；
    #    「必须在场」判在含注释文本上 → 注释里的同一串字让它**假绿**。
    #    实测（v1.2）：'基线覆盖层键' 判子串时，产物里该键 6 次出现有 5 次在
    #    注释里，把真代码改回旧键后断言照样通过 —— 一行拦不住任何东西的断言。
    #    改判前已全量体检：69 项里「仅在注释里在场」者为 0 项，故改判不会
    #    把本来正确的构建变红。
    for label, need in MUST.items():
        if need not in probe_html:
            bad.append('缺少 %s（%s）' % (label, need))"""
    assert src.count(old) == 1, '§A 命中数不是 1'
    src = src.replace(old, new, 1)

    # ── §B MUST_RE 同样改判 ────────────────────────────────────────────
    old = """    for label, rx in MUST_RE.items():
        if not re.search(rx, html):
            bad.append('缺少 %s（正则 %s）' % (label, rx))"""
    new = """    for label, rx in MUST_RE.items():
        if not re.search(rx, probe_html):
            bad.append('缺少 %s（正则 %s）' % (label, rx))"""
    assert src.count(old) == 1, '§B 命中数不是 1'
    src = src.replace(old, new, 1)

    # ── §C 存储键：从 MUST 移到 MUST_RE，判赋值语句 ─────────────────────
    old = """        '基线覆盖层键': 'baox.act.data.v2',
"""
    new = """        # ↑『基线覆盖层键』已于 v1.2b 迁到 MUST_RE（判赋值语句，判子串会假绿），
        #   理由见下方 MUST_RE 注释。
"""
    assert src.count(old) == 1, '§C-1 命中数不是 1'
    src = src.replace(old, new, 1)

    old = """        '网格列表顶对齐类 g-self-top': r'\\bg-self-top\\b',
    }"""
    new = """        '网格列表顶对齐类 g-self-top': r'\\bg-self-top\\b',
        # v1.2b 从 MUST 迁来，并把判据从「文中出现这串字」升级为「赋值语句」。
        # 为什么非升不可：同一串字在产物里出现 6 次，5 次在注释里，只有 1 次
        # 是真代码。判子串时，把 LS_DATA 改回旧键后注释仍能「满足」它 ——
        # 断言的在场判定被注释接管，等于没有断言。
        # 判在赋值语句上则只认那唯一一处真代码，注释写多少遍都不算。
        '基线覆盖层键': r"var\\s+LS_DATA\\s*=\\s*'baox\\.act\\.data\\.v2'",
    }"""
    assert src.count(old) == 1, '§C-2 命中数不是 1'
    src = src.replace(old, new, 1)

    # ── §D 新增门禁 A-3：存储键跨文件字面量一致 ────────────────────────
    old = "    print('主题锚点唯一性通过：静态挂载点 1 个 / 运行期唯一写入口，两处挂载点同步')"
    new = """    print('主题锚点唯一性通过：静态挂载点 1 个 / 运行期唯一写入口，两处挂载点同步')

    # ========================================================================
    # 门禁 A-3 · 存储键字面量跨文件一致
    # ========================================================================
    # 同一个键名在三处各写一份字面量：core.js 的 LS_DATA（唯一写入口）、
    # probe-interactions.cjs 的 LS_KEY（交互探针读它）、expected.py 的口径注释。
    # 只要有一处漂移，交互探针就会去读一个**空键** —— 而「读不到覆盖层」
    # 在一部分断言里长得像正常（种子基线本来就有值），属于静默失效。
    # 与门禁 A 判主题键同源，故同样在构建期把几份字面量钉死。
    a3 = []
    probe_path = os.path.join(BASE, 'probe-interactions.cjs')
    if os.path.exists(probe_path):
        probe_js = read(probe_path)
        m_data = re.search(r"var\\s+LS_DATA\\s*=\\s*'([^']+)'", parts['core.js'])
        m_probe = re.search(r"const\\s+LS_KEY\\s*=\\s*'([^']+)'", probe_js)
        if not m_data:
            a3.append('core.js 未找到 LS_DATA 赋值语句')
        if not m_probe:
            a3.append('probe-interactions.cjs 未找到 LS_KEY 赋值语句')
        if m_data and m_probe and m_data.group(1) != m_probe.group(1):
            a3.append('存储键漂移：core.js LS_DATA=%r，交互探针 LS_KEY=%r —— '
                      '探针会去读空键，失败长得像通过'
                      % (m_data.group(1), m_probe.group(1)))
        if m_data and m_probe and m_data.group(1) == m_probe.group(1):
            print('存储键一致性通过：%s（core.js LS_DATA 与交互探针 LS_KEY 字面相同）'
                  % m_data.group(1))
    else:
        print('存储键一致性：跳过（未找到 probe-interactions.cjs，交互探针本就不会跑）')
    if a3 and not no_gate:
        print('!! 存储键一致性门禁失败:')
        for b in a3:
            print('     -', b)
        sys.exit(1)
    if a3:
        print('   （诊断）存储键:%s' % a3[:3])"""
    assert src.count(old) == 1, '§D 命中数不是 1'
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
    print('自检通过：%d 项（%d 项必须在场 / %d 项必须清除）'
          % (len(CHECKS),
             sum(1 for _, _, w in CHECKS if w),
             sum(1 for _, _, w in CHECKS if not w)))
    print('  · MUST 与 MUST_RE 一律判在**去注释**文本上（在场方向的假绿已封）')
    print('  · 存储键判赋值语句（注释里写多少遍都不算）')
    print('  · 新增门禁 A-3：core.js LS_DATA 与交互探针 LS_KEY 字面一致')
    return 0


if __name__ == '__main__':
    sys.exit(main())
