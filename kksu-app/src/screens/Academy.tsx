// KKSU Teacher Academy (37–46): курсы ПК, задания педагогов, сертификаты, методики, апробация, экспертиза — как KKSUTeacherAcademy.swift.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as M from '../core/models.gen';
import { METHODOLOGY_CRITERIA, certificateCode, pilotGrowth, reviewAverage } from '../core/helpers';
import { isoIn, sameId, time } from '../core/ids';
import {
  AttachmentPicker, AttachmentRow, Badge, Card, DateInput, EmptyState, fmt, InfoRow, Modal, NumberInput, Page, ProgressBar, RouteRow, Section,
  Segmented, Select, StatTile, TextInput, Tiles, routePath, useStore, useSub,
} from '../ui/kit';
import { BarChart, CertificateCard, PaywallGate, PriceBadge, SubmissionSummaryRow } from './shared';
import { TestCard } from './Library';

// MARK: Главная Teacher Academy (37)

export function TeacherAcademyScreen() {
  const s = useStore();
  const me = s.db.currentUserID;
  const registered = s.db.academyProfiles.some((p) => sameId(p.userID, me));
  const mine = s.db.teacherCourses.filter((c) => !!me && c.enrolledIDs.some((x) => sameId(x, me)));
  return (
    <Page title="KKSU Teacher Academy">
      <Card>
        <h2>🏛️ Академия педагогов KKSU</h2>
        <span>Повышение квалификации, методическая библиотека, авторские методики KKSU, их апробация и экспертиза.</span>
        {registered ? <Badge text="Вы слушатель Academy" color="var(--success)" />
          : <Link className="btn primary block" to={routePath('academyRegistration')}>Зарегистрироваться в Academy</Link>}
      </Card>
      <div className="grid" style={{ ['--min' as string]: '150px' }}>
        <StatTile title="Курсов" value={s.db.teacherCourses.length} icon="person.crop.rectangle.stack.fill" />
        <StatTile title="Слушателей" value={s.db.academyProfiles.length} icon="person.3.fill" color="var(--accent)" />
        <StatTile title="Авторских методик" value={s.db.methodologies.length} icon="lightbulb.2.fill" color="var(--success)" />
        <StatTile title="Сертификатов выдано" value={s.db.certificates.filter((c) => c.issuer === 'teacherAcademy').length} icon="doc.badge.ellipsis" color="purple" />
      </div>
      {mine.length > 0 && <Section title="Мои курсы" icon="book.fill">{mine.map((c) => <TeacherCourseCard key={c.id} course={c} />)}</Section>}
      <Card><div className="list">
        <RouteRow route="teacherCertification" subtitle="Платная сертификация преподавателя KKSU" />
        <RouteRow route="teacherMarketplace" subtitle="Разместите свой курс в каталоге KKSU" />
      </div></Card>
      <Section title="Разделы" icon="square.grid.2x2" />
      <Tiles routes={['academyCourses', 'academyLibrary', 'academyTasks', 'certificates', 'methodologies', 'pilots', 'methodologyReview', 'pilotRegistry']} />
    </Page>
  );
}

// MARK: Регистрация педагога (38)

export function AcademyRegistrationScreen() {
  const s = useStore();
  const me = s.db.currentUserID;
  const existing = s.db.academyProfiles.find((p) => sameId(p.userID, me));
  const [f, setF] = useState({ specialization: '', experience: 3, organization: 'KKSU' });
  return (
    <Page title="Регистрация в Academy">
      {existing ? (
        <Card>
          <h3>Вы зарегистрированы</h3>
          <InfoRow label="Специализация" value={existing.specialization} />
          <InfoRow label="Стаж" value={`${existing.experienceYears} лет`} />
          <InfoRow label="Организация" value={existing.organization} />
          <InfoRow label="Дата регистрации" value={fmt.short(existing.date)} />
          <div className="list"><RouteRow route="academyCourses" /></div>
        </Card>
      ) : (
        <Card>
          <h3>Анкета педагога</h3>
          <TextInput label="Специализация (предметы)" value={f.specialization} onChange={(v) => setF({ ...f, specialization: v })} />
          <NumberInput label="Педагогический стаж, лет" value={f.experience} min={0} max={50} onChange={(v) => setF({ ...f, experience: v })} />
          <TextInput label="Организация" value={f.organization} onChange={(v) => setF({ ...f, organization: v })} />
          <button className="btn primary" disabled={!f.specialization || !me} onClick={() => {
            s.add('academyProfiles', M.makeTeacherAcademyProfile({ userID: me!, specialization: f.specialization, experienceYears: f.experience, organization: f.organization }));
            s.notify(me!, 'Добро пожаловать в Teacher Academy', 'Выберите курс повышения квалификации.', 'system');
            s.log(me!, 'Регистрация в Teacher Academy', '', 'building.columns');
          }}>Зарегистрироваться</button>
        </Card>
      )}
    </Page>
  );
}

