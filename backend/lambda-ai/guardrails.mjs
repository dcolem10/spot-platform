/**
 * Agent / loop safety guardrails.
 *
 * Import this in any Lambda that runs an iterative loop or calls an external
 * LLM. It provides three things:
 *   1. A hard ceiling on loop iterations  (prevents runaway agentic loops)
 *   2. Explicit empty-result handling      (prevents infinite "retry on empty")
 *   3. LLM token-usage logging + alerting  (cost visibility per invocation)
 *
 * Why this exists: an unbounded loop whose tool keeps returning empty can
 * silently burn an LLM/API budget overnight. These helpers make the failure
 * loud and bounded instead.
 *
 * Each Lambda is packaged and deployed independently (no shared layer), so —
 * like logger.mjs — this file is co-located. Keep copies in sync if reused.
 */

// Hard ceiling on any agentic / retry loop. Reaching it is a bug, not a path.
export const MAX_ITERATIONS = 25;
// Per-invocation alert threshold for LLM tokens. Logs a warning when exceeded;
// does not throw — generation may legitimately be large, we just want it visible.
export const MAX_TOKENS_PER_RUN = 50000;
// Max consecutive empty tool/API results before we escalate instead of retrying.
export const EMPTY_RESULT_MAX_RETRIES = 3;

export class AgentBudgetExceeded extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentBudgetExceeded';
  }
}

export class EmptyResultMaxRetriesExceeded extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmptyResultMaxRetriesExceeded';
  }
}

/**
 * Throw once an agentic loop reaches its iteration ceiling.
 * Call at the top of each loop body with the current step count.
 */
export function checkIterationLimit(currentStep, limit = MAX_ITERATIONS) {
  if (currentStep >= limit) {
    throw new AgentBudgetExceeded(
      `Iteration limit ${limit} reached at step ${currentStep}`
    );
  }
}

/**
 * Decide whether to retry on an empty result.
 * Returns true  -> result was empty, retry budget remains, caller should retry.
 * Returns false -> result is valid, proceed.
 * Throws        -> result empty and retry budget exhausted.
 */
export function handleEmptyResult(result, retryCount, maxRetries = EMPTY_RESULT_MAX_RETRIES) {
  const isEmpty =
    result === null ||
    result === undefined ||
    result === '' ||
    (Array.isArray(result) && result.length === 0);

  if (isEmpty) {
    if (retryCount >= maxRetries) {
      throw new EmptyResultMaxRetriesExceeded(
        `Empty result after ${retryCount} retries — escalating`
      );
    }
    return true; // signal: retry
  }
  return false; // result is valid
}

/**
 * Log LLM token usage for cost visibility, and warn past the alert threshold.
 * Emits a structured [TOKEN_USAGE] line that CloudWatch Insights can aggregate.
 *
 * Pass the optional `logger` (this project's logger.mjs `log`) to keep output
 * structured; falls back to console.log so it works in any context.
 */
export function logTokenUsage(inputTokens, outputTokens, functionName, logger = null) {
  const input = Number(inputTokens) || 0;
  const output = Number(outputTokens) || 0;
  const total = input + output;

  if (logger && typeof logger.info === 'function') {
    logger.info('[TOKEN_USAGE]', { functionName, inputTokens: input, outputTokens: output, totalTokens: total });
    if (total > MAX_TOKENS_PER_RUN) {
      logger.warn('[TOKEN_WARNING] token threshold exceeded', { functionName, totalTokens: total, threshold: MAX_TOKENS_PER_RUN });
    }
  } else {
    console.log(`[TOKEN_USAGE] ${functionName}: ${input} in / ${output} out / ${total} total`);
    if (total > MAX_TOKENS_PER_RUN) {
      console.warn(`[TOKEN_WARNING] ${functionName} exceeded ${MAX_TOKENS_PER_RUN} token threshold`);
    }
  }
  return total;
}

/**
 * Pull token counts out of an Anthropic Messages API response body.
 * Anthropic returns usage as { input_tokens, output_tokens }. Returns zeros
 * when the field is absent (e.g. on an error payload) so callers stay simple.
 */
export function extractAnthropicUsage(data) {
  const usage = data?.usage || {};
  return {
    inputTokens: Number(usage.input_tokens) || 0,
    outputTokens: Number(usage.output_tokens) || 0,
  };
}
