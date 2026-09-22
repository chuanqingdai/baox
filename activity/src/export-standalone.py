#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出「单文件自包含版」到桌面 —— 把一份面板变成真正的一个文件。

═══ 为什么必须重新做一遍（这是本项目踩到的一个认知盲区）═══

铁律 8 说的「零外链」，实践中的含义只是**不依赖网络**：
libs/ 里放本地副本、用相对路径引用，就算合规，十关也全绿。
但产物的真实形态是「三件套」：

    index.html   +   assets/avatar.png   +   libs/fontawesome/**   +   libs/chart.js/**

十关全绿只证明了「在配套齐全的项目目录里能跑」。
一旦按用户的要求**只拿一份文件**走（拷到桌面、scp 到服务器、丢进静态托管），
assets/ 与 libs/ 都不存在了，症状是**静默的**：

    · 图标字体缺失   → 39 个图标全部变 0x0（不报错、不占位，见铁律 9）
    · 图表库缺失     → KPI 全空、canvas 不绘制（JS 里 typeof Chart 检查失败就跳过）
    · 默认头像缺失   → 头像是裂图
    · favicon 缺失   → 只在标签页上看得出来

而首页文字、布局、主题都正常 —— 看起来「就是个正常的页面，只是有点空」。
这类缺陷比崩溃难查得多，因为没有任何一处会报错。

所以本脚本把三类资源全部内联，产出一个**真正独立**的文件。

═══ 内联策略（含一处刻意的减重）═══

1. assets/avatar.png  → data URI（4 处引用：favicon / img / JS 默认值 / JS 还原）

2. libs/fontawesome/css/all.min.css → 内联为 <style>
   减重：原 CSS 有 10 个 @font-face，覆盖 4 个字体文件 × 多个家族别名
   （Font Awesome 6 Free / 6 Brands / 5 Free / 5 Brands / FontAwesome / v4compat）。
   实测反查：页面**只用 `fa-solid`**，唯一需要的是
       家族 "Font Awesome 6 Free" + weight 900 → fa-solid-900.woff2
   其余 9 个 @font-face 整块移除（页面从不引用那些家族），
   并把字体文件的 base64 压到**只出现 1 次**（原本会被 3 个块重复引用 = 3 倍体积）。
   ⚠️ 这是**有前提的化简**：前提由 `assert_only_solid_family()` 每次运行时重新反查。
      一旦页面新增 fa-brands / fa-regular / 裸 .fa 用法，本脚本会自动切到
      「全量内联」模式（放弃减重、保证正确），绝不静默产出裂图。

3. libs/chart.js/chart.umd.min.js → 内联为 <script>
   安全性前提（每次运行都重新核对，不靠"上次检查过"）：
   库文件里不得含 </script、<!--、--> 等会提前闭合标签或吞掉内容的序列。

═══ 边界声明 ═══
只做资源替换，**不改动任何页面逻辑**（不动 JS、不动 HTML 结构、不动 CSS 选择器）。
产出物是派生件，md5 必然与 index.html 不同，故不参与十关验收、不进 archive/
（否则违反铁律 17「归档文件名即版本声明」——同一版本号出现两个不同 md5）。
"""

import base64
import os
import re
import sys

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SRC_HTML = 'index.html'
AVATAR   = 'assets/avatar.png'
CSS_PATH = 'libs/fontawesome/css/all.min.css'
JS_PATH  = 'libs/chart.js/chart.umd.min.js'

# 文件名里的版本号**从 build.py 读**，不再写第二份字面量。
# 门禁 A-5 钉的是「归档名 / 侧栏 / 页首」三处；桌面导出件是**第四处** ——
# 写死的话，升版时它会安静地留在旧版本名上，而内容已经是新版：
# 拿到文件的公子按文件名判断版本，看到的与页面里写的不是一个数。
_BUILD_SRC = open(os.path.join(ROOT, 'src', 'build.py'), encoding='utf-8').read()
_mv = re.search(r"^VERSION\s*=\s*'([^']+)'", _BUILD_SRC, re.M)
if not _mv:
    sys.exit('!! 无法从 src/build.py 读到 VERSION —— 导出件名会失去版本依据')
APP_VERSION = _mv.group(1)

DESKTOP  = os.path.expanduser('~/Desktop')
OUT      = os.path.join(DESKTOP, 'activity-panel-%s.html' % APP_VERSION)

LINK_CSS = '<link rel="stylesheet" href="libs/fontawesome/css/all.min.css">'
TAG_JS   = '<script src="libs/chart.js/chart.umd.min.js"></script>'

bad = []
log = []


def ok(cond, good, err):
    log.append(('  ✅ ' if cond else '  ❌ ') + (good if cond else err))
    if not cond:
        bad.append(err)


def say(s):
    log.append(s)


# ══ 0. 读入 ══════════════════════════════════════════════════════════
for p in (SRC_HTML, AVATAR, CSS_PATH, JS_PATH):
    if not os.path.exists(p):
        print('❌ 缺少输入文件: %s（请在活动量项目根目录运行）' % p)
        sys.exit(1)

html  = open(SRC_HTML, encoding='utf-8').read()
css   = open(CSS_PATH, encoding='utf-8').read()
js    = open(JS_PATH,  encoding='utf-8', errors='replace').read()
png   = open(AVATAR, 'rb').read()

say('【输入】')
say('  %-42s %8d 字符' % (SRC_HTML, len(html)))
say('  %-42s %8d 字符' % (CSS_PATH, len(css)))
say('  %-42s %8d 字符' % (JS_PATH, len(js)))
say('  %-42s %8d 字节' % (AVATAR, len(png)))

# ══ 1. 反查实际用到的字体家族（决定走精简还是全量）══════════════════
say('')
say('【字体家族反查】')

tokens = set()
for m in re.finditer(r'class="([^"]*)"', html):
    tokens.update(m.group(1).split())

uses = {
    'fa-solid/fas':   any(t in ('fa-solid', 'fas') or t.startswith('fa-solid') for t in tokens),
    'fa-regular/far': any(t in ('fa-regular', 'far') for t in tokens),
    'fa-brands/fab':  any(t in ('fa-brands', 'fab') for t in tokens),
    'FA4 裸 .fa':     'fa' in tokens,
}
# 是否直接用家族名（不经 class 映射）
direct = [f for f in ('Font Awesome 6 Brands', 'Font Awesome 5 Free',
                      'Font Awesome 5 Brands', 'FontAwesome') if f in html]
for k, v in uses.items():
    say('  %-16s %s' % (k, '用到' if v else '未用到'))
say('  直接引用家族名: %s' % (direct if direct else '无'))

only_solid = uses['fa-solid/fas'] and not (uses['fa-regular/far'] or uses['fa-brands/fab']
                                           or uses['FA4 裸 .fa'] or direct)
if only_solid:
    say('  → 判定：**只依赖 fa-solid**，走减重内联（只保留 FA6 Free 900 一份字体）')
else:
    say('  ⚠️ 判定：检测到 fa-solid 之外的家族依赖，**自动切换到全量内联**（放弃减重以保证正确）')

# ══ 2. 处理 CSS：内联字体 + 按需精简 @font-face ══════════════════════
say('')
say('【CSS / 字体内联】')

blocks = list(re.finditer(r'@font-face\s*\{[^}]*\}', css))
ok(len(blocks) == 10, '识别到 10 个 @font-face 块', '异常：@font-face 块数为 %d（预期 10）' % len(blocks))

font_cache = {}


def woff2_uri(name):
    if name not in font_cache:
        p = 'libs/fontawesome/webfonts/' + name
        if not os.path.exists(p):
            font_cache[name] = None
        else:
            b = open(p, 'rb').read()
            font_cache[name] = 'data:font/woff2;base64,' + base64.b64encode(b).decode('ascii')
    return font_cache[name]


def rebuild_block(block, keep_uri_for):
    """只保留 woff2（且按 keep_uri_for 决定是否内联），移除指向不存在文件的 .ttf 项。"""
    b = block
    # 逐个处理 src 列表项：url(...) format(...)
    def repl(mm):
        fname = mm.group(1)
        fmt   = mm.group(2)
        if not fname.endswith('.woff2'):
            return ''                      # .ttf 在 libs/ 里根本不存在 → 整项移除
        if keep_uri_for != fname:
            return ''                      # 非目标字体 → 移除（不再引用任何文件）
        uri = woff2_uri(fname)
        return 'url("%s") format("%s")' % (uri, fmt)
    b = re.sub(r'url\(\.\./webfonts/([\w\-\.]+)\)\s*format\("([^"]*)"\)', repl, b)
    # 收尾：清理由于移除产生的 "...," / ",}" / "src:" 空悬
    b = re.sub(r',\s*,', ',', b)
    b = re.sub(r'\bsrc:\s*,', 'src:', b)
    b = re.sub(r',\s*\}', '}', b)
    b = re.sub(r'\bsrc:\s*\}', 'src:none}', b)
    return b


KEEP = ('Font Awesome 6 Free', '900', 'fa-solid-900.woff2')
new_css = css
n_kept = n_dropped = 0
# 逆序处理，避免偏移失效
for mm in reversed(blocks):
    block = mm.group(0)
    fam = (re.search(r'font-family:\s*([^;]+)', block) or [None, ''])[1].strip().strip('"')
    wt  = (re.search(r'font-weight:\s*([^;]+)', block) or [None, ''])[1].strip()
    src = re.findall(r'\.\./webfonts/([\w\-\.]+)', block)
    target = (fam == KEEP[0] and wt == KEEP[1] and KEEP[2] in src)

    if only_solid and not target:
        # 减重模式：页面用不到的家族，整块移除，留一条注释说明（改动留痕）
        new_css = new_css[:mm.start()] + \
                  '/* [导出件] 已移除未使用的 @font-face：family=%s weight=%s src=%s */' % (fam, wt or '-', src) + \
                  new_css[mm.end():]
        n_dropped += 1
    else:
        keep_uri_for = KEEP[2] if only_solid else None
        rebuilt = rebuild_block(block, keep_uri_for)
        # 全量模式下每个块都内联自己的 woff2
        if not only_solid and src and src[0].endswith('.woff2'):
            rebuilt = rebuild_block(block, src[0])
        new_css = new_css[:mm.start()] + rebuilt + new_css[mm.end():]
        n_kept += 1

