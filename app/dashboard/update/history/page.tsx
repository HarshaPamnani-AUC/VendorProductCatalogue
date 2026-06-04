'use client';

import React, { useState, useEffect } from 'react';
import { Download, ChevronDown, ChevronUp, Tag, TrendingDown, TrendingUp as TrendingUpIcon, BarChart2, CalendarCheck, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const SESSION_KEY = 'product_insights_state';

// ─── Currency helpers ─────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$',
  CAD: 'C$', CHF: 'Fr', CNY: '¥', INR: '₹',
};
const ALL_CURRENCIES = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','INR'];

function sym(currency = 'USD') {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? (currency.toUpperCase() + ' ');
}

interface RateMap { [currency: string]: number; }

function convertPrice(amount: number, from: string, to: string, rates: RateMap): number {
  if (!amount || from === to || !rates || Object.keys(rates).length === 0) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate   = rates[to]   ?? 1;
  return (amount / fromRate) * toRate;
}

function fmtPrice(amount: number, from: string, to: string, rates: RateMap): string {
  const converted = convertPrice(amount, from, to, rates);
  return `${sym(to)}${converted.toFixed(2)}`;
}

interface Vendor {
  vendorId: number;
  vendorName: string;
  price: number;
  stockQuantity: number;
}

interface Product {
  productCode: string;
  productName: string;
  productDate: string;
  description: string;
  brand: string;
  category: string;
  upc: string;
  price: number;
  stockQuantity: number;
  vendorName: string;
  currency: string;
  lowestPrice: number;
  highestPrice: number;
  vendors: Vendor[];
}

