// Сервер KKSU на Supabase — тот же проект, что у iOS-приложения (KKSUCloud.swift):
// Supabase Auth для входа, таблицы kksu_members и kksu_records, хранилище файлов kksu-files.
// В браузере только публичный (publishable) ключ; доступ к данным ограничивают правила RLS.
import { applyAll, encodeAll, STAFF_ONLY_COLLECTIONS, SYNCED_NAMES, type PulledRow, type SyncState } from './collections';
import type { KKSURole } from './models.gen';

export const CLOUD = {
  projectURL: 'https://vllechyeunbtozhubuud.supabase.co',
  anonKey: 'sb_publishable_ThNRdPI2yoG1rQxLAiwusg_CmxF8Y7Y',
  schoolID: 'kksu',
  filesBucket: 'kksu-files',
  storageScheme: 'kksu-storage:',
  maxUploadBytes: 50 * 1024 * 1024,
};

export interface CloudSession { accessToken: string; refreshToken: string; userID: string; email: string; expiresAt: number }
export interface CloudMember { user_id: string; school_id: string; role: string; full_name: string; approved: boolean; blocked: boolean; created_at?: string }

export class CloudError extends Error {
  constructor(message: string, public code = 0, public kind: 'http' | 'emailConfirmation' | 'pendingApproval' | 'blocked' | 'noSession' | 'wrongRole' = 'http') {
    super(message);
  }
}

const ROLE_TITLES: Record<string, string> = {
  student: 'Ученик', parent: 'Родитель', teacher: 'Педагог', psychologist: 'Психолог',
  expert: 'Эксперт', mentor: 'Наставник', partner: 'Партнёр', admin: 'Администратор',
};

export function memberRole(m: CloudMember): KKSURole {
  return (Object.keys(ROLE_TITLES).includes(m.role) ? m.role : 'student') as KKSURole;
}

function translate(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Неверный email или пароль.';
  if (lower.includes('already registered')) return 'Пользователь с таким email уже зарегистрирован.';
  if (lower.includes('email not confirmed')) return 'Подтвердите email по ссылке из письма.';
  if (lower.includes('password should be')) return 'Пароль слишком простой: минимум 8 символов.';
  if (lower.includes('token has expired') || lower.includes('otp')) return 'Код неверный или устарел.';
  if (lower.includes('row-level security')) return 'Недостаточно прав для этого действия.';
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) return 'Нет связи с сервером KKSU. Проверьте интернет.';
  return message;
}

