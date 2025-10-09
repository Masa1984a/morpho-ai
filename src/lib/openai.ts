const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

/**
 * Generate summary for a crypto asset using OpenAI Responses API with web_search
 */
export async function generateAssetSummary(params: {
  symbol: string;
  name: string;
  kind: 'hourly' | 'daily';
  allowedDomains?: string[];
}) {
  const { symbol, name, kind } = params;

  const isDaily = kind === 'daily';
  const reasoningEffort = isDaily ? 'medium' : 'low';

  const prompt = `You are a cryptocurrency analyst. Please provide a comprehensive summary of $${symbol} (${name}) in English, organized into the following four sections:

## Overview
Basic information about the asset, use cases, and key technical specifications

## Last 24h
Price movements, events, and significant news from the past 24 hours

## Last 30d
Trends, volatility, and major events from the past 30 days

## Outlook
Fundamental analysis, technical factors, risks, and uncertainties

**Critical Requirements:**
- You MUST use web_search to gather the latest information
- Cite source URLs at the end of each paragraph (e.g., https://...)
- Include specific numbers and dates for quantitative data such as prices and market cap whenever possible
- Avoid speculation; state "unknown" when information is unclear
- Format each section using ## headers in Markdown`;

  try {
    // Use Responses API with web_search
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'o4-mini',
          input: prompt,
          tools: [{ type: 'web_search' }],
          reasoning: { effort: reasoningEffort },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Parse response according to Responses API format
      const messageObject = data.output?.find((item: any) => item.type === 'message');
      const content = messageObject?.content?.[0]?.text || '';

      if (!content) {
        console.error('Unexpected API response structure:', JSON.stringify(data, null, 2));
        throw new Error('Could not extract content from API response');
      }

      // Extract usage info
      const usage = data.usage || {};

      return {
        content,
        usage: {
          prompt_tokens: usage.input_tokens || 0,
          completion_tokens: usage.output_tokens || 0,
          total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        },
        model: data.model || 'o4-mini',
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('OpenAI API call timed out after 3 minutes');
      }
      throw error;
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Parse markdown sections from generated summary
 */
export function parseSummarySections(markdown: string): {
  overview: string;
  market1d: string;
  market30d: string;
  outlook: string;
} {
  const sections = {
    overview: '',
    market1d: '',
    market30d: '',
    outlook: '',
  };

  // Split by ## headers
  const parts = markdown.split(/^##\s+/m);

  for (const part of parts) {
    const lines = part.trim().split('\n');
    const header = lines[0]?.toLowerCase() || '';
    const content = lines.slice(1).join('\n').trim();

    if (header.includes('overview') || header.includes('Overview')) {
      sections.overview = content;
    } else if (header.includes('last 24h') || header.includes('Last 24h')) {
      sections.market1d = content;
    } else if (header.includes('last 30d') || header.includes('Last 30d')) {
      sections.market30d = content;
    } else if (header.includes('outlook') || header.includes('Outlook')) {
      sections.outlook = content;
    }
  }

  return sections;
}

/**
 * Extract source URLs from markdown content
 */
export function extractSourceUrls(markdown: string): string[] {
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  const matches = markdown.match(urlRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
}