export default function ProductHistoryPage() {
  const [navCode, setNavCode] = useState('');
  const [upcCode, setUpcCode] = useState('');
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendors, setVendors] = useState<{ VendorId: number; VendorName: string }[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [namesExpanded, setNamesExpanded] = useState(false);

  // ── Date filter for pivot table ───────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ── Live exchange rates ───────────────────────────────────────────────────
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [rates,           setRates]           = useState<RateMap>({ USD: 1 });
  const [ratesDate,       setRatesDate]       = useState('');
  const [ratesSource,     setRatesSource]     = useState('');
  const [ratesLoading,    setRatesLoading]    = useState(false);

  // Build a vendor-name → currency map from search results
  const vendorCurrencyMap: Record<string, string> = {};
  searchResults.forEach(p => {
    const key = ((p.vendorName || '').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')).toUpperCase();
    if (!vendorCurrencyMap[key]) vendorCurrencyMap[key] = p.currency || 'USD';
  });

  const fetchRates = async (noCache = false) => {
    setRatesLoading(true);
    try {
      const res  = await fetch('/api/exchange-rates', noCache ? { cache: 'no-store' } : {});
      const data = await res.json();
      if (data.rates) {
        setRates(data.rates);
        setRatesDate(data.date ?? '');
        setRatesSource(data.source ?? '');
      }
    } catch { /* keep defaults */ } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => { fetchRates(); }, []);

  // ── Fetch vendor list on mount ────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/vendors')
      .then(r => r.json())
      .then(data => setVendors(Array.isArray(data) ? data : []))
      .catch(() => setVendors([]));
  }, []);

  // ── Restore from sessionStorage on mount ─────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.navCode)       setNavCode(s.navCode);
        if (s.upcCode)       setUpcCode(s.upcCode);
        if (s.productName)   setProductName(s.productName);
        if (s.brandName)     setBrandName(s.brandName);
        if (s.vendor)        setVendor(s.vendor);
        if (s.searchResults?.length) {
          setSearchResults(s.searchResults);
          setSearched(true);
        }
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // ── Persist to sessionStorage whenever results change ────────────────────
  useEffect(() => {
    try {
      if (searched) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          navCode, upcCode, productName, brandName, vendor, searchResults,
        }));
      }
    } catch { /* ignore quota errors */ }
  }, [searched, navCode, upcCode, productName, brandName, searchResults]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!navCode.trim() && !upcCode.trim() && !productName.trim() && !vendor) return;

    setLoading(true);
    setSearched(true);
    setError('');
    setNamesExpanded(false);

    try {
      const params = new URLSearchParams();
      if (navCode.trim()) params.append('navCode', navCode.trim());
      if (upcCode.trim()) params.append('upcCode', upcCode.trim());
      if (productName.trim()) params.append('productName', productName.trim());
      if (brandName.trim()) params.append('brandName', brandName.trim());
      if (vendor) params.append('vendor', vendor);

      const response = await fetch(`/api/product-insights?${params}`, {
        headers: { Accept: 'application/json' },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Product Insights received a page instead of search data. Please restart the Next.js server and try again.');
      }

      const data = await response.json();

      if (!response.ok) throw new Error(data?.error || 'Failed to load product insights');
      if (Array.isArray(data)) {
        setSearchResults(data as Product[]);
      } else {
        throw new Error('Product Insights returned data in an unexpected format');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to load product insights');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setNavCode('');
    setUpcCode('');
    setProductName('');
    setBrandName('');
    setVendor('');
    setSearchResults([]);
    setSearched(false);
    setError('');
    setNamesExpanded(false);
    setDateFrom('');
    setDateTo('');
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  };

  const handleDownload = () => {
    const headers = ['Product Code', 'Product Name', 'Date', 'UPC', 'Vendor', 'Price', 'Stock Quantity'];
    const excelData = [
      headers,
      ...searchResults.map(product => {
        const p = typeof product === 'object' && product !== null ? (product as any) : {};
        return [
          p.productCode || '',
          p.productName || '',
          p.productDate || '',
          `="${p.upc || ''}"`,
          p.vendorName || '',
          p.price || 0,
          p.stockQuantity || 0,
        ];
      }),
    ];
    const csvContent = excelData.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `product_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Pivot table ──────────────────────────────────────────────────────────────
  // Helper: parse dd-mm-yyyy or yyyy-mm-dd into a Date for comparison
  const parseProductDate = (d: string): Date => {
    if (!d) return new Date(0);
    // dd-mm-yyyy
    const ddmmyyyy = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
    return new Date(d);
  };

  const transformDataForPivotTable = (data: Product[]) => {
    const pivotData: { [vendor: string]: { [date: string]: { raw: number; currency: string } } } = {};
    const allDates = new Set<string>();
    const allVendors = new Set<string>();

    data.forEach(item => {
      const vendorKey = ((item.vendorName || 'Unknown').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')).toUpperCase();
      const date = item.productDate || 'Unknown';
      allVendors.add(vendorKey);
      allDates.add(date);
      if (!pivotData[vendorKey]) pivotData[vendorKey] = {};
      pivotData[vendorKey][date] = { raw: item.price || 0, currency: item.currency || 'USD' };
    });

    // Sort all dates descending first (newest first)
    const allSortedDates = Array.from(allDates).sort((a, b) => {
      return parseProductDate(b).getTime() - parseProductDate(a).getTime();
    });

    // Apply date range filter; default = last 30 days from most recent date
    let filteredDates: string[];
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : new Date(0);
      const to   = dateTo   ? new Date(dateTo)   : new Date(8640000000000000);
      // set to to end of day
      to.setHours(23, 59, 59, 999);
      filteredDates = allSortedDates.filter(d => {
        const dt = parseProductDate(d);
        return dt >= from && dt <= to;
      });
    } else {
      // Default: only show dates within the last 30 days from the most recent date
      const mostRecent = allSortedDates[0] ? parseProductDate(allSortedDates[0]) : new Date();
      const cutoff = new Date(mostRecent);
      cutoff.setDate(cutoff.getDate() - 30);
      filteredDates = allSortedDates.filter(d => parseProductDate(d) >= cutoff);
    }

    const sortedDates = filteredDates;

    const getAvg = (vendor: string) => {
      const prices = sortedDates
        .map(d => {
          const entry = pivotData[vendor]?.[d];
          return entry ? convertPrice(entry.raw, entry.currency, displayCurrency, rates) : 0;
        })
        .filter(p => p > 0);
      return prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
    };

    const sortedVendors = Array.from(allVendors).sort((a, b) => getAvg(a) - getAvg(b));
    return { pivotData, sortedDates, sortedVendors };
  };

  const { pivotData, sortedDates, sortedVendors } = transformDataForPivotTable(searchResults);

  const calculateVendorAverage = (vendor: string) => {
    const prices = Object.values(pivotData[vendor] || {})
      .map(e => convertPrice(e.raw, e.currency, displayCurrency, rates))
      .filter(p => p > 0);
    return prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
  };

  const calculateDateAverage = (date: string) => {
    const prices = Object.values(pivotData)
      .map(vd => {
        const e = vd[date];
        return e ? convertPrice(e.raw, e.currency, displayCurrency, rates) : 0;
      })
      .filter(p => p > 0);
    return prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
  };

  // ── Vendor chart data ────────────────────────────────────────────────────────
  const vendorQuantityTotals = (() => {
    const map: { [v: string]: number } = {};
    searchResults.forEach(p => {
      const v = ((p.vendorName || 'Unknown').trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')).toUpperCase();
      map[v] = (map[v] || 0) + (p.stockQuantity || 0);
    });
    return Object.entries(map)
      .map(([vendor, quantity]) => ({ vendor, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  })();

  // ── Derived display values ───────────────────────────────────────────────────
  const uniqueProductNames = Array.from(
    new Set(searchResults.map(p => p.productName).filter(Boolean))
  );
  const PREVIEW_COUNT = 6;
  const visibleNames = namesExpanded ? uniqueProductNames : uniqueProductNames.slice(0, PREVIEW_COUNT);
  const hasMore = uniqueProductNames.length > PREVIEW_COUNT;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const getPriceCellStyle = (vendor: string, date: string): string => {
    const entry = pivotData[vendor]?.[date];
    if (!entry || !entry.raw) return '';
    const price = convertPrice(entry.raw, entry.currency, displayCurrency, rates);
    const colPrices = sortedVendors
      .map(v => {
        const e = pivotData[v]?.[date];
        return e ? convertPrice(e.raw, e.currency, displayCurrency, rates) : 0;
      })
      .filter(p => p > 0);
    const min = Math.min(...colPrices);
    const max = Math.max(...colPrices);
    if (colPrices.length < 2 || min === max) return '';
    if (price === min) return 'text-emerald-700 font-bold';
    if (price === max) return 'text-rose-600 font-semibold';
    return '';
  };

  return (
    <div className="p-6 space-y-6 max-w-full">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Product Insights</h1>
          <p className="text-muted-foreground text-sm mt-1">Analyze historical product data and gain valuable insights</p>
        </div>
        {searchResults.length > 0 && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-sm shrink-0"
          >
            <Download className="w-4 h-4" />
            Download ({searchResults.length} items)
          </button>
        )}
      </div>

      {/* ── Currency bar ─────────────────────────────────────────────────────── */}
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
                {ratesSource === 'live'      && '● live'}
                {ratesSource === 'db_today'  && '● cached today'}
                {ratesSource === 'db_cached' && '● cached (older)'}
                {ratesSource === 'fallback'  && '⚠ static fallback'}
              </span>
            </span>
          ) : null}
          <button onClick={() => fetchRates(true)} disabled={ratesLoading}
            title="Refresh exchange rates"
            className="p-1 rounded hover:bg-muted disabled:opacity-40 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {!ratesLoading && displayCurrency !== 'USD' && rates[displayCurrency] && (
          <span className="text-xs text-muted-foreground ml-auto">
            1 USD = <span className="font-semibold text-foreground">{rates[displayCurrency].toFixed(4)} {displayCurrency}</span>
          </span>
        )}
      </div>

      {/* ── Search Form ───────────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">NAV Code</label>
            <input
              type="text"
              value={navCode}
              onChange={e => setNavCode(e.target.value)}
              placeholder="Enter NAV code..."
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">UPC / EAN Code</label>
            <input
              type="text"
              value={upcCode}
              onChange={e => setUpcCode(e.target.value)}
              placeholder="Enter UPC/EAN code..."
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="Enter product name..."
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Vendor</label>
            <select
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All vendors</option>
              {vendors.map(v => (
                <option key={v.VendorId} value={v.VendorName}>{v.VendorName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="submit"
            disabled={loading || (!navCode.trim() && !upcCode.trim() && !productName.trim() && !vendor)}
            className="py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Analyzing…' : 'Analyze Insights'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="py-2.5 px-4 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-colors text-sm"
          >
            Clear All Fields
          </button>
        </div>
      </form>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive font-semibold text-sm">Product Insights search failed</p>
          <p className="text-xs text-destructive/80 mt-1">{error}</p>
        </div>
      )}

      {/* ── Product Names — collapsible ───────────────────────────────────────── */}
      {searched && uniqueProductNames.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* header row — always visible */}
          <div
            className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
            onClick={() => setNamesExpanded(prev => !prev)}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">
                Product Names Found
              </span>
              <span className="ml-1 text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                {uniqueProductNames.length} unique
              </span>
              <span className="text-xs text-muted-foreground">
                · {searchResults.length} results
              </span>
            </div>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              {namesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* collapsed preview — always visible */}
          {!namesExpanded && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {visibleNames.map((name, i) => (
                <span
                  key={i}
                  className="inline-block text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full truncate max-w-xs"
                  title={name}
                >
                  {name}
                </span>
              ))}
              {hasMore && (
                <button
                  onClick={() => setNamesExpanded(true)}
                  className="inline-block text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300 px-3 py-1 rounded-full hover:bg-slate-200 transition-colors"
                >
                  +{uniqueProductNames.length - PREVIEW_COUNT} more
                </button>
              )}
            </div>
          )}

          {/* expanded — full grid */}
          {namesExpanded && (
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t border-border pt-3">
              {uniqueProductNames.map((name, i) => (
                <div key={i} className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                  <p className="text-blue-900 text-xs font-medium leading-snug">{name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Today's Prices — compact strip ───────────────────────────────────── */}
      {searched && searchResults.length > 0 && (() => {
        const mostRecentDate = sortedDates[0];
        if (!mostRecentDate) return null;

        const todayEntries = sortedVendors
          .map(vendor => {
            const entry = pivotData[vendor]?.[mostRecentDate];
            if (!entry || !entry.raw) return null;
            return {
              vendor,
              price: convertPrice(entry.raw, entry.currency, displayCurrency, rates),
              nativeCurrency: entry.currency,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null && e.price > 0)
          .sort((a, b) => a.price - b.price);

        if (todayEntries.length === 0) return null;

        const lowestPrice = todayEntries[0].price;
        const highestPrice = todayEntries[todayEntries.length - 1].price;
        const avgPrice = todayEntries.reduce((s, e) => s + e.price, 0) / todayEntries.length;
        const spread = highestPrice - lowestPrice;

        return (
          <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 overflow-hidden shadow-sm">
            {/* Compact single-row header + prices */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              {/* Label */}
              <div className="flex items-center gap-1.5 shrink-0">
                <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-bold text-slate-700 text-xs">Latest Prices</span>
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                  {mostRecentDate}
                </span>
              </div>
              {/* Divider */}
              <span className="h-4 w-px bg-blue-200 shrink-0" />
              {/* Vendor price pills */}
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {todayEntries.map((entry, i) => {
                  const isCheapest = i === 0;
                  const isMostExpensive = i === todayEntries.length - 1 && todayEntries.length > 1;
                  return (
                    <div
                      key={entry.vendor}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                        isCheapest
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : isMostExpensive
                          ? 'bg-rose-100 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {isCheapest && <span className="text-[10px]">🏆</span>}
                      <span className="truncate max-w-[90px]" title={entry.vendor}>{entry.vendor}</span>
                      <span className={`font-extrabold tabular-nums ${isCheapest ? 'text-emerald-700' : isMostExpensive ? 'text-rose-600' : 'text-slate-800'}`}>
                        {sym(displayCurrency)}{entry.price.toFixed(2)}
                        {entry.nativeCurrency !== displayCurrency && (
                          <span className="ml-1 font-normal text-[10px] opacity-60">
                            ({entry.nativeCurrency})
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Stats */}
              <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0 ml-auto">
                <span><span className="font-semibold text-slate-700">{todayEntries.length}</span> vendors</span>
                <span>Spread: <span className="font-semibold text-slate-700">{sym(displayCurrency)}{spread.toFixed(2)}</span></span>
                <span>Avg: <span className="font-semibold text-slate-700">{sym(displayCurrency)}{avgPrice.toFixed(2)}</span></span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Pricing Pivot Table ───────────────────────────────────────────────── */}
      {searched && (
        searchResults.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <svg className="w-14 h-14 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-foreground font-semibold">
              {error ? 'Search could not be completed' : 'No products found in history'}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {error ? 'Fix the error above and try again' : 'Try adjusting your search criteria'}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Date range filter */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-white border-b border-border">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Date Range:</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="px-2 py-1 text-xs rounded-md border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-primary hover:underline"
                >
                  Reset (last 30 days)
                </button>
              )}
              <span className="ml-auto text-xs text-muted-foreground italic">
                {sortedDates.length} date{sortedDates.length !== 1 ? 's' : ''} shown
              </span>
            </div>

            {/* Legend hint */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-50 border-b border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> Lowest price</span>
              <span className="flex items-center gap-1"><TrendingUpIcon className="w-3.5 h-3.5 text-rose-500" /> Highest price</span>
              <span className="ml-auto text-slate-400 italic">Scroll horizontally to see all dates →</span>
            </div>

            {/* Scrollable table — sticky first column */}
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse" style={{ minWidth: `${(sortedDates.length + 2) * 110}px` }}>
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {/* sticky vendor column header */}
                    <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider border-r border-slate-600 min-w-[130px] whitespace-nowrap">
                      Account / Vendor
                    </th>
                    {sortedDates.map(date => (
                      <th
                        key={date}
                        className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap min-w-[100px]"
                      >
                        {date}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider bg-blue-700 min-w-[90px] whitespace-nowrap">
                      Avg ({displayCurrency})
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {sortedVendors.map((vendor, vi) => (
                    <tr
                      key={vendor}
                      className={`hover:bg-blue-50/40 transition-colors ${vi % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}
                    >
                      {/* sticky vendor name — explicit bg matches row bg */}
                      <td className={`sticky left-0 z-10 px-4 py-2.5 font-semibold text-slate-800 border-r border-gray-200 whitespace-nowrap text-xs ${vi % 2 === 1 ? 'bg-slate-50' : 'bg-white'}`}>
                        {vendor}
                      </td>
                      {sortedDates.map(date => {
                        const entry = pivotData[vendor]?.[date];
                        const converted = entry ? convertPrice(entry.raw, entry.currency, displayCurrency, rates) : 0;
                        const colorClass = getPriceCellStyle(vendor, date);
                        return (
                          <td
                            key={date}
                            className={`px-3 py-2.5 text-right border-r border-gray-100 tabular-nums text-xs ${colorClass}`}
                          >
                            {converted ? (
                              <span title={entry?.currency !== displayCurrency ? `Native: ${sym(entry!.currency)}${entry!.raw.toFixed(2)} ${entry!.currency}` : undefined}>
                                {sym(displayCurrency)}{converted.toFixed(2)}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-blue-700 bg-blue-50 tabular-nums text-xs">
                        {sym(displayCurrency)}{calculateVendorAverage(vendor).toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {/* Average footer row */}
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <td className="sticky left-0 z-10 bg-slate-100 px-4 py-2.5 text-slate-700 border-r border-slate-300 text-xs whitespace-nowrap font-bold">
                      Average
                    </td>
                    {sortedDates.map(date => (
                      <td
                        key={date}
                        className="px-3 py-2.5 text-right text-blue-700 border-r border-slate-300 bg-blue-50 tabular-nums text-xs"
                      >
                        {sym(displayCurrency)}{calculateDateAverage(date).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right text-emerald-700 bg-emerald-50 tabular-nums text-xs">
                      {sym(displayCurrency)}{(sortedDates.reduce((s, d) => s + calculateDateAverage(d), 0) / (sortedDates.length || 1)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Vendor Distribution Charts ────────────────────────────────────────── */}
      {searched && searchResults.length > 0 && (
        <div
          className="rounded-xl overflow-hidden border border-border"
          style={{
            background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)',
          }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-white/60">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-slate-800">Vendor Product Distribution</h2>
          </div>

          {/* Summary stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/60">
            {[
              { label: 'Total Vendors',  value: vendorQuantityTotals.length.toString(),                                             accent: 'text-blue-700',   bg: 'rgba(219,234,254,0.7)' },
              { label: 'Total Quantity', value: vendorQuantityTotals.reduce((s, v) => s + v.quantity, 0).toLocaleString(),          accent: 'text-emerald-700', bg: 'rgba(209,250,229,0.7)' },
              { label: 'Top Vendor',     value: vendorQuantityTotals[0]?.vendor || '—',                                             accent: 'text-violet-700', bg: 'rgba(237,233,254,0.7)' },
              { label: 'Max Quantity',   value: (vendorQuantityTotals[0]?.quantity || 0).toLocaleString(),                         accent: 'text-orange-700', bg: 'rgba(254,243,199,0.7)' },
            ].map(({ label, value, accent, bg }, i) => (
              <div key={label} style={{ background: bg }} className={`px-6 py-4 ${i < 3 ? 'border-r border-white/60' : ''}`}>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-extrabold ${accent} mt-1 truncate`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">

            {/* ── Bar chart — glass card ── */}
            <div
              className="rounded-2xl p-5 border border-white/70 shadow-lg"
              style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <p className="text-sm font-bold text-slate-800 mb-0.5">Quantity by Vendor</p>
              <p className="text-xs text-slate-500 mb-4">Sorted highest → lowest</p>
              <ResponsiveContainer width="100%" height={Math.max(220, vendorQuantityTotals.length * 28)}>
                <BarChart
                  data={[...vendorQuantityTotals].reverse()}
                  layout="vertical"
                  margin={{ top: 0, right: 56, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.15)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="vendor"
                    width={120}
                    tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.07)' }}
                    contentStyle={{
                      background: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#1e293b',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    }}
                    formatter={(val: any) => [Number(val).toLocaleString(), 'Qty']}
                  />
                  <Bar dataKey="quantity" name="Quantity" radius={[0, 8, 8, 0]} maxBarSize={18}>
                    {vendorQuantityTotals.map((_, index) => (
                      <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Donut chart — glass card ── */}
            <div
              className="rounded-2xl p-5 border border-white/70 shadow-lg"
              style={{
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              <p className="text-sm font-bold text-slate-800 mb-0.5">Vendor Share</p>
              <p className="text-xs text-slate-500 mb-4">By total quantity</p>

              <div className="flex flex-col gap-5 items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={vendorQuantityTotals}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="quantity"
                      labelLine={false}
                      label={false}
                    >
                      {vendorQuantityTotals.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#1e293b',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      }}
                      formatter={(val: any, _: any, props: any) => [
                        `${Number(val).toLocaleString()} (${((props.payload.quantity / vendorQuantityTotals.reduce((s, v) => s + v.quantity, 0)) * 100).toFixed(1)}%)`,
                        props.payload.vendor,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Legend grid */}
                <div className="w-full grid grid-cols-2 gap-x-6 gap-y-2">
                  {vendorQuantityTotals.map((entry, index) => {
                    const total = vendorQuantityTotals.reduce((s, v) => s + v.quantity, 0);
                    const pct = total ? ((entry.quantity / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={entry.vendor} className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ background: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-xs text-slate-700 truncate font-semibold" title={entry.vendor}>
                          {entry.vendor}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto shrink-0 tabular-nums font-medium">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
