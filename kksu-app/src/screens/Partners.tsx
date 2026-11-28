// Партнёры (93), стажировки (95, 96), мероприятия (97–99), аналитика (100) — как KKSUPartnersEventsAnalytics.swift.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as M from '../core/models.gen';
import { analyze, impactMetrics } from '../core/analytics';
import { isInternationalPartner } from '../core/helpers';
import { sameId, time, isoIn } from '../core/ids';
import {
  Avatar, Badge, Card, DateInput, EmptyState, fmt, InfoRow, Modal, NumberInput, Page, RouteRow, Section, Segmented, Select, StatTile,
  TextInput, Toggle, routePath, useStore, useSub,
} from '../ui/kit';
import { BarChart, CertificateCard, HBarChart, PaywallGate, PriceBadge, ProjectCard, StudentRow } from './shared';
import { ChallengeCard } from './Engineering';

// MARK: Партнёры (93)

export function PartnersScreen() {
  const s = useStore();
  const sub = useSub();
  const [kind, setKind] = useState<M.PartnerKind | ''>('');
  const [adding, setAdding] = useState(false);
  if (sub[0]) return <PartnerDetail partnerID={sub[0]} />;
  return (
    <Page title="Партнёры KKSU">
      <div className="chips">
        <button className={'chip' + (!kind ? ' on' : '')} onClick={() => setKind('')}>Все</button>
        {M.PartnerKind.values.map((k) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{M.PartnerKind.title[k]}</button>)}
      </div>
      {s.db.partners.filter((p) => !kind || p.kind === kind).map((p) => (
        <Card key={p.id} to={routePath('partners', p.id)}>
          <div className="row"><Avatar name={p.name} size={44} />
            <div className="stack tight" style={{ flex: 1 }}><b>{p.name}</b><span className="muted small">{M.PartnerKind.title[p.kind]} · {p.country} · с {new Date(p.since).getFullYear()}</span></div>
            {isInternationalPartner(p) && <span>🌍</span>}</div>
          <span className="small">{p.summary}</span>
        </Card>
      ))}
      {s.db.partners.length === 0 && <EmptyState text="Партнёры ещё не добавлены" icon="handshake" />}
      {s.role === 'admin' && <button className="btn outline" onClick={() => setAdding(true)}>➕ Добавить партнёра</button>}
      {adding && <PartnerEditor onClose={() => setAdding(false)} />}
    </Page>
  );
}

