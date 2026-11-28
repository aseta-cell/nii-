// Чат ученик–преподаватель (34), уведомления (35), жалобы, блокировка, модерация (Guideline 1.2),
// удаление аккаунта — как KKSUCommunication.swift и KKSUModerationViews.swift.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KKSURole, NotificationKind, ReportReason, ReportedContentKind, ReportStatus } from '../core/models.gen';
import { containsObjectionable } from '../core/helpers';
import { sameId, time } from '../core/ids';
import { Avatar, Badge, Card, EmptyState, fmt, InfoRow, Modal, Page, Select, TextInput, Toggle, useModuleLink, useStore, useSub, confirmAction, Segmented } from '../ui/kit';
import { Icon } from '../ui/icon';

export interface ReportTarget { kind: ReportedContentKind; contentID?: string; reportedUserID?: string; excerpt: string }

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const s = useStore();
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [comment, setComment] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [sent, setSent] = useState(false);
  return (
    <Modal title="Пожаловаться" onClose={onClose}>
      {sent ? (
        <div className="stack">
          <span className="ok bold">✅ Жалоба отправлена</span>
          <span>Модератор KKSU рассмотрит её в течение 24 часов. Этот контент уже скрыт у вас.</span>
          <button className="btn primary" onClick={onClose}>Готово</button>
        </div>
      ) : (
        <div className="form">
          <Card className="soft">
            <span className="muted small">{ReportedContentKind.title[target.kind]}</span>
            <span className="pre">{target.excerpt.slice(0, 400)}</span>
            {target.reportedUserID && <InfoRow label="Автор" value={s.userName(target.reportedUserID)} />}
          </Card>
          <Select label="Причина" value={reason} onChange={setReason} options={ReportReason.values.map((r) => ({ value: r, label: ReportReason.title[r] }))} />
          <TextInput label="Комментарий (необязательно)" value={comment} onChange={setComment} multiline rows={3} />
          {target.reportedUserID && !sameId(target.reportedUserID, s.db.currentUserID) && (
            <Toggle checked={alsoBlock} onChange={setAlsoBlock} label={`Заблокировать ${s.userName(target.reportedUserID)}`}
              hint="Вы больше не увидите сообщения и публикации этого пользователя. Разблокировать можно в «Профиль → Заблокированные пользователи»." />
          )}
          <div className="row"><span className="spacer" />
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={() => {
              s.report(target.kind, target.contentID, target.reportedUserID, target.excerpt, reason, comment, alsoBlock && !!target.reportedUserID);
              setSent(true);
            }}>Отправить</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function lastDate(s: ReturnType<typeof useStore>, threadID: string) {
  return Math.max(0, ...s.db.messages.filter((m) => sameId(m.threadID, threadID)).map((m) => time(m.date)));
}

export function ChatScreen() {
  const sub = useSub();
  if (sub[0] === 't' && sub[1]) return <ChatThreadView threadID={sub[1]} />;
  if (sub[0] === 'u' && sub[1]) return <ChatThreadView otherID={sub[1]} />;
  if (sub[0] === 'new') return <NewChat />;
  return <ChatList />;
}

function ChatList() {
  const s = useStore();
  const link = useModuleLink();
  const me = s.db.currentUserID;
  const blocked = s.blockedUserIDs;
  const threads = s.db.threads
    .filter((t) => me && t.participantIDs.some((p) => sameId(p, me)) && !t.participantIDs.some((p) => blocked.some((b) => sameId(b, p))))
    .sort((a, b) => lastDate(s, b.id) - lastDate(s, a.id));
  return (
    <Page title="Сообщения" back={false} actions={<Link className="btn primary" to={link('new')}>✏️ Новый диалог</Link>}>
      <Card>
        {threads.length === 0 && <EmptyState text="Диалогов пока нет. Начните новый." icon="bubble.left.and.bubble.right" />}
        <div className="list">
          {threads.map((t) => {
            const other = t.participantIDs.find((p) => !sameId(p, me));
            const msgs = s.db.messages.filter((m) => sameId(m.threadID, t.id) && !s.isReportedByMe(m.id));
            const last = msgs.sort((a, b) => time(b.date) - time(a.date))[0];
            const unread = msgs.filter((m) => me && !m.readBy.some((r) => sameId(r, me))).length;
            return (
              <Link key={t.id} className="list-item" to={link('t/' + t.id)}>
                <Avatar name={s.userName(other)} size={44} />
                <span className="stack tight" style={{ flex: 1, minWidth: 0 }}>
                  <span><b>{s.userName(other)}</b> <span className="muted tiny">{other ? KKSURole.title[s.user(other)?.role ?? 'student'] : ''}</span></span>
                  <span className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last?.text ?? 'Нет сообщений'}</span>
                </span>
                {unread > 0 && <span className="dot" style={{ position: 'static' }}>{unread}</span>}
              </Link>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}

function NewChat() {
  const s = useStore();
  const link = useModuleLink();
  const me = s.currentUser;
  const staff: KKSURole[] = ['teacher', 'mentor', 'psychologist', 'admin'];
  const contacts = s.db.users.filter((u) => !sameId(u.id, me?.id) && !u.isBlocked && !s.hasBlocked(u.id) &&
    (me?.role === 'student' || me?.role === 'parent' ? staff.includes(u.role) : true));
  const [q, setQ] = useState('');
  const list = contacts.filter((u) => !q || u.fullName.toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Новый диалог">
      <TextInput value={q} onChange={setQ} placeholder="Поиск по имени" />
      <Card>
        {list.length === 0 && <EmptyState text="Нет доступных собеседников" icon="person.2" />}
        <div className="list">
          {list.map((u) => (
            <Link key={u.id} className="list-item" to={link('u/' + u.id)}>
              <Avatar name={u.fullName} size={36} />
              <span className="stack tight"><span>{u.fullName}</span><span className="muted small">{KKSURole.title[u.role]}</span></span>
            </Link>
          ))}
        </div>
      </Card>
    </Page>
  );
}

function ChatThreadView({ threadID, otherID }: { threadID?: string; otherID?: string }) {
  const s = useStore();
  const me = s.db.currentUserID;
  const [text, setText] = useState('');
  const [warning, setWarning] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const link = useModuleLink();
  const thread = threadID ? s.db.threads.find((t) => sameId(t.id, threadID)) : otherID ? s.findThread(otherID) : undefined;
  const partner = otherID ?? thread?.participantIDs.find((p) => !sameId(p, me));
  const isBlocked = s.hasBlocked(partner);
  const messages = useMemo(() => (thread ? s.db.messages.filter((m) => sameId(m.threadID, thread.id) && !s.isReportedByMe(m.id) &&
    !(!sameId(m.senderID, me) && isBlocked)).sort((a, b) => time(a.date) - time(b.date)) : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [s.getVersion(), thread?.id, isBlocked]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); if (thread) s.markThreadRead(thread.id); }, [messages.length, thread, s]);

  const send = () => {
    if (!text.trim() || !partner) return;
    if (containsObjectionable(text)) { setWarning(true); return; }
    const t = thread ?? s.thread(partner);
    s.send(text, t.id);
    setText('');
    if (!threadID) navigate(link('t/' + t.id), { replace: true });
  };

  return (
    <Page title={s.userName(partner)} actions={partner && (
      <div style={{ position: 'relative' }}>
        <button className="btn" onClick={() => setMenu(!menu)} aria-label="Действия с пользователем">⋯</button>
        {menu && (
          <div className="card" style={{ position: 'absolute', right: 0, top: 44, zIndex: 20, minWidth: 260, padding: 8 }}>
            <button className="btn danger-text block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); setReport({ kind: 'user', contentID: partner, reportedUserID: partner, excerpt: `Пользователь ${s.userName(partner)}` }); }}>⚠️ Пожаловаться на пользователя</button>
            {isBlocked
              ? <button className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); s.unblockUser(partner); }}>✋ Разблокировать</button>
              : <button className="btn danger-text block" style={{ justifyContent: 'flex-start' }} onClick={() => { setMenu(false); s.blockUser(partner); }}>🚫 Заблокировать</button>}
          </div>
        )}
      </div>
    )}>
      <Card className="chat">
        <div className="chat-messages">
          {messages.length === 0 && <EmptyState text="Напишите первое сообщение" icon="bubble.left" />}
          {messages.map((m) => {
            const mine = sameId(m.senderID, me);
            return (
              <div key={m.id} className={'bubble-row' + (mine ? ' mine' : '')}>
                <div className="bubble">
                  {m.text}
                  <div className="meta row">
                    {fmt.dateTime(m.date)}
                    {!mine && <button className="btn link tiny" style={{ color: 'inherit', opacity: 0.8 }} onClick={() => setReport({ kind: 'message', contentID: m.id, reportedUserID: m.senderID, excerpt: m.text })}>Пожаловаться</button>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
        {isBlocked && partner ? (
          <div className="row" style={{ paddingTop: 10 }}>
            <span className="muted">Вы заблокировали этого пользователя</span><span className="spacer" />
            <button className="btn" onClick={() => s.unblockUser(partner)}>Разблокировать</button>
          </div>
        ) : (
          <>
            {warning && <span className="error small">Сообщение содержит недопустимые слова и не может быть отправлено.</span>}
            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea value={text} rows={1} style={{ minHeight: 42 }} placeholder="Сообщение" onChange={(e) => { setText(e.target.value); setWarning(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <button className="btn primary" disabled={!text.trim()} aria-label="Отправить">➤</button>
            </form>
          </>
        )}
      </Card>
      {report && <ReportDialog target={report} onClose={() => setReport(null)} />}
    </Page>
  );
}

export function NotificationsScreen() {
  const s = useStore();
  return (
    <Page title="Уведомления" back={false} actions={<button className="btn" disabled={s.unreadCount === 0} onClick={() => s.markAllRead()}>Прочитать все</button>}>
      <Card>
        {s.myNotifications.length === 0 && <EmptyState text="Уведомлений нет" icon="bell.slash" />}
        <div className="list">
          {s.myNotifications.map((n) => (
            <div key={n.id} className="list-item" style={{ cursor: 'pointer', alignItems: 'flex-start' }}
              onClick={() => !n.isRead && s.update('notifications', n.id, { isRead: true })}>
              <span style={{ opacity: n.isRead ? 0.5 : 1 }}><Icon name={NotificationKind.icon[n.kind]} /></span>
              <span className="stack tight" style={{ flex: 1 }}>
                <span className={n.isRead ? '' : 'bold'}>{n.title}</span>
                <span className="muted small pre">{n.body}</span>
                <span className="muted tiny">{fmt.relative(n.date)}</span>
              </span>
              <button className="btn small danger-text" aria-label="Удалить" onClick={(e) => { e.stopPropagation(); s.remove('notifications', n.id); }}>🗑️</button>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

export function BlockedUsersScreen() {
  const s = useStore();
  const list = [...s.blockedUserIDs].sort((a, b) => s.userName(a).localeCompare(s.userName(b)));
  return (
    <Page title="Заблокированные">
      <Card>
        {list.length === 0 && <EmptyState text="Вы никого не блокировали" icon="hand.raised" />}
        <div className="list">
          {list.map((id) => (
            <div key={id} className="list-item">
              <Avatar name={s.userName(id)} size={36} /><span style={{ flex: 1 }}>{s.userName(id)}</span>
              <button className="btn" onClick={() => s.unblockUser(id)}>Разблокировать</button>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

export function ModerationScreen() {
  const s = useStore();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const reports = tab === 'closed' ? s.db.contentReports.filter((r) => r.status !== 'open').sort((a, b) => time(b.createdAt) - time(a.createdAt)) : s.openReports;
  const [working, setWorking] = useState('');
  return (
    <Page title="Модерация">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'open', label: `Новые · ${s.openReports.length}` }, { value: 'closed', label: 'Рассмотренные' }]} />
      {reports.length === 0 && <EmptyState text={tab === 'closed' ? 'Рассмотренных жалоб нет' : 'Новых жалоб нет'} icon="checkmark.shield" />}
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="row"><b><Icon name={ReportedContentKind.icon[r.kind]} /> {ReportedContentKind.title[r.kind]}</b><span className="spacer" />
            <Badge text={ReportStatus.title[r.status]} color={r.status === 'open' ? 'var(--danger)' : 'var(--text-2)'} /></div>
          <b style={{ color: 'var(--danger)' }}>{ReportReason.title[r.reason]}</b>
          <span className="pre">{r.excerpt}</span>
          {r.comment && <span className="small">Комментарий: {r.comment}</span>}
          <span className="muted small">От: {s.userName(r.reporterID)} · на: {s.userName(r.reportedUserID)} · {fmt.dateTime(r.createdAt)}</span>
          {r.status === 'open' ? (
            <div className="row wrap">
              {r.kind !== 'user' && <button className="btn warning small" onClick={() => s.removeReportedContent(r.id)}>Удалить контент</button>}
              {r.reportedUserID && <button className="btn danger small" disabled={working === r.id} onClick={async () => { setWorking(r.id); await s.banReportedUser(r.id); setWorking(''); }}>Заблокировать автора</button>}
              <button className="btn small" onClick={() => s.closeReport(r.id, 'dismissed', 'Нарушений не найдено')}>Отклонить</button>
            </div>
          ) : r.resolution && <span className="ok small">{r.resolution}</span>}
        </Card>
      ))}
    </Page>
  );
}

export function DeleteAccountButton() {
  const s = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="stack tight">
      <button className="btn danger-text" style={{ justifyContent: 'flex-start' }} disabled={busy} onClick={async () => {
        if (!confirmAction('Удалить аккаунт навсегда?\n\nПрофиль, работы, сообщения и другие данные будут удалены без возможности восстановления.')) return;
        setBusy(true); setError('');
        try { await s.deleteMyAccount(); navigate('/'); } catch (e) { setError(`${(e as Error).message} Проверьте интернет и попробуйте ещё раз.`); }
        setBusy(false);
      }}>🗑️ {busy ? 'Удаляем…' : 'Удалить аккаунт'}</button>
      {error && <span className="error small">{error}</span>}
    </div>
  );
}
