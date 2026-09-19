#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""零依赖 xlsx 精确导出器：zipfile + ElementTree，输出真实共享字符串与公式。"""
import zipfile, re, sys, json
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
NSR = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

def colnum(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    letters, row = m.group(1), int(m.group(2))
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n, row

def colname(n):
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s

def read_shared(z):
    try:
        x = z.read('xl/sharedStrings.xml').decode('utf-8')
    except KeyError:
        return []
    root = ET.fromstring(x)
    out = []
    for si in root.findall(NS + 'si'):
        parts = []
        for t in si.iter(NS + 't'):
            parts.append(t.text or '')
        out.append(''.join(parts))
    return out

def read_formats(z):
    """返回 numFmtId -> formatCode"""
    try:
        x = z.read('xl/styles.xml').decode('utf-8')
    except KeyError:
        return {}
    root = ET.fromstring(x)
    fmts = {}
    for nf in root.iter(NS + 'numFmt'):
        fmts[int(nf.get('numFmtId'))] = nf.get('formatCode')
    # cellXfs: 每个 xf 的 numFmtId
    xfs = []
    cx = root.find(NS + 'cellXfs')
    if cx is not None:
        for xf in cx.findall(NS + 'xf'):
            xfs.append(int(xf.get('numFmtId', 0)))
    return fmts, xfs

def read_merges(z, path):
    x = z.read(path).decode('utf-8')
    root = ET.fromstring(x)
    out = []
    mc = root.find(NS + 'mergeCells')
    if mc is not None:
        for m in mc.findall(NS + 'mergeCell'):
            out.append(m.get('ref'))
    return out

def dump(f):
    z = zipfile.ZipFile(f)
    shared = read_shared(z)
    fmts, xfs = read_formats(z)
    wb = z.read('xl/workbook.xml').decode('utf-8')
    sheets = re.findall(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wb)
    rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
    relmap = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))

    print('##### FILE:', f)
    for name, rid in sheets:
        tgt = relmap[rid]
        path = 'xl/' + tgt.lstrip('/').replace('xl/', '')
        root = ET.fromstring(z.read(path).decode('utf-8'))
        grid = {}
        formulas = {}
        styles = {}
        maxc = 0
        maxr = 0
        for c in root.iter(NS + 'c'):
            ref = c.get('r')
            cn, rn = colnum(ref)
            t = c.get('t')
            s = c.get('s')
            v = c.find(NS + 'v')
            fnode = c.find(NS + 'f')
            isv = c.find(NS + 'is')
            val = None
            if t == 's' and v is not None:
                val = shared[int(v.text)]
            elif t == 'inlineStr' and isv is not None:
                val = ''.join(x.text or '' for x in isv.iter(NS + 't'))
            elif t == 'str' and v is not None:
                val = v.text
            elif v is not None:
                val = v.text
            if val is not None:
                grid[(rn, cn)] = val
                maxc = max(maxc, cn); maxr = max(maxr, rn)
            if fnode is not None:
                formulas[ref] = (fnode.text or '') + ('|SHARED:' + fnode.get('si') if fnode.get('si') else '')
            if s is not None:
                idx = int(s)
                nfid = xfs[idx] if idx < len(xfs) else 0
                styles[ref] = (idx, nfid, fmts.get(nfid, ''))
        dim = root.find(NS + 'dimension')
        print(bcolors('== SHEET: %s   dim=%s   merges=%d' % (name, dim.get('ref') if dim is not None else '?', len(read_merges(z, path)))))
        print('MERGE:', ','.join(read_merges(z, path)))
        for rn in range(1, maxr + 1):
            cells = []
            for cn in range(1, maxc + 1):
                if (rn, cn) in grid:
                    cells.append('%s=%s' % (colname(cn), grid[(rn, cn)].replace('\n', '\\n')))
            if cells:
                print('R%-3d %s' % (rn, ' | '.join(cells)))
        print('---- 公式 ----')
        for ref in sorted(formulas, key=lambda r: (colnum(r)[1], colnum(r)[0])):
            print('  %s: =%s' % (ref, formulas[ref]))

def bcolors(s):
    return s

if __name__ == '__main__':
    for p in sys.argv[1:]:
        dump(p)
        print()