say('  保留 @font-face 块: %d，移除: %d' % (n_kept, n_dropped))

fonts_inlined = len(re.findall(r'data:font/woff2;base64,', new_css))
if only_solid:
    ok(fonts_inlined == 1,
       '字体 base64 恰好出现 1 次（减重生效，未因多家族别名而重复 3 倍）',
       '字体 base64 出现 %d 次（预期 1 次，减重失效）' % fonts_inlined)
else:
    ok(fonts_inlined >= 1, '字体已内联 %d 处' % fonts_inlined, '字体未内联')
# ⚠️ 判据必须落在「实际引用」上，不能落在裸文件名上：
#    上面为「改动留痕」写的注释里就含 'fa-brands-400.woff2' 这样的文件名，
#    若判 '.woff2' 不存在，就会判到注释上 → 假红（断言假绿六类之①的反面）。
residual_fonts = re.findall(r'url\([^)]*\.(?:woff2|ttf|woff|eot)[^)]*\)', new_css)
ok(not residual_fonts,
   'CSS 内已无任何字体文件相对路径（不残留 url(../webfonts/…) 引用）',
   'CSS 内仍残留字体引用: %s' % residual_fonts[:3])
n_note = len(re.findall(r'已移除未使用的 @font-face', new_css))
ok(n_note == n_dropped,
   '每个被移除的块都留了可追溯注释（%d 条 = 移除数 %d）' % (n_note, n_dropped),
   '移除注释数 %d 与移除块数 %d 不符' % (n_note, n_dropped))
