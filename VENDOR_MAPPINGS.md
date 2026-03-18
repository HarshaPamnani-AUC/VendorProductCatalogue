# Vendor Column Mappings Documentation

## Overview
This document outlines the Excel column mappings for each vendor in the Product Catalog system.

## Vendor Mappings

### 1. ET Perfumes Inc. (Vendor ID: 1)
- **Excel Structure**: Generic columns (__EMPTY, __EMPTY_1, etc.)
- **Skip Header Rows**: 1
- **Mappings**:
  - Product Code: `__EMPTY_1`
  - Product Name: `__EMPTY_5`
  - Description: `__EMPTY_5`
  - Brand: `__EMPTY_4`
  - Category: `__EMPTY_3`
  - Price: `__EMPTY_7`
  - Stock Quantity: `__EMPTY_6`
  - UPC: `__EMPTY`

### 2. Partheco International (Vendor ID: 2)
- **Excel Structure**: Generic columns (__EMPTY, __EMPTY_1, etc.)
- **Skip Header Rows**: 9
- **Mappings**:
  - Product Code: `__EMPTY_1`
  - Product Name: `__EMPTY_5`
  - Description: `__EMPTY_5`
  - Brand: `__EMPTY_4`
  - Category: `__EMPTY_3`
  - Price: `Date offered:` (special column name)
  - Stock Quantity: `__EMPTY_7`
  - UPC: `__EMPTY`

### 3. Global Beauty Supplies (Vendor ID: 3)
- **Excel Structure**: Standard named columns
- **Skip Header Rows**: 1
- **Mappings**:
  - Product Code: `ProductCode`
  - Product Name: `ProductName`
  - Description: `Description`
  - Brand: `Brand`
  - Category: `Category`
  - Price: `Price`
  - Stock Quantity: `Stock`
  - UPC: `UPC`

### 4. Premium Imports Ltd (Vendor ID: 4)
- **Excel Structure**: Standard named columns
- **Skip Header Rows**: 2
- **Mappings**:
  - Product Code: `SKU`
  - Product Name: `ProductName`
  - Description: `Description`
  - Brand: `Brand`
  - Category: `Category`
  - Price: `Price`
  - Stock Quantity: `Quantity`
  - UPC: `Barcode`

## Notes

### ET Perfumes Inc. & Partheco International
- These vendors use generic Excel column names (__EMPTY, __EMPTY_1, etc.)
- The actual data starts after the specified number of header rows
- Column positions may vary between different Excel files from the same vendor

### Global Beauty Supplies & Premium Imports Ltd
- These vendors use standard named columns
- More predictable structure for data processing
- Easier to maintain and troubleshoot

## Troubleshooting

### Common Issues
1. **Column Mismatch**: Excel columns don't match the configured mapping
2. **Header Row Issues**: Incorrect SkipHeaderRows setting
3. **Special Characters**: Column names with special characters or spaces

### Solutions
1. Check the actual Excel file structure using the upload logs
2. Update the VendorColumnMappings table accordingly
3. Test with sample data before processing large files

## Adding New Vendors

To add a new vendor:
1. Add the vendor to the Vendors table
2. Create a column mapping in VendorColumnMappings
3. Test with a sample Excel file
4. Update this documentation
