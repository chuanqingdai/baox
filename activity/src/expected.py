#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 data/activity.json 独立重算权威聚合值（Python 侧口径）。

用途：与浏览器里 core.js（JS 侧口径）算出的 __ACT_SNAPSHOT__ 逐值比对，
      把「同一口径两份实现分叉」这类静态门禁拦不住的缺陷前移到构建期。

这是一份**刻意重复**的实现：它不 import core.js，也不共享任何代码，
只共享数据（activity.json 的 rules / unscored / targets / biz / days / weeks）。
重复是这里的目的 —— 两份实现若不重复，就无法互相印证。

⚠️ v1.2 起本文件的比对基准变了（重要，别按 v1.1 的心智读它）
  v1.1 有一项「逐列对照」：拿**源表「总」行**的数值当外部权威，判断它在哪里被
  截断。v1.2 按指令删掉了「源表口径校验」整个模块，源表不再是本面板的参照物，
  那些字段（sourceTotal / columns / mdrt / monthRate / familyCount）也随之消失。
  于是本文件的角色从「独立权威 vs 源表」降级为「**两份实现互比**」——
  它仍然能抓住「JS 与 Python 分叉」，但**抓不住「两边一起错」**。
  这不是缺陷，是删掉外部基准后必然的代价；写在这里，免得后来者以为
  这一关还在守着什么它其实守不住的东西。

  剩下的那点外部锚定是「种子数据本身」：data/activity.json 由
  src/reset_seed.py 从业务规则重新生成，且周次切分、计分项分值、满分都在那边
  做断言。本文件只负责「同一份种子，两种语言各算一遍，数要对得上」。
