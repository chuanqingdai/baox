#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.3 反例验证 · 证明本轮新增的判据真的会失败

项目惯例：**新增门禁/断言必须证明它会失败**。一条永远不响的断言，
只是在构建日志里占了一行。

本轮（v1.2e / v1.2g / v1.3）新增或改写的判据共 5 组：
  ① 探针改为**按语言分段**剥注释（v1.2e）—— 改的是实现，但它决定了
     74 项 MUST 的判定基准，回退会立刻把真代码吃掉；
  ② 自定义身份的 6 个 id（MUST，逐 id 列出）；
  ③ 身份存储键判**赋值语句**（MUST_RE）；
  ④ 身份键与业绩键**必须分家**（门禁 A-3 扩展）；
  ⑤ 版本字面量三处一致（门禁 A-5，新增）。

做法与 v1.2 相同：搭**影子沙箱**（_tmp/reverse-v13/），复制 src/ data/ libs/ assets/，
在副本上注入反例，跑副本自己的 build.py，看它是否按预期红灯。
为什么不改本尊：本尊是唯一的事实来源，改坏了没有 git 可回滚。

⚠️ 反例的四条硬规矩（本项目踩过的坑，逐条落到代码里）：
  1. **同一失效模式的每种载体各配一例** —— 「注释接管在场判定」有 HTML 注释与
     JS 块注释两种语法，B/E 各一例。
  2. **写反例前先核对注入点真的存在，且出现次数正确** —— 用 mut() 守卫：
     没找到（或找到多处）就立刻中止，不静默走 fallback。
     实测踩过：想往 `<div class="stat-grid"` 前插一行，而该串**在源文件里不存在**，
     静默走了 fallback，于是那条反例压根没生效 —— 它给出的 ✅ 是「反例没做功」，
     比没有反例更糟。还踩过：某个键带引号的字面量全文件只有 1 处、另有 5 处在
     注释里，若按直觉「替换第一处」会残留真代码 → 反例**不红** →
     于是得出「这条断言是假的」这个**错误结论**。故本次一律先 count 再改。
  3. **一次只破坏一个判据** —— 一次破坏多个，报错只能说明「判定会响」，
     无法证明任何单条判据不是多余的。
     ⚠️ 唯一的例外是 K 例，理由见下（J/K 成对使用才成立）。
  4. 沙箱准备时的过滤条件要落在「文件」上，不能落在「名字前缀」上
     （收纳目录 `_patches_not_needed` 自己的名字就以 `_patch` 开头）。

十四个 case：

  0  对照：副本原样 → 必须**全绿**
  A  旧 KPI 卡回来（body.html 塞回 id="kDays"）→ 「旧 KPI 打卡天数残留」
  B  真代码里的 g-self-top 被删、**HTML 注释留着** → 「缺少 网格列表顶对齐类」
  C  targets 加回 month → 「targets 键应恰为」
  D  持久化键回退（baox.act.data.v2 → baox.act.data）→ 「缺少 基线覆盖层键」
  E  D + 补一句提到新键的注释 → 仍必须红（**在场方向假绿**的正面自证）
  F  探针 LS_KEY 漂移 → 「存储键漂移」
  G  归档目录放入同内容副本 → 「归档集合里存在内容相同的副本」
  H  幂等重跑两次 → 全绿且归档数不变（第2次 == 第1次）
  I  探针写回**全局剥注释**（v1.2e 的前身）→ 必须红，且必须报「缺少 轻提示」。
     这是本轮最值钱的一条：它证明 v1.2e 的分段剥离**不是洁癖** ——
     回退成全局剥离，产物 HTML 里那对无配对的 `/*`（accept="image/*"）
     会一路吃到后面 JS 块注释的结尾，把 `<div id="toast">` 与
     `<input id="avatarFile">` 整段吞掉，断言于是报「元素缺失」而元素明明在场。
  J  身份键回退到旧名（identity.v1 → identity）→ 「缺少 身份覆盖层键」
  K  两键同名（把 LS_ID 改成业绩键的值，并**同步更新 build.py 里那条
     钉死身份键的 MUST_RE**）→ 只报「身份键与业绩键相同」。
     ⚠️ 这一例首版写错了，错得值得记：只改 core.js 的话，**门禁 A 会先报
     「缺少 身份覆盖层键」并 sys.exit(1)**，门禁 A-3 根本轮不到执行 ——
     分家判据看起来像死代码。这说明一条更普遍的规则：
     **排在会 sys.exit 的门禁后面的判据，会被前置门禁遮蔽；
     要证明它不是死代码，反例必须先把前置门禁喂饱。**
     喂饱的做法（同步更新那个被钉死的字面量）正好对应真实场景：
     维护者改键名时必然同步改锁，而那一刻唯一还能拦住两键撞车的就是 A-3。
     喂饱之后门禁 A 全绿，A-3 是唯一报红处 → 单判据隔离成立。
     （K 用例额外断言「不得出现 内容断言失败」，把这条隔离性钉死。）
  L  版本字面量漂移（body.html 把 #verBadge 改回 v1.2）→ 「版本漂移」
  M  DOM 里的 id="brandReset" 被改掉（app.js 仍引用它）→
     「缺少 头像还原按钮」。这正是逐 id MUST 的价值：JS 侧照样 `el('brandReset')`，
     不报错、不抛异常，只是还原按钮永远不存在 —— 静态断言是唯一的拦路者。

