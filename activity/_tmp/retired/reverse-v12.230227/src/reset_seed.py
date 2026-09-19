#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重建活动量面板的种子数据：清零 + 日期从 2026-09-18 起，共 30 天。

为什么把「一次性重置」写成脚本，而不是手改 data/activity.json：
  1. 30 天 × 12 项活动量 + 当日保费 = 390 个格子，手写必然出错且无法复核；
  2. 日期到星期的映射、自然周（周一–周日）切分都是**算出来的**，不是人填的；
  3. 写进脚本就自带断言 —— 跑一次就能证明「30 天 / 起止正确 / 周次覆盖不漏不重」。

⚠️ 起始日期是**硬编码**的，不是 date.today()。
   这一条是刻意的：若跟着 build 当天走，那么每次重跑构建都会把统计窗口整体平移，
   用户在窗口里录的打卡数据会在某次构建后集体落到窗外。重置是一次性动作，
   窗口一旦定下就应该稳定不动。

产出（两份内容一致，分工不同）：
  · data/activity.json —— 权威事实源，构建期 expected.py 读它
  · src/data.js        —— 浏览器内嵌种子，core.js 读它

用法: python3 src/reset_seed.py
"""
import datetime
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)

START = '2026-09-18'
DAYS = 30
DOW_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

# 12 项计分项。要点：
#   · 「文章|视频」拆成「小红书」与「视频号/抖音」两项，各 1 分 → 计分项由 11 变 12
#   · 「朋友圈」改名「公众号」（key 一并从 circle 改为 gzh：
#     保留旧 key 会让「朋友圈」这个名字以变量名的形式继续留在代码里，将来改文案时误导人）
#   · 不再保留「成交家庭数」这个仅记录项 —— 漏斗第 4 级已改用「促成签单」，
#     它原本唯一的用途（漏斗分子）随之消失
#   · col 只是显示序号 A–L，与源模板列号无关（源模板已不再被引用）
RULES = [
    ('gzh',     'A', '公众号',      1, '个人品牌', '一条 1 分，不限内容'),
    ('xhs',     'B', '小红书',      1, '个人品牌', '一条 1 分，不限内容'),
    ('video',   'C', '视频号/抖音', 1, '个人品牌', '一条 1 分，不限内容'),
    ('friend',  'D', '新增好友',    1, '销售流程', '一人 1 分'),
    ('visit',   'E', '约访',        1, '销售流程',
     '一人 1 分，有约对方做进一步需求分析沟通动作就算，成败不限'),
    ('need',    'F', '需求分析',    2, '销售流程', '初次面谈一次 2 分'),
    ('plan',    'G', '方案呈现',    3, '销售流程', '二次面谈一次 3 分'),
    ('close',   'H', '促成签单',    5, '销售流程', '成交一个单子 5 分，不限险种不限人数'),
    ('refer',   'I', '转介绍',      1, '销售流程', '一人 1 分，自己开口要或客户主动来都算'),
    ('service', 'J', '客户服务',    1, '销售流程',
     '续保理赔、下午茶叙旧、跟进询问、修改方案都算；首次需求分析与方案呈现不算'),
    ('recTalk', 'K', '约聊增员',    1, '增员流程', '一人 1 分'),
    ('recJoin', 'L', '入职增员',    5, '增员流程', '一人 5 分，只要录入系统就算'),
]

# 六项业务指标：全部手动维护（在「设置数据」里改），初始为 0。
# 「季度目标完成率」不在此列 —— 它由 本季度业绩 / 季度目标业绩 自动算出，
# 是派生值，不需要也不应该有存储位置。
BIZ = [
    ('monthPerf',      '本月业绩',     0),
    ('quarterPerf',    '本季度业绩',   0),
    ('yearPerf',       '本年度业绩',   0),
    ('quarterGoal',    '季度目标业绩', 0),
    ('quarterDeals',   '季度成交单数', 0),
    ('quarterPremium', '季度成交保费', 0),
]

WEEK_TARGET = 17500          # 各周保费目标默认值，可在「设置数据」里逐周改

FUNNEL_RATIO_TEXT = '约访：需求分析：方案呈现：促成签单 = 15：9：6：3'


def iso(d):
    return d.strftime('%Y-%m-%d')


def natural_weeks(start, n):
    """按自然周（周一–周日）切分。

    首周与末周必然不完整 —— 这是自然周的定义带来的，不是缺陷：
    9/18 是周五，所以首周只有 3 天。刻意**不**为残缺周自动折算目标
    （不把 17500 按天数比例缩成 7500），理由有二：
      ① 折算规则是产品决策，不该由生成脚本偷偷替用户定；
      ② 用户在「设置数据」里能逐周改，且界面已标出每周天数。
    """
    days = [start + datetime.timedelta(days=i) for i in range(n)]
    buckets = []
    for d in days:
        wd = d.weekday()                      # 周一 = 0
        monday = d - datetime.timedelta(days=wd)
        if not buckets or buckets[-1][0] != monday:
            buckets.append((monday, []))
        buckets[-1][1].append(d)
    out = []
    for i, (monday, ds) in enumerate(buckets, 1):
        out.append({
            'idx': i,
            'from': iso(ds[0]), 'to': iso(ds[-1]),
            'days': [iso(x) for x in ds],
            'dayCount': len(ds),
            'target': WEEK_TARGET,
            'targetNote': '周目标 %d（可逐周调整）' % WEEK_TARGET,
        })
    return out


def main():
    start = datetime.date(*[int(x) for x in START.split('-')])
    days = [start + datetime.timedelta(days=i) for i in range(DAYS)]
    weeks = natural_weeks(start, DAYS)

    # ---------------- 断言：先证明输入合法，再写盘 ----------------
    assert len(days) == DAYS, '天数不符'
    assert iso(days[0]) == START, '起始日期不符：%s' % iso(days[0])
    assert days[-1].weekday() == 5, '末日应为周六，实为 %s' % DOW_CN[days[-1].weekday()]
    covered = [d for w in weeks for d in w['days']]
    assert covered == [iso(d) for d in days], '周次切分未覆盖全部 30 天（漏或重）'
    assert len(covered) == len(set(covered)) == DAYS, '周次切分出现重复日期'
    # 自然周的边界只对「中间的周」是硬约束：
    #   首周从 START 那天开始（9/18 是周五，本来就不是周一）—— 断言它等于 START；
    #   末周止于第 30 天（可能是周六）—— 断言它等于 END；
    #   中间的周必须严格周一起、周日止；且相邻周必须首尾相接（不漏不重）。
    for i, w in enumerate(weeks):
        ds = [datetime.date(*[int(x) for x in s.split('-')]) for s in w['days']]
        if i == 0:
            assert w['from'] == START, 'W1 应从 %s 开始，实为 %s' % (START, w['from'])
        else:
            assert ds[0].weekday() == 0, 'W%d 首日不是周一' % w['idx']
        if i < len(weeks) - 1:
            assert ds[-1].weekday() == 6, 'W%d 末日不是周日' % w['idx']
        else:
            assert w['to'] == iso(days[-1]), '末周应止于 %s' % iso(days[-1])
        if i:
            prev_end = weeks[i - 1]['to']
            nxt = (datetime.date(*[int(x) for x in prev_end.split('-')])
                   + datetime.timedelta(days=1))
            assert w['from'] == iso(nxt), 'W%d 与 W%d 之间不连续' % (i, i + 1)
    assert len(RULES) == 12, '计分项应为 12 项，实为 %d' % len(RULES)
    assert len(set(r[0] for r in RULES)) == 12, '计分项 key 有重复'
    keys = [r[0] for r in RULES]

    day_recs = []
    for d in days:
        rec = {'date': iso(d), 'dow': DOW_CN[d.weekday()]}
        for k in keys:
            rec[k] = 0
        rec['premium'] = 0
        day_recs.append(rec)

    days_of = [w['dayCount'] for w in weeks]
    total_pts = sum(r[3] for r in RULES)

    data = {
        'meta': {
            'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'period': {'start': iso(days[0]), 'end': iso(days[-1]), 'days': DAYS},
            'note': ('已按公子指令清空全部活动数据，统计窗口自 %s 起 30 天，'
                     '周次按自然周（周一–周日）切分' % START),
        },
        'targets': {'week': WEEK_TARGET},
        'biz': {k: v for k, _n, v in BIZ},
        'bizMeta': [{'key': k, 'name': n} for k, n, _v in BIZ],
        'rules': [
            {'key': k, 'col': c, 'name': n, 'pts': p, 'group': g, 'note': note}
            for k, c, n, p, g, note in RULES
        ],
        'unscored': [],
        'days': day_recs,
        'weeks': weeks,
        'funnelRatioText': FUNNEL_RATIO_TEXT,
    }

    js = ('/* 本文件由 src/reset_seed.py 生成，请勿手工修改。\n'
          '   权威事实源：data/activity.json（两者内容一致）。 */\n'
          'window.ACT_SEED = '
          + json.dumps(data, ensure_ascii=False, separators=(',', ':'))
          + ';\n')

    json_path = os.path.join(ROOT, 'data', 'activity.json')
    js_path = os.path.join(BASE, 'data.js')
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    io.open(json_path, 'w', encoding='utf-8').write(
        json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    io.open(js_path, 'w', encoding='utf-8').write(js)

    print('种子已重建')
    print('  统计窗口  %s ~ %s（%d 天）' % (iso(days[0]), iso(days[-1]), DAYS))
    print('  计分项    %d 项，单轮满分 %d 分' % (len(RULES), total_pts))
    print('  周次切分  %s = %d 天' % ('+'.join(map(str, days_of)), sum(days_of)))
    print('  业务指标  %d 项（季度目标完成率为派生值，无存储）' % len(BIZ))
    print('  数据     全部为 0（已清空）')
    print('  写出      %s' % json_path)
    print('            %s' % js_path)


if __name__ == '__main__':
    main()
