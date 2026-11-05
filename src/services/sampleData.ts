import { ProjectBudget, UsageEvent } from '../types';
import { calculateDeterministicCost, DEFAULT_PRICING_CATALOG } from './pricing';

export const SAMPLE_PROJECTS: ProjectBudget[] = [
  {
    id: 'proj_dev_assist',
    name: 'Backend Refactor',
    description: 'Autonomous architectural migration from REST to tRPC & Go microservices',
    monthlyLimitUsd: 180.0,
    warningThresholdPercent: 75,
    color: '#3b82f6', // blue
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'proj_pr_review',
    name: 'PR Review Bot',
    description: 'Continuous integration automated pull request code and security analysis',
    monthlyLimitUsd: 120.0,
    warningThresholdPercent: 80,
    color: '#8b5cf6', // purple
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
  },
  {
    id: 'proj_test_gen',
    name: 'E2E Test Generator',
    description: 'Playwright and Cypress integration test suite generator and auto-repair',
    monthlyLimitUsd: 90.0,
    warningThresholdPercent: 70,
    color: '#f59e0b', // amber
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'proj_docs',
    name: 'Docs Assistant',
    description: 'Internal engineering wiki question answering and onboarding assistant',
    monthlyLimitUsd: 45.0,
    warningThresholdPercent: 85,
    color: '#10b981', // emerald
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

export function generateSampleEvents(): UsageEvent[] {
  const events: UsageEvent[] = [];
  const now = Date.now();
  const dayMs = 86400000;

  // 1. High-Context Inefficient PR Review Task (PR Review Bot with un-cached large repository context)
  for (let i = 0; i < 14; i++) {
    const timestamp = new Date(now - (14 - i) * dayMs + i * 3600000).toISOString();
    const eventId = `sample_pr_review_${i + 1}`;
    const rawEvent: Partial<UsageEvent> = {
      id: eventId,
      timestamp,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      project: 'PR Review Bot',
      task: 'code_security_scan',
      source: 'api_gateway',
      inputTokens: 92400 + (i % 3) * 1200, // Massive ~93k context sent repeatedly
      outputTokens: 480 + (i % 5) * 45,
      cachedInputTokens: 0, // Inefficiency: Prompt caching was NOT enabled despite static repo AST
      reasoningTokens: null,
      requestCount: 1,
      retryCount: 0,
      status: 'success',
      reportedCurrency: 'USD',
      reportedCost: null,
      costBasis: 'estimated',
      durationMs: 4820 + (i % 4) * 350,
      metadata: {
        repo: 'acme-corp/core-service',
        pr_number: 1042 + i,
        ast_depth: 'full_tree',
      },
      importBatchId: 'sample_batch_001',
      fingerprint: `fp_pr_rev_${i}`,
      qualityScore: 92 - (i % 6),
      isSample: true,
    };

    const costCalc = calculateDeterministicCost(rawEvent, DEFAULT_PRICING_CATALOG);
    rawEvent.estimatedCost = costCalc.costUsd;
    rawEvent.reportedCost = null;
    rawEvent.costBasis = costCalc.costBasis;
    events.push(rawEvent as UsageEvent);
  }

  // 2. Retry-Heavy Flaky Task with Failures (E2E Test Generator - flaky cypress repair loop)
  for (let i = 0; i < 9; i++) {
    const timestamp = new Date(now - (7 - (i % 7)) * dayMs + i * 1800000).toISOString();
    const isFailure = i === 2 || i === 5 || i === 8;
    const retryCount = i > 4 ? 4 + (i % 3) : 2; // High retries!
    const rawEvent: Partial<UsageEvent> = {
      id: `sample_test_retry_${i + 1}`,
      timestamp,
      provider: 'openai',
      model: 'o1-preview',
      project: 'E2E Test Generator',
      task: 'flaky_cypress_test_repair',
      source: 'cli',
      inputTokens: 18500 + i * 600,
      outputTokens: isFailure ? 95 : 2100,
      cachedInputTokens: null,
      reasoningTokens: isFailure ? 2400 : 7800,
      requestCount: 1 + retryCount,
      retryCount: retryCount,
      status: isFailure ? 'failed' : 'success',
      reportedCurrency: 'USD',
      reportedCost: null,
      estimatedCost: null,
      costBasis: 'estimated',
      durationMs: isFailure ? 12400 : 28500,
      metadata: {
        error_type: isFailure ? 'rate_limit_exceeded_or_timeout' : 'none',
        suite: 'auth-flow.cy.ts',
      },
      importBatchId: 'sample_batch_001',
      fingerprint: `fp_test_gen_${i}`,
      qualityScore: isFailure ? 20 : 85,
      isSample: true,
    };

    const costCalc = calculateDeterministicCost(rawEvent, DEFAULT_PRICING_CATALOG);
    rawEvent.estimatedCost = costCalc.costUsd;
    rawEvent.reportedCost = null;
    rawEvent.costBasis = costCalc.costBasis;
    events.push(rawEvent as UsageEvent);
  }

  // 3. Duplicate Requests (Backend Refactor - identical query hash triggered 6 times within 10 minutes)
  const duplicateBaseTimestamp = new Date(now - 3 * dayMs).getTime();
  for (let i = 0; i < 6; i++) {
    const timestamp = new Date(duplicateBaseTimestamp + i * 45000).toISOString(); // 45s apart
    const rawEvent: Partial<UsageEvent> = {
      id: `sample_dup_${i + 1}`,
      timestamp,
      provider: 'openai',
      model: 'gpt-4o',
      project: 'Backend Refactor',
      task: 'sql_migration_generate',
      source: 'cursor',
      inputTokens: 8420, // Identical input tokens and hash!
      outputTokens: 620,
      cachedInputTokens: 4210,
      reasoningTokens: null,
      requestCount: 1,
      retryCount: 0,
      status: 'success',
      reportedCurrency: 'USD',
      reportedCost: 0.0325, // explicitly reported by developer's proxy log
      estimatedCost: null,
      costBasis: 'reported',
      durationMs: 1420 + i * 15,
      metadata: {
        prompt_hash: 'sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        file: 'schema_v4.sql',
        editor: 'cursor-ide',
      },
      importBatchId: 'sample_batch_001',
      fingerprint: `fp_dup_request_${i}`,
      qualityScore: 90,
      isSample: true,
    };
    events.push(rawEvent as UsageEvent);
  }

  // 4. Efficient Prompt-Cached Tasks (Docs Assistant using Gemini 1.5 Flash with high cache hit rate)
  for (let i = 0; i < 22; i++) {
    const timestamp = new Date(now - (22 - i) * dayMs + (i % 8) * 3600000).toISOString();
    const rawEvent: Partial<UsageEvent> = {
      id: `sample_docs_${i + 1}`,
      timestamp,
      provider: 'google',
      model: 'gemini-1.5-flash',
      project: 'Docs Assistant',
      task: 'internal_faq_lookup',
      source: 'api_gateway',
      inputTokens: 32000,
      outputTokens: 380,
      cachedInputTokens: 31200, // 97% cache hit rate!
      reasoningTokens: null,
      requestCount: 1,
      retryCount: 0,
      status: 'success',
      reportedCurrency: 'USD',
      reportedCost: null,
      estimatedCost: null,
      costBasis: 'estimated',
      durationMs: 410,
      metadata: {
        category: 'developer_wiki',
        cache_id: 'cache_shared_docs_manifest_v2',
      },
      importBatchId: 'sample_batch_001',
      fingerprint: `fp_docs_${i}`,
      qualityScore: 94,
      isSample: true,
    };
    const costCalc = calculateDeterministicCost(rawEvent, DEFAULT_PRICING_CATALOG);
    rawEvent.estimatedCost = costCalc.costUsd;
    rawEvent.reportedCost = null;
    rawEvent.costBasis = costCalc.costBasis;
    events.push(rawEvent as UsageEvent);
  }

  // 5. DeepSeek Coding Tasks (Backend Refactor using DeepSeek Coder)
  for (let i = 0; i < 18; i++) {
    const timestamp = new Date(now - (18 - i) * dayMs + (i % 6) * 4200000).toISOString();
    const rawEvent: Partial<UsageEvent> = {
      id: `sample_deepseek_${i + 1}`,
      timestamp,
      provider: 'deepseek',
      model: 'deepseek-coder',
      project: 'Backend Refactor',
      task: 'golang_type_mapping',
      source: 'aider',
      inputTokens: 14200,
      outputTokens: 1150,
      cachedInputTokens: 12000,
      reasoningTokens: null,
      requestCount: 1,
      retryCount: 0,
      status: 'success',
      reportedCurrency: 'USD',
      reportedCost: 0.0038, // explicitly reported by aider log
      costBasis: 'reported',
      durationMs: 1850,
      metadata: {
        cli_tool: 'aider',
        git_branch: 'feature/grpc-endpoints',
      },
      importBatchId: 'sample_batch_001',
      fingerprint: `fp_ds_${i}`,
      qualityScore: 89,
      isSample: true,
    };
    events.push(rawEvent as UsageEvent);
  }

  // 6. Unknown Pricing Records (Experimental internal fine-tuned model)
  for (let i = 0; i < 3; i++) {
    const timestamp = new Date(now - (5 - i) * dayMs).toISOString();
    events.push({
      id: `sample_unknown_pricing_${i + 1}`,
      timestamp,
      provider: 'other',
      model: 'internal-experimental-lora-v1',
      project: 'Backend Refactor',
      task: 'experimental_codegen',
      source: 'eval_suite',
      inputTokens: 12500,
      outputTokens: 750,
      cachedInputTokens: null,
      reasoningTokens: null,
      requestCount: 1,
      retryCount: 0,
      status: 'success',
      reportedCost: null, // Unknown cost!
      estimatedCost: null,
      reportedCurrency: 'USD',
      costBasis: 'unknown',
      durationMs: 3100,
      metadata: {
        note: 'Private on-prem cluster inference without public pricing card',
      },
      importBatchId: 'sample_batch_001',
      fingerprint: `fp_unknown_${i}`,
      qualityScore: 68,
      isSample: true,
    });
  }

  // 7. Data-Quality Warning Record (High latency and 18,000 input tokens, but 0 output tokens with status 'success')
  events.push({
    id: 'sample_warning_event_01',
    timestamp: new Date(now - 2 * dayMs + 7200000).toISOString(),
    provider: 'anthropic',
    model: 'claude-3-opus',
    project: 'Backend Refactor',
    task: 'monolith_dependency_graph',
    source: 'manual',
    inputTokens: 38500,
    outputTokens: 0, // Suspicious! 0 tokens returned on success
    cachedInputTokens: 0,
    reasoningTokens: null,
    requestCount: 1,
    retryCount: 1,
    status: 'success',
    reportedCost: 0.5775,
    estimatedCost: null,
    reportedCurrency: 'USD',
    costBasis: 'reported',
    durationMs: 14800,
    metadata: {
      data_quality_warning: 'Zero output tokens recorded despite 200 OK status code. Possible truncated network stream.',
    },
    importBatchId: 'sample_batch_001',
    fingerprint: 'fp_warning_zero_out',
    qualityScore: null,
    isSample: true,
    recordOrigin: 'sample',
  });

  return events.map((ev) => ({
    ...ev,
    isSample: true,
    recordOrigin: 'sample',
    metadata: {
      ...(ev.metadata || {}),
      provenance: 'sample',
    },
  }));
}
