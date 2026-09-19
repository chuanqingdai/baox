#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从两个活动量模板 xlsx 精确抽取权威数据集，产出：
  data/activity.json   —— 权威数据（构建期与运行期共用口径的事实源）
  src/data.js          —— 同一份数据的浏览器可用形式（构建期内嵌）

零外部依赖：zipfile + xml.etree。所有数值直接取自单元格，不做任何人工转录。
抽取完成后执行逐日公式重算，并与源表「总」行比对，把口径差异记录在案。
"""
import zipfile, re, os, json, datetime
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW1 = os.path.join(ROOT, 'data', 'raw', '活动量 1.xlsx')
RAW3 = os.path.join(ROOT, 'data', 'raw', '活动量 3.xlsx')
EXCEL_EPOCH = datetime.date(1899, 12, 30)
DOW_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']


def colnum(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n, int(m.group(2))


def colname(n):
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def shared_strings(z):
    try:
        root = ET.fromstring(z.read('xl/sharedStrings.xml').decode('utf-8'))
    except KeyError:
        return []
    return [''.join(t.text or '' for t in si.iter(NS + 't')) for si in root.findall(NS + 'si')]


def sheet_paths(z):
    wb = z.read('xl/workbook.xml').decode('utf-8')
    rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
    relmap = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))
    out = []
    for name, rid in re.findall(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wb):
        tgt = relmap[rid]
        out.append((name, 'xl/' + tgt.lstrip('/').replace('xl/', '')))
    return out


def read_sheet(path, shared):
    """返回 {(row,col): raw_value}, {ref: formula}"""
    root = ET.fromstring(zipfile.ZipFile(path).read(path_inside(path)).decode('utf-8'))
    return None


def load(path):
    """读一个工作簿 → {sheetname: {'grid':{(r,c):val}, 'f':{ref:f}, 'merges':[..]}}"""
    z = zipfile.ZipFile(path)
    shared = shared_strings(z)
    result = {}
    for name, sp in sheet_paths(z):
        root = ET.fromstring(z.read(sp).decode('utf-8'))
        grid, formulas = {}, {}
        for c in root.iter(NS + 'c'):
            ref = c.get('r')
            if not ref:
                continue
            cn, rn = colnum(ref)
            t, v, isv = c.get('t'), c.find(NS + 'v'), c.find(NS + 'is')
            if t == 's' and v is not None:
                val = shared[int(v.text)]
            elif t == 'inlineStr' and isv is not None:
                val = ''.join(x.text or '' for x in isv.iter(NS + 't'))
            elif v is not None:
                val = v.text
            else:
                val = None
            if val is not None:
                grid[(rn, cn)] = val
            f = c.find(NS + 'f')
            if f is not None:
                formulas[ref] = f.text or ''
        merges = []
        mc = root.find(NS + 'mergeCells')
        if mc is not None:
            merges = [m.get('ref') for m in mc.findall(NS + 'mergeCell')]
        result[name] = {'grid': grid, 'f': formulas, 'merges': merges}
    return result


path_inside = None  # 占位，避免误用


def cell(g, r, c):
    return g.get((r, c), '')


def num(g, r, c):
    v = cell(g, r, c)
    if v == '' or v is None:
        return 0
    try:
        return float(v)
    except ValueError:
        return 0


# --------------------------------------------------------------------------
# ① 计分规则（来源：活动量 3.xlsx「日活动量打卡」第 2 行表头 + 第 39 行计分说明）
# --------------------------------------------------------------------------
RULES = [
    {'key': 'circle',   'col': 'B', 'name': '朋友圈',    'pts': 1, 'group': '个人品牌',
     'note': '一条 1 分，不限内容'},
    {'key': 'article',  'col': 'D', 'name': '文章|视频', 'pts': 1, 'group': '个人品牌',
     'note': '一条 1 分，不限内容'},
    {'key': 'friend',   'col': 'C', 'name': '新增好友',  'pts': 1, 'group': '销售流程',
     'note': '一人 1 分'},
    {'key': 'visit',    'col': 'E', 'name': '约访',      'pts': 1, 'group': '销售流程',
     'note': '一人 1 分，有约对方做进一步需求分析沟通动作就算，成败不限'},
    {'key': 'need',     'col': 'F', 'name': '需求分析',  'pts': 2, 'group': '销售流程',
     'note': '初次面谈一次 2 分'},
    {'key': 'plan',     'col': 'G', 'name': '方案呈现',  'pts': 3, 'group': '销售流程',
     'note': '二次面谈一次 3 分'},
    {'key': 'close',    'col': 'H', 'name': '促成签单',  'pts': 5, 'group': '销售流程',
     'note': '成交一个单子 5 分，不限险种不限人数'},
    {'key': 'refer',    'col': 'J', 'name': '转介绍',    'pts': 1, 'group': '销售流程',
     'note': '一人 1 分，自己开口要或客户主动来都算'},
    {'key': 'service',  'col': 'K', 'name': '客户服务',  'pts': 1, 'group': '销售流程',
     'note': '续保理赔、下午茶叙旧、跟进询问、修改方案都算；首次需求分析与方案呈现不算'},
    {'key': 'recTalk',  'col': 'L', 'name': '约聊增员',  'pts': 1, 'group': '增员流程',
     'note': '一人 1 分'},
    {'key': 'recJoin',  'col': 'M', 'name': '入职增员',  'pts': 5, 'group': '增员流程',
     'note': '一人 5 分（源表第 2 行标注 5 分），只要录入系统就算'},
]
UNSCORED = [
    {'key': 'family', 'col': 'I', 'name': '成交家庭数', 'pts': 0, 'group': '成交',
     'note': '不计分，仅记录'},
]


def main():
    wb1 = load(RAW1)
    wb3 = load(RAW3)

    # ---------------- 活动量 3：逐日打卡 ----------------
    g3 = wb3['日活动量打卡']['grid']
    days = []
    for r in range(3, 33):                      # 第 3–32 行 = 30 天
        serial = num(g3, r, 1)
        d = EXCEL_EPOCH + datetime.timedelta(days=int(serial))
        rec = {'date': d.isoformat(), 'dow': DOW_CN[d.weekday()], 'serial': int(serial)}
        for rule in RULES + UNSCORED:
            c = ord(rule['col']) - 64
            rec[rule['key']] = num(g3, r, c)
        rec['premium'] = num(g3, r, 18)          # R 列 成交保费（计入 MDRT）
        days.append(rec)

    # ---------------- 周分块（来源：O/P/Q/S 列的纵向合并区） ----------------
    def merge_rows(ref):
        m = re.match(r'([A-Z]+)(\d+):([A-Z]+)(\d+)', ref)
        return int(m.group(2)), int(m.group(4))

    week_spans = sorted([merge_rows(m) for m in wb3['日活动量打卡']['merges']
                         if m.startswith('O') and ':' in m])
    weeks = []
    for i, (r0, r1) in enumerate(week_spans):
        seg = [d for d in days if r0 <= d['serial'] - days[0]['serial'] + 3 <= r1]
        is_short = (r1 - r0 + 1) < 7
        weeks.append({
            'idx': i + 1,
            'from': seg[0]['date'], 'to': seg[-1]['date'],
            'rows': [r0, r1],
            'days': [d['date'] for d in seg],
            'dayCount': len(seg),
            'target': 8750 if is_short else 17500,
            'targetNote': '首周 4 天，周目标按 8750 计' if is_short else '标准周目标 17500',
        })

    # ---------------- 源表「总」行（原样保留，用于口径比对） ----------------
    src_total = {}
    for k, col in [('B', 'circle'), ('C', 'friend'), ('D', 'article'), ('E', 'visit'),
                   ('F', 'need'), ('G', 'plan'), ('H', 'close'), ('I', 'family'),
                   ('J', 'refer'), ('K', 'service'), ('L', 'recTalk'), ('M', 'recJoin')]:
        src_total[col] = num(g3, 33, ord(k) - 64)
    src_total['N'] = num(g3, 33, 14)
    src_total['P'] = num(g3, 33, 16)
    src_total['Q'] = num(g3, 33, 17)
    src_total['S'] = num(g3, 33, 19)
    src_total['mdrt'] = num(g3, 34, 17)
    src_total['formula_N33'] = wb3['日活动量打卡']['f'].get('N33', '')
    src_total['formula_P33'] = wb3['日活动量打卡']['f'].get('P33', '')
    src_total['formula_Q33'] = wb3['日活动量打卡']['f'].get('Q33', '')
    src_total['formula_S33'] = wb3['日活动量打卡']['f'].get('S33', '')
    src_total['formula_Q34'] = wb3['日活动量打卡']['f'].get('Q34', '')

    # ---------------- 源表成功方程式 ----------------
    funnel = [
        {'label': '约访成功率', 'cell': 'F35',
         'val': num(g3, 35, 6), 'ref': '≥50%', 'formula': wb3['日活动量打卡']['f'].get('F35', '')},
        {'label': '面谈成功率', 'cell': 'F36',
         'val': num(g3, 36, 6), 'ref': '≥67%', 'formula': wb3['日活动量打卡']['f'].get('F36', '')},
        {'label': '方案促成率', 'cell': 'F37',
         'val': num(g3, 37, 6), 'ref': '≥50%', 'formula': wb3['日活动量打卡']['f'].get('F37', '')},
    ]

    # ---------------- 活动量 1：模板结构（无数据，仅结构） ----------------
    g1 = wb1['活动量']['grid']
    tpl_weekly_log = {
        'title': cell(g1, 1, 1),
        'dateLine': cell(g1, 2, 1),
        'timeSlots': [cell(g1, r, 1) for r in range(4, 18)],
        'timeSlotsRaw': [num(g1, r, 1) for r in range(4, 18)],
        'weekdays': [cell(g1, 3, c) for c in (4, 6, 8, 10, 12, 14, 16)],
        'recordCats': [
            {'cat': cell(g1, 19, 1), 'items': [cell(g1, 19, 2), cell(g1, 20, 2)]},
            {'cat': cell(g1, 21, 1), 'items': [cell(g1, 21, 2), cell(g1, 22, 2)]},
            {'cat': cell(g1, 23, 1), 'items': [cell(g1, 23, 2), cell(g1, 24, 2)]},
            {'cat': cell(g1, 25, 1), 'items': [cell(g1, 25, 3), cell(g1, 26, 3)]},
        ],
        'scoreRows': [
            {'group': cell(g1, 28, 1), 'item': cell(g1, 28, 2)},
            {'group': cell(g1, 29, 1), 'item': cell(g1, 29, 2)},
            {'group': '', 'item': cell(g1, 30, 2)},
            {'group': '', 'item': cell(g1, 31, 2)},
            {'group': '', 'item': cell(g1, 32, 2)},
            {'group': '', 'item': cell(g1, 33, 3)},
            {'group': '', 'item': cell(g1, 34, 3)},
            {'group': '', 'item': cell(g1, 35, 2)},
            {'group': cell(g1, 36, 1), 'item': cell(g1, 36, 2)},
            {'group': '', 'item': cell(g1, 37, 2)},
            {'group': '', 'item': cell(g1, 38, 2)},
            {'group': '', 'item': cell(g1, 39, 2)},
            {'group': cell(g1, 40, 1), 'item': cell(g1, 40, 2)},
        ],
    }

    gs1 = wb1['Sheet1']['grid']
    tpl_week_summary = {
        'headers': [cell(gs1, 1, c).strip() for c in range(1, 14)],
        'weekKeys': [cell(gs1, r, 1) for r in range(2, 13)],
    }

    data = {
        'meta': {
            'generatedAt': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'sources': [
                {'file': '活动量 1.xlsx',
                 'sheets': [{'name': '活动量', 'kind': '周工作日志模板（含计分口径，无数据）'},
                            {'name': 'Sheet1', 'kind': '周汇总骨架（13 字段，无数据）'}]},
                {'file': '活动量 3.xlsx',
                 'sheets': [{'name': '日活动量打卡', 'kind': '逐日打卡实绩（唯一含真实数据）'}]},
            ],
            'period': {'start': days[0]['date'], 'end': days[-1]['date'], 'days': len(days)},
            'owner': cell(g3, 1, 1),
        },
        'targets': {'week': 17500, 'weekShort': 8750, 'month': 70000,
                    'mdrtCarry': 178103,
                    'targetText': cell(g3, 35, 16)},
        'rules': RULES,
        'unscored': UNSCORED,
        'days': days,
        'weeks': weeks,
        'sourceTotal': src_total,
        'funnel': funnel,
        'funnelRatioText': cell(g3, 38, 1),
        'rulesText': cell(g3, 39, 1),
        'templates': {'weeklyLog': tpl_weekly_log, 'weekSummary': tpl_week_summary},
    }

    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'activity.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # ---------------- src/data.js ----------------
    js = ('/* 本文件由 src/gen_data.py 从 data/raw/*.xlsx 自动生成，请勿手工修改。\n'
          '   权威事实源：data/activity.json（两者内容一致）。 */\n'
          'window.ACT_SEED = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    with open(os.path.join(ROOT, 'src', 'data.js'), 'w', encoding='utf-8') as f:
        f.write(js)

    # ---------------- 逐日公式重算校验 ----------------
    print('== 逐日重算校验（口径：N = B+C+D+E+F*2+G*3+H*5+J+K+L+M*5）==')
    bad = 0
    for d in days:
        calc = (d['circle'] + d['friend'] + d['article'] + d['visit']
                + d['need'] * 2 + d['plan'] * 3 + d['close'] * 5
                + d['refer'] + d['service'] + d['recTalk'] + d['recJoin'] * 5)
        # 源表 N 列
        r = days.index(d) + 3
        src = num(g3, r, 14)
        flag = 'OK ' if abs(calc - src) < 1e-9 else '!! '
        if flag == '!! ':
            bad += 1
        print('  %s %s  重算=%-4g 源N列=%-4g' % (flag, d['date'], calc, src))
    print('  逐日不一致条数：%d' % bad)

    # 合计比对
    def col_sum(col):
        c = ord(col) - 64
        return round(sum(num(g3, r, c) for r in range(3, 33)), 6)

    print('\n== 合计口径比对 ==')
    direct = {}
    for rule in RULES:
        direct[rule['key']] = col_sum(rule['col'])
    weighted = sum(direct[r['key']] * r['pts'] for r in RULES)
    print('  按 30 天（第 3–32 行）逐列汇总后加权 = %g' % weighted)
    print('  源表「总」行 N33 = %g   （公式 %s）' % (src_total['N'], src_total['formula_N33']))
    missing = src_total['N'] - weighted
    print('  差异 = %g' % missing)
    row30 = {rule['key']: round(sum(num(g3, r, ord(rule['col']) - 64) for r in range(3, 31)), 6)
             for rule in RULES}
    w30 = sum(row30[r['key']] * r['pts'] for r in RULES)
    print('  按第 3–30 行（排除末 2 天）逐列汇总后加权 = %g' % w30)
    print('  源表漏计列分值：新增好友=%g×1=%g，约聊增员=%g×1=%g，末 2 天总分=%g'
          % (direct['friend'], direct['friend'], direct['recTalk'], direct['recTalk'], weighted - w30))

    print('\n== 周分块 ==')
    for w in weeks:
        seg = [d for d in days if d['date'] in w['days']]
        s = sum(d['circle'] + d['friend'] + d['article'] + d['visit'] + d['need'] * 2
                + d['plan'] * 3 + d['close'] * 5 + d['refer'] + d['service']
                + d['recTalk'] + d['recJoin'] * 5 for d in seg)
        p = sum(d['premium'] for d in seg)
        print('  W%d %s~%s %d天 总分=%g 保费=%g 达标率=%.1f%%'
              % (w['idx'], w['from'], w['to'], w['dayCount'], s, round(p, 2), p / w['target'] * 100))

    print('\n产物：data/activity.json  src/data.js')


if __name__ == '__main__':
    main()
