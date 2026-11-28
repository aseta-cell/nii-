#!/usr/bin/env python3
"""Генерирует src/core/models.gen.ts из Swift-моделей iOS-приложения KKSU.

Сайт читает и пишет те же записи в Supabase (kksu_records), что и iPhone-приложение,
поэтому типы, значения по умолчанию и названия перечислений берутся прямо из Swift.
Запуск: npm run gen (из папки web).
"""
import os
import re
import sys

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Swift-исходники iOS-приложения KKSU (репозиторий aiganymaset002-arch/KKSU-). Путь можно задать переменной KKSU_IOS_DIR.
ROOT = os.path.abspath(os.environ.get('KKSU_IOS_DIR', os.path.join(APP, '..', '..', 'KKSU-')))
SOURCES = [
    'KKSU/App/User.swift',
    'KKSU/Core/KKSUModels.swift',
    'KKSU/Core/KKSUBilling.swift',
    'KKSU/Core/KKSUCourseModels.swift',
    'KKSU/Core/KKSUModeration.swift',
]
OUT = os.path.join(APP, 'src', 'core', 'models.gen.ts')
SKIP_TYPES = {'KKSUBillingDatabase', 'KKSUBillingSeed', 'KKSUPaymentDefaults', 'YouTubeLink', 'KKSUContentFilter', 'Key'}


