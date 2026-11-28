// Вычисляемые свойства моделей — как в Swift-моделях iOS-приложения.
import type * as M from './models.gen';
import { ProjectStage } from './models.gen';
import { time } from './ids';

export const KKSURoleExtra = {
  selfRegistrable: ['student', 'parent', 'teacher', 'psychologist', 'expert', 'mentor', 'partner'] as M.KKSURole[],
  canTeach: (r: M.KKSURole) => r === 'teacher' || r === 'admin',
  canReview: (r: M.KKSURole) => r === 'expert' || r === 'mentor' || r === 'admin',
  isStaff: (r: M.KKSURole) => ['teacher', 'psychologist', 'expert', 'mentor', 'admin'].includes(r),
};

export const initials = (u: { fullName: string }) =>
  u.fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const firstName = (u: { fullName: string }) => u.fullName.split(' ')[0] || u.fullName;

export function age(profile: M.StudentProfile): number {
  const b = new Date(profile.birthDate);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) years--;
  return years;
}

export const sessionEnd = (s: M.ScheduleSession) => new Date(time(s.start) + s.durationMinutes * 60000);
export function sessionJoinURL(s: M.ScheduleSession): string | null {
  if (s.meetingURL) return s.meetingURL;
  if (!s.isOnline || s.platform !== 'jitsi') return null;
  return `https://meet.jit.si/KKSU-${s.id.slice(0, 8)}`;
}

export function detectAttachmentKind(fileName: string): M.AttachmentKind {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'heic', 'gif', 'webp'].includes(ext)) return 'photo';
  if (['mov', 'mp4', 'm4v', 'webm'].includes(ext)) return 'video';
  if (['dwg', 'dxf', 'svg', 'step', 'stl'].includes(ext)) return 'drawing';
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'presentation';
  if (['doc', 'docx', 'txt', 'rtf', 'pages', 'md'].includes(ext)) return 'document';
  return 'other';
}

export const certificateCode = (c: M.Certificate) => `KKSU-${c.serial}`;

export function libraryFormat(item: M.LibraryItem): M.ContentFormat {
  if (item.kind === 'video') return 'video';
  if (item.kind === 'presentation') return 'interactive';
  return 'text';
}

export const testMaxScore = (t: M.KKSUTest) => t.questions.reduce((s, q) => s + q.points, 0);
export const attemptPercent = (a: M.TestAttempt) => (a.maxScore === 0 ? 0 : Math.round((a.score / a.maxScore) * 100));
export const pilotGrowth = (p: M.MethodologyPilot) =>
  p.baselineScore === 0 ? 0 : ((p.finalScore - p.baselineScore) / p.baselineScore) * 100;
export const reviewAverage = (r: M.ExpertReview) =>
  r.scores.length === 0 ? 0 : r.scores.reduce((s, x) => s + x.score, 0) / r.scores.length;

export const METHODOLOGY_CRITERIA = ['Научная обоснованность', 'Практическая применимость', 'Инклюзивность', 'Воспроизводимость', 'Результативность'];
export const PROJECT_CRITERIA = ['Новизна', 'Техническая проработка', 'Социальная значимость', 'Качество прототипа', 'Презентация'];

export function stageIndex(s: M.ProjectStage) { return ProjectStage.values.indexOf(s); }
export function nextStage(s: M.ProjectStage): M.ProjectStage | null {
  const i = stageIndex(s);
  return i + 1 < ProjectStage.values.length ? ProjectStage.values[i + 1] : null;
}

export const isInternationalPartner = (p: M.Partner) => p.country !== 'Казахстан';

// Оплата
export const PAY_SYMBOL: Record<M.PayCurrency, string> = { USD: '$', EUR: '€', KZT: '₸' };

export function paymentRegion(m: M.PaymentMethod): M.PaymentRegion {
  return ['internationalCard', 'koronaPay', 'westernUnion', 'wise', 'appStore'].includes(m) ? 'international' : 'kazakhstan';
}
export function preferredCurrency(m: M.PaymentMethod): M.PayCurrency {
  return ['internationalCard', 'westernUnion', 'wise', 'appStore'].includes(m) ? 'USD' : 'KZT';
}