ok('</style' not in new_css, 'CSS 内不含 </style（内联后不会提前闭合 style 标签）',
   'CSS 内含 </style，会提前闭合标签')

# ══ 3. 内联 JS ═══════════════════════════════════════════════════════
say('')
say('【JS 内联】')
for danger in ('</script', '<!--', '-->'):
    ok(danger not in js,
       'Chart.js 不含 %s（不会提前闭合 script 或吞内容）' % danger,
       'Chart.js 含 %s，无法直接内联' % danger)

# ══ 4. 替换 HTML 引用 ════════════════════════════════════════════════
say('')
say('【引用替换】')
ok(html.count(LINK_CSS) == 1, 'CSS <link> 标签唯一命中', 'CSS <link> 标签命中 %d 次（预期 1）' % html.count(LINK_CSS))
ok(html.count(TAG_JS) == 1, 'Chart.js <script> 标签唯一命中', 'Chart.js <script> 标签命中 %d 次（预期 1）' % html.count(TAG_JS))
n_avatar = html.count('assets/avatar.png')
ok(n_avatar == 4, '默认头像引用恰好 4 处（favicon / img / JS 默认值 / JS 还原）',
   '默认头像引用为 %d 处（预期 4；源码改过，替换假设需重核）' % n_avatar)

out = html
out = out.replace(LINK_CSS, '<style>\n' + new_css + '\n</style>')
out = out.replace(TAG_JS, '<script>\n' + js + '\n</script>')
out = out.replace('assets/avatar.png',
                  'data:image/png;base64,' + base64.b64encode(png).decode('ascii'))

