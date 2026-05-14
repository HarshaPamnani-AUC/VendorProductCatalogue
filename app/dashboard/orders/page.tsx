'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

type TabId = 'upload' | 'form' | 'history';
type TableName = 'LLP_Orders' | 'VW360_Orders' | 'BSLLC_Orders';
type SheetType = 'PENDING ORDERS' | 'DONE ORDERS' | 'NOT BUY';

const TABLES: TableName[]     = ['LLP_Orders', 'VW360_Orders', 'BSLLC_Orders'];
const SHEET_TYPES: SheetType[] = ['PENDING ORDERS', 'DONE ORDERS', 'NOT BUY'];

const COLUMNS = [
  { key: 'company',             label: 'Company' },
  { key: 'order_demand_id',     label: 'Order/Demand ID' },
  { key: 'supplier',            label: 'Supplier' },
  { key: 'order_date',          label: 'Order Date' },
  { key: 'invoice_so_proforma', label: 'Invoice/SO/Proforma' },
  { key: 'invoice_date',        label: 'Invoice Date' },
  { key: 'delivery_date',       label: 'Delivery Date' },
  { key: 'port_info_date',      label: 'Port Info Date' },
  { key: 'status',              label: 'Status' },
  { key: 'so',                  label: 'SO' },
  { key: 'nav',                 label: 'NAV' },
  { key: 'upc_ean',             label: 'UPC/EAN' },
  { key: 'brand',               label: 'Brand' },
  { key: 'nav_name',            label: 'NAV Name' },
  { key: 'currency',            label: 'Currency' },
  { key: 'order_qty',           label: 'Order Qty' },
  { key: 'order_price',         label: 'Order Price' },
  { key: 'so_qty',              label: 'SO Qty' },
  { key: 'so_price',            label: 'SO Price' },
  { key: 'invoice_qty',         label: 'Invoice Qty' },
  { key: 'inv_price',           label: 'Inv. Price' },
  { key: 'sheet_type',          label: 'Sheet Type' },
];

function fmtDate(val: any) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString(); } catch { return String(val); }
}

// ── Upload Tab ────────────────────────────────────────────────────────────────
function UploadTab() {
  const [table, setTable]         = useState<TableName>('LLP_Orders');
  const [sheetType, setSheetType] = useState<SheetType>('PENDING ORDERS');
  const [file, setFile]           = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f); setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('table', table);
      fd.append('sheet_type', sheetType);
      const res  = await fetch('/api/orders/upload', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => { window.location.href = '/api/orders/template'; };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: form */}
      <div className="lg:col-span-2 space-y-5">
        <form onSubmit={handleUpload} className="bg-card border border-border rounded-xl p-6 space-y-5">
          {/* Table selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Company Table</label>
            <select value={table} onChange={e => setTable(e.target.value as TableName)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm">
              {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Sheet type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Sheet Type</label>
            <select value={sheetType} onChange={e => setSheetType(e.target.value as SheetType)}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm">
              {SHEET_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Drop zone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Excel File</label>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <svg className="w-10 h-10 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-foreground">Drop your Excel file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setResult(null); } }} />
              {file && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-left">
                  <p className="text-green-700 font-semibold text-sm">✓ {file.name}</p>
                  <p className="text-green-600 text-xs mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading || !file}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm">
            {loading ? 'Uploading…' : 'Upload & Insert'}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div className={`bg-card border rounded-xl p-5 ${result.error ? 'border-red-300' : 'border-green-300'}`}>
            {result.error ? (
              <p className="text-red-600 font-semibold text-sm">❌ {result.error}</p>
            ) : (
              <div className="text-green-700 text-sm space-y-1">
                <p className="font-bold text-base">✅ Upload successful</p>
                <p>Rows inserted: <span className="font-semibold">{result.inserted}</span></p>
                <p>Rows skipped (empty): <span className="font-semibold">{result.skipped}</span></p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: instructions + template */}
      <div className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Instructions
          </h3>
          <ol className="space-y-1.5 text-sm text-foreground list-decimal list-inside">
            <li>Select the company table</li>
            <li>Choose the sheet type</li>
            <li>Download the template below</li>
            <li>Fill in your order data</li>
            <li>Upload the completed file</li>
          </ol>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </h3>
          <button onClick={downloadTemplate}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Orders_Template.xlsx
          </button>
          <p className="text-xs text-muted-foreground mt-2">Includes all required columns with a sample row</p>
        </div>
      </div>
    </div>
  );
}

