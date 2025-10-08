import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crypto Insight Ingestor',
  description: '自動収集・要約生成システム for WLD, USDC, WBTC, WETH',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
