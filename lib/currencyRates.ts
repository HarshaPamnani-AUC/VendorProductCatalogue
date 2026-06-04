/**
 * lib/currencyRates.ts
 *
 * Fetches live exchange rates from Frankfurter (https://api.frankfurter.dev)
 * — free, no API key, updated daily from ECB data.
 *
 * Strategy:
 *  1. Check in-process memory cache (1 hour TTL) — fastest path
 *  2. Check CurrencyRates DB table (today's row) — avoids hammering the API
 *  3. Fetch from Frankfurter — write to DB and memory cache
 *  4. If all else fails, fall back to last known rates from DB (any date)
 *
 * All rates are stored as "1 USD = X foreign" (USD-based).
 */

import { getPool } from './db';
import sql from 'mssql';

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface RateMap {
  /** key = currency code, value = units of that currency per 1 USD */
  [currency: string]: number;
}

export interface RatesResult {
  rates: RateMap;
  date: string;       // YYYY-MM-DD
  source: 'live' | 'db_today' | 'db_cached' | 'fallback';
}

// ── In-process memory cache ───────────────────────────────────────────────────
let memCache: { rates: RateMap; date: string; fetchedAt: number } | null = null;
const MEM_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Fallback rates (approximate — only used if everything fails) ──────────────
const FALLBACK_RATES: RateMap = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5,
  AUD: 1.53, CAD: 1.36, CHF: 0.90, CNY: 7.25, INR: 83.0,
};

const FRANKFURTER_URL =
  'https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,AUD,CAD,CHF,CNY,INR';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

async function fetchFromFrankfurter(): Promise<{ rates: RateMap; date: string } | null> {
  try {
    const res = await fetch(FRANKFURTER_URL, {
      signal: AbortSignal.timeout(5000), // 5s timeout
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // data.rates = { EUR: 0.858, GBP: 0.742, ... }  (all vs 1 USD)
    const rates: RateMap = { USD: 1, ...data.rates };
    return { rates, date: data.date ?? todayUTC() };
  } catch {
    return null;
  }
}

async function readFromDB(): Promise<{ rates: RateMap; date: string } | null> {
  try {
    const pool = await getPool();
    // Get the most recent available rates (not necessarily today's)
    const result = await pool.request().query(`
      SELECT TOP 1 [FromCurrency], [ToCurrency], [Rate], CONVERT(varchar(10), [EffectiveDate], 23) AS RateDate
      FROM [dbo].[CurrencyRates]
      WHERE [FromCurrency] = 'USD'
      ORDER BY [EffectiveDate] DESC
    `);
    if (!result.recordset.length) return null;

    const date = result.recordset[0].RateDate;

    // Re-fetch all rows for that date
    const allResult = await pool.request()
      .input('rateDate', sql.Date, new Date(date))
      .query(`
        SELECT [ToCurrency], [Rate]
        FROM [dbo].[CurrencyRates]
        WHERE [FromCurrency] = 'USD' AND CAST([EffectiveDate] AS DATE) = CAST(@rateDate AS DATE)
      `);

    const rates: RateMap = { USD: 1 };
    for (const row of allResult.recordset) {
      rates[row.ToCurrency] = Number(row.Rate);
    }
    return { rates, date };
  } catch {
    return null;
  }
}

async function readTodayFromDB(): Promise<RateMap | null> {
  try {
    const pool = await getPool();
    const today = todayUTC();
    const result = await pool.request()
      .input('today', sql.Date, new Date(today))
      .query(`
        SELECT [ToCurrency], [Rate]
        FROM [dbo].[CurrencyRates]
        WHERE [FromCurrency] = 'USD' AND CAST([EffectiveDate] AS DATE) = CAST(@today AS DATE)
      `);
    if (!result.recordset.length) return null;
    const rates: RateMap = { USD: 1 };
    for (const row of result.recordset) {
      rates[row.ToCurrency] = Number(row.Rate);
    }
    return rates;
  } catch {
    return null;
  }
}

async function writeToDB(rates: RateMap, date: string): Promise<void> {
  try {
    const pool = await getPool();
    const effectiveDate = new Date(date);

    for (const [to, rate] of Object.entries(rates)) {
      if (to === 'USD') continue;
      await pool.request()
        .input('from',  sql.NVarChar(3), 'USD')
        .input('to',    sql.NVarChar(3), to)
        .input('rate',  sql.Decimal(18, 6), rate)
        .input('date',  sql.DateTime, effectiveDate)
        .query(`
          MERGE [dbo].[CurrencyRates] AS target
          USING (VALUES (@from, @to, @rate, @date))
            AS source ([FromCurrency], [ToCurrency], [Rate], [EffectiveDate])
          ON target.[FromCurrency] = source.[FromCurrency]
             AND target.[ToCurrency] = source.[ToCurrency]
             AND CAST(target.[EffectiveDate] AS DATE) = CAST(source.[EffectiveDate] AS DATE)
          WHEN MATCHED THEN
            UPDATE SET [Rate] = source.[Rate]
          WHEN NOT MATCHED THEN
            INSERT ([FromCurrency], [ToCurrency], [Rate], [EffectiveDate])
            VALUES (source.[FromCurrency], source.[ToCurrency], source.[Rate], source.[EffectiveDate]);
        `);
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.warn('[currencyRates] DB write failed:', (err as Error).message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get current USD-based exchange rates.
 * Returns rates where: amount_in_foreign = amount_in_usd * rate
 */
export async function getExchangeRates(): Promise<RatesResult> {
  // 1. Memory cache hit
  if (memCache && Date.now() - memCache.fetchedAt < MEM_TTL_MS) {
    return { rates: memCache.rates, date: memCache.date, source: 'live' };
  }

  // 2. DB — today's rates already there?
  const dbToday = await readTodayFromDB();
  if (dbToday) {
    const today = todayUTC();
    memCache = { rates: dbToday, date: today, fetchedAt: Date.now() };
    return { rates: dbToday, date: today, source: 'db_today' };
  }

  // 3. Fetch live from Frankfurter
  const live = await fetchFromFrankfurter();
  if (live) {
    memCache = { rates: live.rates, date: live.date, fetchedAt: Date.now() };
    // Persist to DB asynchronously — don't block the response
    writeToDB(live.rates, live.date).catch(() => {});
    return { rates: live.rates, date: live.date, source: 'live' };
  }

  // 4. Fallback — any cached DB row (stale but better than hardcoded)
  const dbCached = await readFromDB();
  if (dbCached) {
    memCache = { rates: dbCached.rates, date: dbCached.date, fetchedAt: Date.now() };
    return { rates: dbCached.rates, date: dbCached.date, source: 'db_cached' };
  }

  // 5. Last resort — static fallback rates
  console.warn('[currencyRates] All rate sources failed — using static fallback');
  return { rates: FALLBACK_RATES, date: todayUTC(), source: 'fallback' };
}

/**
 * Convert an amount from one currency to another using live rates.
 */
export function convert(amount: number, from: string, to: string, rates: RateMap): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate   = rates[to]   ?? 1;
  // Both rates are "per 1 USD", so: amount → USD → target
  return (amount / fromRate) * toRate;
}
