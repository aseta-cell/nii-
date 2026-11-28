// Кабинеты ученика, родителя, педагога, эксперта/наставника, психолога, партнёра, администратора;
// пользователи и роли; расписание — как KKSUCabinets.swift, ParentHomeView, TeacherHomeView, LessonsView.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as M from '../core/models.gen';
import { analyze, impactMetrics, recommendations, RISK_COLOR, teacherInsights, type TeacherInsight } from '../core/analytics';
import { sameId, time, isoIn } from '../core/ids';
import { KKSURoleExtra, sessionEnd } from '../core/helpers';
import {
  Avatar, Badge, Card, DateInput, EmptyState, fmt, InfoRow, NumberInput, Page, ProgressBar, ProgressRing, RouteRow, Section, Select,
  StatTile, TextInput, Tiles, Toggle, routePath, useStore, useSub,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { CabinetHeader, DeadlineRow, EnrollmentStatusCard, ProjectCard, RecommendationRow, SessionCard, StudentRow, SubmissionSummaryRow } from './shared';
import { InternshipApplicationReviewRow, InternshipCard, InternshipEditor } from './Partners';

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
export const studentLink = (id: string) => `/student/${id}`;

// MARK: Ученик (5)

export function StudentCabinet() {
  const s = useStore();
  const me = s.role === 'student' ? s.db.currentUserID : s.visibleStudents[0]?.id;
  const simplified = s.accessibility.simplifiedInterface;
  return (
    <div className="page">
      <CabinetHeader subtitle="Учись в своём темпе" />
      {me && (() => {
        const a = analyze(me, s);
        const today = s.db.sessions.filter((x) => isToday(x.start) && x.participantIDs.some((p) => sameId(p, me))).sort((x, y) => time(x.start) - time(y.start));
        const upcoming = s.assignmentsFor(me).filter((x) => time(x.dueDate) > Date.now() && !s.submission(x.id, me)).slice(0, 3);
        return (
          <>
            <Card>
              <div className="row">
                <div className="stack tight" style={{ flex: 1 }}>
                  <b>Мой прогресс</b>
                  <span className="muted small">{a.risk === 'low' ? 'Ты отлично справляешься!' : 'Давай подтянем пару тем вместе'}</span>
                  {s.profile(me) && <Badge text={`${s.profile(me)!.xp} XP`} color="var(--accent)" />}
                </div>
                <ProgressRing progress={a.overall} />
              </div>
              <Link to={routePath('progressDashboard')}>Подробный дашборд</Link>
            </Card>
            <EnrollmentStatusCard studentID={me} />
            <Section title="Сегодня" icon="sun.max.fill" />
            {today.length === 0 ? <EmptyState text="Сегодня занятий нет" icon="cup.and.saucer" /> : today.map((x) => <SessionCard key={x.id} session={x} />)}
            <Section title="Ближайшие дедлайны" icon="clock.badge.exclamationmark" />
            {upcoming.length === 0 ? <EmptyState text="Все задания сданы 🎉" icon="checkmark.circle" /> :
              upcoming.map((x) => <DeadlineRow key={x.id} assignment={x} to={routePath('homework', `a/${x.id}/${me}`)} />)}
            {!simplified && <><Section title="Рекомендуем" icon="hand.thumbsup.fill" />{recommendations(me, s).slice(0, 3).map((r, i) => <RecommendationRow key={i} rec={r} />)}</>}
            <Card>
              <b style={{ color: 'var(--primary)' }}>✨ AI-помощник KKSU</b>
              <span className="small">Спроси, как решить задачу, или попроси объяснить тему простыми словами.</span>
              <Link to={routePath('aiAssistant')} className="bold">Открыть помощника</Link>
            </Card>
          </>
        );
      })()}
      <Section title="Быстрый доступ" icon="square.grid.2x2" />
      <Tiles routes={['schoolCourses', 'homework', 'schedule', 'tests', 'trajectory', 'portfolio', 'inventions', 'achievements']} min={simplified ? 200 : 150} />
    </div>
  );
}

// MARK: Родитель (6)

export function ParentCabinet() {
  const s = useStore();
  const children = s.visibleStudents;
  const [selected, setSelected] = useState<string>();
  const childID = selected ?? children[0]?.id;
  const teacher = s.users('teacher')[0];
  return (
    <div className="page">
      <CabinetHeader subtitle="Прогресс и безопасность вашего ребёнка" />
      {children.length === 0 ? (
        <>
          <EmptyState text="К аккаунту не привязан ни один ребёнок. Подайте заявку на обучение или попросите администратора привязать аккаунт ребёнка." icon="person.crop.circle.badge.plus" />
          <Card><RouteRow route="application" /></Card>
        </>
      ) : (
        <>
          {children.length > 1 && <div className="segmented">{children.map((c) => <button key={c.id} className={c.id === childID ? 'on' : ''} onClick={() => setSelected(c.id)}>{c.fullName}</button>)}</div>}
          {childID && <>
            <EnrollmentStatusCard studentID={childID} />
            <ParentProgress studentID={childID} />
            <Section title="Для родителя" icon="person.2.fill" />
            <Card><div className="list">
              <RouteRow route="subscriptions" subtitle="Семейная подписка на всех детей" />
              <RouteRow route="paymentHistory" subtitle="Счета, чеки и оплаты" />
              <RouteRow route="consents" subtitle="Подписать или отозвать согласия" />
              <RouteRow route="intake" subtitle="Анкета первичного поступления" />
              <RouteRow route="schedule" subtitle="Расписание занятий" />
              <RouteRow route="progressAnalysis" subtitle="Подробный анализ прогресса" />
              {teacher && <Link className="list-item" to={routePath('chat', 'u/' + teacher.id)}>💬 <span style={{ flex: 1 }}>Написать педагогу — {teacher.fullName}</span></Link>}
            </div></Card>
          </>}
        </>
      )}
    </div>
  );
}

function ParentProgress({ studentID }: { studentID: string }) {
  const s = useStore();
  const a = analyze(studentID, s);
  return (
    <>
      <Card>
        <div className="row">
          <div className="stack tight" style={{ flex: 1 }}>
            <b>{s.userName(studentID)}</b>
            <Badge text={a.risk === 'low' ? 'Стабильно' : a.risk === 'medium' ? 'Требует внимания' : 'Нужна поддержка'} color={RISK_COLOR[a.risk]} />
            <span className="small">Выполнение заданий: {fmt.pct(a.completionRate)}</span>
            {a.attendanceRate !== null && <span className="small">Посещаемость: {fmt.pct(a.attendanceRate)}</span>}
          </div>
          <ProgressRing progress={a.overall} />
        </div>
      </Card>
      <Section title="Оценки по предметам" icon="star.fill" />
      <Card>
        {a.subjects.length === 0 && <EmptyState text="Оценок пока нет" />}
        {a.subjects.map((x) => (
          <div key={x.subject} className="stack tight">
            <div className="row"><span style={{ flex: 1 }}>{x.subject}</span><b>{fmt.pct(x.average)}</b><span style={{ color: x.trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>{x.trend >= 0 ? '↗' : '↘'}</span></div>
            <ProgressBar value={x.average} />
          </div>
        ))}
      </Card>
      <Section title="Последние оценки и отзывы" icon="text.bubble.fill" />
      {s.db.submissions.filter((x) => sameId(x.studentID, studentID) && x.score !== undefined).sort((x, y) => time(y.submittedAt) - time(x.submittedAt)).slice(0, 5)
        .map((x) => <SubmissionSummaryRow key={x.id} submission={x} />)}
      {a.overdue.length > 0 && <><Section title="Просроченные задания" icon="exclamationmark.triangle.fill" />{a.overdue.map((x) => <DeadlineRow key={x.id} assignment={x} />)}</>}
      <Section title="Достижения" icon="trophy.fill" />
      <div className="row wrap">
        {s.db.achievements.filter((x) => sameId(x.userID, studentID)).map((x) => (
          <Card key={x.id} style={{ width: 130, alignItems: 'center', textAlign: 'center' }}><span style={{ fontSize: '1.6rem' }}><Icon name={x.icon} /></span><span className="tiny">{x.title}</span></Card>
        ))}
      </div>
    </>
  );
}

// MARK: Педагог (7)

export function TeacherCabinet() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 'students') return <TeacherStudents />;
  const me = s.db.currentUserID;
  const mine = s.db.sessions.filter((x) => sameId(x.teacherID, me) || s.role === 'admin');
  const today = mine.filter((x) => isToday(x.start)).sort((a, b) => time(a.start) - time(b.start));
  const myAssignments = new Set(s.db.assignments.filter((a) => sameId(a.teacherID, me) || s.role === 'admin').map((a) => a.id.toUpperCase()));
  const toGrade = s.db.submissions.filter((x) => x.status === 'submitted' && myAssignments.has(x.assignmentID.toUpperCase()));
  const pendingAI = s.db.assignments.filter((a) => a.isAIGenerated && !a.approvedByTeacher);
  const analyses = s.students.map((x) => analyze(x.id, s));
  const insights = teacherInsights(analyses, s);
  return (
    <div className="page">
      <CabinetHeader subtitle="Ваши занятия, работы и ученики" />
      <div className="grid" style={{ ['--min' as string]: '160px' }}>
        <StatTile title="Занятий сегодня" value={today.length} icon="clock.fill" />
        <StatTile title="Работ на проверку" value={toGrade.length} icon="tray.full.fill" color="var(--accent)" />
        <StatTile title="AI-заданий ждут проверки" value={pendingAI.length} icon="sparkles" color="purple" />
        <StatTile title="Учеников в зоне риска" value={analyses.filter((a) => a.risk === 'high').length} icon="exclamationmark.triangle.fill" color="var(--danger)" />
      </div>
      <Section title="Сегодня" icon="sun.max.fill" />
      {today.length === 0 ? <EmptyState text="Сегодня занятий нет" icon="cup.and.saucer" /> : today.map((x) => <SessionCard key={x.id} session={x} />)}
      {pendingAI.length > 0 && <>
        <Section title="Задания от AI — нужна ваша проверка" icon="sparkles" />
        {pendingAI.map((a) => (
          <Card key={a.id} to={routePath('aiTaskGenerator', 'review/' + a.id)}>
            <b>{a.title}</b><span className="small">Для: {a.assignedIDs.map((x) => s.userName(x)).join(', ')}</span>
            <Badge text="Не видно ученику до утверждения" color="purple" />
          </Card>
        ))}
      </>}
      <Section title="Рекомендации на основе данных" icon="lightbulb.fill" />
      {insights.slice(0, 3).map((x, i) => <InsightCard key={i} insight={x} />)}
      <Card><RouteRow route="teacherRecommendations" subtitle="Все рекомендации" /></Card>
      <Section title="Инструменты" icon="wrench.and.screwdriver.fill" />
      <Tiles routes={['courseStudio', 'grading', 'homework', 'testBuilder', 'schedule', 'aiTaskGenerator', 'teacherAI', 'progressAnalysis']} />
      <Card><RouteRow route="teacherMarketplace" subtitle="Разместите собственный курс" /></Card>
      <Link className="btn primary block" to={routePath('teacherCabinet', 'students')}>👥 Мои ученики</Link>
    </div>
  );
}

export function InsightCard({ insight }: { insight: TeacherInsight }) {
  return (
    <Card>
      <div className="row top">
        <span style={{ color: RISK_COLOR[insight.priority], fontSize: '1.3rem' }}><Icon name={insight.icon} /></span>
        <div className="stack tight"><b className="small">{insight.title}</b><span className="muted small">{insight.action}</span></div>
      </div>
    </Card>
  );
}

function TeacherStudents() {
  const s = useStore();
  const [q, setQ] = useState('');
  return (
    <Page title="Мои ученики">
      <TextInput value={q} onChange={setQ} placeholder="Поиск ученика" />
      {s.students.filter((x) => !q || x.fullName.toLowerCase().includes(q.toLowerCase())).map((x) => <StudentRow key={x.id} studentID={x.id} to={studentLink(x.id)} />)}
      {s.students.length === 0 && <EmptyState text="Учеников пока нет" icon="person.3" />}
    </Page>
  );
}

// MARK: Эксперт / наставник (8)

export function ExpertCabinet() {
  const s = useStore();
  const me = s.db.currentUserID;
  const reviewedByMe = (id: string) => s.db.reviews.some((r) => sameId(r.targetID, id) && sameId(r.expertID, me));
  const myReviews = s.db.reviews.filter((r) => sameId(r.expertID, me));
  const pendingYI = s.db.yiApplications.filter((a) => (a.status === 'submitted' || a.status === 'underReview') && !reviewedByMe(a.id));
  const pendingMethods = s.db.methodologies.filter((m) => (m.status === 'piloting' || m.status === 'reviewed') && !reviewedByMe(m.id));
  const mentored = s.db.projects.filter((p) => sameId(p.mentorID, me));
  return (
    <div className="page">
      <h1>{s.role === 'mentor' ? 'Кабинет наставника' : 'Кабинет эксперта'}</h1>
      <CabinetHeader subtitle={M.KKSURole.title[s.role]} />
      <div className="grid" style={{ ['--min' as string]: '160px' }}>
        <StatTile title="Заявок Young Inventors на экспертизу" value={pendingYI.length} icon="sparkles" color="var(--accent)" />
        <StatTile title="Методик на экспертизу" value={pendingMethods.length} icon="lightbulb.2.fill" />
        <StatTile title="Проектов под наставничеством" value={mentored.length} icon="figure.2.and.child.holdinghands" color="var(--success)" />
        <StatTile title="Выполнено экспертиз" value={myReviews.length} icon="checkmark.seal.fill" color="purple" />
      </div>
      <Section title="Очередь экспертизы" icon="tray.full.fill" />
      <Card><div className="list"><RouteRow route="yiReview" subtitle={`${pendingYI.length} заявок ожидают оценки`} /><RouteRow route="methodologyReview" subtitle={`${pendingMethods.length} методик ожидают оценки`} /></div></Card>
      <Section title="Мои проекты" icon="lightbulb.fill" />
      {mentored.length === 0 && <EmptyState text="Вы пока не назначены наставником проектов." icon="person.crop.circle.badge.questionmark" />}
      {mentored.map((p) => <ProjectCard key={p.id} project={p} />)}
      <Section title="Подопечные" icon="person.3.fill" />
      {s.visibleStudents.map((x) => <StudentRow key={x.id} studentID={x.id} to={studentLink(x.id)} />)}
    </div>
  );
}

// MARK: Психолог

export function PsychologistCabinet() {
  const s = useStore();
  return (
    <div className="page">
      <CabinetHeader subtitle="Психолого-педагогическое сопровождение" />
      <span className="muted small">Доступ к данным ученика открывается только при наличии согласия родителя на сопровождение психолога.</span>
      {s.students.map((st) => {
        const consent = [...s.db.consents].reverse().find((c) => sameId(c.studentID, st.id) && c.type === 'psychologist');
        const allowed = consent?.granted ?? false;
        const profile = s.profile(st.id);
        const q = s.db.questionnaires.find((x) => sameId(x.studentID, st.id));
        return (
          <Card key={st.id}>
            <div className="row"><div style={{ flex: 1 }}><StudentRow studentID={st.id} /></div><Badge text={allowed ? 'Согласие есть' : 'Нет согласия'} color={allowed ? 'var(--success)' : 'var(--danger)'} /></div>
            {allowed && profile && (
              <>
                {q && <><InfoRow label="Трудности (анкета)" value={q.difficulties || '—'} /><InfoRow label="Коммуникация" value={q.communication || '—'} /></>}
                <InfoRow label="Особые потребности" value={profile.specialNeeds || '—'} />
                <TextInput multiline rows={2} value={profile.supportNotes} onChange={(v) => s.update('studentProfiles', profile.id, { supportNotes: v })} placeholder="Рекомендации по сопровождению" />
                <Link to={studentLink(st.id)}>Анализ прогресса и рисков</Link>
              </>
            )}
          </Card>
        );
      })}
      {s.students.length === 0 && <EmptyState text="Учеников пока нет" />}
    </div>
  );
}

// MARK: Партнёр (94)

export function PartnerCabinet() {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  const partnerID = s.currentUser?.partnerID ?? s.db.partners[0]?.id;
  const partner = s.partner(partnerID);
  const internships = s.db.internships.filter((i) => sameId(i.partnerID, partnerID));
  const apps = s.db.internshipApplications.filter((a) => internships.some((i) => sameId(i.id, a.internshipID)));
  return (
    <div className="page">
      <CabinetHeader subtitle={partner?.name ?? 'Организация-партнёр'} />
      {partner && (
        <>
          <Card><h3>Профиль организации</h3>
            <div className="form-grid">
              <TextInput label="Название" value={partner.name} onChange={(v) => s.update('partners', partner.id, { name: v })} />
              <TextInput label="Сайт" value={partner.website} onChange={(v) => s.update('partners', partner.id, { website: v })} />
              <TextInput label="Email для связи" value={partner.email} onChange={(v) => s.update('partners', partner.id, { email: v })} />
            </div>
            <TextInput label="Описание" multiline value={partner.summary} onChange={(v) => s.update('partners', partner.id, { summary: v })} />
            <span className="muted tiny">Изменения профиля сохраняет сотрудник KKSU — данные партнёров редактируют администраторы.</span>
          </Card>
          <div className="grid" style={{ ['--min' as string]: '160px' }}>
            <StatTile title="Стажировок" value={internships.length} icon="briefcase.fill" />
            <StatTile title="Заявок учеников" value={apps.length} icon="person.crop.rectangle.stack" color="var(--accent)" />
            <StatTile title="Принято" value={apps.filter((a) => a.status === 'accepted' || a.status === 'completed').length} icon="checkmark.circle.fill" color="var(--success)" />
            <StatTile title="Кейсов" value={s.db.challenges.filter((c) => c.company === partner.name).length} icon="gearshape.2.fill" color="purple" />
          </div>
          <Section title="Стажировки" icon="briefcase.fill" actions={<button className="btn small" onClick={() => setAdding(true)}>➕ Добавить</button>} />
          {internships.map((i) => <InternshipCard key={i.id} internship={i} />)}
          <Section title="Заявки на стажировки" icon="tray.full.fill" />
          {apps.length === 0 && <EmptyState text="Заявок пока нет" />}
          {apps.map((a) => <InternshipApplicationReviewRow key={a.id} applicationID={a.id} />)}
          {adding && <InternshipEditor partnerID={partner.id} onClose={() => setAdding(false)} />}
        </>
      )}
      <Card><div className="list"><RouteRow route="impactDashboard" subtitle="Вклад партнёров в показатели KKSU" /><RouteRow route="events" /></div></Card>
    </div>
  );
}

// MARK: Администратор (9)

export function AdminPanel() {
  const s = useStore();
  const m = impactMetrics(s.db);
  const pendingApps = s.db.applications.filter((a) => a.status === 'submitted' || a.status === 'review');
  const pendingAI = s.db.assignments.filter((a) => a.isAIGenerated && !a.approvedByTeacher);
  return (
    <div className="page">
      <CabinetHeader subtitle="Управление платформой KKSU Online" />
      <div className="grid" style={{ ['--min' as string]: '160px' }}>
        <StatTile title="Пользователей" value={s.db.users.length} icon="person.3.fill" />
        <StatTile title="Учеников" value={m.students} icon="graduationcap.fill" color="var(--success)" />
        <StatTile title="Новых заявок" value={pendingApps.length} icon="doc.text.fill" color="var(--accent)" />
        <StatTile title="AI-заданий на проверке" value={pendingAI.length} icon="sparkles" color="purple" />
      </div>
      <Section title="Заявки на обучение" icon="doc.text.fill" />
      {pendingApps.length === 0 && <EmptyState text="Новых заявок нет" />}
      {pendingApps.map((a) => <ApplicationReviewCard key={a.id} app={a} />)}
      <Section title="Управление" icon="gearshape.2.fill" />
      <Card><div className="list">
        <RouteRow route="cloudSettings" subtitle="Подтверждение сотрудников, участники школы" />
        <RouteRow route="revenue" subtitle="Выручка, продажи по курсам, педагогам и программам" />
        <RouteRow route="paymentsAdmin" subtitle="Подтвердить оплаты, оформить возвраты" />
        <RouteRow route="users" subtitle="Роли, блокировка, привязка детей" />
        <RouteRow route="moderation" subtitle={s.openReports.length ? `Новых жалоб: ${s.openReports.length}` : 'Новых жалоб нет'} />
        <RouteRow route="analytics" subtitle="Единая аналитика KKSU" />
        <RouteRow route="impactReport" subtitle="Сформировать отчёт" />
        <RouteRow route="programs" subtitle="Каталог программ" />
        <RouteRow route="partners" subtitle="Партнёры и стажировки" />
        <RouteRow route="events" subtitle="Мероприятия и сертификаты" />
        <RouteRow route="featureMap" subtitle="Статус всех модулей" />
      </div></Card>
    </div>
  );
}

function ApplicationReviewCard({ app }: { app: M.EnrollmentApplication }) {
  const s = useStore();
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>{app.childName}</b><Badge text={M.ApplicationStatus.title[app.status]} color="var(--accent)" /></div>
      <span className="muted small">{app.childAge} лет · {s.program(app.programID)?.title ?? 'Программа не выбрана'} · {M.LearningFormat.title[app.format]}</span>
      <span className="small">Родитель: {app.parentName}, {app.email}, {app.phone}</span>
      {app.comment && <span>{app.comment}</span>}
      <Select label="Статус" value={app.status} onChange={(status) => {
        s.update('applications', app.id, { status });
        if (app.applicantUserID) { s.notify(app.applicantUserID, `Статус заявки: ${M.ApplicationStatus.title[status]}`, app.childName, 'system'); s.changed(); }
      }} options={M.ApplicationStatus.values.map((x) => ({ value: x, label: M.ApplicationStatus.title[x] }))} />
    </Card>
  );
}