def brace_delta(line):
    """Разница { и } вне строковых литералов."""
    depth, in_str, i = 0, False, 0
    while i < len(line):
        c = line[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == '/' and line[i:i + 2] == '//':
                break
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
        i += 1
    return depth


def top_level_blocks(text):
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        m = re.match(r'^(struct|enum)\s+(\w+)\s*(?::\s*([^{]+))?\{', lines[i])
        if m:
            kind, name, inherits = m.group(1), m.group(2), (m.group(3) or '')
            depth = brace_delta(lines[i])
            body = []
            i += 1
            while i < len(lines) and depth > 0:
                d = brace_delta(lines[i])
                if depth + d > 0 or d >= 0:
                    body.append(lines[i])
                depth += d
                i += 1
            yield kind, name, inherits, body
            continue
        i += 1


def member_lines(body):
    """Строки тела на глубине 1 вместе с вложенным блоком (для computed-свойств)."""
    depth = 0
    i = 0
    while i < len(body):
        line = body[i]
        if depth == 0:
            d = brace_delta(line)
            block = [line]
            if d > 0:
                j = i + 1
                dd = d
                while j < len(body) and dd > 0:
                    block.append(body[j])
                    dd += brace_delta(body[j])
                    j += 1
                yield line, block
                i = j
                continue
            yield line, block
        i += 1


SWIFT_TO_TS = {'String': 'string', 'Int': 'number', 'Double': 'number', 'Bool': 'boolean',
               'UUID': 'string', 'Date': 'string'}


def ts_type(t):
    t = t.strip()
    if t.endswith('?'):
        return ts_type(t[:-1])
    m = re.match(r'^\[(.+?)\s*:\s*(.+)\]$', t)
    if m:
        return 'Record<string, %s>' % ts_type(m.group(2))
    m = re.match(r'^\[(.+)\]$', t)
    if m:
        inner = ts_type(m.group(1))
        return ('(%s)[]' % inner) if '|' in inner else inner + '[]'
    return SWIFT_TO_TS.get(t, t)


def kind_of(t):
    """Описание типа поля для нормализации перед отправкой на сервер."""
    t = t.strip().rstrip('?')
    m = re.match(r'^\[(.+?)\s*:\s*(.+)\]$', t)
    if m:
        return {'map': kind_of(m.group(2))}
    m = re.match(r'^\[(.+)\]$', t)
    if m:
        return {'array': kind_of(m.group(1))}
    return {'Int': 'int', 'Double': 'double', 'Bool': 'bool', 'String': 'string',
            'UUID': 'uuid', 'Date': 'date'}.get(t, t)


enums = {}    # name -> {'cases': [(case, raw)], 'props': {prop: {case: value}}, 'ptypes': {prop: tstype}}
structs = {}  # name -> [(field, swift_type, optional, default_expr)]
order = []


def parse_enum(name, inherits, body):
    if 'String' not in inherits and 'Codable' not in inherits:
        return
    cases = []
    props, ptypes = {}, {}
    for line, block in member_lines(body):
        s = line.strip()
        if s.startswith('case ') and len(block) == 1:
            for part in s[5:].split(','):
                part = part.strip()
                if not part:
                    continue
                m = re.match(r'^(\w+)\s*=\s*"([^"]*)"$', part)
                if m:
                    cases.append((m.group(1), m.group(2)))
                elif re.match(r'^\w+$', part):
                    cases.append((part, part))
        m = re.match(r'^var\s+(\w+)\s*:\s*(String|Int|Double|Bool)\s*\{', s)
        if m and len(block) > 1:
            prop, ptype = m.group(1), m.group(2)
            text = '\n'.join(block)
            if 'switch self' not in text:
                continue
            values, ok = {}, True
            for cm in re.finditer(r'case\s+((?:\.\w+\s*,\s*)*\.\w+)\s*:\s*return\s+(.+)', text):
                val = cm.group(2).strip()
                if '\\(' in val:
                    ok = False
                    break
                for c in re.findall(r'\.(\w+)', cm.group(1)):
                    values[c] = val
            dm = re.search(r'default\s*:\s*return\s+(.+)', text)
            if not ok or not values:
                continue
            for case, _raw in cases:
                if case not in values and dm:
                    values[case] = dm.group(1).strip()
            if all(c in values for c, _ in cases):
                props[prop] = values
                ptypes[prop] = SWIFT_TO_TS[ptype]
    if cases:
        enums[name] = {'cases': cases, 'props': props, 'ptypes': ptypes}
        order.append(('enum', name))


def parse_struct(name, body):
    fields = []
    for line, block in member_lines(body):
        s = line.strip()
        if len(block) > 1 and not re.match(r'^(var|let)\s+\w+\s*(:[^={]+)?=', s):
            continue  # computed property, func, init, nested type
        s = re.sub(r'//.*$', '', s).strip()
        if re.match(r'^(?:private\s+)?var\s+\w+\s*:\s*[^=]+\{', s):
            continue  # однострочное computed-свойство
        m = re.match(r'^(?:private\s+|public\s+)?(var|let)\s+(\w+)\s*(?::\s*([^=]+?))?\s*(?:=\s*(.+))?$', s)
        if not m or s.startswith('static'):
            continue
        _kw, fname, ftype, default = m.groups()
        if ftype is None:
            ftype = infer_type(default)
        ftype = ftype.strip()
        fields.append((fname, ftype, ftype.endswith('?'), default.strip() if default else None))
    structs[name] = fields
    order.append(('struct', name))


def infer_type(default):
    d = (default or '').strip()
    if d == 'UUID()':
        return 'UUID'
    if d.startswith('Date()'):
        return 'Date'
    if d in ('true', 'false'):
        return 'Bool'
    if re.match(r'^-?\d+$', d):
        return 'Int'
    if re.match(r'^-?\d+\.\d+$', d):
        return 'Double'
    if d.startswith('"'):
        return 'String'
    m = re.match(r'^(\w+)\(\)$', d)
    if m:
        return m.group(1)
    m = re.match(r'^KKSUPaymentDefaults\.(\w+)$', d)
    if m:
        return {'recipientPhone': 'String', 'recipientName': 'String', 'usdToKzt': 'Double', 'eurToKzt': 'Double'}[m.group(1)]
    raise SystemExit('Не могу определить тип по значению: %r' % default)


def enum_raw(enum_name, case):
    for c, raw in enums[enum_name]['cases']:
        if c == case:
            return raw
    raise SystemExit('Нет case .%s в %s' % (case, enum_name))


def ts_default(ftype, default):
    t = ftype.rstrip('?').strip()
    d = default
    if d == 'nil':
        return None
    if d == 'UUID()':
        return 'newId()'
    if d == 'Date()':
        return 'nowISO()'
    m = re.match(r'^Date\(\)\.addingTimeInterval\((.+)\)$', d)
    if m:
        return 'isoIn(%s)' % m.group(1)
    if d.startswith('Calendar.current.date(byAdding: .year, value: '):
        years = re.search(r'value:\s*(-?\d+)', d).group(1)
        return 'isoYearsFromNow(%s)' % years
    if d in ('[]',):
        return '[]'
    if d == '[:]':
        return '{}'
    if re.match(r'^-?\d+(\.\d+)?$', d) or d in ('true', 'false'):
        return d
    if d.startswith('"'):
        return d
    if d.startswith('.'):
        return '%r' % enum_raw(t, d[1:])
    m = re.match(r'^\[(.*)\]$', d)
    if m and t.startswith('['):
        inner = t[1:-1].strip()
        items = [x.strip() for x in m.group(1).split(',') if x.strip()]
        out = []
        for it in items:
            if it.startswith('.'):
                out.append('%r' % enum_raw(inner, it[1:]))
            else:
                out.append(it)
        return '[%s]' % ', '.join(out)
    m = re.match(r'^(\w+)\(\)$', d)
    if m:
        return 'make%s()' % m.group(1)
    m = re.match(r'^KKSUPaymentDefaults\.(\w+)$', d)
    if m:
        return 'KKSUPaymentDefaults.%s' % m.group(1)
    if d == 'PaymentMethod.manualCases':
        return 'paymentMethodManualCases()'
    raise SystemExit('Неизвестное значение по умолчанию: %s = %s' % (ftype, d))


for rel in SOURCES:
    text = open(os.path.join(ROOT, rel), encoding='utf-8').read()
    for kind, name, inherits, body in top_level_blocks(text):
        if name in SKIP_TYPES:
            continue
        if kind == 'enum':
            parse_enum(name, inherits, body)
        elif 'Codable' in inherits:
            parse_struct(name, body)

out = []
w = out.append
w('// Сгенерировано scripts/gen_models.py из Swift-моделей iOS-приложения. Не редактируйте вручную.\n')
w("import { newId, nowISO, isoIn, isoYearsFromNow } from './ids';\n")
w("import { KKSUPaymentDefaults, paymentMethodManualCases } from './constants';\n\n")
w('export type FieldKind = string | { array: FieldKind } | { map: FieldKind };\n')
w('export interface FieldInfo { kind: FieldKind; optional: boolean }\n\n')

for kind, name in order:
    if kind == 'enum':
        e = enums[name]
        raws = [raw for _, raw in e['cases']]
        w('export type %s = %s;\n' % (name, ' | '.join(repr(r) for r in raws)))
        w('export const %s = {\n' % name)
        w('  values: [%s] as %s[],\n' % (', '.join(repr(r) for r in raws), name))
        for prop, values in e['props'].items():
            ptype = e['ptypes'][prop]
            pairs = ', '.join('%r: %s' % (raw, values[case]) for case, raw in e['cases'])
            w('  %s: { %s } as Record<%s, %s>,\n' % (prop, pairs, name, ptype))
        w('};\n\n')
    else:
        fields = structs[name]
        w('export interface %s {\n' % name)
        for fname, ftype, optional, _d in fields:
            w('  %s%s: %s;\n' % (fname, '?' if optional else '', ts_type(ftype)))
        w('}\n')
        required = [f for f, t, opt, d in fields if d is None and not opt]
        req_type = ('Pick<%s, %s>' % (name, ' | '.join(repr(r) for r in required))) if required else '{}'
        w('export function make%s(init: %s & Partial<%s>%s): %s {\n' % (
            name, req_type, name, '' if required else ' = {}', name))
        w('  return {\n')
        for fname, ftype, optional, d in fields:
            if d is None:
                continue
            val = ts_default(ftype, d)
            if val is not None:
                w('    %s: %s,\n' % (fname, val))
        w('    ...init,\n  } as %s;\n}\n\n' % name)

w('/** Типы полей каждой модели: для приведения к формату Swift Codable перед записью на сервер. */\n')
w('export const SCHEMA: Record<string, Record<string, FieldInfo>> = {\n')
for kind, name in order:
    if kind != 'struct':
        continue
    w('  %s: {\n' % name)
    for fname, ftype, optional, _d in structs[name]:
        k = kind_of(ftype)
        if isinstance(k, str) and k in enums:
            k = 'string'
        def fix(x):
            if isinstance(x, dict):
                key = list(x)[0]
                return {key: fix(x[key])}
            return 'string' if x in enums else x
        k = fix(k)
        w('    %s: { kind: %s, optional: %s },\n' % (fname, repr(k).replace("'", '"'), 'true' if optional else 'false'))
    w('  },\n')
w('};\n')

text = ''.join(out)
body = text.split('\n', 3)[3]
helpers = [h for h in ('newId', 'nowISO', 'isoIn', 'isoYearsFromNow') if h + '(' in body]
consts = [h for h in ('KKSUPaymentDefaults', 'paymentMethodManualCases') if h in body]
text = text.replace("import { newId, nowISO, isoIn, isoYearsFromNow } from './ids';", "import { %s } from './ids';" % ', '.join(helpers))
text = text.replace("import { KKSUPaymentDefaults, paymentMethodManualCases } from './constants';", "import { %s } from './constants';" % ', '.join(consts))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(text)
print('enums: %d, structs: %d -> %s' % (len(enums), len(structs), os.path.relpath(OUT, APP)))
