#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2g 补丁 · 构建期补「自定义身份」三组门禁

v1.2 给页面加了两个交互（点头像换图 / 点字样改名）与一条独立存储。三组断言：

  §A MUST 逐 id 列出六个落点。
     为什么必须逐 id 而不是「有 6 个 brand 开头的 id」：计数式命中 0 也算通过
     （本项目已有先例），少一个元素时它会一声不响。
     其中 `window.__ACT_IDENTITY__` 是运行期取证接口 —— 交互探针全靠它，
     它一没，探针就从「读不到」变成「读到 undefined」，报错点在探针不在实现。

  §B MUST_RE 判 **赋值语句**，不是子串。
     与「基线覆盖层键」同规格，理由同源：`baox.act.identity.v1` 这串字在
     注释里会被反复提到（本次改动就写了 5 处注释提到它），判子串时
     把真代码改回旧键、注释照样「满足」断言 —— 断言的在场判定被注释接管。

  §C 门禁 A-3 扩展：身份键与业绩键必须**分家**。这是本节唯一一条真正的
     跨文件一致性判据，也是三组里最值钱的一条 —— 两键同名时两条后果都静默：
       · 「恢复初始数据」的 removeItem 会把头像与字样一起清掉；
       · 覆盖层写盘会把身份字段并进业绩覆盖层，导出备份里带上自己的头像。
     两条都要等用户切设备 / 点恢复才暴露。

附：为什么身份键没有「三份字面量对照」——全篇只有 core.js 一处字面量，
交互探针从运行期接口读、app.js 引用变量。这比再抄一份字面量更好：
少一份副本就少一个漂移点。故 §C 只判「两键不同」。
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'build.py')

MUST_OLD = """        '静默破坏防护': 'function bindChips',
    }"""

MUST_NEW = """        '静默破坏防护': 'function bindChips',
        # ── 自定义身份（v1.2 新增）──────────────────────────────────────────
        # 逐 id 一一列出。六个落点各自独立可失效，且失效症状互不相同：
        #   · brandMark 没了 → 点头像没反应（上传入口整条断掉）；
        #   · brandAvatar 没了 → applyIdentity 静默 return，头像永远不更新；
        #   · brandReset 没了 → 换过头像就**回不去默认**（铁律 15）；
        #   · brandName 没了 → 字样改不了，且失焦提交那一路也没人接；
        #   · avatarFile 没了 → pickAvatar 直接 return，文件框永不出现；
        #   · __ACT_IDENTITY__ 没了 → 交互探针读不到，门禁测的不是真实路径。
        '头像容器': 'id="brandMark"',
        '头像图': 'id="brandAvatar"',
        '头像还原按钮': 'id="brandReset"',
        '品牌字样可编辑位': 'id="brandName"',
        '头像文件框': 'id="avatarFile"',
        '身份取证接口': 'window.__ACT_IDENTITY__',
    }"""

MUST_RE_OLD = """        '头像文件框 accept 字面量': r'id="avatarFile"[^>]*accept="image/\\*"',
    }"""

MUST_RE_NEW = """        '头像文件框 accept 字面量': r'id="avatarFile"[^>]*accept="image/\\*"',
        # v1.2：身份存储键同样判**赋值语句**（理由见上方「基线覆盖层键」）。
        # 这个键尤其容易被注释接管：本次改动光注释就提到它 5 处
        # （设计说明、与业绩键分家的理由、探针说明…），判子串时
        # 把真代码改回旧键、注释照样「满足」断言。
        '身份覆盖层键': r"var\\s+LS_ID\\s*=\\s*'baox\\.act\\.identity\\.v1'",
    }"""

A3_OLD = """        if m_data and m_probe and m_data.group(1) == m_probe.group(1):
            print('存储键一致性通过：%s（core.js LS_DATA 与交互探针 LS_KEY 字面相同）'
                  % m_data.group(1))"""

A3_NEW = """        # ── v1.2 身份键：与业绩键必须**分家** ──────────────────────────────
        # 这是本节唯一一条真正跨文件的判据，也是最值钱的一条：两键同名时
        # 两条后果都静默，且都要等用户切设备 / 点恢复才暴露 ——
        #   · 「恢复初始数据」的 removeItem 会把头像与字样一起清掉；
        #   · 覆盖层写盘把身份字段并进业绩覆盖层，导出备份里带上自己的头像
        #     （发给同事就等于把头像灌进对方的备份）。
        # 身份键在此**不需要**三份字面量对照：全篇只有 core.js 一处字面量，
        # 交互探针从运行期接口 window.__ACT_IDENTITY__.LS_ID 读，app.js 也
        # 引用同一变量。少一份副本就少一个漂移点 —— 这比再抄一份更好。
        m_id = re.search(r"var\\s+LS_ID\\s*=\\s*'([^']+)'", parts['core.js'])
        if not m_id:
            a3.append('core.js 未找到 LS_ID 赋值语句（身份键）')
        if m_id and m_data and m_id.group(1) == m_data.group(1):
            a3.append('身份键与业绩键相同（%r）—— 「恢复初始数据」会连头像/字样'
                      '一起清掉，且身份字段会被并进业绩备份' % m_id.group(1))
        if m_data and m_probe and m_data.group(1) == m_probe.group(1):
            print('存储键一致性通过：%s（core.js LS_DATA 与交互探针 LS_KEY 字面相同）'
                  % m_data.group(1))
        if m_id and m_data and m_id.group(1) != m_data.group(1):
            print('身份键分家通过：%s ≠ 业绩键 %s' % (m_id.group(1), m_data.group(1)))"""

CHECKS = [
    ('§A 六个身份落点', "'身份取证接口': 'window.__ACT_IDENTITY__',", True),
    ('§A 头像容器 id', "'头像容器': 'id=\"brandMark\"',", True),
    ('§B 身份键判赋值语句', r"var\s+LS_ID\s*=\s*'baox\.act\.identity\.v1'", True),
    ('§C 两键分家判据', "'身份键与业绩键相同（%r）—— 「恢复初始数据」会连头像/字样'", True),
    ('§C 分家通过日志', "'身份键分家通过：%s ≠ 业绩键 %s'", True),
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
    # §C 不得引用未导入的别名（本项目踩过：补丁照抄了自己的 import re as _re）
    if '_re.' in text:
        bad.append('§C 判据不得引用未导入的 _re')
    return bad


def patch(src):
    pre = [
        ('§A MUST 收尾锚点', MUST_OLD),
        ('§B MUST_RE 收尾锚点', MUST_RE_OLD),
        ('§C 门禁 A-3 打印块', A3_OLD),
    ]
    for label, needle in pre:
        if needle not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, needle[:110]))

    for label, old, new in (('§A', MUST_OLD, MUST_NEW),
                            ('§B', MUST_RE_OLD, MUST_RE_NEW),
                            ('§C', A3_OLD, A3_NEW)):
        assert src.count(old) == 1, '%s 命中数不是 1（实测 %d）' % (label, src.count(old))
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
    print('自检通过：%d 项' % len(CHECKS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
