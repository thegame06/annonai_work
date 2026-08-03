/**
 * Vendor-neutral, deterministic token estimate.
 *
 * Exactness is not the goal and is not achievable without binding the Core to a
 * specific model's tokenizer. Stability is the goal: both Annona and the naive
 * baseline are measured with this same function, so the ratio between them is
 * meaningful even though the absolute numbers are approximations.
 */
export const estimateTokens = (text: string): number => {
  if (text.length === 0) return 0;
  // ~4 characters per token for English prose and code identifiers.
  return Math.ceil(text.length / 4);
};
