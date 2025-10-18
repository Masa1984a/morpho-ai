import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAssetSummary, parseSummarySections, extractSourceUrls, translateSummary } from '@/lib/openai';
import { withCronAuth } from '@/lib/auth';
import {
  extractDomain,
  normalizeUrl,
  calculateRelevanceScore,
  formatCost,
  retryWithBackoff,
  hashString
} from '@/lib/utils';
import type { AssetSymbol, RunKind, Language } from '@/types';
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '@/types';

async function handler(req: NextRequest) {
  const kind: RunKind = 'hourly';
  const model = 'gpt-5-mini';
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

    console.log(`[Hourly Ingest] Processing ${assets.length} assets IN PARALLEL...`);

    // Process ALL assets in parallel
    const assetResults = await Promise.allSettled(
      assets.map(async (asset) => {
        console.log(`[Hourly Ingest] Processing ${asset.symbol}...`);

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

        // Create English summary record
        await prisma.summary.create({
          data: {
            runId: run.id,
            assetId: asset.id,
            language: 'en',
            overviewMd: sections.overview || 'N/A',
            market1dMd: sections.market1d || 'N/A',
            market30dMd: sections.market30d || 'N/A',
            outlookMd: sections.outlook || 'N/A',
            citations: sourceRecords.map(s => s.id),
            confidence: 0.7,
          },
        });

        console.log(`[Hourly Ingest] ✓ ${asset.symbol} English summary completed`);

        // Generate translations for other languages IN PARALLEL
        const translationLanguages = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');

        console.log(`[Hourly Ingest] Starting parallel translation for ${asset.symbol} (${translationLanguages.length} languages)...`);

        const translationResults = await Promise.allSettled(
          translationLanguages.map(async (targetLang) => {
            console.log(`[Hourly Ingest] Translating ${asset.symbol} to ${LANGUAGE_NAMES[targetLang]}...`);

            // Translate the complete English content
            const translationResult = await retryWithBackoff(async () => {
              return await translateSummary({
                content: result.content,
                targetLanguage: targetLang,
                languageName: LANGUAGE_NAMES[targetLang],
              });
            });

            // Parse translated sections
            const translatedSections = parseSummarySections(translationResult.content);

            // Create translated summary record
            await prisma.summary.create({
              data: {
                runId: run.id,
                assetId: asset.id,
                language: targetLang,
                overviewMd: translatedSections.overview || 'N/A',
                market1dMd: translatedSections.market1d || 'N/A',
                market30dMd: translatedSections.market30d || 'N/A',
                outlookMd: translatedSections.outlook || 'N/A',
                citations: sourceRecords.map(s => s.id),
                confidence: 0.7,
              },
            });

            console.log(`[Hourly Ingest] ✓ ${asset.symbol} ${LANGUAGE_NAMES[targetLang]} translation completed`);

            return { targetLang, usage: translationResult.usage };
          })
        );

        console.log(`[Hourly Ingest] ✓ ${asset.symbol} completed with all translations`);

        // Return aggregated data for this asset
        return {
          asset: asset.symbol,
          sourceRecords,
          englishUsage: result.usage,
          translationResults,
        };
      })
    );

    // Process all asset results
    for (let i = 0; i < assetResults.length; i++) {
      const assetResult = assetResults[i];
      const asset = assets[i];

      if (assetResult.status === 'fulfilled') {
        const data = assetResult.value;

        // Count sources and summaries
        sourcesCreated += data.sourceRecords.length;
        summariesCreated++; // English summary

        // Accumulate English usage
        if (data.englishUsage) {
          totalTokenIn += data.englishUsage.prompt_tokens || 0;
          totalTokenOut += data.englishUsage.completion_tokens || 0;
        }

        // Process translation results
        for (let j = 0; j < data.translationResults.length; j++) {
          const translationResult = data.translationResults[j];
          const targetLang = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en')[j];

          if (translationResult.status === 'fulfilled') {
            summariesCreated++;
            if (translationResult.value.usage) {
              totalTokenIn += translationResult.value.usage.prompt_tokens || 0;
              totalTokenOut += translationResult.value.usage.completion_tokens || 0;
            }
          } else {
            const errorMsg = translationResult.reason instanceof Error ? translationResult.reason.message : String(translationResult.reason);
            errors.push(`${asset.symbol} (${targetLang}): ${errorMsg}`);
            console.error(`[Hourly Ingest] ✗ ${asset.symbol} ${targetLang} translation failed:`, errorMsg);
          }
        }
      } else {
        const errorMsg = assetResult.reason instanceof Error ? assetResult.reason.message : String(assetResult.reason);
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
export const maxDuration = 800; // 15 minutes max execution time (for parallel translations)
