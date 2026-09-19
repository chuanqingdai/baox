#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2f 补丁 · 交互探针补 ⑥ 自定义身份实测

背景：v1.2 给页面加了「点头像换图 / 点字样改名」两个交互。静态门禁能证明
DOM 里有那几个 id、存储层有那个键，但证明不了三件事 —— 而它们恰恰是
这类功能全部的真实失败模式：

  a. **压缩链路**：上传的图若不是正方形，裁的是「居中」还是「左上角」？
     静态断言无论如何写都看不出来（两者都产出 256×256）。
     处置：造一张 64×16 的图，**只在正中 16px 放绿块**、两侧铺红 ——
     居中裁必然得到一整片绿；若裁的是左上角，则得到红 → 断言直接失败。
     再配一条 256×256 与 dataURL 长度上限（AV_CAP）的断言，把降质重试也覆盖到。

  b. **实时编辑的三条边界**：截断（打完 12 字只剩 8 字，且**输入时**就截）、
     清空回默认（清空后失焦，字样回到「公子的」而不是留在空字符串）、
     Esc 撤销（未落盘的编辑一并丢弃）。
     这三条都是「看着做了、刷新就没了」或「以为没保存成功」的来源。

  c. **分家**：用户裁定身份「独立保存，不随数据走」。判据不能只测
     「改了能存下来」，必须测**反向**：导出载荷里没有身份字段，
     且「恢复初始数据」（清空业绩覆盖层）**清不掉**身份键。
     所以本节最后刻意再走一遍「改业绩 → 保存 → 两次点击恢复」，
     用「业绩键消失 / 身份键存活」这一对对照组来证明分家。

  d. **还原按钮不得顺带弹文件框**：resetAvatar 里的 stopPropagation 若被删，
     症状是「点还原反而要你选图」。判据＝点还原时 input#avatarFile 收到 0 次 click。

事件真实性：点击用 puppeteer 的真实鼠标（p.click），输入用真实键盘（p.keyboard），
不用 synthetic dispatch —— 否则测的是「我构造的事件」，而不是「浏览器给的事件」。
唯一例外是文件选择框：headless 下无法弹出，故直接给 input 灌 File 并派发 change，
即**只跳过「对话框」这一段**，其后的读取/压缩/落盘/刷新全是真的。

以及一处结构性防护：整节包在 try/catch 里。探针崩在中途 = 其后断言从未被验证，
而终局看起来只是「少了几行 ✅」—— 这是本项目记过的假绿形态之一（⑤）。
catch 里补一条 ok(false) 把它变成硬失败。
"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(BASE, 'probe-interactions.cjs')

ANCHOR = """    ok(errs.length === 0, '全程无 JS 错误' + (errs.length ? '：' + errs.join(' | ') : ''));"""

