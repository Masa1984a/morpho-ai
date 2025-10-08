export type AssetSymbol = 'WLD' | 'USDC' | 'WBTC' | 'WETH';

export type AssetCategory = 'coin' | 'stable' | 'wrapped';

export type RunKind = 'hourly' | 'daily';

export type RunStatus = 'pending' | 'success' | 'fail';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export type Verbosity = 'low' | 'medium' | 'high';

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
