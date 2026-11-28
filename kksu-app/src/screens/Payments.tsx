// Оплата на сайте (как KKSUPayments.swift): маркетплейс, счета и чеки, подписки, Teacher Marketplace, сертификация,
// услуги Inventions, выручка, подтверждение оплат, промокоды, стипендии, цены, реквизиты.
// На сайте оплата идёт переводом по счёту (Kaspi, банки РК, международные переводы); доступы общие с приложением.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as M from '../core/models.gen';
import { entitlementActive, invoiceAmount, invoiceTotal, isDigital, paymentInstructions } from '../core/helpers';
import { sameId, time } from '../core/ids';
import {
  AttachmentPicker, AttachmentRow, Badge, Card, DateInput, EmptyState, fmt, InfoRow, Modal, NumberInput, Page, RouteRow, Section, Segmented,
  Select, StatTile, TextInput, Toggle, Tiles, routePath, useStore, useSub,
} from '../ui/kit';
import { Icon } from '../ui/icon';
import { BarChart, PaywallCard, PaywallGate, PriceBadge, escapeHTML, printDocument } from './shared';
import { TestCard } from './Library';

const MAX_DIGITAL_USD = 300;
const LISTING = 'Публикация курса в Teacher Marketplace';
const CERTIFICATION = 'Сертификация преподавателя KKSU';
const usd = (x: number) => `$${x.toFixed(x % 1 ? 2 : 0)}`;

export function statusColor(s: M.PaymentStatus) {
  if (s === 'paid') return 'var(--success)';
  if (s === 'rejected') return 'var(--danger)';
  if (s === 'cancelled' || s === 'refunded') return 'var(--text-2)';
  return 'var(--warning)';
}

const BANK_LINKS: Partial<Record<M.PaymentMethod, [string, string][]>> = {
  kaspi: [['Открыть Kaspi.kz', 'https://kaspi.kz']], halyk: [['Открыть Homebank', 'https://homebank.kz']], freedom: [['Открыть Freedom Bank', 'https://bankffin.kz']],
  jusan: [['Открыть Jusan', 'https://jusan.kz']], forte: [['Открыть ForteBank', 'https://forte.kz']], bereke: [['Открыть Bereke Bank', 'https://berekebank.kz']],
  bcc: [['Открыть BCC', 'https://bcc.kz']], homeCredit: [['Открыть Home Credit', 'https://homebank.kz']],
  internationalCard: [['Korona Pay', 'https://koronapay.com']], koronaPay: [['Korona Pay', 'https://koronapay.com']],
  westernUnion: [['Western Union', 'https://www.westernunion.com']], wise: [['Wise', 'https://wise.com']],
};

// MARK: Счёт (детали, инструкции, чек)

