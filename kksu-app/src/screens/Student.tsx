// Модули ученика (задачи 10–25, 36) — как KKSUStudentModules.swift.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as M from '../core/models.gen';
import { analyze, RISK_COLOR, RISK_TITLE } from '../core/analytics';
import { age, KKSURoleExtra } from '../core/helpers';
import { isValidEmail } from '../core/store';
import { sameId, time, nowISO, isoIn } from '../core/ids';
import {
  AttachmentPicker, AttachmentRow, Badge, Card, DateInput, EmptyState, fmt, InfoRow, Modal, NumberInput, Page, ProgressBar,
  RouteRow, Section, Segmented, Select, StatTile, StudentScoped, TagEditor, TextInput, Toggle, routePath, useModuleLink, useStore, useSub, Chips,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { BarChart, CertificateCard, DeadlineRow, EnrollmentGate, HBarChart, ProjectCard, SubmissionSummaryRow } from './shared';

const canTeach = (r: M.KKSURole) => KKSURoleExtra.canTeach(r);

// MARK: Профиль ученика (10)

export function StudentProfileScreen() {
  const s = useStore();
  return (
    <Page title="Профиль ученика">
      <StudentScoped>{(studentID) => {
        const p = s.profile(studentID);
        if (!p) return <EmptyState text="Профиль ученика не создан" />;
        const set = (patch: Partial<M.StudentProfile>) => s.update('studentProfiles', p.id, patch);
        return (
          <>
            <Card><div className="row"><span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{s.userName(studentID).slice(0, 1)}</span>
              <div className="stack tight"><b style={{ fontSize: '1.2rem' }}>{s.userName(studentID)}</b><span className="muted">{age(p)} лет · {p.grade} класс</span><Badge text={`${p.xp} XP`} color="var(--accent)" /></div></div></Card>
            <Card><h3>Основное</h3><div className="form-grid">
              <DateInput label="Дата рождения" dateOnly value={p.birthDate} onChange={(v) => set({ birthDate: v })} />
              <TextInput label="Класс" value={p.grade} onChange={(v) => set({ grade: v })} />
              <TextInput label="Школа" value={p.school} onChange={(v) => set({ school: v })} />
              <TextInput label="Город" value={p.city} onChange={(v) => set({ city: v })} />
            </div></Card>
            <Card><h3>Интересы</h3><TagEditor values={p.interests} onChange={(v) => set({ interests: v })} placeholder="Добавить интерес" /></Card>
            <Card><h3>Цели и поддержка</h3>
              <TextInput label="Мои цели" multiline value={p.goals} onChange={(v) => set({ goals: v })} />
              <TextInput label="Особые образовательные потребности" multiline value={p.specialNeeds} onChange={(v) => set({ specialNeeds: v })} />
              <span className="muted small">Эти данные видят только педагоги, психолог и родитель ученика.</span>
            </Card>
            <Card><div className="list"><RouteRow route="portfolio" /><RouteRow route="achievements" /></div></Card>
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Анкета поступления (11)

const ASSISTIVE = ['Субтитры', 'Озвучивание текста', 'Крупный шрифт', 'FM-система', 'Альтернативная коммуникация', 'Коляска / пандус'];

export function IntakeScreen() {
  return <Page title="Анкета поступления"><StudentScoped>{(id) => <IntakeForm studentID={id} />}</StudentScoped></Page>;
}

function IntakeForm({ studentID }: { studentID: string }) {
  const s = useStore();
  const [saved, setSaved] = useState(false);
  let q = s.db.questionnaires.find((x) => sameId(x.studentID, studentID));
  if (!q) {
    return <button className="btn primary" onClick={() => s.add('questionnaires', M.makeIntakeQuestionnaire({ studentID }))}>Заполнить анкету</button>;
  }
  const set = (patch: Partial<M.IntakeQuestionnaire>) => s.update('questionnaires', q!.id, patch);
  q = q as M.IntakeQuestionnaire;
  return (
    <div className="stack loose">
      <Card><h3>Формат обучения</h3>
        <Segmented value={q.learningFormat} onChange={(v) => set({ learningFormat: v })} options={M.LearningFormat.values.map((f) => ({ value: f, label: M.LearningFormat.title[f] }))} /></Card>
      <Card><h3>Об ученике</h3>
        <TextInput label="Сильные стороны, увлечения" multiline rows={2} value={q.strengths} onChange={(v) => set({ strengths: v })} />
        <TextInput label="Трудности в обучении" multiline rows={2} value={q.difficulties} onChange={(v) => set({ difficulties: v })} />
        <TextInput label="Особенности здоровья (по желанию)" multiline rows={2} value={q.healthNotes} onChange={(v) => set({ healthNotes: v })} />
        <TextInput label="Как удобнее общаться с ребёнком" multiline rows={2} value={q.communication} onChange={(v) => set({ communication: v })} />
      </Card>
      <Card><h3>Вспомогательные технологии</h3>
        {ASSISTIVE.map((o) => <Toggle key={o} label={o} checked={q!.assistiveTech.includes(o)} onChange={(on) => set({ assistiveTech: on ? [...q!.assistiveTech, o] : q!.assistiveTech.filter((x) => x !== o) })} />)}
      </Card>
      <Card><h3>Ожидания семьи</h3>
        <TextInput label="Чего вы ждёте от обучения в KKSU" multiline rows={2} value={q.parentExpectations} onChange={(v) => set({ parentExpectations: v })} />
        <Toggle label="Нужна консультация психолога" checked={q.needsPsychologist} onChange={(v) => set({ needsPsychologist: v })} />
      </Card>
      <button className="btn primary" onClick={() => {
        set({ date: nowISO() });
        for (const u of s.db.users.filter((u) => u.role === 'teacher' || (u.role === 'psychologist' && q!.needsPsychologist))) s.notify(u.id, 'Заполнена анкета поступления', s.userName(studentID), 'info');
        s.log(studentID, 'Заполнена анкета поступления', '', 'list.clipboard');
        s.changed();
        setSaved(true);
      }}>✈️ Отправить анкету</button>
      {saved && <span className="ok">✅ Анкета сохранена и передана педагогам</span>}
    </div>
  );
}

// MARK: Заявка на обучение (12)

export function ApplicationScreen() {
  const s = useStore();
  const user = s.currentUser;
  const blank = () => M.makeEnrollmentApplication({ childName: '', childAge: 10, parentName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' });
  const [app, setApp] = useState(blank);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<M.EnrollmentApplication>) => setApp({ ...app, ...patch });
  const mine = s.db.applications.filter((a) => sameId(a.applicantUserID, user?.id));
  return (
    <Page title="Заявка на обучение">
      {sent ? (
        <Card><span className="ok bold">✅ Заявка отправлена! Мы свяжемся с вами в течение 3 рабочих дней.</span>
          <button className="btn" onClick={() => { setApp(blank()); setSent(false); }}>Подать ещё одну заявку</button></Card>
      ) : (
        <Card>
          <span className="ok">🎁 Подача заявки — бесплатно. Оплата статуса ученика KKSU — только после одобрения заявки.</span>
          <h3>Ребёнок</h3>
          <div className="form-grid"><TextInput label="ФИО ребёнка" value={app.childName} onChange={(v) => set({ childName: v })} />
            <NumberInput label="Возраст" value={app.childAge} min={5} max={18} onChange={(v) => set({ childAge: v })} /></div>
          <h3>Родитель / законный представитель</h3>
          <div className="form-grid"><TextInput label="ФИО" value={app.parentName} onChange={(v) => set({ parentName: v })} />
            <TextInput label="Email" type="email" value={app.email} onChange={(v) => set({ email: v })} />
            <TextInput label="Телефон" type="tel" value={app.phone} onChange={(v) => set({ phone: v })} /></div>
          <h3>Обучение</h3>
          <div className="form-grid">
            <Select label="Программа" value={app.programID ?? ''} onChange={(v) => set({ programID: v || undefined })}
              options={[{ value: '', label: 'Выберите программу' }, ...s.db.programs.map((p) => ({ value: p.id, label: p.title }))]} />
            <Select label="Формат" value={app.format} onChange={(v) => set({ format: v })} options={M.LearningFormat.values.map((f) => ({ value: f, label: M.LearningFormat.title[f] }))} />
          </div>
          <TextInput label="Комментарий (особые потребности, пожелания)" multiline value={app.comment} onChange={(v) => set({ comment: v })} />
          {error && <span className="error">{error}</span>}
          <button className="btn primary" onClick={() => {
            if (!app.childName || !app.parentName || !isValidEmail(app.email) || !app.phone) { setError('Заполните ФИО, телефон и корректный email.'); return; }
            s.add('applications', { ...app, applicantUserID: user?.id, date: nowISO() });
            for (const admin of s.users('admin')) s.notify(admin.id, 'Новая заявка на обучение', `${app.childName}, ${app.childAge} лет`, 'system');
            s.changed();
            setError(''); setSent(true);
          }}>Отправить заявку</button>
        </Card>
      )}
      {mine.length > 0 && <Card><h3>Мои заявки</h3>{mine.map((a) => <InfoRow key={a.id} label={a.childName} value={M.ApplicationStatus.title[a.status]} />)}</Card>}
    </Page>
  );
}

// MARK: Согласия (13)

export function ConsentsScreen() {
  const s = useStore();
  return (
    <Page title="Согласия родителей">
      <span className="muted">Согласия подписываются электронно и могут быть отозваны в любой момент. Без согласия на обработку персональных данных обучение невозможно.</span>
      <StudentScoped>{(studentID) => (
        <>{M.ConsentType.values.map((type) => {
          const consent = [...s.db.consents].reverse().find((c) => sameId(c.studentID, studentID) && c.type === type);
          const granted = consent?.granted ?? false;
          const toggle = () => {
            const u = s.currentUser!;
            s.add('consents', M.makeParentConsent({ studentID, parentID: u.id, type, granted: !granted, signatureName: u.fullName }));
            s.log(studentID, !granted ? 'Подписано согласие' : 'Отозвано согласие', M.ConsentType.title[type], 'signature');
            s.changed();
          };
          return (
            <Card key={type}>
              <div className="row">
                <div className="stack tight" style={{ flex: 1 }}>
                  <b>{M.ConsentType.title[type]}</b>
                  {type === 'personalData' && <Badge text="Обязательное" color="var(--danger)" />}
                  {consent && <span className="muted small">{consent.granted ? 'Подписано' : 'Отозвано'}: {consent.signatureName}, {fmt.dateTime(consent.date)}</span>}
                </div>
                {s.role === 'parent' || s.role === 'admin'
                  ? <button className={'btn ' + (granted ? 'danger' : 'success')} onClick={toggle}>{granted ? 'Отозвать' : 'Подписать'}</button>
                  : <span>{granted ? '✅' : '—'}</span>}
              </div>
            </Card>
          );
        })}</>
      )}</StudentScoped>
    </Page>
  );
}

// MARK: Каталог программ (14)

export function ProgramsScreen() {
  const s = useStore();
  const [direction, setDirection] = useState<M.ProgramDirection | ''>('');
  const [editing, setEditing] = useState<M.EducationProgram | null>(null);
  return (
    <Page title="Каталог программ">
      <div className="chips">
        <button className={'chip' + (!direction ? ' on' : '')} onClick={() => setDirection('')}>Все</button>
        {M.ProgramDirection.values.map((d) => <button key={d} className={'chip' + (direction === d ? ' on' : '')} onClick={() => setDirection(d)}>{M.ProgramDirection.title[d]}</button>)}
      </div>
      {s.db.programs.filter((p) => !direction || p.direction === direction).map((p) => (
        <Card key={p.id}>
          <div className="row"><b style={{ flex: 1 }}><Icon name={M.ProgramDirection.icon[p.direction]} /> {p.title}</b><Badge text={M.ProgramDirection.title[p.direction]} /></div>
          <span>{p.summary}</span>
          <span className="muted small">Возраст: {p.ageRange} · {p.durationWeeks} недель · {M.LearningFormat.title[p.format]} · мест: {p.seats}</span>
          <div className="chips">{p.subjects.map((x) => <span key={x} className="chip">{x}</span>)}</div>
          <div className="row"><Link to={routePath('application')}>Подать заявку</Link><span className="spacer" />
            {s.role === 'admin' && <button className="btn small" onClick={() => setEditing(p)}>Изменить</button>}</div>
        </Card>
      ))}
      {s.db.programs.length === 0 && <EmptyState text="Программы ещё не добавлены" icon="books.vertical" />}
      {s.role === 'admin' && <button className="btn outline" onClick={() => setEditing(M.makeEducationProgram({ title: '', direction: 'school', ageRange: '7–18', durationWeeks: 12, format: 'mixed', summary: '', subjects: [] }))}>➕ Добавить программу</button>}
      {editing && <ProgramEditor program={editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function ProgramEditor({ program, onClose }: { program: M.EducationProgram; onClose: () => void }) {
  const s = useStore();
  const [p, setP] = useState(program);
  const set = (patch: Partial<M.EducationProgram>) => setP({ ...p, ...patch });
  return (
    <Modal title={p.title || 'Новая программа'} onClose={onClose}>
      <TextInput label="Название" value={p.title} onChange={(v) => set({ title: v })} />
      <div className="form-grid">
        <Select label="Направление" value={p.direction} onChange={(v) => set({ direction: v })} options={M.ProgramDirection.values.map((d) => ({ value: d, label: M.ProgramDirection.title[d] }))} />
        <TextInput label="Возраст" value={p.ageRange} onChange={(v) => set({ ageRange: v })} />
        <NumberInput label="Недель" value={p.durationWeeks} min={1} max={104} onChange={(v) => set({ durationWeeks: v })} />
        <NumberInput label="Мест" value={p.seats} min={1} max={500} onChange={(v) => set({ seats: v })} />
        <Select label="Формат" value={p.format} onChange={(v) => set({ format: v })} options={M.LearningFormat.values.map((f) => ({ value: f, label: M.LearningFormat.title[f] }))} />
      </div>
      <TextInput label="Описание" multiline value={p.summary} onChange={(v) => set({ summary: v })} />
      <span className="small muted">Предметы</span>
      <TagEditor values={p.subjects} onChange={(v) => set({ subjects: v })} placeholder="Добавить предмет" />
      <div className="row"><span className="spacer" /><button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn primary" disabled={!p.title} onClick={() => {
          if (s.db.programs.some((x) => x.id === p.id)) s.update('programs', p.id, p); else s.add('programs', p);
          onClose();
        }}>Сохранить</button></div>
    </Modal>
  );
}

// MARK: Траектория (15)

export function TrajectoryScreen() {
  const s = useStore();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(isoIn(30 * 86400));
  const [program, setProgram] = useState('');
  return (
    <Page title="Образовательная траектория">
      <StudentScoped>{(studentID) => {
        const steps = s.db.trajectory.filter((t) => sameId(t.studentID, studentID)).sort((a, b) => time(a.targetDate) - time(b.targetDate));
        const done = steps.filter((t) => t.status === 'done').length;
        return (
          <>
            <Card><b>Пройдено шагов: {done} из {steps.length}</b><ProgressBar value={steps.length ? done / steps.length : 0} /></Card>
            {steps.map((step) => (
              <div key={step.id} className="row top">
                <span style={{ fontSize: '1.4rem', color: step.status === 'done' ? 'var(--success)' : 'var(--primary)' }}><Icon name={M.StepStatus.icon[step.status]} /></span>
                <Card style={{ flex: 1 }}>
                  <b>{step.title}</b>
                  {s.program(step.programID) && <span className="muted small">{s.program(step.programID)!.title}</span>}
                  <span className="small">Цель к {fmt.short(step.targetDate)}</span>
                  {step.note && <span>{step.note}</span>}
                  {s.role === 'parent' ? <Badge text={M.StepStatus.title[step.status]} /> :
                    <Segmented value={step.status} onChange={(v) => s.update('trajectory', step.id, { status: v })} options={M.StepStatus.values.map((x) => ({ value: x, label: M.StepStatus.title[x] }))} />}
                </Card>
              </div>
            ))}
            {s.role !== 'parent' && (
              <Card><h3>Новый шаг траектории</h3>
                <div className="form-grid"><TextInput label="Цель" value={title} onChange={setTitle} />
                  <DateInput label="Срок" dateOnly value={date} onChange={setDate} />
                  <Select label="Программа" value={program} onChange={setProgram} options={[{ value: '', label: 'Без программы' }, ...s.db.programs.map((p) => ({ value: p.id, label: p.title }))]} /></div>
                <button className="btn primary" disabled={!title} onClick={() => {
                  s.db.trajectory.push(M.makeTrajectoryStep({ studentID, title, programID: program || undefined, targetDate: date }));
                  s.log(studentID, 'Новый шаг траектории', title, 'point.topleft.down.to.point.bottomright.curvepath');
                  s.changed(); setTitle('');
                }}>Добавить шаг</button>
              </Card>
            )}
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Индивидуальный учебный план (16)

export function StudyPlanScreen() {
  const s = useStore();
  const [subject, setSubject] = useState('');
  const [hours, setHours] = useState(2);
  const [goal, setGoal] = useState('');
  const [adaptation, setAdaptation] = useState('');
  return (
    <Page title="Индивидуальный учебный план">
      <StudentScoped>{(studentID) => {
        const items = s.db.studyPlan.filter((x) => sameId(x.studentID, studentID));
        return (
          <>
            <Card><b>Нагрузка: {items.reduce((t, x) => t + x.hoursPerWeek, 0)} ч/нед</b>
              <HBarChart data={items.map((x) => ({ label: x.subject, value: x.hoursPerWeek }))} format={(v) => `${v} ч`} /></Card>
            {items.map((item) => (
              <Card key={item.id}>
                <div className="row"><b style={{ flex: 1 }}>{item.subject}</b><Badge text={`${item.hoursPerWeek} ч/нед`} /></div>
                <InfoRow label="Цель" value={item.goal} /><InfoRow label="Период" value={item.term} />
                {item.adaptation && <InfoRow label="Адаптация" value={item.adaptation} />}
                {canTeach(s.role) && <button className="btn small danger-text" onClick={() => s.remove('studyPlan', item.id)}>Удалить</button>}
              </Card>
            ))}
            {(canTeach(s.role) || s.role === 'psychologist') && (
              <Card><h3>Добавить предмет в ИУП</h3>
                <div className="form-grid"><TextInput label="Предмет" value={subject} onChange={setSubject} />
                  <NumberInput label="Часов в неделю" value={hours} min={1} max={12} onChange={setHours} />
                  <TextInput label="Цель" value={goal} onChange={setGoal} />
                  <TextInput label="Адаптация (субтитры, короткие задания…)" value={adaptation} onChange={setAdaptation} /></div>
                <button className="btn primary" disabled={!subject} onClick={() => {
                  s.add('studyPlan', M.makeStudyPlanItem({ studentID, subject, hoursPerWeek: hours, goal, term: 'Текущая четверть', adaptation }));
                  setSubject(''); setGoal(''); setAdaptation('');
                }}>Добавить</button>
              </Card>
            )}
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Календарь (18)

const sameDay = (iso: string, d: Date) => { const x = new Date(iso); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };

export function CalendarScreen() {
  const s = useStore();
  const [day, setDay] = useState(() => new Date());
  const [note, setNote] = useState('');
  const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  return (
    <Page title="Календарь">
      <StudentScoped>{(studentID) => {
        const items = (d: Date) => {
          const out: { date: string; title: string; icon: string; color: string }[] = [];
          for (const x of s.db.sessions.filter((x) => x.participantIDs.some((p) => sameId(p, studentID)) && sameDay(x.start, d))) out.push({ date: x.start, title: `${x.subject}: ${x.title}`, icon: x.isOnline ? 'video.fill' : 'person.3.fill', color: 'var(--primary)' });
          for (const a of s.assignmentsFor(studentID).filter((a) => sameDay(a.dueDate, d))) out.push({ date: a.dueDate, title: `Дедлайн: ${a.title}`, icon: 'clock.badge.exclamationmark.fill', color: 'var(--danger)' });
          for (const e of s.db.events.filter((e) => sameDay(e.date, d))) out.push({ date: e.date, title: e.title, icon: 'star.circle.fill', color: 'var(--accent)' });
          for (const g of s.db.globalClasses.filter((g) => sameDay(g.start, d))) out.push({ date: g.start, title: `Global Classroom: ${g.title}`, icon: 'globe', color: 'purple' });
          for (const n of s.db.calendarNotes.filter((n) => sameId(n.userID, studentID) && sameDay(n.date, d))) out.push({ date: n.date, title: n.title, icon: 'note.text', color: 'var(--text-2)' });
          return out.sort((a, b) => time(a.date) - time(b.date));
        };
        const dayItems = items(day);
        return (
          <>
            <Card>
              <div className="row"><button className="btn small" onClick={() => setDay(new Date(day.getFullYear(), day.getMonth() - 1, 1))}>‹</button>
                <b style={{ flex: 1, textAlign: 'center' }}>{day.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</b>
                <button className="btn small" onClick={() => setDay(new Date(day.getFullYear(), day.getMonth() + 1, 1))}>›</button></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <span key={d} className="muted tiny">{d}</span>)}
                {Array.from({ length: offset }).map((_, i) => <span key={'e' + i} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = new Date(day.getFullYear(), day.getMonth(), i + 1);
                  const selected = d.toDateString() === day.toDateString();
                  const has = items(d).length > 0;
                  return <button key={i} className={'btn small ' + (selected ? 'primary' : '')} style={{ padding: 4, minHeight: 36 }} onClick={() => setDay(d)}>{i + 1}{has && !selected ? '•' : ''}</button>;
                })}
              </div>
            </Card>
            <Section title={day.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} icon="calendar">
              <Card>
                {dayItems.length === 0 && <EmptyState text="На этот день ничего не запланировано" icon="calendar.badge.checkmark" />}
                {dayItems.map((it, i) => <div key={i} className="row"><span style={{ color: it.color }}><Icon name={it.icon} /></span><span style={{ flex: 1 }}>{it.title}</span><span className="muted small">{fmt.time(it.date)}</span></div>)}
                <div className="row"><input className="input" value={note} placeholder="Личная заметка на этот день" onChange={(e) => setNote(e.target.value)} />
                  <button className="btn" disabled={!note} onClick={() => { s.add('calendarNotes', M.makeCalendarNote({ userID: studentID, title: note, date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).toISOString() })); setNote(''); }}>Добавить</button></div>
              </Card>
            </Section>
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Домашние задания (19, 20)

export function HomeworkScreen() {
  const sub = useSub();
  if (sub[0] === 'new') return <AssignmentEditor />;
  if (sub[0] === 'a' && sub[1] && sub[2]) return <AssignmentDetail assignmentID={sub[1]} studentID={sub[2]} />;
  if (sub[0] === 's' && sub[1]) return <SubmissionsForAssignment assignmentID={sub[1]} />;
  if (sub[0] === 'g' && sub[1]) return <GradeSubmission submissionID={sub[1]} />;
  return <HomeworkList />;
}

function HomeworkList() {
  const s = useStore();
  const link = useModuleLink();
  return (
    <Page title="Домашние задания">
      {canTeach(s.role) ? (
        <>
          <Link className="btn primary" to={link('new')}>➕ Новое задание</Link>
          {s.db.assignments.filter((a) => a.audience === 'students').sort((a, b) => time(b.dueDate) - time(a.dueDate)).map((a) => (
            <Card key={a.id} to={link('s/' + a.id)}>
              <div className="row"><b style={{ flex: 1 }}>{a.title}</b>{!a.approvedByTeacher && <Badge text="AI · ждёт проверки" color="purple" />}</div>
              <span className="muted small">{a.subject} · до {fmt.dateTime(a.dueDate)}</span>
              <span className="small">Сдано работ: {s.db.submissions.filter((x) => sameId(x.assignmentID, a.id)).length}</span>
            </Card>
          ))}
        </>
      ) : (
        <EnrollmentGate>
          <StudentScoped>{(studentID) => {
            const all = s.assignmentsFor(studentID);
            const active = all.filter((a) => !s.submission(a.id, studentID));
            const done = all.filter((a) => s.submission(a.id, studentID));
            return (
              <>
                <Section title={`Нужно сделать · ${active.length}`} icon="circle.dashed" />
                {active.length === 0 && <EmptyState text="Все задания выполнены!" icon="party.popper" />}
                {active.map((a) => <DeadlineRow key={a.id} assignment={a} to={link(`a/${a.id}/${studentID}`)} />)}
                <Section title={`Сдано · ${done.length}`} icon="checkmark.circle" />
                {done.map((a) => <SubmissionSummaryRow key={a.id} submission={s.submission(a.id, studentID)!} to={link(`a/${a.id}/${studentID}`)} />)}
              </>
            );
          }}</StudentScoped>
        </EnrollmentGate>
      )}
    </Page>
  );
}

export function AssignmentDetail({ assignmentID, studentID }: { assignmentID: string; studentID: string }) {
  const s = useStore();
  const [answer, setAnswer] = useState('');
  const [attachments, setAttachments] = useState<M.Attachment[]>([]);
  const a = s.db.assignments.find((x) => sameId(x.id, assignmentID));
  if (!a) return <Page title="Задание"><EmptyState text="Задание не найдено" /></Page>;
  const existing = s.submission(a.id, studentID);
  return (
    <Page title={a.title}>
      <Card>
        <Badge text={a.subject} />
        <span className="pre">{a.details}</span>
        <InfoRow label="Срок сдачи" value={fmt.dateTime(a.dueDate)} />
        <InfoRow label="Максимальный балл" value={a.maxScore} />
        <InfoRow label="Педагог" value={s.userName(a.teacherID)} />
        {a.textAlternative && <details open={s.accessibility.showTextAlternatives}><summary>Текстовая версия материала</summary><p className="pre small">{a.textAlternative}</p></details>}
      </Card>
      {existing && <><SubmissionSummaryRow submission={existing} />{existing.attachments.map((x) => <AttachmentRow key={x.id} attachment={x} />)}</>}
      {sameId(s.db.currentUserID, studentID) && (!existing || existing.status === 'returned') && (
        <Card>
          <h3>{existing ? 'Отправить исправленную работу' : 'Сдать работу'}</h3>
          <TextInput multiline value={answer} onChange={setAnswer} placeholder="Ответ или комментарий" />
          <AttachmentPicker attachments={attachments} onChange={setAttachments} />
          <button className="btn primary" disabled={!answer && attachments.length === 0} onClick={() => { s.submitWork(a.id, studentID, answer, attachments); setAnswer(''); setAttachments([]); }}>✈️ Отправить на проверку</button>
        </Card>
      )}
    </Page>
  );
}

function AssignmentEditor() {
  const s = useStore();
  const navigate = useNavigate();
  const [a, setA] = useState(() => M.makeAssignment({ title: '', subject: '', details: '', dueDate: isoIn(3 * 86400) }));
  const [forAll, setForAll] = useState(true);
  const set = (patch: Partial<M.Assignment>) => setA({ ...a, ...patch });
  return (
    <Page title="Новое задание">
      <Card><h3>Задание</h3>
        <div className="form-grid"><TextInput label="Название" value={a.title} onChange={(v) => set({ title: v })} /><TextInput label="Предмет" value={a.subject} onChange={(v) => set({ subject: v })} /></div>
        <TextInput label="Описание" multiline value={a.details} onChange={(v) => set({ details: v })} />
        <TextInput label="Текстовая альтернатива материалов" multiline rows={2} value={a.textAlternative} onChange={(v) => set({ textAlternative: v })} />
      </Card>
      <Card><h3>Сроки и оценивание</h3>
        <div className="form-grid"><DateInput label="Дедлайн" value={a.dueDate} onChange={(v) => set({ dueDate: v })} />
          <NumberInput label="Максимальный балл" value={a.maxScore} min={1} max={100} onChange={(v) => set({ maxScore: v })} /></div>
      </Card>
      <Card><h3>Кому</h3>
        <Toggle label="Всем ученикам" checked={forAll} onChange={setForAll} />
        {!forAll && s.students.map((st) => <Toggle key={st.id} label={st.fullName} checked={a.assignedIDs.includes(st.id)} onChange={(on) => set({ assignedIDs: on ? [...a.assignedIDs, st.id] : a.assignedIDs.filter((x) => x !== st.id) })} />)}
      </Card>
      <button className="btn primary" disabled={!a.title || !a.subject} onClick={() => {
        s.publish({ ...a, teacherID: s.db.currentUserID, assignedIDs: forAll ? [] : a.assignedIDs });
        navigate(routePath('homework'));
      }}>Опубликовать</button>
    </Page>
  );
}

function SubmissionsForAssignment({ assignmentID }: { assignmentID: string }) {
  const s = useStore();
  const a = s.db.assignments.find((x) => sameId(x.id, assignmentID));
  return (
    <Page title={a?.title ?? 'Задание'}>
      {a && !a.approvedByTeacher && <Link className="btn" to={routePath('aiTaskGenerator', 'review/' + a.id)}>✨ Проверить и утвердить AI-задание</Link>}
      {a && <Card><span className="pre">{a.details}</span><span className="muted small">До {fmt.dateTime(a.dueDate)} · максимум {a.maxScore}</span></Card>}
      {s.db.submissions.filter((x) => sameId(x.assignmentID, assignmentID)).map((x) => <SubmissionSummaryRow key={x.id} submission={x} showStudent to={routePath('homework', 'g/' + x.id)} />)}
      {s.db.submissions.every((x) => !sameId(x.assignmentID, assignmentID)) && <EmptyState text="Работ пока нет" />}
    </Page>
  );
}

const QUICK_FEEDBACK = ['Отличная работа!', 'Хорошо, но проверь вычисления.', 'Добавь пояснения к решению.', 'Оформи работу аккуратнее.', 'Молодец, виден прогресс!'];

export function GradeSubmission({ submissionID }: { submissionID: string }) {
  const s = useStore();
  const navigate = useNavigate();
  const sub = s.db.submissions.find((x) => sameId(x.id, submissionID));
  const a = sub && s.db.assignments.find((x) => sameId(x.id, sub.assignmentID));
  const maxScore = a?.maxScore ?? 10;
  const [score, setScore] = useState(sub?.score ?? Math.min(8, maxScore));
  const [feedback, setFeedback] = useState(sub?.feedback ?? '');
  if (!sub) return <Page title="Оценивание"><EmptyState text="Работа не найдена" /></Page>;
  return (
    <Page title="Оценивание">
      <Card><b>{s.userName(sub.studentID)}</b><span>{a?.title}</span><hr style={{ border: 0, borderTop: '1px solid var(--border)', width: '100%' }} />
        <span className="pre">{sub.text || 'Без текстового ответа'}</span>{sub.attachments.map((x) => <AttachmentRow key={x.id} attachment={x} />)}</Card>
      <Card><h3>Оценка</h3>
        <NumberInput label={`Балл (из ${maxScore})`} value={score} min={0} max={maxScore} onChange={setScore} />
        <span className="muted small">Быстрые комментарии</span>
        <div className="chips">{QUICK_FEEDBACK.map((q) => <button key={q} className="chip" onClick={() => setFeedback(feedback ? feedback + ' ' + q : q)}>{q}</button>)}</div>
        <TextInput multiline value={feedback} onChange={setFeedback} placeholder="Обратная связь ученику" />
        <div className="row"><button className="btn" onClick={() => { s.grade(sub.id, score, feedback, true); navigate(-1); }}>На доработку</button><span className="spacer" />
          <button className="btn primary" onClick={() => { s.grade(sub.id, score, feedback); navigate(-1); }}>Поставить оценку</button></div>
      </Card>
    </Page>
  );
}

export function GradingScreen() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 'g' && sub[1]) return <GradeSubmission submissionID={sub[1]} />;
  const pending = s.db.submissions.filter((x) => x.status === 'submitted').sort((a, b) => time(a.submittedAt) - time(b.submittedAt));
  const graded = s.db.submissions.filter((x) => x.status !== 'submitted').sort((a, b) => time(b.gradedAt) - time(a.gradedAt)).slice(0, 20);
  return (
    <Page title="Проверка работ">
      <Section title={`Ожидают проверки · ${pending.length}`} icon="tray.full.fill" />
      {pending.length === 0 && <EmptyState text="Все работы проверены" icon="checkmark.seal" />}
      {pending.map((x) => (
        <Card key={x.id} to={routePath('grading', 'g/' + x.id)}>
          <b>{s.userName(x.studentID)}</b><span>{s.db.assignments.find((a) => sameId(a.id, x.assignmentID))?.title}</span>
          <span className="muted small">Сдано {fmt.dateTime(x.submittedAt)} · вложений: {x.attachments.length}</span>
        </Card>
      ))}
      <Section title="Проверенные" icon="checkmark.circle" />
      {graded.map((x) => <SubmissionSummaryRow key={x.id} submission={x} showStudent to={routePath('grading', 'g/' + x.id)} />)}
    </Page>
  );
}

// MARK: Портфолио (22)

const PORTFOLIO_CATEGORIES = ['Проект', 'Олимпиада', 'Творчество', 'Исследование', 'Волонтёрство', 'Спорт'];

export function PortfolioScreen() {
  const s = useStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Проект');
  const [summary, setSummary] = useState('');
  const [attachments, setAttachments] = useState<M.Attachment[]>([]);
  return (
    <Page title="Электронное портфолио">
      <StudentScoped>{(studentID) => {
        const items = s.db.portfolio.filter((x) => sameId(x.studentID, studentID)).sort((a, b) => time(b.date) - time(a.date));
        const projects = s.db.projects.filter((p) => p.authorIDs.some((a) => sameId(a, studentID)));
        const certs = s.db.certificates.filter((c) => sameId(c.userID, studentID));
        return (
          <>
            <div className="grid" style={{ ['--min' as string]: '150px' }}>
              <StatTile title="Работ в портфолио" value={items.length} icon="briefcase.fill" />
              <StatTile title="Проектов" value={projects.length} icon="lightbulb.fill" color="var(--accent)" />
              <StatTile title="Сертификатов" value={certs.length} icon="doc.badge.ellipsis" color="var(--success)" />
            </div>
            {items.map((item) => (
              <Card key={item.id}>
                <div className="row"><b style={{ flex: 1 }}>{item.title}</b>
                  {item.verifiedBy ? <span className="ok small">✅ Подтверждено</span> : canTeach(s.role) && <button className="btn small" onClick={() => s.update('portfolio', item.id, { verifiedBy: s.db.currentUserID })}>Подтвердить</button>}</div>
                <span className="muted small">{item.category} · {fmt.short(item.date)}</span>
                <span>{item.summary}</span>
                {item.attachments.map((x) => <AttachmentRow key={x.id} attachment={x} />)}
              </Card>
            ))}
            {projects.length > 0 && <Section title="Проекты" icon="lightbulb.fill">{projects.map((p) => <ProjectCard key={p.id} project={p} />)}</Section>}
            {(sameId(s.db.currentUserID, studentID) || canTeach(s.role)) && (
              <Card><h3>Добавить в портфолио</h3>
                <div className="form-grid"><TextInput label="Название" value={title} onChange={setTitle} />
                  <Select label="Категория" value={category} onChange={setCategory} options={PORTFOLIO_CATEGORIES.map((c) => ({ value: c, label: c }))} /></div>
                <TextInput label="Описание" multiline value={summary} onChange={setSummary} />
                <AttachmentPicker attachments={attachments} onChange={setAttachments} />
                <button className="btn primary" disabled={!title} onClick={() => {
                  s.db.portfolio.push(M.makePortfolioItem({ studentID, title, category, summary, attachments }));
                  s.log(studentID, 'Добавлено в портфолио', title, 'briefcase');
                  s.changed(); setTitle(''); setSummary(''); setAttachments([]);
                }}>Сохранить</button>
              </Card>
            )}
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Достижения и сертификаты (23)

export function AchievementsScreen() {
  const s = useStore();
  return (
    <Page title="Достижения и сертификаты">
      <StudentScoped>{(studentID) => {
        const list = s.db.achievements.filter((a) => sameId(a.userID, studentID)).sort((a, b) => time(b.date) - time(a.date));
        const points = list.reduce((t, a) => t + a.points, 0);
        return (
          <>
            <Card><div className="row"><span style={{ fontSize: '2.4rem' }}>🏆</span>
              <div className="stack tight"><b style={{ fontSize: '1.4rem' }}>{points} очков</b><span className="muted small">Уровень {Math.floor(points / 100) + 1} · до следующего {100 - (points % 100)}</span></div></div>
              <ProgressBar value={(points % 100) / 100} color="var(--accent)" /></Card>
            <div className="grid" style={{ ['--min' as string]: '160px' }}>
              {list.map((a) => <Card key={a.id}><span style={{ fontSize: '2rem' }}><Icon name={a.icon} /></span><b className="small">{a.title}</b><span className="muted tiny">+{a.points} · {fmt.short(a.date)}</span></Card>)}
            </div>
            {list.length === 0 && <EmptyState text="Достижений пока нет" icon="trophy" />}
            <Section title="Сертификаты" icon="doc.badge.ellipsis" />
            {s.db.certificates.filter((c) => sameId(c.userID, studentID)).map((c) => <CertificateCard key={c.id} certificate={c} />)}
            {canTeach(s.role) && <button className="btn outline" onClick={() => { s.issueCertificate(studentID, 'Успешное завершение модуля', 'school', 24); s.changed(); }}>Выдать сертификат об окончании модуля</button>}
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Дашборд прогресса (24)

export function ProgressDashboardScreen() {
  return <Page title="Дашборд прогресса"><StudentScoped>{(id) => <ProgressDashboardContent studentID={id} />}</StudentScoped></Page>;
}

export function ProgressDashboardContent({ studentID }: { studentID: string }) {
  const s = useStore();
  const a = analyze(studentID, s);
  return (
    <div className="stack loose">
      <div className="grid" style={{ ['--min' as string]: '150px' }}>
        <StatTile title="Общий прогресс" value={fmt.pct(a.overall)} icon="gauge.with.dots.needle.67percent" />
        <StatTile title="Выполнение заданий" value={fmt.pct(a.completionRate)} icon="checkmark.circle.fill" color="var(--success)" />
        <StatTile title="Средний балл тестов" value={a.testAverage === null ? '—' : fmt.pct(a.testAverage)} icon="checklist" color="var(--accent)" />
        <StatTile title="Посещаемость" value={a.attendanceRate === null ? '—' : fmt.pct(a.attendanceRate)} icon="person.fill.checkmark" color="purple" />
      </div>
      <Card><h3>Успеваемость по предметам</h3>
        {a.subjects.length === 0 ? <EmptyState text="Пока нет оценок" /> :
          <BarChart max={100} format={(v) => `${Math.round(v)}%`} data={a.subjects.map((x) => ({ label: x.subject, value: x.average * 100, color: x.average >= 0.75 ? 'var(--success)' : x.average >= 0.5 ? 'var(--warning)' : 'var(--danger)' }))} />}
      </Card>
      <Card><h3>Активность за неделю</h3>
        <BarChart data={a.weeklyActivity.map((d) => ({ label: d.day.toLocaleDateString('ru-RU', { weekday: 'short' }), value: d.count }))} color="var(--accent)" />
      </Card>
      <Card>
        <div className="row"><h3 style={{ flex: 1 }}>Статус</h3><Badge text={RISK_TITLE[a.risk]} color={RISK_COLOR[a.risk]} /></div>
        {a.strongest && <InfoRow label="Сильная сторона" value={a.strongest.subject} />}
        {a.weakest && a.subjects.length > 1 && <InfoRow label="Зона роста" value={a.weakest.subject} />}
        <InfoRow label="Просрочено заданий" value={a.overdue.length} />
      </Card>
    </div>
  );
}

// MARK: История обучения (25)

export function HistoryScreen() {
  const s = useStore();
  const userID = s.role === 'student' ? s.db.currentUserID : s.visibleStudents[0]?.id ?? s.db.currentUserID;
  const entries = s.db.history.filter((h) => sameId(h.userID, userID)).sort((a, b) => time(b.date) - time(a.date));
  const groups = new Map<string, M.HistoryEntry[]>();
  for (const e of entries) { const k = new Date(e.date).toDateString(); groups.set(k, [...(groups.get(k) ?? []), e]); }
  return (
    <Page title="История обучения">
      {entries.length === 0 && <EmptyState text="История пока пуста" icon="clock" />}
      {[...groups.entries()].map(([day, list]) => (
        <Card key={day}><b>{new Date(day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
          {list.map((e) => <div key={e.id} className="row"><Icon name={e.icon} /><span className="stack tight" style={{ flex: 1 }}><span>{e.action}</span>{e.details && <span className="muted small">{e.details}</span>}</span><span className="muted small">{fmt.time(e.date)}</span></div>)}
        </Card>
      ))}
    </Page>
  );
}

// MARK: Дедлайны (36)

export function DeadlinesScreen() {
  const s = useStore();
  if (canTeach(s.role)) {
    const all = s.db.assignments.filter((a) => a.approvedByTeacher).sort((a, b) => time(a.dueDate) - time(b.dueDate));
    return (
      <Page title="Дедлайны">
        {all.length === 0 && <EmptyState text="Заданий нет" />}
        {all.map((a) => {
          const submitted = new Set(s.db.submissions.filter((x) => sameId(x.assignmentID, a.id)).map((x) => x.studentID.toUpperCase())).size;
          const expected = a.assignedIDs.length === 0 ? s.students.length : a.assignedIDs.length;
          return <div key={a.id} className="stack tight"><DeadlineRow assignment={a} to={routePath('homework', 's/' + a.id)} />{a.audience === 'students' && <span className="muted small">Сдали: {submitted} из {expected}</span>}</div>;
        })}
      </Page>
    );
  }
  return (
    <Page title="Дедлайны">
      <StudentScoped>{(studentID) => {
        const pending = s.assignmentsFor(studentID).filter((a) => !s.submission(a.id, studentID));
        const now = Date.now();
        const groups: [string, string, M.Assignment[]][] = [
          ['Просрочено', 'exclamationmark.triangle.fill', pending.filter((a) => time(a.dueDate) < now)],
          ['Ближайшие 3 дня', 'clock.fill', pending.filter((a) => time(a.dueDate) >= now && time(a.dueDate) < now + 3 * 86400000)],
          ['Позже', 'calendar', pending.filter((a) => time(a.dueDate) >= now + 3 * 86400000)],
        ];
        return (
          <>
            {pending.length === 0 && <EmptyState text="Все задания сданы 🎉" icon="checkmark.circle" />}
            {groups.filter((g) => g[2].length).map(([title, icon, list]) => (
              <Section key={title} title={`${title} · ${list.length}`} icon={icon}>
                {list.map((a) => <DeadlineRow key={a.id} assignment={a} to={routePath('homework', `a/${a.id}/${studentID}`)} />)}
              </Section>
            ))}
            <span className="muted small">Напоминания о дедлайнах приходят в уведомления KKSU и в iPhone-приложение.</span>
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Обзор ученика (для родителя, педагога, психолога, наставника)

export function StudentOverview({ studentID }: { studentID: string }) {
  const s = useStore();
  const teacher = s.users('teacher')[0];
  return (
    <Page title={s.userName(studentID)}>
      <Card><StudentOverviewHeader studentID={studentID} /></Card>
      <ProgressDashboardContent studentID={studentID} />
      <Section title="Работы" icon="tray.full" />
      {s.db.submissions.filter((x) => sameId(x.studentID, studentID)).sort((a, b) => time(b.submittedAt) - time(a.submittedAt)).map((x) => <SubmissionSummaryRow key={x.id} submission={x} />)}
      <Section title="Связь" icon="bubble.left" />
      {teacher && s.role !== 'teacher'
        ? <Link className="btn" to={routePath('chat', 'u/' + teacher.id)}>💬 Написать педагогу ({teacher.fullName})</Link>
        : <Link className="btn" to={routePath('chat', 'u/' + studentID)}>💬 Написать ученику</Link>}
    </Page>
  );
}

function StudentOverviewHeader({ studentID }: { studentID: string }) {
  const s = useStore();
  const a = analyze(studentID, s);
  return (
    <div className="row">
      <span className="avatar" style={{ width: 44, height: 44 }}>{s.userName(studentID).slice(0, 1)}</span>
      <div className="stack tight" style={{ flex: 1 }}><b>{s.userName(studentID)}</b><span className="muted small">Класс {s.profile(studentID)?.grade ?? '—'} · прогресс {fmt.pct(a.overall)}</span></div>
      <Badge text={RISK_TITLE[a.risk]} color={RISK_COLOR[a.risk]} />
    </div>
  );
}

export { Chips };
