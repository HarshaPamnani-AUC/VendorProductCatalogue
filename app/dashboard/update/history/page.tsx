'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';

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
  lowestPrice: number;
  highestPrice: number;
  vendors: Vendor[];
}

export default function ProductHistoryPage() {
  const [navCode, setNavCode] = useState('');
  const [upcCode, setUpcCode] = useState('');
  const [productName, setProductName] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if at least one search field is filled
    if (!navCode.trim() && !upcCode.trim() && !productName.trim()) {
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        sortBy,
      });

      // Add search parameters that are not empty
      if (navCode.trim()) {
        params.append('navCode', navCode.trim());
      }
      if (upcCode.trim()) {
        params.append('upcCode', upcCode.trim());
      }
      if (productName.trim()) {
        params.append('productName', productName.trim());
      }

      const response = await fetch(`/api/products/history?${params}`);
      const data = await response.json();
      if (Array.isArray(data)) {
      setSearchResults(data as Product[]);
    } else if (typeof data === 'object' && data !== null) {
      // Convert object with numeric keys to array
      const resultsArray = Object.values(data) as Product[];
      setSearchResults(resultsArray);
    } else {
      setSearchResults([]);
    }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (searchResults.length === 0) {
      alert('No search results to download');
      return;
    }

    // Create Excel data
    const headers = ['Product Code', 'Product Name', 'Date', 'UPC', 'Vendor', 'Price', 'Stock Quantity'];
    const excelData = [
      headers,
      ...searchResults.map(product => [
        product.productCode || '',
        product.productName || '',
        product.productDate || '',
        `="${product.upc}"`, // Force Excel to display full number
        product.vendorName || '',
        product.price || 0,
        product.stockQuantity || 0
      ])
    ];

    // Convert to CSV format
    const csvContent = excelData.map(row => row.join(',')).join('\n');

    // Create and download file with proper Excel MIME type
    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `product_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Product History</h1>
          <p className="text-muted-foreground">Search and view historical product data from storage</p>
        </div>
        {/* Download Button - Top Right */}
        {searchResults.length > 0 && (
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download ({searchResults.length} items)
          </button>
        )}
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-card border border-border rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              NAV Code
            </label>
            <input
              type="text"
              value={navCode}
              onChange={(e) => setNavCode(e.target.value)}
              placeholder="Enter NAV code..."
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              UPC Code
            </label>
            <input
              type="text"
              value={upcCode}
              onChange={(e) => setUpcCode(e.target.value)}
              placeholder="Enter UPC code..."
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name..."
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="price">Price</option>
              <option value="name">Name</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || (!navCode.trim() && !upcCode.trim() && !productName.trim())}
          className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search Product History'}
        </button>
      </form>

      {/* Results */}
      {searched && (
        <div>
          {searchResults.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-foreground font-semibold mb-2">No products found in history</p>
              <p className="text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {searchResults.map((product) => (
                <div key={`${product.productCode}-${product.vendorName || 'unknown'}`} className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground">{product.productName}</h3>
                      <p className="text-sm text-muted-foreground">Code: {product.productCode}</p>
                      {product.upc && <p className="text-sm text-muted-foreground">UPC: {product.upc}</p>}
                      {product.productDate && <p className="text-sm text-muted-foreground">Date: {product.productDate}</p>}
                      {product.vendorName && <p className="text-sm text-primary font-medium">Vendor: {product.vendorName}</p>}
                      {product.brand && <p className="text-sm text-primary font-medium">{product.brand}</p>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">${product.price?.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">Qty: {product.stockQuantity}</p>
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-sm text-foreground mb-4 line-clamp-2">{product.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
