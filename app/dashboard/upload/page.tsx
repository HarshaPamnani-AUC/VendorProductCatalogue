'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch vendors on mount
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        console.log('Fetching vendors from /api/vendors/list...');
        const response = await fetch('/api/vendors/list', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Vendors loaded:', data);
        setVendors(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setVendors([]);
      }
    };
    fetchVendors();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setUploadResult(null);
    } else {
      alert('Please upload only Excel files (.xlsx or .xls)');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate vendor and file
    if (!file || !selectedVendor) {
      setUploadResult({
        success: false,
        message: 'Please select a vendor and upload a file'
      });
      return;
    }

    setLoading(true);
    setUploadResult(null);

    try {
      console.log('Starting upload with FormData...');
      console.log('Vendor:', selectedVendor);
      console.log('File:', file.name);

      // Create FormData - send file as binary (multipart/form-data)
      const formData = new FormData();
      formData.append('vendorName', selectedVendor);
      formData.append('file', file);

      // Send to backend API using FormData
      const response = await fetch('/api/upload-products', {
        method: 'POST',
        body: formData,
        // Note: Don't set Content-Type header - browser sets it automatically with boundary
      });

      const result = await response.json();
      console.log('Upload response:', result);

      setUploadResult(result);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResult({
        success: false,
        message: 'File format not good'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      console.log('🔍 Downloading template...');
      
      // Direct window location (most reliable) - only one method
      window.location.href = '/templates/UploadFormat.xlsx';
      console.log('✅ Template download initiated');
      
    } catch (error) {
      console.error('❌ Download template error:', error);
      alert('Failed to download template. Please try again or contact support.');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Upload Products</h1>
        <p className="text-muted-foreground">Upload your product catalog in Excel format</p>
      </div>

      {/* Upload Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Upload Form + Processing Result */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleUpload} className="bg-card border border-border rounded-lg p-6">
            <div className="space-y-6">
              {/* Vendor Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Vendor
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Choose a vendor...</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.VendorId} value={vendor.VendorName}>
                      {vendor.VendorName}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Upload Excel File
                </label>
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <svg className="w-12 h-12 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-foreground font-medium mb-2">Drop your Excel file here or click to browse</p>
                  <p className="text-muted-foreground text-sm mb-4">Supports .xlsx, .xls only</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept=".xlsx,.xls"
                    className="hidden"
                  />
                  {file && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-700 font-semibold text-sm">✓ File selected: {file.name}</p>
                      <p className="text-green-700 text-xs mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              <button
                type="submit"
                disabled={loading || !selectedVendor || !file}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Uploading and Processing...' : 'Upload and Process'}
              </button>
            </div>
          </form>

          {/* Processing Result - Below Upload Form */}
          {uploadResult && (
            <div className={`bg-card border rounded-lg p-6 ${uploadResult.success ? 'border-green-200' : 'border-red-200'}`}>
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <svg className={`w-5 h-5 ${uploadResult.success ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={uploadResult.success ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                </svg>
                Processing Result
              </h3>
              <div className={`text-sm ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>
                <p className="font-semibold">{uploadResult.message}</p>
                
                {uploadResult.success && uploadResult.results && (
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <p className="font-semibold text-green-800">Processing summary</p>
                      {uploadResult.results.rowsInFile != null && (
                        <p>Rows in file: {uploadResult.results.rowsInFile}</p>
                      )}
                      <p>New products added: {uploadResult.results.rowsInserted}</p>
                      {(uploadResult.results.rowsSkippedDuplicates ?? 0) > 0 && (
                        <p>Identical rows skipped: {uploadResult.results.rowsSkippedDuplicates}</p>
                      )}
                      {(uploadResult.results.rowsFailed ?? 0) > 0 && (
                        <p>Rows failed: {uploadResult.results.rowsFailed}</p>
                      )}
                      {uploadResult.results.vendor && (
                        <p>Vendor: {uploadResult.results.vendor}</p>
                      )}
                    </div>
                  </div>
                )}

                {uploadResult.success && uploadResult.procedureResults && (
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <p className="font-semibold text-green-800">Processing summary</p>
                      <p>Records processed: {uploadResult.procedureResults.recordsProcessed}</p>
                      <p>Records inserted: {uploadResult.procedureResults.recordsInserted}</p>
                      <p>Rows moved to Products: {uploadResult.procedureResults.rowsMoved}</p>
                      <p>Vendor: {uploadResult.procedureResults.vendorName}</p>
                    </div>
                  </div>
                )}
                
                {!uploadResult.success && uploadResult.validationErrors && (
                  <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                    <p className="font-semibold text-red-800">❌ Excel Format Validation Failed:</p>
                    <p className="mt-2"><strong>Required columns:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                      {uploadResult.validationErrors.required.map((col: string, idx: number) => (
                        <li key={idx} className={uploadResult.validationErrors.actual.some((actual: string) => actual.toLowerCase() === col.toLowerCase()) ? 'text-green-600' : 'text-red-600'}>
                          {col} {uploadResult.validationErrors.actual.some((actual: string) => actual.toLowerCase() === col.toLowerCase()) ? '✓' : '✗ Missing'}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2"><strong>Actual columns found:</strong></p>
                    <p className="text-xs bg-gray-100 p-2 rounded">{uploadResult.validationErrors.actual.join(', ')}</p>
                    <p className="mt-2 text-xs text-gray-600">Please download the template and use the correct format.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Instructions + Download Template */}
        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Instructions
            </h3>
            <ol className="space-y-2 text-sm text-foreground">
              <li>1. Select your vendor from the dropdown</li>
              <li>2. Download the Excel template (or use your sheet with DATE, EAN/UPC, NAME, ITEM CODE, QTY, and a price column)</li>
              <li>3. Fill in your product data</li>
              <li>4. Upload the completed file</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-3">
              Also supported: SUPPLIER, EAN/ UPC, ITEM CODE, PRICE IN GBP, PRICE IN EURO, PRICE IN USD (uses GBP, then Euro, then USD per row).
            </p>
          </div>

          {/* Template Download */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </h3>
            <button
              onClick={downloadTemplate}
              className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </button>
            <p className="text-xs text-muted-foreground mt-2">Download template and open in Excel to create your upload file</p>
          </div>
        </div>
      </div>
    </div>
  );
}
