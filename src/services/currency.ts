/**
 * Currency Conversion and Parsing Service
 * Provides deterministic currency conversions and robust parsing for multi-currency imports.
 */

// Reference exchange rates relative to 1 USD
// Rates reflect standard benchmark reference values.
export const REFERENCE_EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,    // 1 EUR = 1.08 USD
  GBP: 1.28,    // 1 GBP = 1.28 USD
  CAD: 0.73,    // 1 CAD = 0.73 USD
  AUD: 0.65,    // 1 AUD = 0.65 USD
  JPY: 0.0067,  // 1 JPY = 0.0067 USD (approx 149.25 JPY/USD)
  CHF: 1.12,    // 1 CHF = 1.12 USD
  CNY: 0.14,    // 1 CNY = 0.14 USD
  INR: 0.012,   // 1 INR = 0.012 USD
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CHF: 'CHF',
  CNY: '¥',
  INR: '₹',
};

/**
 * Returns exchange rate from currency to USD.
 * If currency is unknown, defaults to 1.0 with a fallback.
 */
export function getExchangeRateToUsd(currency: string): number {
  const code = (currency || 'USD').trim().toUpperCase();
  return REFERENCE_EXCHANGE_RATES_TO_USD[code] ?? 1.0;
}

/**
 * Deterministically converts an amount between two currencies.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'USD'
): number {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 0;
  }
  const from = (fromCurrency || 'USD').trim().toUpperCase();
  const to = (toCurrency || 'USD').trim().toUpperCase();

  if (from === to) {
    return Number(amount.toFixed(6));
  }

  const fromRate = getExchangeRateToUsd(from);
  const toRate = getExchangeRateToUsd(to);

  // amount in USD = amount * fromRate
  // amount in toCurrency = (amount in USD) / toRate
  const inUsd = amount * fromRate;
  const converted = toRate > 0 ? inUsd / toRate : inUsd;

  return Number(converted.toFixed(6));
}

/**
 * Parses numeric cost and optionally detects currency from text.
 * Handles strings like "$12.50", "€10.00", "£4.25", "¥1500", "12.50 USD", "0.05", etc.
 */
export function parseCurrencyFromText(text: string | number | null | undefined): {
  amount: number | null;
  currency?: string;
} {
  if (text === null || text === undefined) {
    return { amount: null };
  }

  if (typeof text === 'number') {
    return isNaN(text) ? { amount: null } : { amount: text };
  }

  const raw = String(text).trim();
  if (!raw) {
    return { amount: null };
  }

  let detectedCurrency: string | undefined = undefined;

  // Detect currency from known symbols
  if (raw.includes('$')) {
    detectedCurrency = 'USD';
  } else if (raw.includes('€')) {
    detectedCurrency = 'EUR';
  } else if (raw.includes('£')) {
    detectedCurrency = 'GBP';
  } else if (raw.includes('¥')) {
    detectedCurrency = 'JPY';
  } else if (raw.includes('₹')) {
    detectedCurrency = 'INR';
  }

  // Detect currency codes in string
  const upper = raw.toUpperCase();
  for (const code of Object.keys(REFERENCE_EXCHANGE_RATES_TO_USD)) {
    if (upper.includes(code)) {
      detectedCurrency = code;
      break;
    }
  }

  // Strip non-numeric characters except digits, periods, and minus
  // Remove commas used as thousands separators
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return { amount: null, currency: detectedCurrency };
  }

  return { amount: parsed, currency: detectedCurrency };
}

/**
 * Formats a currency amount with symbol and appropriate decimal places.
 */
export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'N/A';
  }
  const code = (currency || 'USD').trim().toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || `${code} `;

  // JPY typically has 0 decimals for large amounts, or 2 for fractional
  const decimals = code === 'JPY' && amount >= 100 ? 0 : 2;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals === 0 ? 0 : 4,
  })}`;
}
