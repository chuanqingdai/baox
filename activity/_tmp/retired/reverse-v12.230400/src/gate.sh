#!/usr/bin/env bash
# ============================================================================
#  公子的活动量面板 · 验收门禁一键复跑
# ----------------------------------------------------------------------------
#  为什么要有这个包装脚本（而不是每次手敲）：
#    ① 环境三件套必须先设对，否则脚本会以「环境缺依赖」退出，
#       看起来像页面不合格：NODE_PATH（puppeteer-core 的位置）、
#       PATH（Chrome 渲染）、以及 node 的绝对路径（受管版本）。
#    ② check-theme.cjs 的持久化键默认是别的项目的（baox.crm.theme），
#       不显式传 --key 就会「每项都通过」却是对着空键在测 —— 假绿。
#    ③ 一次跑完并汇总退出码，避免「跑了前 3 关就说通过了」。
#
#  用法: bash src/gate.sh            # 全部
#        bash src/gate.sh overflow   # 只跑某一关
# ============================================================================
set -o pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL="/Users/jaydenkong/.workbuddy/skills/mianban/scripts"
NODE="/Users/jaydenkong/.workbuddy/binaries/node/versions/22.22.2-3/bin/node"
PY="/Users/jaydenkong/.workbuddy/binaries/python/versions/3.13.12/bin/python3"

export NODE_PATH="/Users/jaydenkong/.workbuddy/binaries/node/workspace/node_modules"
export PATH="/opt/homebrew/bin:$PATH"
export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

PAGE="$ROOT/index.html"
THEME_KEY="baox.act.theme"     # 必须与 app.js / 首屏引导脚本字面相同
ONLY="$1"

FAILED=()
run() {                       # run <关卡名> <命令...>
  local name="$1"; shift
  if [ -n "$ONLY" ] && [ "$ONLY" != "$name" ]; then return 0; fi
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  $name"
  echo "════════════════════════════════════════════════════════════"
  if "$@"; then :; else FAILED+=("$name"); fi
}

echo "页面: $PAGE"
[ -f "$PAGE" ] || { echo "!! 产物不存在，请先跑: python3 src/build.py"; exit 1; }

# 第 1 关 · 数据（构建期 Python 重算 ≡ 运行期 JS 重算，逐值比对）
run "第1关 数据一致性" bash -c "cd '$ROOT' && '$PY' src/expected.py '$ROOT/data/activity.json' '$ROOT/_tmp/_expected.json' >/dev/null && '$NODE' src/verify-runtime.cjs '$PAGE' '$ROOT/_tmp/_expected.json'"
# 第 2 关 · 布局（3 档宽度 × 双主题 = 6 组）
run "第2关 横向溢出"   "$NODE" "$SKILL/check-overflow.cjs" "$PAGE"
# 第 3 关 · 可靠性（JS禁用 / 减动效 / 移动端 / 桌面端）
run "第3关 进场动画"   "$NODE" "$SKILL/check-reveal.cjs" "$PAGE"
# 第 4 关 · 真机首屏
run "第4关 真机首屏"   "$NODE" "$SKILL/check-mobile-first.cjs" "$PAGE"
# 加验 · 主题锚点（必须传本项目自己的持久化键）
run "加验 换肤四阶段"  "$NODE" "$SKILL/check-theme.cjs" "$PAGE" "--key=$THEME_KEY"
# 加验 · 文字可读性
run "加验 文字对比度"  "$NODE" "$SKILL/check-contrast.cjs" "$PAGE"
# 加验 · 锚点遮挡（双端）
run "加验 锚点遮挡"    "$NODE" "$SKILL/check-anchor.cjs" "$PAGE"
# 加验 · 零外链离线渲染
run "加验 断网渲染"    "$NODE" "$SKILL/check-offline.cjs" "$PAGE"
# 加验 · 留白量化
run "加验 布局留白"    "$NODE" "$SKILL/check-whitespace.cjs" "$PAGE"
# 加验 · 交互实测（冷启动锚点 / 撤销式筛选 / 无破坏性按钮 / 打卡写路径）
run "加验 交互实测"    "$NODE" "$ROOT/src/probe-interactions.cjs" "$PAGE"

echo ""
echo "════════════════════════════════════════════════════════════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "🎉 全部门禁通过"
  exit 0
fi
echo "❌ 未通过 ${#FAILED[@]} 项："
for f in "${FAILED[@]}"; do echo "   - $f"; done
exit 1
