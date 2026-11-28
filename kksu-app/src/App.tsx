// Оболочка сайта: маршруты, верхнее меню и нижние вкладки, применение настроек доступности.
import { useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { store } from './core/store';
import { CABINET_FOR, FEATURES, MODULE_SECTIONS, ROUTES, isAvailable, type RouteId } from './core/routes.gen';
import { KKSURole } from './core/models.gen';
import { Avatar, Badge, Card, EmptyState, Page, RouteGate, RouteRow, routePath, TextInput, useScrollTop, useStore } from './ui/kit';
import { Icon } from './ui/icon';
import { Forgot, Landing, Login, PrivacyPage, Register, TermsPage } from './screens/Auth';
import { BlockedUsersScreen, DeleteAccountButton, NotificationsScreen } from './screens/Communication';
import { SCREENS } from './screens/registry';
import { StudentOverview } from './screens/Student';

/** Адрес основного сайта NII, в который встроен модуль KKSU. */
const NII_HOME = '../kksu.html';

function useAccessibilityAttributes() {
  const s = useStore();
  const a = s.accessibility;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scale', String(a.textScale || 1));
    root.dataset.theme = a.darkMode;
    root.dataset.contrast = a.highContrast ? 'high' : 'normal';
    root.dataset.font = a.dyslexiaFriendlyFont ? 'dyslexia' : 'default';
    root.dataset.bold = String(a.boldText);
    root.dataset.motion = a.reduceMotion ? 'reduce' : 'normal';
    root.dataset.largeButtons = String(a.largeButtons);
  }, [a.textScale, a.darkMode, a.highContrast, a.dyslexiaFriendlyFont, a.boldText, a.reduceMotion, a.largeButtons]);
}

function SyncBadge() {
  const s = useStore();
  const map = { signedOut: ['', ''], loading: ['⏳', 'Загрузка…'], syncing: ['🔄', 'Синхронизация…'], synced: ['☁️', 'Сохранено'], failed: ['⚠️', 'Нет связи'] } as const;
  const [icon, text] = map[s.status];
  if (!icon) return null;
  return <span className="muted small" title={s.statusMessage || text} style={{ whiteSpace: 'nowrap' }}>{icon} <span className="home-link">{text}</span></span>;
}

