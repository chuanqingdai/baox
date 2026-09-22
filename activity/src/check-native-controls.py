#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""加验 · 原生控件的**可见性**（伪元素对比度）

为什么单列一关（这一类缺陷现有门禁一条都拦不住）：
  · 对比度门禁（mianban/check-contrast.cjs）只扫「**直接含文字**的元素」，
    逐个合成背景色再比。而日历图标、number 的微调箭头是浏览器画在控件
    **内部**的伪元素（::-webkit-*-indicator / inner-spin-button），
    既不在 DOM 里、也没有文本节点 —— 门禁的取样范围根本覆盖不到它。
  · 静态门禁判的是「规则在不在场」，判不出「颜色看不看得见」：
    规则写得完全合法，只是 filter 把浅色字形继续洗淡了。

实测（v1.4，本关诞生的现场）：
  产物带 <meta name="color-scheme" content="dark light">，浏览器据此
  按**深色模式**绘制原生控件 → 日历字形本身是**浅色**的。
  深色主题下它落深底上勉强可见；米金主题下落在 #fff 白底上，
  filter 只做 sepia+saturate（对浅色字形等于继续洗淡）→ **1.33:1**，
  视觉上等于没有这个图标。而当时十关全绿。

判据（两道，缺一不可）：
  ① 规则的**在场性**：两套主题各查一次 CSSOM，确认该主题的
     [data-theme=x] .set-date::-webkit-calendar-picker-indicator
     确实被浏览器解析进来了。不在场就直接判死，**不拿像素读数下结论**。
  ② 规则的**结果可见性**：各截一次控件**最右侧的图标区**，逐像素测
     「图标墨色 vs 控件底色」的 WCAG 对比度，低于阈值即 exit 1。

  ⚠️ 为什么要两道：它们各拦一种失效，互不替代。
     · 只有 ① 拦不住「规则在场、但颜色被洗淡」（实测 1.33:1 那次）；
     · 只有 ② 拦不住「规则压根没生效」——实测（v1.4）：src/panel.css 里
       一段说明注释漏了收尾符，把紧跟其后的两条 filter 规则一起吞进注释，
       CSSOM 里查不到它们；而**手工把同样的值注入页面**测试却显示「达标」
       （那测的是别的东西），产物里的图标其实从来没有上过色。
  ⚠️ 为什么不能用 getComputedStyle(元素, 伪元素) 代替 ①：
     实测（同一把 API、同一页面，一次测清）：它对显式设置过的普通伪元素是准的
     —— `#setBody::before{filter:invert(.4) saturate(2);width:7px;height:9px}`
     能原样读出 filter/width/height/content；但对**浏览器内部绘制的**伪元素，
     它返回的是**元素自身**的值：
       · `#winStart::-webkit-calendar-picker-indicator` → filter:none、158px×33px（= input 的尺寸）
       · 数字框 `::-webkit-inner-spin-button`            → filter:none、136px×31px（= input 的尺寸）
     于是「读 filter 看有没有上色」这件事**无论规则在不在场都返回 none**，
     读了只会得出「没生效」这个错误结论。所以只有两条路可靠：
     规则在场性看 CSSOM 的 selectorText（判据 ①），结果可见性逐像素量（判据 ②）。
  ⚠️ 遍历 CSSOM 判「是不是样式规则」要看 selectorText，不能看 cssRules：
     现代 Chrome 里 CSSStyleRule 也有 cssRules（嵌套 CSS 的空列表），
     用 `if (r.cssRules)` 当容器判据会把所有样式规则都跳过，永远报 0 条 ——
     本轮据此差点得出「规则没进 CSSOM」这个恰好正确、但推理错误的结论。

用法: python3 src/check-native-controls.py [页面路径] [--min=3.0]
      退出码 0 = 两道判据都过 / 1 = 有判据未过（规则未在场 或 对比度不足）
             / 2 = 环境缺依赖
前置: puppeteer-core 在 NODE_PATH 里；PIL 可用（本机受管 Python 已装）。
      —— 本脚本用 Python 跑 Puppeteer 的**截图**，像素分析留在 Python 侧：
         不引入新的图像依赖，也不要求门禁换成 Python 重写。
