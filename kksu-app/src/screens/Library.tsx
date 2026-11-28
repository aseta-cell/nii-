// Библиотеки (26–28, 40, 75, 76) и онлайн-тестирование (29–31, 41) — как KKSULibraryAndTests.swift.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as M from '../core/models.gen';
import { KKSURoleExtra, attemptPercent, testMaxScore, youTubeID } from '../core/helpers';
import { sameId, time } from '../core/ids';
import { KKSUStore } from '../core/store';
import {
  Badge, Card, EmptyState, fmt, InfoRow, Modal, NumberInput, Page, ProgressBar, Section, Select, TagEditor, TextInput, Toggle,
  YouTubePlayer, routePath, useStore, useSub,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { EnrollmentGate, PaywallGate, PriceBadge } from './shared';
import type { RouteId } from '../core/routes.gen';

// MARK: Библиотека

const DOC_KINDS: M.LibraryKind[] = ['pdf', 'presentation', 'instruction', 'textbook'];

function LibraryList({ kinds, title, teacherAcademyOnly }: { kinds: M.LibraryKind[]; title: string; teacherAcademyOnly?: boolean }) {
  const s = useStore();
  const sub = useSub();
  const { route } = useParams();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [adding, setAdding] = useState(false);
  if (sub[0] === 'item' && sub[1]) return <LibraryItemDetail itemID={sub[1]} />;
  const ql = q.toLowerCase();
  const items = s.db.library.filter((i) => kinds.includes(i.kind) && (!teacherAcademyOnly || i.isTeacherAcademy || i.forTeachers) && (!subject || i.subject === subject)
    && (!ql || i.title.toLowerCase().includes(ql) || i.summary.toLowerCase().includes(ql) || i.textAlternative.toLowerCase().includes(ql)));
  const subjects = [...new Set(s.db.library.filter((i) => kinds.includes(i.kind)).map((i) => i.subject))].sort();
  return (
    <Page title={title}>
      <TextInput value={q} onChange={setQ} placeholder="Поиск, в том числе по тексту материалов" />
      <div className="chips">
        <button className={'chip' + (!subject ? ' on' : '')} onClick={() => setSubject('')}>Все</button>
        {subjects.map((x) => <button key={x} className={'chip' + (subject === x ? ' on' : '')} onClick={() => setSubject(x)}>{x}</button>)}
      </div>
      {items.length === 0 && <EmptyState text="Материалы не найдены" icon="magnifyingglass" />}
      {items.map((i) => <LibraryItemRow key={i.id} item={i} to={routePath(route as RouteId, 'item/' + i.id)} />)}
      {(KKSURoleExtra.canTeach(s.role) || s.role === 'psychologist' || s.role === 'expert') && <button className="btn outline" onClick={() => setAdding(true)}>➕ Добавить материал</button>}
      {adding && <LibraryItemEditor defaultKind={kinds[0] ?? 'methodical'} teacherAcademy={!!teacherAcademyOnly} onClose={() => setAdding(false)} />}
    </Page>
  );
}

export const VideoLibraryScreen = () => <LibraryList kinds={['video']} title="Видеоуроки" />;
export const MethodicalLibraryScreen = () => <LibraryList kinds={['methodical']} title="Методические материалы" />;
export const DocumentsScreen = () => <LibraryList kinds={DOC_KINDS} title="Документы и учебники" />;
export const AcademyLibraryScreen = () => <LibraryList kinds={M.LibraryKind.values} title="Методическая библиотека Academy" teacherAcademyOnly />;

function LibraryItemRow({ item, to }: { item: M.LibraryItem; to: string }) {
  const s = useStore();
  return (
    <Card to={to}>
      <div className="row top">
        <span className="tile-icon"><Icon name={M.LibraryKind.icon[item.kind]} /></span>
        <div className="stack tight" style={{ flex: 1 }}>
          <b>{item.title}</b>
          <span className="muted small">{M.LibraryKind.title[item.kind]} · {item.subject} · {item.author}</span>
          <span className="small">{item.summary}</span>
          <div className="row wrap">
            {item.captions.length > 0 && <Badge text="CC субтитры" color="var(--success)" />}
            {item.textAlternative && <Badge text="Текстовая версия" color="purple" />}
            {item.durationMinutes > 0 && <Badge text={`${item.durationMinutes} мин`} />}
            <PriceBadge product={s.productForRef(item.id)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function LibraryItemDetail({ itemID }: { itemID: string }) {
  const s = useStore();
  const item = s.db.library.find((i) => sameId(i.id, itemID));
  const [showText, setShowText] = useState(false);
  useEffect(() => {
    const me = s.db.currentUserID;
    if (!item || !me) return;
    s.update('library', item.id, (x) => ({ ...x, views: x.views + 1 }));
    const key = Object.keys(s.db.viewedLibraryIDs).find((k) => sameId(k, me)) ?? me;
    const viewed = s.db.viewedLibraryIDs[key] ?? [];
    if (!viewed.some((v) => sameId(v, item.id))) {
      s.db.viewedLibraryIDs[key] = [...viewed, item.id];
      s.log(me, 'Изучен материал', item.title, M.LibraryKind.icon[item.kind]);
      s.changed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemID]);
  if (!item) return <Page title="Материал"><EmptyState text="Материал не найден" /></Page>;
  const a11y = s.accessibility;
  return (
    <Page title={item.title}>
      <PaywallGate product={s.productForRef(item.id)} message="Платный курс. Видео, субтитры и материалы откроются после подтверждения оплаты или по подписке KKSU.">
        {item.kind === 'video' && <CaptionedVideo url={item.url} captions={item.captions} captionsOn={a11y.captionsEnabled} />}
        <Card>
          <h2>{item.title}</h2>
          <span className="muted small">{M.LibraryKind.title[item.kind]} · {item.subject} · автор: {item.author}</span>
          <span>{item.summary}</span>
          {item.tags.length > 0 && <div className="chips">{item.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>}
          {item.kind !== 'video' && item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">↗️ Открыть {M.LibraryKind.title[item.kind].toLowerCase()}</a>}
        </Card>
        {item.textAlternative && (
          <Card>
            <details open={showText || a11y.showTextAlternatives} onToggle={(e) => setShowText((e.target as HTMLDetailsElement).open)}>
              <summary><b>📝 Текстовая альтернатива</b></summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{item.textAlternative}</p>
            </details>
          </Card>
        )}
        {item.captions.length > 0 && (
          <Card>
            <h3>Расшифровка видео</h3>
            {item.captions.map((c, i) => <div key={i} className="row top"><span className="muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>{mmss(c.start)}</span><span>{c.text}</span></div>)}
          </Card>
        )}
      </PaywallGate>
    </Page>
  );
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** Видео с субтитрами (75): YouTube, прямой файл или воспроизведение расшифровки по таймеру. */
function CaptionedVideo({ url, captions, captionsOn }: { url: string; captions: M.CaptionSegment[]; captionsOn: boolean }) {
  const [show, setShow] = useState(captionsOn || captions.length > 0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setT((x) => x + 0.25), 250);
    return () => window.clearInterval(id);
  }, [playing]);
  const caption = captions.find((c) => t >= c.start && t < c.end)?.text;
  const yt = url && youTubeID(url);
  return (
    <div className="stack">
      {yt ? <YouTubePlayer url={url} /> : (
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', borderRadius: 16, overflow: 'hidden' }}>
          {url ? <video ref={videoRef} src={url} controls style={{ width: '100%', height: '100%' }} onTimeUpdate={(e) => setT((e.target as HTMLVideoElement).currentTime)} />
            : <button className="btn" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 'fit-content', height: 'fit-content' }} onClick={() => { setT(0); setPlaying(true); }}>▶️ Воспроизвести с субтитрами</button>}
          {show && caption && <div style={{ position: 'absolute', left: 16, right: 16, bottom: 44, textAlign: 'center', pointerEvents: 'none' }}>
            <span aria-live="polite" style={{ background: 'rgba(0,0,0,.75)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: '1.15rem' }}>{caption}</span></div>}
        </div>
      )}
      {!yt && <Toggle label="💬 Субтитры" checked={show} onChange={setShow} />}
    </div>
  );
}

function parseCaptions(text: string): M.CaptionSegment[] {
  const lines = text.split('\n').flatMap((line) => {
    const i = line.indexOf('|');
    if (i < 0) return [];
    const start = Number(line.slice(0, i).trim().replace(',', '.'));
    return Number.isFinite(start) ? [[start, line.slice(i + 1).trim()] as const] : [];
  });
  return lines.map(([start, text], i) => M.makeCaptionSegment({ start, end: i + 1 < lines.length ? lines[i + 1][0] : start + 5, text }));
}

function LibraryItemEditor({ defaultKind, teacherAcademy, onClose }: { defaultKind: M.LibraryKind; teacherAcademy: boolean; onClose: () => void }) {
  const s = useStore();
  const [item, setItem] = useState(() => M.makeLibraryItem({ title: '', kind: defaultKind, subject: '', author: s.currentUser?.fullName ?? '', summary: '', isTeacherAcademy: teacherAcademy, forTeachers: teacherAcademy }));
  const [captions, setCaptions] = useState('');
  const set = (patch: Partial<M.LibraryItem>) => setItem({ ...item, ...patch });
  return (
    <Modal title="Новый материал" onClose={onClose}>
      <TextInput label="Название" value={item.title} onChange={(v) => set({ title: v })} />
      <div className="form-grid">
        <Select label="Тип" value={item.kind} onChange={(v) => set({ kind: v })} options={M.LibraryKind.values.map((k) => ({ value: k, label: M.LibraryKind.title[k] }))} />
        <TextInput label="Предмет" value={item.subject} onChange={(v) => set({ subject: v })} />
        <TextInput label="Автор" value={item.author} onChange={(v) => set({ author: v })} />
        {item.kind === 'video' && <NumberInput label="Длительность, мин" value={item.durationMinutes} min={0} max={180} onChange={(v) => set({ durationMinutes: v })} />}
      </div>
      <TextInput label="Краткое описание" multiline value={item.summary} onChange={(v) => set({ summary: v })} />
      <TextInput label="Ссылка на файл / видео" value={item.url} onChange={(v) => set({ url: v })} />
      <TagEditor values={item.tags} onChange={(tags) => set({ tags })} placeholder="Теги" />
      <TextInput label="Текстовая альтернатива (обязательно для инклюзии)" multiline value={item.textAlternative} onChange={(v) => set({ textAlternative: v })} />
      {item.kind === 'video' && <TextInput label="Субтитры: каждая строка «секунды | текст»" multiline value={captions} onChange={setCaptions} />}
      <Toggle label="Для педагогов" checked={item.forTeachers} onChange={(v) => set({ forTeachers: v })} />
      <Toggle label="Методическая библиотека Teacher Academy" checked={item.isTeacherAcademy} onChange={(v) => set({ isTeacherAcademy: v })} />
      <button className="btn primary" disabled={!item.title || !item.textAlternative} onClick={() => { s.add('library', { ...item, captions: parseCaptions(captions) }); onClose(); }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Онлайн-тестирование (29, 30)

export function TestsScreen() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 't' && sub[1]) return <TestTaking testID={sub[1]} />;
  if (sub[0] === 'r' && sub[1]) return <TestResults testID={sub[1]} />;
  const tests = s.db.tests.filter((t) => t.audience === 'students' && (t.isPublished || KKSURoleExtra.canTeach(s.role)));
  return (
    <Page title="Онлайн-тестирование">
      {KKSURoleExtra.canTeach(s.role) && <Link className="btn block" to={routePath('testBuilder')}>🔨 Создать тест в конструкторе</Link>}
      <EnrollmentGate>
        {tests.map((t) => <TestCard key={t.id} test={t} />)}
        {tests.length === 0 && <EmptyState text="Тестов пока нет" icon="checklist" />}
      </EnrollmentGate>
    </Page>
  );
}

export function TestCard({ test }: { test: M.KKSUTest }) {
  const s = useStore();
  const attempts = s.db.attempts.filter((a) => sameId(a.testID, test.id) && sameId(a.userID, s.db.currentUserID));
  const best = attempts.reduce<M.TestAttempt | undefined>((b, a) => (!b || attemptPercent(a) > attemptPercent(b) ? a : b), undefined);
  return (
    <Card>
      <div className="row"><b style={{ flex: 1 }}>{test.title}</b>{!test.isPublished && <Badge text="Черновик" color="var(--text-2)" />}</div>
      <span className="muted small">{test.subject} · {test.questions.length} вопросов · {test.timeLimitMinutes} мин · проходной {test.passingPercent}%</span>
      {best && <div className="row"><Badge text={`Лучший результат: ${attemptPercent(best)}%`} color={best.passed ? 'var(--success)' : 'var(--danger)'} /><span className="small">Попыток: {attempts.length}</span></div>}
      <div className="row wrap">
        <Link className="btn primary" to={routePath('tests', 't/' + test.id)}>▶️ {attempts.length ? 'Пройти ещё раз' : 'Начать тест'}</Link>
        {KKSURoleExtra.canTeach(s.role) && <Link className="btn" to={routePath('tests', 'r/' + test.id)}>📊 Результаты</Link>}
      </div>
    </Card>
  );
}

function TestTaking({ testID }: { testID: string }) {
  const s = useStore();
  const test = s.db.tests.find((t) => sameId(t.id, testID));
  const [answers, setAnswers] = useState<Record<string, M.TestAnswer>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<M.TestAttempt>();
  const [startedAt, setStartedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const remaining = test ? Math.max(0, Math.round(test.timeLimitMinutes * 60 - (now - startedAt) / 1000)) : 0;
  const finish = () => {
    if (result || !test || !s.db.currentUserID) return;
    setResult(s.submitTest(test, Object.values(answers), s.db.currentUserID));
  };
  useEffect(() => {
    if (result) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [result]);
  useEffect(() => { if (test && !result && remaining === 0) finish(); });
  if (!test) return <Page title="Тест"><EmptyState text="Тест не найден" /></Page>;
  if (result) {
    return (
      <Page title={test.title}>
        <TestResultCard test={test} attempt={result} />
        <button className="btn" onClick={() => { setResult(undefined); setAnswers({}); setIndex(0); setStartedAt(Date.now()); setNow(Date.now()); }}>Пройти заново</button>
      </Page>
    );
  }
  if (test.questions.length === 0) return <Page title={test.title}><EmptyState text="В тесте нет вопросов" /></Page>;
  const q = test.questions[Math.min(index, test.questions.length - 1)];
  const answer = answers[q.id] ?? M.makeTestAnswer({ questionID: q.id });
  return (
    <Page title={test.title}>
      <div className="row"><b style={{ flex: 1 }}>Вопрос {index + 1} из {test.questions.length}</b>
        <span style={{ color: remaining < 60 ? 'var(--danger)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>⏱ {mmss(remaining)}</span></div>
      <ProgressBar value={(index + 1) / test.questions.length} />
      <QuestionView question={q} answer={answer} onChange={(a) => setAnswers({ ...answers, [q.id]: a })} />
      <div className="row">
        <button className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>Назад</button>
        <span className="spacer" />
        {index < test.questions.length - 1
          ? <button className="btn primary" onClick={() => setIndex(index + 1)}>Далее</button>
          : <button className="btn primary" onClick={finish}>Завершить тест</button>}
      </div>
    </Page>
  );
}

function QuestionView({ question: q, answer, onChange }: { question: M.TestQuestion; answer: M.TestAnswer; onChange: (a: M.TestAnswer) => void }) {
  return (
    <Card>
      <h3>{q.text}</h3>
      <span className="muted small">{M.QuestionKind.title[q.kind]} · {q.points} балл(а)</span>
      {(q.kind === 'single' || q.kind === 'multiple') && q.options.map((o, i) => {
        const selected = answer.selected.includes(i);
        return (
          <label key={i} className={'option' + (selected ? ' on' : '')} style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer', background: selected ? 'var(--soft)' : 'var(--bg-2)' }}>
            <input type={q.kind === 'single' ? 'radio' : 'checkbox'} name={q.id} checked={selected} onChange={() => {
              const sel = q.kind === 'single' ? [i] : selected ? answer.selected.filter((x) => x !== i) : [...answer.selected, i];
              onChange({ ...answer, selected: sel });
            }} />
            <span>{o}</span>
          </label>
        );
      })}
      {q.kind === 'number' && <TextInput type="text" value={answer.text} onChange={(v) => onChange({ ...answer, text: v })} placeholder="Введите число" />}
      {q.kind === 'text' && <TextInput value={answer.text} onChange={(v) => onChange({ ...answer, text: v })} placeholder="Ваш ответ" />}
    </Card>
  );
}

function TestResultCard({ test, attempt }: { test: M.KKSUTest; attempt: M.TestAttempt }) {
  const correctAnswer = (q: M.TestQuestion) => q.kind === 'single' || q.kind === 'multiple'
    ? q.correctIndices.map((i) => q.options[i]).filter(Boolean).join(', ') : q.correctText.split('|').join(' / ');
  return (
    <>
      <Card>
        <div className="row"><span style={{ fontSize: '2.4rem' }}>{attempt.passed ? '✅' : '❌'}</span>
          <div className="stack tight"><h2>{attempt.passed ? 'Тест сдан!' : 'Тест не сдан'}</h2><span>{attempt.score} из {attempt.maxScore} баллов · {attemptPercent(attempt)}%</span></div></div>
        <span className="muted small">Проверено автоматически</span>
      </Card>
      {test.questions.map((q) => {
        const ok = KKSUStore.evaluate(q, attempt.answers.find((a) => sameId(a.questionID, q.id)));
        return (
          <Card key={q.id}>
            <span style={{ color: ok ? 'var(--success)' : 'var(--danger)' }}>{ok ? '✅' : '❌'} {q.text}</span>
            {!ok && <span>Правильный ответ: {correctAnswer(q)}</span>}
            {q.explanation && <span className="muted small">{q.explanation}</span>}
          </Card>
        );
      })}
    </>
  );
}

function TestResults({ testID }: { testID: string }) {
  const s = useStore();
  const attempts = s.db.attempts.filter((a) => sameId(a.testID, testID)).sort((a, b) => time(b.date) - time(a.date));
  const avg = attempts.length ? Math.round(attempts.reduce((t, a) => t + attemptPercent(a), 0) / attempts.length) : 0;
  return (
    <Page title="Результаты теста">
      <Card>
        <InfoRow label="Попыток" value={attempts.length} />
        <InfoRow label="Средний результат" value={`${avg}%`} />
        <InfoRow label="Сдали" value={attempts.filter((a) => a.passed).length} />
      </Card>
      <Section title="Попытки" icon="list.bullet" />
      <Card><div className="list">
        {attempts.map((a) => (
          <div key={a.id} className="list-item"><span style={{ flex: 1 }}>{s.userName(a.userID)}</span>
            <b style={{ color: a.passed ? 'var(--success)' : 'var(--danger)' }}>{attemptPercent(a)}%</b><span className="muted small">{fmt.short(a.date)}</span></div>
        ))}
        {attempts.length === 0 && <span className="muted">Попыток пока нет</span>}
      </div></Card>
    </Page>
  );
}

// MARK: Конструктор тестов (31)

const emptyTest = () => M.makeKKSUTest({ title: '', subject: '', questions: [] });

export function TestBuilderScreen() {
  const s = useStore();
  const [test, setTest] = useState(emptyTest);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<M.KKSUTest>) => { setTest({ ...test, ...patch }); setSaved(false); };
  const setQ = (id: string, q: M.TestQuestion) => set({ questions: test.questions.map((x) => (x.id === id ? q : x)) });
  const valid = !!test.title && !!test.subject && test.questions.length > 0 && test.questions.every((q) => q.text && (q.kind === 'number' || q.kind === 'text' ? q.correctText : q.correctIndices.length > 0));
  const save = () => {
    const t: M.KKSUTest = {
      ...test, authorID: s.db.currentUserID ?? undefined,
      questions: test.questions.map((q) => {
        if (q.kind !== 'single' && q.kind !== 'multiple') return q;
        const keep = q.options.map((o, i) => [o, i] as const).filter(([o]) => o);
        return { ...q, options: keep.map(([o]) => o), correctIndices: q.correctIndices.map((ci) => keep.findIndex(([, i]) => i === ci)).filter((x) => x >= 0) };
      }),
    };
    s.add('tests', t);
    if (t.isPublished) for (const u of t.audience === 'students' ? s.students : s.users('teacher')) s.notify(u.id, `Новый тест: ${t.title}`, t.subject, 'info');
    setTest(emptyTest()); setSaved(true);
  };
  return (
    <Page title="Конструктор тестов">
      <Card>
        <h3>Параметры теста</h3>
        <div className="form-grid">
          <TextInput label="Название" value={test.title} onChange={(v) => set({ title: v })} />
          <TextInput label="Предмет" value={test.subject} onChange={(v) => set({ subject: v })} />
          <NumberInput label="Время, мин" value={test.timeLimitMinutes} min={1} max={180} onChange={(v) => set({ timeLimitMinutes: v })} />
          <NumberInput label="Проходной балл, %" value={test.passingPercent} min={10} max={100} step={5} onChange={(v) => set({ passingPercent: v })} />
          <Select label="Для кого" value={test.audience} onChange={(v) => set({ audience: v })} options={[{ value: 'students', label: 'Ученики' }, { value: 'teachers', label: 'Педагоги (Teacher Academy)' }]} />
          {test.audience === 'teachers' && <Select label="Курс Academy" value={test.courseID ?? ''} onChange={(v) => set({ courseID: v || undefined })}
            options={[{ value: '', label: 'Без курса' }, ...s.db.teacherCourses.map((c) => ({ value: c.id, label: c.title }))]} />}
        </div>
        <Toggle label="Опубликовать" checked={test.isPublished} onChange={(v) => set({ isPublished: v })} />
      </Card>
      {test.questions.map((q, i) => (
        <Card key={q.id}>
          <div className="row"><h3 style={{ flex: 1 }}>Вопрос {i + 1}</h3><button className="btn small danger" onClick={() => set({ questions: test.questions.filter((x) => x.id !== q.id) })}>Удалить вопрос</button></div>
          <QuestionEditor question={q} onChange={(nq) => setQ(q.id, nq)} />
        </Card>
      ))}
      <Card>
        <div className="row wrap">
          {M.QuestionKind.values.map((k) => (
            <button key={k} className="btn small" onClick={() => set({ questions: [...test.questions, M.makeTestQuestion({ text: '', kind: k, options: k === 'single' || k === 'multiple' ? ['', ''] : [] })] })}>➕ {M.QuestionKind.title[k]}</button>
          ))}
        </div>
        <span className="muted small">Максимальный балл: {testMaxScore(test)}</span>
      </Card>
      <button className="btn primary" disabled={!valid} onClick={save}>Сохранить тест</button>
      {saved && <span className="ok">✅ Тест сохранён</span>}
      {!valid && <span className="muted small">Заполните название, предмет и хотя бы один вопрос с правильным ответом.</span>}
    </Page>
  );
}

function QuestionEditor({ question: q, onChange }: { question: M.TestQuestion; onChange: (q: M.TestQuestion) => void }) {
  const set = (patch: Partial<M.TestQuestion>) => onChange({ ...q, ...patch });
  const toggleCorrect = (i: number) => set({ correctIndices: q.kind === 'single' ? [i] : q.correctIndices.includes(i) ? q.correctIndices.filter((x) => x !== i) : [...q.correctIndices, i] });
  return (
    <div className="stack">
      <TextInput label="Текст вопроса" multiline rows={2} value={q.text} onChange={(v) => set({ text: v })} />
      <div className="form-grid">
        <Select label="Тип" value={q.kind} onChange={(v) => set({ kind: v, correctIndices: [], options: (v === 'single' || v === 'multiple') && q.options.length === 0 ? ['', ''] : q.options })}
          options={M.QuestionKind.values.map((k) => ({ value: k, label: M.QuestionKind.title[k] }))} />
        <NumberInput label="Баллов" value={q.points} min={1} max={10} onChange={(v) => set({ points: v })} />
      </div>
      {(q.kind === 'single' || q.kind === 'multiple') && (
        <>
          {q.options.map((o, i) => (
            <div key={i} className="row">
              <button className="btn small" aria-label="Отметить как правильный" title="Правильный ответ" onClick={() => toggleCorrect(i)}>{q.correctIndices.includes(i) ? '✅' : '⚪️'}</button>
              <div style={{ flex: 1 }}><TextInput value={o} onChange={(v) => set({ options: q.options.map((x, j) => (j === i ? v : x)) })} placeholder={`Вариант ${i + 1}`} /></div>
            </div>
          ))}
          <button className="btn small" onClick={() => set({ options: [...q.options, ''] })}>Добавить вариант</button>
        </>
      )}
      {q.kind === 'number' && <TextInput label="Правильный ответ (число)" value={q.correctText} onChange={(v) => set({ correctText: v })} />}
      {q.kind === 'text' && <TextInput label="Правильный ответ (варианты через |)" value={q.correctText} onChange={(v) => set({ correctText: v })} />}
      <TextInput label="Пояснение после проверки" multiline rows={2} value={q.explanation} onChange={(v) => set({ explanation: v })} />
    </div>
  );
}
