#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2f2 补丁 · 修正 ⑥ 身份节里两条**假红**断言（页面实现无误）

首跑交互探针，⑥ 节 42 项里报红 2 项。逐条查下来，两条都不是页面问题，
是断言自己写错了 —— 而假红与假绿同样有害：它会把人引去改正确的实现。

  ❌ 裁的是**居中**那块 —— 中心 rgb(29,111,65) / 角 rgb(67,90,62)

    源图 64×16，绿块在 x∈[24,40)，居中裁取得正是这 16px，压到 256×256。
    判据取的四角 (4,4) 贴着被裁块的边缘：**16 倍上采样 + JPEG** 会把邻居
    （红 200,16,46）重采样进来，实测 rgb(67,90,62) 已不满足「绿占优」。
    修法：取样点改到三个内部点（源坐标约 (4.5,4.5) / (8,8) / (11.5,11.5)），
    三点全在绿块内。若裁的是左上角，这三点会全是红 → 判据的鉴别力不变。
    ⚠️ 教训：判「颜色/像素」时，取样点离边缘的距离本身就是一个判据参数。

  ❌ Esc 撤销未落盘的编辑，回到进入编辑态前的值（DOM="公子的" / 存储=null）

    上一小节（超长截断）结束时元素**仍在编辑态**，`enterNameEdit()` 会
    在 `isContentEditable` 时直接 return，所以那记 `p.click` 没开新会话 ——
    Esc 还原到的是最外那层会话开始时捕获的 NAME_BEFORE（"公子的"）。
    即：断言测的是「我搞错了会话边界」，不是实现。
    Esc 的语义本来就是「回到进入编辑态那一刻的值」，实现没有错。
    修法：先按 Enter 真正提交并退出，再点开一段**新的**编辑会话，才测 Esc。
    顺带把这一趟做成两条额外断言：Enter 提交后 DOM=存储（截断值被完整保存）、
    存储里从未留下被撤销的那串（Esc 确实清掉了 debounce 定时器）。
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'probe-interactions.cjs')

AV_OLD = """        const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
        return { kind: m[1].toLowerCase(), w: im.naturalWidth, h: im.naturalHeight,
                 center: px(128, 128), corner: px(4, 4), chars: url.length,
                 sameSrc: document.getElementById('brandAvatar').getAttribute('src') === url };"""

AV_NEW = """        const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
        /* 取样点必须离边缘足够远：被裁的源块只有 16px 宽，放大到 256 时
           边缘像素会被重采样与 JPEG 一起**染上邻居的红色** —— 实测四角
           rgb(67,90,62)，据此判「是否绿占优」会得到一条假红（页面是对的）。
           故取三个内部点：源坐标约 (4.5,4.5) / (8,8) / (11.5,11.5)。 */
        return { kind: m[1].toLowerCase(), w: im.naturalWidth, h: im.naturalHeight,
                 center: px(128, 128), q1: px(72, 72), q3: px(184, 184),
                 chars: url.length,
                 sameSrc: document.getElementById('brandAvatar').getAttribute('src') === url };"""

AVOK_OLD = """      ok(av.center[1] > av.center[0] + 30 && av.corner[1] > av.corner[0] + 30,
         '裁的是**居中**那块（源图正中绿块、两侧红块；若裁左上角这里会是红）—— ' +
         '中心 rgb(' + av.center.join(',') + ') / 角 rgb(' + av.corner.join(',') + ')');"""

AVOK_NEW = """      const greens = [av.center, av.q1, av.q3];
      ok(greens.every(c => c[1] > c[0] + 30 && c[1] > 90),
         '裁的是**居中**那块（源图 64×16 的正中 16px 是绿、两侧是红；' +
         '若裁左上角，这三点会全红）—— ' +
         greens.map(c => 'rgb(' + c.join(',') + ')').join(' '));"""

ESC_OLD = """      /* Esc 撤销：未落盘的编辑一并丢弃 */
      await p.click('#brandName');
      await sleep(150);
      await p.keyboard.type('ZZZ');
      await sleep(120);
      await p.keyboard.press('Escape');
      await sleep(300);
      const idEsc = await idSnap();
      ok(idEsc.name === '保罗ABCDEF' && idEsc.storedName === '保罗ABCDEF',
         'Esc 撤销未落盘的编辑，回到进入编辑态前的值（DOM=' + JSON.stringify(idEsc.name) +
         ' / 存储=' + JSON.stringify(idEsc.storedName) + '）');
      ok(idEsc.editing === false, 'Esc 后退出编辑态（contenteditable 已摘）');"""

ESC_NEW = """      /* 先提交并**真正退出**编辑态。Esc 的还原点是「进入编辑态那一刻」的值
         （NAME_BEFORE 在 enterNameEdit 里捕获），而 enterNameEdit 在
         已处于编辑态时会直接 return —— 不先退出，后面的 Esc 会还原到
         最外那层会话的开头，那时断言测的是我自己搞错的会话边界，不是实现。 */
      await p.keyboard.press('Enter');
      await sleep(640);
      const idCommit = await idSnap();
      ok(idCommit.name === '保罗ABCDEF' && idCommit.storedName === '保罗ABCDEF' &&
         idCommit.editing === false,
         'Enter 提交并退出编辑态：DOM=存储=' + JSON.stringify(idCommit.name) +
         '（截断后的值被完整保存，不留在 DOM 里当半成品）');

      /* Esc 撤销：未落盘的编辑一并丢弃 */
      await p.click('#brandName');
      await sleep(160);
      ok((await idSnap()).editing === true,
         '重新开一段编辑会话（进入时全选，直接打字即覆盖）');
      await p.keyboard.type('ZZZ');
      await sleep(120);
      await p.keyboard.press('Escape');
      await sleep(360);
      const idEsc = await idSnap();
      ok(idEsc.name === '保罗ABCDEF' && idEsc.storedName === '保罗ABCDEF',
         'Esc 撤销未落盘的编辑，回到进入编辑态前的值（DOM=' + JSON.stringify(idEsc.name) +
         ' / 存储=' + JSON.stringify(idEsc.storedName) + '）');
      ok(idEsc.editing === false, 'Esc 后退出编辑态（contenteditable 已摘）');
      ok(!/ZZZ/.test(String(await p.evaluate(k => localStorage.getItem(k), ID_KEY))),
         '存储里从未留下被撤销的那串（Esc 清掉了 debounce 定时器，不是靠回写覆盖）');"""

CHECKS = [
    ('§A 三个内部取样点', 'q1: px(72, 72), q3: px(184, 184),', True),
    ('§A 旧的贴边取样点已移除', 'corner: px(4, 4),', False),
    ('§A 判据改为三点全绿', 'greens.every(c => c[1] > c[0] + 30 && c[1] > 90)', True),
    ('§B 先 Enter 退出编辑态', "'Enter 提交并退出编辑态：DOM=存储='", True),
    ('§B 再开新会话测 Esc', '重新开一段编辑会话（进入时全选，直接打字即覆盖）', True),
    ('§B 存储不留被撤销的串', "'存储里从未留下被撤销的那串", True),
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
    for label, old, new in (('§A 取样点', AV_OLD, AV_NEW),
                            ('§A 判据', AVOK_OLD, AVOK_NEW),
                            ('§B Esc 会话边界', ESC_OLD, ESC_NEW)):
        if old not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, old[:110]))
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

    print('probe-interactions.cjs: %d → %d 字符' % (orig_len, len(back)))
    print('自检通过：%d 项' % len(CHECKS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
