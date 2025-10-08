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

  const prompt = `あなたは仮想通貨のアナリストです。$${symbol} (${name}) について、以下の4つのセクションを日本語で厳密に要約してください：

## Overview（概要）
資産の基本情報、用途、主要な技術仕様

## Last 24h（直近1日）
直近24時間の価格推移、出来事、重要なニュース

## Last 30d（直近30日）
直近30日のトレンド、ボラティリティ、主要イベント

## Outlook（今後の展望）
ファンダメンタル分析、技術的要因、リスク・不確実性

**重要な要件：**
- 必ず web_search を使用して最新情報を収集すること
- 各段落の末尾に出典URLを明記すること（例: https://...）
- 価格や時価総額などの定量データは可能な限り数値・日付を付与
- 推測は避け、曖昧な場合は「不明」と明記
- Markdown形式で各セクションを ## で区切る`;

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

    if (header.includes('overview') || header.includes('概要')) {
      sections.overview = content;
    } else if (header.includes('last 24h') || header.includes('直近1日') || header.includes('24時間')) {
      sections.market1d = content;
    } else if (header.includes('last 30d') || header.includes('直近30日')) {
      sections.market30d = content;
    } else if (header.includes('outlook') || header.includes('展望')) {
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