# ══ 5. 自包含性断言 ══════════════════════════════════════════════════
say('')
say('【自包含性】')
ok('assets/' not in out, '无 assets/ 相对引用', '仍存在 assets/ 相对引用')
ok('libs/'   not in out, '无 libs/ 相对引用',   '仍存在 libs/ 相对引用')
# ⚠️ 判据必须落在「会发起请求的位置」上（src=/href= 属性），不能落在全文的 http 字符串上：
#    内联进来的 Chart.js 里含 5 处 https:// 字样（许可证与文档地址），
#    它们只是字符串常量，不会产生任何网络请求。若按全文判，就会假红。
attr_links = re.findall(r'(?:src|href)\s*=\s*["\']https?://[^"\']*', out)
ok(not attr_links,
   'HTML 属性中无 http(s) 外链（断网 / 内网 / 无 CDN 均可运行）',
   'HTML 属性中存在外链: %s' % attr_links[:3])
lib_urls = re.findall(r'https?://[^\s"\'<>\)]{4,80}', out)
if lib_urls:
    say('  ℹ️  全文另有 %d 处 http 字符串，均在内联库/注释内，不发起请求：' % len(lib_urls))
    for u in sorted(set(lib_urls))[:6]:
        say('        %s' % u)
ok('data:image/png;base64,' in out, '头像 data URI 就位', '头像 data URI 缺失')
ok('data:font/woff2;base64,' in out, '字体 data URI 就位', '字体 data URI 缺失')
ok(re.search(r"\|\| 'data:image/png;base64,[A-Za-z0-9+/=]+'", out) is not None,
   "JS 默认值分支已内联（|| 'data:image/png;base64,…'）", 'JS 默认值分支未正确内联')
ok("setAttribute('src', 'data:image/png;base64," in out,
   'JS「恢复默认头像」写回路径已内联', 'JS 恢复默认头像写回路径未正确内联')
ok('id="toast"' in out, '轻提示仍在场（未被内联过程吞掉）', '轻提示 id="toast" 丢失')
ok(out.count('<script') == out.count('</script>'),
   '<script> 开闭标签配平（%d 对）' % out.count('<script>'),
   '<script> 开闭不配平：%d vs %d' % (out.count('<script'), out.count('</script>')))
ok(out.count('<style') == out.count('</style>'),
   '<style> 开闭标签配平（%d 对）' % out.count('<style'),
   '<style> 开闭不配平：%d vs %d' % (out.count('<style'), out.count('</style>')))

if bad:
    print('\n'.join(log))
    print('\n💥 自检失败 %d 项，未产出任何文件。' % len(bad))
    sys.exit(1)

# ══ 6. 落盘 ══════════════════════════════════════════════════════════
os.makedirs(DESKTOP, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(out)

say('')
say('【输出】')
say('  %s' % OUT)
say('  %d 字节（%.1f KB，原产物 %.1f KB）' % (
    os.path.getsize(OUT), os.path.getsize(OUT) / 1024.0, len(html) / 1024.0))

print('\n'.join(log))
print('\n🎉 单文件自包含版导出成功。')