// MARK: Пользователи и роли (2–4)

export function UsersScreen() {
  const s = useStore();
  const sub = useSub();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<M.KKSURole | ''>('');
  if (sub[0]) return <UserEditor userID={sub[0]} />;
  return (
    <Page title="Пользователи и роли">
      <div className="form-grid">
        <TextInput value={q} onChange={setQ} placeholder="Имя или email" />
        <Select value={role} onChange={setRole} options={[{ value: '', label: 'Все роли' }, ...M.KKSURole.values.map((r) => ({ value: r, label: M.KKSURole.title[r] }))]} />
      </div>
      {M.KKSURole.values.filter((r) => !role || r === role).map((r) => {
        const users = s.db.users.filter((u) => u.role === r && (!q || u.fullName.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())));
        if (!users.length) return null;
        return (
          <Card key={r}><b>{M.KKSURole.title[r]} · {users.length}</b>
            <div className="list">{users.map((u) => (
              <Link key={u.id} className="list-item" to={routePath('users', u.id)}>
                <Avatar name={u.fullName} size={34} />
                <span className="stack tight" style={{ flex: 1 }}><span>{u.fullName}</span><span className="muted small">{u.email || '—'}</span></span>
                {u.isBlocked && <span title="Заблокирован">🔒</span>}
              </Link>
            ))}</div>
          </Card>
        );
      })}
    </Page>
  );
}

