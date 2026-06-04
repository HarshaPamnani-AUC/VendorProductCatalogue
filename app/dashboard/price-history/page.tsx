'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PricePoint    { date: string; price: number; qty: string; }
interface VendorHistory { vendorCode: string; currency: string; priceHistory: PricePoint[]; }
interface ProductData   { productCode: string; productName: string; upc: string; vendors: VendorHistory[]; }
interface RateMap       { [currency: string]: number; }

const SESSION_KEY = 'priceHistory_state';

// ─── Constants ───────────────────────────────────────────────────────────────
const COLORS = [
  '#ff4d6d','#00c8ff','#ffe033','#a8e63d','#bf7fff',
  '#ff9f43','#00e5c8','#ff6eb4','#48dbfb','#ff6b6b',
  '#1dd1a1','#feca57','#54a0ff','#5f27cd','#ee5a24',
  '#009432','#0652DD','#833471','#EA2027','#006266',
];
const TABLE_PAGE_SIZE = 10;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$',
  CAD: 'C$', CHF: 'Fr', CNY: '¥', INR: '₹',
};
const ALL_CURRENCIES = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR'];

function currencySymbol(currency = 'USD') {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? (currency.toUpperCase() + ' ');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt     = (d: string) => { try { return format(parseISO(d), 'MM/dd/yy');     } catch { return d; } };
const fmtFull = (d: string) => { try { return format(parseISO(d), 'MMM dd, yyyy'); } catch { return d; } };

/** Convert amount from `from` currency to `to` currency using a USD-based rate map. */
function convertPrice(amount: number, from: string, to: string, rates: RateMap): number {
  if (from === to || !rates || Object.keys(rates).length === 0) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate   = rates[to]   ?? 1;
  return (amount / fromRate) * toRate;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function Tip({ active, payload, label, displayCurrency, rates, vendorCurrencies }: any) {
  if (!active || !payload?.length) return null;
  const sym = currencySymbol(displayCurrency);
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm min-w-[170px] max-w-[260px]">
      <p className="text-muted-foreground text-xs mb-2 font-medium">{fmtFull(label)}</p>
      {payload.map((e: any) => {
        const vendorKey  = e.dataKey ?? e.name;
        const srcCurrency = vendorCurrencies?.[vendorKey] ?? 'USD';
        const raw  = Number(e.value);
        const converted = convertPrice(raw, srcCurrency, displayCurrency, rates);
        return (
          <div key={vendorKey} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
              <span className="text-muted-foreground text-xs truncate">{vendorKey}</span>
            </div>
            <span className="font-bold text-sm flex-shrink-0" style={{ color: e.color }}>
              {sym}{converted.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart helpers ────────────────────────────────────────────────────────────
function buildAllVendorsData(
  vendors: VendorHistory[],
  displayCurrency: string,
  rates: RateMap,
) {
  const allDates = Array.from(
    new Set(vendors.flatMap(v => v.priceHistory.map(p => p.date)))
  ).sort();
  return allDates.map(date => {
    const pt: Record<string, any> = { date };
    vendors.forEach(v => {
      const m = v.priceHistory.find(p => p.date === date);
      if (m) pt[v.vendorCode] = convertPrice(m.price, v.currency || 'USD', displayCurrency, rates);
    });
    return pt;
  });
}

function calcDomain(vendors: VendorHistory[], displayCurrency: string, rates: RateMap): [number, number] {
  const all = vendors
    .flatMap(v => v.priceHistory.map(p => convertPrice(p.price, v.currency || 'USD', displayCurrency, rates)))
    .filter(p => p > 0);
  if (!all.length) return [0, 100];
  all.sort((a, b) => a - b);
  const p5  = all[Math.floor(all.length * 0.05)];
  const p95 = all[Math.floor(all.length * 0.95)];
  const pad = (p95 - p5) * 0.15 || 2;
  return [Math.max(0, Math.floor(p5 - pad)), Math.ceil(p95 + pad)];
}

// ─── Vendor table row (paginated) ────────────────────────────────────────────
function VendorTableSection({
  vendor, colorIdx, displayCurrency, rates,
}: {
  vendor: VendorHistory; colorIdx: number; displayCurrency: string; rates: RateMap;
}) {
  const [page, setPage] = useState(0);
  const color  = COLORS[colorIdx % COLORS.length];
  const sym    = currencySymbol(displayCurrency);
  const rows   = [...vendor.priceHistory].reverse();
  const total  = rows.length;
  const pages  = Math.ceil(total / TABLE_PAGE_SIZE);
  const slice  = rows.slice(page * TABLE_PAGE_SIZE, (page + 1) * TABLE_PAGE_SIZE);
  const srcCur = vendor.currency || 'USD';

  return (
    <>
      <tr className="bg-muted/40">
        <td colSpan={5} className="px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: color + '22', color }}>
              {vendor.vendorCode}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {srcCur}
                {srcCur !== displayCurrency && <span className="opacity-60"> → {displayCurrency}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{total} records</span>
            </div>
          </div>
        </td>
      </tr>

      {slice.map((pt, pi) => {
        const converted = convertPrice(pt.price, srcCur, displayCurrency, rates);
        const prevRaw   = rows[page * TABLE_PAGE_SIZE + pi + 1]?.price ?? null;
        const prevConv  = prevRaw !== null ? convertPrice(prevRaw, srcCur, displayCurrency, rates) : null;
        const chg       = prevConv !== null ? converted - prevConv : null;
        return (
          <tr key={`${vendor.vendorCode}-${page}-${pi}`}
              className="border-t border-border/40 hover:bg-muted/30 transition-colors">
            <td className="px-4 py-2 text-muted-foreground">{fmtFull(pt.date)}</td>
            <td className="px-4 py-2">
              <span className="px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: color + '22', color }}>
                {vendor.vendorCode}
              </span>
            </td>
            <td className="px-4 py-2 text-right font-bold text-foreground">
              {sym}{converted.toFixed(2)}
              {srcCur !== displayCurrency && (
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  ({currencySymbol(srcCur)}{pt.price.toFixed(2)})
                </span>
              )}
            </td>
            <td className={`px-4 py-2 text-right font-medium ${
              chg === null ? 'text-muted-foreground'
              : chg > 0    ? 'text-emerald-400'
              : chg < 0    ? 'text-red-400'
              :               'text-muted-foreground'}`}>
              {chg === null ? '—' : `${chg > 0 ? '+' : ''}${sym}${Math.abs(chg).toFixed(2)}`}
            </td>
            <td className="px-4 py-2 text-right text-muted-foreground">{pt.qty ?? '—'}</td>
          </tr>
        );
      })}

      {pages > 1 && (
        <tr className="border-t border-border/40 bg-muted/20">
          <td colSpan={5} className="px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {page * TABLE_PAGE_SIZE + 1}–{Math.min((page + 1) * TABLE_PAGE_SIZE, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2">{page + 1} / {pages}</span>
                <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Product card ─────────────────────────────────────────────────────────────
function ProductCard({
  product, displayCurrency, rates,
}: {
  product: ProductData; displayCurrency: string; rates: RateMap;
}) {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [tableOpen, setTableOpen] = useState(true);

  const sym       = currencySymbol(displayCurrency);
  const allData   = buildAllVendorsData(product.vendors, displayCurrency, rates);
  const yDomain   = calcDomain(product.vendors, displayCurrency, rates);
  const selVendor = product.vendors.find(v => v.vendorCode === selectedVendor) ?? null;
  const selColor  = COLORS[product.vendors.findIndex(v => v.vendorCode === selectedVendor) % COLORS.length];
  const selData   = selVendor
    ? selVendor.priceHistory.map(p => ({
        date: p.date,
        price: convertPrice(p.price, selVendor.currency || 'USD', displayCurrency, rates),
      }))
    : [];

  const vendorCurrencies = Object.fromEntries(
    product.vendors.map(v => [v.vendorCode, v.currency || 'USD'])
  );
  const nativeCurrencies = [...new Set(product.vendors.map(v => v.currency || 'USD'))];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{product.productName}</h2>
        <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
          <span>UPC: <span className="text-foreground font-medium">{product.upc}</span></span>
          <span>Code: <span className="text-foreground font-medium">{product.productCode}</span></span>
          <span className="font-medium text-foreground">
            {product.vendors.length} vendor{product.vendors.length !== 1 ? 's' : ''}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-muted font-semibold text-foreground">
            {nativeCurrencies.join(' · ')}
            {nativeCurrencies.some(c => c !== displayCurrency) && (
              <span className="text-primary"> → {displayCurrency}</span>
            )}
          </span>
        </div>
      </div>

      {/* Chart 1: All vendors */}
      <div className="px-6 pt-5 pb-1">
        <p className="text-sm font-semibold text-foreground">All Vendors — Price History</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {product.vendors.length} vendors · {allData.length} dates
        </p>
      </div>
      <div className="px-2 pb-6" style={{ height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={allData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(128,128,128,0.15)" />
            <XAxis dataKey="date" tickFormatter={fmt}
              tick={{ fill: '#999', fontSize: 10 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }}
              interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `${sym}${v}`}
              tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }}
              width={68} domain={yDomain} />
            <Tooltip content={
              <Tip displayCurrency={displayCurrency} rates={rates} vendorCurrencies={vendorCurrencies} />
            } />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(val, e: any) => <span style={{ color: e.color, fontWeight: 600 }}>{val}</span>} />
            {product.vendors.map((v, i) => (
              <Line key={v.vendorCode} type="linear" dataKey={v.vendorCode}
                stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                dot={{ r: 4, fill: COLORS[i % COLORS.length], stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 6 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Single vendor */}
      <div className="border-t border-border px-6 py-5">
        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-semibold text-foreground whitespace-nowrap">Vendor detail:</label>
          <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]">
            <option value="">— Select a vendor —</option>
            {product.vendors.map(v => (
              <option key={v.vendorCode} value={v.vendorCode}>
                {v.vendorCode} ({v.currency || 'USD'} · {v.priceHistory.length} records)
              </option>
            ))}
          </select>
        </div>

        {selVendor ? (
          <div style={{ height: 300 }}>
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-semibold" style={{ color: selColor }}>{selVendor.vendorCode}</span>
              {' '}· native <span className="font-semibold">{selVendor.currency || 'USD'}</span>
              {selVendor.currency !== displayCurrency && (
                <span className="text-primary"> → showing {displayCurrency}</span>
              )}
              {' '}· {selVendor.priceHistory.length} records
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="0" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="date" tickFormatter={fmt}
                  tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }} />
                <YAxis tickFormatter={v => `${sym}${v}`}
                  tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }}
                  width={68} domain={['auto', 'auto']} />
                <Tooltip content={
                  <Tip displayCurrency={displayCurrency} rates={rates}
                    vendorCurrencies={{ [selVendor.vendorCode]: selVendor.currency }} />
                } />
                <Line type="linear" dataKey="price" name={selVendor.vendorCode}
                  stroke={selColor} strokeWidth={2.5}
                  dot={{ r: 5, fill: selColor, stroke: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Select a vendor above to see its detailed price chart
          </p>
        )}
      </div>

      {/* Collapsible table */}
      <div className="border-t border-border">
        <button onClick={() => setTableOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors text-sm font-semibold text-foreground">
          <span>Price Records Table</span>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-normal">
            <span>{product.vendors.reduce((n, v) => n + v.priceHistory.length, 0)} total records</span>
            {tableOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {tableOpen && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-t border-border">
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Vendor</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">
                    Price ({displayCurrency})
                  </th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Change</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {product.vendors.map((v, vi) => (
                  <VendorTableSection key={v.vendorCode} vendor={v} colorIdx={vi}
                    displayCurrency={displayCurrency} rates={rates} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PriceHistoryPage() {
  const [query,           setQuery]           = useState('');
  const [from,            setFrom]            = useState('');
  const [to,              setTo]              = useState('');
  const [products,        setProducts]        = useState<ProductData[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [searched,        setSearched]        = useState(false);

  // Currency state
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [rates,           setRates]           = useState<RateMap>({ USD: 1 });
  const [ratesDate,       setRatesDate]       = useState('');
  const [ratesSource,     setRatesSource]     = useState('');
  const [ratesLoading,    setRatesLoading]    = useState(false);

  // Fetch live exchange rates on mount
  useEffect(() => {
    (async () => {
      setRatesLoading(true);
      try {
        const res  = await fetch('/api/exchange-rates');
        const data = await res.json();
        if (data.rates) {
          setRates(data.rates);
          setRatesDate(data.date ?? '');
          setRatesSource(data.source ?? '');
        }
      } catch {
        // keep defaults — USD only, no conversion
      } finally {
        setRatesLoading(false);
      }
    })();
  }, []);

  // Restore / persist session state
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.query)           setQuery(saved.query);
      if (saved.from)            setFrom(saved.from);
      if (saved.to)              setTo(saved.to);
      if (saved.displayCurrency) setDisplayCurrency(saved.displayCurrency);
      if (saved.products)        { setProducts(saved.products); setSearched(true); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ query, from, to, products, displayCurrency }));
    } catch { /* quota */ }
  }, [query, from, to, products, displayCurrency]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ query: q });
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const res  = await fetch(`/api/price-history?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setProducts(data.products || []);
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query, from, to]);

  const refreshRates = async () => {
    setRatesLoading(true);
    try {
      const res  = await fetch('/api/exchange-rates', { cache: 'no-store' });
      const data = await res.json();
      if (data.rates) {
        setRates(data.rates);
        setRatesDate(data.date ?? '');
        setRatesSource(data.source ?? '');
      }
    } catch { /* keep current */ } finally {
      setRatesLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 min-h-full bg-background">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Price History</h1>
        <p className="text-muted-foreground text-sm mt-1">Track price changes over time per product and vendor</p>
      </div>

      {/* ── Currency conversion bar ── */}
      <div className="bg-card border border-border rounded-xl px-5 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display in</span>
          <select
            value={displayCurrency}
            onChange={e => setDisplayCurrency(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            {ALL_CURRENCIES.map(c => (
              <option key={c} value={c}>{c} {CURRENCY_SYMBOLS[c] ?? ''}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {ratesLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              Fetching rates…
            </span>
          ) : ratesDate ? (
            <span>
              Rates: <span className="text-foreground font-medium">{ratesDate}</span>
              {' · '}
              <span className={ratesSource === 'fallback' ? 'text-amber-500' : 'text-emerald-500'}>
                {ratesSource === 'live'       && '● live'}
                {ratesSource === 'db_today'   && '● cached today'}
                {ratesSource === 'db_cached'  && '● cached (older)'}
                {ratesSource === 'fallback'   && '⚠ static fallback'}
              </span>
            </span>
          ) : null}
          <button onClick={refreshRates} disabled={ratesLoading}
            title="Refresh exchange rates"
            className="p-1 rounded hover:bg-muted disabled:opacity-40 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick rate reference */}
        {!ratesLoading && displayCurrency !== 'USD' && rates[displayCurrency] && (
          <span className="text-xs text-muted-foreground ml-auto">
            1 USD = <span className="font-semibold text-foreground">
              {rates[displayCurrency].toFixed(4)} {displayCurrency}
            </span>
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground mb-1 block">Product / UPC / Item Code</label>
          <input type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search by name, UPC, or item code…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={search} disabled={loading || !query.trim()}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Searching…
            </span>
          ) : 'Search'}
        </button>
        {searched && products.length > 0 && (
          <button
            onClick={() => { setQuery(''); setFrom(''); setTo(''); setProducts([]); setSearched(false); }}
            className="px-5 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-semibold hover:bg-muted/70 transition-colors">
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {searched && !loading && products.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Found <span className="text-foreground font-semibold">{products.length}</span> product{products.length !== 1 ? 's' : ''} matching{' '}
          <span className="text-foreground font-semibold">"{query}"</span>
        </p>
      )}

      {searched && products.length === 0 && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          No price history found.
        </div>
      )}

      {products.map(product => (
        <ProductCard
          key={product.upc || product.productCode}
          product={product}
          displayCurrency={displayCurrency}
          rates={rates}
        />
      ))}
    </div>
  );
}