跑完把沙箱**改名归档**到 _tmp/retired/（不做删除）。
"""
import glob
import io
import os
import shutil
import subprocess
import sys
import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
SANDBOX = os.path.join(ROOT, '_tmp', 'reverse-v13')
RETIRED = os.path.join(ROOT, '_tmp', 'retired')
PY = sys.executable


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


def build(shadow):
    env = dict(os.environ)
    env['PATH'] = '/opt/homebrew/bin:' + env.get('PATH', '')
    r = subprocess.run([PY, os.path.join(shadow, 'src', 'build.py')],
                       capture_output=True, text=True, env=env, cwd=shadow)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def n_archives(shadow):
    return len(glob.glob(os.path.join(shadow, 'archive', 'activity-v*.html')))


def main():
    # ---------- 搭沙箱 ----------
    if os.path.exists(SANDBOX):
        stamp = datetime.datetime.now().strftime('%H%M%S')
        os.replace(SANDBOX, SANDBOX + '.' + stamp)
    os.makedirs(SANDBOX, exist_ok=True)
    for d in ('src', 'data', 'libs', 'assets'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(SANDBOX, d))
    # 收纳历次补丁脚本：它们不参与构建，留着反而是「构建依赖了什么」的假线索。
    # ⚠️ 过滤条件必须落在**文件**上：收纳目录自己的名字就以 `_patch` 开头，
    #    不排除会试图把它搬进它自己（实测 PermissionError EINVAL rename）。
    patchdir = os.path.join(SANDBOX, 'src', '_patches_not_needed')
    os.makedirs(patchdir, exist_ok=True)
    for f in os.listdir(os.path.join(SANDBOX, 'src')):
        if os.path.isdir(os.path.join(SANDBOX, 'src', f)):
            continue
        if f.startswith('_patch') or f.endswith('.bak.py'):
            os.replace(os.path.join(SANDBOX, 'src', f), os.path.join(patchdir, f))
    print('沙箱就绪：%s\n' % SANDBOX)

    # ---------- 反例注入点守卫 ----------
    # 规矩 2：动手前先核对注入点真的存在、且出现次数就是 n。
    # 不核对的话，注入失败会静默走 fallback，反例「没做功」却报 ✅。
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

    def case(name, expect_rc_nonzero, must_contain, mutate=None, restore=None,
             must_absent=None):
        try:
            if mutate:
                mutate()
        except NoInjection as e:
            results.append((name, False, -1))
            print('❌ %s（注入失败，反例没做功）\n      | %s\n' % (name, e))
            return
        rc, out = build(SANDBOX)
        if restore:
            restore()
        if expect_rc_nonzero:
            hit = must_contain in out
            passed = (rc != 0) and hit
            why = ('未按预期红灯' if rc == 0 else
                   ('红灯了但报的是别的原因（找不到「%s」）' % must_contain)
                   if not hit else '')
            if passed and must_absent and must_absent in out:
                passed = False
                why = '报红原因失控：出现了不该出现的「%s」' % must_absent
        else:
            passed = rc == 0
            why = '' if passed else '本应全绿却红了'
        results.append((name, passed, rc))
        print('%s %s（exit=%d）%s'
              % ('✅' if passed else '❌', name, rc, ('  ← ' + why) if why else ''))
        if not passed:
            for l in out.strip().split('\n')[-14:]:
                print('      | ' + l[:170])
        print()

    # ---------- 0 对照 ----------
    case('0  对照：副本原样必须全绿', False, '', None, None)
    base_archives = n_archives(SANDBOX)

    body = os.path.join(SANDBOX, 'src', 'body.html')
    css = os.path.join(SANDBOX, 'src', 'panel.css')
    core = os.path.join(SANDBOX, 'src', 'core.js')
    data = os.path.join(SANDBOX, 'data', 'activity.json')
    probe_cjs = os.path.join(SANDBOX, 'src', 'probe-interactions.cjs')
    build_py = os.path.join(SANDBOX, 'src', 'build.py')

    def restore_all():
        for p, keep in snaps.items():
            wr(p, keep)

    snaps = {
        body: rd(body), css: rd(css), core: rd(core),
        data: rd(data), probe_cjs: rd(probe_cjs), build_py: rd(build_py),
    }

    # ---------- A 旧 KPI 卡回来 ----------
    # ⚠️ 注入锚点是 `<div id="toast"></div>`，不是 v1.2 那版用的
    #    `<div class="stat-grid"` —— 后者在 body.html 里**已经不存在**了。
    #    （本次首跑就是被 mut() 的计数守卫拦下来的：若照抄旧锚点并静默走
    #     fallback，这条反例压根不会生效，却会报 ✅ —— 那比没有反例更糟。）
    case('A  旧 KPI 卡 id="kDays" 回来 → 必须红',
         True, '旧 KPI 打卡天数残留',
         lambda: mut(body, '<div id="toast"></div>',
                     '<div id="kDays">旧卡</div>\n<div id="toast"></div>'),
         restore_all)

    # ---------- B 真代码里的对齐标记被删（**保留** HTML 注释）----------
    # 与 E 成对：同一种失效模式（注释接管在场判定），两种注释语法各一例 ——
    # E 是 JS 块注释 /* */，B 是 HTML 注释 <!-- -->。v1.2d 之前只剥块注释，
    # B 例构建**全绿**（假绿）；现在剥三种，B 例必须红。
    case('B  真代码里的 g-self-top 被删（保留 HTML 注释）→ 必须红',
         True, '网格列表顶对齐类 g-self-top',
         lambda: (mut(body, '<div class="panel g-self-top">', '<div class="panel">'),
                  mut(css, '.g-self-top{align-self:start;}', '')),
         restore_all)

    # ---------- C targets 加回 month ----------
    case('C  targets 加回 month → 必须红',
         True, 'targets 键应恰为',
         lambda: mut(data, '"targets": {', '"targets": {\n    "month": 70000,'),
         restore_all)

    # ---------- D 持久化键回退到旧名 ----------
    KEY_OLD = "'baox.act.data.v2'"
    KEY_DATA = "'baox.act.data'"
    case('D  存储键改回旧名（注释保持不变）→ 必须红',
         True, '基线覆盖层键',
         lambda: mut(core, KEY_OLD, KEY_DATA),
         restore_all)

    # ---------- E D + 补一句替它说话的注释 ----------
    # 「在场方向假绿」的正面自证：修前判在**未去注释**文本上，
    # 注释里的这串字会让改回旧键的代码照样通过。
    def _e_mutate():
        cur = rd(core).replace(KEY_OLD, KEY_DATA, 1)
        wr(core, cur + '\n/* 存档说明：本项目的覆盖层键是 baox.act.data.v2'
                       '（这句只是注释，不是代码） */\n')
    case('E  存储键改回旧名 + 注释里提到新键 → 仍必须红',
         True, '基线覆盖层键', _e_mutate, restore_all)

    # ---------- F 探针键漂移 ----------
    case('F  探针 LS_KEY 与 core.js LS_DATA 漂移 → 必须红',
         True, '存储键漂移',
         lambda: mut(probe_cjs, 'const LS_KEY = %s;' % KEY_OLD,
                     'const LS_KEY = %s;' % KEY_DATA),
         restore_all)

    # ---------- G 归档目录里出现同内容副本 ----------
    sand_arch = os.path.join(SANDBOX, 'archive')
    have = sorted(glob.glob(os.path.join(sand_arch, 'activity-v*.html')))
    if have:
        # ⚠️ 副本的名字必须用**当前**版本号：门禁 F 有两条判据，先判
        #    「文件名里的版本 vs 内容里的版本」，再判「有没有同内容副本」。
        #    上一版这里写的是 v1.2，产品升到 v1.3 后第一条先响，
        #    于是它报的是「归档文件名与内容不符」—— 反例红了，
        #    但红的不是要测的那条判据（这就是「报的是别的原因」）。
        dupname = os.path.join(sand_arch, 'activity-v1.3-260919-000000.html')

        def _restore_dup():
            if os.path.exists(dupname):
                os.makedirs(RETIRED, exist_ok=True)
                os.replace(dupname, os.path.join(
                    RETIRED, 'reverse-v13-dup-' + os.path.basename(dupname)
                    + '.' + datetime.datetime.now().strftime('%H%M%S')))

        case('G  归档目录里放入同内容副本 → 必须红',
             True, '归档集合里存在内容相同的副本',
             lambda: shutil.copyfile(have[0], dupname), _restore_dup)
    else:
        print('⏭  G 跳过：沙箱内未产生归档，无法构造重复\n')

    # ---------- I 探针写回全局剥注释 ----------
    # v1.2e 的分段剥离回退成「一把正则刷全篇」。产物 HTML 区里有一对无配对的
    # `/*`（accept="image/*"，是真代码不是注释），全局剥离会从那里一路吃到
    # 后面 JS 块注释的结尾，把 <div id="toast"> 与 <input id="avatarFile"> 吞掉。
    GLOBAL_STRIP = ("    probe_html = re.sub(r'/\\*.*?\\*/', '', html, flags=re.S)\n"
                    "    probe_html = re.sub(r'<!--.*?-->', '', probe_html, flags=re.S)\n"
                    "    probe_html = re.sub(r'^\\s*//.*$', '', probe_html, flags=re.M)")
    case('I  探针写回「全局剥注释」→ 必须红（真代码被当成注释吃掉）',
         True, '缺少 轻提示',
         lambda: mut(build_py, '    probe_html = probe_of(html)', GLOBAL_STRIP),
         restore_all)

    # ---------- J 身份键回退到旧名（仍与业绩键不同）----------
    # 只破坏 MUST_RE「身份覆盖层键」。
    case('J  身份键退回旧名 → 必须报「缺少 身份覆盖层键」',
         True, '缺少 身份覆盖层键',
         lambda: mut(core, "'baox.act.identity.v1'", "'baox.act.identity'"),
         restore_all)

    # ---------- K 两键同名（并把被钉死的字面量一起更新）----------
    # ⚠️ 首版写错了，错得很值得记：只把 core.js 的 LS_ID 改成业绩键的值，
    #    结果**门禁 A 先报「缺少 身份覆盖层键」并 sys.exit(1)**，
    #    门禁 A-3 根本轮不到执行 —— 分家判据看起来像死代码。
    #    也就是说：**排在一个会 sys.exit 的门禁后面的判据，会被前置门禁遮蔽**，
    #    这不是判据没用，是反例没喂饱前置条件。
    # 修法：同步更新 build.py 里那条钉死身份键的 MUST_RE 字面量。
    #    这不是「为了让它红而改门禁」—— 真实场景本就是维护者同步改那个字面量
    #    （比如把身份键升到 v2），而那一刻唯一还能拦住两键撞车的就只有 A-3。
    #    喂饱之后：门禁 A 全绿，门禁 A-3 是**唯一**报红的地方 → 单判据隔离成立。
    MUSTRE_ID = r"""        '身份覆盖层键': r"var\s+LS_ID\s*=\s*'baox\.act\.identity\.v1'","""
    MUSTRE_ID2 = r"""        '身份覆盖层键': r"var\s+LS_ID\s*=\s*'baox\.act\.data\.v2'","""

    def _k_mutate():
        mut(core, "'baox.act.identity.v1'", KEY_OLD)
        mut(build_py, MUSTRE_ID, MUSTRE_ID2)

    case('K  两键同名（锁同步更新）→ 只报「身份键与业绩键相同」',
         True, '身份键与业绩键相同', _k_mutate, restore_all,
         # 「只报」不是嘴上说的：若门禁 A 也报红，就说明前置门禁又把它遮住了，
         # 而这条反例就不再能证明 A-3 是活的。
         must_absent='内容断言失败')

    # ---------- L 版本字面量漂移 ----------
    case('L  body.html 的 #verBadge 改回 v1.2 → 必须报「版本漂移」',
         True, '版本漂移',
         lambda: mut(body, 'id="verBadge">v1.3<', 'id="verBadge">v1.2<'),
         restore_all)

    # ---------- M DOM 里的 brandReset 被改名（JS 仍引用它）----------
    case('M  DOM 的 id="brandReset" 被改掉（app.js 仍引用）→ 必须红',
         True, '缺少 头像还原按钮',
         lambda: mut(body, 'id="brandReset"', 'id="brandResetX"'),
         restore_all)

    # ---------- H 幂等重跑（正面自证，不走 case 助手）----------
    # ⚠️ 基准是**第 1 次**而不是 base：沙箱的 archive/ 是从本尊复制来的，
    #    里面那份同名归档装的是本尊更早一次构建的内容，必然与本轮沙箱产物
    #    不同 —— 第 1 次构建合法地多分叉出一个归档。所以「幂等」该比的是
    #    「第 2 次 vs 第 1 次」，拿 base 比会把这个必然发生的一次分叉
    #    误判成「去重失效」（v1.2 首版就是这么写错的）。
    rc1, out1 = build(SANDBOX)
    n1 = n_archives(SANDBOX)
    rc2, out2 = build(SANDBOX)
    n2 = n_archives(SANDBOX)
    ok = (rc1 == 0 and rc2 == 0 and n2 == n1)
    results.append(('H  幂等重跑两次：全绿且归档数不变', ok, rc2))
    print('%s H  幂等重跑两次 → 必须全绿且归档数不变（沙箱初始=%d，第1次=%d，第2次=%d，'
          '判据：第2次==第1次）%s'
          % ('✅' if ok else '❌', base_archives, n1, n2,
             '' if ok else '  ← 归档去重失效：重跑堆出了同内容副本'))
    if not ok:
        for l in (out1 + out2).strip().split('\n')[-14:]:
            print('      | ' + l[:170])
    print()

    # ---------- 收尾：改名归档沙箱 ----------
    os.makedirs(RETIRED, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%H%M%S')
    os.replace(SANDBOX, os.path.join(RETIRED, 'reverse-v13.' + stamp))

    n_ok = sum(1 for _, p, _ in results if p)
    print('─' * 64)
    if n_ok == len(results):
        print('🎉 反例验证通过：%d/%d —— 本轮新增的判据各自都能拦住对应的失效模式'
              % (n_ok, len(results)))
        return 0
    print('❌ 反例验证未通过：%d/%d' % (n_ok, len(results)))
    for name, p, rc in results:
        if not p:
            print('   - %s（exit=%d）' % (name, rc))
    return 1


if __name__ == '__main__':
    sys.exit(main())