// ── Form Tab ──────────────────────────────────────────────────────────────────
function FormTab() {
  const empty = {
    table: 'LLP_Orders' as TableName,
    sheet_type: 'PENDING ORDERS' as SheetType,
    order_demand_id: '', supplier: '', order_date: '', invoice_so_proforma: '',
    invoice_date: '', delivery_date: '', port_info_date: '', status: '',
    so: '', nav: '', upc_ean: '', brand: '', nav_name: '', currency: '',
    order_qty: '', order_price: '', so_qty: '', so_price: '', invoice_qty: '', inv_price: '',
  };
  const [form, setForm]     = useState(empty);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const res  = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) setForm(empty);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const field = (key: string, label: string, type = 'text', half = false) => (
    <div className={half ? '' : 'col-span-2 sm:col-span-1'}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        placeholder={type === 'date' ? '' : label} />
    </div>
  );

  return (
    <div className="max-w-4xl">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-6">
        {/* Table + Sheet Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Company Table</label>
            <select value={form.table} onChange={e => set('table', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sheet Type</label>
            <select value={form.sheet_type} onChange={e => set('sheet_type', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {SHEET_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Order Info */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Order Info</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {field('order_demand_id',     'Order/Demand ID')}
            {field('supplier',            'Supplier')}
            {field('invoice_so_proforma', 'Invoice/SO/Proforma')}
            {field('status',              'Status')}
            {field('so',                  'SO')}
            {field('nav',                 'NAV')}
          </div>
        </div>

        {/* Dates */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dates</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {field('order_date',     'Order Date',     'date')}
            {field('invoice_date',   'Invoice Date',   'date')}
            {field('delivery_date',  'Delivery Date',  'date')}
            {field('port_info_date', 'Port Info Date', 'date')}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Product Info</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {field('upc_ean',  'UPC/EAN')}
            {field('brand',    'Brand')}
            {field('nav_name', 'NAV Name')}
          </div>
        </div>

        {/* Financials */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financials</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {field('currency',    'Currency')}
            {field('order_qty',   'Order Qty',   'number')}
            {field('order_price', 'Order Price', 'number')}
            {field('so_qty',      'SO Qty',      'number')}
            {field('so_price',    'SO Price',    'number')}
            {field('invoice_qty', 'Invoice Qty', 'number')}
            {field('inv_price',   'Inv. Price',  'number')}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm">
          {loading ? 'Saving…' : 'Save Order'}
        </button>
      </form>

      {result && (
        <div className={`mt-4 p-4 rounded-xl border text-sm ${result.error ? 'border-red-300 text-red-600' : 'border-green-300 text-green-700'}`}>
          {result.error ? `❌ ${result.error}` : `✅ ${result.message}`}
        </div>
      )}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const [company, setCompany]     = useState('');
  const [sheetType, setSheetType] = useState('');
  const [search, setSearch]       = useState('');
  const [ean, setEan]             = useState('');
  const [nav, setNav]             = useState('');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [data, setData]           = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const pageSize = 50;

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (company)   params.set('company', company);
      if (sheetType) params.set('sheet_type', sheetType);
      if (search)    params.set('search', search);
      if (ean)       params.set('ean', ean);
      if (nav)       params.set('nav', nav);
      params.set('sortDir', sortDir);
      const res  = await fetch(`/api/orders?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setData(json.data || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [company, sheetType, search, ean, nav, sortDir]);

  useEffect(() => { fetchData(1); }, []);

  const companyBadge = (c: string) => {
    const colors: Record<string, string> = {
      'LLP':   'bg-purple-100 text-purple-800',
      'VW360': 'bg-blue-100 text-blue-800',
      'BSLLC': 'bg-orange-100 text-orange-800',
    };
    return colors[c] || 'bg-gray-100 text-gray-700';
  };

  const sheetBadge = (s: string) => {
    const colors: Record<string, string> = {
      'PENDING ORDERS': 'bg-yellow-100 text-yellow-800',
      'DONE ORDERS':    'bg-green-100 text-green-800',
      'NOT BUY':        'bg-red-100 text-red-800',
    };
    return colors[s] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Order Date</label>
          <select value={sortDir} onChange={e => { setSortDir(e.target.value as 'asc' | 'desc'); }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Company</label>
          <select value={company} onChange={e => setCompany(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All Companies</option>
            <option value="LLP">LLP</option>
            <option value="VW360">VW360</option>
            <option value="BSLLC">BSLLC</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Sheet Type</label>
          <select value={sheetType} onChange={e => setSheetType(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All</option>
            {SHEET_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground mb-1 block">Search</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData(1)}
            placeholder="Order ID, supplier, brand…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="min-w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">EAN / UPC</label>
          <input type="text" value={ean} onChange={e => setEan(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData(1)}
            placeholder="EAN or UPC…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="min-w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">NAV Number</label>
          <input type="text" value={nav} onChange={e => setNav(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData(1)}
            placeholder="NAV number…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={() => fetchData(1)} disabled={loading}
          className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{total.toLocaleString()} total rows · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => fetchData(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors text-xs">
            ← Prev
          </button>
          <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors text-xs">
            Next →
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                {COLUMNS.map(c => (
                  <th key={c.key} className="text-left px-3 py-2.5 text-muted-foreground font-semibold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">No records found</td></tr>
              ) : data.map((row, i) => (
                <tr key={`${row.company}-${row.id ?? i}`} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${companyBadge(row.company)}`}>
                      {row.company}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground">{row.order_demand_id || '—'}</td>
                  <td className="px-3 py-2 text-foreground">{row.supplier || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row.order_date)}</td>
                  <td className="px-3 py-2 text-foreground">{row.invoice_so_proforma || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row.invoice_date)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row.delivery_date)}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row.port_info_date)}</td>
                  <td className="px-3 py-2">
                    {row.status
                      ? <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium text-xs">{row.status}</span>
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-foreground">{row.so || '—'}</td>
                  <td className="px-3 py-2 text-foreground">{row.nav || '—'}</td>
                  <td className="px-3 py-2 font-mono text-foreground">{row.upc_ean || '—'}</td>
                  <td className="px-3 py-2 text-foreground">{row.brand || '—'}</td>
                  <td className="px-3 py-2 text-foreground max-w-[180px] truncate" title={row.nav_name}>{row.nav_name || '—'}</td>
                  <td className="px-3 py-2 text-foreground">{row.currency || '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.order_qty ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.order_price != null ? `$${Number(row.order_price).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.so_qty ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.so_price != null ? `$${Number(row.so_price).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.invoice_qty ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-foreground">{row.inv_price != null ? `$${Number(row.inv_price).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sheetBadge(row.sheet_type)}`}>
                      {row.sheet_type || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => fetchData(1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors text-xs">
            « First
          </button>
          <button onClick={() => fetchData(page - 1)} disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors text-xs">
            ← Prev
          </button>
          <span className="text-sm text-muted-foreground px-2">Page {page} / {totalPages}</span>
          <button onClick={() => fetchData(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors text-xs">
            Next →
          </button>
          <button onClick={() => fetchData(totalPages)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors text-xs">
            Last »
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabId>('history');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'upload',
      label: 'Upload File',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
    {
      id: 'form',
      label: 'Add Order',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'Order History',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 min-h-full bg-background">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View order history, upload Excel files, or manually add orders
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'upload'  && <UploadTab />}
        {activeTab === 'form'    && <FormTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}
