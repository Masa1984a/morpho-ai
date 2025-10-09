export type AssetSymbol = 'WLD' | 'USDC' | 'WBTC' | 'WETH';

export type AssetCategory = 'coin' | 'stable' | 'wrapped';

export type RunKind = 'hourly' | 'daily';

export type RunStatus = 'pending' | 'success' | 'fail';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export type Verbosity = 'low' | 'medium' | 'high';

export type Language = 'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'th' | 'pt' | 'es';

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'th', 'pt', 'es'];

export const LANGUAGE_NAMES: Record<Language, string> = {
  'en': 'English',
  'ja': '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ko': '한국어',
  'th': 'ไทย',
  'pt': 'Português',
  'es': 'Español',
};

export interface AssetData {
  symbol: AssetSymbol;
  name: string;
  category: AssetCategory;
  chains?: {
    networks: string[];
  };
  officialUrls?: {
    [key: string]: string;
  };
}

export interface SummaryData {
  overviewMd: string;
  market1dMd: string;
  market30dMd: string;
  outlookMd: string;
  confidence?: number;
}

export interface SourceData {
  url: string;
  title?: string;
  domain?: string;
  publishedAt?: Date;
  relevanceScore?: number;
}

export interface RunResult {
  runId: string;
  status: RunStatus;
  tokenIn?: number;
  tokenOut?: number;
  costUsd?: number;
  error?: string;
  summaries: number;
  sources: number;
}
