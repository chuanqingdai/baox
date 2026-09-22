#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""原生控件可见性门禁 · **反向验证**（每条判据各配一个只打给它的反例）

项目惯例：新增门禁必须证明它会失败。一条永远不响的断言，只是在日志里占了一行，
却让人以为那一块已经被守住。

本脚本验证 check-native-controls.py 的两条判据。它们各拦一种失效、互不替代，
所以**反例也必须是两个**，且每个只破坏其中一条：

  反例 A · 破坏「结果可见性」判据
    把两条 filter 的值退回修前写法（只动这两个值）。规则仍在场，只是颜色被洗淡。
    期望：报红发生在「对比度仅 …:1」这条上，并带上修前的具体数值。
    **不许**报成「规则未在场」—— 那说明红了，但红在别处（归因错了）。

  反例 B · 破坏「规则在场性」判据（= 本项目真实踩到过的缺陷）
    把 ⑩b 那段说明注释的收尾符删掉。CSS 注释不嵌套，于是注释一路吞到后面
    另一句注释的收尾符，把两条 filter 规则一起圈进去。规则**文本**还在产物里、
    静态门禁全绿，但 CSSOM 里查不到，图标从未上色。
    期望：报红发生在「规则未在场」这条上。
    **不许**只在像素判据上报红 —— 规则不在场时像素读数本就不可信。

  两条反例都必须先证明「自己真的生效了」（改动前后的注释状态要如预期翻转），
  否则得到的红是「反例没做功」，比没有反例更糟。

另外守住两个不变量：
  · panel.css 必须**逐字节**还原（md5 一致）；
  · 还原后重建的产物必须与开工前的产物逐字节相同（md5 一致）。

用法: python3 src/reverse-verify-native-controls.py
      退出码 0 = 两条反例都按预期报红、且源码/产物逐字节还原 / 1 = 不符合预期
