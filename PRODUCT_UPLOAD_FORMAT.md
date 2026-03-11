# Product Upload Format Standard

## Overview
This document defines the standardized product upload format used across all vendors in the Vendor Price List application.

## Database Table
The standardized format is stored in the `ProductUploadFormat` table with the following structure:

### Table: ProductUploadFormat

| Column Name | Data Type | Required | Description |
|-------------|-----------|----------|-------------|
| FormatId | INT | Yes | Auto-generated primary key |
| VendorCode | NVARCHAR(50) | Yes | Unique vendor identifier |
| ProductCode | NVARCHAR(100) | Yes | Unique product identifier |
| ProductName | NVARCHAR(500) | Yes | Product name/title |
| Description | NVARCHAR(2000) | No | Detailed product description |
| Brand | NVARCHAR(200) | No | Product brand name |
| Category | NVARCHAR(200) | No | Product category |
| Price | DECIMAL(18,2) | Yes | Product price |
| StockQuantity | INT | No | Available stock quantity |
| UPC | NVARCHAR(50) | No | Universal Product Code |
| SKU | NVARCHAR(100) | No | Stock Keeping Unit |
| Weight | DECIMAL(10,3) | No | Product weight (kg/lbs) |
| Dimensions | NVARCHAR(200) | No | Product dimensions (LxWxH) |
| Color | NVARCHAR(100) | No | Product color |
| Size | NVARCHAR(50) | No | Product size |
| Material | NVARCHAR(200) | No | Product material |
| Warranty | NVARCHAR(500) | No | Warranty information |
| Manufacturer | NVARCHAR(200) | No | Manufacturer name |
| Origin | NVARCHAR(200) | No | Country of origin |
| IsActive | BIT | No | Record status (1=active) |
| CreatedAt | DATETIME | No | Creation timestamp |
| UpdatedAt | DATETIME | No | Last update timestamp |
| CreatedBy | NVARCHAR(100) | No | Created by user |
| UpdatedBy | NVARCHAR(100) | No | Updated by user |

## Upload Template Format

### Required Columns (Must be included):
1. **Vendor Code** - Vendor identifier
2. **Product Code** - Unique product code
3. **Product Name** - Product name/title
4. **Price** - Product price (decimal format)

### Optional Columns (Can be included):
5. **Description** - Product description
6. **Brand** - Brand name
7. **Category** - Product category
8. **Stock Quantity** - Available inventory
9. **UPC** - Universal Product Code
10. **SKU** - Stock Keeping Unit
11. **Weight** - Product weight
12. **Dimensions** - Product dimensions (LxWxH format)
13. **Color** - Product color
14. **Size** - Product size
15. **Material** - Product material
16. **Warranty** - Warranty information
17. **Manufacturer** - Manufacturer name
18. **Origin** - Country of origin

## File Format
- **Supported Formats**: .xlsx, .xls (Excel files only)
- **File Encoding**: UTF-8
- **Delimiter**: Comma (,)
- **Header Row**: Required (first row must contain column names)

## Sample Data Format

```
Vendor Code,Product Code,Product Name,Description,Brand,Category,Price,Stock Quantity,UPC,SKU,Weight,Dimensions,Color,Size,Material,Warranty,Manufacturer,Origin
DEMO001,PROD001,Sample Product 1,This is a sample product description for demonstration,Sample Brand,Electronics,29.99,100,123456789012,SKU001,0.500,10x5x2 inches,Black,Medium,Plastic,1 Year Warranty,Sample Manufacturer,USA
DEMO001,PROD002,Sample Product 2,Another sample product with different specifications,Another Brand,Home & Kitchen,15.99,50,987654321098,SKU002,1.200,15x10x8 inches,White,Large,Metal,2 Year Warranty,Another Manufacturer,China
```

## Guidelines for Vendors

1. **Column Headers**: Must match exactly as shown above (case-sensitive)
2. **Data Types**: Ensure data matches expected types (e.g., Price as decimal)
3. **Required Fields**: Vendor Code, Product Code, Product Name, and Price are mandatory
4. **Empty Values**: Leave optional fields blank if not applicable
5. **Special Characters**: Enclose text containing commas in quotes ("text,with,commas")
6. **File Naming**: Use descriptive names (e.g., "vendorname_products_2024.xlsx")

## Validation Rules

- **Vendor Code**: Must match existing vendor in system
- **Product Code**: Must be unique within each vendor
- **Price**: Must be a valid decimal number
- **Stock Quantity**: Must be a positive integer if provided
- **UPC**: Must be numeric if provided
- **Weight**: Must be a valid decimal number if provided

## Implementation Notes

- The template can be downloaded from the Upload page in the application
- Files are processed through the upload API endpoint
- Data is validated before insertion into the database
- Duplicate product codes within the same vendor are rejected
- Invalid data formats result in error reports with specific field information

## Support

For questions about the upload format or template usage:
1. Download the latest template from the application
2. Review sample data provided in the template
3. Contact system administrator for format clarification
