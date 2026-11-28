// KKSU Inventions (47–55), Young Inventors 30 (56–58), виртуальная выставка (59) — как KKSUInventions.swift.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as M from '../core/models.gen';
import { KKSURoleExtra, PROJECT_CRITERIA, nextStage, reviewAverage, stageIndex } from '../core/helpers';
import { nowISO, sameId, time } from '../core/ids';
import {
  AttachmentPicker, AttachmentRow, Avatar, Badge, Card, EmptyState, fmt, InfoRow, Modal, Page, RouteRow, RouteTile, Section, Segmented, Select,
  StatTile, TextInput, Toggle, routePath, useStore, useSub,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { PaywallGate, ProjectCard, StageProgress } from './shared';
import { ExpertReviewForm, ReviewCard } from './Academy';
import { ReportDialog, type ReportTarget } from './Communication';

const YI_FEE = 'Регистрационный взнос Young Inventors 30';

// MARK: Список проектов (47)

export function InventionsScreen() {
  const sub = useSub();
  if (sub[0] === 'p' && sub[1] && sub[2] === 'review') return <ExpertReviewForm targetID={sub[1]} target="project" criteria={PROJECT_CRITERIA} />;
  if (sub[0] === 'p' && sub[1]) return <ProjectDetail projectID={sub[1]} />;
  const track = sub[0] === 'track' && M.ProjectTrack.values.includes(sub[1] as M.ProjectTrack) ? (sub[1] as M.ProjectTrack) : undefined;
  return <InventionsList track={track} />;
}

function InventionsList({ track }: { track?: M.ProjectTrack }) {
  const s = useStore();
  const [stage, setStage] = useState<M.ProjectStage | ''>('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const me = s.db.currentUserID;
  const projects = s.db.projects.filter((p) => (!track || p.track === track) && (!stage || p.stage === stage)
    && (!onlyMine || (!!me && (p.authorIDs.some((a) => sameId(a, me)) || sameId(p.mentorID, me)))))
    .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  return (
    <Page title={track ? M.ProjectTrack.title[track] : 'KKSU Inventions'}>
      {!track && <Card><b>💡 Изобретения учеников KKSU</b><span>Каждый проект проходит путь Idea → Research → Prototype → Testing → Result с наставником, журналом экспериментов и лабораторной тетрадью.</span></Card>}
      <StageFunnel projects={projects} />
      <div className="chips">
        <button className={'chip' + (!stage ? ' on' : '')} onClick={() => setStage('')}>Все стадии</button>
        {M.ProjectStage.values.map((x) => <button key={x} className={'chip' + (stage === x ? ' on' : '')} onClick={() => setStage(x)}>{M.ProjectStage.title[x]}</button>)}
      </div>
      <Toggle label="Только мои проекты" checked={onlyMine} onChange={setOnlyMine} />
      {projects.length === 0 && <EmptyState text="Проектов не найдено" icon="lightbulb" />}
      {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
      {(s.role === 'student' || KKSURoleExtra.canTeach(s.role) || s.role === 'mentor') && (
        <>
          <button className="btn primary" onClick={() => setAdding(true)}>➕ Новый проект</button>
          <Card><div className="list"><RouteRow route="inventionsServices" subtitle="Консультации, 3D-печать, патентная помощь" /></div></Card>
        </>
      )}
      {adding && <ProjectEditor track={track ?? 'inventions'} onClose={() => setAdding(false)} />}
    </Page>
  );
}

function StageFunnel({ projects }: { projects: M.InventionProject[] }) {
  return (
    <div className="row" style={{ gap: 4 }}>
      {M.ProjectStage.values.map((st, i) => (
        <div key={st} className="stack tight" style={{ flex: 1, alignItems: 'center', padding: '8px 0', borderRadius: 10, background: `color-mix(in srgb, var(--primary) ${8 + 12 * i}%, transparent)` }}>
          <Icon name={M.ProjectStage.icon[st]} />
          <b>{projects.filter((p) => p.stage === st).length}</b>
          <span className="small">{M.ProjectStage.title[st]}</span>
        </div>
      ))}
    </div>
  );
}

// MARK: Карточка проекта (48–54)

function ProjectDetail({ projectID }: { projectID: string }) {
  const s = useStore();
  const [tab, setTab] = useState<'overview' | 'media' | 'experiments' | 'notebook' | 'reviews'>('overview');
  const p = s.project(projectID);
  if (!p) return <Page title="Проект"><EmptyState text="Проект не найден" /></Page>;
  const me = s.db.currentUserID;
  const canEdit = (!!me && (p.authorIDs.some((a) => sameId(a, me)) || sameId(p.mentorID, me))) || KKSURoleExtra.canTeach(s.role);
  return (
    <Page title={p.title}>
      <Card>
        <div className="row"><span className="small" style={{ color: 'var(--primary)', flex: 1 }}>{M.ProjectTrack.title[p.track]}</span><span className="small" style={{ color: 'var(--danger)' }}>❤️ {p.likes}</span></div>
        <h2>{p.title}</h2>
        <span>{p.summary}</span>
        <StageProgress stage={p.stage} />
        <span className="small">Стадия: {M.ProjectStage.title[p.stage]} — {M.ProjectStage.subtitle[p.stage]}</span>
      </Card>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'overview', label: 'Обзор' }, { value: 'media', label: 'Материалы' }, { value: 'experiments', label: 'Эксперименты' },
        { value: 'notebook', label: 'Тетрадь' }, { value: 'reviews', label: 'Экспертиза' },
      ]} />
      {tab === 'overview' && <ProjectOverview project={p} canEdit={canEdit} />}
      {tab === 'media' && <ProjectMedia project={p} canEdit={canEdit} />}
      {tab === 'experiments' && <ExperimentJournal projectID={p.id} canEdit={canEdit} />}
      {tab === 'notebook' && <LabNotebook projectID={p.id} canEdit={canEdit} />}
      {tab === 'reviews' && <ProjectReviews project={p} />}
    </Page>
  );
}