"""
import hashlib
import io
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
CSS = os.path.join(BASE, 'panel.css')
PAGE = os.path.join(ROOT, 'index.html')
ARCHIVE = os.path.join(ROOT, 'archive')
PY = sys.executable

# ── 反例 A 的注入点：(修后, 修前) 配对。写成配对而不是「搜关键字替换」，
#    是为了让「改了哪两处」在脚本里一眼可数（踩过「注入点静默落空」）。
PAIRS = [
    ('filter:invert(.68) sepia(1) saturate(3.2) hue-rotate(338deg) brightness(1.22);',
     'filter:invert(.72) sepia(.42) saturate(3.2) hue-rotate(342deg);'),
    ('filter:invert(.92) sepia(1) saturate(3.6) hue-rotate(344deg);',
     'filter:sepia(.5) saturate(2.4) hue-rotate(345deg);'),
]

# ── 反例 B 的注入点：⑩b 说明注释的收尾。删掉其中的收尾符，规则就会掉进注释。
COMMENT_TAIL = '再去量像素。改这两条 filter 之前，先跑那关。 */'

# 判「规则在不在注释里」时盯的这两行（行内不含注释符，行首状态即其状态）
RULE_LINES = [
    '[data-theme="dark"] .set-date::-webkit-calendar-picker-indicator{',
    '[data-theme="light"] .set-date::-webkit-calendar-picker-indicator{',
]


def rd(p):
    return io.open(p, encoding='utf-8').read()


def wr(p, t):
    io.open(p, 'w', encoding='utf-8').write(t)


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def env():
    e = dict(os.environ)
    e['NODE_PATH'] = '/Users/jaydenkong/.workbuddy/binaries/node/workspace/node_modules'
    e['PATH'] = '/opt/homebrew/bin:' + e.get('PATH', '')
    e['CHROME_PATH'] = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    return e


def build():
    r = subprocess.run([PY, os.path.join(BASE, 'build.py'), '--no-gate'],
                       capture_output=True, text=True, env=env(), cwd=ROOT)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def gate():
    r = subprocess.run([PY, os.path.join(BASE, 'check-native-controls.py'), PAGE],
                       capture_output=True, text=True, env=env(), cwd=ROOT)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def comment_states(css):
    """逐字符模拟 CSS 注释语义（注释不嵌套），返回每行**行首**是否处于注释内。"""
    states = []
    incom = False
    for L in css.split('\n'):
        states.append(incom)
        j = 0
        while j < len(L):
            if not incom and L[j:j + 2] == '/*':
                incom = True
                j += 2
                continue
            if incom and L[j:j + 2] == '*/':
                incom = False
                j += 2
                continue
            j += 1
    return states


def rules_in_comment(css):
    """返回 (规则行是否处于注释内 的列表, 是否两行都找到)。行首状态即其状态。"""
    st = comment_states(css)
    found = []
    for i, L in enumerate(css.split('\n')):
        for r in RULE_LINES:
            if L.strip() == r.strip():
                found.append(st[i])
    return found


# ── 两条反例的声明 ──────────────────────────────────────────────────────────
def mutate_a(css):
    out = css
    for new, old in PAIRS:
        out = out.replace(new, old, 1)
    return out


def effect_a(css):
    """反例 A 生效判据：规则仍在注释**外**（只改了值，没改结构）。"""
    f = rules_in_comment(css)
    if len(f) != 2:
        return False, '只找到 %d 条规则行（期望 2）' % len(f)
    if any(f):
        return False, '规则行掉进了注释里 —— 这不是「只改值」的反例，归因会混'
    return True, '两条规则仍在注释外、值已退回修前'


def mutate_b(css):
    return css.replace(COMMENT_TAIL, COMMENT_TAIL.replace(' */', ''), 1)


def effect_b(css):
    """反例 B 生效判据：规则行**必须**处于注释内（否则反例没做功）。"""
    f = rules_in_comment(css)
    if len(f) != 2:
        return False, '只找到 %d 条规则行（期望 2）' % len(f)
    if not all(f):
        return False, '删掉注释收尾符后，规则行**仍在注释外** —— 反例没生效'
    return True, '两条规则已被注释圈住（注释未闭合，一路吞到后一句的收尾符）'


CASES = [
    {
        'name': '反例A · 只把两条 filter 的值退回修前',
        'why': '打「结果可见性」判据：规则在场、颜色被洗淡',
        'mutate': mutate_a, 'effect': effect_a,
        # ⚠️ 判据必须落在 **❌ 行**上，不能用「全文包含某文案」——
        #    门禁的修法提示里同时写着「规则未在场」和「对比度仅 x:1」两句，
        #    用全文包含去判，两种失效的归因会互相污染（本轮实测：反例A 被误判成归因错）。
        'ok': lambda fl: (all('规则未在场' not in x for x in fl)
                          and any(':1' in x for x in fl)),
        'expect': '❌ 行报「对比度仅 …:1」且带修前数值（1.3 / 2.8）',
        'wrong': '❌ 行报成了「规则未在场」—— 红了，但红在别的判据上',
    },
    {
        'name': '反例B · 只删掉说明注释的收尾符（= 本项目真实缺陷）',
        'why': '打「规则在场性」判据：规则文本在产物里但没进 CSSOM',
        'mutate': mutate_b, 'effect': effect_b,
        'ok': lambda fl: any('规则未在场' in x for x in fl),
        'expect': '❌ 行报「规则未在场」',
        'wrong': '❌ 行里没有「规则未在场」—— 这条新断言是死的',
    },
]


def inject_ok(css):
    """注入点核对：两处注入各不相同，先确保它们在场，且**要改的内容真的不同**。"""
    for new, old in PAIRS:
        if css.count(new) != 1:
            return '反例A 注入点「修后」写法出现 %d 次（期望 1）：%s' % (css.count(new), new)
        if css.count(old):
            return '反例A：panel.css 里仍有「修前」写法残留：%s' % old
    if css.count(COMMENT_TAIL) != 1:
        return '反例B 注入点出现 %d 次（期望 1）：%s' % (css.count(COMMENT_TAIL), COMMENT_TAIL)
    if COMMENT_TAIL.replace(' */', '') == COMMENT_TAIL:
        return '反例B 的改动等于没改（收尾符不在注入点里）'
    f = rules_in_comment(css)
    if f != [False, False]:
        return '开工前两条规则行的注释状态应均为 False，实为 %r' % (f,)
    return None


def main():
    css0 = rd(CSS)
    h_css0 = md5(CSS)
    h_prod0 = md5(PAGE) if os.path.exists(PAGE) else None
    arch0 = set(os.listdir(ARCHIVE)) if os.path.isdir(ARCHIVE) else set()
    bad = []

    print('=' * 74)
    print('  原生控件可见性门禁 · 反向验证（两条判据 · 两个反例）')
    print('=' * 74)

    err = inject_ok(css0)
    if err:
        print('❌ %s' % err)
        return 1
    print('注入点核对：反例A 两处、反例B 一处，各恰好 1 次；两条规则均在注释外')
    print('开工前 panel.css md5 %s\n' % h_css0)

    for c in CASES:
        print('-' * 74)
        print('[%s]' % c['name'])
        print('  目的：%s' % c['why'])
        try:
            newcss = c['mutate'](css0)
            ok_eff, msg_eff = c['effect'](newcss)
            if not ok_eff:
                bad.append('%s：反例没生效 —— %s' % (c['name'], msg_eff))
                print('  ❌ 反例没生效：%s' % msg_eff)
                continue
            print('  · 反例生效核对：%s' % msg_eff)
            wr(CSS, newcss)
            rc_b, out_b = build()
            if rc_b != 0:
                bad.append('%s：构建失败（本反例只该让新关报红）' % c['name'])
                print('  ❌ 构建失败：')
                print('     ' + '\n     '.join(out_b.strip().splitlines()[-4:]))
                continue
            rc_g, out_g = gate()
            fails = [ln.strip() for ln in out_g.splitlines() if '❌' in ln]
            ok_lines = [ln.strip() for ln in out_g.splitlines() if '✅' in ln]
            for ln in (fails or ok_lines)[:4]:
                print('    ' + ln)
            if rc_g == 0:
                bad.append('%s：本关**没有**报红（rc=0）—— 这条判据是死的' % c['name'])
                print('  ❌ 门禁没响：这条判据拦不住任何东西')
                continue
            print('  ✅ 门禁按预期报红（rc=%d）' % rc_g)
            if not c['ok'](fails):
                bad.append('%s：报红的位置不对 —— 期望 %s；实际得到 %d 条 ❌ 行'
                           % (c['name'], c['expect'], len(fails)))
                print('  ❌ 归因不对：期望%s' % c['expect'])
                print('     （%s）' % c['wrong'])
            else:
                print('  ✅ 归因正确：%s' % c['expect'])
        finally:
            wr(CSS, css0)

    # ---------- 还原核对 ----------
    h_css1 = md5(CSS)
    if h_css1 != h_css0:
        bad.append('panel.css 未逐字节还原（%s → %s）' % (h_css0, h_css1))
        print('\n❌ 还原失败：panel.css md5 %s → %s' % (h_css0, h_css1))
    else:
        print('\n[还原] panel.css md5 %s —— 与原文件逐字节一致' % h_css1)

    # ---------- 清理反向验证过程中新增的归档 ----------
    # 构建会按内容另存归档（本次反例制造了 2~3 种不同内容）。判据用**精确名字集合差**，
    # 不落在名字前缀上 —— 踩过「收纳目录自己的名字也以 _patch 开头，被自己的条件选中」。
    new_arch = sorted(set(os.listdir(ARCHIVE)) - arch0) if os.path.isdir(ARCHIVE) else []
    for f in new_arch:
        os.remove(os.path.join(ARCHIVE, f))
    if new_arch:
        print('[清理] 移除反向验证过程产生的 %d 份归档：%s'
              % (len(new_arch), ', '.join(new_arch)))

    # ---------- 对照：还原后必须全绿，且产物逐字节不变 ----------
    rc_b2, out_b2 = build()
    if rc_b2 != 0:
        bad.append('还原后构建失败')
    rc_g2, out_g2 = gate()
    print('[对照] 还原后重建 + 本关 rc=%d' % rc_g2)
    if rc_g2 != 0:
        bad.append('还原后本关仍报红 —— 修后规则不该失败')
        print('  ' + '\n  '.join(out_g2.strip().splitlines()[-4:]))
    else:
        for ln in out_g2.splitlines():
            if ':1' in ln:
                print('  ' + ln.strip())

    h_prod1 = md5(PAGE) if os.path.exists(PAGE) else None
    if h_prod0 and h_prod1 and h_prod0 != h_prod1:
        bad.append('还原后产物与开工前不同（md5 %s → %s）—— 源码还原了，产物却漂移'
                   % (h_prod0, h_prod1))
        print('  ❌ 产物 md5 漂移：%s → %s' % (h_prod0, h_prod1))
    else:
        print('  ✅ 产物 md5 %s —— 与开工前逐字节一致' % h_prod1)

    print('\n' + '=' * 74)
    if bad:
        print('❌ 反向验证未通过：')
        for b in bad:
            print('   -', b)
        return 1
    print('🎉 反向验证通过：两条判据各自都拦住了只打给它的那个反例，')
    print('   且 panel.css / 产物均逐字节还原')
    return 0


if __name__ == '__main__':
    sys.exit(main())
