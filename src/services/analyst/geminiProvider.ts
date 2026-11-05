/**
 * Gemini Analyst Provider (Client-side bridge)
 * Calls the secure backend endpoint `/api/analyst/analyze` which invokes `@google/genai`
 * using the modern, supported model `gemini-3.8-flash`.
 *
 * Enforces:
 * - 15-second request timeout via AbortController
 * - Output validation and anti-hallucination checking
 * - Transparent offline fallback if network or API key is unavailable
 */

import {
  IAnalystProvider,
  AnalystRequest,
  AnalystResponse,
} from './types';
import { RuleBasedAnalystProvider } from './ruleBasedProvider';
import { validateAnalystOutput } from './validator';

export class GeminiAnalystProvider implements IAnalystProvider {
  public readonly id = 'gemini-3.8-flash';
  public readonly name = 'Gemini 3.8 Flash (Server-Side Proxy)';
  private readonly fallbackProvider: RuleBasedAnalystProvider;

  constructor() {
    this.fallbackProvider = new RuleBasedAnalystProvider();
  }

  public async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        return { available: false, reason: 'Backend health check failed.' };
      }
      const data = await res.json();
      if (!data.hasGeminiKey) {
        return {
          available: false,
          reason: 'Gemini API key is not configured in the Secrets panel. Offline mode is active.',
        };
      }
      return { available: true };
    } catch (err: any) {
      return {
        available: false,
        reason: err.message || 'Unable to connect to backend server.',
      };
    }
  }

  public async analyze(request: AnalystRequest): Promise<AnalystResponse> {
    // Check if user disabled external processing
    if (!request.allowExternalProcessing) {
      const fallback = await this.fallbackProvider.analyze(request);
      fallback.validation.warnings.push(
        'External processing is disabled in user preferences. Ran in offline deterministic mode.'
      );
      return fallback;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout requirement

    try {
      const response = await fetch('/api/analyst/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const rawData = await response.json();

      // Enforce anti-hallucination and schema validation
      return validateAnalystOutput(
        rawData,
        request.topic,
        request.metrics,
        request.candidateEvidence,
        'gemini-3.8-flash'
      );
    } catch (error: any) {
      clearTimeout(timeoutId);

      // On failure (timeout, network, missing key), gracefully fall back to rule-based engine
      const isAbort = error.name === 'AbortError';
      const warningMessage = isAbort
        ? 'Gemini request timed out after 15 seconds. Reverted to offline rule-based engine.'
        : `Gemini API call failed (${error.message || 'network error'}). Reverted to offline rule-based engine.`;

      const fallback = await this.fallbackProvider.analyze(request);
      fallback.validation.warnings.push(warningMessage);
      return fallback;
    }
  }
}