function ProjectOverview({ project: p, canEdit }: { project: M.InventionProject; canEdit: boolean }) {
  const s = useStore();
  const [note, setNote] = useState('');
  const set = (patch: Partial<M.InventionProject>) => s.update('projects', p.id, patch);
  const next = nextStage(p.stage);
  const staff = KKSURoleExtra.canTeach(s.role) || s.role === 'mentor';
  return (
    <>
      <Card>
        <TextInput label="Проблема" multiline value={p.problem} onChange={(v) => canEdit && set({ problem: v })} placeholder="Какую проблему решает проект?" />
        <TextInput label="Решение" multiline value={p.solution} onChange={(v) => canEdit && set({ solution: v })} placeholder="Как работает решение?" />
        {(p.track === 'inclusiveEngineering' || p.inclusiveTarget) && <TextInput label="Для кого (инклюзия)" value={p.inclusiveTarget} onChange={(v) => canEdit && set({ inclusiveTarget: v })} placeholder="Целевая группа" />}
      </Card>
      <Card>
        <h3>Команда и наставник</h3>
        {p.teamID && <InfoRow label="Команда" value={s.db.teams.find((t) => sameId(t.id, p.teamID))?.name ?? '—'} />}
        <InfoRow label="Авторы" value={p.authorIDs.map((a) => s.userName(a)).join(', ')} />
        {staff ? (
          <>
            <Select label="Наставник" value={p.mentorID ?? ''} onChange={(v) => { set({ mentorID: v || undefined }); if (v) s.notify(v, 'Вы назначены наставником', p.title, 'info'); }}
              options={[{ value: '', label: 'Не назначен' }, ...s.db.users.filter((u) => u.role === 'mentor' || u.role === 'teacher' || u.role === 'expert').map((u) => ({ value: u.id, label: `${u.fullName} (${M.KKSURole.title[u.role]})` }))]} />
            <Select label="Команда" value={p.teamID ?? ''} onChange={(v) => set({ teamID: v || undefined })}
              options={[{ value: '', label: 'Без команды' }, ...s.db.teams.map((t) => ({ value: t.id, label: t.name }))]} />
          </>
        ) : <InfoRow label="Наставник" value={p.mentorID ? s.userName(p.mentorID) : 'Не назначен'} />}
      </Card>
      <Card>
        <h3>Путь проекта</h3>
        {p.stageHistory.map((c, i) => (
          <div key={i} className="row top"><Icon name={M.ProjectStage.icon[c.stage]} />
            <div className="stack tight"><b className="small">{M.ProjectStage.title[c.stage]} · {fmt.short(c.date)}</b>{c.note && <span className="small">{c.note}</span>}</div></div>
        ))}
        {next && canEdit && (
          <>
            <TextInput value={note} onChange={setNote} placeholder="Что сделано на этой стадии?" />
            <button className="btn primary" onClick={() => { s.advance(p.id, note); setNote(''); }}>➡️ Перейти на стадию {M.ProjectStage.title[next]}</button>
          </>
        )}
      </Card>
      {(p.isPrototype || stageIndex(p.stage) >= stageIndex('prototype')) && (
        <Card>
          <h3>Прототип</h3>
          <TextInput label="Характеристики, компоненты" multiline value={p.prototypeSpecs} onChange={(v) => canEdit && set({ prototypeSpecs: v })} />
          <Toggle label="Показывать на виртуальной выставке" checked={p.showInExhibition} onChange={(v) => canEdit && set({ showInExhibition: v })} />
        </Card>
      )}
      {canEdit && s.role === 'student' && <Card><div className="list"><RouteRow route="yiApply" subtitle="Подать проект на Young Inventors 30" /></div></Card>}
    </>
  );
}

