// ID и даты в формате iOS-приложения (Swift Codable):
// UUID — строка в верхнем регистре, Date — ISO 8601 без миллисекунд ("2026-11-27T10:00:00Z").

export function newId(): string {
  return crypto.randomUUID().toUpperCase();
}

export function toISO(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function nowISO(): string {
  return toISO(new Date());
}

/** Дата через `seconds` секунд от текущего момента. */
export function isoIn(seconds: number): string {
  return toISO(new Date(Date.now() + seconds * 1000));
}

export function isoYearsFromNow(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return toISO(d);
}

export function sameId(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && a.toUpperCase() === b.toUpperCase();
}

export function time(iso?: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}
