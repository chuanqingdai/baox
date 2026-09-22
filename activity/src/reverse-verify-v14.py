#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.4 反例验证 · 证明「观测窗口口径」门禁（verify-runtime.cjs 第 ⑨ 节）真的会失败

项目惯例：**新增门禁/断言必须证明它会失败**。一条永远不响的断言，
只是在构建日志里占了一行，却让人以为那一块已经被守住了。

本轮（v1.4）新增的判据全部落在第 ⑨ 节，共 6 条：
  ① 窗口默认值 ≡ 种子声明的 period（JS 侧 WIN_DEFAULT）
  ② 窗口长度上下限 ≡ Python 侧常量（90 / 1）
  ③ 种子 weeks（第三份实现 reset_seed.py）≡ 默认窗口切分（逐周 + 逐日）
  ④ 15 组区间：归一化结果 ≡ Python；周边界 ≡；周内逐日序列 ≡
  ⑤ shapeWindow 自洽（days == daySet == 周天数和；端点对得上；周表 ≡ naturalWeeks）
  ⑥ 逐日不变量（覆盖完整 / 无重复 / 严格连续）
另加两条**拒绝降级**的守卫：期望值缺 windows 字段 → 直接退出；页面无窗口 API → 报红。

-------------------------------- 跑法（本轮特有，别照抄 v13）--------------------------------
v13 的做法是「每个反例跑一次完整的 build.py」。本轮改用**隔离跑法**：
沙箱里先 `build.py --no-gate` 组装产物（跳过全部门禁），再单独跑
`expected.py` + `verify-runtime.cjs`。于是报红只可能来自第 ⑨ 节，因果清晰。

⚠️ 但这里有一段**假设被实测推翻**的经过，写下来免得后来者照着抄理由：
本脚本起草时的理由是「变异会被静态门禁 A–D 先拒，⑨ 根本走不到（前置遮蔽）」。
对照组 I₂ 专门去实测了这件事 —— 结果是**没有发生**：
I（只改 data.js 的 period，与 activity.json 脱钩）在整链路下 rc=1，
且第 ⑨ 节**照常被执行到**并报红。也就是说，静态门禁并没有校验
「内嵌种子 data.js ≡ 事实源 activity.json」，⑨ 自己把这条抓了下来。
所以隔离跑法的真实收益只剩「归因干净」，不是「防止遮蔽」。

本轮**确实**撞到一次前置遮蔽，但在 Python 内部：H 例若真的去删
expected.py 里那一行，会先被它自己后面的 `print` 以 KeyError 拦下，
门禁 ⑨ 的「拒绝降级」守卫根本轮不到执行 —— 于是 H 改成在期望值文件落盘后
把字段剥掉（见 H 段说明），模拟的才是「期望值来自旧版 expected.py」这个真实场景。

无论遮蔽是否发生，有一条判据始终要留着：**红了不等于红在正确的地方。**
每个反例都跑 reattribution()，要求「第 ⑨ 节内部真的有 ❌」——
它才是「判据会响」的证据，前置红了几行不算。
（初版把这条写成「前置必须全绿」，于是 E 与 I 被判成「归因不清」，
实际是上游变异的依赖级联 —— 判定器比判据更容易写错，见 reattribution 的注释。）

-------------------------------- 反例的硬规矩（本项目踩过的坑，逐条落地）--------------------------------
 1. **一次只破坏一个判据。** 12 个 case 里大多数只注入一处、只该让一类判据响。
    三处例外（D 日期合法性、E shapeWindow、I 窗口默认值）破坏的都是**上游**：
    下游多条判据的输入取自它，级联报红是**依赖**而非判据冗余。
    与之配套的是一致性要求：**每条独立判据都要有一个只打给它自己的反例**。
    本轮实测漏了「周内逐日序列」这条 —— F₁ 的 dayCount 会跟着翻倍，
    于是先命中「周边界/天数不符」、把序列那条 else-if 短路掉，
    看上去「F 已经证明过了」。补了 F₂（只把序列转一位、天数与边界都不动）
    才真正证伪它；F₂ 也是「门禁若只比周边界与天数就会全绿」的正面自证。
 2. **注入前先核对注入点存在且次数恰好。** mut() 在次数不符时立刻抛错中止，
    绝不静默走 fallback。实测踩过：想往一个源码里**不存在**的字符串前插行，
    静默走到 fallback，那条反例压根没生效 —— 它给出的 ✅ 是「反例没做功」，
    比没有反例更糟。
 3. **沙箱收纳时的过滤条件要落在「文件」上**，不能落在「名字前缀」上
    （收纳目录自己的名字就以 `_patch` 开头，会被自己的条件选中）。
 4. 跑完**改名归档、不做删除**（产物本体与沙箱都不删）。

