// Главная до входа, вход, регистрация, восстановление пароля, политика и условия.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { store, isStrongPassword } from '../core/store';
import { CloudError } from '../core/cloud';
import { KKSURole } from '../core/models.gen';
import { KKSURoleExtra } from '../core/helpers';
import { LEGAL } from '../core/legal';
import { Card, Modal, Page, TextInput, Toggle } from '../ui/kit';
import { Icon } from '../ui/icon';

const INITIATIVES: [string, string, string][] = [
  ['building.columns.fill', 'KKSU Teacher Academy', 'Повышение квалификации педагогов и авторские методики'],
  ['lightbulb.max.fill', 'KKSU Inventions', 'Проекты учеников: от идеи до прототипа'],
  ['sparkles', 'Young Inventors 30', 'Конкурс 30 молодых изобретателей'],
  ['globe.europe.africa.fill', 'Global Classroom', 'Международные онлайн-классы и проекты'],
  ['wrench.and.screwdriver.fill', 'Future Engineers', 'Инженерные курсы, кейсы MASHSTROY, ARAI AI, IKEN, ATA MURA'],
  ['figure.roll', 'Inclusive Engineering', 'Инженерные решения для людей с особыми потребностями'],
];

export function Landing() {
  return (
    <div className="page wide">
      <section className="hero">
        <span className="badge" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', alignSelf: 'flex-start' }}>Comfort School-University</span>
        <h1>KKSU Online</h1>
        <p style={{ maxWidth: 680, fontSize: '1.1rem' }}>
          Инклюзивная образовательная платформа для детей и подростков 7–18 лет, их родителей и педагогов:
          курсы и уроки, онлайн-занятия, домашние задания, индивидуальная траектория, проекты и изобретения.
        </p>
        <div className="row wrap">
          <Link className="btn primary" to="/login">Войти</Link>
          <Link className="btn outline" to="/register">Регистрация — бесплатно</Link>
        </div>
        <p className="small" style={{ opacity: 0.85 }}>Тот же аккаунт работает в iPhone-приложении KKSU Online.</p>
      </section>
      <h2>Направления</h2>
      <div className="grid" style={{ ['--min' as string]: '260px' }}>
        {INITIATIVES.map(([icon, title, text]) => (
          <Card key={title}>
            <span className="row bold" style={{ color: 'var(--primary)' }}><Icon name={icon} /> {title}</span>
            <span className="muted">{text}</span>
          </Card>
        ))}
      </div>
      <h2>Что есть на платформе</h2>
      <div className="grid" style={{ ['--min' as string]: '240px' }}>
        {[
          ['🎓', 'Кабинеты для каждой роли', 'Ученик, родитель, педагог, психолог, эксперт, наставник, партнёр, администратор.'],
          ['🎥', 'Курсы и уроки', 'Онлайн-занятия по ссылке, записи YouTube, конспекты, файлы, тесты и домашние задания.'],
          ['📊', 'Прогресс и аналитика', 'Индивидуальный учебный план, траектория, оценки, посещаемость и рекомендации.'],
          ['♿', 'Доступность', 'Крупный текст, высокий контраст, шрифт для дислексии, текстовые альтернативы.'],
          ['💬', 'Безопасное общение', 'Чат с педагогами, жалобы и блокировка, модерация администратором.'],
          ['🔒', 'Защита данных', 'Каждый видит только свои данные. Выгрузка и удаление аккаунта в один клик.'],
        ].map(([e, t, d]) => (
          <Card key={t}><span style={{ fontSize: '1.6rem' }}>{e}</span><span className="bold">{t}</span><span className="muted small">{d}</span></Card>
        ))}
      </div>
      <div className="row wrap small muted">
        <Link to="/privacy">Политика конфиденциальности</Link> · <Link to="/terms">Условия использования</Link>
      </div>
    </div>
  );
}

