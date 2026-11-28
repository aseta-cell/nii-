// Компоненты, которые используют несколько модулей (как общие View в iOS-приложении).
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as M from '../core/models.gen';
import { analyze, RISK_COLOR, RISK_TITLE, type ContentRecommendation } from '../core/analytics';
import { certificateCode, isDigital, paymentRegion, preferredCurrency, sessionEnd, sessionJoinURL, stageIndex } from '../core/helpers';
import { sameId, time } from '../core/ids';
import { Avatar, Badge, Card, EmptyState, fmt, InfoRow, Modal, ProgressBar, routePath, Segmented, Select, TextInput, useStore } from '../ui/kit';
import { Icon } from '../ui/icon';
import { LibraryKind } from '../core/models.gen';

export function CabinetHeader({ subtitle }: { subtitle: string }) {
  const s = useStore();
  const user = s.currentUser;
  return (
    <div className="row">
      <Avatar name={user?.fullName ?? ''} size={52} />
      <div className="stack tight" style={{ flex: 1 }}>
        <h1 style={{ fontSize: '1.5rem' }}>Здравствуйте, {user?.fullName.split(' ')[0]}!</h1>
        <span className="muted">{subtitle}</span>
      </div>
      <Link to="/notifications" className="btn" aria-label={`Уведомления: ${s.unreadCount} непрочитанных`}>🔔{s.unreadCount > 0 && <b> {s.unreadCount}</b>}</Link>
    </div>
  );
}

export function DeadlineRow({ assignment, to }: { assignment: M.Assignment; to?: string }) {
  const hours = (time(assignment.dueDate) - Date.now()) / 3600000;
  const color = hours < 0 ? 'var(--danger)' : hours < 48 ? 'var(--warning)' : 'var(--success)';
  return (
    <Card to={to}>
      <div className="row">
        <div className="stack tight" style={{ flex: 1 }}><b>{assignment.title}</b><span className="muted small">{assignment.subject}</span></div>
        <div className="stack tight" style={{ alignItems: 'flex-end' }}>
          <Badge text={hours < 0 ? 'Просрочено' : fmt.relative(assignment.dueDate)} color={color} />
          <span className="muted tiny">{fmt.dateTime(assignment.dueDate)}</span>
        </div>
      </div>
    </Card>
  );
}

export function SubmissionSummaryRow({ submission, to, showStudent }: { submission: M.Submission; to?: string; showStudent?: boolean }) {
  const s = useStore();
  const a = s.db.assignments.find((x) => sameId(x.id, submission.assignmentID));
  const color = submission.status === 'graded' ? 'var(--success)' : submission.status === 'returned' ? 'var(--warning)' : 'var(--primary)';
  return (
    <Card to={to}>
      {showStudent && <span className="small bold">{s.userName(submission.studentID)}</span>}
      <div className="row">
        <b style={{ flex: 1 }}>{a?.title ?? 'Работа'}</b>
        {submission.score !== undefined && <b style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>{submission.score}/{a?.maxScore ?? 10}</b>}
      </div>
      <div className="row wrap"><Badge text={M.SubmissionStatus.title[submission.status]} color={color} /><span className="muted tiny">Сдано {fmt.dateTime(submission.submittedAt)}</span></div>
      {submission.feedback && <div className="card soft" style={{ padding: 10 }}>💬 {submission.feedback}</div>}
    </Card>
  );
}

