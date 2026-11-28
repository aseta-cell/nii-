// Доступность (73–76), настройки обучения (77), рекомендации (78), AI-помощники (79, 80),
// AI-генерация заданий (81), анализ прогресса (82), рекомендации педагогу (83) — как KKSUAIAndPersonalization.swift.
// В веб-версии ключи AI не хранятся в браузере: работает локальный помощник KKSU.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as M from '../core/models.gen';
import { ASSISTANT, generateTask, reply, type AssistantMode } from '../core/assistant';
import { analyze, RISK_COLOR, recommendations, teacherInsights, type RiskLevel } from '../core/analytics';
import { KKSURoleExtra } from '../core/helpers';
import { isoIn, sameId } from '../core/ids';
import {
  Card, DateInput, EmptyState, NumberInput, Page, RouteRow, Section, Segmented, Select, StudentScoped, TagEditor, TextInput, Toggle,
  routePath, useStore, useSub,
} from '../ui/kit';
import { HBarChart, RecommendationRow } from './shared';
import { InsightCard, studentLink } from './Cabinets';
import { ProgressDashboardContent } from './Student';

// MARK: Доступность (73, 74)

export function AccessibilityScreen() {
  const s = useStore();
  const a = s.accessibility;
  const set = (patch: Partial<M.AccessibilitySettings>) => s.setAccessibility({ ...a, ...patch });
  return (
    <Page title="Доступность">
      <Card><span className="muted small">Предпросмотр</span><span>Пример текста: «Образование без барьеров — каждый учится в своём темпе».</span></Card>
      <Card>
        <h3>Текст</h3>
        <label className="field"><span>Размер текста: {Math.round(a.textScale * 100)}%</span>
          <input type="range" min={0.8} max={2} step={0.1} value={a.textScale} onChange={(e) => set({ textScale: Number(e.target.value) })} aria-label="Размер текста" /></label>
        <Toggle label="Жирный шрифт" checked={a.boldText} onChange={(v) => set({ boldText: v })} />
        <Toggle label="Шрифт, удобный при дислексии" checked={a.dyslexiaFriendlyFont} onChange={(v) => set({ dyslexiaFriendlyFont: v })} />
      </Card>
      <Card>
        <h3>Цвет и контраст</h3>
        <Toggle label="Высокий контраст" checked={a.highContrast} onChange={(v) => set({ highContrast: v })} />
        <Segmented value={a.darkMode} onChange={(v) => set({ darkMode: v })} options={M.DarkModePreference.values.map((d) => ({ value: d, label: M.DarkModePreference.title[d] }))} />
      </Card>
      <Card>
        <h3>Интерфейс</h3>
        <Toggle label="Упрощённый интерфейс" checked={a.simplifiedInterface} onChange={(v) => set({ simplifiedInterface: v })} />
        <Toggle label="Крупные кнопки" checked={a.largeButtons} onChange={(v) => set({ largeButtons: v })} />
        <Toggle label="Уменьшить анимацию" checked={a.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
      </Card>
      <Card>
        <h3>Материалы</h3>
        <Toggle label="Субтитры к видео по умолчанию" checked={a.captionsEnabled} onChange={(v) => set({ captionsEnabled: v })} />
        <Toggle label="Всегда показывать текстовые альтернативы" checked={a.showTextAlternatives} onChange={(v) => set({ showTextAlternatives: v })} />
      </Card>
      <button className="btn" onClick={() => s.setAccessibility(M.makeAccessibilitySettings())}>Сбросить настройки</button>
      <span className="muted small">Сайт также поддерживает экранные дикторы, масштабирование браузера и системную тёмную тему. Настройки сохраняются в профиле и синхронизируются с приложением KKSU.</span>
    </Page>
  );
}

// MARK: Настройки обучения (77)

export function LearningSettingsScreen() {
  const s = useStore();
  const me = s.db.currentUserID;
  if (!me) return null;
  const p = s.preferences(me);
  const set = (patch: Partial<M.LearningPreferences>) => s.setPreferences({ ...p, ...patch });
  return (
    <Page title="Настройки обучения">
      <Card>
        <h3>Темп</h3>
        <Segmented value={p.pace} onChange={(v) => set({ pace: v })} options={M.LearningPace.values.map((x) => ({ value: x, label: M.LearningPace.title[x] }))} />
        <div className="form-grid">
          <NumberInput label="Длительность занятия, мин" value={p.sessionMinutes} min={5} max={90} step={5} onChange={(v) => set({ sessionMinutes: v })} />
          <NumberInput label="Цель в день, мин" value={p.dailyGoalMinutes} min={10} max={240} step={10} onChange={(v) => set({ dailyGoalMinutes: v })} />
        </div>
        <Toggle label="Напоминать о перерывах" checked={p.breakReminders} onChange={(v) => set({ breakReminders: v })} />
      </Card>
      <Card>
        <h3>Предпочитаемые форматы</h3>
        {M.ContentFormat.values.map((f) => (
          <Toggle key={f} label={M.ContentFormat.title[f]} checked={p.formats.includes(f)} onChange={(on) => set({ formats: on ? [...p.formats, f] : p.formats.filter((x) => x !== f) })} />
        ))}
      </Card>
      <Card><h3>Интересы (для рекомендаций)</h3><TagEditor values={p.interests} onChange={(interests) => set({ interests })} placeholder="Добавить интерес" /></Card>
      <Card><h3>AI</h3><Toggle label="Подсказки AI-помощника" checked={p.aiHintsEnabled} onChange={(v) => set({ aiHintsEnabled: v })} /></Card>
      <Card><div className="list"><RouteRow route="accessibility" subtitle="Размер текста, контраст, субтитры" /></div></Card>
    </Page>
  );
}

// MARK: Рекомендации (78)

export function RecommendationsScreen() {
  const s = useStore();
  return (
    <Page title="Рекомендации">
      <span className="muted">Подбор учитывает успеваемость, интересы, удобные форматы и темп обучения.</span>
      <StudentScoped>{(id) => {
        const recs = recommendations(id, s);
        return recs.length === 0 ? <EmptyState text="Пока нечего рекомендовать" icon="hand.thumbsup" /> : <>{recs.map((r, i) => <RecommendationRow key={i} rec={r} />)}</>;
      }}</StudentScoped>
    </Page>
  );
}

// MARK: AI-помощники (79, 80)

function AIAssistant({ mode }: { mode: AssistantMode }) {
  const s = useStore();
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const me = s.db.currentUserID;
  const key = me ? Object.keys(s.db.aiChats).find((k) => sameId(k, me)) ?? me : undefined;
  const messages = key ? s.db.aiChats[key] ?? [] : [];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, thinking]);
  const send = (raw: string) => {
    const q = raw.trim();
    if (!q || !key || thinking) return;
    setText('');
    s.db.aiChats[key] = [...messages, M.makeAIChatMessage({ isUser: true, text: q })];
    s.changed();
    setThinking(true);
    window.setTimeout(() => {
      const answer = reply(q, mode, s);
      s.db.aiChats[key] = [...(s.db.aiChats[key] ?? []), M.makeAIChatMessage({ isUser: false, text: answer })];
      s.log(key, mode === 'student' ? 'Вопрос AI-помощнику' : 'Запрос AI-помощнику педагога', q, 'sparkles');
      setThinking(false);
    }, 450);
  };
  return (
    <Page title={ASSISTANT[mode].title} actions={messages.length > 0 && key ? <button className="btn small" onClick={() => { s.db.aiChats[key] = []; s.changed(); }}>Очистить диалог</button> : undefined}>
      <Card>
        <b style={{ color: 'var(--primary)' }}>{mode === 'student' ? '✨' : '🪄'} {ASSISTANT[mode].title}</b>
        <span>{mode === 'student'
          ? 'Я помогу разобраться в теме, спланировать задания и подскажу ход решения. Решать будем вместе!'
          : 'Помогу с планами уроков, адаптацией материалов, заданиями и обратной связью. Проверяйте результаты перед использованием.'}</span>
        <span className="muted small">Режим: локальный помощник KKSU (данные не передаются внешним AI-сервисам)</span>
      </Card>
      <div className="chat-messages stack">
        {messages.map((m) => (
          <div key={m.id} className={'bubble ' + (m.isUser ? 'me' : 'other')} style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
        ))}
        {thinking && <span className="muted">⏳ Думаю…</span>}
        <div ref={endRef} />
      </div>
      <div className="chips">{ASSISTANT[mode].suggestions.map((x) => <button key={x} className="chip" onClick={() => send(x)}>{x}</button>)}</div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <div style={{ flex: 1 }}><TextInput value={text} onChange={setText} placeholder={mode === 'student' ? 'Спроси что-нибудь…' : 'Запрос помощнику…'} /></div>
        <button className="btn primary" type="submit" disabled={!text.trim() || thinking} aria-label="Отправить">➤</button>
      </form>
    </Page>
  );
}