export function paymentInstructions(m: M.PaymentMethod, s: M.PaymentSettings, amount: string, code: string, title: string): string[] {
  const phone = s.recipientPhone;
  switch (m) {
    case 'kaspi':
      return ['Откройте приложение Kaspi.kz → «Переводы» → «Клиенту Kaspi».', `Введите номер телефона ${phone}.`,
        `Проверьте имя получателя: ${s.recipientName}.`, `Сумма: ${amount}. Комментарий: ${code}.`];
    case 'halyk': case 'freedom': case 'jusan': case 'forte': case 'bereke': case 'bcc': case 'homeCredit': case 'otherKZBank':
      return [`Откройте приложение своего банка (${title}) → «Переводы» → «По номеру телефона» / «В другой банк».`,
        `Введите номер ${phone} и выберите банк получателя Kaspi Bank.`, `Сумма: ${amount}. Комментарий: ${code}.`,
        'Межбанковский перевод по номеру телефона зачисляется на счёт Kaspi получателя.'];
    case 'internationalCard':
      return ['Оплата картой из США, Франции, Италии и других стран возможна двумя способами:',
        '1) через сервис денежных переводов (Korona Pay, Western Union, Wise) — выберите его в списке;',
        '2) через онлайн-оплату картой, если администратор KKSU подключил интернет-эквайринг.',
        `Сумма к оплате: ${amount}. Банк спишет её в вашей валюте и сконвертирует автоматически. Код счёта: ${code}.`];
    case 'koronaPay':
      return ['Откройте Korona Pay (koronapay.com) или приложение.',
        `Страна получателя: Казахстан. Получатель: ${s.recipientName}, телефон ${phone}, банк Kaspi.`,
        `Отправьте ${amount} — сервис сам сконвертирует валюту в тенге.`, `В сообщении получателю укажите код ${code}.`];
    case 'westernUnion':
      return ['Оформите перевод в Казахстан на сайте westernunion.com или в отделении.',
        `Получатель: ${s.recipientName}, телефон ${phone}. Если доступно зачисление на счёт — выберите Kaspi Bank.`,
        `Сумма: ${amount}. Отправьте нам номер перевода (MTCN) и чек.`, `Код счёта: ${code}.`];
    case 'wise':
      return ['В Wise выберите перевод в KZT (тенге), Казахстан.', 'Реквизиты получателя (IBAN Kaspi) запросите у администратора KKSU в чате.',
        `Сумма: ${amount}; конвертация выполняется Wise автоматически.`, `В назначении платежа укажите ${code}.`];
    case 'appStore':
      return ['Оплата прошла через App Store. Чек Apple придёт на почту вашего Apple ID.'];
  }
}

export function isDigital(kind: M.ProductKind) {
  return !['youngInventors', 'inventionsService', 'conference'].includes(kind);
}
export const coveredBySubscription = (kind: M.ProductKind) => kind === 'course' || kind === 'futureEngineers' || kind === 'globalClassroom';

export function promoValid(p: M.PromoCode, product: M.Product, now = Date.now()) {
  return p.isActive && (!p.validUntil || time(p.validUntil) >= now) && (p.maxUses === 0 || p.uses < p.maxUses) &&
    (p.kinds.length === 0 || p.kinds.includes(product.kind));
}
export const promoDiscount = (p: M.PromoCode, price: number) => Math.min(price, (price * p.percentOff) / 100 + p.amountOffUSD);

export const invoiceTotal = (i: M.Invoice) => Math.max(i.priceUSD - i.discountUSD, 0);
export function invoiceAmount(i: M.Invoice, c: M.PayCurrency, s: M.PaymentSettings) {
  const total = invoiceTotal(i);
  if (c === 'USD') return total;
  if (c === 'KZT') return Math.round(total * s.usdToKzt);
  return Math.round((total * s.usdToKzt / s.eurToKzt) * 100) / 100;
}
export const entitlementActive = (e: M.Entitlement, now = Date.now()) => !e.revoked && (!e.expiresAt || time(e.expiresAt) > now);

// Курсы
export const lessonHasLive = (l: M.CourseLesson) => !!l.liveStart || !!l.liveURL;
export function lessonJoinURL(l: M.CourseLesson): string | null {
  if (l.liveURL) return l.liveURL;
  if (!lessonHasLive(l) || l.livePlatform !== 'jitsi') return null;
  return `https://meet.jit.si/KKSU-lesson-${l.id.slice(0, 8)}`;
}
export const lessonLiveEnd = (l: M.CourseLesson) => (l.liveStart ? new Date(time(l.liveStart) + l.liveDurationMinutes * 60000) : null);
export const publishedLessons = (c: M.SchoolCourse) => c.lessons.filter((l) => l.isPublished);

/** id видео из ссылок youtube.com/watch?v=, youtu.be/, /shorts/, /live/, /embed/. */
export function youTubeID(text: string): string | null {
  let url: URL;
  try { url = new URL(text.trim()); } catch { return null; }
  const host = url.hostname.toLowerCase();
  const valid = (id?: string | null) => (id && id.length >= 6 && /^[A-Za-z0-9_-]+$/.test(id) ? id : null);
  const parts = url.pathname.split('/').filter(Boolean);
  if (host.includes('youtu.be')) return valid(parts[0]);
  if (!host.includes('youtube.com') && !host.includes('youtube-nocookie.com')) return null;
  const v = url.searchParams.get('v');
  if (v) return valid(v);
  if (parts.length >= 2 && ['shorts', 'live', 'embed', 'v'].includes(parts[0])) return valid(parts[1]);
  return null;
}

// Фильтр недопустимых слов — как KKSUContentFilter.
const STEMS = [
  'хуй', 'хуе', 'хуя', 'пизд', 'ебат', 'ебан', 'ёбан', 'еблан', 'бляд', 'блят', 'сука', 'суки', 'мудак', 'мудил',
  'пидор', 'пидар', 'залуп', 'гандон', 'шлюх', 'долбоеб', 'долбаеб', 'уебок', 'уёбок', 'выеб', 'дебил', 'урод',
  'сігей', 'сигей', 'амыңды', 'қотақ', 'котак',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'asshole', 'nigger', 'faggot', 'whore', 'slut', 'retard',
].map((s) => s.replace(/ё/g, 'е'));

export function containsObjectionable(text: string): boolean {
  const normalized = text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s]/gu, '');
  return STEMS.some((s) => normalized.includes(s));
}
