#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出单文件自包含版：把 index.html 里对 assets/avatar.png 的 4 处引用
全部内联为 data URI，产出一份「拷到哪都能开」的独立网页文件到桌面。

为什么要这么做：
  dist 产物 index.html 严格说是「HTML + 同目录 assets/」两件套。
  铁律 8 的「零外链」指的是不依赖网络，相对路径不算外链 —— 所以产物是合规的。
  但用户要的是「一份网页文件」，且要传到服务器上跑：
  只拷 index.html 会缺默认头像（favicon 与头像图同时裂）。
  内联后 = 一个文件即整个应用，静态托管零配置。

边界声明（重要）：
  本脚本只读 index.html，**不改动**它。产出物是派生件，md5 必然与 dist 不同
  （多出一份内联头像）。因此它不参与十关验收、不进 archive/ —— 否则会污染
  「归档文件名即版本声明」这条铁律（同一个版本号出现两个不同 md5）。
"""

import base64
import os
import re
import sys

SRC_HTML = 'index.html'
AVATAR   = 'assets/avatar.png'
DESKTOP  = os.path.expanduser('~/Desktop')
OUT      = os.path.join(DESKTOP, 'activity-panel-v1.3.html')

NEEDLE   = 'assets/avatar.png'
EXPECT_N = 4          # 已核实的引用点：link favicon / img src / JS 默认值 / JS 还原

bad = []
log = []


def check(cond, ok_msg, bad_msg):
    if cond:
        log.append('  ✅ ' + ok_msg)
    else:
        bad.append(bad_msg)
        log.append('  ❌ ' + bad_msg)


# ── 1. 读入 ──────────────────────────────────────────────────────────
if not os.path.exists(SRC_HTML):
    print('❌ 找不到 %s（请在项目根目录运行）' % SRC_HTML)
    sys.exit(1)

html = open(SRC_HTML, encoding='utf-8').read()
png  = open(AVATAR, 'rb').read()

log.append('【输入】')
log.append('  产物 %s：%d 字符' % (SRC_HTML, len(html)))
log.append('  头像 %s：%d 字节' % (AVATAR, len(png)))

# ── 2. 计数守卫：先数清出现次数，再决定改几处 ────────────────────────
n_found = html.count(NEEDLE)
check(n_found == EXPECT_N,
      '引用点计数符合预期：%s 出现 %d 次（应为 %d 次）' % (NEEDLE, n_found, EXPECT_N),
      '引用点计数漂移：%s 实为 %d 次，预期 %d 次 —— 源码改动过，本脚本的替换假设已失效，'
      '请先核对新增/删除的引用点再重跑' % (NEEDLE, n_found, EXPECT_N))
if bad:
    print('\n'.join(log))
    print('\n💥 自检失败，未产出任何文件。')
    sys.exit(1)

# ── 3. 内联 ──────────────────────────────────────────────────────────
data_uri = 'data:image/png;base64,' + base64.b64encode(png).decode('ascii')
out_html = html.replace(NEEDLE, data_uri, 3)
n_after  = out_html.count(NEEDLE)

log.append('【内联】')
log.append('  data URI 长度：%d 字符' % len(data_uri))
check(n_after == 0,
      '内联后 %s 残留为 0（4 处引用全部被替换）' % NEEDLE,
      '%s 仍有 %d 处残留' % (NEEDLE, n_after))
check(out_html != html, '内容确实发生了变化', '内容与原件完全相同，替换未生效')

# ── 4. 自包含性断言 ──────────────────────────────────────────────────
log.append('【自包含性】')
check('assets/' not in out_html,
      '不含任何 assets/ 相对引用 —— 单文件可独立运行',
      '仍含 assets/ 相对引用，拷到别处会缺图')

http_hits = len(re.findall(r'https?://', out_html))
check(http_hits == 0,
      '不含 http/https 外链 —— 断网、内网、无 CDN 均可运行',
      '含 %d 处 http(s) 外链，部署后依赖外部可达性' % http_hits)

# base64 字符集不含引号，故嵌入 HTML 属性与 JS 单引号字符串都安全
check('data:image/png;base64,' in out_html,
      'PNG data URI 已就位', '未找到 PNG data URI')
check(re.search(r"\|\| 'data:image/png;base64,[A-Za-z0-9+/=]+'", out_html) is not None,
      'JS 里的默认值分支已内联（形如 || \'data:image/png;base64,…\'）',
      'JS 默认值分支未正确内联')
check("setAttribute('src', 'data:image/png;base64," in out_html,
      'JS 里的「恢复默认头像」写回路径已内联',
      'JS 恢复默认头像的写回路径未正确内联')

# ── 5. 落盘 ──────────────────────────────────────────────────────────
if bad:
    print('\n'.join(log))
    print('\n💥 自检失败，未产出任何文件。')
    sys.exit(1)

os.makedirs(DESKTOP, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(out_html)

size = os.path.getsize(OUT)
log.append('【输出】')
log.append('  %s' % OUT)
log.append('  大小：%d 字节（%.1f KB）' % (size, size / 1024.0))

print('\n'.join(log))
print('\n🎉 单文件自包含版导出成功。')