function ProjectMedia({ project: p, canEdit }: { project: M.InventionProject; canEdit: boolean }) {
  const s = useStore();
  const [files, setFiles] = useState<M.Attachment[]>([]);
  return (
    <>
      <Card>
        <h3>Фото, видео, чертежи и документы</h3>
        {p.media.length === 0 && <EmptyState text="Материалов пока нет" icon="photo.on.rectangle" />}
        {M.AttachmentKind.values.map((k) => {
          const list = p.media.filter((m) => m.kind === k);
          return list.length ? <div key={k} className="stack tight"><b className="small">{M.AttachmentKind.title[k]}</b>{list.map((a) => <AttachmentRow key={a.id} attachment={a} />)}</div> : null;
        })}
      </Card>
      {canEdit && (
        <Card>
          <h3>Загрузить материалы</h3>
          <AttachmentPicker attachments={files} onChange={setFiles} />
          {files.length > 0 && <button className="btn primary" onClick={() => { s.update('projects', p.id, (x) => ({ ...x, media: [...x.media, ...files] })); setFiles([]); }}>Добавить в проект ({files.length})</button>}
        </Card>
      )}
    </>
  );
}

function ProjectReviews({ project: p }: { project: M.InventionProject }) {
  const s = useStore();
  const apps = s.db.yiApplications.filter((a) => sameId(a.projectID, p.id));
  const reviews = [...s.reviewsFor(p.id), ...apps.flatMap((a) => s.reviewsFor(a.id))];
  return (
    <>
      {reviews.length === 0 && <EmptyState text="Экспертных оценок пока нет" icon="star" />}
      {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      {KKSURoleExtra.canReview(s.role) && <Link className="btn primary" to={routePath('inventions', `p/${p.id}/review`)}>Оценить проект</Link>}
    </>
  );
}

function ProjectEditor({ track, onClose }: { track: M.ProjectTrack; onClose: () => void }) {
  const s = useStore();
  const [p, setP] = useState(() => M.makeInventionProject({ title: '', summary: '', track }));
  const [coauthors, setCoauthors] = useState<string[]>([]);
  const set = (patch: Partial<M.InventionProject>) => setP({ ...p, ...patch });
  const me = s.currentUser;
  return (
    <Modal title="Новый проект" onClose={onClose}>
      <TextInput label="Название проекта" value={p.title} onChange={(v) => set({ title: v })} />
      <TextInput label="Кратко о проекте" multiline value={p.summary} onChange={(v) => set({ summary: v })} />
      <TextInput label="Проблема" multiline value={p.problem} onChange={(v) => set({ problem: v })} />
      <Select label="Направление" value={p.track} onChange={(v) => set({ track: v })} options={M.ProjectTrack.values.map((t) => ({ value: t, label: M.ProjectTrack.title[t] }))} />
      {p.track === 'inclusiveEngineering' && <TextInput label="Для кого разработка (целевая группа)" value={p.inclusiveTarget} onChange={(v) => set({ inclusiveTarget: v })} />}
      <h3>Соавторы</h3>
      <div className="stack tight" style={{ maxHeight: 220, overflow: 'auto' }}>
        {s.students.filter((st) => !sameId(st.id, me?.id)).map((st) => (
          <Toggle key={st.id} label={st.fullName} checked={coauthors.includes(st.id)} onChange={(on) => setCoauthors(on ? [...coauthors, st.id] : coauthors.filter((x) => x !== st.id))} />
        ))}
      </div>
      <button className="btn primary" disabled={!p.title} onClick={() => {
        const authors = me?.role === 'student' ? [me.id, ...coauthors] : coauthors;
        const project: M.InventionProject = {
          ...p, authorIDs: authors, mentorID: me?.role === 'mentor' ? me.id : p.mentorID,
          stageHistory: [M.makeStageChange({ stage: 'idea', date: nowISO(), note: 'Проект создан' })],
        };
        s.db.projects.push(project);
        authors.forEach((a) => s.log(a, 'Создан проект', project.title, 'lightbulb'));
        s.changed(); onClose();
      }}>Создать</button>
    </Modal>
  );
}

// MARK: Журнал экспериментов (53)

function ExperimentJournal({ projectID, canEdit }: { projectID: string; canEdit: boolean }) {
  const s = useStore();
  const empty = { hypothesis: '', method: '', result: '', conclusion: '', success: true };
  const [f, setF] = useState(empty);
  const entries = s.db.experiments.filter((e) => sameId(e.projectID, projectID)).sort((a, b) => time(b.date) - time(a.date));
  const rate = entries.length ? entries.filter((e) => e.success).length / entries.length : 0;
  return (
    <>
      <Card><div className="row"><b style={{ flex: 1 }}>Экспериментов: {entries.length}</b><Badge text={`Подтверждено гипотез: ${Math.round(rate * 100)}%`} color="var(--success)" /></div></Card>
      {entries.map((e) => (
        <Card key={e.id}>
          <div className="row"><span>{e.success ? '✅' : '❌'}</span><span className="small" style={{ flex: 1 }}>{fmt.dateTime(e.date)}</span><span className="muted small">{s.userName(e.authorID)}</span></div>
          <InfoRow label="Гипотеза" value={e.hypothesis} /><InfoRow label="Метод" value={e.method} />
          <InfoRow label="Результат" value={e.result} /><InfoRow label="Вывод" value={e.conclusion} />
        </Card>
      ))}
      {canEdit && (
        <Card>
          <h3>Новая запись</h3>
          <TextInput label="Гипотеза" multiline rows={2} value={f.hypothesis} onChange={(v) => setF({ ...f, hypothesis: v })} />
          <TextInput label="Метод / условия эксперимента" multiline rows={2} value={f.method} onChange={(v) => setF({ ...f, method: v })} />
          <TextInput label="Результат" multiline rows={2} value={f.result} onChange={(v) => setF({ ...f, result: v })} />
          <TextInput label="Вывод" multiline rows={2} value={f.conclusion} onChange={(v) => setF({ ...f, conclusion: v })} />
          <Toggle label="Гипотеза подтвердилась" checked={f.success} onChange={(v) => setF({ ...f, success: v })} />
          <button className="btn primary" disabled={!f.hypothesis || !f.result || !s.db.currentUserID} onClick={() => {
            const me = s.db.currentUserID!;
            s.add('experiments', M.makeExperimentEntry({ projectID, authorID: me, ...f }));
            s.log(me, 'Эксперимент в журнале', f.hypothesis, 'testtube.2');
            setF(empty);
          }}>Записать эксперимент</button>
        </Card>
      )}
    </>
  );
}

// MARK: Лабораторная тетрадь (54)

function LabNotebook({ projectID, canEdit }: { projectID: string; canEdit: boolean }) {
  const s = useStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [measurements, setMeasurements] = useState<M.LabMeasurement[]>([]);
  const [m, setM] = useState({ name: '', value: '', unit: '' });
  const pages = s.db.notebook.filter((p) => sameId(p.projectID, projectID)).sort((a, b) => time(b.date) - time(a.date));
  const addMeasurement = () => {
    const value = Number(m.value.replace(',', '.'));
    if (!m.name || !m.value || !Number.isFinite(value)) return;
    setMeasurements([...measurements, M.makeLabMeasurement({ name: m.name, value, unit: m.unit })]);
    setM({ name: '', value: '', unit: '' });
  };
  return (
    <>
      {pages.length === 0 && <EmptyState text="Страниц пока нет" icon="book.closed" />}
      {pages.map((p) => (
        <Card key={p.id}>
          <div className="row"><b style={{ flex: 1 }}>{p.title}</b>
            {p.signedByMentor ? <span className="ok small">✍️ Подписано наставником</span>
              : (s.role === 'mentor' || KKSURoleExtra.canTeach(s.role)) && <button className="btn small" onClick={() => s.update('notebook', p.id, { signedByMentor: true })}>Подписать</button>}
          </div>
          <span className="muted small">{fmt.dateTime(p.date)} · {s.userName(p.authorID)}</span>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.content}</pre>
          {p.measurements.map((x) => <InfoRow key={x.id} label={x.name} value={`${x.value.toLocaleString('ru-RU')} ${x.unit}`} />)}
        </Card>
      ))}
      {canEdit && (
        <Card>
          <h3>Новая страница</h3>
          <TextInput label="Заголовок" value={title} onChange={setTitle} />
          <TextInput label="Наблюдения, расчёты, схемы словами" multiline rows={6} value={content} onChange={setContent} />
          <b className="small">Измерения</b>
          {measurements.map((x) => <InfoRow key={x.id} label={x.name} value={`${x.value.toLocaleString('ru-RU')} ${x.unit}`} />)}
          <div className="row">
            <div style={{ flex: 2 }}><TextInput value={m.name} onChange={(v) => setM({ ...m, name: v })} placeholder="Величина" /></div>
            <div style={{ flex: 1 }}><TextInput value={m.value} onChange={(v) => setM({ ...m, value: v })} placeholder="Значение" /></div>
            <div style={{ width: 70 }}><TextInput value={m.unit} onChange={(v) => setM({ ...m, unit: v })} placeholder="Ед." /></div>
            <button className="btn small" aria-label="Добавить измерение" onClick={addMeasurement}>➕</button>
          </div>
          <button className="btn primary" disabled={!title || !s.db.currentUserID} onClick={() => {
            s.add('notebook', M.makeLabNotebookPage({ projectID, authorID: s.db.currentUserID!, title, content, measurements }));
            setTitle(''); setContent(''); setMeasurements([]);
          }}>Сохранить страницу</button>
        </Card>
      )}
    </>
  );
}