"""
import datetime
import io
import json
import math
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def rnd(n, p=0):
    f = 10 ** p
    return math.floor(n * f + 0.5) / f


def money(n, dp=None):
    """镜像 app.js 的 money()。

    ⚠️ 必须与 JS 侧**逐字符**一致，否则首屏 KPI 文本比对会假红。
    JS 侧：minimumFractionDigits = dp==null ? (v%1 ? 2 : 0) : dp，
           maximumFractionDigits = dp==null ? 2 : dp，
           分隔符走 toLocaleString('zh-CN')。
    """
    v = num(n)
    if dp is None:
        dp = 0 if v == int(v) else 2
    return '¥' + ('{:,.' + str(dp) + 'f}').format(v)


# ============================================================ 观测窗口（v1.4）
#
# 窗口从 v1.4 起是**用户可改的一等参数**，不再是种子写死的属性。
# 于是「窗口 → 日集合 → 周分块」这条链上多了一份必须跨语言一致的算法。
# 本节的三个函数（natural_weeks / normalize_window / 默认值推导）与
# src/core.js 的同名函数是**刻意重复**的两份实现：不 import、不共享代码、
# 只共享语义。重复是这里的目的 —— 两份若不重复就无法互相印证。
#
# 为什么必须逐值比对，而不是「保证两边写法一样就行」：
#   周序号 idx 只是**顺序**，不是**身份**。换了窗口，同一个 idx 指向的是另一周。
#   所以两侧在某个边界上分叉时不会报错，只会让周目标套到别的周上、达标率
#   整体偏移，而页面一切正常 —— 与本文开头说的「两份实现分叉」是同一类缺陷，
#   只是这次分叉的落点是周次而不是计分。
#   构建期在 15 组区间上逐值比对（门禁 ⑨），把它前移到构建期。


def _pdate(s):
    return datetime.date(*[int(x) for x in s.split('-')])


def _iso(d):
    return d.strftime('%Y-%m-%d')


def is_iso_date(s):
    """严格 ISO 日期：格式正确**且日期真实存在**。

    只测格式不够：`2026-02-31` 格式完全正确，构造时才会暴露它不存在。
    这里「构造再回写比对」，与 core.js 的 isIsoDate 同构 ——
    两端必须对同一批脏值给出同一判断，否则 normalize_window 的兜底行为分叉，
    而症状是「某个窗口在 Python 侧被拒、在 JS 侧被接受」（或反之）。"""
    if not isinstance(s, str):
        return False
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        return False
    try:
        d = _pdate(s)
    except (ValueError, TypeError):
        return False
    return _iso(d) == s


def win_default(data):
    """窗口默认值取自**种子声明的 period**，与 core.js 的 WIN_DEFAULT 同源同算法。

    刻意不写死日期：种子重建时（reset_seed.py）窗口可能变，写死会让默认值
    指向一段种子覆盖不到的区间，表现是「重置之后窗口还在老地方」——
    看着像没重置成功。"""
    p = (data.get('meta') or {}).get('period') or {}
    s = p.get('start') if is_iso_date(p.get('start')) else '2026-09-18'
    e = p.get('end') if is_iso_date(p.get('end')) else _iso(_pdate(s) + datetime.timedelta(days=29))
    return {'start': s, 'end': e}


# 窗口长度上限：逐日表格是「行数 = 天数」的实体表，365 行在抽屉里既没法读
# 也没法填，实时合计也会显著变慢。90 天覆盖「近一季」这一最常见的观察跨度。
# 下限 1 天 —— 单日观察是合法输入，不是错误。
WIN_MAX_DAYS = 90
WIN_MIN_DAYS = 1


def natural_weeks(start_iso, end_iso):
    """按自然周（周一–周日）切分闭区间 [start_iso, end_iso]。

    ⚠️ 与 src/core.js 的 naturalWeeks() 是**刻意重复**的两份实现（见上方论证）。
    另有第三份同语义实现 src/reset_seed.py 的 natural_weeks(start, n)——它服务于
    种子生成，签名是 (起始日, 天数)；本函数签名是 (起, 止)，与 core.js 对齐。
    三份都必须在同一区间上给出同一结果，这是唯一口径的最低要求。

    首周与末周可能不满 7 天（9/18 是周五 → 首周 3 天）。刻意**不**为残缺周折算
    目标：折算规则是产品决策，不该由这个纯函数替用户定；界面上会标出每周天数。
    返回项里**不含** target —— 目标是覆盖层的事，纯函数只负责「怎么切」。"""
    s, e = _pdate(start_iso), _pdate(end_iso)
    n = (e - s).days + 1
    buckets = []
    for i in range(n):
        d = s + datetime.timedelta(days=i)
        mon = d - datetime.timedelta(days=d.weekday())   # date.weekday(): 周一 = 0
        if not buckets or buckets[-1][0] != mon:
            buckets.append((mon, []))
        buckets[-1][1].append(d)
    out = []
    for i, (_mon, ds) in enumerate(buckets, 1):
        out.append({'idx': i,
                    'from': _iso(ds[0]), 'to': _iso(ds[-1]),
                    'days': [_iso(x) for x in ds], 'dayCount': len(ds)})
    return out


def normalize_window(w, dflt):
    """把任意输入规整成合法窗口。镜像 core.js 的 normalizeWindow()。

    **只兜底、不抛错**：输入可能来自被手工编辑过的本机存储，
    对脏值抛错等于整个页面打不开；退回默认值则是可用的降级。
    三件事：非法值回默认、起止颠倒互换、超长截断。
    截断**有损**（窗口外的日子不参与统计），但那些日子的数据仍留在覆盖层里，
    所以可逆 —— 正因可逆，这里才敢静默截断而不报错。"""
    s = (w or {}).get('start') if isinstance(w, dict) else None
    e = (w or {}).get('end') if isinstance(w, dict) else None
    s = s if is_iso_date(s) else dflt['start']
    e = e if is_iso_date(e) else dflt['end']
    if s > e:                                  # ISO 串的字典序 = 时间序
        s, e = e, s
    if (_pdate(e) - _pdate(s)).days + 1 > WIN_MAX_DAYS:
        e = _iso(_pdate(s) + datetime.timedelta(days=WIN_MAX_DAYS - 1))
    return {'start': s, 'end': e}


# 跨语言互证用的区间清单。**只此一份** —— verify-runtime.cjs 从 _expected.json
# 读它，绝不在 JS 侧再写一遍：两处各写一份清单，改了一处就会「少比了几个区间」
# 而门禁照样全绿（verify-runtime.cjs 的 DOM 取样段头有同一段论证）。
# 覆盖：默认 / 整周 / 单日下限 / 90 天上限 / 跨月 / 跨年 / 种子外前置 / 完全种子外
#       / 起止颠倒 / 超上限截断（含 91 天临界）/ 非法日期 / 一端为空 / 两端为空。
WINDOW_CASES = [
    ('默认窗口（种子声明；应与种子 weeks 逐值一致）', '2026-09-18', '2026-10-17'),
    ('恰好整周 周一→周日',                           '2026-10-05', '2026-10-11'),
    ('整周（另一周）周一→周日',                      '2026-11-02', '2026-11-08'),
    ('单日（下限）',                                 '2026-10-01', '2026-10-01'),
    ('整 90 天（上限）',                             '2026-09-18', '2026-12-16'),
    ('跨月 10/25–11/20（周日→周五）',                '2026-10-25', '2026-11-20'),
    ('跨年 2026-12-20–2027-01-15（周日→周五）',      '2026-12-20', '2027-01-15'),
    ('起点早于种子 2026-08-01（周六）',              '2026-08-01', '2026-09-25'),
    ('完全在种子之外 2027-03（周一→周三）',          '2027-03-01', '2027-03-31'),
    ('起止颠倒（应互换后切分）',                     '2026-10-31', '2026-10-01'),
    ('超上限 136 天（应截断到 90）',                 '2026-09-18', '2027-01-31'),
    ('超上限临界 91 天（应截断到 90）',              '2026-09-18', '2026-12-17'),
    ('非法日期 2026-02-31（应回默认）',              '2026-02-31', '2026-02-31'),
    ('一端为空（另一端合法 → 互换）',                '2026-11-05', None),
    ('两端为空（应回默认）',                         None, None),
]


def _pad(s, n):
    """按**显示宽度**右侧补空格后左对齐。

    不能用 '%-34s'：Python 的宽度按**字符数**算，而中文占 2 列，
    于是「默认窗口（种子声明…）」比「恰好整周 周一→周日」长一截字符数、
    显示上却差不多宽 —— 用字符数补齐的结果是每行参差不齐。
    自己按东亚宽度算，输出才能真的对齐（Node 侧连 %-34s 都没有，更得自己算）。"""
    w = sum(2 if ('\u1100' <= ch <= '\u115f' or '\u2e80' <= ch <= '\ua4cf'
                  or '\uac00' <= ch <= '\ud7a3' or '\uf900' <= ch <= '\ufaff'
                  or '\ufe30' <= ch <= '\ufe6f' or '\uff00' <= ch <= '\uff60'
                  or '\uffe0' <= ch <= '\uffe6') else 1 for ch in s)
    return s + ' ' * max(0, n - w)


def window_cases(data):
    """产出跨语言互证所需的全部窗口样本（归一化结果 + 切分结果）。"""
    dflt = win_default(data)
    cases = []
    for label, s, e in WINDOW_CASES:
        norm = normalize_window({'start': s, 'end': e}, dflt)
        cases.append({
            'label': label,
            'input': {'start': s, 'end': e},
            'norm': norm,
            'weeks': natural_weeks(norm['start'], norm['end']),
        })
    return {'default': dflt, 'maxDays': WIN_MAX_DAYS, 'minDays': WIN_MIN_DAYS,
            'cases': cases}


def build(data, today_iso=None):
    RULES = data['rules']
    UN = data['unscored']
    TG = data['targets']
    BIZ = data.get('biz') or {}
    days = data['days']

    def ds(rec):
        return sum(num(rec.get(r['key'])) * r['pts'] for r in RULES)

    def agg(lst):
        c = {r['key']: 0.0 for r in RULES}
        for u in UN:
            c[u['key']] = 0.0
        sc = pr = cc = 0.0
        for x in lst:
            for r in RULES:
                c[r['key']] += num(x.get(r['key']))
            for u in UN:
                c[u['key']] += num(x.get(u['key']))
            sc += ds(x)
            pr += num(x.get('premium'))
            cc += num(x.get('close'))
        return dict(days=len(lst), counts=c, score=sc, premium=rnd(pr, 2),
                    closeCount=cc,
                    avgScore=rnd(sc / len(lst), 1) if lst else 0,
                    perDeal=rnd(pr / cc, 2) if cc else 0)

    A = agg(days)
    sc_list = [ds(x) for x in days]

    def streak_ending(lst):
        n = 0
        for x in reversed(lst):
            if ds(x) > 0:
                n += 1
            else:
                break
        return n

    streak_end = streak_ending(days)
    best = cur = 0
    for x in days:
        if ds(x) > 0:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    streak_longest = best

    byD = {x['date']: x for x in days}
    weeks = []
    for w in data['weeks']:
        seg = [byD[t] for t in w['days'] if t in byD]
        a = agg(seg)
        tgt = w.get('target') or TG.get('week')
        weeks.append(dict(idx=w['idx'], score=a['score'], premium=a['premium'],
                          rate=rnd(a['premium'] / tgt * 100, 1) if tgt else 0))

    # 三段转化：口径全部落在计分项上（分子分母都取自 RULES 的计数）。
    # id 用自有编号 S1/S2/S3，不用源模板单元格坐标 —— 源表已经不是参照物了，
    # 留着 F35/F36/F37 就是留着一个指向不存在之物的名字（详见 core.js funnelOf）。
    c = A['counts']
    funnel = []
    for nk, dk, fid in (('need', 'visit', 'S1'),
                        ('plan', 'need', 'S2'),
                        ('close', 'plan', 'S3')):
        nn, dd = c[nk], c[dk]
        ratio = (nn / dd) if dd else 0
        funnel.append(dict(id=fid, numerator=nn, denominator=dd,
                           ratio=ratio, pct=rnd(ratio * 100, 1)))

    # 业务指标六项手动 + 唯一派生值「季度目标完成率」
    qp, qg = num(BIZ.get('quarterPerf')), num(BIZ.get('quarterGoal'))
    biz = dict(
        monthPerf=num(BIZ.get('monthPerf')),
        quarterPerf=qp,
        yearPerf=num(BIZ.get('yearPerf')),
        quarterGoal=qg,
        quarterDeals=num(BIZ.get('quarterDeals')),
        quarterPremium=num(BIZ.get('quarterPremium')),
        quarterRate=rnd(qp / qg * 100, 1) if qg else 0,
    )

    period = (data.get('meta') or {}).get('period') or {}
    today = today_iso or datetime.date.today().isoformat()
    idx = None
    for i, x in enumerate(days):
        if x['date'] == today:
            idx = i
            break
    in_window = idx is not None
    # 「当前连续」必须以**今天**为末位去数。窗口末日在未来，拿整窗数恒为 0。
    cur_streak = streak_ending(days[:idx + 1]) if in_window else streak_end

    # ---------------- 窗口口径自检（先证明再导出） ----------------
    # 默认窗口的自然周切分必须与**种子自带的 weeks 逐值一致**。
    # 种子的 weeks 由 reset_seed.py 生成（第三份同语义实现），本文件与 core.js
    # 各有一份 —— 三份都必须在同一区间上给出同一结果。
    # 这条断言守的是「窗口默认值与种子脱钩」这类改动：它不会让任何一处报错，
    # 只会让默认窗口落在种子之外，于是首屏全是 0，看着像「数据丢了」。
    win = window_cases(data)
    _dw = natural_weeks(win['default']['start'], win['default']['end'])
    _sw = data.get('weeks') or []
    _pick = lambda ws: [(w['idx'], w['from'], w['to'], w['dayCount']) for w in ws]
    assert _pick(_dw) == _pick(_sw), (
        '默认窗口的周切分与种子 weeks 不一致（三份实现分叉）：\n'
        '  默认窗口 → %s\n  种子 weeks → %s' % (_pick(_dw), _pick(_sw)))
    assert [d for w in _dw for d in w['days']] == [d for w in _sw for d in w['days']], \
        '默认窗口的逐日序列与种子 weeks 不一致（顺序或边界分叉）'
    assert len(win['cases']) == len(WINDOW_CASES), '窗口样本条数不符'

    return dict(
        days=A['days'],
        rows=len(days),
        score=A['score'],
        premium=A['premium'],
        closeCount=A['closeCount'],
        perDeal=A['perDeal'],
        avgScore=A['avgScore'],
        counts=A['counts'],
        biz=biz,
        rowMax=max(sc_list) if sc_list else 0,
        rowMin=min(sc_list) if sc_list else 0,
        zeroDays=sum(1 for s in sc_list if s == 0),
        streakEnd=streak_end,
        streakLongest=streak_longest,
        curStreak=cur_streak,
        today=today,
        inWindow=in_window,
        windowDays=period.get('days', len(days)),
        dayScores=[dict(date=x['date'], s=ds(x)) for x in days],
        weeks=weeks,
        funnel=funnel,
        # 窗口口径：跨语言互证样本（门禁 ⑨ 逐值比对 JS 侧同一函数）
        windows=win,
        # 首屏 KPI 文本：8 张卡（自动 2 + 手动 6），必须与 app.js renderKPI 逐字符一致
        dom={
            'kScore': str(int(A['score'])) if float(A['score']).is_integer() else str(A['score']),
            'kMonthPerf': money(biz['monthPerf']),
            'kQuarterPerf': money(biz['quarterPerf']),
            'kYearPerf': money(biz['yearPerf']),
            'kQuarterGoal': money(biz['quarterGoal']),
            'kQuarterRate': '%.1f%%' % biz['quarterRate'],
            'kQuarterDeals': '%d 单' % int(biz['quarterDeals']),
            'kQuarterPremium': money(biz['quarterPremium']),
        },
    )


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'activity.json')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, '_tmp', '_expected.json')
    today = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(os.path.dirname(out), exist_ok=True)
    data = json.loads(io.open(src, encoding='utf-8').read())
    exp = build(data, today)
    io.open(out, 'w', encoding='utf-8').write(
        json.dumps(exp, ensure_ascii=False, separators=(',', ':')))
    print('期望值已导出: %s' % out)
    print('  %d 天 / 总分 %s / 保费 %s / 促成签单 %s / 件均 %s'
          % (exp['days'], exp['score'], exp['premium'], exp['closeCount'], exp['perDeal']))
    print('  季完成率 %.1f%%（%s ÷ %s）· 今日 %s%s'
          % (exp['biz']['quarterRate'], exp['biz']['quarterPerf'], exp['biz']['quarterGoal'],
             exp['today'], '' if exp['inWindow'] else '（不在窗口内）'))
    print('  当前连续 %d 天 / 窗口内最长 %d 天' % (exp['curStreak'], exp['streakLongest']))
    w = exp['windows']
    print('  窗口口径 默认 %s ~ %s · 上限 %d 天 · 跨语言互证样本 %d 组'
          % (w['default']['start'], w['default']['end'], w['maxDays'], len(w['cases'])))
    for c in w['cases']:
        print('    %s → %s~%s · %d 周 [%s]'
              % (_pad(c['label'], 44), c['norm']['start'], c['norm']['end'],
                 len(c['weeks']),
                 '+'.join(str(x['dayCount']) for x in c['weeks'])))


if __name__ == '__main__':
    main()
