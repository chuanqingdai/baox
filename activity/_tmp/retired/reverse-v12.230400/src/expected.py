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


if __name__ == '__main__':
    main()