function UserEditor({ userID }: { userID: string }) {
  const s = useStore();
  const u = s.user(userID);
  const member = s.members.find((m) => sameId(m.user_id, userID));
  const [role, setRole] = useState<M.KKSURole>(u?.role ?? 'student');
  const [blocked, setBlocked] = useState(member?.blocked ?? u?.isBlocked ?? false);
  const [saved, setSaved] = useState('');
  if (!u) return <Page title="Пользователь"><EmptyState text="Пользователь не найден" /></Page>;
  const isMe = sameId(u.id, s.db.currentUserID);
  return (
    <Page title={u.fullName}>
      <Card><h3>Данные</h3>
        <TextInput label="ФИО" value={u.fullName} onChange={(v) => s.update('users', u.id, { fullName: v })} />
        <InfoRow label="Email" value={u.email || 'скрыт (виден только владельцу)'} />
        <InfoRow label="Зарегистрирован" value={fmt.short(u.createdAt)} />
        <InfoRow label="Последний вход" value={fmt.dateTime(u.lastLogin)} />
        {member && <InfoRow label="Подтверждён на сервере" value={member.approved ? 'да' : 'нет'} />}
      </Card>
      <Card><h3>Роль и доступ</h3>
        <Select label="Роль" value={role} onChange={setRole} options={M.KKSURole.values.map((r) => ({ value: r, label: M.KKSURole.title[r] }))} />
        <Toggle label="Заблокирован" checked={blocked} onChange={setBlocked} />
        {isMe ? <span className="muted small">Свою роль и доступ изменить нельзя.</span> : (
          <button className="btn primary" onClick={async () => {
            try { await s.updateMember(u.id, { role, approved: !blocked, blocked }); setSaved('Сохранено на сервере'); } catch (e) { setSaved((e as Error).message); }
          }}>Сохранить роль и доступ</button>
        )}
        {saved && <span className="small">{saved}</span>}
      </Card>
      {(u.role === 'parent' || u.role === 'mentor') && (
        <Card><h3>{u.role === 'parent' ? 'Дети' : 'Подопечные'}</h3>
          {s.students.map((st) => <Toggle key={st.id} label={st.fullName} checked={u.linkedStudentIDs.some((x) => sameId(x, st.id))}
            onChange={(on) => s.update('users', u.id, { linkedStudentIDs: on ? [...u.linkedStudentIDs, st.id] : u.linkedStudentIDs.filter((x) => !sameId(x, st.id)) })} />)}
          {s.students.length === 0 && <span className="muted">Учеников пока нет</span>}
        </Card>
      )}
      {u.role === 'partner' && (
        <Card><h3>Организация</h3>
          <Select value={u.partnerID ?? ''} onChange={(v) => s.update('users', u.id, { partnerID: v || undefined })}
            options={[{ value: '', label: '—' }, ...s.db.partners.map((p) => ({ value: p.id, label: p.name }))]} />
        </Card>
      )}
      {u.role === 'student' && !s.profile(u.id) && <button className="btn" onClick={() => s.add('studentProfiles', M.makeStudentProfile({ userID: u.id }))}>Создать профиль ученика</button>}
    </Page>
  );
}

