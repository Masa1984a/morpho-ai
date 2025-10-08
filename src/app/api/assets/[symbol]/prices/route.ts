import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidAssetSymbol } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(req.url);

    if (!isValidAssetSymbol(symbol)) {
      return NextResponse.json(
        { error: 'Invalid asset symbol' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const range = searchParams.get('range') || '1d';
    const interval = searchParams.get('interval') || 'hour';

    // Find asset
    const asset = await prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Calculate time range
    const now = new Date();
    let startDate = new Date();

    if (range === '1d') {
      startDate.setDate(now.getDate() - 1);
    } else if (range === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else {
      return NextResponse.json(
        { error: 'Invalid range. Use 1d or 30d' },
        { status: 400 }
      );
    }

    // Get prices
    const prices = await prisma.price.findMany({
      where: {
        assetId: asset.id,
        ts: {
          gte: startDate,
          lte: now,
        },
      },
      orderBy: {
        ts: 'asc',
      },
      select: {
        id: true,
        ts: true,
        priceUsd: true,
        marketCapUsd: true,
        volume24hUsd: true,
      },
    });

    return NextResponse.json({
      asset: {
        symbol: asset.symbol,
        name: asset.name,
      },
      range,
      interval,
      count: prices.length,
      prices,
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