export const AIAssistantScreen = () => <AIAssistant mode="student" />;
export const TeacherAIScreen = () => <AIAssistant mode="teacher" />;

// MARK: Генерация заданий (81)

export function AITaskGeneratorScreen() {
  const s = useStore();
  const sub = useSub();
  const [studentID, setStudentID] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'1' | '2' | '3'>('2');
  const [draft, setDraft] = useState({ title: '', details: '', alt: '' });
  const [status, setStatus] = useState('');
  if (sub[0] === 'review' && sub[1]) return <AIAssignmentReview assignmentID={sub[1]} />;
  const pending = s.db.assignments.filter((a) => a.isAIGenerated && !a.approvedByTeacher);
  const save = (approve: boolean) => {
    const a = M.makeAssignment({ title: draft.title, subject, details: draft.details, teacherID: s.db.currentUserID ?? undefined, dueDate: isoIn(3 * 86400),
      assignedIDs: [studentID], isAIGenerated: true, approvedByTeacher: false, textAlternative: draft.alt });
    s.add('assignments', a);
    if (approve) { s.approveAIAssignment(a.id); setStatus('Задание утверждено и отправлено ученику.'); }
    else {
      for (const t of s.users('teacher')) s.notify(t.id, 'AI подготовил задание — нужна проверка', a.title, 'ai');
      setStatus('Черновик сохранён. Он не виден ученику до утверждения педагогом.');
    }
    setDraft({ title: '', details: '', alt: '' });
  };
  return (
    <Page title="Генерация заданий AI">
      <Card><span>AI создаёт черновик задания с учётом прогресса, интересов и особых потребностей ученика. Ученик увидит задание только после проверки и утверждения педагогом.</span></Card>
      <Card>
        <h3>Для кого</h3>
        <Select label="Ученик" value={studentID} onChange={(id) => { setStudentID(id); if (id && !subject) setSubject(analyze(id, s).weakest?.subject ?? ''); }}
          options={[{ value: '', label: 'Выберите' }, ...s.students.map((x) => ({ value: x.id, label: x.fullName }))]} />
        <div className="form-grid">
          <TextInput label="Предмет" value={subject} onChange={setSubject} />
          <TextInput label="Тема" value={topic} onChange={setTopic} />
        </div>
        <Segmented value={difficulty} onChange={setDifficulty} options={[{ value: '1', label: 'Базовая' }, { value: '2', label: 'Средняя' }, { value: '3', label: 'Повышенная' }]} />
        <button className="btn primary" disabled={!studentID || !subject || !topic} onClick={() => {
          const t = generateTask(studentID, subject, topic, Number(difficulty), s);
          setDraft({ title: t.title, details: t.details, alt: t.textAlternative });
          setStatus('Черновик создан локальным генератором. Проверьте его перед отправкой.');
        }}>✨ Сгенерировать черновик</button>
      </Card>
      {draft.title && (
        <Card>
          <h3>Черновик — отредактируйте перед отправкой</h3>
          <TextInput label="Название" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
          <TextInput label="Задание" multiline rows={8} value={draft.details} onChange={(v) => setDraft({ ...draft, details: v })} />
          <TextInput label="Текстовая альтернатива" multiline rows={3} value={draft.alt} onChange={(v) => setDraft({ ...draft, alt: v })} />
          <div className="row wrap">
            <button className="btn" onClick={() => save(false)}>Сохранить на проверку педагогу</button>
            {KKSURoleExtra.canTeach(s.role) && <button className="btn primary" onClick={() => save(true)}>Я проверил(а) — утвердить и отправить ученику</button>}
          </div>
        </Card>
      )}
      {status && <span className="muted">{status}</span>}
      <Section title="Ожидают проверки" icon="hourglass">
        <Card><div className="list">
          {pending.length === 0 && <span className="muted">Нет черновиков</span>}
          {pending.map((a) => (
            <Link key={a.id} className="list-item" to={routePath('aiTaskGenerator', 'review/' + a.id)}>
              <span className="stack tight" style={{ flex: 1 }}><span>{a.title}</span><span className="muted small">{a.assignedIDs.map((x) => s.userName(x)).join(', ')}</span></span><span className="muted">›</span>
            </Link>
          ))}
        </div></Card>
      </Section>
    </Page>
  );
}

