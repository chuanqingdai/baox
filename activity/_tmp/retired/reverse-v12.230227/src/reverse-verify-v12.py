#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v1.2 反例验证 · 证明本轮新增的断言真的会失败

项目惯例：**新增门禁/断言必须证明它会失败**。一条永远不响的断言，
只是在构建日志里占了一行。本轮往 build.py 里加的新判据（8 张 KPI 卡的 MUST、
`g-self-top` 的 MUST_RE、10 条 MUST_NOT 墓碑、targets 键集合与周目标口径、
存储键的赋值语句判据、门禁 A-3 跨文件一致性、门禁 F 归档内容去重）必须逐条
证明它们能拦住对应的失效模式。

做法：搭一个**影子沙箱**（_tmp/reverse-v12/），把 src/ data/ libs/ assets/
复制一份，在副本上注入反例，跑副本自己的 build.py，看它是否按预期红灯。
为什么不改本尊：本尊是唯一的事实来源，改坏了没有 git 可回滚。

九个 case，每例**只破坏一个判据**（一次破坏多个，报错只能说明「判定会响」，
无法证明任何单条判据不是多余的）：

  0  对照：副本原样 → 必须**全绿**（否则后面几个反例的红都说明不了什么）
  A  旧 KPI 卡回来（body.html 里塞回 id="kDays"）→ 必须报「旧 KPI 打卡天数残留」
  B  混合行的子项级对齐标记被删（body.html + panel.css 同时去掉 g-self-top）
     → 必须报「缺少 网格列表顶对齐类 g-self-top」
  C  目标参数回退（activity.json 的 targets 加回 month）→ 必须报「targets 键应恰为」
  D  持久化键回退（core.js 的 baox.act.data.v2 改回 baox.act.data）
     → 必须报「缺少 基线覆盖层键」
  E  D + 在 core.js 里**补一句提到新键的注释** → 仍必须报「缺少 基线覆盖层键」。
     这是本轮修掉的「在场方向假绿」的正面自证：
     修前判在未去注释的产物上，产物里那 5 处提到该键的注释会让它照样通过；
     修后判在去注释文本 + 赋值语句上，注释写多少遍都不算。
     D 与 E 的差别只在「有没有注释在替它说话」，所以这两个 case 一起才说明
     「注释无法接管在场判定」。
  F  探针键漂移（probe-interactions.cjs 的 LS_KEY 改成旧名）
     → 必须报「存储键漂移」
  G  归档目录里出现同内容副本 → 必须报「归档集合里存在内容相同的副本」
  H  幂等重跑（连续两次构建）→ 必须全绿，且归档数量**不变**。
     这一条不是「反例」而是正面自证：归档去重的修复一旦回退，
     连跑两次就会多出一份逐字节相同的归档，而 H 会立刻发现。

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
SANDBOX = os.path.join(ROOT, '_tmp', 'reverse-v12')
RETIRED = os.path.join(ROOT, '_tmp', 'retired')
PY = sys.executable


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


