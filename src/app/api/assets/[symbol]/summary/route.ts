import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidAssetSymbol } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;

    if (!isValidAssetSymbol(symbol)) {
      return NextResponse.json(
        { error: 'Invalid asset symbol' },
        { status: 400 }
      );
    }

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

    // Get latest summary
    const summary = await prisma.summary.findFirst({
      where: { assetId: asset.id },
      orderBy: { createdAt: 'desc' },
      include: {
        run: {
          select: {
            id: true,
            kind: true,
            model: true,
            startedAt: true,
            finishedAt: true,
            tokenIn: true,
            tokenOut: true,
            costUsd: true,
          },
        },
      },
    });

    if (!summary) {
      return NextResponse.json(
        { error: 'No summary available for this asset' },
        { status: 404 }
      );
    }

    // Get cited sources
    const sources = await prisma.source.findMany({
      where: {
        id: { in: summary.citations },
      },
      select: {
        id: true,
        url: true,
        title: true,
        domain: true,
        publishedAt: true,
        relevanceScore: true,
      },
    });

    return NextResponse.json({
      asset: {
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category,
      },
      overview_md: summary.overviewMd,
      market_1d_md: summary.market1dMd,
      market_30d_md: summary.market30dMd,
      outlook_md: summary.outlookMd,
      confidence: summary.confidence,
      citations: summary.citations,
      sources,
      run_meta: {
        id: summary.run.id,
        kind: summary.run.kind,
        model: summary.run.model,
        started_at: summary.run.startedAt,
        finished_at: summary.run.finishedAt,
        token_in: summary.run.tokenIn,
        token_out: summary.run.tokenOut,
        cost_usd: summary.run.costUsd,
      },
      created_at: summary.createdAt,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
