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
  const { symbol, name, kind, allowedDomains } = params;

  const isDaily = kind === 'daily';
  const reasoningEffort = isDaily ? 'high' : 'medium';

  const systemPrompt = 'You are a cryptocurrency analyst. Always call the web_search tool before finalizing your answer. Provide concise, citation-rich Markdown in English. The information you provide will appear on a cryptocurrency news/information site.';

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
- Please refrain from asking questions.
- Only provide information; do not include your recommendations.
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
          model: 'gpt-5-mini',
          reasoning: { effort: reasoningEffort },
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: systemPrompt }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }],
            },
          ],
          tools: [
            {
              type: 'web_search',
              ...(allowedDomains ? { allowed_domains: allowedDomains } : {}),
            },
          ],
          tool_choice: 'auto',
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
      let content = '';

      if (Array.isArray(data.output_text)) {
        content = data.output_text.join('\n');
      } else if (typeof data.output_text === 'string') {
        content = data.output_text;
      }

      if (!content && Array.isArray(data.output)) {
        const messageObject = data.output.find((item: any) => item.type === 'message');
        const messageContent = messageObject?.content?.find((part: any) => part.type === 'output_text' || part.type === 'text');
        content = messageContent?.text || '';
      }

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
        model: data.model || 'gpt-5-mini',
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

/**
 * Translate summary sections to target language using OpenAI
 */
export async function translateSummary(params: {
  content: string;
  targetLanguage: string;
  languageName: string;
}): Promise<{
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}> {
  const { content, targetLanguage, languageName } = params;

  const systemPrompt = `You are a professional translator for cryptocurrency content.
## CRITICAL REQUIREMENTS:
- **DO NOT translate the section headers (##)**: Keep "## Overview", "## Last 24h", "## Last 30d", and "## Outlook" EXACTLY as they are in English
- Translate ONLY the content under each section header
- Preserve all Markdown formatting (##, bullets, etc.)
- Keep all URLs exactly as they are
- Maintain technical terminology accuracy
- Keep numbers, dates, and symbols unchanged
- Translate naturally while preserving the professional tone

## Please provide the translated content in ${languageName} with:
- Section headers (## Overview, ## Last 24h, ## Last 30d, ## Outlook) kept in English
- Section content translated to ${languageName}
- Same structure and formatting
`;

  const prompt = `Please translate the following cryptocurrency analysis from English to ${languageName} (${targetLanguage}).
"""
  ## Original content in English:
${content}
"""
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          reasoning: { effort: `medium` },
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: systemPrompt }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      let translatedContent = '';

      if (Array.isArray(data.output_text)) {
        translatedContent = data.output_text.join('\n');
      } else if (typeof data.output_text === 'string') {
        translatedContent = data.output_text;
      }

      if (!translatedContent && Array.isArray(data.output)) {
        const messageObject = data.output.find((item: any) => item.type === 'message');
        const messageContent = messageObject?.content?.find((part: any) => part.type === 'output_text' || part.type === 'text');
        translatedContent = messageContent?.text || '';
      }

      if (!translatedContent) {
        throw new Error('Could not extract translated content from API response');
      }

      return {
        content: translatedContent,
        usage: {
          prompt_tokens: data.usage?.input_tokens || data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.output_tokens || data.usage?.completion_tokens || 0,
          total_tokens:
            (data.usage?.input_tokens || data.usage?.prompt_tokens || 0) +
            (data.usage?.output_tokens || data.usage?.completion_tokens || 0),
        },
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Translation API call timed out after 2 minutes');
      }
      throw error;
    }
  } catch (error) {
    console.error('Translation API error:', error);
    throw error;
  }
}
