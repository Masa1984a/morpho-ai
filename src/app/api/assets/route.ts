import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const assets = await prisma.asset.findMany({
      select: {
        id: true,
        symbol: true,
        name: true,
        category: true,
        chains: true,
        officialUrls: true,
        createdAt: true,
        summaries: {
          select: {
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const response = assets.map(asset => ({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      chains: asset.chains,
      officialUrls: asset.officialUrls,
      createdAt: asset.createdAt,
      lastUpdate: asset.summaries[0]?.createdAt || null,
    }));

    return NextResponse.json({ assets: response });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
