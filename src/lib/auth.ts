import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify Bearer token for API authentication
 */
export function verifyBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  const validTokens = (process.env.API_BEARER_TOKENS || '').split(',').filter(Boolean);

  return validTokens.includes(token);
}

/**
 * Verify CRON secret for scheduled jobs
 * Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  // Check if Authorization header matches Bearer <CRON_SECRET>
  if (authHeader === `Bearer ${expectedSecret}`) {
    return true;
  }

  return false;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Middleware to check authentication
 */
export function withAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    if (!verifyBearerToken(req)) {
      return unauthorizedResponse();
    }
    return handler(req);
  };
}

/**
 * Middleware to check CRON authentication
 */
export function withCronAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    // Allow both CRON secret and Bearer token for flexibility
    const isValidCron = verifyCronSecret(req);
    const isValidBearer = verifyBearerToken(req);

    if (!isValidCron && !isValidBearer) {
      return unauthorizedResponse('Invalid CRON secret or Bearer token');
    }

    return handler(req);
  };
}
