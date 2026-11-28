// Global Classroom (60–63), Future Engineers (64–67), ARAI AI / IKEN / ATA MURA / Inclusive (68–72) — как KKSUGlobalAndEngineering.swift.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as M from '../core/models.gen';
import { impactMetrics } from '../core/analytics';
import { KKSURoleExtra } from '../core/helpers';
import { sameId, time, isoIn } from '../core/ids';
import {
  AttachmentPicker, Avatar, Badge, Card, DateInput, EmptyState, fmt, Modal, Page, ProgressBar, RouteRow, Section, StatTile, TextInput, Tiles,
  routePath, useStore, useSub,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { PaywallCard, PriceBadge, ProjectCard, StageProgress } from './shared';

// MARK: Global Classroom (60)

export function GlobalClassroomScreen() {
  const s = useStore();
  const m = impactMetrics(s.db);
  const next = s.db.globalClasses.filter((g) => time(g.start) > Date.now()).sort((a, b) => time(a.start) - time(b.start))[0];
  return (
    <Page title="Global Classroom">
      <Card><h2>🌍 Global Classroom</h2><span>Международные онлайн-классы, совместные проекты со школами других стран и лекции зарубежных экспертов.</span></Card>
      <div className="grid" style={{ ['--min' as string]: '140px' }}>
        <StatTile title="Стран" value={m.countries} icon="flag.fill" />
        <StatTile title="Онлайн-классов" value={m.globalClasses} icon="video.bubble.fill" color="var(--accent)" />
        <StatTile title="Совместных проектов" value={m.internationalProjects} icon="globe" color="var(--success)" />
        <StatTile title="Экспертов" value={m.internationalExperts} icon="person.crop.square.filled.and.at.rectangle" color="purple" />
      </div>
      <Tiles routes={['globalClasses', 'internationalProjects', 'internationalExperts']} />
      {next && <Section title="Ближайший класс" icon="calendar"><GlobalClassCard globalClass={next} /></Section>}
    </Page>
  );
}

// MARK: Международные онлайн-классы (61)

export function GlobalClassesScreen() {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  return (
    <Page title="Международные онлайн-классы">
      {[...s.db.globalClasses].sort((a, b) => time(a.start) - time(b.start)).map((g) => <GlobalClassCard key={g.id} globalClass={g} />)}
      {s.db.globalClasses.length === 0 && <EmptyState text="Классов пока нет" icon="video" />}
      {KKSURoleExtra.canTeach(s.role) && <button className="btn outline" onClick={() => setAdding(true)}>➕ Новый международный класс</button>}
      {adding && <GlobalClassEditor onClose={() => setAdding(false)} />}
    </Page>
  );
}

function GlobalClassCard({ globalClass: g }: { globalClass: M.GlobalClass }) {
  const s = useStore();
  const me = s.db.currentUserID;
  const joined = !!me && g.participantIDs.some((x) => sameId(x, me));
  const url = g.meetingURL || `https://meet.jit.si/KKSU-Global-${g.id.slice(0, 8)}`;
  const product = s.productForRef(g.id);
  return (
    <Card>
      <div className="row wrap"><b style={{ flex: 1 }}>{g.title}</b><PriceBadge product={product} /><Badge text={g.country} /></div>
      <span className="muted small">{g.partnerSchool} · {g.teacherName} · язык: {g.language}</span>
      <span>{g.summary}</span>
      <span className="small">{fmt.dateTime(g.start)}</span>
      <div className="row wrap">
        {s.role === 'student' && !joined && product && !s.hasAccessToRef(me, g.id)
          ? <PaywallCard product={product} message="Международная программа Global Classroom. Вы будете записаны автоматически после подтверждения оплаты." />
          : s.role === 'student' && !joined && me
            ? <button className="btn primary" onClick={() => { s.update('globalClasses', g.id, (x) => ({ ...x, participantIDs: [...x.participantIDs, me] })); s.log(me, 'Запись в Global Classroom', g.title, 'globe'); }}>Записаться</button>
            : joined ? <Badge text="Вы участник" color="var(--success)" /> : null}
        <span className="spacer" />
        <a className="btn" href={url} target="_blank" rel="noopener noreferrer">🎥 Подключиться</a>
      </div>
    </Card>
  );
}

function GlobalClassEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [g, setG] = useState(() => M.makeGlobalClass({ title: '', country: '', language: 'English', partnerSchool: '', teacherName: '', start: isoIn(7 * 86400), summary: '' }));
  const set = (patch: Partial<M.GlobalClass>) => setG({ ...g, ...patch });
  return (
    <Modal title="Международный класс" onClose={onClose}>
      <TextInput label="Тема класса" value={g.title} onChange={(v) => set({ title: v })} />
      <div className="form-grid">
        <TextInput label="Страна партнёра" value={g.country} onChange={(v) => set({ country: v })} />
        <TextInput label="Школа-партнёр" value={g.partnerSchool} onChange={(v) => set({ partnerSchool: v })} />
        <TextInput label="Преподаватель" value={g.teacherName} onChange={(v) => set({ teacherName: v })} />
        <TextInput label="Язык" value={g.language} onChange={(v) => set({ language: v })} />
        <DateInput label="Дата и время" value={g.start} onChange={(v) => set({ start: v })} />
      </div>
      <TextInput label="Ссылка (пусто — комната Jitsi создастся автоматически)" value={g.meetingURL} onChange={(v) => set({ meetingURL: v })} />
      <TextInput label="Описание" multiline value={g.summary} onChange={(v) => set({ summary: v })} />
      <button className="btn primary" disabled={!g.title || !g.country} onClick={() => { s.add('globalClasses', g); onClose(); }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Совместные международные проекты (62)

export function InternationalProjectsScreen() {
  const s = useStore();
  const [f, setF] = useState({ title: '', countries: '', partners: '', summary: '' });
  const me = s.db.currentUserID;
  const consent = !!me && ([...s.db.consents].reverse().find((c) => sameId(c.studentID, me) && c.type === 'international')?.granted ?? false);
  return (
    <Page title="Международные проекты">
      {s.db.internationalProjects.map((p) => (
        <Card key={p.id}>
          <div className="row"><b style={{ flex: 1 }}>{p.title}</b><Badge text={p.isActive ? 'Активен' : 'Завершён'} color={p.isActive ? 'var(--success)' : 'var(--text-2)'} /></div>
          <span className="small" style={{ color: 'var(--primary)' }}>{p.countries.join(' · ')}</span>
          <span className="muted small">Партнёры: {p.partners}</span>
          <span>{p.summary}</span>
          <span className="small">Участники KKSU: {p.participantIDs.map((x) => s.userName(x)).join(', ')}</span>
          {me && s.role === 'student' && !p.participantIDs.some((x) => sameId(x, me)) && (
            <>
              <button className="btn primary" disabled={!consent} onClick={() => s.update('internationalProjects', p.id, (x) => ({ ...x, participantIDs: [...x.participantIDs, me] }))}>Присоединиться</button>
              {!consent && <span className="small" style={{ color: 'var(--danger)' }}>Нужно согласие родителя на участие в международных проектах.</span>}
            </>
          )}
        </Card>
      ))}
      <Card><div className="list"><RouteRow route="inventions" subtitle="Проекты Global Classroom в KKSU Inventions" /></div></Card>
      {KKSURoleExtra.canTeach(s.role) && (
        <Card>
          <h3>Новый международный проект</h3>
          <TextInput label="Название" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
          <TextInput label="Страны через запятую" value={f.countries} onChange={(v) => setF({ ...f, countries: v })} />
          <TextInput label="Организации-партнёры" value={f.partners} onChange={(v) => setF({ ...f, partners: v })} />
          <TextInput label="Описание" multiline value={f.summary} onChange={(v) => setF({ ...f, summary: v })} />
          <button className="btn primary" disabled={!f.title || !f.countries} onClick={() => {
            const countries = f.countries.split(',').map((x) => x.trim()).filter(Boolean);
            s.add('internationalProjects', M.makeInternationalProject({ title: f.title, countries, partners: f.partners, summary: f.summary }));
            setF({ title: '', countries: '', partners: '', summary: '' });
          }}>Создать</button>
        </Card>
      )}
    </Page>
  );
}

// MARK: Международные преподаватели и эксперты (63)

export function InternationalExpertsScreen() {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'teachers' | 'experts'>('all');
  const list = s.db.internationalExperts.filter((e) => filter === 'all' || e.isTeacher === (filter === 'teachers'));
  return (
    <Page title="Международные эксперты">
      <div className="chips">
        {([['all', 'Все'], ['teachers', 'Преподаватели'], ['experts', 'Эксперты']] as const).map(([v, l]) => (
          <button key={v} className={'chip' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      {list.map((e) => (
        <Card key={e.id}>
          <div className="row"><Avatar name={e.name} size={48} />
            <div className="stack tight" style={{ flex: 1 }}><b>{e.name}</b><span className="muted small">{e.country} · {e.expertise}</span></div>
            <Badge text={e.isTeacher ? 'Преподаватель' : 'Эксперт'} /></div>
          <span>{e.bio}</span>
          {e.email && <a className="small" href={`mailto:${e.email}`}>✉️ {e.email}</a>}
        </Card>
      ))}
      {list.length === 0 && <EmptyState text="Пока никого нет" icon="person" />}
    </Page>
  );
}

// MARK: Future Engineers (64)

export function FutureEngineersScreen() {
  const s = useStore();
  const me = s.db.currentUserID;
  const done = me ? s.db.challenges.filter((c) => c.completedIDs.some((x) => sameId(x, me))) : [];
  return (
    <Page title="Future Engineers">
      <Card><h2>🛠️ Future Engineers</h2><span>Инженерная школа KKSU: онлайн-курсы, виртуальные задания, индустриальные кейсы и проекты партнёров.</span></Card>
      <Tiles routes={['engineeringCourses', 'challenges', 'mashstroyCases', 'araiAI', 'iken', 'ataMura', 'inclusiveEngineering', 'inclusiveCatalog']} />
      {me && (
        <Card>
          <h3>Мой инженерный рейтинг</h3>
          <b style={{ fontSize: '1.8rem', color: 'var(--accent)' }}>{done.reduce((t, c) => t + c.points, 0)} баллов</b>
          <span className="small">Выполнено заданий: {done.length} из {s.db.challenges.length}</span>
        </Card>
      )}
    </Page>
  );
}

// MARK: Инженерные онлайн-курсы (65)

export function EngineeringCoursesScreen() {
  const s = useStore();
  return (
    <Page title="Инженерные онлайн-курсы">
      {s.db.engineeringCourses.map((c) => <EngineeringCourseCard key={c.id} course={c} />)}
      {s.db.engineeringCourses.length === 0 && <EmptyState text="Курсов пока нет" icon="book" />}
    </Page>
  );
}

function EngineeringCourseCard({ course }: { course: M.EngineeringCourse }) {
  const s = useStore();
  const me = s.db.currentUserID;
  const enrolled = !!me && course.enrolledIDs.some((x) => sameId(x, me));
  const product = s.productForRef(course.id);
  return (
    <Card>
      <div className="row wrap"><Icon name={M.ProjectTrack.icon[course.track]} /><b style={{ flex: 1 }}>{course.title}</b><PriceBadge product={product} /><Badge text={course.level} /></div>
      <span className="small" style={{ color: 'var(--primary)' }}>{M.ProjectTrack.title[course.track]}</span>
      <span>{course.summary}</span>
      <details><summary>Уроки ({course.lessons.length})</summary><ol>{course.lessons.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
      {enrolled ? <Badge text="Вы записаны" color="var(--success)" />
        : s.role === 'student' && product && !s.hasAccessToRef(me, course.id)
          ? <PaywallCard product={product} message="Платная программа Future Engineers. Курс откроется автоматически после подтверждения оплаты." />
          : me && s.role === 'student'
            ? <button className="btn primary" onClick={() => { s.update('engineeringCourses', course.id, (x) => ({ ...x, enrolledIDs: [...x.enrolledIDs, me] })); s.log(me, 'Запись на инженерный курс', course.title, 'book.and.wrench'); }}>Записаться на курс</button>
            : null}
    </Card>
  );
}

// MARK: Виртуальные задания и кейсы (66, 67)

export function ChallengesScreen({ track, industryOnly }: { track?: M.ProjectTrack; industryOnly?: boolean }) {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 'c' && sub[1]) return <ChallengeDetail challengeID={sub[1]} />;
  const items = s.db.challenges.filter((c) => (!track || c.track === track) && (!industryOnly || c.isIndustryCase));
  return (
    <Page title={industryOnly ? `Проектные кейсы ${track ? M.ProjectTrack.title[track] : ''}` : 'Виртуальные инженерные задания'}>
      {industryOnly && <span className="muted">Реальные производственные задачи от инженеров партнёра. Решения оцениваются специалистами компании.</span>}
      {items.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
      {items.length === 0 && <EmptyState text="Заданий пока нет" icon="puzzlepiece" />}
    </Page>
  );
}

export const MashstroyCasesScreen = () => <ChallengesScreen track="mashstroy" industryOnly />;

export function ChallengeCard({ challenge: c, link = true }: { challenge: M.EngineeringChallenge; link?: boolean }) {
  const s = useStore();
  const me = s.db.currentUserID;
  const content = (
    <>
      <div className="row"><b style={{ flex: 1 }}>{c.title}</b>{me && c.completedIDs.some((x) => sameId(x, me)) && <span title="Выполнено">✅</span>}</div>
      <div className="row wrap">
        {c.isIndustryCase && <Badge text={`Кейс ${c.company}`} color="var(--accent)" />}
        <Badge text={M.ProjectTrack.title[c.track]} />
        <span className="small" aria-label={`Сложность ${c.difficulty} из 5`}>{'★'.repeat(c.difficulty)}{'☆'.repeat(Math.max(0, 5 - c.difficulty))}</span>
        <span className="spacer" /><b className="small">+{c.points}</b>
      </div>
      <span>{c.summary}</span>
    </>
  );
  return link ? <Card to={routePath('challenges', 'c/' + c.id)}>{content}</Card> : <Card>{content}</Card>;
}

function ChallengeDetail({ challengeID }: { challengeID: string }) {
  const s = useStore();
  const [done, setDone] = useState<Set<number>>(new Set());
  const [solution, setSolution] = useState('');
  const [attachments, setAttachments] = useState<M.Attachment[]>([]);
  const c = s.db.challenges.find((x) => sameId(x.id, challengeID));
  if (!c) return <Page title="Задание"><EmptyState text="Задание не найдено" /></Page>;
  const me = s.db.currentUserID;
  const completed = !!me && c.completedIDs.some((x) => sameId(x, me));
  const toggle = (i: number) => { const n = new Set(done); if (n.has(i)) n.delete(i); else n.add(i); setDone(n); };
  return (
    <Page title={c.title}>
      <ChallengeCard challenge={c} link={false} />
      <Card>
        <h3>Шаги выполнения</h3>
        {c.steps.map((step, i) => (
          <label key={i} className="row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={done.has(i) || completed} disabled={completed} onChange={() => toggle(i)} />
            <span>{i + 1}. {step}</span>
          </label>
        ))}
        <ProgressBar value={completed ? 1 : done.size / Math.max(c.steps.length, 1)} />
      </Card>
      {completed ? <span className="ok">✅ Задание выполнено! +{c.points} баллов</span>
        : me && s.role === 'student' && (
          <Card>
            <h3>Решение</h3>
            <TextInput multiline rows={5} value={solution} onChange={setSolution} placeholder="Опишите решение, расчёты, выводы" />
            <AttachmentPicker attachments={attachments} onChange={setAttachments} />
            <button className="btn primary" disabled={done.size < c.steps.length || !solution} onClick={() => {
              s.update('challenges', c.id, (x) => ({ ...x, completedIDs: [...x.completedIDs, me] }));
              s.add('portfolio', M.makePortfolioItem({ studentID: me, title: c.title, category: c.isIndustryCase ? 'Индустриальный кейс' : 'Инженерное задание', summary: solution, attachments }));
              s.award(me, `Инженер: ${c.title}`, 'wrench.and.screwdriver.fill', c.points);
              s.log(me, 'Выполнено инженерное задание', c.title, 'puzzlepiece.extension');
            }}>Отправить решение</button>
            {done.size < c.steps.length && <span className="muted small">Отметьте все шаги, чтобы отправить решение.</span>}
          </Card>
        )}
    </Page>
  );
}

// MARK: ARAI AI, IKEN, ATA MURA, Inclusive Engineering (68–71)

const TRACK_PARTNER: Partial<Record<M.ProjectTrack, string>> = { araiAI: 'ARAI AI', iken: 'IKEN', ataMura: 'ATA MURA', mashstroy: 'MASHSTROY' };

export function TrackHubScreen({ track }: { track: M.ProjectTrack }) {
  const s = useStore();
  const projects = s.db.projects.filter((p) => p.track === track);
  const courses = s.db.engineeringCourses.filter((c) => c.track === track);
  const challenges = s.db.challenges.filter((c) => c.track === track);
  const partner = TRACK_PARTNER[track] ? s.db.partners.find((p) => p.name === TRACK_PARTNER[track]) : undefined;
  return (
    <Page title={M.ProjectTrack.title[track]}>
      <Card>
        <h2 className="row"><Icon name={M.ProjectTrack.icon[track]} /> {M.ProjectTrack.title[track]}</h2>
        <span>{M.ProjectTrack.summary[track]}</span>
        {partner && <><span className="muted">{partner.summary}</span>{partner.website && <a className="small" href={partner.website} target="_blank" rel="noopener noreferrer">🧭 {partner.website}</a>}</>}
      </Card>
      {track === 'araiAI' && <ARAIIntegrationCard />}
      {track === 'inclusiveEngineering' && (
        <>
          <Card><h3>Принципы инклюзивной инженерии</h3>
            {['Проектируй вместе с пользователем', 'Универсальный дизайн: удобно всем', 'Доступная стоимость и ремонтопригодность', 'Тестирование с людьми с инвалидностью'].map((x) => <span key={x}>✔️ {x}</span>)}
          </Card>
          <Card><div className="list"><RouteRow route="inclusiveCatalog" subtitle="Все инклюзивные разработки KKSU" /></div></Card>
        </>
      )}
      <Section title={`Проекты · ${projects.length}`} icon="lightbulb.fill" />
      {projects.length === 0 && <EmptyState text="Проектов пока нет — создайте первый!" icon="lightbulb" />}
      {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
      <Link to={routePath('inventions', 'track/' + track)}>➕ Все проекты и создание нового</Link>
      {courses.length > 0 && <Section title="Курсы" icon="book.and.wrench.fill">{courses.map((c) => <EngineeringCourseCard key={c.id} course={c} />)}</Section>}
      {challenges.length > 0 && <Section title="Задания" icon="puzzlepiece.extension.fill">{challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}</Section>}
    </Page>
  );
}

export const AraiAIScreen = () => <TrackHubScreen track="araiAI" />;
export const IkenScreen = () => <TrackHubScreen track="iken" />;
export const AtaMuraScreen = () => <TrackHubScreen track="ataMura" />;
export const InclusiveEngineeringScreen = () => <TrackHubScreen track="inclusiveEngineering" />;

function ARAIIntegrationCard() {
  return (
    <Card>
      <h3>Интеграция ARAI AI</h3>
      <span>AI-сервисы для проектов учеников: распознавание изображений, чат-боты, анализ данных. На платформе KKSU AI-модули подключаются через единый AI-шлюз (см. AI-помощник).</span>
      {[['📷', 'Компьютерное зрение', 'Распознавание объектов для роботов'], ['💬', 'Диалоговые боты', 'Боты-помощники для школьных сервисов'], ['📈', 'Анализ данных', 'Обработка измерений из лабораторной тетради']].map(([i, t, d]) => (
        <div key={t} className="row top"><span style={{ width: 28 }}>{i}</span><div className="stack tight"><b className="small">{t}</b><span className="muted small">{d}</span></div></div>
      ))}
      <span className="small">🟡 В веб-версии работает локальный AI-режим.</span>
      <Link to={routePath('aiAssistant')}>✨ Открыть AI-помощника</Link>
    </Card>
  );
}

// MARK: Каталог инклюзивных разработок (72)

export function InclusiveCatalogScreen() {
  const s = useStore();
  const [target, setTarget] = useState('');
  const items = s.db.projects.filter((p) => p.track === 'inclusiveEngineering' || p.inclusiveTarget);
  const challenges = s.db.challenges.filter((c) => c.track === 'inclusiveEngineering');
  const targets = [...new Set(items.map((p) => p.inclusiveTarget).filter(Boolean))].sort();
  return (
    <Page title="Каталог инклюзивных разработок">
      <span className="muted">Инженерные решения учеников KKSU для людей с особыми потребностями: вспомогательные устройства, адаптированная среда, цифровые сервисы.</span>
      {targets.length > 0 && (
        <div className="chips">
          <button className={'chip' + (!target ? ' on' : '')} onClick={() => setTarget('')}>Все</button>
          {targets.map((t) => <button key={t} className={'chip' + (target === t ? ' on' : '')} onClick={() => setTarget(t)}>{t}</button>)}
        </div>
      )}
      {items.filter((p) => !target || p.inclusiveTarget === target).map((p) => (
        <Card key={p.id} to={routePath('inventions', 'p/' + p.id)}>
          <b>♿ {p.title}</b>
          {p.inclusiveTarget && <Badge text={`Для: ${p.inclusiveTarget}`} color="purple" />}
          <span>{p.summary}</span>
          {p.solution && <span className="small">Решение: {p.solution}</span>}
          <StageProgress stage={p.stage} />
        </Card>
      ))}
      {items.length === 0 && <EmptyState text="Разработок пока нет" icon="figure.roll" />}
      {challenges.length > 0 && <Section title="Инклюзивные инженерные задания" icon="puzzlepiece.extension">{challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}</Section>}
    </Page>
  );
}
