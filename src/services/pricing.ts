import { PricingRate, UsageEvent } from '../types';
import { convertCurrency } from './currency';

/**
 * Verified pricing rate card catalog.
 * Rates in USD per 1 Million Tokens (1,000,000 tokens).
 * Preserves effective dates and official documentation provenance.
 */
export const DEFAULT_PRICING_CATALOG: PricingRate[] = [
  // Anthropic
  {
    id: 'anthropic-claude-3-5-sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 15.0,
    cachedInputPerMillionUsd: 0.3, // Anthropic prompt cache read is 90% discount (0.1x)
    effectiveDate: '2024-10-22',
    source: 'Anthropic Pricing Docs (October 2024)',
  },
  {
    id: 'anthropic-claude-3-opus',
    provider: 'anthropic',
    model: 'claude-3-opus',
    inputPerMillionUsd: 15.0,
    outputPerMillionUsd: 75.0,
    cachedInputPerMillionUsd: 1.5,
    effectiveDate: '2024-03-04',
    source: 'Anthropic Pricing Docs',
  },
  {
    id: 'anthropic-claude-3-5-haiku',
    provider: 'anthropic',
    model: 'claude-3-5-haiku',
    inputPerMillionUsd: 0.8,
    outputPerMillionUsd: 4.0,
    cachedInputPerMillionUsd: 0.08,
    effectiveDate: '2024-11-04',
    source: 'Anthropic Pricing Docs',
  },

  // OpenAI
  {
    id: 'openai-gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10.0,
    cachedInputPerMillionUsd: 1.25, // 50% prompt caching discount
    effectiveDate: '2024-10-02',
    source: 'OpenAI Pricing Page',
  },
  {
    id: 'openai-gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
    cachedInputPerMillionUsd: 0.075,
    effectiveDate: '2024-07-18',
    source: 'OpenAI Pricing Page',
  },
  {
    id: 'openai-o1-preview',
    provider: 'openai',
    model: 'o1-preview',
    inputPerMillionUsd: 15.0,
    outputPerMillionUsd: 60.0,
    cachedInputPerMillionUsd: 7.5,
    reasoningPerMillionUsd: 60.0,
    effectiveDate: '2024-09-12',
    source: 'OpenAI Pricing Page',
  },
  {
    id: 'openai-o1-mini',
    provider: 'openai',
    model: 'o1-mini',
    inputPerMillionUsd: 3.0,
    outputPerMillionUsd: 12.0,
    cachedInputPerMillionUsd: 1.5,
    reasoningPerMillionUsd: 12.0,
    effectiveDate: '2024-09-12',
    source: 'OpenAI Pricing Page',
  },

  // Google Gemini
  {
    id: 'google-gemini-1-5-pro',
    provider: 'google',
    model: 'gemini-1.5-pro',
    inputPerMillionUsd: 1.25, // for prompts <= 128k
    outputPerMillionUsd: 5.0,
    cachedInputPerMillionUsd: 0.3125, // 75% prompt caching discount
    effectiveDate: '2024-09-24',
    source: 'Google Cloud Vertex / AI Studio Pricing',
  },
  {
    id: 'google-gemini-1-5-flash',
    provider: 'google',
    model: 'gemini-1.5-flash',
    inputPerMillionUsd: 0.075,
    outputPerMillionUsd: 0.3,
    cachedInputPerMillionUsd: 0.01875,
    effectiveDate: '2024-09-24',
    source: 'Google Cloud Vertex / AI Studio Pricing',
  },
  {
    id: 'google-gemini-2-0-flash',
    provider: 'google',
    model: 'gemini-2.0-flash',
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.4,
    cachedInputPerMillionUsd: 0.025,
    effectiveDate: '2024-12-11',
    source: 'Google Cloud Vertex / AI Studio Pricing',
  },

  // DeepSeek
  {
    id: 'deepseek-v3',
    provider: 'deepseek',
    model: 'deepseek-chat',
    inputPerMillionUsd: 0.14,
    outputPerMillionUsd: 0.28,
    cachedInputPerMillionUsd: 0.014,
    effectiveDate: '2024-12-26',
    source: 'DeepSeek Official API Pricing',
  },
  {
    id: 'deepseek-coder-v2',
    provider: 'deepseek',
    model: 'deepseek-coder',
    inputPerMillionUsd: 0.14,
    outputPerMillionUsd: 0.28,
    cachedInputPerMillionUsd: 0.014,
    effectiveDate: '2024-06-17',
    source: 'DeepSeek Official API Pricing',
  },
  {
    id: 'deepseek-r1',
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    inputPerMillionUsd: 0.55,
    outputPerMillionUsd: 2.19,
    cachedInputPerMillionUsd: 0.14,
    effectiveDate: '2025-01-20',
    source: 'DeepSeek Official API Pricing',
  },
];

/**
 * Normalizes model names for robust matching (e.g. removes dates or handles aliases).
 */