function AIAssignmentReview({ assignmentID }: { assignmentID: string }) {
  const s = useStore();
  const navigate = useNavigate();
  const a = s.db.assignments.find((x) => sameId(x.id, assignmentID));
  if (!a) return <Page title="Проверка AI-задания"><EmptyState text="Задание удалено" icon="trash" /></Page>;
  const set = (patch: Partial<M.Assignment>) => s.update('assignments', a.id, patch);
  return (
    <Page title="Проверка AI-задания">
      <Card><span style={{ color: 'purple' }}>✨ Сгенерировано AI. Проверьте корректность, уровень сложности и адаптацию.</span></Card>
      <Card>
        <TextInput label="Название" value={a.title} onChange={(v) => set({ title: v })} />
        <TextInput label="Текст задания" multiline rows={8} value={a.details} onChange={(v) => set({ details: v })} />
        <TextInput label="Текстовая альтернатива" multiline rows={3} value={a.textAlternative} onChange={(v) => set({ textAlternative: v })} />
        <div className="form-grid">
          <DateInput label="Срок сдачи" value={a.dueDate} onChange={(v) => set({ dueDate: v })} />
          <NumberInput label="Максимальный балл" value={a.maxScore} min={1} max={100} onChange={(v) => set({ maxScore: v })} />
        </div>
        <span className="small">Ученик: {a.assignedIDs.map((x) => s.userName(x)).join(', ')}</span>
      </Card>
      {KKSURoleExtra.canTeach(s.role) && (a.approvedByTeacher ? <span className="ok">✅ Утверждено</span> : (
        <div className="row wrap">
          <button className="btn primary" onClick={() => { s.approveAIAssignment(a.id); navigate(-1); }}>Утвердить и отправить ученику</button>
          <button className="btn danger" onClick={() => { s.remove('assignments', a.id); navigate(-1); }}>Отклонить черновик</button>
        </div>
      ))}
    </Page>
  );
}

