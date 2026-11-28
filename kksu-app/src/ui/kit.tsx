// Общие компоненты интерфейса — аналоги KCard, KBadge, KStatTile, KProgressBar, KEmptyState, KInfoRow,
// RouteRow, RouteTile, StudentScoped, AttachmentPicker/Row из iOS-приложения.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { store } from '../core/store';
import { cloud, CLOUD } from '../core/cloud';
import { ROUTES, isAvailable, type RouteId } from '../core/routes.gen';
import { AttachmentKind, makeAttachment, type Attachment } from '../core/models.gen';
import { detectAttachmentKind, youTubeID } from '../core/helpers';
import { Icon } from './icon';

/** Подписка компонента на изменения данных школы. */
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

/** Путь внутри модуля: /m/:route/* → ['a', 'id'] */
export function useSub(): string[] {
  const params = useParams();
  return (params['*'] ?? '').split('/').filter(Boolean);
}

export const routePath = (route: RouteId, sub = '') => `/m/${route}${sub ? '/' + sub.replace(/^\//, '') : ''}`;

/** Ссылка на вложенный экран текущего модуля. */
export function useModuleLink() {
  const { route } = useParams();
  return (sub: string) => `/m/${route}/${sub.replace(/^\//, '')}`;
}

export function Page({ title, children, actions, back, wide, subtitle }: {
  title: string; children?: ReactNode; actions?: ReactNode; back?: boolean | string; wide?: boolean; subtitle?: ReactNode;
}) {
  const navigate = useNavigate();
  useEffect(() => { document.title = `${title} · KKSU Online`; }, [title]);
  return (
    <div className={'page' + (wide ? ' wide' : '')}>
      {back !== false && (
        <button className="back no-print" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>← Назад</button>
      )}
      <div className="page-head">
        <h1>{title}</h1>
        {actions}
      </div>
      {subtitle && <div className="muted">{subtitle}</div>}
      {children}
    </div>
  );
}

export function Card({ children, className = '', style, onClick, to }: { children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void; to?: string }) {
  if (to) return <Link to={to} className={'card link ' + className} style={style}>{children}</Link>;
  return <div className={'card ' + (onClick ? 'link ' : '') + className} style={style} onClick={onClick}>{children}</div>;
}

export function Section({ title, icon, children, actions }: { title: string; icon?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <div className="section-head">{icon && <Icon name={icon} />}<h2>{title}</h2><div className="spacer" />{actions}</div>
      {children}
    </>
  );
}

export function Badge({ text, color = 'var(--primary)' }: { text: ReactNode; color?: string }) {
  return <span className="badge" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{text}</span>;
}

export function StatTile({ title, value, icon, color = 'var(--primary)' }: { title: string; value: ReactNode; icon: string; color?: string }) {
  return (
    <div className="stat">
      <span style={{ color, fontSize: '1.4rem' }}><Icon name={icon} /></span>
      <span className="value">{value}</span>
      <span className="muted small">{title}</span>
    </div>
  );
}

export function ProgressBar({ value, color = 'var(--primary)' }: { value: number; color?: string }) {
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function ProgressRing({ progress, size = 80 }: { progress: number; size?: number }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, v = Math.min(Math.max(progress, 0), 1);
  return (
    <div className="ring" style={{ width: size, height: size }} aria-label={`Прогресс ${Math.round(v * 100)} процентов`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={8} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--primary)" strokeWidth={8} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span style={{ color: 'var(--primary)' }}>{Math.round(v * 100)}%</span>
    </div>
  );
}

export function EmptyState({ text, icon = 'tray' }: { text: string; icon?: string }) {
  return <div className="empty"><Icon name={icon} /><span>{text}</span></div>;
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="info-row"><span className="label">{label}</span><span style={{ textAlign: 'right' }}>{value}</span></div>;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const ini = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{ini}</span>;
}

export function RouteRow({ route, subtitle }: { route: RouteId; subtitle?: string }) {
  const info = ROUTES[route];
  return (
    <Link className="list-item" to={routePath(route)}>
      <Icon name={info.icon} />
      <span className="stack tight" style={{ flex: 1 }}>
        <span>{info.title}</span>
        {subtitle && <span className="muted small">{subtitle}</span>}
      </span>
      <span className="muted">›</span>
    </Link>
  );
}

export function RouteTile({ route }: { route: RouteId }) {
  const info = ROUTES[route];
  return (
    <Link className="tile" to={routePath(route)}>
      <Icon name={info.icon} />
      <span className="title">{info.title}</span>
    </Link>
  );
}

export function Tiles({ routes, min = 150 }: { routes: RouteId[]; min?: number }) {
  const s = useStore();
  return (
    <div className="grid" style={{ ['--min' as string]: `${min}px` }}>
      {routes.filter((r) => isAvailable(r, s.role)).map((r) => <RouteTile key={r} route={r} />)}
    </div>
  );
}

// MARK: Поля ввода

export function Field({ label, children }: { label?: string; children: ReactNode }) {
  return <label className="field">{label && <span>{label}</span>}{children}</label>;
}

export function TextInput({ label, value, onChange, placeholder, type = 'text', multiline, rows, autoFocus }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; multiline?: boolean; rows?: number; autoFocus?: boolean;
}) {
  return (
    <Field label={label}>
      {multiline
        ? <textarea value={value} placeholder={placeholder} rows={rows ?? 4} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
        : <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />}
    </Field>
  );
}

