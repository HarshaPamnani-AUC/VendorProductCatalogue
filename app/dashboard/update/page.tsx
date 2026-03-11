'use client';

import React, { useState } from 'react';

interface Product {
  productCode: string;
  productName: string;
  price: number;
  stockQuantity: number;
  upc: string;
  vendorName: string;
}

export default function UpdatePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [searched, setSearched] = useState(false);

  // Form state - only Tbl_Products columns
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    qty: '',
    eanUpc: '',
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(`/api/products/search?productName=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (productCode: string) => {
    const product = searchResults.find(p => p.productCode === productCode);
    if (product) {
      setSelectedProduct(product);
      setFormData({
        name: product.productName,
        price: product.price?.toString() || '',
        qty: product.stockQuantity?.toString() || '0',
        eanUpc: product.upc || '',
      });
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setUpdating(true);
    setUpdateMessage(null);

    try {
      const response = await fetch(`/api/products/${selectedProduct.productCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          productName: formData.name,
          price: parseFloat(formData.price),
          stockQuantity: parseInt(formData.qty) || 0,
          upc: formData.eanUpc,
          vendorName: selectedProduct.vendorName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setUpdateMessage({ type: 'error', text: data.error || 'Update failed' });
        return;
      }

      setUpdateMessage({ type: 'success', text: 'Product updated successfully!' });
      setTimeout(() => {
        setSelectedProduct(null);
        setSearchQuery('');
        setSearchResults([]);
        setFormData({
          name: '',
          price: '',
          qty: '',
          eanUpc: '',
        });
      }, 2000);
    } catch (err) {
      setUpdateMessage({ type: 'error', text: 'Update error: ' + (err instanceof Error ? err.message : 'Unknown error') });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Update Products</h1>
        <p className="text-muted-foreground">Search and update product information from Tbl_Products</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {!selectedProduct ? (
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Search Product
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter product code (Item_Code) or name..."
                    className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>
            </div>
          ) : null}

          {searched && !selectedProduct && (
            <div className="bg-card border border-border rounded-lg">
              {searchResults.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-foreground font-semibold">No products found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {searchResults.map((product, index) => (
                    <button
                      key={`${product.productCode}-${index}`}
                      onClick={() => handleSelectProduct(product.productCode)}
                      className="w-full p-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{product.productName}</p>
                          <p className="text-sm text-muted-foreground">Item_Code: {product.productCode}</p>
                          <p className="text-sm text-muted-foreground">Vendor: {product.vendorName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${product.price?.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Qty: {product.stockQuantity}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedProduct && (
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="mb-6 pb-6 border-b border-border">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-primary hover:underline text-sm font-semibold mb-4"
                >
                  ← Back to search
                </button>
                <h2 className="text-2xl font-bold text-foreground mb-2">{selectedProduct.productName}</h2>
                <p className="text-muted-foreground">
                  <strong>Item_Code:</strong> {selectedProduct.productCode} | <strong>Vendor:</strong> {selectedProduct.vendorName}
                </p>
              </div>

              {updateMessage && (
                <div className={`p-4 rounded-lg border mb-6 ${
                  updateMessage.type === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-destructive/10 border-destructive/20'
                }`}>
                  <p className={updateMessage.type === 'success' ? 'text-green-700' : 'text-destructive'}>
                    {updateMessage.type === 'success' ? '✓' : '✗'} {updateMessage.text}
                  </p>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Price
                    </label>
                    <input
                      type="text"
                      value={formData.price}
                      onChange={(e) => handleFormChange('price', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Qty
                    </label>
                    <input
                      type="text"
                      value={formData.qty}
                      onChange={(e) => handleFormChange('qty', e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    EAN/UPC
                  </label>
                  <input
                    type="text"
                    value={formData.eanUpc}
                    onChange={(e) => handleFormChange('eanUpc', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Update Product'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 py-3 px-4 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {!selectedProduct && (
          <div className="bg-card border border-border rounded-lg p-6 h-fit">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Update Guide
            </h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="font-bold text-primary flex-shrink-0">1.</span>
                <span className="text-foreground">Enter Item_Code or Name</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-primary flex-shrink-0">2.</span>
                <span className="text-foreground">Click search button</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-primary flex-shrink-0">3.</span>
                <span className="text-foreground">Select product from results</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-primary flex-shrink-0">4.</span>
                <span className="text-foreground">Edit: Name, Price, Qty, EAN/UPC</span>
              </li>
            </ol>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Table:</strong> [dbo].[Tbl_Products]<br/>
                <strong>Key:</strong> Item_Code, Vendor
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