// MARK: Анализ прогресса (82)

export function ProgressAnalysisScreen() {
  const s = useStore();
  const staff = KKSURoleExtra.canTeach(s.role) || s.role === 'psychologist';
  const all = staff ? s.students.map((x) => analyze(x.id, s)) : [];
  return (
    <Page title="Анализ прогресса">
      {staff && all.length > 0 && <Card><h3>Сводка по ученикам</h3><HBarChart data={all.map((a) => ({ label: s.userName(a.studentID), value: Math.round(a.overall * 100), color: RISK_COLOR[a.risk] }))} max={100} /></Card>}
      <StudentScoped>{(id) => {
        const a = analyze(id, s);
        const insights = teacherInsights([a], s);
        return (
          <>
            <ProgressDashboardContent studentID={id} />
            <Card>
              <h3>Динамика по предметам</h3>
              {a.subjects.length === 0 && <span className="muted">Оценок пока нет</span>}
              {a.subjects.map((x) => (
                <div key={x.subject} className="row"><span style={{ flex: 1 }}>{x.subject}</span><b>{Math.round(x.average * 100)}%</b>
                  <span className="small" style={{ color: x.trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>{x.trend >= 0 ? '↗' : '↘'} {x.trend >= 0 ? '+' : ''}{Math.round(x.trend * 100)}%</span>
                  <span className="muted small">({x.count})</span></div>
              ))}
            </Card>
            {insights.length > 0 && <Section title="Выводы" icon="lightbulb.fill">{insights.map((i, n) => <InsightCard key={n} insight={i} />)}</Section>}
          </>
        );
      }}</StudentScoped>
    </Page>
  );
}

// MARK: Рекомендации педагогу (83)

export function TeacherRecommendationsScreen() {
  const s = useStore();
  const [priority, setPriority] = useState<RiskLevel | ''>('');
  const insights = teacherInsights(s.students.map((x) => analyze(x.id, s)), s).filter((i) => !priority || i.priority === priority);
  return (
    <Page title="Рекомендации педагогу">
      <span className="muted">Рекомендации формируются автоматически по оценкам, тестам, посещаемости, дедлайнам и профилю ученика.</span>
      <div className="chips">
        {([['', 'Все'], ['high', 'Срочно'], ['medium', 'Внимание'], ['low', 'Идеи']] as const).map(([v, l]) => (
          <button key={v} className={'chip' + (priority === v ? ' on' : '')} onClick={() => setPriority(v)}>{l}</button>
        ))}
      </div>
      {insights.length === 0 && <EmptyState text="Нет рекомендаций" icon="checkmark.circle" />}
      {insights.map((i, n) => (
        <div key={n} className="stack tight">
          <InsightCard insight={i} />
          <div className="row wrap small">
            <Link to={studentLink(i.studentID)}>👤 Ученик</Link>
            <Link to={routePath('chat', 'u/' + i.studentID)}>💬 Написать</Link>
            <Link to={routePath('aiTaskGenerator')}>✨ AI-задание</Link>
          </div>
        </div>
      ))}
    </Page>
  );
}