def build(shadow):
    """跑副本自己的 build.py，返回 (returncode, 合并输出)。"""
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
        # 上一轮的沙箱先改名归档，绝不原地覆盖（原名留着，加时间戳）
        stamp = datetime.datetime.now().strftime('%H%M%S')
        os.replace(SANDBOX, SANDBOX + '.' + stamp)
    os.makedirs(SANDBOX, exist_ok=True)
    for d in ('src', 'data', 'libs', 'assets'):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(SANDBOX, d))
    # 复制过来的 src/ 里有历次补丁脚本，不需要 —— 它们不参与构建，
    # 留着反而是「构建依赖了什么」的假线索。改名移出（不删除）。
    patchdir = os.path.join(SANDBOX, 'src', '_patches_not_needed')
    os.makedirs(patchdir, exist_ok=True)
    for f in os.listdir(os.path.join(SANDBOX, 'src')):
        # ⚠️ 必须跳过目录：上面那个收纳目录自己的名字就以 `_patch` 开头，
        #    不排除的话它会被自己的过滤条件选中，然后试图搬进它自己
        #    （实测：PermissionError EINVAL rename ... -> .../_patches_not_needed/
        #     _patches_not_needed）。判据要落在「文件」上，不是「名字前缀」上。
        if os.path.isdir(os.path.join(SANDBOX, 'src', f)):
            continue
        if f.startswith('_patch') or f.endswith('.bak.py'):
            os.replace(os.path.join(SANDBOX, 'src', f),
                       os.path.join(patchdir, f))
    print('沙箱就绪：%s\n' % SANDBOX)

    results = []

    def case(name, expect_rc_nonzero, must_contain, mutate=None, restore=None):
        if mutate:
            mutate()
        rc, out = build(SANDBOX)
        if restore:
            restore()
        if expect_rc_nonzero:
            hit = must_contain in out
            passed = (rc != 0) and hit
            why = ('未按预期红灯' if rc == 0 else
                   ('红灯了但报的是别的原因（找不到「%s」）' % must_contain)
                   if not hit else '')
        else:
            passed = rc == 0
            why = '' if passed else '本应全绿却红了'
        results.append((name, passed, rc))
        print('%s %s（exit=%d）%s'
              % ('✅' if passed else '❌', name, rc, ('  ← ' + why) if why else ''))
        if not passed:
            tail = out.strip().split('\n')[-14:]
            for l in tail:
                print('      | ' + l[:170])
        print()

    # ---------- 0 对照 ----------
    case('0  对照：副本原样必须全绿', False, '', None, None)
    base_archives = n_archives(SANDBOX)

    # ---------- A 旧 KPI 卡回来 ----------
    body = os.path.join(SANDBOX, 'src', 'body.html')
    orig_body = rd(body)
    case('A  旧 KPI 卡 id="kDays" 回来 → 必须红',
         True, '旧 KPI 打卡天数残留',
         lambda: wr(body, orig_body.replace(
             '<div class="stat-grid"', '<div id="kDays">旧卡</div>\n<div class="stat-grid"', 1)
             if '<div class="stat-grid"' in orig_body else
             orig_body + '\n<div id="kDays">旧卡</div>\n'),
         lambda: wr(body, orig_body))

    # ---------- B 子项级对齐标记被删 ----------
    css = os.path.join(SANDBOX, 'src', 'panel.css')
    orig_css = rd(css)
    # ⚠️ 必须同时删两处：判据判的是产物全文，只删 body.html 里的类名，
    #    panel.css 的规则仍会让它「在场」—— 这本身也是「判据落在字符序列上」
    #    的一个实例，故反例要老实删干净。
    case('B  g-self-top 标记被删（body.html + panel.css）→ 必须红',
         True, '网格列表顶对齐类 g-self-top',
         lambda: (wr(body, rd(body).replace('panel g-self-top', 'panel', 1)),
                  wr(css, orig_css.replace('.g-self-top{align-self:start;}', ''))),
         lambda: (wr(body, orig_body), wr(css, orig_css)))

    # ---------- C targets 加回 month ----------
    data = os.path.join(SANDBOX, 'data', 'activity.json')
    orig_data = rd(data)
    case('C  targets 加回 month → 必须红',
         True, 'targets 键应恰为',
         lambda: wr(data, orig_data.replace('"targets": {', '"targets": {\n    "month": 70000,', 1)),
         lambda: wr(data, orig_data))

    # ---------- D 持久化键回退到旧名 ----------
    core = os.path.join(SANDBOX, 'src', 'core.js')
    orig_core = rd(core)
    KEY_OLD = "'baox.act.data.v2'"
    KEY_NEW = "'baox.act.data'"
    case('D  存储键改回旧名（注释保持不变）→ 必须红',
         True, '基线覆盖层键',
         lambda: wr(core, orig_core.replace(KEY_OLD, KEY_NEW, 1)),
         lambda: wr(core, orig_core))

    # ---------- E D + 补一句替它说话的注释 ----------
    # 「在场方向的假绿」的正面自证：修前判在**未去注释**文本上，
    # 注释里的这串字会让改回旧键的代码照样通过。
    case('E  存储键改回旧名 + 注释里提到新键 → 仍必须红',
         True, '基线覆盖层键',
         lambda: wr(core, orig_core.replace(KEY_OLD, KEY_NEW, 1)
                    + "\n/* 存档说明：本项目的覆盖层键是 baox.act.data.v2"
                      "（这句只是注释，不是代码） */\n"),
         lambda: wr(core, orig_core))

    # ---------- F 探针键漂移 ----------
    probe_cjs = os.path.join(SANDBOX, 'src', 'probe-interactions.cjs')
    orig_probe = rd(probe_cjs)
    case('F  探针 LS_KEY 与 core.js LS_DATA 漂移 → 必须红',
         True, '存储键漂移',
         lambda: wr(probe_cjs, orig_probe.replace("const LS_KEY = %s;" % KEY_OLD,
                                                  "const LS_KEY = %s;" % KEY_NEW, 1)),
         lambda: wr(probe_cjs, orig_probe))

    # ---------- G 归档目录里出现同内容副本 ----------
    sand_arch = os.path.join(SANDBOX, 'archive')
    have = sorted(glob.glob(os.path.join(sand_arch, 'activity-v*.html')))
    if have:
        dupname = os.path.join(sand_arch, 'activity-v1.2-260918-000000.html')

        def _restore_dup():
            if os.path.exists(dupname):
                os.makedirs(RETIRED, exist_ok=True)
                os.replace(dupname, os.path.join(
                    RETIRED, 'reverse-v12-dup-' + os.path.basename(dupname)
                    + '.' + datetime.datetime.now().strftime('%H%M%S')))

        case('G  归档目录里放入同内容副本 → 必须红',
             True, '归档集合里存在内容相同的副本',
             lambda: shutil.copyfile(have[0], dupname),
             _restore_dup)
    else:
        print('⏭  G 跳过：沙箱内未产生归档，无法构造重复\n')

    # ---------- H 幂等重跑（正面自证，不走 case 助手）----------
    rc1, out1 = build(SANDBOX)
    n1 = n_archives(SANDBOX)
    rc2, out2 = build(SANDBOX)
    n2 = n_archives(SANDBOX)
    ok = (rc1 == 0 and rc2 == 0 and n1 == base_archives and n2 == base_archives)
    results.append(('H  幂等重跑两次：全绿且归档数不变', ok, rc2))
    print('%s H  幂等重跑两次 → 必须全绿且归档数不变（base=%d，第1次=%d，第2次=%d）%s'
          % ('✅' if ok else '❌', base_archives, n1, n2,
             '' if ok else '  ← 归档去重失效：重跑堆出了同内容副本'))
    if not ok:
        for l in (out1 + out2).strip().split('\n')[-14:]:
            print('      | ' + l[:170])
    print()

    # ---------- 收尾：改名归档沙箱 ----------
    os.makedirs(RETIRED, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%H%M%S')
    os.replace(SANDBOX, os.path.join(RETIRED, 'reverse-v12.' + stamp))

    n_ok = sum(1 for _, p, _ in results if p)
    print('─' * 64)
    if n_ok == len(results):
        print('🎉 反例验证通过：%d/%d —— 本轮新增的断言各自都能拦住对应的失效模式'
              % (n_ok, len(results)))
        return 0
    print('❌ 反例验证未通过：%d/%d' % (n_ok, len(results)))
    for name, p, rc in results:
        if not p:
            print('   - %s（exit=%d）' % (name, rc))
    return 1


if __name__ == '__main__':
    sys.exit(main())