/** Печатная версия документа (сертификат, счёт, отчёт) — браузер сохраняет её в PDF. */
export function printDocument(title: string, bodyHTML: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { alert('Разрешите всплывающие окна, чтобы распечатать документ.'); return; }
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHTML(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:40px;line-height:1.5}
h1{color:#00337d;margin:0 0 8px} .muted{color:#555} table{border-collapse:collapse;width:100%;margin:16px 0}
td,th{border:1px solid #ccc;padding:8px;text-align:left} .frame{border:6px double #00337d;padding:48px;text-align:center}
.big{font-size:28px;font-weight:700;margin:16px 0} @media print{button{display:none}}</style></head>
<body>${bodyHTML}<p style="margin-top:32px"><button onclick="print()">Печать / сохранить в PDF</button></p></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function printCertificate(c: M.Certificate) {
  printDocument(`Сертификат ${certificateCode(c)}`, `<div class="frame">
<div class="muted">KKSU Online · Comfort School-University</div>
<h1 style="font-size:40px;margin-top:24px">СЕРТИФИКАТ</h1>
<div class="muted">настоящим подтверждается, что</div>
<div class="big">${escapeHTML(c.recipientName)}</div>
<div>${escapeHTML(c.title)}</div>
<div class="muted" style="margin-top:12px">${escapeHTML(M.CertificateIssuer.title[c.issuer])}${c.hours ? ` · ${c.hours} ч` : ''} · ${fmt.short(c.date)}</div>
<div style="margin-top:32px;font-family:monospace">Код проверки: ${escapeHTML(certificateCode(c))}</div></div>`);
}

export function CertificateCard({ certificate }: { certificate: M.Certificate }) {
  return (
    <Card>
      <div className="row top">
        <span style={{ fontSize: '2rem' }}>🏅</span>
        <div className="stack tight" style={{ flex: 1 }}>
          <b>{certificate.title}</b>
          <span className="muted small">{M.CertificateIssuer.title[certificate.issuer]}</span>
          <span className="small">{certificate.recipientName} · {fmt.short(certificate.date)}{certificate.hours ? ` · ${certificate.hours} ч` : ''}</span>
          <span className="muted tiny" style={{ fontFamily: 'monospace' }}>{certificateCode(certificate)}</span>
        </div>
      </div>
      <button className="btn small" onClick={() => printCertificate(certificate)}>📄 Сертификат (печать / PDF)</button>
    </Card>
  );
}

export function StageProgress({ stage }: { stage: M.ProjectStage }) {
  const idx = stageIndex(stage);
  return (
    <div className="row" style={{ gap: 4 }}>
      {M.ProjectStage.values.map((st, i) => (
        <div key={st} className="stack tight" style={{ flex: 1, alignItems: 'center' }}>
          <span style={{ height: 6, width: '100%', borderRadius: 3, background: i <= idx ? 'var(--primary)' : 'var(--surface-2)' }} />
          <span className="tiny muted">{M.ProjectStage.subtitle[st]}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectCard({ project, to }: { project: M.InventionProject; to?: string }) {
  const s = useStore();
  return (
    <Card to={to ?? routePath('inventions', 'p/' + project.id)}>
      <div className="row top">
        <span className="avatar" style={{ width: 44, height: 44, borderRadius: 10 }}><Icon name={M.ProjectTrack.icon[project.track]} /></span>
        <div className="stack tight" style={{ flex: 1 }}><b>{project.title}</b><span className="muted small">{M.ProjectTrack.title[project.track]}</span></div>
        <Badge text={M.ProjectStage.title[project.stage]} color={project.stage === 'result' ? 'var(--success)' : 'var(--primary)'} />
      </div>
      <span className="small" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{project.summary}</span>
      <StageProgress stage={project.stage} />
      <span className="muted tiny">👥 {project.authorIDs.map((a) => s.userName(a).split(' ')[0]).join(', ')}{project.mentorID ? ' · наставник' : ''}{project.media.length ? ` · 📎 ${project.media.length}` : ''}</span>
    </Card>
  );
}

export function SessionCard({ session }: { session: M.ScheduleSession }) {
  const s = useStore();
  const now = Date.now();
  const start = time(session.start), end = sessionEnd(session).getTime();
  const isLive = start <= now && end >= now;
  const soon = start > now && start - now < 15 * 60000;
  const url = sessionJoinURL(session);
  const me = s.db.currentUserID;
  const markAttendance = () => {
    if (!me || !session.participantIDs.some((p) => sameId(p, me)) || session.attendedIDs.some((p) => sameId(p, me))) return;
    s.update('sessions', session.id, { attendedIDs: [...session.attendedIDs, me] });
    s.log(me, 'Посещено онлайн-занятие', session.title, 'video.fill');
  };
  return (
    <Card>
      <div className="row top">
        <div className="stack tight" style={{ flex: 1 }}>
          <b>{session.title}</b>
          <span className="muted small">{session.subject} · {s.userName(session.teacherID)}</span>
          <span className="small">{fmt.time(session.start)}–{fmt.time(sessionEnd(session).toISOString())} · {session.isOnline ? M.ConferencePlatform.title[session.platform] : session.room || 'Очно'}</span>
        </div>
        {isLive ? <Badge text="Идёт сейчас" color="var(--danger)" /> : soon ? <Badge text="Скоро" color="var(--warning)" /> : <Icon name={session.isOnline ? 'video.fill' : 'person.3.fill'} />}
      </div>
      {session.isOnline && url && (
        <div className="row wrap">
          <a className="btn primary" href={url} target="_blank" rel="noopener noreferrer" onClick={markAttendance}>🎥 Подключиться</a>
          <button className="btn" onClick={() => navigator.clipboard?.writeText(url)}>🔗 Копировать ссылку</button>
        </div>
      )}
      {session.recordingURL && <a className="small" href={session.recordingURL} target="_blank" rel="noopener noreferrer">▶️ Запись занятия</a>}
      {s.role !== 'student' && s.role !== 'parent' && ['teacher', 'admin'].includes(s.role) && start < now && (
        <Link className="small" to={routePath('schedule', 'attendance/' + session.id)}>✅ Посещаемость: {session.attendedIDs.length}/{session.participantIDs.length}</Link>
      )}
    </Card>
  );
}

export function StudentRow({ studentID, to }: { studentID: string; to?: string }) {
  const s = useStore();
  const a = analyze(studentID, s);
  const body = (
    <div className="row">
      <Avatar name={s.userName(studentID)} size={40} />
      <div className="stack tight" style={{ flex: 1 }}>
        <b>{s.userName(studentID)}</b>
        <span className="muted small">Класс {s.profile(studentID)?.grade ?? '—'} · прогресс {fmt.pct(a.overall)}</span>
      </div>
      <Badge text={RISK_TITLE[a.risk]} color={RISK_COLOR[a.risk]} />
    </div>
  );
  return to ? <Card to={to}>{body}</Card> : body;
}

export function RecommendationRow({ rec }: { rec: ContentRecommendation }) {
  const to = rec.libraryItem ? routePath(libraryRouteFor(rec.libraryItem), 'item/' + rec.libraryItem.id) : rec.route ? routePath(rec.route) : undefined;
  return (
    <Card to={to}>
      <div className="row top">
        <Icon name={rec.icon} />
        <div className="stack tight" style={{ flex: 1 }}><b>{rec.title}</b><span className="muted small">{rec.reason}</span></div>
        <span className="muted">›</span>
      </div>
    </Card>
  );
}

export function libraryRouteFor(item: M.LibraryItem) {
  if (item.kind === 'video') return 'videoLibrary' as const;
  if (item.kind === 'methodical') return 'methodicalLibrary' as const;
  return 'documents' as const;
}

export { LibraryKind };

// MARK: - Оплата: платный контент, счёт, статус ученика

export function PriceBadge({ product }: { product?: M.Product }) {
  const s = useStore();
  if (!product) return null;
  const owned = s.hasAccess(s.db.currentUserID, product);
  const free = product.priceUSD <= 0;
  return <Badge text={owned && !free ? 'Доступ открыт' : s.priceText(product.priceUSD, false)} color={free || owned ? 'var(--success)' : 'var(--accent)'} />;
}

export function PaywallCard({ product, targetID, message }: { product: M.Product; targetID?: string; message?: string }) {
  const s = useStore();
  const [checkout, setCheckout] = useState(false);
  const open = s.openInvoice(product.id, s.db.currentUserID);
  return (
    <Card>
      <div className="row top">
        <span style={{ fontSize: '1.6rem' }}>🔒</span>
        <div className="stack tight" style={{ flex: 1 }}>
          <b>{product.title}</b>
          <span className="muted small">{message ?? 'Платный контент. Доступ откроется автоматически после подтверждения оплаты.'}</span>
          <b style={{ color: 'var(--primary)', fontSize: '1.15rem' }}>{s.priceText(product.priceUSD)}</b>
        </div>
      </div>
      {open
        ? <Link to={routePath('paymentHistory', 'i/' + open.id)}>{M.PaymentStatus.title[open.status]}: счёт {open.number}</Link>
        : <button className="btn primary block" onClick={() => setCheckout(true)}>💳 Оплатить</button>}
      {checkout && <CheckoutDialog product={product} targetID={targetID} onClose={() => setCheckout(false)} />}
    </Card>
  );
}

export function PaywallGate({ product, userID, message, children }: { product?: M.Product; userID?: string; message?: string; children: ReactNode }) {
  const s = useStore();
  if (product && !s.hasAccess(userID ?? s.db.currentUserID, product)) return <PaywallCard product={product} message={message} />;
  return <>{children}</>;
}

/** Школьные модули ученика открываются после оплаты статуса ученика KKSU (или стипендии). */
export function EnrollmentGate({ children }: { children: ReactNode }) {
  const s = useStore();
  if (s.role !== 'student') return <>{children}</>;
  return (
    <PaywallGate product={s.enrollmentProduct}
      message="Домашние задания, тесты и школьная программа доступны ученикам KKSU. Оформите статус ученика — или попросите администратора о стипендии.">
      {children}
    </PaywallGate>
  );
}

export function EnrollmentStatusCard({ studentID }: { studentID: string }) {
  const s = useStore();
  const product = s.enrollmentProduct;
  if (!product) return null;
  if (s.isEnrolled(studentID)) {
    const e = s.activeEntitlements(studentID).find((x) => sameId(x.productID, product.id));
    return (
      <Card>
        <b className="ok">✅ Статус ученика KKSU активен</b>
        {e && <span className="muted small">{M.AccessSource.title[e.source]}{e.expiresAt ? ` · до ${fmt.short(e.expiresAt)}` : ''}</span>}
      </Card>
    );
  }
  return <PaywallCard product={product} message="Регистрация и заявка — бесплатно. Чтобы стать учеником KKSU и открыть школьную программу, оплатите статус ученика или получите стипендию." />;
}

/** Оформление счёта и оплата переводом (Kaspi, банки Казахстана, международные переводы). */
export function CheckoutDialog({ product, targetID, onClose }: { product: M.Product; targetID?: string; onClose: () => void }) {
  const s = useStore();
  const me = s.currentUser;
  const children = s.db.users.filter((u) => me?.linkedStudentIDs.some((id) => sameId(id, u.id)));
  const candidates = !me ? [] : me.role === 'parent' ? (product.familySeats > 0 ? [me, ...children] : children) : me.role === 'admin' ? s.students : [me];
  const [beneficiaries, setBeneficiaries] = useState<string[]>(() => {
    const init: string[] = [];
    if (me && (me.role !== 'parent' || product.familySeats > 0)) init.push(me.id);
    const child = candidates.find((c) => c.role === 'student' && !sameId(c.id, me?.id));
    if (child) init.push(child.id);
    return init;
  });
  const methods = s.billing.settings.enabledMethods.filter((m) => m !== 'appStore');
  const [region, setRegion] = useState<M.PaymentRegion>('kazakhstan');
  const [method, setMethod] = useState<M.PaymentMethod>(methods.find((m) => paymentRegion(m) === 'kazakhstan') ?? 'kaspi');
  const [currency, setCurrency] = useState<M.PayCurrency>(preferredCurrency(method));
  const [promo, setPromo] = useState('');
  const [applied, setApplied] = useState<M.PromoCode | undefined>();
  const [error, setError] = useState('');
  const [created, setCreated] = useState<M.Invoice | null>(null);

  const discount = applied ? Math.min(product.priceUSD, (product.priceUSD * applied.percentOff) / 100 + applied.amountOffUSD) : 0;
  const total = Math.max(product.priceUSD - discount, 0);
  const st = s.billing.settings;
  const conv = (usd: number, c: M.PayCurrency) => (c === 'USD' ? `$${usd.toFixed(2)}` : c === 'KZT' ? `${Math.round(usd * st.usdToKzt).toLocaleString('ru-RU')} ₸` : `${((usd * st.usdToKzt) / st.eurToKzt).toFixed(2)} €`);

  if (created) {
    return (
      <Modal title="Счёт выставлен" onClose={onClose}>
        <span>Счёт <b>{created.number}</b> на {s.amountText(created)}.</span>
        <span className="muted">{created.status === 'paid' ? 'Доступ уже открыт.' : 'Откройте счёт, чтобы увидеть реквизиты и отправить чек после оплаты.'}</span>
        <Link className="btn primary" to={routePath('paymentHistory', 'i/' + created.id)} onClick={onClose}>Открыть счёт</Link>
      </Modal>
    );
  }
  return (
    <Modal title="Оплата" onClose={onClose}>
      <Card className="soft">
        <b><Icon name={M.ProductKind.icon[product.kind]} /> {product.title}</b>
        <span className="muted small">{M.ProductKind.title[product.kind]}</span>
        {product.summary && <span className="small">{product.summary}</span>}
        {product.durationDays !== undefined && <InfoRow label="Срок доступа" value={`${product.durationDays} дн.`} />}
      </Card>
      {(candidates.length > 1 || me?.role === 'parent') && (
        <div className="stack">
          <b>{product.familySeats > 0 ? `Кто получает доступ (до ${product.familySeats} детей)` : 'Для кого'}</b>
          {candidates.length === 0 && <span className="muted">К аккаунту не привязаны дети. Обратитесь к администратору.</span>}
          {candidates.map((u) => (
            <label key={u.id} className="check"><input type="checkbox" checked={beneficiaries.includes(u.id)}
              onChange={(e) => setBeneficiaries(e.target.checked ? [...beneficiaries, u.id] : beneficiaries.filter((b) => b !== u.id))} /><span>{u.fullName}</span></label>
          ))}
        </div>
      )}
      <div className="row">
        <TextInput label="Промокод" value={promo} onChange={setPromo} placeholder="Например, KKSU10" />
        <button className="btn" style={{ alignSelf: 'flex-end' }} disabled={!promo} onClick={() => { const p = s.validatePromo(promo, product); setApplied(p); setError(p ? '' : 'Промокод недействителен или не подходит для этого продукта.'); }}>Применить</button>
      </div>
      {applied && <span className="ok">🏷️ Скидка {conv(discount, 'USD')} по коду {applied.code}</span>}
      <b>Откуда вы платите</b>
      <Segmented value={region} onChange={(r) => { setRegion(r); const m = methods.find((x) => paymentRegion(x) === r); if (m) { setMethod(m); setCurrency(preferredCurrency(m)); } }}
        options={M.PaymentRegion.values.map((r) => ({ value: r, label: r === 'kazakhstan' ? 'Из Казахстана' : 'Из-за рубежа (США, Европа и др.)' }))} />
      <Select label="Способ оплаты" value={method} onChange={(m) => { setMethod(m); setCurrency(preferredCurrency(m)); }}
        options={methods.filter((m) => paymentRegion(m) === region).map((m) => ({ value: m, label: M.PaymentMethod.title[m] }))} />
      <Segmented value={currency} onChange={setCurrency} options={M.PayCurrency.values.map((c) => ({ value: c, label: c }))} />
      <Card>
        <InfoRow label="Цена" value={conv(product.priceUSD, 'USD')} />
        {discount > 0 && <InfoRow label="Скидка" value={'−' + conv(discount, 'USD')} />}
        <div className="row"><b>Итого</b><span className="spacer" /><b style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>{conv(total, currency)}</b></div>
        <span className="muted tiny">≈ {conv(total, 'USD')} · {conv(total, 'EUR')} · {conv(total, 'KZT')}</span>
        <span className="muted tiny">Деньги зачисляются на счёт получателя KKSU в тенге. Если вы платите в долларах или евро, ваш банк или сервис перевода сконвертирует сумму автоматически.</span>
      </Card>
      {!isDigital(product.kind) ? null : <span className="muted tiny">Доступ, оплаченный на сайте, действует и в iPhone-приложении KKSU Online.</span>}
      {error && <span className="error">{error}</span>}
      <button className="btn primary" onClick={() => {
        try {
          const list = candidates.length > 1 || me?.role === 'parent' ? beneficiaries : me ? [me.id] : [];
          setCreated(s.createInvoice(product, list, applied?.code ?? '', method, currency, targetID));
        } catch (e) { setError((e as Error).message); }
      }}>{total > 0 ? '📄 Выставить счёт и перейти к оплате' : '🎁 Получить доступ бесплатно'}</button>
    </Modal>
  );
}

/** Простой столбчатый график. */
export function BarChart({ data, max, color, format }: { data: { label: string; value: number; color?: string }[]; max?: number; color?: string; format?: (v: number) => string }) {
  if (!data.length) return <EmptyState text="Пока нет данных" icon="chart.bar" />;
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bar-chart" role="img" aria-label={data.map((d) => `${d.label}: ${format ? format(d.value) : d.value}`).join(', ')}>
      {data.map((d, i) => (
        <div key={i} className="bar">
          <span>{format ? format(d.value) : d.value}</span>
          <span className="fill" style={{ height: `${(d.value / top) * 100}%`, background: d.color ?? color ?? 'var(--primary)' }} />
          <span style={{ textAlign: 'center', lineHeight: 1.1 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBarChart({ data, format, max }: { data: { label: string; value: number; color?: string }[]; format?: (v: number) => string; max?: number }) {
  if (!data.length) return <EmptyState text="Пока нет данных" icon="chart.bar" />;
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="stack">
      {data.map((d, i) => (
        <div key={i} className="hbar">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
          <ProgressBar value={d.value / top} color={d.color} />
          <b className="small">{format ? format(d.value) : d.value}</b>
        </div>
      ))}
    </div>
  );
}
