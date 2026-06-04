/**
 * GET /api/exchange-rates
 *
 * Returns current USD-based exchange rates.
 * The frontend uses this to display converted prices.
 *
 * Response shape:
 * {
 *   rates: { USD: 1, EUR: 0.858, GBP: 0.742, ... },
 *   date: "2026-06-03",
 *   source: "live" | "db_today" | "db_cached" | "fallback"
 * }
 */

import { NextResponse } from 'next/server';
import { getExchangeRates } from '@/lib/currencyRates';

export const dynamic = 'force-dynamic'; // never statically cached by Next.js

export async function GET() {
  try {
    const result = await getExchangeRates();
    return NextResponse.json(result, {
      headers: {
        // Cache for 1 hour in the browser / CDN edge — rates don't change minute-to-minute
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error: any) {
    console.error('[exchange-rates] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}
