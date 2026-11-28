// Конструктор курсов педагога и курсы для ученика (126–130) — как KKSUCourseStudio.swift.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as M from '../core/models.gen';
import { KKSURoleExtra, lessonHasLive, lessonJoinURL, lessonLiveEnd, publishedLessons, youTubeID } from '../core/helpers';
import { isoIn, sameId, time } from '../core/ids';
import {
  AttachmentPicker, AttachmentRow, Badge, Card, DateInput, EmptyState, fmt, InfoRow, NotesText, NumberInput, Page, ProgressBar, Section,
  Segmented, Select, StudentScoped, TextInput, Toggle, YouTubePlayer, confirmAction, routePath, useStore, useSub,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { DeadlineRow, PaywallGate, PriceBadge } from './shared';
import { TestCard } from './Library';

const MAX_DIGITAL_USD = 300;
const ICONS = ['book.closed.fill', 'function', 'atom', 'globe.europe.africa.fill', 'paintpalette.fill', 'music.note', 'cpu.fill', 'wrench.and.screwdriver.fill', 'leaf.fill', 'text.book.closed.fill', 'character.book.closed.fill'];

function LessonRow({ lesson: l, index }: { lesson: M.CourseLesson; index: number }) {
  return (
    <span className="stack tight" style={{ flex: 1 }}>
      <span className="row"><b>{index}. {l.title}</b>{!l.isPublished && <Badge text="Скрыт" color="var(--text-2)" />}</span>
      <span className="muted small row wrap" style={{ gap: 10 }}>
        {lessonHasLive(l) && <span>🎥 {l.liveStart ? fmt.dateTime(l.liveStart) : 'онлайн'}</span>}
        {l.videoURL && <span>▶️</span>}{l.notes && <span>📝</span>}
        {l.attachments.length > 0 && <span>📎 {l.attachments.length}</span>}{l.links.length > 0 && <span>🔗 {l.links.length}</span>}
        {l.testID && <span>✅ тест</span>}{l.assignmentID && <span>🏠 ДЗ</span>}
      </span>
    </span>
  );
}

// MARK: Студия курсов педагога

export function CourseStudioScreen() {
  const s = useStore();
  const sub = useSub();
  const navigate = useNavigate();
  if (sub[0] === 'c' && sub[1] && sub[2] === 'l' && sub[3]) return <LessonEditor courseID={sub[1]} lessonID={sub[3]} />;
  if (sub[0] === 'c' && sub[1] && sub[2] === 'preview') return <SchoolCourseDetail courseID={sub[1]} preview />;
  if (sub[0] === 'c' && sub[1]) return <SchoolCourseEditor courseID={sub[1]} />;
  const create = () => {
    const c = M.makeSchoolCourse({ title: '', subject: '', teacherID: s.db.currentUserID ?? undefined });
    s.add('schoolCourses', c);
    navigate(routePath('courseStudio', 'c/' + c.id));
  };
  return (
    <Page title="Мои курсы">
      <span className="muted">Создайте курс, добавьте уроки: онлайн-занятие по ссылке, запись с YouTube, конспект, файлы, ссылки, тест и домашнее задание.</span>
      <button className="btn primary" onClick={create}>➕ Новый курс</button>
      {s.myTeachingCourses.length === 0 && <EmptyState text="У вас пока нет курсов" icon="book.closed" />}
      {s.myTeachingCourses.map((c) => (
        <Card key={c.id} to={routePath('courseStudio', 'c/' + c.id)}>
          <div className="row"><span className="tile-icon"><Icon name={c.icon} /></span>
            <div className="stack tight" style={{ flex: 1 }}><b>{c.title || 'Без названия'}</b><span className="muted small">{c.subject} · уроков: {c.lessons.length} · учеников: {s.courseStudents(c).length}</span></div>
            <Badge text={c.isPublished ? 'Опубликован' : 'Черновик'} color={c.isPublished ? 'var(--success)' : 'var(--warning)'} /></div>
        </Card>
      ))}
    </Page>
  );
}

function SchoolCourseEditor({ courseID }: { courseID: string }) {
  const s = useStore();
  const navigate = useNavigate();
  const course = s.course(courseID);
  const product = s.billing.products.find((p) => sameId(p.refID, courseID));
  const [price, setPrice] = useState(product?.isActive ? product.priceUSD : 0);
  if (!course) return <Page title="Курс"><EmptyState text="Курс удалён" icon="trash" /></Page>;
  const set = (patch: Partial<M.SchoolCourse>) => s.updateCourse(course.id, patch);
  const savePrice = (value: number) => {
    const v = Math.min(Math.max(value, 0), MAX_DIGITAL_USD);
    setPrice(v);
    const title = `Курс «${course.title}»`;
    if (product) s.updateBilling('products', product.id, { priceUSD: v, title, isActive: v > 0 });
    else if (v > 0) s.addBilling('products', M.makeProduct({ title, kind: 'course', priceUSD: v, summary: course.summary, refID: course.id, sellerID: course.teacherID }));
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= course.lessons.length) return;
    const lessons = [...course.lessons];
    [lessons[i], lessons[j]] = [lessons[j], lessons[i]];
    set({ lessons });
  };
  const addLesson = () => {
    const l = M.makeCourseLesson({ title: `Урок ${course.lessons.length + 1}` });
    set({ lessons: [...course.lessons, l] });
    navigate(routePath('courseStudio', `c/${course.id}/l/${l.id}`));
  };
  const students = s.courseStudents(course);
  return (
    <Page title={course.title || 'Новый курс'}>
      <Card>
        <h3>Курс</h3>
        <TextInput label="Название курса" value={course.title} onChange={(v) => set({ title: v })} />
        <TextInput label="Предмет" value={course.subject} onChange={(v) => set({ subject: v })} />
        <TextInput label="Описание" multiline value={course.summary} onChange={(v) => set({ summary: v })} />
        <div className="row wrap" role="radiogroup" aria-label="Иконка">
          {ICONS.map((i) => <button key={i} className={'btn small' + (course.icon === i ? ' primary' : '')} onClick={() => set({ icon: i })} aria-pressed={course.icon === i}><Icon name={i} /></button>)}
        </div>
      </Card>
      <Section title={`Уроки · ${course.lessons.length}`} icon="list.number" />
      <Card><div className="list">
        {course.lessons.map((l, i) => (
          <div key={l.id} className="list-item">
            <Link to={routePath('courseStudio', `c/${course.id}/l/${l.id}`)} style={{ flex: 1, color: 'inherit', display: 'flex' }}><LessonRow lesson={l} index={i + 1} /></Link>
            <button className="btn small" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn small" aria-label="Ниже" disabled={i === course.lessons.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="btn small danger" aria-label="Удалить урок" onClick={() => confirmAction(`Удалить урок «${l.title}»?`) && set({ lessons: course.lessons.filter((x) => x.id !== l.id) })}>🗑</button>
          </div>
        ))}
        <button className="btn" onClick={addLesson}>➕ Добавить урок</button>
      </div></Card>
      <Card>
        <h3>Ученики</h3>
        <Toggle label="Для всех учеников школы" checked={course.studentIDs.length === 0} onChange={(all) => set({ studentIDs: all ? [] : s.students.slice(0, 1).map((x) => x.id) })} />
        {course.studentIDs.length > 0 && (
          <div className="stack tight" style={{ maxHeight: 260, overflow: 'auto' }}>
            {s.students.map((st) => (
              <Toggle key={st.id} label={st.fullName} checked={course.studentIDs.some((x) => sameId(x, st.id))}
                onChange={(on) => set({ studentIDs: on ? [...course.studentIDs, st.id] : course.studentIDs.filter((x) => !sameId(x, st.id)) })} />
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h3>Цена</h3>
        <NumberInput label={price > 0 ? `Цена, USD (${s.priceText(price)})` : 'Цена, USD (0 — бесплатно)'} value={price} min={0} max={MAX_DIGITAL_USD} step={5} onChange={savePrice} />
        <span className="muted small">Платный курс ученики покупают по счёту на сайте, через App Store в приложении или по подписке KKSU. Бесплатный курс доступен сразу.</span>
      </Card>
      <Card>
        <h3>Прогресс учеников</h3>
        {(students.length === 0 || publishedLessons(course).length === 0) && <span className="muted">Появится после публикации уроков</span>}
        {publishedLessons(course).length > 0 && students.map((st) => {
          const p = s.courseProgress(course, st.id);
          return <InfoRow key={st.id} label={st.fullName} value={<span style={{ color: p >= 1 ? 'var(--success)' : undefined }}>{Math.round(p * 100)}%</span>} />;
        })}
      </Card>
      <Card>
        {course.isPublished ? <Toggle label="Опубликован" checked={course.isPublished} onChange={(v) => set({ isPublished: v })} />
          : <button className="btn primary" disabled={!course.title || course.lessons.length === 0} onClick={() => s.publishCourse(course.id)}>✈️ Опубликовать курс для учеников</button>}
        <Link to={routePath('courseStudio', `c/${course.id}/preview`)}>👀 Как видит ученик</Link>
        <button className="btn danger" onClick={() => {
          if (!confirmAction('Удалить курс со всеми уроками?')) return;
          s.db.schoolCourses = s.db.schoolCourses.filter((c) => !sameId(c.id, course.id));
          s.db.lessonProgress = s.db.lessonProgress.filter((p) => !sameId(p.courseID, course.id));
          s.changed();
          navigate(routePath('courseStudio'));
        }}>Удалить курс</button>
      </Card>
    </Page>
  );
}

// MARK: Редактор урока

function LessonEditor({ courseID, lessonID }: { courseID: string; lessonID: string }) {
  const s = useStore();
  const [files, setFiles] = useState<M.Attachment[]>([]);
  const [link, setLink] = useState({ title: '', url: '' });
  const [hw, setHw] = useState({ text: '', due: isoIn(3 * 86400) });
  const [preview, setPreview] = useState<'edit' | 'view'>('edit');
  const [scheduled, setScheduled] = useState(false);
  const course = s.course(courseID);
  const l = course?.lessons.find((x) => sameId(x.id, lessonID));
  if (!course || !l) return <Page title="Урок"><EmptyState text="Урок удалён" icon="trash" /></Page>;
  const set = (patch: Partial<M.CourseLesson>) => s.updateLesson(courseID, lessonID, patch);
  const join = lessonJoinURL(l);
  const assignment = l.assignmentID ? s.db.assignments.find((a) => sameId(a.id, l.assignmentID)) : undefined;
  return (
    <Page title={l.title}>
      <Card>
        <h3>Урок</h3>
        <TextInput label="Тема урока" value={l.title} onChange={(v) => set({ title: v })} />
        <TextInput label="Краткое описание" multiline value={l.summary} onChange={(v) => set({ summary: v })} />
        <Toggle label="Показывать ученикам" checked={l.isPublished} onChange={(v) => set({ isPublished: v })} />
      </Card>
      <Card>
        <h3>Онлайн-урок</h3>
        <Toggle label="Провести онлайн" checked={!!l.liveStart} onChange={(on) => set({ liveStart: on ? isoIn(86400) : undefined })} />
        {l.liveStart && (
          <>
            <div className="form-grid">
              <DateInput label="Начало" value={l.liveStart} onChange={(v) => set({ liveStart: v })} />
              <NumberInput label="Длительность, мин" value={l.liveDurationMinutes} min={15} max={180} step={5} onChange={(v) => set({ liveDurationMinutes: v })} />
              <Select label="Платформа" value={l.livePlatform} onChange={(v) => set({ livePlatform: v })} options={M.ConferencePlatform.values.map((p) => ({ value: p, label: M.ConferencePlatform.title[p] }))} />
            </div>
            <TextInput label={l.livePlatform === 'jitsi' ? 'Ссылка (пусто — комната создастся сама)' : 'Ссылка на конференцию'} value={l.liveURL} onChange={(v) => set({ liveURL: v })} />
            {join && <a className="btn" href={join} target="_blank" rel="noopener noreferrer">🎥 Начать урок</a>}
            <button className="btn" onClick={() => { s.scheduleLiveLesson(courseID, lessonID); setScheduled(true); }}>📅 {l.sessionID ? 'Обновить в расписании' : 'Добавить в расписание учеников'}</button>
            {scheduled && <span className="ok small">Урок в расписании, ученики получили уведомление.</span>}
          </>
        )}
        <span className="muted small">Урок можно провести в Jitsi, Zoom, Google Meet или Teams. Запись потом добавьте ниже ссылкой YouTube.</span>
      </Card>
      <Card>
        <h3>Видео / запись урока</h3>
        <TextInput value={l.videoURL} onChange={(v) => set({ videoURL: v })} placeholder="Ссылка YouTube (youtube.com или youtu.be)" />
        {l.videoURL && !youTubeID(l.videoURL) && !l.videoURL.includes('://') && <span className="small" style={{ color: 'var(--danger)' }}>Не похоже на ссылку. Скопируйте адрес видео из YouTube.</span>}
        {l.videoURL && <YouTubePlayer url={l.videoURL} />}
        <span className="muted small">Загрузите видео на YouTube (можно «доступ по ссылке») и вставьте ссылку — ученики посмотрят его прямо на сайте и в приложении.</span>
      </Card>
      <Card>
        <h3>Конспект</h3>
        <Segmented value={preview} onChange={setPreview} options={[{ value: 'edit', label: 'Редактировать' }, { value: 'view', label: 'Просмотр' }]} />
        {preview === 'view' ? (l.notes ? <NotesText text={l.notes} /> : <span className="muted">Конспект пуст</span>)
          : <TextInput multiline rows={10} value={l.notes} onChange={(v) => set({ notes: v })} />}
        <span className="muted small">Можно выделять: **жирный**, *курсив*, ссылки [текст](https://…).</span>
      </Card>
      <Card>
        <h3>Файлы</h3>
        {l.attachments.map((a) => (
          <div key={a.id} className="row"><div style={{ flex: 1 }}><AttachmentRow attachment={a} /></div>
            <button className="btn small danger" aria-label="Удалить файл" onClick={() => set({ attachments: l.attachments.filter((x) => x.id !== a.id) })}>🗑</button></div>
        ))}
        <AttachmentPicker attachments={files} onChange={setFiles} />
        {files.length > 0 && <button className="btn" onClick={() => { set({ attachments: [...l.attachments, ...files] }); setFiles([]); }}>Прикрепить к уроку ({files.length})</button>}
      </Card>
      <Card>
        <h3>Полезные ссылки</h3>
        {l.links.map((x) => (
          <div key={x.id} className="row"><a style={{ flex: 1 }} href={x.url} target="_blank" rel="noopener noreferrer">🔗 {x.title}</a>
            <button className="btn small danger" aria-label="Удалить ссылку" onClick={() => set({ links: l.links.filter((y) => y.id !== x.id) })}>🗑</button></div>
        ))}
        <div className="form-grid">
          <TextInput value={link.title} onChange={(v) => setLink({ ...link, title: v })} placeholder="Название (например, презентация)" />
          <TextInput value={link.url} onChange={(v) => setLink({ ...link, url: v })} placeholder="https://…" />
        </div>
        <button className="btn" disabled={!link.url.trim()} onClick={() => {
          let url = link.url.trim();
          if (!url.includes('://')) url = 'https://' + url;
          set({ links: [...l.links, M.makeLessonLink({ title: link.title || url, url })] });
          setLink({ title: '', url: '' });
        }}>Добавить ссылку</button>
      </Card>
      <Card>
        <h3>Проверка знаний</h3>
        <Select label="Тест к уроку" value={l.testID ?? ''} onChange={(v) => set({ testID: v || undefined })}
          options={[{ value: '', label: 'Без теста' }, ...s.db.tests.filter((t) => t.audience === 'students').map((t) => ({ value: t.id, label: t.title }))]} />
        <Link to={routePath('testBuilder')}>🔨 Создать новый тест</Link>
        {assignment ? (
          <>
            <InfoRow label="Домашнее задание" value={`${assignment.title}, до ${fmt.short(assignment.dueDate)}`} />
            <button className="btn small danger" onClick={() => set({ assignmentID: undefined })}>Отвязать задание</button>
          </>
        ) : (
          <>
            <TextInput label="Домашнее задание (что сделать)" multiline rows={3} value={hw.text} onChange={(v) => setHw({ ...hw, text: v })} />
            <DateInput label="Срок" value={hw.due} onChange={(v) => setHw({ ...hw, due: v })} />
            <button className="btn" disabled={!hw.text} onClick={() => {
              const a = M.makeAssignment({ title: `${l.title}: домашнее задание`, subject: course.subject || course.title, details: hw.text,
                teacherID: s.db.currentUserID ?? undefined, dueDate: hw.due, assignedIDs: course.studentIDs });
              s.publish(a);
              set({ assignmentID: a.id });
              setHw({ ...hw, text: '' });
            }}>Задать домашнее задание</button>
          </>
        )}
      </Card>
    </Page>
  );
}

// MARK: Курсы для ученика

export function SchoolCoursesScreen() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] && sub[1] === 'l' && sub[2]) return <LessonPlayer courseID={sub[0]} lessonID={sub[2]} />;
  if (sub[0]) return <SchoolCourseDetail courseID={sub[0]} />;
  return (
    <Page title="Курсы">
      {KKSURoleExtra.canTeach(s.role) && <Link className="btn block" to={routePath('courseStudio')}>✏️ Мои курсы (конструктор)</Link>}
      <StudentScoped>{(studentID) => {
        const courses = s.coursesFor(studentID);
        if (!courses.length) return <EmptyState text="Пока нет курсов" icon="book.closed" />;
        return <>{courses.map((c) => (
          <Card key={c.id} to={routePath('schoolCourses', c.id)}>
            <div className="row"><span className="tile-icon"><Icon name={c.icon} /></span>
              <div className="stack tight" style={{ flex: 1 }}><b>{c.title}</b><span className="muted small">{c.subject} · {s.userName(c.teacherID)} · уроков: {publishedLessons(c).length}</span></div>
              <PriceBadge product={s.productForRef(c.id)} /></div>
            <ProgressBar value={s.courseProgress(c, studentID)} color="var(--success)" />
          </Card>
        ))}</>;
      }}</StudentScoped>
    </Page>
  );
}

function SchoolCourseDetail({ courseID, preview }: { courseID: string; preview?: boolean }) {
  const s = useStore();
  const c = s.course(courseID);
  if (!c) return <Page title="Курс"><EmptyState text="Курс не найден" icon="book.closed" /></Page>;
  const studentID = s.role === 'student' ? s.db.currentUserID ?? undefined : s.visibleStudents[0]?.id;
  const progress = studentID ? s.courseProgress(c, studentID) : 0;
  const lessons = publishedLessons(c);
  return (
    <Page title={c.title}>
      <Card>
        <span className="small" style={{ color: 'var(--primary)' }}><Icon name={c.icon} /> {c.subject}</span>
        <h2>{c.title}</h2>
        {c.summary && <span>{c.summary}</span>}
        <span className="muted small">Педагог: {s.userName(c.teacherID)}</span>
        {studentID && !preview && <><ProgressBar value={progress} color="var(--success)" /><span className="small">Пройдено {Math.round(progress * 100)}%</span></>}
      </Card>
      <PaywallGate product={preview ? undefined : s.productForRef(courseID)} message="Платный курс. Уроки откроются после оплаты или по подписке KKSU.">
        {lessons.map((l, i) => {
          const done = studentID ? s.isLessonCompleted(l.id, studentID) : false;
          return (
            <Card key={l.id} to={routePath('schoolCourses', `${c.id}/l/${l.id}`)}>
              <div className="row top">
                <span style={{ fontSize: '1.3rem', color: done ? 'var(--success)' : 'var(--primary)', width: 28 }}>{done ? '✅' : i + 1}</span>
                <LessonRow lesson={l} index={i + 1} />
                {l.liveStart && time(l.liveStart) > Date.now() && <Badge text={fmt.relative(l.liveStart)} color="var(--accent)" />}
              </div>
            </Card>
          );
        })}
        {lessons.length === 0 && <EmptyState text="Уроки скоро появятся" icon="hourglass" />}
      </PaywallGate>
    </Page>
  );
}

function LessonPlayer({ courseID, lessonID }: { courseID: string; lessonID: string }) {
  const s = useStore();
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState(false);
  const c = s.course(courseID);
  const l = c?.lessons.find((x) => sameId(x.id, lessonID));
  if (!c || !l) return <Page title="Урок"><EmptyState text="Урок не найден" icon="book.closed" /></Page>;
  const me = s.currentUser;
  const isStudent = me?.role === 'student';
  const product = s.productForRef(courseID);
  const test = l.testID ? s.db.tests.find((t) => sameId(t.id, l.testID)) : undefined;
  const assignment = l.assignmentID ? s.db.assignments.find((a) => sameId(a.id, l.assignmentID)) : undefined;
  const done = me ? s.isLessonCompleted(lessonID, me.id) : false;
  return (
    <Page title={l.title}>
      <PaywallGate product={KKSURoleExtra.canTeach(s.role) ? undefined : product} message="Платный курс. Уроки откроются после оплаты или по подписке KKSU.">
        {l.summary && <span className="muted">{l.summary}</span>}
        {lessonHasLive(l) && <LiveLessonCard lesson={l} />}
        {l.videoURL && <Card><h3>▶️ Видео урока</h3><YouTubePlayer url={l.videoURL} /></Card>}
        {l.notes && <Card><h3>📝 Конспект</h3><NotesText text={l.notes} /></Card>}
        {(l.attachments.length > 0 || l.links.length > 0) && (
          <Card><h3>📎 Материалы</h3>
            {l.attachments.map((a) => <AttachmentRow key={a.id} attachment={a} />)}
            {l.links.map((x) => <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer">🔗 {x.title}</a>)}
          </Card>
        )}
        {test && <TestCard test={test} />}
        {assignment && me && isStudent && <DeadlineRow assignment={assignment} to={routePath('homework', `a/${assignment.id}/${me.id}`)} />}
        {me && isStudent && (
          <>
            <button className={'btn block ' + (done ? '' : 'primary')} style={done ? { background: 'var(--success)', color: '#fff' } : undefined}
              onClick={() => s.toggleLessonCompleted(courseID, lessonID, me.id)}>{done ? '✅ Урок пройден' : '⚪️ Отметить урок пройденным'}</button>
            {c.teacherID && (
              <Card>
                <h3>❓ Вопрос учителю</h3>
                <TextInput multiline rows={3} value={question} onChange={setQuestion} placeholder="Что непонятно в уроке?" />
                <button className="btn" disabled={!question.trim()} onClick={() => { s.askTeacher(c, l, question); setQuestion(''); setSent(true); }}>Отправить в чат</button>
                {sent && <span className="ok small">Вопрос отправлен учителю в чат.</span>}
              </Card>
            )}
          </>
        )}
      </PaywallGate>
    </Page>
  );
}

function LiveLessonCard({ lesson: l }: { lesson: M.CourseLesson }) {
  const now = Date.now();
  const end = lessonLiveEnd(l);
  const live = !!l.liveStart && time(l.liveStart) <= now + 10 * 60000 && !!end && end.getTime() >= now;
  const join = lessonJoinURL(l);
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>🎥 Онлайн-урок</b>{live && <Badge text="Идёт сейчас" color="var(--danger)" />}</div>
      {l.liveStart && <span>{fmt.dateTime(l.liveStart)} · {l.liveDurationMinutes} мин · {M.ConferencePlatform.title[l.livePlatform]}</span>}
      {join && <a className="btn primary block" href={join} target="_blank" rel="noopener noreferrer">Подключиться</a>}
    </Card>
  );
}
