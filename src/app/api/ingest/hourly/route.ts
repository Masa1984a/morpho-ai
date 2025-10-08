import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAssetSummary, parseSummarySections, extractSourceUrls } from '@/lib/openai';
import { withCronAuth } from '@/lib/auth';
import {
  extractDomain,
  normalizeUrl,
  calculateRelevanceScore,
  formatCost,
  retryWithBackoff,
  hashString
} from '@/lib/utils';
import type { AssetSymbol, RunKind } from '@/types';

async function handler(req: NextRequest) {
  const kind: RunKind = 'hourly';
  const model = 'gpt-4-turbo-preview';
  const reasoningEffort = 'low';
  const verbosity = 'low';

  // Delete runs and related records older than 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const deleteResult = await prisma.run.deleteMany({
    where: {
      startedAt: {
        lt: sevenDaysAgo
      }
    }
  });

  if (deleteResult.count > 0) {
    console.log(`[Hourly Ingest] Deleted ${deleteResult.count} old runs (older than 7 days)`);
  }

  // Create run record
  const run = await prisma.run.create({
    data: {
      kind,
      status: 'pending',
      model,
      reasoningEffort,
      verbosity,
    },
  });

  console.log(`[Hourly Ingest] Started run ${run.id}`);

  let totalTokenIn = 0;
  let totalTokenOut = 0;
  let summariesCreated = 0;
  let sourcesCreated = 0;
  let errors: string[] = [];

  try {
    // Get all assets
    const assets = await prisma.asset.findMany();

    for (const asset of assets) {
      console.log(`[Hourly Ingest] Processing ${asset.symbol}...`);

      try {
        // Generate summary with retry logic
        const result = await retryWithBackoff(async () => {
          return await generateAssetSummary({
            symbol: asset.symbol as AssetSymbol,
            name: asset.name,
            kind,
          });
        });

        // Parse sections
        const sections = parseSummarySections(result.content);

        // Extract source URLs
        const sourceUrls = extractSourceUrls(result.content);

        // Create source records
        const sourceRecords = await Promise.all(
          sourceUrls.map(async (url) => {
            const normalized = normalizeUrl(url);
            const domain = extractDomain(url);
            const relevanceScore = calculateRelevanceScore(url);

            return await prisma.source.create({
              data: {
                runId: run.id,
                assetId: asset.id,
                url: normalized,
                domain,
                relevanceScore,
                hash: hashString(normalized),
                fetchedAt: new Date(),
              },
            });
          })
        );

        sourcesCreated += sourceRecords.length;

        // Create summary record
        await prisma.summary.create({
          data: {
            runId: run.id,
            assetId: asset.id,
            overviewMd: sections.overview || 'N/A',
            market1dMd: sections.market1d || 'N/A',
            market30dMd: sections.market30d || 'N/A',
            outlookMd: sections.outlook || 'N/A',
            citations: sourceRecords.map(s => s.id),
            confidence: 0.7, // Default confidence
          },
        });

        summariesCreated++;

        // Accumulate token usage
        if (result.usage) {
          totalTokenIn += result.usage.prompt_tokens || 0;
          totalTokenOut += result.usage.completion_tokens || 0;
        }

        console.log(`[Hourly Ingest] ✓ ${asset.symbol} completed`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${asset.symbol}: ${errorMsg}`);
        console.error(`[Hourly Ingest] ✗ ${asset.symbol} failed:`, errorMsg);
      }
    }

    // Calculate cost
    const costUsd = formatCost(totalTokenIn, totalTokenOut, model);

    // Update run record
    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: errors.length === 0 ? 'success' : 'fail',
        finishedAt: new Date(),
        tokenIn: totalTokenIn,
        tokenOut: totalTokenOut,
        costUsd,
        error: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    console.log(`[Hourly Ingest] Completed run ${run.id}`);
    console.log(`  Summaries: ${summariesCreated}, Sources: ${sourcesCreated}`);
    console.log(`  Tokens: ${totalTokenIn} in, ${totalTokenOut} out`);
    console.log(`  Cost: $${costUsd.toFixed(4)}`);

    return NextResponse.json({
      success: errors.length === 0,
      runId: run.id,
      summaries: summariesCreated,
      sources: sourcesCreated,
      tokenIn: totalTokenIn,
      tokenOut: totalTokenOut,
      costUsd,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'fail',
        finishedAt: new Date(),
        error: errorMsg,
      },
    });

    console.error(`[Hourly Ingest] Fatal error:`, errorMsg);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

export const GET = withCronAuth(handler);
export const runtime = 'nodejs'; // OpenAI SDK requires Node.js runtime
export const maxDuration = 300; // 5 minutes max execution time