// MARK: Курсы повышения квалификации (39)

export function AcademyCoursesScreen() {
  const s = useStore();
  const sub = useSub();
  const [adding, setAdding] = useState(false);
  if (sub[0]) return <TeacherCourseDetail courseID={sub[0]} />;
  return (
    <Page title="Курсы повышения квалификации">
      {s.db.teacherCourses.map((c) => <TeacherCourseCard key={c.id} course={c} />)}
      {s.db.teacherCourses.length === 0 && <EmptyState text="Курсов пока нет" icon="book" />}
      {(s.role === 'admin' || s.role === 'expert') && <button className="btn outline" onClick={() => setAdding(true)}>➕ Добавить курс</button>}
      {adding && <TeacherCourseEditor onClose={() => setAdding(false)} />}
    </Page>
  );
}

function TeacherCourseCard({ course }: { course: M.TeacherCourse }) {
  const s = useStore();
  const me = s.db.currentUserID;
  const enrolled = !!me && course.enrolledIDs.some((x) => sameId(x, me));
  const done = (me && (course.completedModules[me] ?? course.completedModules[me.toUpperCase()])) || [];
  const product = s.productForRef(course.id);
  return (
    <Card>
      <div className="row wrap"><b style={{ flex: 1 }}>{course.title}</b><PriceBadge product={product} /><Badge text={`${course.hours} ч`} /></div>
      <span className="muted small">{course.level} · модулей: {course.modules.length} · слушателей: {course.enrolledIDs.length}</span>
      <span>{course.summary}</span>
      {enrolled ? (
        <>
          <ProgressBar value={course.modules.length ? done.length / course.modules.length : 0} color="var(--success)" />
          <Link to={routePath('academyCourses', course.id)}>Продолжить обучение ›</Link>
        </>
      ) : (
        <PaywallGate product={product} message="Платная программа Teacher Academy. Запись откроется после подтверждения оплаты.">
          <button className="btn primary" onClick={() => s.enrollTeacherCourse(course.id)}>Записаться на курс</button>
        </PaywallGate>
      )}
    </Card>
  );
}

function TeacherCourseDetail({ courseID }: { courseID: string }) {
  const s = useStore();
  const course = s.db.teacherCourses.find((c) => sameId(c.id, courseID));
  if (!course) return <Page title="Курс"><EmptyState text="Курс не найден" /></Page>;
  const me = s.db.currentUserID;
  const done = (me && (course.completedModules[me] ?? course.completedModules[me.toUpperCase()])) || [];
  const completed = !!me && course.completedIDs.some((x) => sameId(x, me));
  return (
    <Page title={course.title}>
      <Card>
        <span>{course.summary}</span>
        <ProgressBar value={course.modules.length ? done.length / course.modules.length : 0} color="var(--success)" />
        <span className="small">Пройдено модулей: {done.length} из {course.modules.length}</span>
        {completed && <span className="ok">✅ Курс завершён — сертификат выдан</span>}
      </Card>
      <Section title="Модули" icon="list.number" />
      {course.modules.map((m) => (
        <button key={m} className="card row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => s.toggleModule(m, course.id)}>
          <span>{done.includes(m) ? '✅' : '⚪️'}</span><span>{m}</span>
        </button>
      ))}
      <Section title="Задания и тесты курса" icon="pencil.and.list.clipboard" />
      {s.db.assignments.filter((a) => sameId(a.courseID, course.id)).map((a) => <TeacherTaskCard key={a.id} assignment={a} />)}
      {s.db.tests.filter((t) => sameId(t.courseID, course.id)).map((t) => <TestCard key={t.id} test={t} />)}
    </Page>
  );
}

function TeacherCourseEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [c, setC] = useState(() => M.makeTeacherCourse({ title: '', hours: 36, level: 'Базовый', summary: '', modules: [] }));
  const [modules, setModules] = useState('');
  return (
    <Modal title="Новый курс" onClose={onClose}>
      <TextInput label="Название" value={c.title} onChange={(v) => setC({ ...c, title: v })} />
      <div className="form-grid">
        <NumberInput label="Часов" value={c.hours} min={4} max={300} step={4} onChange={(v) => setC({ ...c, hours: v })} />
        <Select label="Уровень" value={c.level} onChange={(v) => setC({ ...c, level: v })} options={['Базовый', 'Средний', 'Продвинутый'].map((x) => ({ value: x, label: x }))} />
      </div>
      <TextInput label="Описание" multiline value={c.summary} onChange={(v) => setC({ ...c, summary: v })} />
      <TextInput label="Модули (каждый с новой строки)" multiline rows={5} value={modules} onChange={setModules} />
      <button className="btn primary" disabled={!c.title || !modules.trim()} onClick={() => {
        s.add('teacherCourses', { ...c, modules: modules.split('\n').map((x) => x.trim()).filter(Boolean) });
        onClose();
      }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Задания и тесты педагогов (41)

export function AcademyTasksScreen() {
  const s = useStore();
  const sub = useSub();
  const [adding, setAdding] = useState(false);
  if (sub[0] === 'subs' && sub[1]) return <SubmissionsForAssignment assignmentID={sub[1]} />;
  return (
    <Page title="Задания и тесты педагогов">
      <Section title="Практические задания" icon="pencil.and.list.clipboard" />
      {s.db.assignments.filter((a) => a.audience === 'teachers').map((a) => <TeacherTaskCard key={a.id} assignment={a} />)}
      {(s.role === 'admin' || s.role === 'expert') && <button className="btn outline" onClick={() => setAdding(true)}>➕ Добавить задание для педагогов</button>}
      <Section title="Тесты" icon="checklist" />
      {s.db.tests.filter((t) => t.audience === 'teachers').map((t) => <TestCard key={t.id} test={t} />)}
      {adding && <TeacherTaskEditor onClose={() => setAdding(false)} />}
    </Page>
  );
}

function TeacherTaskCard({ assignment: a }: { assignment: M.Assignment }) {
  const s = useStore();
  const me = s.db.currentUserID;
  const sub = me ? s.submission(a.id, me) : undefined;
  const count = s.db.submissions.filter((x) => sameId(x.assignmentID, a.id)).length;
  return (
    <Card>
      <b>{a.title}</b>
      <span>{a.details}</span>
      <span className="muted small">Срок: {fmt.short(a.dueDate)}</span>
      {sub ? <SubmissionSummaryRow submission={sub} />
        : me && (s.role === 'teacher' || s.role === 'psychologist') && <Link to={routePath('homework', `a/${a.id}/${me}`)}>Выполнить задание ›</Link>}
      {(s.role === 'expert' || s.role === 'admin') && <Link to={routePath('academyTasks', 'subs/' + a.id)}>Работы слушателей: {count} ›</Link>}
    </Card>
  );
}

function SubmissionsForAssignment({ assignmentID }: { assignmentID: string }) {
  const s = useStore();
  const a = s.db.assignments.find((x) => sameId(x.id, assignmentID));
  const list = s.db.submissions.filter((x) => sameId(x.assignmentID, assignmentID));
  return (
    <Page title={a?.title ?? 'Работы'}>
      {list.length === 0 && <EmptyState text="Работ пока нет" />}
      {list.map((x) => <SubmissionSummaryRow key={x.id} submission={x} showStudent to={routePath('grading', 'g/' + x.id)} />)}
    </Page>
  );
}

function TeacherTaskEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [a, setA] = useState(() => M.makeAssignment({ title: '', subject: 'Teacher Academy', details: '', dueDate: isoIn(14 * 86400), audience: 'teachers' }));
  return (
    <Modal title="Задание для педагогов" onClose={onClose}>
      <TextInput label="Название" value={a.title} onChange={(v) => setA({ ...a, title: v })} />
      <TextInput label="Описание" multiline value={a.details} onChange={(v) => setA({ ...a, details: v })} />
      <DateInput label="Срок" value={a.dueDate} onChange={(v) => setA({ ...a, dueDate: v })} />
      <Select label="Курс" value={a.courseID ?? ''} onChange={(v) => setA({ ...a, courseID: v || undefined })}
        options={[{ value: '', label: 'Без курса' }, ...s.db.teacherCourses.map((c) => ({ value: c.id, label: c.title }))]} />
      <button className="btn primary" disabled={!a.title} onClick={() => {
        s.add('assignments', { ...a, teacherID: s.db.currentUserID ?? undefined });
        for (const t of s.users('teacher')) s.notify(t.id, 'Новое задание Teacher Academy', a.title, 'deadline');
        onClose();
      }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Электронные сертификаты (23, 42, 99)

export function CertificatesScreen() {
  const s = useStore();
  const [code, setCode] = useState('');
  const me = s.db.currentUserID;
  const list = (s.role === 'admin' ? s.db.certificates : s.db.certificates.filter((c) => sameId(c.userID, me))).slice().sort((a, b) => time(b.date) - time(a.date));
  const q = code.trim().toLowerCase();
  const found = q ? s.db.certificates.find((c) => certificateCode(c).toLowerCase() === q) : undefined;
  return (
    <Page title="Электронные сертификаты">
      {list.length === 0 && <EmptyState text="Сертификатов пока нет. Они выдаются автоматически после курсов, мероприятий и конкурсов." icon="doc.badge.ellipsis" />}
      {list.map((c) => <CertificateCard key={c.id} certificate={c} />)}
      <Card>
        <h3>Проверка подлинности</h3>
        <TextInput value={code} onChange={setCode} placeholder="Код сертификата (KKSU-...)" />
        {q && (found ? <span className="ok">✅ Действителен: {found.recipientName} — {found.title}</span> : <span style={{ color: 'var(--danger)' }}>❌ Сертификат не найден</span>)}
      </Card>
    </Page>
  );
}

// MARK: Авторские методики (43)

export function MethodologiesScreen() {
  const s = useStore();
  const sub = useSub();
  const [status, setStatus] = useState<M.MethodologyStatus | ''>('');
  const [adding, setAdding] = useState(false);
  if (sub[0] === 'pilot' && sub[1]) return <PilotEditor methodologyID={sub[1]} />;
  if (sub[0] === 'review' && sub[1]) return <ExpertReviewForm targetID={sub[1]} target="methodology" criteria={METHODOLOGY_CRITERIA} />;
  if (sub[0]) return <MethodologyDetail methodologyID={sub[0]} />;
  return (
    <Page title="Авторские методики KKSU">
      <div className="chips">
        <button className={'chip' + (!status ? ' on' : '')} onClick={() => setStatus('')}>Все</button>
        {M.MethodologyStatus.values.map((x) => <button key={x} className={'chip' + (status === x ? ' on' : '')} onClick={() => setStatus(x)}>{M.MethodologyStatus.title[x]}</button>)}
      </div>
      {s.db.methodologies.filter((m) => !status || m.status === status).map((m) => <MethodologyCard key={m.id} methodology={m} link />)}
      {s.db.methodologies.length === 0 && <EmptyState text="Методик пока нет" icon="lightbulb" />}
      {(s.role === 'teacher' || s.role === 'psychologist' || s.role === 'admin') && <button className="btn outline" onClick={() => setAdding(true)}>➕ Предложить методику</button>}
      {adding && <MethodologyEditor onClose={() => setAdding(false)} />}
    </Page>
  );
}

function MethodologyCard({ methodology: m, link }: { methodology: M.Methodology; link?: boolean }) {
  const s = useStore();
  const reviews = s.reviewsFor(m.id);
  const avg = reviews.length ? reviews.reduce((t, r) => t + reviewAverage(r), 0) / reviews.length : undefined;
  const body = (
    <>
      <div className="row"><b style={{ flex: 1 }}>{m.title}</b><Badge text={M.MethodologyStatus.title[m.status]} color={m.status === 'approved' ? 'var(--success)' : 'var(--primary)'} /></div>
      <span className="muted small">{m.author} · {m.subject} · {m.ageGroup} лет</span>
      <span>{m.summary}</span>
      <span className="small">🧪 {s.db.pilots.filter((p) => sameId(p.methodologyID, m.id)).length} апробаций{avg !== undefined ? ` · ⭐ ${avg.toFixed(1)} / 10` : ''}</span>
    </>
  );
  return link ? <Card to={routePath('methodologies', m.id)}>{body}</Card> : <Card>{body}</Card>;
}

function MethodologyDetail({ methodologyID }: { methodologyID: string }) {
  const s = useStore();
  const [attachments, setAttachments] = useState<M.Attachment[]>([]);
  const m = s.db.methodologies.find((x) => sameId(x.id, methodologyID));
  if (!m) return <Page title="Методика"><EmptyState text="Методика не найдена" /></Page>;
  return (
    <Page title={m.title}>
      <MethodologyCard methodology={m} />
      <Card>
        <h3>Материалы методики</h3>
        {m.documents.map((d) => <AttachmentRow key={d.id} attachment={d} />)}
        {m.documents.length === 0 && <span className="muted small">Файлов пока нет</span>}
        {(s.role === 'teacher' || s.role === 'admin') && (
          <>
            <AttachmentPicker attachments={attachments} onChange={setAttachments} />
            {attachments.length > 0 && <button className="btn" onClick={() => { s.update('methodologies', m.id, (x) => ({ ...x, documents: [...x.documents, ...attachments] })); setAttachments([]); }}>Прикрепить файлы</button>}
          </>
        )}
      </Card>
      {s.role === 'admin' && <Segmented value={m.status} onChange={(v) => s.update('methodologies', m.id, { status: v })} options={M.MethodologyStatus.values.map((x) => ({ value: x, label: M.MethodologyStatus.title[x] }))} />}
      <Section title="Апробация" icon="testtube.2" />
      {s.db.pilots.filter((p) => sameId(p.methodologyID, m.id)).map((p) => <PilotCard key={p.id} pilot={p} />)}
      <Link to={routePath('methodologies', 'pilot/' + m.id)}>➕ Добавить результаты апробации</Link>
      <Section title="Экспертные оценки" icon="star.leadinghalf.filled" />
      {s.reviewsFor(m.id).map((r) => <ReviewCard key={r.id} review={r} />)}
      {(s.role === 'expert' || s.role === 'mentor' || s.role === 'admin') && <Link className="btn primary" to={routePath('methodologies', 'review/' + m.id)}>Провести экспертную оценку</Link>}
    </Page>
  );
}

function MethodologyEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [m, setM] = useState(() => M.makeMethodology({ title: '', author: s.currentUser?.fullName ?? '', subject: '', ageGroup: '7–12', summary: '' }));
  const set = (patch: Partial<M.Methodology>) => setM({ ...m, ...patch });
  return (
    <Modal title="Новая методика" onClose={onClose}>
      <TextInput label="Название методики" value={m.title} onChange={(v) => set({ title: v })} />
      <div className="form-grid">
        <TextInput label="Автор(ы)" value={m.author} onChange={(v) => set({ author: v })} />
        <TextInput label="Предмет / область" value={m.subject} onChange={(v) => set({ subject: v })} />
        <TextInput label="Возрастная группа" value={m.ageGroup} onChange={(v) => set({ ageGroup: v })} />
      </div>
      <TextInput label="Описание: цель, подход, ожидаемые результаты" multiline rows={5} value={m.summary} onChange={(v) => set({ summary: v })} />
      <button className="btn primary" disabled={!m.title || !m.summary} onClick={() => {
        s.add('methodologies', m);
        for (const e of s.users('expert')) s.notify(e.id, 'Новая методика', m.title, 'info');
        onClose();
      }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Апробация (44, 46)

export function PilotsScreen() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 'new' && sub[1]) return <PilotEditor methodologyID={sub[1]} />;
  return (
    <Page title="Апробация методик">
      <span className="muted">Методики в статусе «Апробация» проверяются на площадках KKSU и партнёров. Результаты вносятся в реестр.</span>
      {s.db.methodologies.filter((m) => m.status === 'piloting' || m.status === 'reviewed').map((m) => (
        <Card key={m.id}>
          <b>{m.title}</b>
          <span className="small">Площадок: {s.db.pilots.filter((p) => sameId(p.methodologyID, m.id)).length}</span>
          <div className="row wrap">
            <Link to={routePath('pilots', 'new/' + m.id)}>➕ Внести результаты</Link>
            <Link to={routePath('methodologies', m.id)}>📄 Карточка методики</Link>
          </div>
        </Card>
      ))}
      {(s.role === 'admin' || s.role === 'teacher') && (
        <Section title="Отправить методику на апробацию" icon="paperplane">
          {s.db.methodologies.filter((m) => m.status === 'draft').map((m) => (
            <div key={m.id} className="row"><span style={{ flex: 1 }}>{m.title}</span><button className="btn small" onClick={() => s.update('methodologies', m.id, { status: 'piloting' })}>На апробацию</button></div>
          ))}
        </Section>
      )}
      <Card><div className="list"><RouteRow route="pilotRegistry" subtitle="Все результаты апробации" /></div></Card>
    </Page>
  );
}

function PilotEditor({ methodologyID }: { methodologyID: string }) {
  const s = useStore();
  const navigate = useNavigate();
  const [p, setP] = useState(() => M.makeMethodologyPilot({
    methodologyID, site: '', teacherName: s.currentUser?.fullName ?? '', startDate: isoIn(-60 * 86400), endDate: isoIn(0),
    participants: 20, baselineScore: 55, finalScore: 70, summary: '',
  }));
  const set = (patch: Partial<M.MethodologyPilot>) => setP({ ...p, ...patch });
  return (
    <Page title="Результаты апробации">
      <Card>
        <h3>Площадка</h3>
        <div className="form-grid">
          <TextInput label="Школа / класс" value={p.site} onChange={(v) => set({ site: v })} />
          <TextInput label="Педагог" value={p.teacherName} onChange={(v) => set({ teacherName: v })} />
          <DateInput label="Начало" dateOnly value={p.startDate} onChange={(v) => set({ startDate: v })} />
          <DateInput label="Окончание" dateOnly value={p.endDate} onChange={(v) => set({ endDate: v })} />
          <NumberInput label="Участников" value={p.participants} min={1} max={1000} onChange={(v) => set({ participants: v })} />
        </div>
      </Card>
      <Card>
        <h3>Результаты (средний балл, 0–100)</h3>
        <label className="field"><span>До апробации: {Math.round(p.baselineScore)}</span><input type="range" min={0} max={100} value={p.baselineScore} onChange={(e) => set({ baselineScore: Number(e.target.value) })} /></label>
        <label className="field"><span>После апробации: {Math.round(p.finalScore)}</span><input type="range" min={0} max={100} value={p.finalScore} onChange={(e) => set({ finalScore: Number(e.target.value) })} /></label>
        <b>Прирост: {pilotGrowth(p) >= 0 ? '+' : ''}{pilotGrowth(p).toFixed(1)}%</b>
        <TextInput label="Выводы" multiline value={p.summary} onChange={(v) => set({ summary: v })} />
      </Card>
      <button className="btn primary" disabled={!p.site} onClick={() => { s.add('pilots', p); navigate(-1); }}>Сохранить</button>
    </Page>
  );
}

function PilotCard({ pilot: p }: { pilot: M.MethodologyPilot }) {
  const g = pilotGrowth(p);
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>{p.site}</b><Badge text={`${g >= 0 ? '+' : ''}${Math.round(g)}%`} color={g >= 0 ? 'var(--success)' : 'var(--danger)'} /></div>
      <span className="muted small">{p.teacherName} · {fmt.short(p.startDate)} – {fmt.short(p.endDate)} · {p.participants} уч.</span>
      <span>Средний балл: {Math.round(p.baselineScore)} → {Math.round(p.finalScore)}</span>
      {p.summary && <span>{p.summary}</span>}
    </Card>
  );
}

export function PilotRegistryScreen() {
  const s = useStore();
  const pilots = [...s.db.pilots].sort((a, b) => time(b.endDate) - time(a.endDate));
  const title = (p: M.MethodologyPilot) => s.db.methodologies.find((m) => sameId(m.id, p.methodologyID))?.title ?? 'Методика';
  const avg = pilots.length ? pilots.reduce((t, p) => t + pilotGrowth(p), 0) / pilots.length : undefined;
  const csv = () => {
    const rows = pilots.map((p) => [title(p), p.site, p.teacherName, fmt.short(p.startDate), fmt.short(p.endDate), p.participants, Math.round(p.baselineScore), Math.round(p.finalScore), pilotGrowth(p).toFixed(1)].join(';'));
    const blob = new Blob(['﻿Методика;Площадка;Педагог;Начало;Окончание;Участников;До;После;Прирост %\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'KKSU-pilot-registry.csv'; a.click();
  };
  return (
    <Page title="Реестр результатов апробации">
      <div className="grid" style={{ ['--min' as string]: '150px' }}>
        <StatTile title="Апробаций" value={pilots.length} icon="testtube.2" />
        <StatTile title="Участников" value={pilots.reduce((t, p) => t + p.participants, 0)} icon="person.3.fill" color="var(--accent)" />
        <StatTile title="Средний прирост" value={avg === undefined ? '—' : `${avg >= 0 ? '+' : ''}${Math.round(avg)}%`} icon="chart.line.uptrend.xyaxis" color="var(--success)" />
      </div>
      {pilots.length > 0 && (
        <>
          <Card><h3>Балл до апробации</h3><BarChart data={pilots.map((p) => ({ label: p.site, value: p.baselineScore }))} max={100} color="var(--text-2)" /></Card>
          <Card><h3>Балл после апробации</h3><BarChart data={pilots.map((p) => ({ label: p.site, value: p.finalScore }))} max={100} color="var(--success)" /></Card>
        </>
      )}
      {pilots.map((p) => <div key={p.id} className="stack tight"><b className="small">{title(p)}</b><PilotCard pilot={p} /></div>)}
      {pilots.length > 0 && <button className="btn" onClick={csv}>📊 Экспорт реестра в CSV</button>}
    </Page>
  );
}

// MARK: Экспертная оценка (45, 58)

export function MethodologyReviewScreen() {
  const s = useStore();
  const me = s.db.currentUserID;
  return (
    <Page title="Экспертная оценка методик">
      {s.db.methodologies.filter((m) => m.status !== 'draft').map((m) => {
        const reviewed = s.db.reviews.some((r) => sameId(r.targetID, m.id) && sameId(r.expertID, me));
        return (
          <div key={m.id} className="stack tight">
            <MethodologyCard methodology={m} link />
            {reviewed ? <span className="ok small">✅ Вы уже оценили эту методику</span>
              : <Link className="btn primary" to={routePath('methodologies', 'review/' + m.id)}>⭐ Оценить</Link>}
          </div>
        );
      })}
      {s.db.methodologies.filter((m) => m.status !== 'draft').length === 0 && <EmptyState text="Нет методик на экспертизе" icon="star" />}
    </Page>
  );
}

export function ExpertReviewForm({ targetID, target, criteria }: { targetID: string; target: M.ReviewTarget; criteria: string[] }) {
  const s = useStore();
  const navigate = useNavigate();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState<M.ReviewDecision>('approve');
  const avg = criteria.reduce((t, c) => t + (scores[c] ?? 7), 0) / Math.max(criteria.length, 1);
  return (
    <Page title="Экспертная оценка">
      <Card>
        <h3>Критерии (1–10)</h3>
        {criteria.map((c) => (
          <label key={c} className="field"><span>{c}: <b>{scores[c] ?? 7}</b></span>
            <input type="range" min={1} max={10} value={scores[c] ?? 7} onChange={(e) => setScores({ ...scores, [c]: Number(e.target.value) })} /></label>
        ))}
        <b>Средний балл: {avg.toFixed(1)}</b>
      </Card>
      <Card>
        <h3>Заключение</h3>
        <Segmented value={decision} onChange={setDecision} options={M.ReviewDecision.values.map((d) => ({ value: d, label: M.ReviewDecision.title[d] }))} />
        <TextInput label="Комментарий эксперта" multiline rows={4} value={comment} onChange={setComment} />
        <button className="btn primary" disabled={!comment || !s.db.currentUserID} onClick={() => {
          s.submitReview(M.makeExpertReview({
            targetID, target, expertID: s.db.currentUserID!, comment, decision,
            scores: criteria.map((c) => M.makeReviewScore({ criterion: c, score: scores[c] ?? 7 })),
          }));
          navigate(-1);
        }}>Отправить заключение</button>
      </Card>
    </Page>
  );
}

export function ReviewCard({ review: r }: { review: M.ExpertReview }) {
  const s = useStore();
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>{s.userName(r.expertID)}</b><b style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>{reviewAverage(r).toFixed(1)}</b></div>
      <Badge text={M.ReviewDecision.title[r.decision]} color={r.decision === 'approve' ? 'var(--success)' : r.decision === 'revise' ? 'var(--warning)' : 'var(--danger)'} />
      {r.scores.map((x) => (
        <div key={x.criterion} className="row"><span className="small" style={{ flex: 1 }}>{x.criterion}</span><div style={{ width: 100 }}><ProgressBar value={x.score / 10} /></div><span className="small">{x.score}</span></div>
      ))}
      <span>{r.comment}</span>
      <span className="muted small">{fmt.short(r.date)}</span>
    </Card>
  );
}
