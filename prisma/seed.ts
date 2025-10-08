import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Seed 4 assets: WLD, USDC, WBTC, WETH
  const assets = [
    {
      symbol: 'WLD',
      name: 'Worldcoin',
      category: 'coin',
      chains: { networks: ['Ethereum', 'Optimism'] },
      officialUrls: {
        website: 'https://worldcoin.org',
        blog: 'https://blog.worldcoin.org',
        docs: 'https://docs.worldcoin.org',
      },
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      category: 'stable',
      chains: { networks: ['Ethereum', 'Polygon', 'Avalanche', 'Solana'] },
      officialUrls: {
        website: 'https://www.circle.com/en/usdc',
        docs: 'https://developers.circle.com',
      },
    },
    {
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      category: 'wrapped',
      chains: { networks: ['Ethereum'] },
      officialUrls: {
        website: 'https://wbtc.network',
        docs: 'https://wbtc.network/dashboard/transparency',
      },
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      category: 'wrapped',
      chains: { networks: ['Ethereum'] },
      officialUrls: {
        website: 'https://weth.io',
        contract: 'https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      },
    },
  ];

  for (const asset of assets) {
    const created = await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: {},
      create: asset,
    });
    console.log(`✓ Asset created/verified: ${created.symbol} (${created.name})`);
  }

  console.log('Seed completed successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