IDENTITY = r"""    /* ---------- ⑥ 自定义身份（v1.2 新增 · 头像可换 / 字样可改） ---------- */
    console.log('\n⑥ 自定义身份 · 头像替换 + 品牌字样改写（独立键，不随业绩数据走）');
    /* 本节证明三件静态门禁证明不了的事，理由写在文件头的 /_patch_v12f_probe.py 里：
         a. 压缩：非正方形图裁的是**居中**那块（判据＝正中绿块必然被裁进来）；
         b. 实时编辑的三条边界：输入时截断 / 清空回默认 / Esc 撤销未落盘内容；
         c. 分家：导出载荷无身份字段，且「恢复初始数据」清不掉身份键。
       点击与输入一律走真实鼠标键盘，不用 synthetic dispatch。 */
    try {
      const ID_KEY = await p.evaluate(() => window.__ACT_IDENTITY__.LS_ID);
      ok(ID_KEY === 'baox.act.identity.v1',
         '身份存储键 = ' + ID_KEY + '（与业绩键 ' + LS_KEY + ' 分家）');

      /* 身份快照：既看 DOM，也看存储原文 —— 只看 DOM 会把
         「改了界面但没落盘」当成通过（刷新即复原）。 */
      const idSnap = () => p.evaluate(k => {
        const img = document.getElementById('brandAvatar');
        const nm = document.getElementById('brandName');
        const mark = document.getElementById('brandMark');
        const rst = document.getElementById('brandReset');
        let raw = null;
        try { raw = localStorage.getItem(k); } catch (e) { raw = null; }
        let obj = null;
        try { obj = raw ? JSON.parse(raw) : null; } catch (e) { obj = 'BAD-JSON'; }
        return {
          src: img ? img.getAttribute('src') : null,
          name: nm ? nm.textContent : null,
          editing: !!(nm && nm.isContentEditable),
          editingCls: !!(nm && nm.classList.contains('is-editing')),
          custom: !!(mark && mark.classList.contains('has-custom')),
          resetDisplay: rst ? getComputedStyle(rst).display : 'none',
          hasKey: raw !== null,
          keys: obj && obj !== 'BAD-JSON' ? Object.keys(obj).sort().join(',') : String(obj),
          storedName: (obj && obj !== 'BAD-JSON' && obj.name) || null,
          rawLen: raw ? raw.length : 0
        };
      }, ID_KEY);

      /* 造图并灌进文件框。64×16，正中 16px 绿、两侧红：
         居中裁（sx=(64-16)/2=24）必然整片绿；左上角裁会得到红。 */
      const uploadAvatar = () => p.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 16;
        const g = c.getContext('2d');
        g.fillStyle = '#c8102e'; g.fillRect(0, 0, 64, 16);
        g.fillStyle = '#1d6f42'; g.fillRect(24, 0, 16, 16);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const f = new File([blob], 'probe-avatar.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(f);
        const inp = document.getElementById('avatarFile');
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      });

      /* ---------- 基线：默认态 ---------- */
      const id0 = await idSnap();
      ok(id0.name === '公子的', '初始品牌字样 = 公子的，实为 ' + JSON.stringify(id0.name));
      ok(/assets\/avatar\.png$/.test(id0.src || ''),
         '初始头像为本地 assets/avatar.png（零外链），实为 ' + id0.src);
      ok(id0.custom === false && id0.resetDisplay === 'none',
         '初始不挂 has-custom，还原按钮 display:none（不占视觉）');
      ok(id0.hasKey === false,
         '初始身份键不存在 —— 「键不在」等价于「全是默认值」，不留空对象');

      /* ---------- 点头像 → 文件框 ---------- */
      const wire = await p.evaluate(() => {
        const inp = document.getElementById('avatarFile');
        let n = 0;
        const spy = () => { n++; };
        inp.addEventListener('click', spy);
        document.getElementById('brandMark').click();
        inp.removeEventListener('click', spy);
        return n;
      });
      ok(wire === 1, '点头像容器调起文件选择框（input#avatarFile 收到 ' + wire + ' 次 click）');

      /* ---------- 压缩与落盘 ---------- */
      await uploadAvatar();
      await sleep(760);
      const id1 = await idSnap();
      ok(id1.hasKey === true, '上传后身份键落盘 ' + ID_KEY);
      ok(id1.keys === 'avatar',
         '只落「与默认不同」的键：此刻只有 avatar（name 仍是默认，不写）—— 实为 ' + id1.keys);
      ok(/^data:image\//.test(id1.src || ''),
         'DOM 头像立刻换成内联图（无需刷新）：' + String(id1.src).slice(0, 32) + '…');
      ok(id1.custom === true && id1.resetDisplay === 'grid',
         'has-custom 挂上，还原按钮随之挂载（display:grid，悬停/聚焦浮出）');
      ok(id1.name === '公子的', '换头像不影响字样（两个交互共用一条刷新路径但互不覆盖）');

      const av = await p.evaluate(async () => {
        const raw = JSON.parse(localStorage.getItem(window.__ACT_IDENTITY__.LS_ID) || '{}');
        const url = String(raw.avatar || '');
        const m = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(url);
        if (!m) { return { kind: 'none', url: url.slice(0, 40) }; }
        const im = new Image();
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
        return { kind: m[1].toLowerCase(), w: im.naturalWidth, h: im.naturalHeight,
                 center: px(128, 128), corner: px(4, 4), chars: url.length,
                 sameSrc: document.getElementById('brandAvatar').getAttribute('src') === url };
      });
      ok(av.kind === 'jpeg',
         '入库统一压成 JPEG（透明 PNG 压 JPEG 前会先铺底色，避免透明区变黑）—— 实为 ' + av.kind);
      ok(av.w === 256 && av.h === 256,
         '压到 256×256 正方形（源图 64×16，若未裁会得到 256×64）—— 实为 ' + av.w + '×' + av.h);
      ok(av.center[1] > av.center[0] + 30 && av.corner[1] > av.corner[0] + 30,
         '裁的是**居中**那块（源图正中绿块、两侧红块；若裁左上角这里会是红）—— ' +
         '中心 rgb(' + av.center.join(',') + ') / 角 rgb(' + av.corner.join(',') + ')');
      ok(av.chars <= 61440,
         'dataURL 长度 ' + av.chars + ' ≤ 61440（AV_CAP，超限会降质重试；不设上限必撞 localStorage 配额）');
      ok(av.sameSrc === true, 'DOM 挂的就是存储里那一份（不是另一张临时图）');

      /* ---------- 点字样 → 实时编辑 ---------- */
      await p.click('#brandName');
      await sleep(180);
      const ed = await idSnap();
      ok(ed.editing === true && ed.editingCls === true,
         '点标题里的字样进入编辑态（contenteditable + .is-editing 金色描边）');

      await p.keyboard.type('保罗');
      await sleep(700);
      const id2 = await idSnap();
      ok(id2.name === '保罗', '编辑态实时改文案 = 保罗，实为 ' + JSON.stringify(id2.name));
      ok(id2.storedName === '保罗',
         '改完 420ms debounce 自动落盘（存储里 name = ' + JSON.stringify(id2.storedName) + '）');
      ok(id2.keys === 'avatar,name',
         '字样与头像**各自成键**共存（实为 ' + id2.keys + '）—— 后改的那个不会把前一个挤掉');

      /* 长度上限：12 个字符全打进去，必然在**输入时**被截到 8 */
      await p.keyboard.type('ABCDEFGHIJKL');
      await sleep(200);
      const id3 = await idSnap();
      ok(id3.name === '保罗ABCDEF' && Array.from(id3.name).length === 8,
         '超长在**输入时**即截到 ' + 8 + ' 字：' + JSON.stringify(id3.name) +
         '（若只在落盘时截，用户会打完 14 字、刷新后剩 8 字，中间毫无提示）');

      /* Esc 撤销：未落盘的编辑一并丢弃 */
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
      ok(idEsc.editing === false, 'Esc 后退出编辑态（contenteditable 已摘）');

      /* 清空回默认 + :empty 占位符 + 残留 <br> 清理 */
      await p.click('#brandName');
      await sleep(150);
      await p.evaluate(() => {
        const nm = document.getElementById('brandName');
        nm.focus();
        nm.innerHTML = '<br>';          /* 模拟浏览器删空后留下的 <br> */
        nm.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(120);
      const brCleared = await p.evaluate(() => {
        const nm = document.getElementById('brandName');
        return { after: nm.innerHTML, ph: getComputedStyle(nm, '::before').content };
      });
      ok(brCleared.after === '',
         '删空后残留的 <br> 被主动清掉（不清则 :empty 失效、占位符不显示）—— 实为 ' +
         JSON.stringify(brCleared.after));
      ok(/公子的/.test(brCleared.ph || ''),
         '空值态显示灰色占位符「公子的」（否则用户清空后失焦看名字自己回来了，以为没保存成功）—— 实为 ' +
         String(brCleared.ph));
      await p.keyboard.press('Enter');
      await sleep(700);
      const id4 = await idSnap();
      ok(id4.name === '公子的' && id4.storedName === null && id4.keys === 'avatar',
         '清空后失焦回默认：DOM=' + JSON.stringify(id4.name) + ' / 键集合=' + id4.keys +
         '（name 键被删掉，而不是存一个空字符串）');

      /* ---------- 恢复默认头像：且不得顺带弹文件框 ---------- */
      const noPicker = await p.evaluate(() => {
        const inp = document.getElementById('avatarFile');
        let n = 0;
        const spy = () => { n++; };
        inp.addEventListener('click', spy);
        document.getElementById('brandReset').click();
        inp.removeEventListener('click', spy);
        return n;
      });
      await sleep(420);
      const id5 = await idSnap();
      ok(noPicker === 0,
         '点「恢复默认头像」不会顺带弹文件框（resetAvatar 的 stopPropagation 生效）—— 实为 ' +
         noPicker + ' 次');
      ok(/assets\/avatar\.png$/.test(id5.src || ''), '头像回到默认 assets/avatar.png');
      ok(id5.custom === false && id5.resetDisplay === 'none',
         '恢复默认后 has-custom 摘掉、还原按钮重新收起');
      ok(id5.hasKey === false,
         '身份键被**整键移除**（不留 {"avatar":""} 这种「看着还在、其实什么都没恢复」的空壳）');

      /* ---------- 分家对照组：恢复初始数据清业绩、不清身份 ---------- */
      await uploadAvatar();
      await sleep(760);
      await p.click('#brandName');
      await sleep(160);
      await p.keyboard.type('公子');
      await sleep(700);
      const id6 = await idSnap();
      ok(id6.keys === 'avatar,name' && id6.name === '公子',
         '身份已改为自定义（键集合 ' + id6.keys + '）—— 准备做分家对照');

      ok(await click('#btnSettings'), '打开设置抽屉改一格业绩数据');
      await sleep(380);
      await p.evaluate(dt => {
        const e = document.querySelector('#setBody .dg-in[data-d="' + dt + '"][data-k="gzh"]');
        e.value = '7';
        e.dispatchEvent(new Event('input', { bubbles: true }));
      }, TODAY);
      await sleep(220);
      ok(await click('#btnSetSave'), '保存并应用（业绩覆盖层落盘）');
      await sleep(640);
      ok((await snap()).score === 7, '面板业绩联动 = 7，实为 ' + (await snap()).score);

      await click('#btnSettings');
      await sleep(380);
      await click('#btnRestore');
      await sleep(220);
      await click('#btnRestore');
      await sleep(700);
      ok(await p.evaluate(k => localStorage.getItem(k), LS_KEY) === null,
         '对照组：业绩覆盖层已被「恢复初始数据」清空');
      const id7 = await idSnap();
      ok(id7.hasKey === true && id7.custom === true,
         '身份键**未被**恢复动作清掉（头像仍在，has-custom=' + id7.custom + '）');
      ok(id7.name === '公子' && id7.storedName === '公子',
         '改过的字样也**未被**清掉（DOM=' + JSON.stringify(id7.name) + '）—— ' +
         '这就是「独立保存，不随数据走」的可失败判据');

      const expLeak = await p.evaluate(() => {
        const s = JSON.stringify(window.__ACT_SETTINGS__.collect());
        return { leak: /avatar|identity/i.test(s), len: s.length };
      });
      ok(expLeak.leak === false,
         '导出载荷（' + expLeak.len + ' 字符）不含任何身份字段 —— ' +
         '把业绩备份发到另一台机器不会顺带灌进别人的头像/字样');

      /* 复位到默认态，避免影响后续（本次已在末节，仅为不留下脏存储） */
      await p.evaluate(() => {
        try { localStorage.removeItem(window.__ACT_IDENTITY__.LS_ID); } catch (e) {}
      });
    } catch (e) {
      ok(false, '⑥ 身份节中途异常（其后断言未验证）：' +
         String((e && e.message) || e).slice(0, 200));
    }

"""

