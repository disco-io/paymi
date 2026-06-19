export const PAYMENT_PROVIDERS = ['venmo', 'paypal', 'zelle', 'other'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  venmo: 'Venmo',
  paypal: 'PayPal',
  zelle: 'Zelle',
  other: 'Other',
};

export function isPaymentProvider(value: string): value is PaymentProvider {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export function paymentFieldLabel(provider: PaymentProvider): string {
  switch (provider) {
    case 'venmo':
      return 'Venmo username';
    case 'paypal':
      return 'PayPal username or email';
    case 'zelle':
      return 'Zelle phone or email';
    default:
      return 'payment username';
  }
}
