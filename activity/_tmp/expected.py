#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 data/activity.json 独立重算权威聚合值（Python 侧口径）。

用途：与浏览器里 core.js（JS 侧口径）算出的 __ACT_SNAPSHOT__ 逐值比对，
      把「同一口径两份实现分叉」这类静态门禁拦不住的缺陷前移到构建期。

这是一份**刻意重复**的实现：它不 import core.js，也不共享任何代码，
只共享数据（activity.json 的 rules / unscored / targets / days）。
重复是这里的目的——两份实现若不重复，就无法互相印证。
"""
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


def build(data):
    RULES = data['rules']
    UN = data['unscored']
    TG = data['targets']
    days = data['days']

    def ds(rec):
        return sum(num(rec.get(r['key'])) * r['pts'] for r in RULES)

    def agg(lst):
        c = {r['key']: 0.0 for r in RULES}
        for u in UN:
            c[u['key']] = 0.0
        sc = pr = cc = fc = 0.0
        for x in lst:
            for r in RULES:
                c[r['key']] += num(x.get(r['key']))
            for u in UN:
                c[u['key']] += num(x.get(u['key']))
            sc += ds(x)
            pr += num(x.get('premium'))
            cc += num(x.get('close'))
            fc += num(x.get('family'))
        return dict(days=len(lst), counts=c, score=sc, premium=rnd(pr, 2),
                    closeCount=cc, familyCount=fc,
                    avgScore=rnd(sc / len(lst), 1) if lst else 0,
                    perDeal=rnd(pr / cc, 2) if cc else 0)

    A = agg(days)
    sc_list = [ds(x) for x in days]

    n = 0
    for x in reversed(days):
        if ds(x) > 0:
            n += 1
        else:
            break
    streak_end = n
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
        tgt = w.get('target') or TG['week']
        weeks.append(dict(idx=w['idx'], score=a['score'], premium=a['premium'],
                          rate=rnd(a['premium'] / tgt * 100, 1) if tgt else 0))

    c = A['counts']
    funnel = []
    for nk, dk, cell in (('need', 'visit', 'F35'),
                         ('plan', 'need', 'F36'),
                         ('family', 'plan', 'F37')):
        nn, dd = c[nk], c[dk]
        ratio = (nn / dd) if dd else 0
        funnel.append(dict(srcCell=cell, ratio=ratio, pct=rnd(ratio * 100, 1)))

    mdrt = rnd(num(TG['mdrtCarry']) + A['premium'], 2)
    month_rate = rnd(A['premium'] / TG['month'] * 100, 1) if TG.get('month') else 0

    return dict(
        days=A['days'],
        score=A['score'],
        premium=A['premium'],
        mdrt=mdrt,
        monthRate=month_rate,
        closeCount=A['closeCount'],
        familyCount=A['familyCount'],
        perDeal=A['perDeal'],
        avgScore=A['avgScore'],
        rowMax=max(sc_list),
        rowMin=min(sc_list),
        zeroDays=sum(1 for s in sc_list if s == 0),
        streakEnd=streak_end,
        streakLongest=streak_longest,
        dayScores=[dict(date=x['date'], s=ds(x)) for x in days],
        weeks=weeks,
        funnel=funnel,
        dom={
            'kDays': str(int(A['days'])),
            'kScore': str(int(A['score'])) if float(A['score']).is_integer() else str(A['score']),
            'kDeals': '%d / %d' % (int(A['closeCount']), int(A['familyCount'])),
            'kRate': '%s%%' % month_rate,
        },
    )


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'activity.json')
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, '_expected.json')
    data = json.loads(io.open(src, encoding='utf-8').read())
    exp = build(data)
    io.open(out, 'w', encoding='utf-8').write(
        json.dumps(exp, ensure_ascii=False, separators=(',', ':')))
    print('期望值已导出: %s' % out)
    print('  %d 天 / 总分 %s / 保费 %s / 件均 %s / 月达标 %s%%'
          % (exp['days'], exp['score'], exp['premium'], exp['perDeal'], exp['monthRate']))


if __name__ == '__main__':
    main()