// MARK: Расписание и онлайн-занятия (17, 33)

export function ScheduleScreen({ onlyOnline = false }: { onlyOnline?: boolean }) {
  const s = useStore();
  const sub = useSub();
  const [week, setWeek] = useState(0);
  if (sub[0] === 'new') return <SessionEditor />;
  if (sub[0] === 'attendance' && sub[1]) return <Attendance sessionID={sub[1]} />;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + week * 7);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const me = s.currentUser;
  const sessionsOn = (d: Date) => s.db.sessions.filter((x) => {
    if (new Date(x.start).toDateString() !== d.toDateString()) return false;
    if (onlyOnline && !x.isOnline) return false;
    if (me?.role === 'student') return x.participantIDs.some((p) => sameId(p, me.id));
    if (me?.role === 'parent') return x.participantIDs.some((p) => me.linkedStudentIDs.some((c) => sameId(c, p)));
    if (me?.role === 'teacher') return sameId(x.teacherID, me.id);
    return true;
  }).sort((a, b) => time(a.start) - time(b.start));
  return (
    <Page title={onlyOnline ? 'Онлайн-занятия' : 'Расписание'}>
      <div className="row"><button className="btn" onClick={() => setWeek(week - 1)} aria-label="Предыдущая неделя">‹</button>
        <b style={{ flex: 1, textAlign: 'center' }}>{fmt.short(days[0].toISOString())} — {fmt.short(days[6].toISOString())}</b>
        <button className="btn" onClick={() => setWeek(week + 1)} aria-label="Следующая неделя">›</button></div>
      {KKSURoleExtra.canTeach(s.role) && <Link className="btn primary" to={routePath(onlyOnline ? 'onlineLessons' : 'schedule', 'new')}>➕ Запланировать занятие</Link>}
      {days.map((d) => {
        const list = sessionsOn(d);
        const isNow = d.toDateString() === new Date().toDateString();
        return (
          <div key={d.toISOString()} className="stack">
            <b style={{ color: isNow ? 'var(--primary)' : 'var(--text-2)' }}>{d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            {list.length === 0 ? <span className="muted tiny">Нет занятий</span> : list.map((x) => <SessionCard key={x.id} session={x} />)}
          </div>
        );
      })}
    </Page>
  );
}