用法: python3 src/reverse-verify-v14.py
      退出码 0 = 全部反例按预期报红 / 1 = 有反例没按预期响
"""
import datetime
import glob
import io
import os
import shutil
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SANDBOX = os.path.join(ROOT, '_tmp', 'reverse-v14')
RETIRED = os.path.join(ROOT, '_tmp', 'retired')

NODE = '/Users/jaydenkong/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'
NODE_PATH = '/Users/jaydenkong/.workbuddy/binaries/node/workspace/node_modules'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
PY = sys.executable

WINDOW_HDR = '⑨ 观测窗口口径'


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


def env_of(shadow):
    env = dict(os.environ)
    env['PATH'] = '/opt/homebrew/bin:' + env.get('PATH', '')
    env['NODE_PATH'] = NODE_PATH
    env['CHROME_PATH'] = CHROME
    return env


def assemble(shadow):
    """只组装产物，不跑任何门禁。"""
    r = subprocess.run([PY, os.path.join(shadow, 'src', 'build.py'), '--no-gate'],
                       capture_output=True, text=True, env=env_of(shadow), cwd=shadow)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def run_isolated(shadow, post=None):
    """组装 → 生成期望值 →（可选 post）→ **单独**跑运行期门禁。返回 (rc, 输出)。"""
    rc, out = assemble(shadow)
    if rc != 0:
        return rc, '[组装失败]\n' + out
    expf = os.path.join(shadow, '_tmp', '_expected.json')
    r0 = subprocess.run([PY, os.path.join(shadow, 'src', 'expected.py'),
                         os.path.join(shadow, 'data', 'activity.json'), expf],
                        capture_output=True, text=True, env=env_of(shadow), cwd=shadow)
    if r0.returncode != 0:
        return r0.returncode, '[期望值生成失败 —— 已被 Python 侧自检拦下，未进入门禁 ⑨]\n' \
                              + (r0.stdout or '') + (r0.stderr or '')
    if post:
        post(shadow, expf)
    r1 = subprocess.run([NODE, os.path.join(shadow, 'src', 'verify-runtime.cjs'),
                         os.path.join(shadow, 'index.html'), expf],
                        capture_output=True, text=True, env=env_of(shadow), cwd=shadow)
    return r1.returncode, (r1.stdout or '') + (r1.stderr or '')


def run_full(shadow):
    """完整构建（含全部门禁）。"""
    r = subprocess.run([PY, os.path.join(shadow, 'src', 'build.py')],
                       capture_output=True, text=True, env=env_of(shadow), cwd=shadow)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def reattribution(out):
    """归因：**第 ⑨ 节自己必须报红**，这才是「判据会响」的证据。

    这里的第一版写错了，错得值得记：我当时要求「前置 ①–⑧ 必须全绿」，
    于是 E（shapeWindow 少推一天）与 I（默认窗口脱钩）都被判成「归因不清」——
    因为 ①「窗口天数」本来就是从 shapeWindow / 默认窗口推出来的，
    上游一动它必然先红。那不是判据冗余，是**依赖**。

    「前置先红」有两种截然不同的成因，必须分开：
      · 依赖级联 —— 变异打在**上游**（窗口形状、默认值、日期合法性），
        下游多条判据的输入都取自它，一起报红是必然的。**放行**。
      · 归因不清 —— 变异打在别处、⑨ 压根没响。**必须判失败**。
    区分二者的判据只有一个：**⑨ 段落内有没有 ❌**。⑨ 内部没红，就说明
    这条判据是死的，无论前面红了多少行。"""
    i = out.find(WINDOW_HDR)
    if i < 0:
        return False, '第 ⑨ 节未被执行到（⑨ 内部无从报红）'
    own = [ln.strip() for ln in out[i:].splitlines() if '❌' in ln]
    head = [ln.strip() for ln in out[:i].splitlines() if '❌' in ln]
    if not own:
        return False, '⑨ 内部无任何 ❌（前置红了 %d 处，但本条判据没响）' % len(head)
    if head:
        return True, '⑨ 内部红 %d 处（前置 %d 处为依赖级联）' % (len(own), len(head))
    return True, '⑨ 内部红 %d 处，前置 ①–⑧ 全绿' % len(own)


def main():
    # ---------------------------------------------------------- 搭沙箱
    if os.path.exists(SANDBOX):
        stamp = datetime.datetime.now().strftime('%H%M%S')
        os.replace(SANDBOX, SANDBOX + '.' + stamp)
        print('旧沙箱已改名保留：%s.%s' % (os.path.basename(SANDBOX), stamp))
    os.makedirs(SANDBOX, exist_ok=True)
    for d in ('src', 'data', 'libs', 'assets'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(SANDBOX, d))

    # 收纳历次补丁脚本：它们不参与构建，留着反而是「构建依赖了什么」的假线索。
    # ⚠️ 过滤条件落在**文件**上（规矩 3）：收纳目录自己的名字就以 `_patch` 开头。
    patchdir = os.path.join(SANDBOX, 'src', '_patches_not_needed')
    os.makedirs(patchdir, exist_ok=True)
    for f in os.listdir(os.path.join(SANDBOX, 'src')):
        if os.path.isdir(os.path.join(SANDBOX, 'src', f)):
            continue
        if f.startswith('_patch') or f.endswith('.bak.py') or f.startswith('reverse-verify-'):
            os.replace(os.path.join(SANDBOX, 'src', f), os.path.join(patchdir, f))
    print('沙箱就绪：%s\n' % SANDBOX)

    CORE = os.path.join(SANDBOX, 'src', 'core.js')
    DJS = os.path.join(SANDBOX, 'src', 'data.js')

    class NoInjection(Exception):
        pass

    def mut(path, old, new, n=1):
        """把 path 里的 old 换成 new，要求恰好出现 n 次，返回原文（供还原）。"""
        cur = rd(path)
        got = cur.count(old)
        if got != n:
            raise NoInjection('%s 里 %r 出现 %d 次，期望 %d 次'
                              % (os.path.basename(path), old[:60], got, n))
        wr(path, cur.replace(old, new, n))
        return cur

    results = []

    def case(key, title, expect, mutations, must_contain, must_absent=None,
             use_full=False, post=None, refuse_guard=False):
        """跑一个反例。

        expect:      'red'（应报红）/ 'green'（应对照全绿）
        refuse_guard: 该反例属「拒绝降级」型 —— 守卫在任何一节执行**之前**就退出，
                      因此它的正确表现正是「⑨ 未被走到」。这类反例不能套用
                      「⑨ 内部必须有 ❌」的归因判据（那会把它误判成判据是死的）。
                      显式标注而不是靠字符串猜，免得下次有人以为漏了一条。
        """
        snapshot = {}
        try:
            for path, old, new, n in mutations:
                snapshot.setdefault(path, rd(path))
                mut(path, old, new, n)
        except NoInjection as e:
            # 注入没做功：立刻还原并**判为失败**，绝不让它冒充一个通过的反例
            for path, txt in snapshot.items():
                wr(path, txt)
            results.append((key, title, False, '注入失败（反例未做功）：%s' % e))
            return

        if use_full:
            rc, out = run_full(SANDBOX)
        else:
            rc, out = run_isolated(SANDBOX, post)

        # ---------- 还原变异 ----------
        for path, txt in snapshot.items():
            wr(path, txt)

        notes = []
        good = True

        if expect == 'green':
            if rc != 0:
                good = False
                notes.append('对照应全绿，实得 rc=%d' % rc)
            if '❌' in out:
                good = False
                notes.append('对照输出含 ❌')
            if '🎉 运行期数据一致性通过' not in out:
                good = False
                notes.append('未见 ⑨ 全绿收尾行')
            else:
                notes.append('全绿')
        else:
            if rc == 0:
                good = False
                notes.append('反例未报红（rc=0）—— 该判据是死的')
            for m in must_contain:
                if m not in out:
                    good = False
                    notes.append('缺少预期报错 %r' % m)
            if must_absent:
                for m in must_absent:
                    if m in out:
                        good = False
                        notes.append('出现了不该有的 %r' % m)
            if rc != 0:
                if refuse_guard:
                    notes.append('归因：拒绝降级的守卫在任何一节之前生效（预期如此）')
                    # 这类反例要额外钉一条：**必须没有**继续往下跑。
                    # 若它一边报错一边还打印了 ⑨ 的 ✅，那就说明它是「报警但继续」，
                    # 正是这个守卫要杜绝的降级行为。
                    if WINDOW_HDR in out:
                        good = False
                        notes.append('守卫报了错却仍继续执行第 ⑨ 节 —— 这是降级行为')
                else:
                    uc, why = reattribution(out)
                    if not uc:
                        good = False
                    notes.append('归因：' + why)
                bads = [ln.strip().lstrip('↳ ').strip() for ln in out.splitlines() if '❌' in ln]
                if bads:
                    notes.append('红 %d 处' % len(bads))

        results.append((key, title, good, ' · '.join(notes)))

    # ============================================================ 用例
    print('=' * 76)
    print('  v1.4 反例验证 · 观测窗口口径门禁（第 ⑨ 节）')
    print('=' * 76)

    # ---- 0 对照：副本原样，完整构建必须全绿 ----
    print('\n[0] 对照：沙箱原样（完整构建，含全部门禁）')
    rc, out = run_full(SANDBOX)
    good = (rc == 0 and '❌' not in out and '全部门禁通过' in out) or \
           (rc == 0 and ' 全绿' in out)
    # build.py 结尾的收尾语按项目实际输出判定，避免写死措辞
    tail = [ln for ln in out.splitlines() if ln.strip()][-3:]
    ok0 = (rc == 0 and '❌' not in out)
    results.append(('0', '对照：沙箱原样',
                    ok0, 'rc=%d · %s' % (rc, ' / '.join(x.strip() for x in tail))))
    print('    ' + ('✅' if ok0 else '❌') + ' rc=%d' % rc)
    for ln in tail:
        print('      ' + ln.strip())

    # ---- A 周边界 off-by-one（分叉的最典型形态）----
    print('\n[A] 周边界 off-by-one：mondayOf(d) → mondayOf(addDays(d,1))')
    print('    期望：周边界/天数与 Python 不符；默认窗口由 3+7+7+7+6 变 2+7+7+7+7')
    case('A', '周边界 off-by-one',
         'red',
         [(CORE, 'var mon = mondayOf(d);', 'var mon = mondayOf(addDays(d, 1));', 1)],
         ['周边界/天数不符'])

    # ---- B 去掉 90 天截断 ----
    print('\n[B] 去掉超上限截断（只该影响 3 组超限区间）')
    case('B', '去掉截断',
         'red',
         [(CORE,
           'if (diffDays(s, e) + 1 > WIN_MAX_DAYS) { e = addDays(s, WIN_MAX_DAYS - 1); }',
           '/* 反例：去掉截断 */', 1)],
         ['归一化'])

    # ---- C 去掉起止互换 ----
    print('\n[C] 去掉起止颠倒互换（只该影响「起止颠倒」那一组）')
    case('C', '去掉互换',
         'red',
         [(CORE, 'if (s > e) { var t = s; s = e; e = t; }',
           '/* 反例：去掉互换 */', 1)],
         ['归一化'])

    # ---- D 日期合法性只判格式（上游判据，会级联）----
    print('\n[D] 日期合法性只判格式：2026-02-31 会被接受并溢出成 3/3')
    print('    ⚠️ 这是**上游**判据，级联报红属依赖关系，非判据冗余')
    case('D', '日期格式闸失效',
         'red',
         [(CORE, 'return isoOf(parseDay(s)) === s;', 'return true;', 1)],
         ['归一化'])

    # ---- E shapeWindow 与 naturalWeeks 脱钩 ----
    print('\n[E] shapeWindow 少推一天（days 与 weeks 脱钩）')
    case('E', 'shapeWindow 不自洽',
         'red',
         [(CORE, 'for (i = 0; i < n; i++) { days.push(addDays(w.start, i)); }',
           'for (i = 0; i < n - 1; i++) { days.push(addDays(w.start, i)); }', 1)],
         ['shapeWindow 不自洽'])

    # ---- F1 周内逐日重复（先命中「周边界/天数」，走 else if 短路）----
    print('\n[F₁] naturalWeeks 每天 push 两次')
    print('    注意：dayCount 随之翻倍 → 先命中「周边界/天数不符」，')
    print('    「周内逐日序列不符」被 else-if 短路（刻意的，避免噪音）——')
    print('    所以那条分支要由 F₂ 单独证伪，不能靠这一例。')
    case('F₁', '周内重复日',
         'red',
         [(CORE, 'cur.days.push(d);', 'cur.days.push(d); cur.days.push(d);', 1)],
         ['周边界/天数不符', '日期重复'])

    # ---- F2 **只**破坏周内序列：天数不变、边界不变，只把序列转一位 ----
    # 这是「一次只破坏一个判据」的正面自证：wkey（idx/from/to/dayCount）完全不动，
    # 只有 wdays 变。若门禁只比周边界与天数，这一例会**全绿**。
    print('\n[F₂] 只打乱周内序列（天数与边界都不动）')
    case('F₂', '周内序列乱序',
         'red',
         [(CORE, 'days: b.days,', 'days: b.days.slice(1).concat(b.days[0]),', 1)],
         ['周内逐日序列不符'])

    # ---- G 不导出窗口 API ----
    print('\n[G] 不导出自然周函数（页面失去取证面）')
    case('G', '窗口 API 未导出',
         'red',
         [(CORE, 'naturalWeeks: naturalWeeks,\n', '', 1)],
         ['页面未暴露窗口 API'])

    # ---- K 上下限常量漂移 ----
    print('\n[K] 上限常量漂移：90 → 120')
    case('K', '上下限漂移',
         'red',
         [(CORE, 'var WIN_MAX_DAYS = 90;', 'var WIN_MAX_DAYS = 120;', 1)],
         ['窗口长度上下限'])

    # ---- I 内嵌种子与事实源脱钩（必须隔离跑，否则被静态门禁遮蔽）----
    print('\n[I] 内嵌种子 period 与 activity.json 脱钩（只改 data.js）')
    print('    ⚠️ 仅隔离跑法可行：整链路下会被静态门禁先拒 —— 那正是「前置遮蔽」')
    case('I', '种子与默认窗口脱钩',
         'red',
         [(DJS, '"period":{"start":"2026-09-18","end":"2026-10-17","days":30}',
           '"period":{"start":"2026-09-25","end":"2026-10-17","days":30}', 1)],
         ['窗口默认值'])

    # ---- H 期望值缺字段 → 拒绝降级，直接退出 ----
    print('\n[H] 期望值缺 windows 字段（必须**直接退出**，不许降级跳过）')
    print('    做法：在 expected.py 产出之后、跑门禁之前，把该字段从 json 里剥掉 ——')
    print('    这正是「期望值文件来自旧版 expected.py」的真实场景。')
    print('    不这么做的话：删 expected.py 那一行会先被它自己的 print 以 KeyError 拦下，')
    print('    门禁 ⑨ 的守卫根本轮不到执行（又是一次「前置遮蔽」，只是这次在 Python 内部）。')

    def strip_windows(shadow, expf):
        import json as _json
        d = _json.loads(rd(expf))
        d.pop('windows', None)
        wr(expf, _json.dumps(d, ensure_ascii=False, separators=(',', ':')))

    case('H', '期望值缺字段',
         'red',
         [],
         ['缺少 windows 字段'],
         post=strip_windows, refuse_guard=True)

    # ---- I2 证伪 I 的遮蔽假设：整链路下 I 到底走不走到 ⑨ ----
    print('\n[I₂] 把 I 改成整链路跑，实测「前置遮蔽」是否真的发生')
    snap_djs = rd(DJS)
    mut(DJS, '"period":{"start":"2026-09-18","end":"2026-10-17","days":30}',
        '"period":{"start":"2026-09-25","end":"2026-10-17","days":30}', 1)
    rc_f, out_f = run_full(SANDBOX)
    wr(DJS, snap_djs)
    reached = WINDOW_HDR in out_f
    print('    rc=%d · 第 ⑨ 节是否被执行到：%s' % (rc_f, '是' if reached else '否'))
    if reached:
        print('    → 未被遮蔽，隔离跑法非必需（但隔离仍让归因更清晰）')
    else:
        firstbad = next((ln.strip() for ln in out_f.splitlines() if '❌' in ln
                         or '!!' in ln), '(无)')
        print('    → **确实被前置门禁遮蔽**：%s' % firstbad[:120])
        print('      这条现象已写进本文件头部与 mianban skill：反例跑法必须隔离。')
    results.append(('I₂', '前置遮蔽实测', True,
                    'rc=%d · ⑨ %s' % (rc_f, '被执行' if reached else '被前置门禁遮蔽')))

    # ============================================================ 汇总
    print('\n' + '=' * 76)
    print('  汇总')
    print('=' * 76)
    bad = 0
    for key, title, good, note in results:
        print('  %s %-3s %-22s %s' % ('✅' if good else '❌', key, title, note))
        if not good:
            bad += 1
    print('')
    if bad:
        print('❌ 有 %d 个反例未按预期响应 —— 对应的判据可能是死的，或归因不清。' % bad)
    else:
        print('🎉 全部反例按预期响应：每条判据都有「它会失败」的证据。')

    # ---------- 归档（改名保留，不做删除）----------
    os.makedirs(RETIRED, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%y%m%d-%H%M%S')
    dst = os.path.join(RETIRED, 'reverse-v14.' + stamp)
    os.replace(SANDBOX, dst)
    print('\n沙箱已归档：%s' % dst)
    print('（历次反例沙箱保留在 _tmp/retired/，供事后复核，不删除）')

    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
