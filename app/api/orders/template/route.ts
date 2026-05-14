import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const ExcelJS = require('exceljs');
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Orders');

    // Define columns matching the DB schema
    const columns = [
      { header: 'Order/Demand ID',     key: 'order_demand_id',     width: 20 },
      { header: 'Supplier',            key: 'supplier',            width: 20 },
      { header: 'Order Date',          key: 'order_date',          width: 14 },
      { header: 'Invoice/SO/Proforma', key: 'invoice_so_proforma', width: 22 },
      { header: 'Invoice Date',        key: 'invoice_date',        width: 14 },
      { header: 'Delivery Date',       key: 'delivery_date',       width: 14 },
      { header: 'Port Info Date',      key: 'port_info_date',      width: 14 },
      { header: 'Status',              key: 'status',              width: 16 },
      { header: 'SO',                  key: 'so',                  width: 14 },
      { header: 'NAV',                 key: 'nav',                 width: 14 },
      { header: 'UPC/EAN',             key: 'upc_ean',             width: 16 },
      { header: 'Brand',               key: 'brand',               width: 16 },
      { header: 'NAV Name',            key: 'nav_name',            width: 24 },
      { header: 'Currency',            key: 'currency',            width: 10 },
      { header: 'Order Qty',           key: 'order_qty',           width: 12 },
      { header: 'Order Price',         key: 'order_price',         width: 12 },
      { header: 'SO Qty',              key: 'so_qty',              width: 12 },
      { header: 'SO Price',            key: 'so_price',            width: 12 },
      { header: 'Invoice Qty',         key: 'invoice_qty',         width: 12 },
      { header: 'Inv. Price',          key: 'inv_price',           width: 12 },
    ];

    worksheet.columns = columns;

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FF4A90D9' } },
        bottom: { style: 'thin', color: { argb: 'FF4A90D9' } },
        left:   { style: 'thin', color: { argb: 'FF4A90D9' } },
        right:  { style: 'thin', color: { argb: 'FF4A90D9' } },
      };
    });
    headerRow.height = 22;

    // Add a sample row so users know the expected format
    worksheet.addRow({
      order_demand_id:     'ORD-001',
      supplier:            'Supplier Name',
      order_date:          '2024-01-15',
      invoice_so_proforma: 'INV-2024-001',
      invoice_date:        '2024-01-20',
      delivery_date:       '2024-02-01',
      port_info_date:      '',
      status:              'PENDING',
      so:                  'SO-001',
      nav:                 'NAV-001',
      upc_ean:             '012345678901',
      brand:               'Brand Name',
      nav_name:            'Product Description',
      currency:            'USD',
      order_qty:           100,
      order_price:         25.50,
      so_qty:              100,
      so_price:            25.50,
      invoice_qty:         '',
      inv_price:           '',
    });

    // Style the sample row
    const sampleRow = worksheet.getRow(2);
    sampleRow.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F7FF' },
      };
      cell.font = { italic: true, color: { argb: 'FF555555' } };
    });

    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Orders_Template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Template generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
