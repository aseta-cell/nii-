// «Мои данные» (выгрузка, согласия, данные детей, удаление) и «Сервер KKSU» — как KKSUPrivacy.swift и KKSUCloudViews.swift.
import { Link } from 'react-router-dom';
import * as M from '../core/models.gen';
import { CLOUD, memberRole } from '../core/cloud';
import { sameId } from '../core/ids';
import { Card, InfoRow, Page, RouteRow, Section, confirmAction, useStore } from '../ui/kit';
import { DeleteAccountButton } from './Communication';

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function MyDataScreen() {
  const s = useStore();
  const me = s.currentUser;
  if (!me) return null;
  const children = s.db.users.filter((u) => me.linkedStudentIDs.some((x) => sameId(x, u.id)));
  const fileName = (u: M.KKSUUser) => `KKSU-data-${u.fullName.split(' ')[0] || 'user'}.json`;
  return (
    <Page title="Данные и конфиденциальность">
      <Card><div className="list">
        <Link className="list-item" to="/privacy"><span style={{ flex: 1 }}>Политика конфиденциальности</span><span className="muted">›</span></Link>
        <Link className="list-item" to="/terms"><span style={{ flex: 1 }}>Условия использования</span><span className="muted">›</span></Link>
        {(s.role === 'parent' || s.role === 'admin') && <RouteRow route="consents" subtitle="Подписать или отозвать согласия" />}
      </div></Card>
      <Section title="Мои данные" icon="square.and.arrow.down">
        <Card>
          <button className="btn" onClick={() => download(fileName(me), s.exportData(me.id))}>⬇️ Выгрузить мои данные (JSON)</button>
          <span className="muted small">Файл содержит ваш профиль, учебные работы, оценки, сообщения, сертификаты и платежи.</span>
        </Card>
      </Section>
      {s.role === 'parent' && children.length > 0 && (
        <Section title="Данные детей" icon="person.2">
          <Card><div className="list">
            {children.map((c) => (
              <div key={c.id} className="list-item">
                <span style={{ flex: 1 }}>{c.fullName}</span>
                <button className="btn small" aria-label="Выгрузить" onClick={() => download(fileName(c), s.exportData(c.id))}>⬇️</button>
                <button className="btn small danger" aria-label="Удалить данные" onClick={() => {
                  if (confirmAction(`Удалить учебные данные ребёнка «${c.fullName}»? Это действие нельзя отменить.`)) s.deleteChildData(c.id);
                }}>🗑</button>
              </div>
            ))}
          </div></Card>
        </Section>
      )}
      <Card>
        <DeleteAccountButton />
        <span className="muted small">Аккаунт и связанные с ним данные будут удалены без возможности восстановления. Записи об оплатах хранятся обезличенно, как требует бухгалтерский учёт.</span>
      </Card>
    </Page>
  );
}

const STATUS: Record<string, [string, string, string]> = {
  signedOut: ['👤', 'Не выполнен вход', 'var(--text-2)'],
  loading: ['⏳', 'Загрузка…', 'var(--warning)'],
  syncing: ['🔄', 'Синхронизация…', 'var(--warning)'],
  synced: ['☁️', 'Данные синхронизированы', 'var(--success)'],
  failed: ['⚠️', 'Ошибка синхронизации', 'var(--danger)'],
};

export function CloudSettingsScreen() {
  const s = useStore();
  const [icon, title, color] = STATUS[s.status] ?? STATUS.signedOut;
  const pending = s.members.filter((m) => !m.approved && !m.blocked);
  const act = (p: Promise<unknown>) => p.catch((e: Error) => alert(e.message));
  return (
    <Page title="Сервер KKSU">
      <Card>
        <h3>Статус</h3>
        <span style={{ color }}>{icon} {title}</span>
        {s.statusMessage && s.status === 'failed' && <span className="muted small">{s.statusMessage}</span>}
        <button className="btn" onClick={() => void s.sync()}>🔄 Синхронизировать сейчас</button>
        <span className="muted small">Аккаунты, задания, оценки, чат и оплаты общие для сайта и приложения KKSU на iPhone.</span>
        <InfoRow label="Сервер" value={new URL(CLOUD.projectURL).host} />
        <InfoRow label="Код школы" value={CLOUD.schoolID} />
      </Card>
      {s.role === 'admin' && (
        <>
          <Section title="Сотрудники ожидают подтверждения" icon="person.badge.clock">
            <Card>
              {pending.length === 0 && <span className="muted">Новых заявок нет</span>}
              {pending.map((m) => (
                <div key={m.user_id} className="row">
                  <div className="stack tight" style={{ flex: 1 }}><span>{m.full_name || 'Без имени'}</span><span className="muted small">{M.KKSURole.title[memberRole(m)]}</span></div>
                  <button className="btn primary small" onClick={() => act(s.updateMember(m.user_id, { approved: true }))}>Подтвердить</button>
                  <button className="btn small danger" aria-label="Отклонить" onClick={() => act(s.updateMember(m.user_id, { blocked: true }))}>✕</button>
                </div>
              ))}
              <span className="muted small">Педагоги, психологи, эксперты, наставники и администраторы получают доступ к данным учеников только после подтверждения.</span>
            </Card>
          </Section>
          <Section title="Участники школы" icon="person.3">
            <Card>
              <span>Всего участников: {s.members.length}</span>
              {M.KKSURole.values.map((r) => {
                const n = s.members.filter((m) => memberRole(m) === r && m.approved).length;
                return n ? <InfoRow key={r} label={M.KKSURole.title[r]} value={n} /> : null;
              })}
              <button className="btn" onClick={() => act(s.refreshMembers())}>Обновить список</button>
              <span className="muted small">Стартовый учебный контент загружается из приложения KKSU на iPhone (Профиль → Сервер KKSU).</span>
            </Card>
          </Section>
        </>
      )}
    </Page>
  );
}