// MARK: Проектные команды (50)

export function TeamsScreen() {
  const s = useStore();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const me = s.currentUser;
  return (
    <Page title="Проектные команды">
      {s.db.teams.map((t) => {
        const projects = s.db.projects.filter((p) => sameId(p.teamID, t.id));
        return (
          <Card key={t.id}>
            <div className="row"><b style={{ flex: 1 }}>👥 {t.name}</b><span className="small">{t.memberIDs.length} уч.</span></div>
            {t.memberIDs.map((m) => (
              <div key={m} className="row"><Avatar name={s.userName(m)} size={28} /><span>{s.userName(m)}</span>{sameId(t.captainID, m) && <Badge text="Капитан" color="var(--accent)" />}</div>
            ))}
            {projects.length > 0 && <span className="muted small">Проекты: {projects.map((p) => p.title).join(', ')}</span>}
            {me && s.role === 'student' && !t.memberIDs.some((x) => sameId(x, me.id)) && (
              <button className="btn" onClick={() => s.update('teams', t.id, (x) => ({ ...x, memberIDs: [...x.memberIDs, me.id] }))}>Вступить в команду</button>
            )}
          </Card>
        );
      })}
      <Card>
        <h3>Создать команду</h3>
        <TextInput label="Название команды" value={name} onChange={setName} />
        <div className="stack tight" style={{ maxHeight: 260, overflow: 'auto' }}>
          {s.students.map((st) => {
            const self = sameId(st.id, me?.id);
            return <Toggle key={st.id} label={st.fullName} checked={self || members.includes(st.id)} onChange={(on) => !self && setMembers(on ? [...members, st.id] : members.filter((x) => x !== st.id))} />;
          })}
        </div>
        <button className="btn primary" disabled={!name} onClick={() => {
          const ids = [...new Set(me?.role === 'student' ? [me.id, ...members] : members)];
          s.add('teams', M.makeProjectTeam({ name, memberIDs: ids, captainID: me?.role === 'student' ? me.id : ids[0] }));
          setName(''); setMembers([]);
        }}>Создать</button>
      </Card>
    </Page>
  );
}

