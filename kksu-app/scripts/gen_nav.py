#!/usr/bin/env python3
"""Генерирует src/core/routes.gen.ts из KKSU/Core/KKSUNavigation.swift:
маршруты модулей, названия, иконки, роли доступа, разделы хаба и карту задач."""
import json
import os
import re

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Swift-исходники iOS-приложения KKSU (репозиторий aiganymaset002-arch/KKSU-). Путь можно задать переменной KKSU_IOS_DIR.
ROOT = os.path.abspath(os.environ.get('KKSU_IOS_DIR', os.path.join(APP, '..', '..', 'KKSU-')))
SRC = os.path.join(ROOT, 'KKSU/Core/KKSUNavigation.swift')
OUT = os.path.join(APP, 'src', 'core', 'routes.gen.ts')
text = open(SRC, encoding='utf-8').read()

enum_body = text[text.index('enum KKSURoute'):]
cases = []
for line in enum_body.split('\n'):
    s = line.strip()
    if s.startswith('var title'):
        break
    if s.startswith('case '):
        cases += [c.strip() for c in s[5:].split(',') if c.strip()]


def switch_block(start_marker):
    i = text.index(start_marker)
    depth, j = 0, text.index('{', i)
    k = j
    while True:
        c = text[k]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[j:k]
        k += 1


def parse_switch(block):
    result, default = {}, None
    for m in re.finditer(r'case\s+((?:\.\w+\s*,\s*)*\.\w+)\s*:\s*return\s+(.+)', block):
        for c in re.findall(r'\.(\w+)', m.group(1)):
            result[c] = m.group(2).strip()
    dm = re.search(r'default\s*:\s*return\s+(.+)', block)
    if dm:
        default = dm.group(1).strip()
    return result, default


def swift_str(v):
    return json.loads(v)


titles, _ = parse_switch(switch_block('var title: String'))
icons, _ = parse_switch(switch_block('var icon: String'))
roles_raw, roles_default = parse_switch(switch_block('var roles: [KKSURole]'))
dest, _ = parse_switch(switch_block('var destination: AnyView'))


def roles_list(v):
    return re.findall(r'\.(\w+)', v)


routes = []
for c in cases:
    routes.append({
        'id': c,
        'title': swift_str(titles[c]),
        'icon': swift_str(icons[c]),
        'roles': roles_list(roles_raw.get(c, roles_default or '[]')),
        'swiftView': re.sub(r'^AnyView\((.*)\)$', r'\1', dest.get(c, '')),
    })

sections = []
for m in re.finditer(r'KKSUModuleSection\(title:\s*("(?:[^"\\]|\\.)*"),\s*routes:\s*\[([^\]]*)\]\)', text):
    sections.append({'title': swift_str(m.group(1)), 'routes': re.findall(r'\.(\w+)', m.group(2))})

features = []
for m in re.finditer(r'KKSUFeature\(id:\s*(\d+),\s*title:\s*("(?:[^"\\]|\\.)*"),\s*route:\s*\.(\w+)(?:,\s*note:\s*("(?:[^"\\]|\\.)*"))?\)', text):
    features.append({'id': int(m.group(1)), 'title': swift_str(m.group(2)), 'route': m.group(3),
                     'note': swift_str(m.group(4)) if m.group(4) else ''})

cab_block = switch_block('static func cabinet(for role: KKSURole)')
cabinet = {}
for m in re.finditer(r'case\s+((?:\.\w+\s*,\s*)*\.\w+)\s*:\s*return\s+\.(\w+)', cab_block):
    for r in re.findall(r'\.(\w+)', m.group(1)):
        cabinet[r] = m.group(2)

out = ['// Сгенерировано scripts/gen_nav.py из KKSU/Core/KKSUNavigation.swift. Не редактируйте вручную.\n',
       "import type { KKSURole } from './models.gen';\n\n",
       'export type RouteId = %s;\n\n' % ' | '.join(json.dumps(c) for c in cases),
       'export interface RouteInfo { id: RouteId; title: string; icon: string; roles: KKSURole[]; swiftView: string }\n\n',
       'export const ROUTES: Record<RouteId, RouteInfo> = %s;\n\n' % json.dumps({r['id']: r for r in routes}, ensure_ascii=False, indent=2),
       'export const ROUTE_IDS = Object.keys(ROUTES) as RouteId[];\n\n',
       'export const MODULE_SECTIONS: { title: string; routes: RouteId[] }[] = %s;\n\n' % json.dumps(sections, ensure_ascii=False, indent=2),
       'export const FEATURES: { id: number; title: string; route: RouteId; note: string }[] = %s;\n\n' % json.dumps(features, ensure_ascii=False, indent=2),
       'export const CABINET_FOR: Record<KKSURole, RouteId> = %s;\n\n' % json.dumps(cabinet, ensure_ascii=False, indent=2),
       'export function isAvailable(route: RouteId, role: KKSURole): boolean {\n'
       '  const roles = ROUTES[route].roles;\n  return roles.length === 0 || roles.includes(role);\n}\n']
open(OUT, 'w', encoding='utf-8').write(''.join(out))
print('routes: %d, sections: %d, features: %d -> %s' % (len(routes), len(sections), len(features), os.path.relpath(OUT, APP)))