export function normalizeModelName(rawModel: string): string {
  const m = rawModel.toLowerCase().trim();
  if (m.includes('claude-3-5-sonnet') || m.includes('claude-3.5-sonnet')) return 'claude-3-5-sonnet';
  if (m.includes('claude-3-opus') || m.includes('claude-3.0-opus')) return 'claude-3-opus';
  if (m.includes('claude-3-5-haiku') || m.includes('claude-3.5-haiku')) return 'claude-3-5-haiku';
  if (m.includes('o1-preview')) return 'o1-preview';
  if (m.includes('o1-mini')) return 'o1-mini';
  if (m.includes('gpt-4o-mini')) return 'gpt-4o-mini';
  if (m.includes('gpt-4o')) return 'gpt-4o';
  if (m.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
  if (m.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
  if (m.includes('gemini-2.0-flash')) return 'gemini-2.0-flash';
  if (m.includes('deepseek-coder')) return 'deepseek-coder';
  if (m.includes('deepseek-reasoner') || m.includes('deepseek-r1')) return 'deepseek-reasoner';
  if (m.includes('deepseek-chat') || m.includes('deepseek-v3')) return 'deepseek-chat';
  return m;
}

export interface CostCalculationResult {
  costUsd: number | null;
  costBasis: 'reported' | 'estimated' | 'unknown';
  pricingSource?: string;
  notes?: string;
}

/**
 * Deterministically computes the cost for an event.
 * Never silently blends estimates with reported figures.
 * Never hallucinates rates when missing.
 */
export function calculateDeterministicCost(
  event: Partial<UsageEvent>,
  catalog: PricingRate[] = DEFAULT_PRICING_CATALOG
): CostCalculationResult {
  // If reported cost is negative, it is an invalid cost
  if (
    event.reportedCost !== null &&
    event.reportedCost !== undefined &&
    !isNaN(event.reportedCost) &&
    event.reportedCost < 0
  ) {
    return {
      costUsd: null,
      costBasis: 'unknown',
      notes: 'Negative reported cost is invalid and cannot be accounted',
    };
  }

  // If reported cost is explicitly present as a valid non-negative number:
  if (
    event.reportedCost !== null &&
    event.reportedCost !== undefined &&
    !isNaN(event.reportedCost) &&
    event.reportedCost >= 0
  ) {
    const rawCost = event.reportedCost;
    const currency = (event.reportedCurrency || 'USD').trim().toUpperCase();
    const costInUsd = convertCurrency(rawCost, currency, 'USD');

    return {
      costUsd: Number(costInUsd.toFixed(6)),
      costBasis: 'reported',
      notes:
        currency === 'USD'
          ? 'Explicit cost reported in source data'
          : `Explicit cost reported as ${rawCost} ${currency} (converted to USD)`,
    };
  }

  if (!event.model || !event.model.trim()) {
    return {
      costUsd: null,
      costBasis: 'unknown',
      notes: 'Missing model identifier; cannot calculate estimated cost',
    };
  }

  // Look up pricing rate card
  const normalizedModel = normalizeModelName(event.model || '');
  const rateCard = catalog.find(
    (r) =>
      r.model.toLowerCase() === normalizedModel ||
      normalizeModelName(r.model) === normalizedModel ||
      (event.provider &&
        r.provider.toLowerCase() === event.provider.toLowerCase() &&
        (r.model.toLowerCase() === normalizedModel || normalizeModelName(r.model) === normalizedModel))
  );

  if (!rateCard) {
    return {
      costUsd: null,
      costBasis: 'unknown',
      notes: `No verified pricing rate card found for model "${event.model || 'unspecified'}"`,
    };
  }

  // Safe pricing unit retrieval (must be finite positive number)
  const getSafeUnit = (unit?: number, fallback: number = 1_000_000): number => {
    if (typeof unit === 'number' && !isNaN(unit) && unit > 0) {
      return unit;
    }
    return fallback;
  };

  const inputUnit = getSafeUnit(rateCard.inputPricingUnit, 1_000_000);
  const outputUnit = getSafeUnit(rateCard.outputPricingUnit, 1_000_000);
  const cachedUnit = getSafeUnit(rateCard.cachedInputPricingUnit, inputUnit);
  const reasoningUnit = getSafeUnit(rateCard.reasoningPricingUnit, outputUnit);

  const rawInput = Math.max(0, event.inputTokens || 0);
  const rawOutput = Math.max(0, event.outputTokens || 0);
  const cachedInput = Math.max(0, Math.min(event.cachedInputTokens || 0, rawInput));
  const uncachedInput = Math.max(0, rawInput - cachedInput);

  const inputRate = Math.max(0, rateCard.inputPerMillionUsd || 0);
  const outputRate = Math.max(0, rateCard.outputPerMillionUsd || 0);
  const uncachedInputCost = (uncachedInput / inputUnit) * inputRate;
  const cachedInputRate =
    rateCard.cachedInputPerMillionUsd !== undefined
      ? Math.max(0, rateCard.cachedInputPerMillionUsd)
      : inputRate; // if no caching discount specified
  const cachedInputCost = (cachedInput / cachedUnit) * cachedInputRate;

  const outputCost = (rawOutput / outputUnit) * outputRate;

  let reasoningCost = 0;
  if (event.reasoningTokens && event.reasoningTokens > 0 && rateCard.reasoningPerMillionUsd) {
    const reasoningRate = Math.max(0, rateCard.reasoningPerMillionUsd);
    reasoningCost = (event.reasoningTokens / reasoningUnit) * reasoningRate;
  }

  const totalCalculated = uncachedInputCost + cachedInputCost + outputCost + reasoningCost;

  if (isNaN(totalCalculated)) {
    return {
      costUsd: null,
      costBasis: 'unknown',
      notes: 'Error computing cost calculation',
    };
  }

  return {
    costUsd: Number(totalCalculated.toFixed(6)),
    costBasis: 'estimated',
    pricingSource: rateCard.source,
    notes: `Calculated using ${inputUnit.toLocaleString()} unit rate card effective ${rateCard.effectiveDate}`,
  };
}