// MARK: Каталог прототипов (55)

export function PrototypesScreen() {
  const s = useStore();
  const list = s.db.projects.filter((p) => p.isPrototype || stageIndex(p.stage) >= stageIndex('prototype'));
  return (
    <Page title="Каталог прототипов KKSU" wide>
      <span className="muted">Все прототипы, созданные учениками KKSU: характеристики, стадия испытаний и материалы.</span>
      {list.length === 0 && <EmptyState text="Прототипов пока нет" icon="cube.transparent" />}
      <div className="grid" style={{ ['--min' as string]: '280px' }}>
        {list.map((p) => (
          <Card key={p.id} to={routePath('inventions', 'p/' + p.id)}>
            <b>🧊 {p.title}</b>
            <span className="muted small">{M.ProjectTrack.title[p.track]}</span>
            {p.prototypeSpecs && <code className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.prototypeSpecs}</code>}
            <StageProgress stage={p.stage} />
            <span className="small">Испытаний: {s.db.experiments.filter((e) => sameId(e.projectID, p.id)).length} · материалов: {p.media.length}</span>
          </Card>
        ))}
      </div>
    </Page>
  );
}

// MARK: Young Inventors 30 (56–58)

export function YoungInventorsScreen() {
  const s = useStore();
  const apps = s.db.yiApplications;
  return (
    <Page title="Young Inventors 30">
      <Card>
        <h2 style={{ color: 'var(--accent)' }}>✨ Young Inventors 30</h2>
        <span>Ежегодный конкурс 30 лучших молодых изобретателей KKSU и партнёров. Экспертное жюри, наставники, выставка и сертификаты.</span>
        <span className="muted small">Сезон {new Date().getFullYear()} · номинации: Инклюзивные технологии, Инженерия, AI, Экология, Культурное наследие</span>
      </Card>
      <div className="grid" style={{ ['--min' as string]: '140px' }}>
        <StatTile title="Заявок" value={apps.length} icon="doc.text.fill" />
        <StatTile title="На экспертизе" value={apps.filter((a) => a.status === 'underReview' || a.status === 'submitted').length} icon="hourglass" color="var(--warning)" />
        <StatTile title="Финалистов" value={apps.filter((a) => a.status === 'finalist').length} icon="star.fill" color="var(--accent)" />
        <StatTile title="Победителей" value={apps.filter((a) => a.status === 'winner').length} icon="trophy.fill" color="var(--success)" />
      </div>
      <div className="grid" style={{ ['--min' as string]: '150px' }}>
        {s.role === 'student' && <RouteTile route="yiApply" />}
        {KKSURoleExtra.canReview(s.role) && <RouteTile route="yiReview" />}
        <RouteTile route="exhibition" />
      </div>
      <Section title="Заявки сезона" icon="list.bullet" />
      {apps.map((a) => <YIApplicationCard key={a.id} application={a} />)}
      {apps.length === 0 && <EmptyState text="Заявок пока нет" icon="doc.text" />}
    </Page>
  );
}

