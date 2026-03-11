'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Package, DollarSign, Box, Tag, FileText, Building2, Hash } from 'lucide-react';

interface Product {
  ProductId: number;
  ProductCode: string;
  ProductName: string;
  Description: string;
  Brand: string;
  Category: string;
  Price: number;
  StockQuantity: number;
  UPC: string;
  VendorId: number;
  VendorName: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productCode = params.productCode as string; // Updated to use productCode

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    brand: '',
    category: '',
    price: '',
    stockQuantity: '',
    upc: '', // Added UPC field
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProduct();
  }, [productCode]);

  const fetchProduct = async () => {
    try {
      console.log('Fetching product with Product Code:', productCode);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        setErrors({ submit: 'Authentication required. Please log in again.' });
        return;
      }

      console.log('Making API call to:', `/api/products/${productCode}`);
      
      const response = await fetch(`/api/products/${productCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('API Response Status:', response.status);
      console.log('API Response Headers:', response.headers);

      const data = await response.json();
      console.log('API Response Data:', data);

      if (!response.ok) {
        console.error('API Error Response:', data);
        setErrors({ submit: data.error || 'Failed to fetch product' });
        return;
      }

      console.log('Setting product data:', data);
      setProduct(data);
      
      const formDataToSet = {
        productName: data.ProductName || '',
        description: data.Description || '',
        brand: data.Brand || '',
        category: data.Category || '',
        price: data.Price ? data.Price.toString() : '',
        stockQuantity: data.StockQuantity ? data.StockQuantity.toString() : '',
        upc: data.UPC || '',
      };
      
      console.log('Setting form data:', formDataToSet);
      setFormData(formDataToSet);
      
    } catch (err) {
      console.error('Fetch product error:', err);
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }

    if (!formData.price.trim()) {
      newErrors.price = 'Price is required';
    } else if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Please enter a valid price';
    }

    if (!formData.stockQuantity.trim()) {
      newErrors.stockQuantity = 'Stock quantity is required';
    } else if (isNaN(parseInt(formData.stockQuantity)) || parseInt(formData.stockQuantity) < 0) {
      newErrors.stockQuantity = 'Please enter a valid stock quantity';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setErrors({ submit: 'Authentication required. Please log in again.' });
        return;
      }

      console.log('Updating product:', {
        productCode,
        updateData: {
          productName: formData.productName,
          description: formData.description,
          brand: formData.brand,
          category: formData.category,
          price: parseFloat(formData.price),
          stockQuantity: parseInt(formData.stockQuantity),
          upc: formData.upc,
        }
      });

      const response = await fetch(`/api/products/${productCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productName: formData.productName,
          description: formData.description,
          brand: formData.brand,
          category: formData.category,
          price: parseFloat(formData.price),
          stockQuantity: parseInt(formData.stockQuantity),
        }),
      });

      const data = await response.json();

      console.log('Product update response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });

      if (!response.ok) {
        console.error('Product update failed:', data);
        setErrors({ submit: data.error || 'Failed to update product' });
        return;
      }

      console.log('Product updated successfully:', data);
      
      // Show success message
      setErrors({ submit: 'Product updated successfully! Redirecting...' });
      
      // Update local product state with new data
      if (data.updatedProduct) {
        setProduct(data.updatedProduct);
        setFormData({
          productName: data.updatedProduct.ProductName || '',
          description: data.updatedProduct.Description || '',
          brand: data.updatedProduct.Brand || '',
          category: data.updatedProduct.Category || '',
          price: data.updatedProduct.Price ? data.updatedProduct.Price.toString() : '',
          stockQuantity: data.updatedProduct.StockQuantity ? data.updatedProduct.StockQuantity.toString() : '',
          upc: data.updatedProduct.UPC || '',
        });
      }
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Network error during product update:', err);
      setErrors({ submit: 'Network error. Please check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
              <p className="text-gray-600 mt-1">
                {product ? `Editing: ${product.ProductName}` : 'Loading product...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <form onSubmit={handleSubmit} className="p-8">
              {/* Form Error/Success */}
              {errors.submit && (
                <div className={`mb-6 p-4 border rounded-xl ${
                  errors.submit.includes('successfully') 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`font-medium ${
                    errors.submit.includes('successfully')
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}>
                    {errors.submit}
                  </p>
                </div>
              )}

              {/* Product Info Display */}
              {product && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Code:</span>
                      <span className="text-blue-700">{product.ProductCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Vendor:</span>
                      <span className="text-blue-700">{product.VendorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">UPC:</span>
                      <span className="text-blue-700">{product.UPC || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-blue-600">
                      Debug: ProductID={product.ProductId}, Stock={product.StockQuantity}, Price={product.Price}
                    </p>
                  </div>
                </div>
              )}

              {!product && !loading && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 font-medium">Product data not available. Please check product ID.</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Product Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="productName"
                        value={formData.productName}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.productName ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter product name"
                        required
                      />
                    </div>
                    {errors.productName && (
                      <p className="mt-2 text-sm text-red-600">{errors.productName}</p>
                    )}
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Brand
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
                        <Tag className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="brand"
                        value={formData.brand}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter brand name"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Category
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
                        <FileText className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter category"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Price */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Price <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="price"
                        value={formData.price}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.price ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    {errors.price && (
                      <p className="mt-2 text-sm text-red-600">{errors.price}</p>
                    )}
                  </div>

                  {/* Stock Quantity */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Stock Quantity <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Box className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        min="0"
                        name="stockQuantity"
                        value={formData.stockQuantity}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          errors.stockQuantity ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0"
                        required
                      />
                    </div>
                    {errors.stockQuantity && (
                      <p className="mt-2 text-sm text-red-600">{errors.stockQuantity}</p>
                    )}
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <span className="font-semibold">Current Stock:</span> {product?.StockQuantity || 0} units
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        Form Value: {formData.stockQuantity || 'empty'}
                      </p>
                    </div>
                  </div>

                  {/* UPC */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      UPC
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Hash className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="upc"
                        value={formData.upc}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter UPC code (optional)"
                      />
                    </div>
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-semibold">Current UPC:</span> {product?.UPC || 'Not set'}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleTextareaChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Enter product description"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating Product...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Update Product
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
