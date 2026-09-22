#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.4 反例验证 · 证明「观测窗口」**交互探针**（probe-interactions.cjs 第 ⑦ 节）
真的会失败

项目惯例：**新增门禁/断言必须证明它会失败**。一条永远不响的断言，
只是在日志里占了一行，却让人以为那一块已经被守住了。

与上一轮 reverse-verify-v14.py 的分工（别混）：
  · reverse-verify-v14.py      → 证明**运行期门禁**（verify-runtime.cjs 第 ⑨ 节）
                                 的窗口口径判据会失败（逐值比对 Python 期望值）。
  · 本脚本                      → 证明**交互探针**（probe-interactions.cjs 第 ⑦ 节）
                                 的窗口 UI 判据会失败。两者测的不是同一件事：
                                 第 ⑨ 节测「算得对不对」，第 ⑦ 节测
                                 「抽屉里的那几个按钮/日期框真的把事情做成了没有」。

第 ⑦ 节的判据（本轮新增，按它在脚本里的出现顺序）：
  ① 预设按钮真的重建逐日表格（行数 / 周数 / 日集合三者同时变）
  ② 未保存前只改草稿，面板明细行数不变
  ③ 窗口单独变更也落盘，且 days 不落盘（窗口不把整表写成快照）
  ④ 只改窗口也点亮「恢复初始数据」入口（铁律 15：改动必须有可见的回退路径）
  ⑤ 起止颠倒被自动对调**并说出来**（toast）
  ⑥ 超 90 天被截断**并说出来**（toast）
  ⑦ ★ 越窗保存后窗口外记录仍在覆盖层（diffOverlay 必须从既有覆盖层出发）
  ⑧ ★ 窗口调回去 → 记录完整重现（重建草稿必须用「基线 + 覆盖层」）
  ⑨ 保存提示的连接符正确（三段拼接不许漏分隔符）
  ⑩ 窗口回默认值 → 键被清掉（键存在 = 有自定义）

-------------------------------- 归因判据（本脚本比 v14 更进一步）--------------------------------
v14 已经确立：**红了不等于红在正确的地方**，判据是「第 ⑨ 节内部真的有 ❌」。
本脚本对探针沿用同一条，并把「一次只破坏一个判据」变成**可机检**的两条：

  · must_fail：指定的那条断言必须**带 ❌**出现 —— 而不只是「文案出现在输出里」。
    这一点不能省：报红时同一段文案既可能出现在 ✅ 行（判据没响），
    也可能出现在 ❌ 行（判据响了）。只查文案会把它当成「已证明」。
  · must_pass：指定的那条断言必须**带 ✅**出现 —— 这是「只打给它自己」的证据。
    没有 must_pass，「一个反例证明一条判据」就会退化成「一个反例证明了一整节」。

⚠️ 有 3 条判据没有独立反例，理由写在各自段落里（不是漏了）：
  · ② 「未保存前只改草稿」：任何能打破它的注入（让抽屉改窗口顺手改面板）
    都必须先穿透 DRAFT/commit 的分层，等于重写整条链路 —— 那样的反例
    一次会破坏七八条判据，归因反而说不清。它的价值由 P1 间接覆盖
    （预设不生效时，面板行数断言与草稿断言一起红）。
  · ⑤⑥ 的「归一化本身」（对调/截断）由 reverse-verify-v14.py 的 C / B 例
    在纯函数层逐值证明；这里只证明「**兜底被说出来了**」。
  · ⑩ 「窗口回默认 → 键清掉」由 P3 间接覆盖（窗口压根没提交时，
    这条断言反而会通过，说明它测的是另一件事）。

-------------------------------- 跑法 ------------------------------------------------
沙箱里 `build.py --no-gate` 组装产物（跳过全部门禁，报红只可能来自探针），
再单独跑 probe-interactions.cjs。每个反例只注入一处、跑完立刻还原。

用法: python3 src/reverse-verify-probe-v14.py
      退出码 0 = 全部反例按预期报红 / 1 = 有反例没按预期响