function YIApplicationCard({ application: a }: { application: M.YoungInventorsApplication }) {
  const s = useStore();
  const project = s.project(a.projectID);
  const reviews = s.reviewsFor(a.id);
  const avg = reviews.length ? reviews.reduce((t, r) => t + reviewAverage(r), 0) / reviews.length : undefined;
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>{project?.title ?? 'Проект'}</b><Badge text={M.YIStatus.title[a.status]} color={a.status === 'rejected' ? 'var(--danger)' : 'var(--accent)'} /></div>
      <span className="muted small">{s.userName(a.applicantID)} · {a.nomination} · {fmt.short(a.date)}</span>
      <span>{a.motivation}</span>
      {avg !== undefined && <span className="small">⭐ Оценка жюри: {avg.toFixed(1)} / 10 ({reviews.length} экспертиз)</span>}
      {s.role === 'admin' && (
        <Select label="Статус" value={a.status} onChange={(status) => {
          s.update('yiApplications', a.id, { status });
          if (status === 'winner' || status === 'finalist') s.issueCertificate(a.applicantID, `${M.YIStatus.title[status]} Young Inventors 30 — «${project?.title ?? ''}»`, 'youngInventors');
        }} options={M.YIStatus.values.map((x) => ({ value: x, label: M.YIStatus.title[x] }))} />
      )}
    </Card>
  );
}