function PartnerDetail({ partnerID }: { partnerID: string }) {
  const s = useStore();
  const p = s.partner(partnerID);
  if (!p) return <Page title="Партнёр"><EmptyState text="Партнёр не найден" /></Page>;
  const internships = s.db.internships.filter((i) => sameId(i.partnerID, p.id));
  const cases = s.db.challenges.filter((c) => c.company === p.name);
  return (
    <Page title={p.name}>
      <Card>
        <Badge text={M.PartnerKind.title[p.kind]} />
        <span>{p.summary}</span>
        <InfoRow label="Страна" value={p.country} />
        <InfoRow label="Партнёр с" value={fmt.short(p.since)} />
        {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer">{p.website}</a>}
        {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
      </Card>
      {internships.length > 0 && <Section title="Стажировки" icon="briefcase.fill">{internships.map((i) => <InternshipCard key={i.id} internship={i} />)}</Section>}
      {cases.length > 0 && <Section title="Кейсы" icon="gearshape.2.fill">{cases.map((c) => <ChallengeCard key={c.id} challenge={c} />)}</Section>}
    </Page>
  );
}

function PartnerEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [p, setP] = useState(() => M.makePartner({ name: '', kind: 'company', country: 'Казахстан', summary: '', email: '', website: 'https://', since: new Date().toISOString() }));
  const set = (patch: Partial<M.Partner>) => setP({ ...p, ...patch });
  return (
    <Modal title="Новый партнёр" onClose={onClose}>
      <div className="form-grid">
        <TextInput label="Название" value={p.name} onChange={(v) => set({ name: v })} />
        <Select label="Тип" value={p.kind} onChange={(v) => set({ kind: v })} options={M.PartnerKind.values.map((k) => ({ value: k, label: M.PartnerKind.title[k] }))} />
        <TextInput label="Страна" value={p.country} onChange={(v) => set({ country: v })} />
        <TextInput label="Email" value={p.email} onChange={(v) => set({ email: v })} />
        <TextInput label="Сайт" value={p.website} onChange={(v) => set({ website: v })} />
        <DateInput label="Партнёр с" dateOnly value={p.since} onChange={(v) => set({ since: v })} />
      </div>
      <TextInput label="Описание сотрудничества" multiline value={p.summary} onChange={(v) => set({ summary: v })} />
      <button className="btn primary" disabled={!p.name} onClick={() => { s.add('partners', p); onClose(); }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Стажировки (95, 96)

export function InternshipsScreen() {
  const s = useStore();
  const mine = s.db.internshipApplications.filter((a) => sameId(a.studentID, s.db.currentUserID));
  return (
    <Page title="Стажировки">
      <span className="muted">Стажировки у партнёров KKSU: инженерия, AI, экология. Подайте заявку — партнёр рассмотрит её и пригласит на собеседование.</span>
      {mine.length > 0 && <Section title="Мои заявки" icon="tray.full.fill">{mine.map((a) => (
        <Card key={a.id}><div className="row"><b style={{ flex: 1 }}>{s.db.internships.find((i) => sameId(i.id, a.internshipID))?.title}</b>
          <Badge text={M.InternshipStatus.title[a.status]} color={a.status === 'rejected' ? 'var(--danger)' : 'var(--success)'} /></div>
          <span className="small">Подана {fmt.short(a.date)}</span></Card>
      ))}</Section>}
      <Section title="Открытые стажировки" icon="briefcase.fill" />
      {s.db.internships.filter((i) => i.isOpen).map((i) => <InternshipCard key={i.id} internship={i} />)}
      {s.db.internships.filter((i) => i.isOpen).length === 0 && <EmptyState text="Открытых стажировок пока нет" icon="briefcase" />}
      {s.role === 'admin' && <Section title="Все заявки" icon="list.bullet">{s.db.internshipApplications.map((a) => <InternshipApplicationReviewRow key={a.id} applicationID={a.id} />)}</Section>}
    </Page>
  );
}

export function InternshipCard({ internship }: { internship: M.Internship }) {
  const s = useStore();
  const [apply, setApply] = useState(false);
  const me = s.db.currentUserID;
  const applied = s.db.internshipApplications.some((a) => sameId(a.internshipID, internship.id) && sameId(a.studentID, me));
  const taken = s.db.internshipApplications.filter((a) => sameId(a.internshipID, internship.id) && (a.status === 'accepted' || a.status === 'completed')).length;
  const canManage = (s.role === 'partner' && sameId(s.currentUser?.partnerID, internship.partnerID)) || s.role === 'admin';
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>{internship.title}</b><Badge text={internship.isOpen ? 'Набор открыт' : 'Набор закрыт'} color={internship.isOpen ? 'var(--success)' : 'var(--text-2)'} /></div>
      <span className="small" style={{ color: 'var(--primary)' }}>{s.partner(internship.partnerID)?.name}</span>
      <span>{internship.summary}</span>
      <InfoRow label="Требования" value={internship.requirements} />
      <InfoRow label="Старт" value={`${fmt.short(internship.start)}, ${internship.durationWeeks} нед.`} />
      <InfoRow label="Мест" value={`${Math.max(internship.seats - taken, 0)} из ${internship.seats}`} />
      {s.role === 'student' && internship.isOpen && (applied ? <span className="ok">✅ Заявка подана</span> : <button className="btn primary" onClick={() => setApply(true)}>Подать заявку</button>)}
      {canManage && <Toggle label="Набор открыт" checked={internship.isOpen} onChange={(v) => s.update('internships', internship.id, { isOpen: v })} />}
      {apply && <InternshipApply internship={internship} onClose={() => setApply(false)} />}
    </Card>
  );
}

function InternshipApply({ internship, onClose }: { internship: M.Internship; onClose: () => void }) {
  const s = useStore();
  const [motivation, setMotivation] = useState('');
  return (
    <Modal title="Заявка на стажировку" onClose={onClose}>
      <b>{internship.title}</b><span>{internship.summary}</span><span className="small">Требования: {internship.requirements}</span>
      <TextInput label="Мотивационное письмо" multiline rows={6} value={motivation} onChange={setMotivation} placeholder="Почему вы хотите пройти эту стажировку? (от 20 символов)" />
      <span className="muted small">Партнёр увидит ваше портфолио и проекты.</span>
      <button className="btn primary" disabled={motivation.length < 20} onClick={() => {
        const me = s.db.currentUserID!;
        s.db.internshipApplications.push(M.makeInternshipApplication({ internshipID: internship.id, studentID: me, motivation }));
        for (const u of s.db.users.filter((u) => u.role === 'partner' && sameId(u.partnerID, internship.partnerID))) s.notify(u.id, 'Новая заявка на стажировку', `${s.userName(me)} — ${internship.title}`, 'info');
        s.log(me, 'Заявка на стажировку', internship.title, 'briefcase');
        s.changed(); onClose();
      }}>Отправить</button>
    </Modal>
  );
}

export function InternshipApplicationReviewRow({ applicationID }: { applicationID: string }) {
  const s = useStore();
  const [showPortfolio, setShowPortfolio] = useState(false);
  const app = s.db.internshipApplications.find((a) => sameId(a.id, applicationID));
  if (!app) return null;
  const title = s.db.internships.find((i) => sameId(i.id, app.internshipID))?.title ?? '';
  return (
    <Card>
      <div className="row"><Avatar name={s.userName(app.studentID)} size={36} /><div className="stack tight"><b>{s.userName(app.studentID)}</b><span className="muted small">{title}</span></div></div>
      <span>{app.motivation}</span>
      <button className="btn link small" onClick={() => setShowPortfolio(true)}>Портфолио ученика</button>
      <Select label="Статус" value={app.status} onChange={(status) => {
        s.update('internshipApplications', app.id, { status });
        s.notify(app.studentID, `Стажировка: ${M.InternshipStatus.title[status]}`, title, 'info');
        if (status === 'completed') s.issueCertificate(app.studentID, `Стажировка «${title}»`, 'internship');
        s.changed();
      }} options={M.InternshipStatus.values.map((x) => ({ value: x, label: M.InternshipStatus.title[x] }))} />
      {showPortfolio && (
        <Modal title="Портфолио" onClose={() => setShowPortfolio(false)}>
          {s.db.portfolio.filter((p) => sameId(p.studentID, app.studentID)).map((p) => <Card key={p.id}><b>{p.title}</b><span className="small">{p.summary}</span></Card>)}
          {s.db.projects.filter((p) => p.authorIDs.some((a) => sameId(a, app.studentID))).map((p) => <ProjectCard key={p.id} project={p} />)}
        </Modal>
      )}
    </Card>
  );
}

export function InternshipEditor({ partnerID, onClose }: { partnerID: string; onClose: () => void }) {
  const s = useStore();
  const [x, setX] = useState(() => M.makeInternship({ partnerID, title: '', summary: '', requirements: '', start: isoIn(30 * 86400), durationWeeks: 2, seats: 5 }));
  const set = (patch: Partial<M.Internship>) => setX({ ...x, ...patch });
  return (
    <Modal title="Новая стажировка" onClose={onClose}>
      <TextInput label="Название" value={x.title} onChange={(v) => set({ title: v })} />
      <TextInput label="Описание" multiline value={x.summary} onChange={(v) => set({ summary: v })} />
      <TextInput label="Требования" value={x.requirements} onChange={(v) => set({ requirements: v })} />
      <div className="form-grid"><DateInput label="Начало" dateOnly value={x.start} onChange={(v) => set({ start: v })} />
        <NumberInput label="Недель" value={x.durationWeeks} min={1} max={26} onChange={(v) => set({ durationWeeks: v })} />
        <NumberInput label="Мест" value={x.seats} min={1} max={100} onChange={(v) => set({ seats: v })} /></div>
      <button className="btn primary" disabled={!x.title} onClick={() => {
        s.db.internships.push(x);
        for (const st of s.students) s.notify(st.id, 'Новая стажировка', `${s.partner(partnerID)?.name ?? ''}: ${x.title}`, 'info');
        s.changed(); onClose();
      }}>Опубликовать</button>
    </Modal>
  );
}

// MARK: Мероприятия (97–99)

export function EventsScreen() {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const upcoming = s.db.events.filter((e) => time(e.date) >= startOfToday.getTime()).sort((a, b) => time(a.date) - time(b.date));
  const past = s.db.events.filter((e) => time(e.date) < startOfToday.getTime()).sort((a, b) => time(b.date) - time(a.date));
  return (
    <Page title="Конференции и мероприятия">
      <Section title="Предстоящие" icon="calendar.badge.plus" />
      {upcoming.length === 0 && <EmptyState text="Нет запланированных мероприятий" icon="calendar" />}
      {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
      <Section title="Прошедшие" icon="clock.arrow.circlepath" />
      {past.map((e) => <EventCard key={e.id} event={e} />)}
      {s.role === 'admin' && <button className="btn outline" onClick={() => setAdding(true)}>➕ Добавить мероприятие</button>}
      {adding && <EventEditor onClose={() => setAdding(false)} />}
    </Page>
  );
}

function EventCard({ event }: { event: M.KKSUEvent }) {
  const s = useStore();
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<M.EventRole>('listener');
  const [talk, setTalk] = useState('');
  const regs = s.db.eventRegistrations.filter((r) => sameId(r.eventID, event.id));
  const mine = regs.find((r) => sameId(r.userID, s.db.currentUserID));
  const product = s.productForRef(event.id);
  return (
    <Card>
      <div className="row wrap"><Badge text={M.EventKind.title[event.kind]} />{event.isInternational && <Badge text="Международное" color="purple" />}<span className="spacer" /><span className="muted small">{regs.length}/{event.capacity}</span></div>
      <b>{event.title}</b>
      <span className="muted small">{fmt.dateTime(event.date)} · {event.location} · {event.hours} ч</span>
      <PriceBadge product={product} />
      <span>{event.summary}</span>
      {event.isOnline && event.meetingURL && mine && <a href={event.meetingURL} target="_blank" rel="noopener noreferrer">🎥 Ссылка на трансляцию</a>}
      {mine ? (
        <>
          <span className="ok">✅ Вы зарегистрированы: {M.EventRole.title[mine.role]}</span>
          {mine.certificateID && (() => { const c = s.db.certificates.find((x) => sameId(x.id, mine.certificateID)); return c ? <CertificateCard certificate={c} /> : null; })()}
        </>
      ) : time(event.date) > Date.now() && regs.length < event.capacity && (
        registering ? (
          <div className="stack">
            <Segmented value={role} onChange={setRole} options={M.EventRole.values.map((r) => ({ value: r, label: M.EventRole.title[r] }))} />
            {role === 'speaker' && <TextInput value={talk} onChange={setTalk} placeholder="Тема доклада" />}
            <button className="btn primary" disabled={role === 'speaker' && !talk} onClick={() => { s.registerEvent(event.id, role, talk); setRegistering(false); }}>Подтвердить регистрацию</button>
          </div>
        ) : (
          <PaywallGate product={product} message="Регистрационный взнос участника. После подтверждения оплаты станет доступна регистрация.">
            <button className="btn primary" onClick={() => setRegistering(true)}>Зарегистрироваться</button>
          </PaywallGate>
        )
      )}
      {s.role === 'admin' && regs.length > 0 && (
        <details><summary>Участники ({regs.length})</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            {regs.map((r) => (
              <div key={r.id} className="row">
                <div className="stack tight" style={{ flex: 1 }}><span>{s.userName(r.userID)}</span><span className="muted small">{M.EventRole.title[r.role]}{r.talkTitle ? `: ${r.talkTitle}` : ''}</span></div>
                {r.attended ? <span className="ok small">🏅 Сертификат</span> : <button className="btn small" onClick={() => s.confirmAttendance(r.id)}>Присутствовал</button>}
              </div>
            ))}
            <button className="btn small" onClick={() => regs.filter((r) => !r.attended).forEach((r) => s.confirmAttendance(r.id))}>Выдать сертификаты всем участникам</button>
          </div>
        </details>
      )}
    </Card>
  );
}

function EventEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [e, setE] = useState(() => M.makeKKSUEvent({ title: '', kind: 'conference', date: isoIn(14 * 86400), location: 'KKSU', isOnline: false, summary: '', capacity: 100 }));
  const set = (patch: Partial<M.KKSUEvent>) => setE({ ...e, ...patch });
  return (
    <Modal title="Новое мероприятие" onClose={onClose}>
      <TextInput label="Название" value={e.title} onChange={(v) => set({ title: v })} />
      <div className="form-grid">
        <Select label="Тип" value={e.kind} onChange={(v) => set({ kind: v })} options={M.EventKind.values.map((k) => ({ value: k, label: M.EventKind.title[k] }))} />
        <DateInput label="Дата и время" value={e.date} onChange={(v) => set({ date: v })} />
        <TextInput label="Место" value={e.location} onChange={(v) => set({ location: v })} />
        <NumberInput label="Мест" value={e.capacity} min={5} max={5000} step={5} onChange={(v) => set({ capacity: v })} />
        <NumberInput label="Часов (в сертификат)" value={e.hours} min={1} max={72} onChange={(v) => set({ hours: v })} />
      </div>
      <Toggle label="Онлайн" checked={e.isOnline} onChange={(v) => set({ isOnline: v })} />
      {e.isOnline && <TextInput label="Ссылка на трансляцию" value={e.meetingURL} onChange={(v) => set({ meetingURL: v })} />}
      <Toggle label="Международное" checked={e.isInternational} onChange={(v) => set({ isInternational: v })} />
      <TextInput label="Описание" multiline value={e.summary} onChange={(v) => set({ summary: v })} />
      <button className="btn primary" disabled={!e.title} onClick={() => {
        const ev = e.isOnline && !e.meetingURL ? { ...e, meetingURL: `https://meet.jit.si/KKSU-event-${e.id.slice(0, 8)}` } : e;
        s.db.events.push(ev);
        for (const u of s.db.users) s.notify(u.id, 'Новое мероприятие', ev.title, 'event');
        s.changed(); onClose();
      }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Аналитика (100)

export function AnalyticsScreen() {
  const s = useStore();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const db = s.db;
  const m = impactMetrics(db);
  const n = Number(days);
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - n);
  const activity = Array.from({ length: Math.min(n, 30) + 1 }, (_, i) => {
    const step = n / Math.min(n, 30);
    const day = new Date(start.getTime() + Math.round(i * step) * 86400000);
    const next = day.getTime() + Math.max(1, Math.round(step)) * 86400000;
    return { label: day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }), value: db.history.filter((h) => time(h.date) >= day.getTime() && time(h.date) < next).length };
  });
  const roles = M.KKSURole.values.map((r) => ({ label: M.KKSURole.title[r], value: db.users.filter((u) => u.role === r).length })).filter((x) => x.value > 0);
  const scores = new Map<string, number[]>();
  for (const sub of db.submissions) {
    const a = db.assignments.find((x) => sameId(x.id, sub.assignmentID));
    if (sub.score === undefined || !a) continue;
    scores.set(a.subject, [...(scores.get(a.subject) ?? []), (sub.score / Math.max(a.maxScore, 1)) * 100]);
  }
  const subjects = [...scores.entries()].map(([label, v]) => ({ label, value: v.reduce((t, x) => t + x, 0) / v.length })).sort((a, b) => a.label.localeCompare(b.label));
  const funnel = M.ApplicationStatus.values.map((st) => ({ label: M.ApplicationStatus.title[st], value: db.applications.filter((a) => a.status === st).length }));
  const aiRequests = db.history.filter((h) => h.icon === 'sparkles').length;
  const active = db.users.filter((u) => time(u.lastLogin) > start.getTime()).length;
  const risky = s.students.map((x) => analyze(x.id, s)).filter((a) => a.risk !== 'low');
  const csv = () => {
    const rows: [string, string | number][] = [
      ['Учеников', m.students], ['Педагогов', m.teachers], ['Проведено занятий', m.lessonsHeld], ['Проектов', m.projects], ['Прототипов', m.prototypes],
      ['Результатов', m.results], ['Средний балл, %', Math.round(m.averageScore * 100)], ['Выполнение заданий, %', Math.round(m.completionRate * 100)],
      ['Посещаемость, %', Math.round(m.attendanceRate * 100)], ['Сертификатов', m.certificates], ['Партнёров', m.partners], ['Стажировок', m.internships],
      ['Стран', m.countries], ['Международных проектов', m.internationalProjects], ['Мероприятий', m.events],
    ];
    const blob = new Blob(['﻿Показатель;Значение\n' + rows.map((r) => r.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'KKSU-analytics.csv'; a.click();
  };
  return (
    <Page title="Аналитика KKSU" wide>
      <Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 дней' }, { value: '30', label: '30 дней' }, { value: '90', label: '90 дней' }]} />
      <div className="grid" style={{ ['--min' as string]: '160px' }}>
        <StatTile title="Всего пользователей" value={db.users.length} icon="person.3.fill" />
        <StatTile title="Активных за период" value={active} icon="person.fill.checkmark" color="var(--success)" />
        <StatTile title="Заявок на обучение" value={db.applications.length} icon="doc.text.fill" color="var(--accent)" />
        <StatTile title="Запросов к AI" value={aiRequests} icon="sparkles" color="purple" />
        <StatTile title="Работ сдано" value={db.submissions.length} icon="tray.and.arrow.up.fill" />
        <StatTile title="Попыток тестов" value={db.attempts.length} icon="checklist" color="var(--accent)" />
        <StatTile title="Материалов в библиотеке" value={db.library.length} icon="books.vertical.fill" color="var(--success)" />
        <StatTile title="Сертификатов" value={db.certificates.length} icon="rosette" color="purple" />
      </div>
      <Card><h3>Активность платформы</h3><BarChart data={activity} /></Card>
      <Card><h3>Пользователи по ролям</h3><HBarChart data={roles} /></Card>
      {subjects.length > 0 && <Card><h3>Средний балл по предметам</h3><BarChart data={subjects} max={100} color="var(--accent)" format={(v) => `${Math.round(v)}%`} /></Card>}
      <Card><h3>Воронка приёма</h3><BarChart data={funnel} color="var(--success)" /></Card>
      <Card><h3>Сводка по направлениям</h3>
        <InfoRow label="Проекты / прототипы / результаты" value={`${m.projects} / ${m.prototypes} / ${m.projectsByStage[m.projectsByStage.length - 1]?.[1] ?? 0}`} />
        <InfoRow label="Teacher Academy: слушатели / выпускники" value={`${db.academyProfiles.length} / ${m.academyGraduates}`} />
        <InfoRow label="Методики / апробации" value={`${db.methodologies.length} / ${db.pilots.length}`} />
        <InfoRow label="Young Inventors: заявки / финалисты" value={`${m.yiApplications} / ${m.yiFinalists}`} />
        <InfoRow label="Стажировки: заявки / принято" value={`${m.internshipApplications} / ${m.internshipAccepted}`} />
        <InfoRow label="Мероприятия / участники" value={`${m.events} / ${m.eventParticipants}`} />
        <InfoRow label="Страны / международные проекты" value={`${m.countries} / ${m.internationalProjects}`} />
        <InfoRow label="Посещаемость / выполнение заданий" value={`${fmt.pct(m.attendanceRate)} / ${fmt.pct(m.completionRate)}`} />
      </Card>
      <Card><h3>Ученики в зоне риска</h3>
        {risky.length === 0 && <span className="muted">Нет</span>}
        {risky.map((a) => <Link key={a.studentID} to={`/student/${a.studentID}`} style={{ color: 'inherit' }}><StudentRow studentID={a.studentID} /></Link>)}
      </Card>
      <button className="btn" onClick={csv}>📊 Экспорт сводки в CSV</button>
      <Card><div className="list"><RouteRow route="impactDashboard" /><RouteRow route="impactReport" /></div></Card>
    </Page>
  );
}
