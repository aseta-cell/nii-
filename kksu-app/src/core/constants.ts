import type { PaymentMethod } from './models.gen';

/** Реквизиты по умолчанию (как KKSUPaymentDefaults в iOS). Администратор меняет их в настройках оплаты. */
export const KKSUPaymentDefaults = {
  recipientPhone: '+7 771 473 18 52',
  recipientName: 'Получатель KKSU',
  usdToKzt: 505.0,
  eurToKzt: 550.0,
};

export const PAYMENT_METHODS_ALL: PaymentMethod[] = [
  'kaspi', 'halyk', 'freedom', 'jusan', 'forte', 'bereke', 'bcc', 'homeCredit', 'otherKZBank',
  'internationalCard', 'koronaPay', 'westernUnion', 'wise', 'appStore',
];

/** Способы оплаты переводом (без App Store). */
export function paymentMethodManualCases(): PaymentMethod[] {
  return PAYMENT_METHODS_ALL.filter((m) => m !== 'appStore');
}