const NOMINATIONS = ['Инклюзивные технологии', 'Инженерия и машиностроение', 'Искусственный интеллект', 'Экология и энергия', 'Культурное наследие'];

export function YIApplyScreen() {
  const s = useStore();
  const [projectID, setProjectID] = useState('');
  const [nomination, setNomination] = useState(NOMINATIONS[0]);
  const [motivation, setMotivation] = useState('');
  const [sent, setSent] = useState(false);
  const me = s.db.currentUserID;
  const mine = s.db.projects.filter((p) => !!me && p.authorIDs.some((a) => sameId(a, me)));
  const project = projectID ? s.project(projectID) : undefined;
  const fee = s.productTitled(YI_FEE);
  const feePaid = s.hasAccess(me, fee);
  const stageOK = !!project && stageIndex(project.stage) >= stageIndex('prototype');
  const mediaOK = !!project && project.media.length > 0;
  const expOK = !!project && s.db.experiments.some((e) => sameId(e.projectID, project.id));
  return (
    <Page title="Заявка Young Inventors">
      {sent && <span className="ok">✅ Заявка подана! Эксперты рассмотрят её в течение 2 недель.</span>}
      <Card>
        <h3>Проект</h3>
        {mine.length === 0 && <span className="muted">Сначала создайте проект в <Link to={routePath('inventions')}>KKSU Inventions</Link>.</span>}
        <Select label="Проект" value={projectID} onChange={setProjectID} options={[{ value: '', label: 'Выберите' }, ...mine.map((p) => ({ value: p.id, label: p.title }))]} />
        <Select label="Номинация" value={nomination} onChange={setNomination} options={NOMINATIONS.map((n) => ({ value: n, label: n }))} />
      </Card>
      <Card><TextInput label="Мотивация" multiline rows={4} value={motivation} onChange={setMotivation} placeholder="Почему ваш проект важен?" /></Card>
      <Card>
        <h3>Требования</h3>
        <span>{stageOK ? '✅' : '⚪️'} Проект на стадии Prototype или выше</span>
        <span>{mediaOK ? '✅' : '⚪️'} Есть материалы (фото/видео/чертежи)</span>
        <span>{expOK ? '✅' : '⚪️'} Есть записи в журнале экспериментов</span>
      </Card>
      <Section title="Регистрационный взнос" icon="creditcard">
        <PaywallGate product={fee} message="Регистрация на сезон Young Inventors 30 платная. Подать заявку можно после подтверждения оплаты.">
          <span className="ok">✅ Взнос оплачен</span>
        </PaywallGate>
      </Section>
      <button className="btn primary" disabled={!projectID || !motivation || !stageOK || !feePaid || !me} onClick={() => {
        s.add('yiApplications', M.makeYoungInventorsApplication({ projectID, applicantID: me!, season: String(new Date().getFullYear()), nomination, motivation }));
        for (const u of s.db.users.filter((u) => u.role === 'expert' || u.role === 'mentor')) s.notify(u.id, 'Новая заявка Young Inventors 30', project?.title ?? '', 'info');
        s.log(me!, 'Заявка на Young Inventors 30', project?.title ?? '', 'sparkles');
        setSent(true); setMotivation('');
      }}>Подать заявку</button>
    </Page>
  );
}

