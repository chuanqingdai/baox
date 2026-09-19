#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2c 补丁 · 归档集合不许有内容重复的副本（铁律 17 的配套）

由来（本轮修完门禁假绿后重跑构建时发现）：

  落盘处的去重逻辑是**内容感知**的，但只跟**同名**那个文件比
  （activity-v1.2-260918.html）。而它里面装的是「修好之前」那一次构建
  （md5 fdf0769d），于是此后每次重跑都判「同名且内容不同」→ 分叉出一个
  新的时间戳文件。

  问题在于：新分叉出来的文件与已经存在的 -224841 归档**逐字节相同**。
  连跑两次构建就能堆出两份同内容的归档，跑得越多堆得越多。

  archive/ 实测（修前）：
    activity-v1.2-260918-224841.html  8d70bdf5...
    activity-v1.2-260918-225942.html  8d70bdf5...   ← 与上一行完全相同

  归档文件名即版本声明（铁律 17）。内容相同的两个文件里，必然有一个名字
  在说谎 —— 它声称自己是一个新的版本形态，其实不是。

本次修两处：
  §E  落盘前按**内容**对全部归档查重：命中即不归档（幂等重跑不留痕）。
  §F  门禁 F 补一条「归档集合里不得有内容相同的副本」——
      只防覆盖、不防重复，等于只装了一半的锁。这条门禁在补丁生效时会
      立刻报红（现存那两份重复正摆在 archive/ 里），必须先把多余的退役掉。

退役方式：**改名移出**，不删除（沿用本项目一贯做法）。
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


# 落地自检：(说明, 目标文本, 期望是否在场)
CHECKS = [
    ('§E 全文归档内容查重', 'dup = None', True),
    ('§E 命中即不归档的打印', '不重复归档', True),
    ('§E 旧的「只比同名」分支仍在', "print('版本归档：%s（内容一致，未重复写入）' % arch)", True),
    ('§F 内容重复判据', '归档集合里存在内容相同的副本', True),
    ('§F 通过行的措辞已更新', '无一个冒充别的版本、无内容重复', True),
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
        ("归档去重的同名分支", "    if os.path.exists(arch) and _same_bytes(STAGE, arch):"),
        ("归档同字节比较函数", "    def _same_bytes(a, b):"),
        ("门禁 F 通过打印", "    print('  ✅ 门禁 F · %d 个归档，无一个冒充别的版本' % n)"),
        ("门禁 F 的 liars 判定", "    if liars:"),
    ]
    for label, needle in pre:
        if needle not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, needle[:90]))

    # ── §F 先做（改的是 check_archives 的尾部）──────────────────────────
    old = """    n = len(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html')))
    print('  ✅ 门禁 F · %d 个归档，无一个冒充别的版本' % n)"""
    new = """    # v1.2c：归档集合应当是「若干个互不相同的版本形态」——
    # 两个归档内容逐字节相同，说明其中至少有一个的名字在声称一个并不存在的
    # 新形态。这是上面「不覆盖」策略的必然配套：只防覆盖、不防重复，
    # archive/ 会悄悄堆成同内容的副本（本轮实测：连跑两次构建即多出一份
    # 与既有归档完全相同的文件）。
    by_hash = {}
    for f in sorted(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html'))):
        by_hash.setdefault(_md5(f), []).append(os.path.basename(f))
    dups = {h: fs for h, fs in by_hash.items() if len(fs) > 1}
    if dups:
        lines = []
        for h, fs in sorted(dups.items()):
            lines.append('     %s… ← %s' % (h[:12], ' / '.join(fs)))
        sys.exit('!! 门禁 F · 归档集合里存在内容相同的副本，产物不落盘。\\n'
                 '   归档文件名是版本声明，内容相同的文件里必有一个名字在说谎。\\n'
                 '%s\\n'
                 '   处置：把多出来的那份**改名移出**（如移到 _tmp/retired/），'
                 '不要删除。' % '\\n'.join(lines))
    n = len(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html')))
    print('  ✅ 门禁 F · %d 个归档，无一个冒充别的版本、无内容重复' % n)"""
    assert src.count(old) == 1, '§F 命中数不是 1'
    src = src.replace(old, new, 1)

    # ── §E 落盘处的归档去重 ────────────────────────────────────────────
    old = """    if os.path.exists(arch) and _same_bytes(STAGE, arch):"""
    new = """    # v1.2c：去重必须扫**全部归档**，不能只比同名的那个。
    # 实测踩到：canonical 名（activity-v1.2-260918.html）里装的是「修好之前」
    # 那一次构建，于是此后每次重跑都判「同名且内容不同」，分叉出一个新的
    # 时间戳文件 —— 而它与已存在的归档**逐字节相同**。
    dup = None
    for f in sorted(glob.glob(os.path.join(ARCHIVE, 'activity-v*.html'))):
        if f != arch and _same_bytes(STAGE, f):
            dup = f
            break

    if dup:
        check_archives(OUT, VERSION)
        print('\\n产物已落盘：%s' % OUT)
        print('版本归档：已存在同内容归档 %s（不重复归档）' % os.path.basename(dup))
    elif os.path.exists(arch) and _same_bytes(STAGE, arch):"""
    assert src.count(old) == 1, '§E 命中数不是 1'
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
    print('  · 归档去重改为「对全部归档按内容查重」，幂等重跑不留痕')
    print('  · 门禁 F 新增：归档集合里不得有内容相同的副本')
    return 0


if __name__ == '__main__':
    sys.exit(main())