"""
import io
import json
import os
import re
import subprocess
import sys
import tempfile

try:
    from PIL import Image
except ImportError:
    print('!! 缺少 Pillow，请先: pip install pillow')
    sys.exit(2)

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
NODE = '/Users/jaydenkong/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'
NODE_PATH = '/Users/jaydenkong/.workbuddy/binaries/node/workspace/node_modules'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

argv = sys.argv[1:]
PAGE = next((a for a in argv if not a.startswith('--')),
            os.path.join(ROOT, 'index.html'))
MIN = next((float(a.split('=', 1)[1]) for a in argv if a.startswith('--min=')), 3.0)

# 被测对象：控件的「图标区」宽度（CSS px）与它属于哪个选择器。
# 只测**已经在用**的原生控件，不泛化到全页 —— 泛化会引入一堆
# 「本来就该弱」的装饰性伪元素，把真缺陷淹掉（噪音探测器等于没有探针）。
# ⚠️ sel 与 rule_sel 必须分开：sel 是**页面上要量的元素**，
#    rule_sel 是**规则里写的那段选择器**。两者常不是同一个东西
#    （这里的规则写在 .set-date 上，要量的元素是 #winStart）——
#    拿 sel 去比规则的 selectorText 会恒不匹配，报出一条永远为真的假红。
TARGETS = [
    {'key': 'date', 'sel': '#winStart', 'rule_sel': '.set-date', 'icon_px': 26,
     'desc': '窗口起始日期框的日历图标'},
]

DRIVER = r'''
'use strict';
const path=require('path'),fs=require('fs'),os=require('os');
let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch(e) { console.error('NO_PUPPETEER'); process.exit(2); }
const CH = process.env.CHROME_PATH;
const url = require('url').pathToFileURL(path.resolve(process.argv[2])).href;
const targets = JSON.parse(process.argv[3]);
const outdir = process.argv[4];
const themes = (process.argv[5] || 'dark,light').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-'));
  const b = await puppeteer.launch({ executablePath: CH, headless: 'new',
    userDataDir: prof, args: ['--no-sandbox'] });
  const out = [];
  for (const th of themes) {
    const p = await b.newPage();
    /* deviceScaleFactor 高一点，图标只有 ~13px 见方，低倍率下
       反走样会把墨色与底色混在一起，量出来的对比度虚高。 */
    await p.setViewport({ width: 1440, height: 950, deviceScaleFactor: 4 });
    await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    await p.evaluate(t => { try { localStorage.setItem('baox.act.theme', t); } catch (e) {} }, th);
    await p.reload({ waitUntil: 'load' });
    await sleep(1500);
    await p.evaluate(() => { const e = document.getElementById('btnSettings'); if (e) { e.click(); } });
    await sleep(600);
    for (const t of targets) {
      const box = await p.evaluate(sel => {
        const e = document.querySelector(sel);
        if (!e) { return null; }
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height,
                 bg: getComputedStyle(e).backgroundColor };
      }, t.sel);
      if (!box) { out.push({ theme: th, sel: t.sel, miss: true }); continue; }
      /* ★ 先确认规则**真的进了 CSSOM**，再去量像素 —— 本关的第二个理由，
         拦的是一种"规则文本在产物里、静态门禁全绿、却从未生效"的失效。
         实测（v1.4）：描述配色的一段注释漏了收尾符，把紧跟其后的两条
         filter 规则一起吞进注释里，CSSOM 里查不到它们，日历图标**从未上色**。
         注意判定必须用 selectorText（不能拿 cssRules 当容器判据：现代 Chrome
         里 CSSStyleRule 也有 cssRules，那样会把所有样式规则都跳过而永远报 0）。 */
      const rule = await p.evaluate((ruleSel, th) => {
        const want = th === 'dark' ? '[data-theme="dark"]' : '[data-theme="light"]';
        const found = [];
        const walk = rs => { for (const r of rs) {
          if (r.selectorText !== undefined) {
            if (r.selectorText.indexOf('calendar-picker-indicator') >= 0) { found.push(r.selectorText); }
            continue;
          }
          if (r.cssRules) { walk(r.cssRules); }
        } };
        for (const sh of document.styleSheets) {
          let rs = null;
          try { rs = sh.cssRules; } catch (e) { continue; }
          if (rs) { walk(rs); }
        }
        return { want: want + ' ' + ruleSel + '::-webkit-calendar-picker-indicator',
                 found: found,
                 ok: found.some(s => s.indexOf(want) >= 0 && s.indexOf(ruleSel) >= 0) };
      }, t.rule_sel, th);
      const file = path.join(outdir, 'nc-' + t.key + '-' + th + '.png');
      await p.screenshot({ path: file,
        clip: { x: box.x + box.w - t.icon_px, y: box.y + 2,
                width: t.icon_px, height: box.h - 4 } });
      out.push({ theme: th, sel: t.sel, file: file, bg: box.bg,
                 w: t.icon_px, h: box.h - 4, rule: rule });
    }
    await p.close();
  }
  await b.close();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  console.log(JSON.stringify(out));
})().catch(e => { console.error(String(e)); process.exit(1); });
'''


def lum(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 5.0) / (lo + 5.0)


def main():
    if not os.path.exists(PAGE):
        print('!! 页面不存在：%s（请先跑 python3 src/build.py）' % PAGE)
        return 1
    if not os.path.exists(CHROME):
        print('!! 找不到 Chrome：%s' % CHROME)
        return 2

    tmp = tempfile.mkdtemp(prefix='nc-drv-')
    drv = os.path.join(tmp, '_drv.cjs')
    io.open(drv, 'w', encoding='utf-8').write(DRIVER)
    env = dict(os.environ)
    env['NODE_PATH'] = NODE_PATH
    env['PATH'] = '/opt/homebrew/bin:' + env.get('PATH', '')
    env['CHROME_PATH'] = CHROME
    r = subprocess.run([NODE, drv, PAGE, json.dumps(TARGETS), tmp, 'dark,light'],
                       capture_output=True, text=True, env=env)
    if 'NO_PUPPETEER' in (r.stderr or ''):
        print('!! 缺少 puppeteer-core（检查 NODE_PATH）')
        return 2
    if r.returncode != 0:
        print('!! 截图驱动失败：' + (r.stderr or r.stdout or '')[:400])
        return 1

    try:
        shots = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as ex:
        print('!! 无法解析截图结果：%s\n%s' % (ex, r.stdout[:400]))
        return 1

    bad = []
    print('原生控件可见性（日历图标 · 判据 ≥%.1f:1，逐像素实测）' % MIN)
    for s in shots:
        if s.get('miss'):
            bad.append('%s · %s 找不到元素' % (s['theme'], s['sel']))
            print('  ❌ %-6s %s 不存在' % (s['theme'], s['sel']))
            continue
        # ★ 第一道：规则必须在场。不在场就直接判死，**不拿像素读数下结论** ——
        #   规则没进 CSSOM 时，"碰巧"量到一个高对比度是可能的（比如量到了边框），
        #   那时用像素值宣布"通过"等于放行。这是拒绝降级，不是保守。
        rule = s.get('rule') or {}
        if not rule.get('ok'):
            bad.append('%s 主题下 %s 的样式规则**没有进入 CSSOM**（规则文本在、但从未生效）'
                       % (s['theme'], s['sel']))
            print('  ❌ %-6s %-10s 规则未在场 · 全页仅找到 %d 条同类规则'
                  % (s['theme'], s['sel'], len(rule.get('found') or [])))
            continue
        im = Image.open(s['file']).convert('RGB')
        px = list(im.getdata())
        from collections import Counter
        bg = Counter(px).most_common(1)[0][0]
        # 墨色 = 与底色差异最大的那 4% 像素（图标笔画）。取 4% 是因为
        # 图标笔画占该区域约 3~5%；取太大会把反走样的过渡像素算进来，
        # 那些像素本就在底色与墨色之间，会把对比度系统性低估。
        far = sorted(px, key=lambda p: -abs(lum(p) - lum(bg)))[:max(1, len(px) // 25)]
        ink = tuple(round(sum(p[i] for p in far) / len(far)) for i in range(3))
        cr = ratio(ink, bg)
        flag = '✅' if cr >= MIN else '❌'
        if cr < MIN:
            bad.append('%s 主题下 %s 对比度仅 %.2f:1（要求 ≥%.1f）· 底色 rgb%s 墨色 rgb%s'
                       % (s['theme'], s['sel'], cr, MIN, bg, ink))
        print('  %s %-6s %-10s 底色 rgb%-16s 墨色 rgb%-16s %.2f:1'
              % (flag, s['theme'], s['sel'], str(bg), str(ink), cr))

    if bad:
        print('\n!! 原生控件在某个主题下几乎不可见（这类缺陷不报错、只是「没有那个图标」）:')
        for b in bad:
            print('     -', b)
        print('\n   两种修法，按报的是哪一道判据取用：')
        print('   ① 报「规则未在场」→ 规则没生效，跟配色值无关。最常见的原因是')
        print('      src/panel.css ⑩b 那段说明注释漏了收尾符，把下面的规则吞进了注释里。')
        print('      判法：查该文件里 /* 与 */ 的配对，以及规则所在行的注释状态。')
        print('   ② 报「对比度仅 x:1」→ 规则在场但颜色不够深。两条 filter 都必须')
        print('      **先 invert 把浅色字形翻成深色**再上色 —— 只写 sepia/saturate')
        print('      等于继续洗淡（实测 1.33:1）。')
        return 1
    print('\n🎉 原生控件可见性通过：两套主题下图标均 ≥%.1f:1' % MIN)
    return 0


if __name__ == '__main__':
    sys.exit(main())