function InvoiceDetail({ invoiceID }: { invoiceID: string }) {
  const s = useStore();
  const [receipts, setReceipts] = useState<M.Attachment[]>([]);
  const [note, setNote] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [currency, setCurrency] = useState<M.PayCurrency>();
  const [copied, setCopied] = useState(false);
  const inv = s.billing.invoices.find((i) => sameId(i.id, invoiceID));
  if (!inv) return <Page title="Счёт"><EmptyState text="Счёт не найден" icon="doc.questionmark" /></Page>;
  const st = s.billing.settings;
  const cur = currency ?? inv.currency;
  const amount = s.amountText(inv, cur);
  return (
    <Page title={`Счёт ${inv.number}`}>
      <Card>
        <div className="row"><b style={{ color: statusColor(inv.status), flex: 1 }}><Icon name={M.PaymentStatus.icon[inv.status]} /> {M.PaymentStatus.title[inv.status]}</b><span className="muted small">{fmt.dateTime(inv.createdAt)}</span></div>
        <h2>{inv.productTitle}</h2>
        <Segmented value={cur} onChange={setCurrency} options={M.PayCurrency.values.map((c) => ({ value: c, label: c }))} />
        <b style={{ fontSize: '2rem', color: 'var(--primary)' }}>{amount}</b>
        {inv.discountUSD > 0 && <span className="small">С учётом скидки {usd(inv.discountUSD)}{inv.promoCode ? ` (${inv.promoCode})` : ''}</span>}
        <InfoRow label="Плательщик" value={s.userName(inv.payerID)} />
        <InfoRow label="Доступ для" value={inv.beneficiaryIDs.map((b) => s.userName(b)).join(', ')} />
        <InfoRow label="Код для комментария" value={<code>{inv.number}</code>} />
      </Card>
      {(inv.status === 'awaitingPayment' || inv.status === 'rejected') && (
        <>
          <Card>
            <h3>Куда платить</h3>
            <div className="row">
              <div className="stack tight" style={{ flex: 1 }}><b style={{ fontSize: '1.4rem', fontVariantNumeric: 'tabular-nums' }}>{st.recipientPhone}</b><span className="muted small">{st.recipientName}</span></div>
              <button className="btn small" onClick={() => { void navigator.clipboard?.writeText(st.recipientPhone.replace(/[^\d+]/g, '')); setCopied(true); }}>{copied ? '✅ Скопировано' : '📋 Копировать'}</button>
            </div>
            <b className="small">Способ: {M.PaymentMethod.title[inv.method]}</b>
            <ol>{paymentInstructions(inv.method, st, amount, inv.number, inv.productTitle).map((x, i) => <li key={i}>{x}</li>)}</ol>
            <span className="muted small">{st.instructionsFooter}</span>
            <div className="row wrap">{(BANK_LINKS[inv.method] ?? []).map(([l, u]) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">↗️ {l}</a>)}</div>
          </Card>
          <Card>
            <h3>Я оплатил(а)</h3>
            <span className="muted small">Прикрепите скриншот или PDF чека — так проверка пройдёт быстрее.</span>
            <AttachmentPicker attachments={receipts} onChange={setReceipts} />
            <TextInput multiline rows={2} value={note} onChange={setNote} placeholder="Комментарий (кто и откуда платил)" />
            <div className="row">
              <button className="btn danger" onClick={() => s.cancelInvoice(inv.id)}>Отменить счёт</button>
              <span className="spacer" />
              <button className="btn primary" onClick={() => { s.reportPayment(inv.id, receipts[0], note, inv.method); setReceipts([]); }}>Отправить на проверку</button>
            </div>
          </Card>
        </>
      )}
      {inv.status === 'pendingConfirmation' && (
        <Card>
          <span>⏳ Оплата проверяется администратором. Доступ откроется автоматически сразу после подтверждения.</span>
          {inv.receipt && <AttachmentRow attachment={inv.receipt} />}
          {inv.payerNote && <span className="small">{inv.payerNote}</span>}
        </Card>
      )}
      {inv.status === 'paid' && (
        <Card>
          <span className="ok">🔓 Оплачено {inv.paidAt ? fmt.dateTime(inv.paidAt) : ''} · доступ открыт</span>
          {s.canRequestRefund(inv) && sameId(inv.payerID, s.db.currentUserID) && (
            <details><summary>Запросить возврат</summary>
              <div className="stack" style={{ marginTop: 8 }}>
                <TextInput multiline rows={2} value={refundReason} onChange={setRefundReason} placeholder="Причина возврата" />
                <button className="btn" disabled={!refundReason} onClick={() => { try { s.requestRefund(inv.id, refundReason); } catch (e) { alert((e as Error).message); } }}>Отправить запрос</button>
                <span className="muted small">Возврат возможен в течение {st.refundDays} дней после оплаты.</span>
              </div>
            </details>
          )}
        </Card>
      )}
      {(inv.status === 'refundRequested' || inv.status === 'refunded') && (
        <Card>
          <b>{M.PaymentStatus.title[inv.status]}</b>
          {inv.refundReason && <span>Причина: {inv.refundReason}</span>}
          {inv.refundedAt && <span className="small">Возврат оформлен {fmt.dateTime(inv.refundedAt)}</span>}
        </Card>
      )}
      {s.role === 'admin' && <AdminInvoiceActions invoice={inv} />}
      <button className="btn" onClick={() => printInvoice(inv, s)}>📄 {inv.status === 'paid' ? 'Чек (PDF)' : 'Счёт (PDF)'}</button>
    </Page>
  );
}

function printInvoice(inv: M.Invoice, s: ReturnType<typeof useStore>) {
  const st = s.billing.settings;
  const money = (c: M.PayCurrency) => {
    const v = invoiceAmount(inv, c, st);
    return c === 'KZT' ? `${Math.round(v).toLocaleString('ru-RU')} ₸` : c === 'USD' ? `$${v.toFixed(2)}` : `${v.toFixed(2)} €`;
  };
  const row = (l: string, v: string) => `<tr><td class="muted" style="width:160px">${escapeHTML(l)}</td><td>${escapeHTML(v)}</td></tr>`;
  printDocument(inv.number, `<div style="display:flex;justify-content:space-between;border-bottom:2px solid #00337d;padding-bottom:8px">
<b style="color:#00337d;font-size:20px">KKSU ONLINE</b><b style="font-size:20px">${inv.status === 'paid' ? 'ЧЕК' : 'СЧЁТ НА ОПЛАТУ'}</b></div><table>
${row('Номер', inv.number)}${row('Дата', fmt.dateTime(inv.createdAt))}${row('Плательщик', s.userName(inv.payerID))}
${row('Доступ для', inv.beneficiaryIDs.map((b) => s.userName(b)).join(', '))}${row('Продукт', inv.productTitle)}${row('Программа', M.ProductKind.title[inv.productKind])}
${row('Цена', `$${inv.priceUSD.toFixed(2)}`)}${inv.discountUSD > 0 ? row('Скидка', `−$${inv.discountUSD.toFixed(2)} ${inv.promoCode ?? ''}`) : ''}
<tr><td><b>ИТОГО</b></td><td><b>${money('KZT')} (${money('USD')} · ${money('EUR')})</b></td></tr>
${row('Курс', `1 USD = ${Math.round(inv.rate)} ₸`)}${row('Способ оплаты', M.PaymentMethod.title[inv.method])}${row('Получатель', `${st.recipientName}, ${st.recipientPhone}`)}
${row('Статус', M.PaymentStatus.title[inv.status] + (inv.paidAt ? ` · ${fmt.dateTime(inv.paidAt)}` : ''))}${inv.status === 'refunded' && inv.refundedAt ? row('Возврат', fmt.dateTime(inv.refundedAt)) : ''}
</table><p>Укажите в комментарии к переводу код <b>${escapeHTML(inv.number)}</b>.</p><p class="muted" style="font-size:11px">Документ сформирован автоматически платформой KKSU Online.</p>`);
}

function AdminInvoiceActions({ invoice: inv }: { invoice: M.Invoice }) {
  const s = useStore();
  const [reason, setReason] = useState('');
  return (
    <Card>
      <h3>Действия администратора</h3>
      <TextInput value={reason} onChange={setReason} placeholder="Комментарий / причина" />
      {(inv.status === 'awaitingPayment' || inv.status === 'pendingConfirmation' || inv.status === 'rejected') && (
        <div className="row">
          <button className="btn danger" onClick={() => s.rejectPayment(inv.id, reason || 'поступление не найдено')}>Платёж не найден</button>
          <span className="spacer" />
          <button className="btn primary" style={{ background: 'var(--success)' }} onClick={() => s.confirmPayment(inv.id)}>Подтвердить оплату</button>
        </div>
      )}
      {(inv.status === 'paid' || inv.status === 'refundRequested') && <button className="btn danger" onClick={() => s.refund(inv.id, reason)}>Оформить возврат и закрыть доступ</button>}
      {(inv.status === 'cancelled' || inv.status === 'refunded') && <span className="muted">Действий нет</span>}
    </Card>
  );
}

function InvoiceRow({ invoice: inv, extra }: { invoice: M.Invoice; extra?: string }) {
  const s = useStore();
  return (
    <Link className="list-item" to={routePath('paymentHistory', 'i/' + inv.id)}>
      <span style={{ color: statusColor(inv.status), width: 26 }}><Icon name={M.PaymentStatus.icon[inv.status]} /></span>
      <span className="stack tight" style={{ flex: 1, minWidth: 0 }}>
        <span>{inv.productTitle}</span>
        <span className="muted small">{inv.number} · {fmt.short(inv.createdAt)} · {M.PaymentMethod.title[inv.method]}</span>
        {extra && <span className="muted small">{extra}</span>}
      </span>
      <span className="stack tight" style={{ alignItems: 'flex-end' }}><b>{s.amountText(inv, 'KZT')}</b><span className="small" style={{ color: statusColor(inv.status) }}>{M.PaymentStatus.title[inv.status]}</span></span>
    </Link>
  );
}

// MARK: История платежей

export function PaymentHistoryScreen() {
  const s = useStore();
  const sub = useSub();
  if (sub[0] === 'i' && sub[1]) return <InvoiceDetail invoiceID={sub[1]} />;
  const me = s.db.currentUserID;
  const invoices = s.billing.invoices.filter((i) => sameId(i.payerID, me) || i.beneficiaryIDs.some((b) => sameId(b, me))).sort((a, b) => time(b.createdAt) - time(a.createdAt));
  const ents = me ? s.activeEntitlements(me) : [];
  return (
    <Page title="История платежей">
      <Section title="Мои доступы" icon="lock.open" />
      <Card><div className="list">
        {ents.length === 0 && <span className="muted">Платных доступов пока нет</span>}
        {ents.map((e) => {
          const p = s.productById(e.productID);
          return (
            <div key={e.id} className="list-item"><Icon name={p ? M.ProductKind.icon[p.kind] : 'lock.open'} />
              <span className="stack tight"><span>{p?.title ?? 'Продукт'}</span><span className="muted small">{M.AccessSource.title[e.source]}{e.expiresAt ? ` · до ${fmt.short(e.expiresAt)}` : ' · бессрочно'}</span></span></div>
          );
        })}
      </div></Card>
      <Section title="Счета и платежи" icon="doc.text" />
      <Card><div className="list">
        {invoices.length === 0 && <span className="muted">Платежей пока нет</span>}
        {invoices.map((i) => <InvoiceRow key={i.id} invoice={i} />)}
      </div></Card>
    </Page>
  );
}

// MARK: KKSU Marketplace

function ProductCard({ product: p, onClick }: { product: M.Product; onClick?: () => void }) {
  const s = useStore();
  return (
    <Card onClick={onClick}>
      <div className="row top"><span className="tile-icon"><Icon name={M.ProductKind.icon[p.kind]} /></span>
        <div className="stack tight" style={{ flex: 1 }}><b>{p.title}</b><span className="muted small">{M.ProductKind.title[p.kind]}</span></div></div>
      <span className="small">{p.summary}</span>
      <div className="row wrap"><PriceBadge product={p} />{p.sellerID && <span className="muted small">Автор: {s.userName(p.sellerID)}</span>}<span className="spacer" />{p.familySeats > 0 && <Badge text="Семейная" color="purple" />}</div>
    </Card>
  );
}

function ProductDetail({ product: p, onClose }: { product: M.Product; onClose: () => void }) {
  const s = useStore();
  const course = p.kind === 'marketplaceCourse' ? s.billing.marketplaceCourses.find((c) => sameId(c.id, p.refID)) : undefined;
  return (
    <Modal title={p.title} onClose={onClose}>
      <ProductCard product={p} />
      {course ? (
        <Card><h3>Программа курса</h3>
          <PaywallGate product={p} message="Уроки откроются после подтверждения оплаты."><ol>{course.lessons.map((l, i) => <li key={i}>{l}</li>)}</ol></PaywallGate>
        </Card>
      ) : s.hasAccess(s.db.currentUserID, p)
        ? <span className="ok">🔓 {p.priceUSD <= 0 ? 'Бесплатно — доступ открыт' : 'Доступ открыт'}</span>
        : <PaywallCard product={p} />}
    </Modal>
  );
}

export function MarketplaceScreen() {
  const s = useStore();
  const [kind, setKind] = useState<M.ProductKind | ''>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<M.Product>();
  const products = s.billing.products.filter((p) => p.isActive && p.kind !== 'marketplaceListing' && (!kind || p.kind === kind) && (!q || p.title.toLowerCase().includes(q.toLowerCase())));
  return (
    <Page title="KKSU Marketplace" wide>
      <span className="muted">Регистрация и подача заявки в KKSU — бесплатно. Платные программы и курсы открываются автоматически после подтверждения оплаты.</span>
      <TextInput value={q} onChange={setQ} placeholder="Поиск продукта" />
      <div className="chips">
        <button className={'chip' + (!kind ? ' on' : '')} onClick={() => setKind('')}>Все</button>
        {M.ProductKind.values.filter((k) => k !== 'marketplaceListing').map((k) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{M.ProductKind.title[k]}</button>)}
      </div>
      {products.length === 0 && <EmptyState text="Ничего не найдено" icon="magnifyingglass" />}
      <div className="grid" style={{ ['--min' as string]: '260px' }}>{products.map((p) => <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />)}</div>
      <Tiles routes={['subscriptions', 'teacherMarketplace', 'paymentHistory']} />
      {selected && <ProductDetail product={selected} onClose={() => setSelected(undefined)} />}
    </Page>
  );
}

// MARK: Подписки

export function SubscriptionsScreen() {
  const s = useStore();
  const plans = s.billing.products.filter((p) => p.kind === 'subscription' && p.isActive).sort((a, b) => a.priceUSD - b.priceUSD);
  const me = s.db.currentUserID;
  const active = me ? s.activeSubscription(me) : undefined;
  return (
    <Page title="Подписка KKSU">
      {active && <Card><b className="ok">⭐ Подписка активна</b><span>{s.productById(active.productID)?.title}</span>{active.expiresAt && <span className="small">Действует до {fmt.short(active.expiresAt)}</span>}</Card>}
      <span className="muted">Подписка открывает все образовательные курсы, Future Engineers и Global Classroom. Семейная подписка — до 4 детей в одном аккаунте родителя.</span>
      <span className="muted small">На сайте подписка оплачивается переводом на нужный срок и не продлевается автоматически. Подписка из App Store действует и на сайте.</span>
      <div className="grid" style={{ ['--min' as string]: '240px' }}>
        {plans.map((p) => (
          <Card key={p.id}>
            <div className="row"><b style={{ flex: 1 }}>{p.title}</b>{p.familySeats > 0 && <span title="Семейная">👨‍👩‍👧</span>}</div>
            <b style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{s.priceText(p.priceUSD)}</b>
            <span className="small">{p.summary}</span>
            <PaywallGate product={p}><span className="ok">✅ Оформлена</span></PaywallGate>
          </Card>
        ))}
      </div>
    </Page>
  );
}

// MARK: Teacher Marketplace

export function TeacherMarketplaceScreen() {
  const s = useStore();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<M.Product>();
  const me = s.db.currentUserID;
  const published = s.billing.products.filter((p) => p.kind === 'marketplaceCourse' && p.isActive);
  const mine = s.billing.marketplaceCourses.filter((c) => sameId(c.teacherID, me));
  const listing = s.productTitled(LISTING);
  return (
    <Page title="Teacher Marketplace">
      <span className="muted">Педагоги KKSU и партнёров предлагают собственные курсы. Публикация курса — {s.priceText(listing?.priceUSD ?? 300)}.</span>
      {(s.role === 'teacher' || s.role === 'admin') && (
        <>
          <Section title="Мои курсы" icon="person.crop.rectangle" />
          {mine.map((c) => {
            const sales = s.paidInvoices.filter((i) => sameId(s.productById(i.productID)?.refID, c.id));
            return (
              <Card key={c.id}>
                <div className="row"><b style={{ flex: 1 }}>{c.title}</b><Badge text={M.MarketplaceCourseStatus.title[c.status]} color={c.status === 'published' ? 'var(--success)' : 'var(--warning)'} /></div>
                <span className="small">{c.subject} · {c.lessons.length} уроков · {s.priceText(c.priceUSD, false)}</span>
                {c.status !== 'published' && listing && <PaywallCard product={listing} targetID={c.id} message="Оплатите публикацию — курс появится в каталоге сразу после подтверждения." />}
                {c.status === 'published' && <span className="muted small">Продаж: {sales.length} · выручка {usd(s.revenueUSD(sales))}</span>}
              </Card>
            );
          })}
          <button className="btn outline" onClick={() => setAdding(true)}>➕ Разместить свой курс</button>
        </>
      )}
      <Section title="Курсы педагогов" icon="storefront.fill" />
      {published.length === 0 && <EmptyState text="Пока нет опубликованных курсов" icon="storefront" />}
      {published.map((p) => <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />)}
      {adding && <MarketplaceCourseEditor onClose={() => setAdding(false)} />}
      {selected && <ProductDetail product={selected} onClose={() => setSelected(undefined)} />}
    </Page>
  );
}

function MarketplaceCourseEditor({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState({ title: '', subject: '', summary: '', lessons: '', price: 20 });
  return (
    <Modal title="Новый курс" onClose={onClose}>
      <TextInput label="Название" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <TextInput label="Предмет" value={f.subject} onChange={(v) => setF({ ...f, subject: v })} />
      <TextInput label="Описание" multiline value={f.summary} onChange={(v) => setF({ ...f, summary: v })} />
      <TextInput label="Уроки (каждый с новой строки)" multiline rows={5} value={f.lessons} onChange={(v) => setF({ ...f, lessons: v })} />
      <NumberInput label={`Цена для учеников, USD (${s.priceText(f.price)})`} value={f.price} min={0} max={MAX_DIGITAL_USD} step={5} onChange={(v) => setF({ ...f, price: v })} />
      <span className="muted small">После сохранения оплатите публикацию курса. Курс появится в KKSU Marketplace автоматически после подтверждения оплаты.</span>
      <button className="btn primary" disabled={!f.title || !f.lessons.trim() || !s.db.currentUserID} onClick={() => {
        s.addBilling('marketplaceCourses', M.makeMarketplaceCourse({ teacherID: s.db.currentUserID!, title: f.title, summary: f.summary, subject: f.subject,
          lessons: f.lessons.split('\n').map((x) => x.trim()).filter(Boolean), priceUSD: f.price, status: 'awaitingListingFee' }));
        onClose();
      }}>Сохранить</button>
    </Modal>
  );
}

// MARK: Сертификация преподавателя

export function TeacherCertificationScreen() {
  const s = useStore();
  const product = s.productTitled(CERTIFICATION);
  const me = s.db.currentUserID;
  const tests = s.db.tests.filter((t) => t.audience === 'teachers');
  const passed = s.db.attempts.some((a) => sameId(a.userID, me) && a.passed && tests.some((t) => sameId(t.id, a.testID)));
  const certified = s.db.certificates.some((c) => sameId(c.userID, me) && c.title === 'Сертифицированный преподаватель KKSU');
  return (
    <Page title="Сертификация преподавателя">
      <Card>
        <h2 style={{ color: 'var(--primary)' }}>🏅 Сертификация преподавателя KKSU</h2>
        <span>Отдельный тариф: итоговое тестирование по инклюзивной педагогике и электронный сертификат с кодом проверки.</span>
        {product && <b>{s.priceText(product.priceUSD)}</b>}
      </Card>
      <PaywallGate product={product} message="Оплатите сертификацию, чтобы пройти итоговое тестирование.">
        <Card>
          <h3>1. Пройдите итоговый тест</h3>
          {tests.map((t) => <TestCard key={t.id} test={t} />)}
          <h3>2. Получите сертификат</h3>
          {certified ? <span className="ok">✅ Сертификат выдан</span> : (
            <>
              <button className="btn primary" disabled={!passed || !me} onClick={() => s.issueCertificate(me!, 'Сертифицированный преподаватель KKSU', 'teacherAcademy')}>Получить сертификат</button>
              {!passed && <span className="muted small">Кнопка станет активной после успешного теста.</span>}
            </>
          )}
        </Card>
      </PaywallGate>
      <Card><div className="list"><RouteRow route="certificates" /></div></Card>
    </Page>
  );
}

// MARK: Услуги KKSU Inventions

export function InventionsServicesScreen() {
  const s = useStore();
  const services = s.billing.products.filter((p) => p.kind === 'inventionsService' && p.isActive);
  return (
    <Page title="Услуги KKSU Inventions">
      <span className="muted">Дополнительные платные услуги для проектов. Базовая работа над проектом с наставником — бесплатна.</span>
      {services.length === 0 && <EmptyState text="Услуг пока нет" icon="wrench" />}
      {services.map((p) => (
        <div key={p.id} className="stack tight">
          <ProductCard product={p} />
          <PaywallGate product={p}><span className="ok small">✅ Услуга оплачена — наставник свяжется с вами в чате</span></PaywallGate>
        </div>
      ))}
    </Page>
  );
}

// MARK: Выручка (админ)

export function RevenueScreen() {
  const s = useStore();
  const rate = s.billing.settings.usdToKzt;
  const pending = s.billing.invoices.filter((i) => i.status === 'pendingConfirmation' || i.status === 'refundRequested');
  const byKind = s.salesByKind();
  const byProduct = s.salesByProduct();
  const byTeacher = s.salesByTeacher();
  const byMethod = s.salesByMethod();
  const monthly = s.monthlyRevenue();
  const csv = () => {
    const rows = [...s.billing.invoices].sort((a, b) => time(b.createdAt) - time(a.createdAt)).map((i) => [i.number, fmt.short(i.createdAt), s.userName(i.payerID), i.productTitle,
      M.ProductKind.title[i.productKind], M.PaymentMethod.title[i.method], M.PaymentStatus.title[i.status], invoiceTotal(i).toFixed(2), Math.round(invoiceTotal(i) * i.rate), i.promoCode ?? ''].join(';'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿Счёт;Дата;Плательщик;Продукт;Программа;Способ;Статус;USD;KZT;Промокод\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'KKSU-payments.csv'; a.click();
  };
  return (
    <Page title="Выручка KKSU" wide>
      <div className="grid" style={{ ['--min' as string]: '150px' }}>
        <StatTile title="Выручка, USD" value={usd(s.revenueUSD())} icon="dollarsign.circle.fill" color="var(--success)" />
        <StatTile title="Выручка, ₸" value={Math.round(s.revenueUSD() * rate).toLocaleString('ru-RU')} icon="banknote.fill" />
        <StatTile title="Оплаченных счетов" value={s.paidInvoices.length} icon="checkmark.seal.fill" color="var(--accent)" />
        <StatTile title="Ждут проверки" value={pending.length} icon="hourglass" color="var(--warning)" />
        <StatTile title="Возвращено, USD" value={usd(s.refundedUSD)} icon="arrow.uturn.backward.circle" color="var(--danger)" />
        <StatTile title="Стипендий" value={s.billing.entitlements.filter((e) => e.source === 'scholarship' && entitlementActive(e)).length} icon="gift.fill" color="purple" />
      </div>
      <Card><div className="list"><RouteRow route="paymentsAdmin" subtitle="Подтвердить оплаты, оформить возвраты" /></div></Card>
      <Card><h3>Выручка по месяцам, USD</h3><BarChart data={monthly.map((m) => ({ label: m.month.toLocaleDateString('ru-RU', { month: 'short' }), value: Math.round(m.usd) }))} /></Card>
      {byKind.length > 0 && <Card><h3>Продажи по программам</h3>{byKind.map((x) => <InfoRow key={x.kind} label={M.ProductKind.title[x.kind]} value={`${usd(x.usd)} · ${x.count} шт.`} />)}</Card>}
      <Card><h3>Продажи по курсам и продуктам</h3>{byProduct.length === 0 && <span className="muted">Продаж пока нет</span>}{byProduct.map((x) => <InfoRow key={x.title} label={x.title} value={`${usd(x.usd)} · ${x.count} шт.`} />)}</Card>
      <Card><h3>Продажи по преподавателям</h3>{byTeacher.length === 0 && <span className="muted">Продаж курсов педагогов пока нет</span>}{byTeacher.map((x) => <InfoRow key={x.teacherID} label={s.userName(x.teacherID)} value={`${usd(x.usd)} · ${x.count} шт.`} />)}</Card>
      {byMethod.length > 0 && <Card><h3>По способам оплаты</h3>{byMethod.map((x) => <InfoRow key={x.method} label={M.PaymentMethod.title[x.method]} value={usd(x.usd)} />)}</Card>}
      <button className="btn" onClick={csv}>📊 Экспорт платежей в CSV</button>
      <Tiles routes={['pricing', 'promoCodes', 'scholarships', 'paymentSettings']} />
    </Page>
  );
}

// MARK: Подтверждение оплат (админ)

export function PaymentsAdminScreen() {
  const s = useStore();
  const [filter, setFilter] = useState<M.PaymentStatus | ''>('pendingConfirmation');
  const list = s.billing.invoices.filter((i) => !filter || i.status === filter).sort((a, b) => time(b.createdAt) - time(a.createdAt));
  return (
    <Page title="Платежи">
      <Select label="Статус" value={filter} onChange={setFilter} options={[{ value: '' as const, label: 'Все' },
        ...M.PaymentStatus.values.map((st) => ({ value: st, label: `${M.PaymentStatus.title[st]} (${s.billing.invoices.filter((i) => i.status === st).length})` }))]} />
      <span className="muted small">Сверьте поступление в приложении банка (сумма и код счёта в комментарии) и подтвердите оплату — доступ откроется автоматически.</span>
      <Card><div className="list">
        {list.length === 0 && <span className="muted">Счетов нет</span>}
        {list.map((i) => <InvoiceRow key={i.id} invoice={i} extra={`Плательщик: ${s.userName(i.payerID)}${i.receipt ? ' · чек приложен' : ''}`} />)}
      </div></Card>
    </Page>
  );
}

// MARK: Промокоды (админ)

export function PromoCodesScreen() {
  const s = useStore();
  const [f, setF] = useState({ code: '', percent: 10, amount: 0, maxUses: 0, expiry: '' as string, kinds: [] as M.ProductKind[] });
  const describe = (p: M.PromoCode) => [
    p.percentOff > 0 && `−${Math.round(p.percentOff)}%`, p.amountOffUSD > 0 && `−$${Math.round(p.amountOffUSD)}`,
    `использован ${p.uses}${p.maxUses > 0 ? ` из ${p.maxUses}` : ''}`, p.validUntil && `до ${fmt.short(p.validUntil)}`,
    p.kinds.length ? p.kinds.map((k) => M.ProductKind.title[k]).join(', ') : 'все программы',
  ].filter(Boolean).join(' · ');
  const exists = s.billing.promoCodes.some((p) => p.code.toUpperCase() === f.code.toUpperCase());
  return (
    <Page title="Промокоды и скидки">
      <Card>
        <h3>Промокоды</h3>
        {s.billing.promoCodes.length === 0 && <span className="muted">Промокодов пока нет</span>}
        {s.billing.promoCodes.map((p) => (
          <div key={p.id} className="row">
            <div style={{ flex: 1 }}><Toggle label={<code>{p.code}</code>} checked={p.isActive} onChange={(v) => s.updateBilling('promoCodes', p.id, { isActive: v })} hint={describe(p)} /></div>
            <button className="btn small danger" aria-label="Удалить" onClick={() => { s.billing.promoCodes = s.billing.promoCodes.filter((x) => x.id !== p.id); s.changed(); }}>🗑</button>
          </div>
        ))}
      </Card>
      <Card>
        <h3>Новый промокод</h3>
        <TextInput label="Код" value={f.code} onChange={(v) => setF({ ...f, code: v })} />
        <div className="form-grid">
          <NumberInput label="Скидка, %" value={f.percent} min={0} max={100} step={5} onChange={(v) => setF({ ...f, percent: v })} />
          <NumberInput label="или фиксированная, $" value={f.amount} min={0} max={500} step={5} onChange={(v) => setF({ ...f, amount: v })} />
          <NumberInput label="Использований (0 — без ограничений)" value={f.maxUses} min={0} max={10000} step={10} onChange={(v) => setF({ ...f, maxUses: v })} />
          <DateInput label="Действует до (необязательно)" dateOnly value={f.expiry || undefined} onChange={(v) => setF({ ...f, expiry: v })} />
        </div>
        <details><summary>Для программ (пусто — для всех)</summary>
          {M.ProductKind.values.map((k) => <Toggle key={k} label={M.ProductKind.title[k]} checked={f.kinds.includes(k)} onChange={(on) => setF({ ...f, kinds: on ? [...f.kinds, k] : f.kinds.filter((x) => x !== k) })} />)}
        </details>
        <button className="btn primary" disabled={!f.code || (f.percent === 0 && f.amount === 0) || exists} onClick={() => {
          s.addBilling('promoCodes', M.makePromoCode({ code: f.code.toUpperCase(), percentOff: f.percent, amountOffUSD: f.amount, maxUses: f.maxUses, validUntil: f.expiry || undefined, kinds: f.kinds }));
          setF({ ...f, code: '' });
        }}>Создать</button>
      </Card>
    </Page>
  );
}

// MARK: Стипендии (админ)

export function ScholarshipsScreen() {
  const s = useStore();
  const [userID, setUserID] = useState('');
  const [productID, setProductID] = useState('');
  const [days, setDays] = useState(365);
  const [unlimited, setUnlimited] = useState(false);
  const [note, setNote] = useState('Стипендия KKSU');
  const grants = s.billing.entitlements.filter((e) => e.source === 'scholarship').sort((a, b) => time(b.grantedAt) - time(a.grantedAt));
  return (
    <Page title="Стипендии и бесплатный доступ">
      <Card>
        <h3>Выдать бесплатный доступ</h3>
        <Select label="Ученик / пользователь" value={userID} onChange={setUserID} options={[{ value: '', label: 'Выберите' }, ...s.db.users.filter((u) => u.role !== 'admin').map((u) => ({ value: u.id, label: `${u.fullName} (${M.KKSURole.title[u.role]})` }))]} />
        <Select label="Программа" value={productID} onChange={setProductID} options={[{ value: '', label: 'Выберите' }, ...s.billing.products.filter((p) => p.priceUSD > 0 && p.kind !== 'marketplaceListing').map((p) => ({ value: p.id, label: p.title }))]} />
        <Toggle label="Бессрочно" checked={unlimited} onChange={setUnlimited} />
        {!unlimited && <NumberInput label="Срок, дней" value={days} min={7} max={730} step={7} onChange={setDays} />}
        <TextInput label="Основание" value={note} onChange={setNote} />
        <button className="btn primary" disabled={!userID || !productID} onClick={() => {
          const p = s.productById(productID);
          if (p) s.grantScholarship(userID, p, unlimited ? undefined : days, note);
        }}>Выдать доступ</button>
      </Card>
      <Section title="Выданные стипендии" icon="gift" />
      <Card><div className="list">
        {grants.length === 0 && <span className="muted">Пока нет</span>}
        {grants.map((g) => (
          <div key={g.id} className="list-item">
            <span className="stack tight" style={{ flex: 1 }}><span>{s.userName(g.userID)}</span>
              <span className="muted small">{s.productById(g.productID)?.title ?? ''} · {g.note}{g.expiresAt ? ` · до ${fmt.short(g.expiresAt)}` : ''}</span></span>
            {entitlementActive(g) ? <button className="btn small danger" onClick={() => s.revokeEntitlement(g.id)}>Отозвать</button> : <span className="muted small">Неактивна</span>}
          </div>
        ))}
      </div></Card>
    </Page>
  );
}

// MARK: Цены и продукты (админ)

export function PricingScreen() {
  const s = useStore();
  const [f, setF] = useState({ title: '', kind: 'course' as M.ProductKind, price: 10 });
  const cap = (k: M.ProductKind) => (isDigital(k) ? MAX_DIGITAL_USD : 5000);
  return (
    <Page title="Цены и продукты">
      <span className="muted small">Регистрация пользователя и подача заявки — бесплатны всегда. Цена 0 делает программу бесплатной. Цифровые программы — не дороже ${MAX_DIGITAL_USD} (ограничение App Store, цены общие для сайта и приложения).</span>
      {M.ProductKind.values.map((k) => {
        const list = s.billing.products.filter((p) => p.kind === k);
        if (!list.length) return null;
        return (
          <Card key={k}>
            <h3>{M.ProductKind.title[k]}</h3>
            {list.map((p) => (
              <div key={p.id} className="row wrap">
                <span style={{ flex: '1 1 200px' }}>{p.title}</span>
                <div style={{ width: 140 }}><NumberInput value={p.priceUSD} min={0} max={cap(p.kind)} step={5} onChange={(v) => s.updateBilling('products', p.id, { priceUSD: Math.min(Math.max(v, 0), cap(p.kind)) })} /></div>
                <span className="muted small" style={{ width: 110 }}>{s.priceText(p.priceUSD, true)}</span>
                <Toggle label="" checked={p.isActive} onChange={(v) => s.updateBilling('products', p.id, { isActive: v })} />
              </div>
            ))}
          </Card>
        );
      })}
      <Card>
        <h3>Новый продукт</h3>
        <TextInput label="Название" value={f.title} onChange={(v) => setF({ ...f, title: v })} />
        <div className="form-grid">
          <Select label="Программа" value={f.kind} onChange={(kind) => setF({ ...f, kind, price: Math.min(f.price, cap(kind)) })} options={M.ProductKind.values.map((k) => ({ value: k, label: M.ProductKind.title[k] }))} />
          <NumberInput label={`Цена, USD (${s.priceText(f.price)})`} value={f.price} min={0} max={cap(f.kind)} step={5} onChange={(v) => setF({ ...f, price: v })} />
        </div>
        <button className="btn primary" disabled={!f.title} onClick={() => {
          s.addBilling('products', M.makeProduct({ title: f.title, kind: f.kind, priceUSD: f.price, summary: '', durationDays: f.kind === 'subscription' ? 30 : undefined }));
          setF({ ...f, title: '' });
        }}>Добавить</button>
      </Card>
    </Page>
  );
}

// MARK: Реквизиты и курсы валют (админ)

export function PaymentSettingsScreen() {
  const s = useStore();
  const st = s.billing.settings;
  const manual = M.PaymentMethod.values.filter((m) => m !== 'appStore');
  return (
    <Page title="Настройки оплаты">
      <Card>
        <h3>Получатель платежей</h3>
        <TextInput label="Номер телефона для переводов" value={st.recipientPhone} onChange={(v) => s.updateSettings({ recipientPhone: v })} />
        <TextInput label="Имя получателя (как в банке)" value={st.recipientName} onChange={(v) => s.updateSettings({ recipientName: v })} />
        <span className="muted small">На этот номер переводят оплату через Kaspi, Halyk и другие банки Казахстана. Иностранные платежи через Korona Pay, Western Union и Wise зачисляются в тенге.</span>
      </Card>
      <Card>
        <h3>Курсы для пересчёта цен</h3>
        <div className="form-grid">
          <NumberInput label="1 USD = ₸" value={st.usdToKzt} min={100} max={2000} onChange={(v) => s.updateSettings({ usdToKzt: v })} />
          <NumberInput label="1 EUR = ₸" value={st.eurToKzt} min={100} max={2000} onChange={(v) => s.updateSettings({ eurToKzt: v })} />
        </div>
        <span className="muted small">Цены хранятся в долларах. Банк плательщика конвертирует валюту по своему курсу.</span>
      </Card>
      <Card>
        <h3>App Store</h3>
        <span>🍎 В iOS-приложении цифровой контент продаётся только через App Store. На сайте все программы оплачиваются переводом по счёту — доступы общие.</span>
      </Card>
      <Card>
        <h3>Способы оплаты переводом</h3>
        {manual.map((m) => (
          <Toggle key={m} label={M.PaymentMethod.title[m]} checked={st.enabledMethods.includes(m)}
            onChange={(on) => s.updateSettings({ enabledMethods: on ? [...st.enabledMethods, m] : st.enabledMethods.filter((x) => x !== m) })} />
        ))}
      </Card>
      <Card>
        <h3>Правила</h3>
        <NumberInput label="Возврат в течение, дней" value={st.refundDays} min={0} max={90} onChange={(v) => s.updateSettings({ refundDays: v })} />
        <TextInput label="Подсказка плательщику" multiline value={st.instructionsFooter} onChange={(v) => s.updateSettings({ instructionsFooter: v })} />
      </Card>
    </Page>
  );
}
