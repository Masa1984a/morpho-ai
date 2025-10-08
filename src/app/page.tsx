export default function Home() {
  return (
    <div style={{
      fontFamily: 'monospace',
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>Crypto Insight Ingestor</h1>
      <p>自動収集・要約生成システム for WLD, USDC, WBTC, WETH</p>

      <h2>API Endpoints</h2>

      <h3>Assets</h3>
      <ul>
        <li><code>GET /api/assets</code> - 資産一覧</li>
        <li><code>GET /api/assets/:symbol/summary</code> - 最新サマリ</li>
        <li><code>GET /api/assets/:symbol/prices</code> - 価格系列</li>
      </ul>

      <h3>Runs</h3>
      <ul>
        <li><code>GET /api/runs/:id</code> - 実行メタ情報</li>
      </ul>

      <h3>Ingest (Cron Jobs)</h3>
      <ul>
        <li><code>POST /api/ingest/hourly</code> - 毎時バッチ</li>
        <li><code>POST /api/ingest/daily</code> - 毎日バッチ</li>
      </ul>

      <h2>Authentication</h2>
      <p>全てのエンドポイントは Bearer token 認証が必要です：</p>
      <pre style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderRadius: '4px'
      }}>
        Authorization: Bearer &lt;token&gt;
      </pre>

      <h2>Documentation</h2>
      <ul>
        <li>OpenAPI Spec: <a href="/openapi.yaml">/openapi.yaml</a></li>
        <li>README: <a href="https://github.com/your-repo">GitHub</a></li>
      </ul>

      <h2>Status</h2>
      <p>✓ System operational</p>

      <hr style={{ margin: '2rem 0' }} />

      <p style={{ fontSize: '0.9em', color: '#666' }}>
        Powered by Next.js + OpenAI GPT-4 + Vercel
      </p>
    </div>
  );
}