function TopBar() {
  const s = useStore();
  const user = s.currentUser;
  const tabs = user ? [
    { to: '/', icon: 'house.fill', label: 'Кабинет', end: true },
    { to: '/modules', icon: 'square.grid.2x2.fill', label: 'Модули' },
    { to: routePath('chat'), icon: 'bubble.left.and.bubble.right.fill', label: 'Чат' },
    { to: '/notifications', icon: 'bell.fill', label: 'Уведомления', badge: s.unreadCount },
    { to: '/account', icon: 'person.crop.circle', label: 'Профиль' },
  ] : [];
  return (
    <>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <Link className="brand" to="/"><span className="brand-mark">KKSU</span><span>KKSU Online</span></Link>
          <nav className="topnav" aria-label="Разделы">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {t.label}{t.badge ? <span className="dot">{t.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-right">
            <a className="home-link" href={NII_HOME}>← KKSU · НИИ AR-AI</a>
            <SyncBadge />
            {user ? <Link to="/account" aria-label="Профиль"><Avatar name={user.fullName} size={34} /></Link>
              : <Link className="btn primary small" to="/login">Войти</Link>}
          </div>
        </div>
      </header>
      {user && (
        <nav className="tabbar no-print" aria-label="Вкладки">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={t.icon} /><span>{t.label}</span>{t.badge ? <span className="dot">{t.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

function ModuleRoute() {
  const { route } = useParams();
  const id = route as RouteId;
  const Screen = SCREENS[id];
  if (!ROUTES[id] || !Screen) return <Page title="Раздел не найден"><EmptyState text="Такого раздела нет." icon="questionmark" /></Page>;
  return <RouteGate route={id}><Screen /></RouteGate>;
}

function StudentRoute() {
  const { id } = useParams();
  const s = useStore();
  const allowed = !!id && s.role !== 'student' && s.visibleStudents.some((x) => x.id.toUpperCase() === id.toUpperCase());
  if (!allowed) return <Page title="Ученик"><EmptyState text="Нет доступа к данным этого ученика." icon="lock" /></Page>;
  return <StudentOverview studentID={id} />;
}

function Cabinet() {
  const s = useStore();
  const Screen = SCREENS[CABINET_FOR[s.role]];
  return <Screen />;
}

export function ModulesHub() {
  const s = useStore();
  const [q, setQ] = useState('');
  const sections = MODULE_SECTIONS.map((sec) => ({ ...sec, routes: sec.routes.filter((r) => isAvailable(r, s.role) && (!q || ROUTES[r].title.toLowerCase().includes(q.toLowerCase()))) }))
    .filter((sec) => sec.routes.length > 0);
  return (
    <Page title="Модули KKSU" back={false} wide>
      <TextInput value={q} onChange={setQ} placeholder="Найти модуль" />
      {sections.map((sec) => (
        <div key={sec.title} className="stack">
          <h2>{sec.title}</h2>
          <div className="grid" style={{ ['--min' as string]: '170px' }}>
            {sec.routes.map((r) => (
              <Link key={r} className="tile" to={routePath(r)}><Icon name={ROUTES[r].icon} /><span className="title">{ROUTES[r].title}</span></Link>
            ))}
          </div>
        </div>
      ))}
      {sections.length === 0 && <EmptyState text="Ничего не найдено" icon="magnifyingglass" />}
    </Page>
  );
}

function Account() {
  const s = useStore();
  const user = s.currentUser!;
  return (
    <Page title="Профиль" back={false}>
      <Card>
        <div className="row">
          <Avatar name={user.fullName} size={56} />
          <div className="stack tight"><b style={{ fontSize: '1.15rem' }}>{user.fullName}</b><span className="muted small">{user.email}</span><Badge text={KKSURole.title[user.role]} /></div>
        </div>
      </Card>
      <Card><h3>Оплата</h3><div className="list">
        <RouteRow route="paymentHistory" subtitle="Счета, чеки, статусы, возвраты" />
        <RouteRow route="marketplace" subtitle="Курсы, программы, подписки" />
        <RouteRow route="subscriptions" />
      </div></Card>
      <Card><h3>Мои данные</h3><div className="list">
        {user.role === 'student' && <RouteRow route="studentProfile" />}
        <RouteRow route="certificates" /><RouteRow route="history" />
      </div></Card>
      <Card><h3>Персонализация</h3><div className="list">
        <RouteRow route="accessibility" subtitle="Размер текста, контраст, шрифт" />
        <RouteRow route="learningSettings" subtitle="Темп, форматы, цели" />
        <RouteRow route="aiAssistant" />
      </div></Card>
      <Card><h3>Конфиденциальность</h3><div className="list">
        <RouteRow route="myData" subtitle="Выгрузка данных, согласия, удаление" />
        <Link className="list-item" to="/blocked"><Icon name="hand.raised.slash" /><span style={{ flex: 1 }}>Заблокированные пользователи</span><span className="muted">›</span></Link>
        {user.role === 'admin' && <RouteRow route="moderation" subtitle={s.openReports.length ? `Новых жалоб: ${s.openReports.length}` : 'Новых жалоб нет'} />}
        <RouteRow route="cloudSettings" subtitle={s.status === 'synced' ? 'Данные синхронизированы' : s.statusMessage || 'Сервер KKSU'} />
        <Link className="list-item" to="/privacy"><Icon name="hand.raised" /><span style={{ flex: 1 }}>Политика конфиденциальности</span><span className="muted">›</span></Link>
        <Link className="list-item" to="/terms"><Icon name="doc.text" /><span style={{ flex: 1 }}>Условия использования</span><span className="muted">›</span></Link>
      </div></Card>
      <Card><h3>Платформа</h3><div className="list">
        {user.role === 'admin' && <RouteRow route="featureMap" subtitle="Все модули KKSU Online" />}
        <RouteRow route="impactPublic" />
      </div></Card>
      <Card>
        <h3>Аккаунт</h3>
        <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => s.logout()}>↩️ Выйти</button>
        <DeleteAccountButton />
        <span className="muted small">Удаление аккаунта стирает профиль и ваши данные без возможности восстановления.</span>
      </Card>
    </Page>
  );
}

export function FeatureMap() {
  const s = useStore();
  const [q, setQ] = useState('');
  const list = FEATURES.filter((f) => !q || f.title.toLowerCase().includes(q.toLowerCase()) || String(f.id) === q);
  return (
    <Page title="Карта задач">
      <span className="muted">Все {FEATURES.length} задач KKSU Online. Нажмите на задачу, чтобы открыть модуль.</span>
      <TextInput value={q} onChange={setQ} placeholder="Номер или название" />
      <Card><div className="list">
        {list.map((f) => (
          <Link key={f.id} className="list-item" to={routePath(f.route)}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>{f.id}</span>
            <span className="stack tight" style={{ flex: 1 }}><span>{f.title}</span><span className="muted small">{f.note || ROUTES[f.route].title}</span></span>
            <span>{isAvailable(f.route, s.role) ? '✅' : '🔒'}</span>
          </Link>
        ))}
      </div></Card>
    </Page>
  );
}

function Shell() {
  const s = useStore();
  useAccessibilityAttributes();
  useScrollTop();
  const location = useLocation();
  const signedIn = !!s.currentUser;
  if (s.status === 'loading' && !signedIn) {
    return <div className="app"><TopBar /><main className="main"><EmptyState text="Загружаем данные школы…" icon="hourglass" /></main></div>;
  }
  const publicPaths = ['/login', '/register', '/forgot'];
  return (
    <div className="app">
      <TopBar />
      <main className="main">
        {signedIn ? (
          <Routes>
            <Route path="/" element={<Cabinet />} />
            <Route path="/modules" element={<ModulesHub />} />
            <Route path="/notifications" element={<NotificationsScreen />} />
            <Route path="/account" element={<Account />} />
            <Route path="/blocked" element={<BlockedUsersScreen />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/m/:route/*" element={<ModuleRoute />} />
            <Route path="/student/:id" element={<StudentRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<Navigate to={publicPaths.includes(location.pathname) ? location.pathname : '/login'} replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default function App() {
  useEffect(() => { void store.start(); }, []);
  return <HashRouter><Shell /></HashRouter>;
}