export function YIReviewScreen() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 'review' && sub[1]) return <ExpertReviewForm targetID={sub[1]} target="youngInventors" criteria={PROJECT_CRITERIA} />;
  const me = s.db.currentUserID;
  return (
    <Page title="Экспертиза проектов">
      <span className="muted">Оценка по 5 критериям: новизна, техническая проработка, социальная значимость, прототип, презентация. Средний балл 8+ выводит заявку в финал.</span>
      {s.db.yiApplications.map((a) => {
        const reviewed = s.db.reviews.some((r) => sameId(r.targetID, a.id) && sameId(r.expertID, me));
        return (
          <div key={a.id} className="stack tight">
            <YIApplicationCard application={a} />
            <div className="row">
              <Link to={routePath('inventions', 'p/' + a.projectID)}>📄 Карточка проекта</Link>
              <span className="spacer" />
              {reviewed ? <span className="ok">✅ Оценено</span> : <Link className="btn primary" to={routePath('yiReview', 'review/' + a.id)}>⭐ Оценить</Link>}
            </div>
          </div>
        );
      })}
      {s.db.yiApplications.length === 0 && <EmptyState text="Заявок пока нет" icon="doc.text" />}
    </Page>
  );
}

// MARK: Виртуальная выставка (59)

export function ExhibitionScreen() {
  const s = useStore();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ReportTarget>();
  const blocked = s.blockedUserIDs;
  const exhibits = s.db.projects.filter((p) => p.showInExhibition && !s.isReportedByMe(p.id) && !p.authorIDs.some((a) => blocked.some((b) => sameId(a, b))))
    .sort((a, b) => b.likes - a.likes);
  const me = s.db.currentUserID;
  return (
    <Page title="Виртуальная выставка" wide>
      <span className="muted">Изобретения учеников KKSU. Голосуйте за понравившиеся проекты!</span>
      {exhibits.length === 0 && <EmptyState text="На выставке пока нет проектов" icon="building.columns" />}
      {M.ProjectTrack.values.map((t) => {
        const items = exhibits.filter((p) => p.track === t);
        if (!items.length) return null;
        return (
          <div key={t} className="stack">
            <Section title={M.ProjectTrack.title[t]} icon={M.ProjectTrack.icon[t]} />
            <div className="row" style={{ overflowX: 'auto', gap: 12, alignItems: 'stretch', paddingBottom: 6 }}>
              {items.map((p) => (
                <div key={p.id} className="card" style={{ width: 240, flex: '0 0 auto' }}>
                  <div style={{ height: 120, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 44 }} aria-hidden>
                    <Icon name={M.ProjectTrack.icon[p.track]} />
                  </div>
                  <b>{p.title}</b>
                  <span className="muted small">{p.summary.slice(0, 140)}</span>
                  {p.media.find((m) => m.altText)?.altText && <span className="small">🖼️ {p.media.find((m) => m.altText)!.altText}</span>}
                  <div className="row">
                    <button className="btn small" style={{ color: 'var(--danger)' }} onClick={() => {
                      if (liked.has(p.id)) return;
                      s.update('projects', p.id, (x) => ({ ...x, likes: x.likes + 1 }));
                      setLiked(new Set(liked).add(p.id));
                    }}>{liked.has(p.id) ? '❤️' : '🤍'} {p.likes}</button>
                    <span className="spacer" />
                    <Link className="small" to={routePath('inventions', 'p/' + p.id)}>Подробнее</Link>
                    {!p.authorIDs.some((a) => sameId(a, me)) && (
                      <button className="btn small" title="Пожаловаться" aria-label="Пожаловаться"
                        onClick={() => setReport({ kind: 'project', contentID: p.id, reportedUserID: p.authorIDs[0], excerpt: `${p.title}\n${p.summary}` })}>⚠️</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {report && <ReportDialog target={report} onClose={() => setReport(undefined)} />}
    </Page>
  );
}