function RolePicker({ value, onChange, roles }: { value: KKSURole; onChange: (r: KKSURole) => void; roles: KKSURole[] }) {
  return (
    <div className="grid" style={{ ['--min' as string]: '130px', gap: 8 }}>
      {roles.map((r) => (
        <button key={r} type="button" className={'btn ' + (r === value ? 'primary' : '')} style={{ justifyContent: 'flex-start' }} onClick={() => onChange(r)}>
          <Icon name={KKSURole.icon[r]} /> {KKSURole.title[r]}
        </button>
      ))}
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<KKSURole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(store.statusMessage);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await store.login(email, password, role);
      navigate('/');
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };
  return (
    <div className="auth">
      <Card>
        <h1>Вход в KKSU Online</h1>
        <form className="form" onSubmit={submit}>
          <span className="muted small bold">Выберите вашу роль</span>
          <RolePicker value={role} onChange={setRole} roles={KKSURole.values} />
          <TextInput label="Email" type="email" value={email} onChange={setEmail} autoFocus />
          <TextInput label="Пароль" type="password" value={password} onChange={setPassword} />
          {error && <span className="error">{error}</span>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
        </form>
        <div className="row wrap small">
          <Link to="/forgot">Забыли пароль?</Link><span className="spacer" /><Link to="/register">Регистрация</Link>
        </div>
      </Card>
    </div>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState<KKSURole>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [parentConsent, setParentConsent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);

  const strength = [password.length >= 8, /\d/.test(password), /[A-ZА-Я]/.test(password), /[^\p{L}\d]/u.test(password)].filter(Boolean).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (password !== confirm) return setError('Пароли не совпадают.');
    if (!acceptTerms) return setError('Необходимо принять условия использования.');
    if (role === 'student' && !parentConsent) return setError('Для регистрации ученика младше 18 лет нужно согласие родителя.');
    setBusy(true);
    try {
      await store.register(fullName, email, phone, password, role);
      navigate('/');
    } catch (err) {
      const kind = (err as CloudError).kind;
      if (kind === 'emailConfirmation') setInfo((err as Error).message);
      else if (kind === 'pendingApproval') setInfo('Аккаунт создан. ' + (err as Error).message);
      else setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="auth" style={{ maxWidth: 620 }}>
      <Card>
        <h1>Создайте аккаунт KKSU Online</h1>
        <span className="ok">🎁 Регистрация бесплатная</span>
        <form className="form" onSubmit={submit}>
          <span className="muted small bold">Роль</span>
          <RolePicker value={role} onChange={setRole} roles={KKSURoleExtra.selfRegistrable} />
          <TextInput label="ФИО" value={fullName} onChange={setFullName} />
          <div className="form-grid">
            <TextInput label="Email" type="email" value={email} onChange={setEmail} />
            <TextInput label="Телефон" type="tel" value={phone} onChange={setPhone} />
            <TextInput label="Пароль (от 8 символов, с цифрой)" type="password" value={password} onChange={setPassword} />
            <TextInput label="Повторите пароль" type="password" value={confirm} onChange={setConfirm} />
          </div>
          {password && (
            <div className="stack tight">
              <div className="row" style={{ gap: 4 }}>
                {[0, 1, 2, 3].map((i) => <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < strength ? ['var(--danger)', 'var(--warning)', 'var(--accent)', 'var(--success)'][strength - 1] : 'var(--surface-2)' }} />)}
              </div>
              <span className="muted tiny">{isStrongPassword(password) ? 'Пароль подходит' : 'Минимум 8 символов и одна цифра'}</span>
            </div>
          )}
          {(role === 'teacher' || role === 'psychologist' || role === 'expert' || role === 'mentor') && (
            <span className="muted small">Аккаунты сотрудников получают доступ после подтверждения администратором KKSU.</span>
          )}
          {role === 'parent' && <span className="muted small">Ваших детей к аккаунту привяжет администратор школы (раздел «Пользователи и роли»).</span>}
          <Toggle checked={acceptTerms} onChange={setAcceptTerms} label="Я принимаю условия использования и согласен на обработку персональных данных" />
          <div className="row small"><button type="button" className="btn link" onClick={() => setLegal('privacy')}>Политика конфиденциальности</button> · <button type="button" className="btn link" onClick={() => setLegal('terms')}>Условия</button></div>
          {role === 'student' && (
            <Toggle checked={parentConsent} onChange={setParentConsent} label="Мне есть 18 лет, или мой родитель (законный представитель) согласен на регистрацию и обработку моих данных" />
          )}
          {info && <span className="ok">✉️ {info}</span>}
          {error && <span className="error">⚠️ {error}</span>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}</button>
        </form>
        <div className="small">Уже есть аккаунт? <Link to="/login">Войти</Link></div>
      </Card>
      {legal && <Modal title={legal === 'privacy' ? 'Политика конфиденциальности' : 'Условия использования'} onClose={() => setLegal(null)}><LegalBody sections={legal === 'privacy' ? LEGAL.privacy : LEGAL.terms} /></Modal>}
    </div>
  );
}

export function Forgot() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await store.requestPasswordReset(email); setStep(1); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };
  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await store.resetPassword(email, code, password); setDone(true); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };
  return (
    <div className="auth">
      <Card>
        <span style={{ fontSize: '2.5rem', textAlign: 'center' }}>{done ? '🛡️' : '🔑'}</span>
        {done ? (
          <>
            <h1>Пароль изменён</h1>
            <span className="muted">Теперь войдите с новым паролем.</span>
            <Link className="btn primary block" to="/login">Вернуться ко входу</Link>
          </>
        ) : step === 0 ? (
          <form className="form" onSubmit={request}>
            <h1>Восстановление пароля</h1>
            <span className="muted">Мы отправим 6-значный код на вашу почту.</span>
            <TextInput label="Email" type="email" value={email} onChange={setEmail} autoFocus />
            {error && <span className="error">{error}</span>}
            <button className="btn primary block" disabled={busy || !email}>Получить код</button>
          </form>
        ) : (
          <form className="form" onSubmit={reset}>
            <h1>Введите код</h1>
            <span className="muted">Код отправлен на {email}. Проверьте папку «Спам».</span>
            <TextInput label="Код из письма" value={code} onChange={setCode} autoFocus />
            <TextInput label="Новый пароль (от 8 символов, с цифрой)" type="password" value={password} onChange={setPassword} />
            {error && <span className="error">{error}</span>}
            <button className="btn primary block" disabled={busy || !code || !password}>Сменить пароль</button>
            <button type="button" className="btn link" onClick={() => setStep(0)}>Отправить код ещё раз</button>
          </form>
        )}
      </Card>
    </div>
  );
}

export function LegalBody({ sections }: { sections: [string, string][] }) {
  return (
    <div className="stack loose">
      <span className="muted small">Обновлено {LEGAL.updated}</span>
      {sections.map(([t, b]) => <div key={t} className="stack tight"><h3>{t}</h3><p>{b}</p></div>)}
      <span className="muted small">Вопросы: {LEGAL.contactEmail}</span>
    </div>
  );
}

export function PrivacyPage() { return <Page title="Политика конфиденциальности"><LegalBody sections={LEGAL.privacy} /></Page>; }
export function TermsPage() { return <Page title="Условия использования"><LegalBody sections={LEGAL.terms} /></Page>; }
