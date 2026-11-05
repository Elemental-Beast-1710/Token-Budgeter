/**
 * AI Analyst Service Coordinator
 * Orchestrates pre-calculation, data sanitization, provider execution, and response validation.
 */

import { UsageEvent, OptimizationFinding } from '../../types';
import { computePrecalculatedMetrics } from './precalculator';
import { extractCandidateEvidence, sanitizeUserQuestion } from './sanitizer';
import {
  AnalystRequest,
  AnalystResponse,
  AnalystTopic,
  IAnalystProvider,
} from './types';
import { GeminiAnalystProvider } from './geminiProvider';
import { RuleBasedAnalystProvider } from './ruleBasedProvider';

export class AnalystService {
  private geminiProvider: GeminiAnalystProvider;
  private ruleBasedProvider: RuleBasedAnalystProvider;

  constructor() {
    this.geminiProvider = new GeminiAnalystProvider();
    this.ruleBasedProvider = new RuleBasedAnalystProvider();
  }

  public async getAvailableProviders(): Promise<Array<{ id: string; name: string; available: boolean; reason?: string }>> {
    const geminiAvail = await this.geminiProvider.isAvailable();
    const ruleAvail = await this.ruleBasedProvider.isAvailable();

    return [
      {
        id: this.geminiProvider.id,
        name: this.geminiProvider.name,
        available: geminiAvail.available,
        reason: geminiAvail.reason,
      },
      {
        id: this.ruleBasedProvider.id,
        name: this.ruleBasedProvider.name,
        available: ruleAvail.available,
        reason: ruleAvail.reason,
      },
    ];
  }

  public async runAnalysis(options: {
    events: UsageEvent[];
    topic: AnalystTopic;
    focusQuestion?: string;
    findings?: OptimizationFinding[];
    preferOffline?: boolean;
    allowExternalProcessing?: boolean;
  }): Promise<AnalystResponse> {
    const {
      events,
      topic,
      focusQuestion,
      findings,
      preferOffline = false,
      allowExternalProcessing = true,
    } = options;

    // Step 1: Pre-compute deterministic metrics
    const metrics = computePrecalculatedMetrics(events, findings);

    // Step 2: Extract sanitized candidate evidence (no raw prompts)
    const candidateEvidence = extractCandidateEvidence(events, 15);

    // Step 3: Sanitize user focus question (anti-prompt-injection)
    const sanitizedQuestion = sanitizeUserQuestion(focusQuestion);

    // Step 4: Construct strictly bounded request
    const request: AnalystRequest = {
      topic,
      focusQuestion: sanitizedQuestion,
      metrics,
      candidateEvidence,
      allowExternalProcessing: allowExternalProcessing && !preferOffline,
    };

    // Step 5: Select provider
    const provider: IAnalystProvider = preferOffline || !allowExternalProcessing
      ? this.ruleBasedProvider
      : this.geminiProvider;

    return await provider.analyze(request);
  }
}

export const analystService = new AnalystService();