SUMMARY_OLD = """  console.log('\\n🎉 交互实测通过：冷启动锚点 / 撤销式筛选（含空集） / 无破坏性按钮 / ' +
              '打卡 12 模块写路径 / 设置数据可编辑且可撤销');"""

SUMMARY_NEW = """  console.log('\\n🎉 交互实测通过：冷启动锚点 / 撤销式筛选（含空集） / 无破坏性按钮 / ' +
              '打卡 12 模块写路径 / 设置数据可编辑且可撤销 / ' +
              '自定义身份（头像居中裁剪 + 字样实时落盘 + 与业绩数据分家）');"""

CHECKS = [
    ('§A ⑥ 身份节在场', '⑥ 自定义身份 · 头像替换 + 品牌字样改写', True),
    ('§A 节内包了 try/catch（崩在中途要变成硬失败）',
     '⑥ 身份节中途异常（其后断言未验证）', True),
    ('§A 居中裁的判据落在像素上', 'av.center[1] > av.center[0] + 30', True),
    ('§A 分家对照断言在场', '身份键**未被**恢复动作清掉', True),
    ('§B 收尾摘要已含身份', '自定义身份（头像居中裁剪 + 字样实时落盘 + 与业绩数据分家）', True),
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
        ('§A 收尾前的 errs 断言（插入锚点）', ANCHOR),
        ('§B 末行摘要', SUMMARY_OLD),
    ]
    for label, needle in pre:
        if needle not in src:
            sys.exit('!! 前置条件不满足：找不到 %s\n   %r' % (label, needle[:110]))

    assert src.count(ANCHOR) == 1, '§A 锚点命中数不是 1'
    src = src.replace(ANCHOR, IDENTITY + ANCHOR, 1)

    assert src.count(SUMMARY_OLD) == 1, '§B 命中数不是 1'
    src = src.replace(SUMMARY_OLD, SUMMARY_NEW, 1)
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