export function NumberInput({ label, value, onChange, min, max, step = 1 }: { label?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <Field label={label}>
      <input className="input" type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onChange(min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : v); }} />
    </Field>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: {
  label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="stack tight"><span>{label}</span>{hint && <span className="muted small">{hint}</span>}</span>
    </label>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO-строка ↔ значение input type=datetime-local / date (в местном времени). */
export function toLocalInput(iso: string | undefined, dateOnly = false) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return dateOnly ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function DateInput({ label, value, onChange, dateOnly }: { label?: string; value?: string; onChange: (iso: string) => void; dateOnly?: boolean }) {
  return (
    <Field label={label}>
      <input className="input" type={dateOnly ? 'date' : 'datetime-local'} value={toLocalInput(value, dateOnly)}
        onChange={(e) => { const v = fromLocalInput(e.target.value); if (v) onChange(v); }} />
    </Field>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ values, selected, onToggle, label }: { values: T[]; selected: T[]; onToggle: (v: T) => void; label?: (v: T) => string }) {
  return (
    <div className="chips">
      {values.map((v) => <button key={v} type="button" className={'chip' + (selected.includes(v) ? ' on' : '')} onClick={() => onToggle(v)}>{label ? label(v) : v}</button>)}
    </div>
  );
}

/** Редактор списка строк (интересы, теги, уроки…). */
export function TagEditor({ values, onChange, placeholder = 'Добавить…' }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const add = () => { const t = text.trim(); if (t && !values.includes(t)) onChange([...values, t]); setText(''); };
  return (
    <div className="stack">
      <div className="chips">
        {values.map((v) => <span key={v} className="chip on" onClick={() => onChange(values.filter((x) => x !== v))} title="Убрать">{v} ✕</span>)}
      </div>
      <div className="row">
        <input className="input" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn" type="button" onClick={add} disabled={!text.trim()}>Добавить</button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="btn small" onClick={onClose} aria-label="Закрыть">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function confirmAction(message: string) { return window.confirm(message); }

// MARK: Ученики

export function StudentScoped({ children }: { children: (studentID: string) => ReactNode }) {
  const s = useStore();
  const options = s.visibleStudents;
  const [selected, setSelected] = useState<string | undefined>();
  const current = (selected && options.some((o) => o.id === selected) ? selected : undefined) ?? options[0]?.id;
  return (
    <div className="stack loose">
      {options.length > 1 && (
        <Select label="Ученик" value={current ?? ''} onChange={setSelected} options={options.map((o) => ({ value: o.id, label: o.fullName }))} />
      )}
      {current ? children(current) : <EmptyState text="Нет доступных учеников" icon="person.crop.circle.badge.questionmark" />}
    </div>
  );
}

// MARK: Вложения

export function AttachmentRow({ attachment, onRemove }: { attachment: Attachment; onRemove?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = async () => {
    const remote = attachment.remoteURL;
    if (!remote) { setError('Файл есть только на устройстве, где его прикрепили.'); return; }
    if (!remote.startsWith(CLOUD.storageScheme)) { window.open(remote, '_blank', 'noopener'); return; }
    setBusy(true); setError('');
    try {
      const url = await cloud.downloadFile(remote);
      const a = document.createElement('a');
      a.href = url; a.download = attachment.fileName; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const size = attachment.sizeBytes > 0 ? ` · ${(attachment.sizeBytes / 1024 / 1024).toFixed(attachment.sizeBytes > 1048576 ? 1 : 2)} МБ` : '';
  return (
    <div className="row top" style={{ padding: '6px 0' }}>
      <Icon name={AttachmentKind.icon[attachment.kind]} />
      <div className="stack tight" style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500, wordBreak: 'break-word' }}>{attachment.fileName}</span>
        <span className="muted tiny">{AttachmentKind.title[attachment.kind]}{size}</span>
        {attachment.altText && <span className="muted small">🖼️ {attachment.altText}</span>}
        {error && <span className="error small">{error}</span>}
      </div>
      <button className="btn small" onClick={open} disabled={busy}>{busy ? '…' : 'Открыть'}</button>
      {onRemove && <button className="btn small danger-text" onClick={onRemove} aria-label="Удалить вложение">🗑️</button>}
    </div>
  );
}

/** Загрузка файлов в хранилище школы (Supabase Storage) — файлы открываются на всех устройствах. */
export function AttachmentPicker({ attachments, onChange }: { attachments: Attachment[]; onChange: (list: Attachment[]) => void }) {
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(0);
  const [warning, setWarning] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(attachments);
  latest.current = attachments;
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setWarning('');
    const alt = altText;
    setAltText('');
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      const item = makeAttachment({ fileName: file.name, kind: detectAttachmentKind(file.name), sizeBytes: file.size, altText: alt });
      try {
        item.remoteURL = await cloud.uploadFile(file);
        latest.current = [...latest.current, item];
        onChange(latest.current);
      } catch (e) {
        setWarning(`«${file.name}» не загружен: ${(e as Error).message}`);
      }
      setUploading((n) => n - 1);
    }
    if (input.current) input.current.value = '';
  };
  return (
    <div className="stack">
      {attachments.map((a) => <AttachmentRow key={a.id} attachment={a} onRemove={() => onChange(attachments.filter((x) => x.id !== a.id))} />)}
      <TextInput value={altText} onChange={setAltText} placeholder="Описание для незрячих (текстовая альтернатива)" />
      <div className="row wrap">
        <button type="button" className="btn" onClick={() => input.current?.click()} disabled={uploading > 0}>📎 Прикрепить файл</button>
        {uploading > 0 && <span className="muted small">Загрузка на сервер…</span>}
      </div>
      <input ref={input} type="file" multiple hidden accept="image/*,video/*,.pdf,.ppt,.pptx,.key,.doc,.docx,.txt,.rtf,.md,.dwg,.dxf,.svg,.step,.stl"
        onChange={(e) => pick(e.target.files)} />
      {warning && <span className="error small">{warning}</span>}
    </div>
  );
}

// MARK: Видео и конспекты

export function YouTubePlayer({ url }: { url: string }) {
  const id = youTubeID(url);
  if (!id) return url ? <a href={url} target="_blank" rel="noopener noreferrer">▶️ Открыть видео</a> : null;
  return (
    <div className="stack">
      <div className="video-frame">
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`} title="Видео урока"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
      <a className="small" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">Открыть в YouTube</a>
    </div>
  );
}

/** Простая разметка конспекта: **жирный**, *курсив*, [ссылка](https://…). Без HTML из текста. */
export function NotesText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) nodes.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3]) nodes.push(<em key={k++}>{m[3]}</em>);
    else nodes.push(<a key={k++} href={m[5]} target="_blank" rel="noopener noreferrer">{m[4]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <div className="pre">{nodes}</div>;
}

// MARK: Ролевой доступ

export function RouteGate({ route, children }: { route: RouteId; children: ReactNode }) {
  const s = useStore();
  if (!isAvailable(route, s.role)) {
    return (
      <Page title={ROUTES[route].title}>
        <EmptyState text={`Раздел «${ROUTES[route].title}» недоступен для вашей роли.`} icon="lock.fill" />
      </Page>
    );
  }
  return <>{children}</>;
}

export function useScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
}

export const fmt = {
  short: (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
  dateTime: (iso?: string) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
  time: (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'),
  relative: (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
    if (abs < 86400000) return rtf.format(Math.round(diff / 3600000), 'hour');
    return rtf.format(Math.round(diff / 86400000), 'day');
  },
  pct: (v: number) => `${Math.round(v * 100)}%`,
};
