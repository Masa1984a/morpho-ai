import crypto from 'crypto';

/**
 * Calculate hash for URL content
 */
export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * Normalize URL (remove query params, fragments, etc.)
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Calculate relevance score based on domain and title
 */
export function calculateRelevanceScore(url: string, title?: string): number {
  const domain = extractDomain(url);

  // Official domains get highest score
  const officialDomains = [
    'worldcoin.org',
    'circle.com',
    'wbtc.network',
    'ethereum.org',
  ];

  // Reputable news sources
  const reputableDomains = [
    'coindesk.com',
    'cointelegraph.com',
    'bloomberg.com',
    'reuters.com',
    'theblockcrypto.com',
  ];

  let score = 0.5; // Base score

  if (domain && officialDomains.some(d => domain.includes(d))) {
    score = 1.0;
  } else if (domain && reputableDomains.some(d => domain.includes(d))) {
    score = 0.8;
  }

  // Boost score if title contains relevant keywords
  if (title) {
    const keywords = ['price', 'market', 'analysis', 'update', 'news'];
    const titleLower = title.toLowerCase();
    if (keywords.some(k => titleLower.includes(k))) {
      score = Math.min(1.0, score + 0.1);
    }
  }

  return score;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format cost in USD
 */
export function formatCost(tokenIn: number, tokenOut: number, model: string): number {
  // Pricing per 1M tokens (approximate, update based on actual pricing)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4-turbo-preview': { input: 10, output: 30 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4-turbo-preview'];
  const inputCost = (tokenIn / 1_000_000) * modelPricing.input;
  const outputCost = (tokenOut / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Validate asset symbol
 */
export function isValidAssetSymbol(symbol: string): boolean {
  const validSymbols = ['WLD', 'USDC', 'WBTC', 'WETH'];
  return validSymbols.includes(symbol.toUpperCase());
}