"""
import datetime
import io
import os
import shutil
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SANDBOX = os.path.join(ROOT, '_tmp', 'reverse-probe-v14')

NODE = '/Users/jaydenkong/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'
NODE_PATH = '/Users/jaydenkong/.workbuddy/binaries/node/workspace/node_modules'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PY = sys.executable

WIN_HDR = '⑦ 观测窗口'


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


def env_of():
    env = dict(os.environ)
    env['PATH'] = '/opt/homebrew/bin:' + env.get('PATH', '')
    env['NODE_PATH'] = NODE_PATH
    env['CHROME_PATH'] = CHROME
    return env


def assemble(shadow):
    """只组装产物，不跑任何门禁。"""
    r = subprocess.run([PY, os.path.join(shadow, 'src', 'build.py'), '--no-gate'],
                       capture_output=True, text=True, env=env_of(), cwd=shadow)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def run_probe(shadow):
    """组装 → 单独跑交互探针。返回 (rc, 输出)。"""
    rc, out = assemble(shadow)
    if rc != 0:
        return rc, '[组装失败]\n' + out
    r = subprocess.run([NODE, os.path.join(shadow, 'src', 'probe-interactions.cjs'),
                        os.path.join(shadow, 'index.html')],
                       capture_output=True, text=True, env=env_of(), cwd=shadow)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def marked(out, msg, sym):
    """输出里有没有一行**同时**含 sym（✅/❌）与 msg。"""
    for ln in out.splitlines():
        if sym in ln and msg in ln:
            return ln.strip()
    return None


def reattribution(out):
    """归因：**第 ⑦ 节自己必须报红**。

    「前置先红」有两种成因，v14 已论证过，这里沿用同一套：
      · 依赖级联 —— 变异打在应用层上游（预设、草稿重建、保存入口），
        第 ①–⑥ 节里凡走过同一条链路的断言都会跟着红。**放行**。
      · 归因不清 —— 变异打在别处、⑦ 压根没响。**判失败**。
    唯一的判据：⑦ 段落内有没有 ❌。"""
    i = out.find(WIN_HDR)
    if i < 0:
        return False, '第 ⑦ 节未被执行到（⑦ 内部无从报红）'
    own = [ln for ln in out[i:].splitlines() if '❌' in ln]
    head = [ln for ln in out[:i].splitlines() if '❌' in ln]
    if not own:
        return False, '⑦ 内部无任何 ❌（前置红了 %d 处，但本条判据没响）' % len(head)
    if head:
        return True, '⑦ 内部红 %d 处（前置 %d 处为依赖级联）' % (len(own), len(head))
    return True, '⑦ 内部红 %d 处，前置 ①–⑥ 全绿' % len(own)


def main():
    # ---------------------------------------------------------- 搭沙箱
    if os.path.exists(SANDBOX):
        stamp = datetime.datetime.now().strftime('%H%M%S')
        os.replace(SANDBOX, SANDBOX + '.' + stamp)
        print('旧沙箱已改名保留：%s.%s' % (os.path.basename(SANDBOX), stamp))
    os.makedirs(SANDBOX, exist_ok=True)
    for d in ('src', 'data', 'libs', 'assets'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(SANDBOX, d))

    # 收纳历次补丁脚本与本族反例脚本：它们不参与构建，留着反而是
    # 「构建依赖了什么」的假线索。
    # ⚠️ 过滤条件落在**文件**上（不能落在名字前缀上 —— 收纳目录自己的名字
    #    就以 `_patch` 开头，会被自己的条件选中，实测撞过 EINVAL）。
    patchdir = os.path.join(SANDBOX, 'src', '_patches_not_needed')
    os.makedirs(patchdir, exist_ok=True)
    for f in os.listdir(os.path.join(SANDBOX, 'src')):
        if os.path.isdir(os.path.join(SANDBOX, 'src', f)):
            continue
        if f.startswith('_patch') or f.endswith('.bak.py') or f.startswith('reverse-verify-'):
            os.replace(os.path.join(SANDBOX, 'src', f), os.path.join(patchdir, f))
    print('沙箱就绪：%s\n' % SANDBOX)

    APP = os.path.join(SANDBOX, 'src', 'app.js')
    CORE = os.path.join(SANDBOX, 'src', 'core.js')

    class NoInjection(Exception):
        pass

    def mut(path, old, new, n=1):
        """把 path 里的 old 换成 new，要求恰好出现 n 次，返回原文（供还原）。

        ⚠️ 次数不符时**立刻抛错中止**，绝不静默走 fallback：
        实测踩过「想往一个源码里不存在的字符串前插行」→ 静默落空 →
        反例压根没做功，而它给出的 ✅ 比没有反例更糟（它给了你已经守住的安全感）。
        """
        cur = rd(path)
        got = cur.count(old)
        if got != n:
            raise NoInjection('%s 里 %r 出现 %d 次，期望 %d 次'
                              % (os.path.basename(path), old[:60], got, n))
        wr(path, cur.replace(old, new, n))
        return cur

    results = []

    def case(key, title, mutations, must_fail, must_pass=None, must_absent=None):
        """跑一个反例。

        must_fail:   必须**带 ❌**出现的断言文案（判据真的响了）
        must_pass:   必须**带 ✅**出现的断言文案（只打给它自己）
        must_absent: 输出里不该出现的东西
        """
        snapshot = {}
        try:
            for t in mutations:
                path, old, new = t[0], t[1], t[2]
                n = t[3] if len(t) > 3 else 1
                snapshot.setdefault(path, rd(path))
                mut(path, old, new, n)
        except NoInjection as e:
            for path, txt in snapshot.items():
                wr(path, txt)
            results.append((key, title, False, '注入失败（反例未做功）：%s' % e))
            return

        rc, out = run_probe(SANDBOX)

        # ---------- 还原变异 ----------
        for path, txt in snapshot.items():
            wr(path, txt)

        notes, good = [], True

        if rc == 0:
            good = False
            notes.append('反例未报红（rc=0）—— 该判据是死的')

        for m in must_fail:
            hit = marked(out, m, '❌')
            if not hit:
                good = False
                alt = marked(out, m, '✅')
                notes.append('预期报红的断言没响' +
                             ('（它是 ✅：%s）' % alt[:72] if alt else '（连文案都没出现）'))
            else:
                notes.append('❌ ' + hit.lstrip('❌ ').strip()[:76])
        for m in (must_pass or []):
            hit = marked(out, m, '✅')
            if not hit:
                good = False
                notes.append('不该红的断言红了：%s' % m)
        for m in (must_absent or []):
            if m in out:
                good = False
                notes.append('出现了不该有的 %r' % m)

        if rc != 0:
            uc, why = reattribution(out)
            if not uc:
                good = False
            notes.append('归因：' + why)

        results.append((key, title, good, ' · '.join(notes)))

    # ============================================================ 用例
    print('=' * 76)
    print('  v1.4 反例验证 · 观测窗口交互探针（probe-interactions.cjs 第 ⑦ 节）')
    print('=' * 76)

    # ---- 0 对照：沙箱原样，必须全绿 ----
    print('\n[0] 对照：沙箱原样（不注入，探针必须整节全绿）')
    rc0, out0 = run_probe(SANDBOX)
    n7 = len([ln for ln in out0[out0.find(WIN_HDR):].splitlines() if '✅' in ln]) if WIN_HDR in out0 else 0
    ok0 = (rc0 == 0 and '❌' not in out0 and '🎉 交互实测通过' in out0)
    results.append(('0', '对照：沙箱原样', ok0,
                    'rc=%d · 第 ⑦ 节 ✅ %d 条' % (rc0, n7)))
    print('    ' + ('✅' if ok0 else '❌') + ' rc=%d · 第 ⑦ 节 ✅ %d 条' % (rc0, n7))

    # ---- P1 预设按钮点了不生效（判据 ①③④⑨）----
    print('\n[P1] onPresetClick 退化为空操作（点「近 7 天」什么都不做）')
    print('     期望：选中态 / 重建 / 落盘 / 提示 四家族一起红（同一处注入的依赖级联）')
    case('P1', '预设按钮退化为空操作',
         [(APP, "if (hit) { setWindowDraft({ start: hit.range[0], end: hit.range[1] }); }",
                "if (hit) { /* 反例：预设点了什么都不做 */ }")],
         must_fail=['该胶囊进入选中态', '窗口与逐日表格一起重建为 7 天'])

    # ---- P2 说明与草稿脱钩（只该打给「说明」这一条）----
    print('\n[P2] 窗口说明读「已保存窗口」而不是草稿（说明旧、表格新 —— 半成品形态）')
    print('     期望：**只有**「窗口说明随重建刷新」红，重建/日集合两条必须仍绿')
    print('     这条专治「三处联动」里的第三处：如果只写一条笼统的 ok，')
    print('     就分不出「表格没重排」与「说明没刷新」是两种不同的坏法。')
    case('P2', '说明与草稿脱钩',
         [(APP, "wi.textContent = win.days.length + ' 天 · ' + win.weeks.length + ' 周';",
                "wi.textContent = A.currentWindow().days.length + ' 天 · ' + "
                "A.currentWindow().weeks.length + ' 周';")],
         must_fail=['窗口说明随重建刷新'],
         must_pass=['窗口与逐日表格一起重建为 7 天', '日集合首末 = 窗口首末日'])

    # ---- P3 保存时不提交窗口（判据 ③ 的正面）----
    print('\n[P3] saveSettings 丢掉第 4 个参数（窗口与数据没有一起提交）')
    print('     期望：「窗口单独变更也落盘」「面板按新窗口重算」红；')
    print('     而 ★ 越窗保护那两条**仍绿** —— 窗口压根没变，记录当然还在。')
    print('     这正是归因的证据：两条判据测的不是同一件事。')
    case('P3', '保存时不提交窗口',
         [(APP, "var ov = A.diffOverlay(DRAFT.days, DRAFT.biz, DRAFT.weeks, DRAFT.win);",
                "var ov = A.diffOverlay(DRAFT.days, DRAFT.biz, DRAFT.weeks);")],
         must_fail=['窗口单独变更也落盘'],
         must_pass=['在覆盖层里'])

    # ---- P4 ★ 核心：diffOverlay 从空对象重建 ----
    print('\n[P4] ★ diffOverlay 从**空对象**重建而不是从既有覆盖层出发')
    print('     期望：越窗保存后记录被静默抹掉（这就是用户裁定「保留不删」要挡的事）')
    print('     ⚠️ 这是 v1.4 最容易写错、且错了**不报错**的一行。')
    case('P4', 'diffOverlay 从空对象重建',
         [(CORE, 'days: JSON.parse(JSON.stringify(prev.days)),', 'days: {},')],
         must_fail=['仍在覆盖层里'])

    # ---- P5 ★ 核心：重建草稿从基线取 ----
    print('\n[P5] ★ 重建草稿只取基线、不并覆盖层（savedDayOf 退化成 baseDayAt）')
    print('     期望：窗口调回去时格子显示 0 → 保存时被判定「与基线相同」→ 记录被删')
    print('     症状是「换个窗口再换回来，数据没了」，当次操作看起来完全成功。')
    case('P5', '重建草稿只取基线',
         [(APP, 'savedDayOf(iso, ov.days)', 'draftRow(A.baseDayOf(iso))')],
         must_fail=['窗口调回去 → 总分回到 3'])

    # ---- P6 恢复入口不认窗口这一项改动（判据 ④）----
    print('\n[P6] overlaySize 不计窗口（窗口改动不再算一处改动）')
    print('     期望：「只改窗口也点亮恢复入口」红 —— 用户失去把窗口改回默认的路')
    case('P6', '恢复入口不认窗口改动',
         [(CORE, 'Object.keys(ov.biz).length + (ov.window ? 1 : 0);',
                 'Object.keys(ov.biz).length;')],
         must_fail=['点亮「恢复初始数据」入口'])

    # ---- P7 起止颠倒兜底不说出来（判据 ⑤）----
    print('\n[P7] 起止颠倒仍然自动对调，但**不告诉用户**（toast 那行被去掉）')
    print('     期望：对调本身仍成立（纯函数在 core.js），只有 toast 那条红 ——')
    print('     这正是「兜底正确」与「兜底被说出来」是两条独立判据的证明。')
    case('P7', '颠倒兜底不说出来',
         [(APP, "if (raw.start && raw.end && raw.start > raw.end) { notices.push('起止颠倒，已自动对调'); }",
                "if (false) { notices.push('起止颠倒，已自动对调'); }")],
         must_fail=['并把兜底说出来'],
         must_pass=['起止颠倒被自动对调'])

    # ---- P8 截断兜底不说出来（判据 ⑥）----
    print('\n[P8] 超 90 天仍然截断，但**不告诉用户**')
    print('     期望：截断仍成立、说明仍刷新，只有 toast 那条红')
    case('P8', '截断兜底不说出来',
         [(APP, 'if (span > A.WIN_MAX_DAYS) {', 'if (false) {')],
         must_fail=['并把截断说出来'],
         must_pass=['超上限被截到 90 天', '窗口说明随截断刷新'])

    # ---- P9 保存提示的连接符（判据 ⑨）----
    print('\n[P9] 保存提示退回「三段手写拼接」（旧写法：漏分隔符）')
    print('     期望：两条 toast 断言都红。')
    print('     ⚠️ 这条反例是**真实踩到过的**：v1.4 首跑时提示语读作')
    print('        「已应用窗口 09/14–09/20其余数据无改动」，而当时的关键词式断言')
    print('        （/已应用窗口/ && /其余数据无改动/）**照样通过**。')
    print('        补上连接符断言后才把它拦下来 —— 本反例即两条断言的对照取证。')
    case('P9', '保存提示漏分隔符',
         [(APP, "toast(parts.length ? '已应用 ' + parts.join(' · ') : '数据与初始值一致，无需改动');",
                "toast(parts.length ? '已应用' + parts.join('') : '数据与初始值一致，无需改动');")],
         must_fail=['连接符正确', '含连接符'])

    # ============================================================ 汇总
    print('\n' + '=' * 76)
    print('  汇总')
    print('=' * 76)
    bad = 0
    for k, t, g, note in results:
        print('  %s %-4s %-28s %s' % ('✅' if g else '❌', k, t, note))
        if not g:
            bad += 1
    print('')
    if bad:
        print('❌ %d 个反例未按预期响应（判据可能是死的，或注入没做功）' % bad)
        return 1
    print('🎉 全部 %d 个反例按预期响应：每条判据都被证明「会失败，且红在它自己身上」'
          % len(results))
    return 0


if __name__ == '__main__':
    sys.exit(main())