function Attendance({ sessionID }: { sessionID: string }) {
  const s = useStore();
  const x = s.db.sessions.find((y) => sameId(y.id, sessionID));
  if (!x) return <Page title="Посещаемость"><EmptyState text="Занятие не найдено" /></Page>;
  return (
    <Page title={x.title} subtitle={`${fmt.dateTime(x.start)}–${fmt.time(sessionEnd(x).toISOString())}`}>
      <Card><h3>Отметьте присутствующих</h3>
        {x.participantIDs.map((p) => <Toggle key={p} label={s.userName(p)} checked={x.attendedIDs.some((a) => sameId(a, p))}
          onChange={(on) => s.update('sessions', x.id, { attendedIDs: on ? [...x.attendedIDs, p] : x.attendedIDs.filter((a) => !sameId(a, p)) })} />)}
      </Card>
      <Card><h3>Запись занятия</h3><TextInput value={x.recordingURL} onChange={(v) => s.update('sessions', x.id, { recordingURL: v })} placeholder="Ссылка на запись" /></Card>
    </Page>
  );
}

function SessionEditor() {
  const s = useStore();
  const navigate = useNavigate();
  const [x, setX] = useState(() => M.makeScheduleSession({ title: '', subject: '', start: isoIn(86400) }));
  const [weeks, setWeeks] = useState(1);
  const set = (patch: Partial<M.ScheduleSession>) => setX({ ...x, ...patch });
  return (
    <Page title="Новое занятие">
      <Card><h3>Занятие</h3>
        <div className="form-grid">
          <TextInput label="Тема" value={x.title} onChange={(v) => set({ title: v })} />
          <TextInput label="Предмет" value={x.subject} onChange={(v) => set({ subject: v })} />
          <DateInput label="Начало" value={x.start} onChange={(v) => set({ start: v })} />
          <NumberInput label="Длительность, мин" value={x.durationMinutes} min={15} max={180} step={5} onChange={(v) => set({ durationMinutes: v })} />
          <NumberInput label="Повторять недель" value={weeks} min={1} max={36} onChange={setWeeks} />
        </div>
      </Card>
      <Card><h3>Формат</h3>
        <Toggle label="Онлайн" checked={x.isOnline} onChange={(v) => set({ isOnline: v })} />
        {x.isOnline ? (
          <>
            <Select label="Платформа" value={x.platform} onChange={(v) => set({ platform: v })} options={M.ConferencePlatform.values.map((p) => ({ value: p, label: M.ConferencePlatform.title[p] }))} />
            {x.platform === 'jitsi' && <span className="muted small">Комната Jitsi Meet будет создана автоматически.</span>}
            <TextInput label="Ссылка на конференцию" value={x.meetingURL} onChange={(v) => set({ meetingURL: v })} />
          </>
        ) : <TextInput label="Кабинет" value={x.room} onChange={(v) => set({ room: v })} />}
      </Card>
      <Card><h3>Участники</h3>
        {s.students.map((st) => <Toggle key={st.id} label={st.fullName} checked={x.participantIDs.includes(st.id)} onChange={(on) => set({ participantIDs: on ? [...x.participantIDs, st.id] : x.participantIDs.filter((p) => p !== st.id) })} />)}
        {s.students.length === 0 && <span className="muted">Учеников пока нет</span>}
      </Card>
      <button className="btn primary" disabled={!x.title || x.participantIDs.length === 0} onClick={() => {
        for (let w = 0; w < weeks; w++) {
          const start = new Date(new Date(x.start).getTime() + w * 7 * 86400000).toISOString();
          s.db.sessions.push({ ...x, id: M.makeScheduleSession({ title: '', subject: '', start }).id, start, teacherID: s.db.currentUserID });
        }
        for (const p of x.participantIDs) s.notify(p, 'Новое занятие в расписании', `${x.title} — ${fmt.dateTime(x.start)}`, 'event');
        s.changed();
        navigate(-1);
      }}>Сохранить</button>
    </Page>
  );
}
