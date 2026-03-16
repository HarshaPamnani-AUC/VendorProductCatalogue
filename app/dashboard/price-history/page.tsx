'use client';

import { useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface PricePoint { date: string; price: number; qty: string; }
interface VendorHistory { vendorCode: string; priceHistory: PricePoint[]; }
interface ProductData { productCode: string; productName: string; upc: string; vendors: VendorHistory[]; }

// 20 vivid distinct colors
const COLORS = [
  '#ff4d6d','#00c8ff','#ffe033','#a8e63d','#bf7fff',
  '#ff9f43','#00e5c8','#ff6eb4','#48dbfb','#ff6b6b',
  '#1dd1a1','#feca57','#54a0ff','#5f27cd','#ee5a24',
  '#009432','#0652DD','#833471','#EA2027','#006266',
];

const fmt = (d: string) => { try { return format(parseISO(d), 'MM/dd/yy'); } catch { return d; } };
const fmtFull = (d: string) => { try { return format(parseISO(d), 'MMM dd, yyyy'); } catch { return d; } };

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm min-w-[170px] max-w-[260px]">
      <p className="text-muted-foreground text-xs mb-2 font-medium">{fmtFull(label)}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey ?? e.name} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
            <span className="text-muted-foreground text-xs truncate">{e.dataKey ?? e.name}</span>
          </div>
          <span className="font-bold text-sm flex-shrink-0" style={{ color: e.color }}>
            ${Number(e.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};

// Merge all vendors onto a shared date axis
function buildAllVendorsData(vendors: VendorHistory[]) {
  const allDates = Array.from(
    new Set(vendors.flatMap(v => v.priceHistory.map(p => p.date)))
  ).sort();
  return allDates.map(date => {
    const pt: Record<string, any> = { date };
    vendors.forEach(v => {
      const m = v.priceHistory.find(p => p.date === date);
      if (m) pt[v.vendorCode] = m.price;
    });
    return pt;
  });
}

// Calculate a sensible Y domain ignoring extreme outliers
function calcDomain(vendors: VendorHistory[]): [number, number] {
  const allPrices = vendors.flatMap(v => v.priceHistory.map(p => p.price)).filter(p => p > 0);
  if (!allPrices.length) return [0, 100];
  allPrices.sort((a, b) => a - b);
  // Use 5th–95th percentile to exclude outliers from the scale
  const p5 = allPrices[Math.floor(allPrices.length * 0.05)];
  const p95 = allPrices[Math.floor(allPrices.length * 0.95)];
  const pad = (p95 - p5) * 0.15 || 2;
  return [Math.max(0, Math.floor(p5 - pad)), Math.ceil(p95 + pad)];
}

function ProductCard({ product }: { product: ProductData }) {
  const [selectedVendor, setSelectedVendor] = useState('');

  const allData = buildAllVendorsData(product.vendors);
  const yDomain = calcDomain(product.vendors);

  const selVendor = product.vendors.find(v => v.vendorCode === selectedVendor) ?? null;
  const selColor = COLORS[product.vendors.findIndex(v => v.vendorCode === selectedVendor) % COLORS.length];
  const selData = selVendor ? selVendor.priceHistory.map(p => ({ date: p.date, price: p.price })) : [];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">{product.productName}</h2>
        <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
          <span>UPC: <span className="text-foreground font-medium">{product.upc}</span></span>
          <span>Code: <span className="text-foreground font-medium">{product.productCode}</span></span>
          <span className="font-medium text-foreground">{product.vendors.length} vendors</span>
        </div>
      </div>

      {/* ── CHART 1: All vendors ── */}
      <div className="px-6 pt-5 pb-1">
        <p className="text-sm font-semibold text-foreground">All Vendors — Price History</p>
        <p className="text-xs text-muted-foreground mt-0.5">{product.vendors.length} vendors · {allData.length} dates</p>
      </div>
      <div className="px-2 pb-6" style={{ height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={allData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(128,128,128,0.15)" />
            <XAxis dataKey="date" tickFormatter={fmt}
              tick={{ fill: '#999', fontSize: 10 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }}
              interval="preserveStartEnd" />
            <YAxis tickFormatter={v => `$${v}`}
              tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }}
              width={60} domain={yDomain} />
            <Tooltip content={<Tip />} />
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

      {/* ── CHART 2: Single vendor via dropdown ── */}
      <div className="border-t border-border px-6 py-5">
        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-semibold text-foreground whitespace-nowrap">Vendor detail:</label>
          <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]">
            <option value="">— Select a vendor —</option>
            {product.vendors.map((v, i) => (
              <option key={v.vendorCode} value={v.vendorCode}>
                {v.vendorCode} ({v.priceHistory.length} records)
              </option>
            ))}
          </select>
        </div>

        {selVendor ? (
          <div style={{ height: 300 }}>
            <p className="text-xs text-muted-foreground mb-2">
              <span className="font-semibold" style={{ color: selColor }}>{selVendor.vendorCode}</span>
              {' '}· {selVendor.priceHistory.length} price records
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="0" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="date" tickFormatter={fmt}
                  tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }} />
                <YAxis tickFormatter={v => `$${v}`}
                  tick={{ fill: '#999', fontSize: 11 }} axisLine={{ stroke: '#555' }} tickLine={{ stroke: '#555' }}
                  width={60} domain={['auto', 'auto']} />
                <Tooltip content={<Tip />} />
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

      {/* ── TABLE ── */}
      <div className="border-t border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">Date</th>
              <th className="text-left px-4 py-2 text-muted-foreground font-medium">Vendor</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium">Price</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium">Change</th>
              <th className="text-right px-4 py-2 text-muted-foreground font-medium">Qty</th>
            </tr>
          </thead>
          <tbody>
            {product.vendors.flatMap((v, vi) =>
              [...v.priceHistory].reverse().map((pt, pi, arr) => {
                const prev = arr[pi + 1]?.price ?? null;
                const chg = prev !== null ? pt.price - prev : null;
                return (
                  <tr key={`${v.vendorCode}-${pi}`} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 text-muted-foreground">{fmtFull(pt.date)}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: COLORS[vi % COLORS.length] + '22', color: COLORS[vi % COLORS.length] }}>
                        {v.vendorCode}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-foreground">${pt.price.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${chg === null ? 'text-muted-foreground' : chg > 0 ? 'text-emerald-400' : chg < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {chg === null ? '—' : `${chg > 0 ? '+' : ''}$${chg.toFixed(2)}`}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{pt.qty ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PriceHistoryPage() {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ query: query.trim() });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/price-history?${params}`);
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

  return (
    <div className="p-6 space-y-6 min-h-full bg-background">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Price History</h1>
        <p className="text-muted-foreground text-sm mt-1">Track price changes over time per product and vendor</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground mb-1 block">Product / UPC / Item Code</label>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search by name, UPC, or item code..."
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
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {searched && products.length === 0 && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          No price history found.
        </div>
      )}

      {products.map(product => (
        <ProductCard key={product.upc} product={product} />
      ))}
    </div>
  );
}
