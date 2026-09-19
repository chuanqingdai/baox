#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.3 补丁 · 升版 + 把「版本字面量三处一致」变成门禁

为什么本轮要升版：v1.2 交付的是「KPI 卡重定义 + 数据清空」这类**口径与内容**
的调整，页面结构与交互没变；本轮加了「点头像换图 / 点字样改名」——
一个用户可见、可交互、且带独立持久化键的**新功能**。

为什么非升不可（铁律 17「归档文件名即版本声明」）：
  archive/ 文件夹的用途是「这个版本长什么样」。文件名若仍写 v1.2，
  而内容已经多出一整块交互，那这个名字就在说谎 —— 而一旦归档名不可信，
  整套归档就退化成一堆没有语义的 html，铁律 17 也就白写了。

为什么顺带补一条门禁：版本号在**三处**各写一份字面量，此前没有任何一致性判据 ——
  · build.py  VERSION = 'v1.3'      → 决定归档文件名
  · body.html #footVer  = 'V1.3'    → 侧栏显示（大写形态）
  · body.html #verBadge = 'v1.3'    → 页首徽章（小写形态）
三份漂移的后果正是「归档冒充版本」：文件名说 v1.3、页面写着 v1.2（或反过来），
而这两个信息分别在不同的地方被读到 —— 核对归档的人看文件名，
交付给用户的人看页面，两边都以为自己在看同一个版本。
与门禁 A-3（存储键跨文件一致）同源，故同样在构建期把字面量钉死。

⚠️ 三个字面量的大小写形态不同（V1.3 / v1.3），比对时必须各自用对应的形态：
把它们统一成一种大小写会误报 —— 那不是漂移，是设计的展示差异。
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(BASE, 'build.py')
BODY = os.path.join(BASE, 'body.html')

VER_OLD = 'v1.2'
VER_NEW = 'v1.3'

GATE_OLD = """    if a3:
        print('   （诊断）存储键:%s' % a3[:3])"""

GATE_NEW = """    if a3:
        print('   （诊断）存储键:%s' % a3[:3])

    # ========================================================================
    # 门禁 A-5 · 版本字面量三处一致（铁律 13 / 17）
    # ========================================================================
    # 版本号在**三处**各写一份字面量，此前没有任何一致性判据：
    #   · build.py  VERSION   → 决定归档文件名（铁律 17 的「版本声明」）
    #   · body.html #footVer  → 侧栏版本（大写形态 V1.3）
    #   · body.html #verBadge → 页首徽章（小写形态 v1.3）
    # 漂移的后果正是「归档冒充版本」：核对归档的人看文件名、
    # 交付给用户的人看页面，两边都以为在看同一个版本，而对不上时谁也不知道。
    # ⚠️ 三处的大小写形态本就不同（V1.3 / v1.3），比对必须各用对应形态 ——
    #    统一大小写再比会把设计的展示差异误报成漂移（假红）。
    a5 = []
    ver_low = VERSION
    ver_up = 'V' + VERSION[1:]
    mv_foot = re.search(r'id="footVer">([^<]*)<', body)
    mv_badge = re.search(r'id="verBadge">([^<]*)<', body)
    if not mv_foot:
        a5.append('body.html 未找到 #footVer 文本（侧栏版本）')
    elif mv_foot.group(1).strip() != ver_up:
        a5.append('版本漂移：侧栏 #footVer=%r，而 build.py VERSION=%r（应为 %r）'
                  % (mv_foot.group(1).strip(), VERSION, ver_up))
    if not mv_badge:
        a5.append('body.html 未找到 #verBadge 文本（页首徽章）')
    elif mv_badge.group(1).strip() != ver_low:
        a5.append('版本漂移：页首 #verBadge=%r，而 build.py VERSION=%r（应为 %r）'
                  % (mv_badge.group(1).strip(), VERSION, ver_low))
    if a5 and not no_gate:
        print('!! 版本一致性门禁失败:')
        for b in a5:
            print('     -', b)
        sys.exit(1)
    if not a5:
        print('版本一致性通过：%s（归档名 / 侧栏 %s / 页首 %s 三处同步）'
              % (VERSION, ver_up, ver_low))"""

CHECKS = [
    ('§A build.py VERSION 已升', "VERSION = 'v1.3'", True),
    ('§A 旧的 VERSION 已移除', "VERSION = 'v1.2'", False),
    ('§B 版本一致性门禁在场', '门禁 A-5 · 版本字面量三处一致', True),
    ('§B 门禁比对用的是两种大小写形态', "ver_up = 'V' + VERSION[1:]", True),
    ('§C 页首徽章已升', 'id="verBadge">v1.3<', True),
    ('§C 侧栏版本已升', 'id="footVer">V1.3<', True),
]


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


def selfcheck():
    build = rd(BUILD)
    body = rd(BODY)
    both = build + body
    bad = []
    for label, needle, want in CHECKS:
        got = needle in both
        if got != want:
            bad.append('%s：期望%s，实测%s'
                       % (label, '在场' if want else '缺席', '在场' if got else '缺席'))
    return bad


def patch():
    build = rd(BUILD)
    body = rd(BODY)

    # ---------- §A 升版（build.py 的 VERSION）----------
    if build.count("VERSION = '%s'" % VER_OLD) != 1:
        sys.exit('!! 前置条件不满足：build.py 里 VERSION = \'%s\' 命中数不是 1' % VER_OLD)
    build = build.replace("VERSION = '%s'" % VER_OLD, "VERSION = '%s'" % VER_NEW, 1)

    # ---------- §C 升版（body.html 两处，形态不同、各改各的）----------
    if body.count('id="verBadge">%s<' % VER_OLD) != 1:
        sys.exit('!! 前置条件不满足：body.html 的 #verBadge 文本不是 %s' % VER_OLD)
    body = body.replace('id="verBadge">%s<' % VER_OLD, 'id="verBadge">%s<' % VER_NEW, 1)

    if body.count('id="footVer">V%s<' % VER_OLD[1:]) != 1:
        sys.exit('!! 前置条件不满足：body.html 的 #footVer 文本不是 V%s' % VER_OLD[1:])
    body = body.replace('id="footVer">V%s<' % VER_OLD[1:], 'id="footVer">V%s<' % VER_NEW[1:], 1)

    # ---------- §B 新增门禁 A-5（插在门禁 A-3 之后、门禁 B 之前）----------
    if build.count(GATE_OLD) != 1:
        sys.exit('!! 前置条件不满足：门禁 A-3 的诊断块命中数不是 1')
    build = build.replace(GATE_OLD, GATE_NEW, 1)

    wr(BUILD, build)
    wr(BODY, body)


def main():
    verify_only = '--verify-only' in sys.argv
    if verify_only:
        print('— 只回查，不改文件 —')
    else:
        patch()

    bad = selfcheck()
    if bad:
        print('!! 自检失败')
        for b in bad:
            print('   - ' + b)
        return 1
    print('自检通过：%d 项 —— 版本三处同步为 v1.3，且新增门禁 A-5 钉死它们'
          % len(CHECKS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
