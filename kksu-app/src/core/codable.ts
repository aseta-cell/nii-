// Приведение объектов к формату, который без ошибок читает Swift Codable в iOS-приложении:
// целые числа для Int, даты без миллисекунд, UUID в верхнем регистре, без null у необязательных полей.
import { SCHEMA, type FieldKind } from './models.gen';
import { toISO } from './ids';

function normalizeValue(kind: FieldKind, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof kind === 'object') {
    if ('array' in kind) return Array.isArray(value) ? value.map((v) => normalizeValue(kind.array, v)) : [];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalizeValue(kind.map, v);
    return out;
  }
  switch (kind) {
    case 'int': return Math.round(Number(value) || 0);
    case 'double': return Number(value) || 0;
    case 'bool': return !!value;
    case 'string': return String(value);
    case 'uuid': return String(value).toUpperCase();
    case 'date': {
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? toISO(new Date()) : toISO(d);
    }
    default:
      return SCHEMA[kind] ? normalize(kind, value) : value;
  }
}

export function normalize<T>(typeName: string, value: T): T {
  const schema = SCHEMA[typeName];
  if (!schema) return value;
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [field, info] of Object.entries(schema)) {
    const v = normalizeValue(info.kind, src[field]);
    if (v === undefined) {
      if (!info.optional) {
        // Обязательное поле без значения: ставим нейтральное, чтобы Swift смог прочитать запись.
        out[field] = emptyOf(info.kind);
      }
      continue;
    }
    out[field] = v;
  }
  return out as T;
}

function emptyOf(kind: FieldKind): unknown {
  if (typeof kind === 'object') return 'array' in kind ? [] : {};
  switch (kind) {
    case 'int': case 'double': return 0;
    case 'bool': return false;
    case 'date': return toISO(new Date());
    default: return '';
  }
}
