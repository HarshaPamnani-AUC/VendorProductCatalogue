'use client';

import React, { useState, useEffect, useCallback } from 'react';

function fmtDate(val: any) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-GB'); } catch { return String(val); }
}

function fmtNum(val: any) {
  if (val == null || val === '') return '—';
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(val: any) {
  if (val == null || val === '') return '—';
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n.toLocaleString();
}

const sheetLabel = (s: string) => {
  if (s === 'PENDING ORDERS') return { label: 'Pending', cls: 'text-yellow-700 bg-yellow-100' };
  if (s === 'DONE ORDERS')    return { label: 'Done',    cls: 'text-green-700 bg-green-100' };
  if (s === 'NOT BUY')        return { label: 'Not Buy', cls: 'text-red-700 bg-red-100' };
  return { label: s, cls: 'text-gray-600 bg-gray-100' };
};

const companyBadge = (c: string) => {
  const m: Record<string, string> = {
    LLP:   'bg-purple-100 text-purple-800',
    VW360: 'bg-blue-100 text-blue-800',
    BSLLC: 'bg-orange-100 text-orange-800',
    BM:    'bg-teal-100 text-teal-800',
    BCGGB: 'bg-pink-100 text-pink-800',
  };
  return m[c] || 'bg-gray-100 text-gray-700';
};

const statusBadge = (s: string) => {
  if (!s) return 'bg-gray-100 text-gray-500';
  const v = s.toUpperCase();
  if (v.includes('AIR'))       return 'bg-sky-100 text-sky-700';
  if (v.includes('SEA'))       return 'bg-blue-100 text-blue-700';
  if (v.includes('DELIVERED')) return 'bg-green-100 text-green-700';
  if (v.includes('TRANSIT'))   return 'bg-indigo-100 text-indigo-700';
  if (v.includes('PICK UP'))   return 'bg-purple-100 text-purple-700';
  if (v.includes('SUPPLIER'))  return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
};

export default function OrderDashboardPage() {
  const [search,    setSearch]    = useState('');
  const [company,   setCompany]   = useState('');
  const [sheetType, setSheetType] = useState('');
  const [data,      setData]      = useState<any[]>([]);
  const [stats,     setStats]     = useState<any>(null);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [exporting, setExporting] = useState(false);
  const pageSize = 100;

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (search)    params.set('search', search);
      if (company)   params.set('company', company);
      if (sheetType) params.set('sheet_type', sheetType);
      const res  = await fetch(`/api/orders/dashboard?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setData(json.data || []);
      setStats(json.stats || null);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, company, sheetType]);

  useEffect(() => { fetchData(1); }, []);

  const exportData = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100000' });
      if (search)    params.set('search', search);
      if (company)   params.set('company', company);
      if (sheetType) params.set('sheet_type', sheetType);
      const res  = await fetch(`/api/orders/dashboard?${params}`);
      const json = await res.json();
      const rows = json.data || [];

      const headers = [
        'Status','Company','Supplier','Order Date','Delivery Date',
        'Invoice/SO/Proforma','Invoice Date',
        'NAV','UPC/EAN','Brand','NAV Name','Currency',
        'Order Qty','Order Price','SO Qty','SO Price','Invoice Qty','Invoice Price',
        'Sheet Type',
      ];
      const escape = (v: any) => {
        if (v == null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csvRows = [
        headers.join(','),
        ...rows.map((r: any) => [
          r.status, r.company, r.supplier,
          r.order_date    ? new Date(r.order_date).toLocaleDateString('en-GB')    : '',
          r.delivery_date ? new Date(r.delivery_date).toLocaleDateString('en-GB') : '',
          r.invoice_so_proforma,
          r.invoice_date  ? new Date(r.invoice_date).toLocaleDateString('en-GB')  : '',
          r.nav, r.upc_ean, r.brand, r.nav_name, r.currency,
          r.order_qty, r.order_price, r.so_qty, r.so_price, r.invoice_qty, r.inv_price,
          r.sheet_type,
        ].map(escape).join(',')),
      ];

      const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `order_dashboard_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-5 min-h-full bg-background">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Master sheet view of all orders across all companies</p>
      </div>

      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Orders',  value: Number(stats.total).toLocaleString(),          cls: 'border-border' },
            { label: 'Pending',       value: Number(stats.pending).toLocaleString(),         cls: 'border-yellow-300 bg-yellow-50/50' },
            { label: 'Done',          value: Number(stats.done).toLocaleString(),            cls: 'border-green-300 bg-green-50/50' },
            { label: 'Not Buy',       value: Number(stats.not_buy).toLocaleString(),         cls: 'border-red-300 bg-red-50/50' },
            { label: 'Order Value',   value: `$${Number(stats.total_order_value).toLocaleString(undefined,{maximumFractionDigits:0})}`,   cls: 'border-blue-300 bg-blue-50/50' },
            { label: 'Invoice Value', value: `$${Number(stats.total_invoice_value).toLocaleString(undefined,{maximumFractionDigits:0})}`, cls: 'border-purple-300 bg-purple-50/50' },
          ].map(c => (
            <div key={c.label} className={`bg-card border ${c.cls} rounded-xl p-4`}>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Company</label>
          <select value={company} onChange={e => setCompany(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Companies</option>
            <option value="LLP">LLP</option>
            <option value="VW360">VW360</option>
            <option value="BSLLC">BSLLC</option>
            <option value="BM">BM</option>
            <option value="BCGGB">BCGGB</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Sheet Type</label>
          <select value={sheetType} onChange={e => setSheetType(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All</option>
            <option value="PENDING ORDERS">Pending</option>
            <option value="DONE ORDERS">Done</option>
            <option value="NOT BUY">Not Buy</option>
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground mb-1 block">Search</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData(1)}
            placeholder="Supplier, UPC, NAV name, Order ID…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={() => fetchData(1)} disabled={loading}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? 'Loading…' : 'Search'}
        </button>
        <button onClick={exportData} disabled={exporting || total === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting…' : `Export CSV (${total.toLocaleString()})`}
        </button>
      </div>

      {/* Row count + pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{total.toLocaleString()} rows · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => fetchData(1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">« First</button>
          <button onClick={() => fetchData(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">← Prev</button>
          <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">Next →</button>
          <button onClick={() => fetchData(totalPages)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">Last »</button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Master Sheet Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                {[
                  'Sheet Type', 'Company', 'Supplier', 'Status',
                  'Order Date', 'Delivery Date', 'Invoice Date',
                  'Invoice/SO/Proforma',
                  'NAV', 'UPC/EAN', 'Brand', 'NAV Name', 'Currency',
                  'Order Qty', 'Order Price',
                  'SO Qty', 'SO Price',
                  'Invoice Qty', 'Invoice Price',
                ].map(h => (
                  <th key={h} className="text-left px-3 py-3 font-semibold whitespace-nowrap border-r border-primary-foreground/20 last:border-r-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={19} className="text-center py-16 text-muted-foreground">Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={19} className="text-center py-16 text-muted-foreground">No records found</td></tr>
              ) : data.map((row, i) => {
                const { label, cls } = sheetLabel(row.sheet_type);
                return (
                  <tr key={`${row.company}-${row.id}`}
                    className={`border-t border-border/40 hover:bg-primary/5 transition-colors ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${companyBadge(row.company)}`}>
                        {row.company}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{row.supplier || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.status
                        ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(row.status)}`}>{row.status}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row.order_date)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row.delivery_date)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row.invoice_date)}</td>
                    <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{row.invoice_so_proforma || '—'}</td>
                    <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{row.nav || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground whitespace-nowrap">{row.upc_ean || '—'}</td>
                    <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{row.brand || '—'}</td>
                    <td className="px-3 py-2.5 text-foreground max-w-[200px] truncate" title={row.nav_name}>{row.nav_name || '—'}</td>
                    <td className="px-3 py-2.5 text-foreground">{row.currency || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{fmtQty(row.order_qty)}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{fmtNum(row.order_price)}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{fmtQty(row.so_qty)}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{fmtNum(row.so_price)}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{fmtQty(row.invoice_qty)}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{fmtNum(row.inv_price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => fetchData(1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">« First</button>
          <button onClick={() => fetchData(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">← Prev</button>
          <span className="text-sm text-muted-foreground px-2">Page {page} / {totalPages}</span>
          <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">Next →</button>
          <button onClick={() => fetchData(totalPages)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs transition-colors">Last »</button>
        </div>
      )}
    </div>
  );
}
