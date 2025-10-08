import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        summaries: {
          select: {
            id: true,
            assetId: true,
            confidence: true,
            createdAt: true,
          },
        },
        sources: {
          select: {
            id: true,
            url: true,
            domain: true,
            relevanceScore: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Get unique domains
    const domains = [...new Set(run.sources.map(s => s.domain).filter(Boolean))];

    // Calculate average relevance score
    const avgRelevance =
      run.sources.length > 0
        ? run.sources.reduce((sum, s) => sum + (s.relevanceScore || 0), 0) / run.sources.length
        : 0;

    return NextResponse.json({
      id: run.id,
      kind: run.kind,
      status: run.status,
      model: run.model,
      reasoning_effort: run.reasoningEffort,
      verbosity: run.verbosity,
      started_at: run.startedAt,
      finished_at: run.finishedAt,
      token_in: run.tokenIn,
      token_out: run.tokenOut,
      cost_usd: run.costUsd,
      error: run.error,
      summaries: {
        count: run.summaries.length,
        items: run.summaries,
      },
      sources: {
        count: run.sources.length,
        unique_domains: domains.length,
        domains,
        avg_relevance: avgRelevance,
      },
    });
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch run' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