const SESSION_KEY = 'kksu.web.session';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return '{' + Object.keys(obj).sort().filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hashString(text: string): string {
  let h1 = 0xdeadbeef ^ text.length, h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

export class KKSUCloud {
  session: CloudSession | null = null;
  members: CloudMember[] = [];
  private knownHashes = new Map<string, string>();
  private rejectedHashes = new Map<string, string>();
  private lastPull: string | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch { this.session = null; }
  }

  get isSignedIn() { return !!this.session; }

  private saveSession() {
    try {
      if (this.session) localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* приватный режим браузера */ }
  }

  resetSyncState() {
    this.knownHashes.clear();
    this.rejectedHashes.clear();
    this.lastPull = null;
  }

  // MARK: HTTP

  private async request(path: string, init: { method?: string; json?: unknown; authorized?: boolean; headers?: Record<string, string> } = {}): Promise<any> {
    const authorized = init.authorized ?? true;
    if (authorized) await this.refreshIfNeeded();
    const headers: Record<string, string> = { apikey: CLOUD.anonKey, 'Content-Type': 'application/json', ...(init.headers ?? {}) };
    // Новые ключи sb_publishable_ — не JWT: без сессии достаточно заголовка apikey.
    if (authorized && this.session) headers.Authorization = `Bearer ${this.session.accessToken}`;
    let response: Response;
    try {
      response = await fetch(CLOUD.projectURL + path, {
        method: init.method ?? 'GET', headers,
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      });
    } catch (e) {
      throw new CloudError(translate(String((e as Error).message)));
    }
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const message = (data && (data.error_description || data.msg || data.message || data.error)) || '';
      if (response.status === 401 && authorized) this.handleExpired();
      throw new CloudError(message ? translate(String(message)) : `Ошибка сервера (${response.status}).`, response.status);
    }
    return data;
  }

  private handleExpired() {
    // Токен не принят сервером — пробуем обновить при следующем запросе.
    if (this.session) this.session.expiresAt = 0;
  }

  private applyAuthResponse(data: any, fallbackEmail: string): CloudSession | null {
    if (!data?.access_token || !data?.refresh_token || !data?.user?.id) return null;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userID: String(data.user.id).toUpperCase(),
      email: data.user.email ?? fallbackEmail,
      expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
    };
  }

  private refreshing: Promise<void> | null = null;

  private async refreshIfNeeded() {
    const current = this.session;
    if (!current || current.expiresAt > Date.now()) return;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const response = await fetch(`${CLOUD.projectURL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST', headers: { apikey: CLOUD.anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: current.refreshToken }),
          });
          const data = response.ok ? await response.json() : null;
          const refreshed = data ? this.applyAuthResponse(data, current.email) : null;
          this.session = refreshed;
          this.saveSession();
          if (!refreshed) throw new CloudError('Сессия истекла. Войдите снова.', 401, 'noSession');
        } finally {
          this.refreshing = null;
        }
      })();
    }
    await this.refreshing;
  }

  // MARK: Аккаунты

  /** Регистрация. Если в проекте включено подтверждение email — бросает CloudError(kind: emailConfirmation). */
  async signUp(fullName: string, email: string, phone: string, password: string, role: KKSURole): Promise<CloudMember> {
    const data = await this.request('/auth/v1/signup', {
      method: 'POST', authorized: false,
      json: { email, password, data: { full_name: fullName, role, phone } },
    });
    const session = this.applyAuthResponse(data, email);
    if (!session) throw new CloudError('Мы отправили письмо для подтверждения email. Подтвердите адрес и войдите.', 0, 'emailConfirmation');
    this.session = session;
    this.saveSession();
    return this.ensureMember(role, fullName);
  }

  async signIn(email: string, password: string): Promise<{ member: CloudMember; fullName: string; phone: string; role: KKSURole }> {
    const data = await this.request('/auth/v1/token?grant_type=password', {
      method: 'POST', authorized: false, json: { email, password },
    });
    const session = this.applyAuthResponse(data, email);
    if (!session) throw new CloudError('Войдите в аккаунт.', 0, 'noSession');
    this.session = session;
    this.saveSession();
    const meta = data?.user?.user_metadata ?? {};
    const requested = (Object.keys(ROLE_TITLES).includes(meta.role) ? meta.role : 'student') as KKSURole;
    const fullName = meta.full_name ?? email;
    const member = await this.ensureMember(requested, fullName);
    return { member, fullName, phone: meta.phone ?? '', role: requested };
  }

  /** Проверки после входа — как finishSignIn в iOS. */
  async checkMember(member: CloudMember, expectedRole?: KKSURole) {
    if (member.blocked) { await this.signOut(); throw new CloudError('Аккаунт заблокирован. Обратитесь к администратору.', 0, 'blocked'); }
    if (expectedRole && expectedRole !== memberRole(member)) {
      await this.signOut();
      throw new CloudError(`Этот аккаунт зарегистрирован с ролью «${ROLE_TITLES[memberRole(member)]}». Выберите её.`, 0, 'wrongRole');
    }
    if (!member.approved) { await this.signOut(); throw new CloudError('Аккаунт сотрудника ожидает подтверждения администратором KKSU.', 0, 'pendingApproval'); }
  }

  private async ensureMember(role: KKSURole, fullName: string): Promise<CloudMember> {
    if (!this.session) throw new CloudError('Войдите в аккаунт.', 0, 'noSession');
    const existing = await this.fetchMember(this.session.userID);
    if (existing) return existing;
    const rows = await this.request('/rest/v1/kksu_members', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      json: { user_id: this.session.userID.toLowerCase(), school_id: CLOUD.schoolID, role, full_name: fullName },
    });
    if (!rows?.[0]) throw new CloudError('Не удалось создать участника школы.');
    return rows[0];
  }

  async fetchMember(id: string): Promise<CloudMember | null> {
    const rows = await this.request(`/rest/v1/kksu_members?select=*&user_id=eq.${id.toLowerCase()}`);
    return rows?.[0] ?? null;
  }

  async loadMembers(): Promise<CloudMember[]> {
    if (!this.isSignedIn) return [];
    this.members = await this.request(`/rest/v1/kksu_members?select=*&school_id=eq.${CLOUD.schoolID}&order=created_at.desc`) ?? [];
    return this.members;
  }

  async updateMember(userID: string, fields: { role?: KKSURole; approved?: boolean; blocked?: boolean }) {
    if (Object.keys(fields).length === 0) return;
    await this.request(`/rest/v1/kksu_members?user_id=eq.${userID.toLowerCase()}`, { method: 'PATCH', json: fields });
    await this.loadMembers();
  }

  async signOut() {
    if (this.session) {
      try { await this.request('/auth/v1/logout', { method: 'POST' }); } catch { /* сессия могла истечь */ }
    }
    this.session = null;
    this.saveSession();
    this.resetSyncState();
  }

  async requestPasswordReset(email: string) {
    await this.request('/auth/v1/recover', { method: 'POST', authorized: false, json: { email: email.trim().toLowerCase() } });
  }

  /** Сброс пароля по 6-значному коду из письма (в шаблоне письма Supabase должен быть {{ .Token }}). */
  async resetPassword(email: string, code: string, newPassword: string) {
    const data = await this.request('/auth/v1/verify', {
      method: 'POST', authorized: false,
      json: { type: 'recovery', email: email.trim().toLowerCase(), token: code.trim() },
    });
    const recovery = this.applyAuthResponse(data, email);
    if (!recovery) throw new CloudError('Код восстановления неверный или устарел.');
    this.session = recovery;
    await this.request('/auth/v1/user', { method: 'PUT', json: { password: newPassword } });
    await this.signOut();
  }

  async deleteAccount() {
    await this.request('/rest/v1/rpc/kksu_delete_my_account', { method: 'POST', json: {} });
    await this.signOut();
  }

  // MARK: Файлы

  async uploadFile(file: File): Promise<string> {
    if (!this.session) throw new CloudError('Войдите в аккаунт.', 0, 'noSession');
    if (file.size > CLOUD.maxUploadBytes) throw new CloudError('Файл больше 50 МБ. Для видео используйте ссылку YouTube.', 413);
    await this.refreshIfNeeded();
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const object = crypto.randomUUID().toLowerCase() + (ext && ext !== file.name.toLowerCase() ? '.' + ext : '');
    const path = `${CLOUD.schoolID}/${this.session.userID.toLowerCase()}/${object}`;
    const response = await fetch(`${CLOUD.projectURL}/storage/v1/object/${CLOUD.filesBucket}/${path}`, {
      method: 'POST',
      headers: { apikey: CLOUD.anonKey, Authorization: `Bearer ${this.session.accessToken}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new CloudError(translate(String(data.message || data.error || `Ошибка загрузки (${response.status})`)), response.status);
    }
    return CLOUD.storageScheme + path;
  }

  /** Скачивает файл из хранилища школы и возвращает ссылку blob: для открытия в браузере. */
  async downloadFile(remote: string): Promise<string> {
    if (!this.session) throw new CloudError('Войдите в аккаунт.', 0, 'noSession');
    await this.refreshIfNeeded();
    const path = remote.slice(CLOUD.storageScheme.length);
    const response = await fetch(`${CLOUD.projectURL}/storage/v1/object/authenticated/${CLOUD.filesBucket}/${path}`, {
      headers: { apikey: CLOUD.anonKey, Authorization: `Bearer ${this.session.accessToken}` },
    });
    if (!response.ok) throw new CloudError(`Не удалось скачать файл (${response.status}).`, response.status);
    return URL.createObjectURL(await response.blob());
  }

  // MARK: Синхронизация

  /** Получает с сервера записи, изменившиеся с прошлого раза. */
  async pull(state: SyncState): Promise<boolean> {
    const rows: PulledRow[] = [];
    let cursor = this.lastPull;
    for (;;) {
      let query = `/rest/v1/kksu_records?select=collection,id,data,deleted,updated_at&school_id=eq.${CLOUD.schoolID}&order=updated_at.asc&limit=1000`;
      if (cursor) query += `&updated_at=gt.${encodeURIComponent(cursor)}`;
      const list = (await this.request(query)) as { collection: string; id: string; data: unknown; deleted: boolean; updated_at: string }[];
      for (const item of list ?? []) {
        rows.push({ collection: item.collection, id: String(item.id).toUpperCase(), data: item.deleted ? null : item.data, deleted: !!item.deleted });
        cursor = item.updated_at;
      }
      if (!list || list.length < 1000) break;
    }
    if (rows.length === 0) return false;
    applyAll(rows, state);
    // Запоминаем версии полученных записей, чтобы не отправлять их обратно.
    const byKey = new Map(encodeAll(state).map((r) => [`${r.collection}/${r.id.toUpperCase()}`, r.data]));
    for (const row of rows) {
      const key = `${row.collection}/${row.id}`;
      if (row.deleted) this.knownHashes.delete(key);
      else if (byKey.has(key)) this.knownHashes.set(key, hashString(stableStringify(byKey.get(key))));
    }
    this.lastPull = cursor;
    return true;
  }

  /** Отправляет на сервер изменённые и удалённые записи. */
  async push(state: SyncState, role: KKSURole) {
    const me = this.session?.userID;
    if (!me) return;
    const isStaff = ['teacher', 'psychologist', 'expert', 'mentor', 'admin'].includes(role);
    const current = new Map<string, string>();
    const changed: { key: string; hash: string; row: Record<string, unknown> }[] = [];
    for (const record of encodeAll(state)) {
      const key = `${record.collection}/${record.id.toUpperCase()}`;
      const hash = hashString(stableStringify(record.data));
      current.set(key, hash);
      if (this.knownHashes.get(key) === hash || this.rejectedHashes.get(key) === hash) continue;
      if (STAFF_ONLY_COLLECTIONS.has(record.collection) && !isStaff) continue;
      changed.push({ key, hash, row: {
        collection: record.collection, id: record.id, school_id: CLOUD.schoolID, owner_id: me,
        visible_to: record.visibleTo, data: record.data, deleted: false,
      } });
    }
    for (const key of Array.from(this.knownHashes.keys())) {
      if (current.has(key)) continue;
      const [collection, id] = key.split('/');
      if (!SYNCED_NAMES.has(collection) || (STAFF_ONLY_COLLECTIONS.has(collection) && !isStaff)) continue;
      changed.push({ key, hash: 'deleted', row: { collection, id, school_id: CLOUD.schoolID, owner_id: me, data: {}, deleted: true } });
    }
    for (let i = 0; i < changed.length; i += 200) {
      const chunk = changed.slice(i, i + 200);
      try {
        await this.upsert(chunk.map((c) => c.row));
        for (const c of chunk) this.remember(c.key, c.hash);
      } catch (e) {
        const code = (e as CloudError).code;
        if (code !== 401 && code !== 403) throw e;
        // Часть записей запрещена правилами доступа — отправляем по одной и пропускаем запрещённые.
        for (const c of chunk) {
          try { await this.upsert([c.row]); this.remember(c.key, c.hash); }
          catch { this.rejectedHashes.set(c.key, c.hash); }
        }
      }
    }
  }

  private remember(key: string, hash: string) {
    if (hash === 'deleted') this.knownHashes.delete(key); else this.knownHashes.set(key, hash);
  }

  private async upsert(rows: Record<string, unknown>[]) {
    // Записи с одинаковым набором полей отправляются одним запросом (PostgREST требует одинаковых ключей).
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const shape = Object.keys(row).sort().join(',');
      groups.set(shape, [...(groups.get(shape) ?? []), row]);
    }
    for (const group of groups.values()) {
      await this.request('/rest/v1/kksu_records?on_conflict=collection,id', {
        method: 'POST', json: group, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    }
  }
}

export const cloud = new KKSUCloud();
