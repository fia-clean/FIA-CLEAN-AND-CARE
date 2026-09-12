import React, { useState } from 'react';
import { X, Printer, Share2, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleRecord } from '../types';
import { formatCurrency, formatDateDDMMYYYY, createWhatsAppBillMessage, formatPackDisplay, getCleanInvoiceProductName } from '../utils/formatters';

interface BillInvoiceModalProps {
  sale: SaleRecord | null;
  onClose: () => void;
}

export const BillInvoiceModal: React.FC<BillInvoiceModalProps> = ({ sale, onClose }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [printStatus, setPrintStatus] = useState<string | null>(null);

  if (!sale) return null;

  // Build clean, high-resolution vector PDF using jsPDF
  const buildInvoicePDF = (record: SaleRecord) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header Brand
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 27, 75); // #1e1b4b
    doc.text('FIA CLEAN AND CARE', 105, 15, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // #334155
    doc.text('Wholesale and Retail', 105, 20.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // #475569
    doc.text('Edathanattukara', 105, 25.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Mob:8086452106', 105, 30.5, { align: 'center' });

    // CASH BILL badge
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(85, 33.5, 40, 5.5, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('CASH BILL', 105, 37.3, { align: 'center' });

    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 42, 196, 42);

    // Customer & Bill Details Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 45, 182, 22, 2, 2, 'FD');

    // Left: Customer details
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER DETAILS:', 18, 51);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(record.name, 18, 57);

    if (record.phone) {
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ph: ${record.phone}`, 18, 63);
    }

    // Right: Bill details
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.text('Bill No:', 140, 51);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202); // indigo
    doc.text(`#${record.billNo}`, 190, 51, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Date:', 140, 57);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatDateDDMMYYYY(record.date), 190, 57, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Type:', 140, 63);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${record.saleType} • ${record.paymentMode}`, 190, 63, { align: 'right' });

    // Items Table
    const tableRows = record.items.map((item, idx) => [
      idx + 1,
      getCleanInvoiceProductName(item.productName),
      formatPackDisplay(item),
      item.qty,
      `₹ ${Number(item.rate).toFixed(2)}`,
      `₹ ${Number(item.total).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 70.5,
      head: [['#', 'Product', 'Quantity', 'Unit', 'Price', 'Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto', fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
    });

    // Totals Box
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    const totalsBoxY = finalY + 5;
    const boxHeight = record.pendingAmount > 0 || (record.excessAmount || 0) > 0 ? 32 : 26;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(118, totalsBoxY, 78, boxHeight, 2, 2, 'FD');

    let curY = totalsBoxY + 5.5;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Sub Total:', 122, curY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`₹ ${record.grandTotal.toFixed(2)}`, 192, curY, { align: 'right' });

    curY += 6;
    doc.setFontSize(9.5);
    doc.setTextColor(67, 56, 202);
    doc.text('Grand Total:', 122, curY);
    doc.text(`₹ ${record.grandTotal.toFixed(2)}`, 192, curY, { align: 'right' });

    curY += 6;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(5, 150, 105); // emerald
    doc.text('Paid Amount:', 122, curY);
    doc.text(`₹ ${record.paidAmount.toFixed(2)}`, 192, curY, { align: 'right' });

    if (record.pendingAmount > 0) {
      curY += 6;
      doc.setTextColor(225, 29, 72); // rose
      doc.text('Balance Due:', 122, curY);
      doc.text(`₹ ${record.pendingAmount.toFixed(2)}`, 192, curY, { align: 'right' });
    } else if ((record.excessAmount || 0) > 0) {
      curY += 6;
      doc.setTextColor(217, 119, 6); // amber
      doc.text('Excess Return:', 122, curY);
      doc.text(`₹ ${(record.excessAmount || 0).toFixed(2)}`, 192, curY, { align: 'right' });
    }

    // Footer Note
    const footerY = Math.max(totalsBoxY + boxHeight + 8, finalY + boxHeight + 8);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, footerY, 196, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Thank you for choosing FIA Clean & Care!', 105, footerY + 5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Edathanattukara • Mob: 8086452106', 105, footerY + 9.5, { align: 'center' });

    return doc;
  };

  // Reliable Universal Print Action:
  // Generates standalone printable document that triggers native browser print dialog,
  // immune to iframe sandboxing or browser popup blockers.
  const handlePrint = () => {
    try {
      setPrintStatus('Opening print preview...');

      const invoiceHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FIA CASH BILL #${sale.billNo} - ${sale.name}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 16px;
    }
    .print-bar {
      max-width: 680px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e1b4b;
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .print-btn {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
    }
    .print-btn:hover { background: #4338ca; }
    .bill-wrapper {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
    .brand { font-size: 22px; font-weight: 900; color: #1e1b4b; text-transform: uppercase; letter-spacing: 0.5px; }
    .sub { font-size: 12px; font-weight: bold; color: #334155; margin-top: 2px; }
    .place { font-size: 12px; color: #475569; }
    .mob { font-size: 12px; font-weight: bold; color: #0f172a; margin-top: 2px; }
    .badge { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 800; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 14px; border-radius: 4px; letter-spacing: 1px; }
    .meta-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: bold; padding: 7px 8px; border: 1px solid #e2e8f0; text-align: left; }
    td { padding: 7px 8px; border: 1px solid #e2e8f0; }
    .totals-box { width: 260px; margin-left: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 12px; margin-bottom: 16px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .grand-row { border-top: 1px solid #cbd5e1; padding-top: 5px; font-size: 14px; font-weight: 900; color: #4338ca; }
    .paid-row { font-weight: bold; color: #059669; border-top: 1px solid #e2e8f0; padding-top: 4px; }
    .due-row { font-weight: 900; color: #e11d48; border-top: 1px dashed #cbd5e1; padding-top: 4px; }
    .excess-row { font-weight: 900; color: #d97706; border-top: 1px dashed #cbd5e1; padding-top: 4px; }
    .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #64748b; }
    
    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .print-bar { display: none !important; }
      .bill-wrapper { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <span style="font-size:13px; font-weight:bold;">FIA Clean & Care — Bill #${sale.billNo}</span>
    <button class="print-btn" onclick="window.print()">
      Print Bill / Save PDF
    </button>
  </div>

  <div class="bill-wrapper">
    <div class="header">
      <div class="brand">FIA CLEAN AND CARE</div>
      <div class="sub">Wholesale and Retail</div>
      <div class="place">Edathanattukara</div>
      <div class="mob">Mob:8086452106</div>
      <div class="badge">CASH BILL</div>
    </div>

    <div class="meta-box">
      <div>
        <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:bold;">Customer Details:</div>
        <div style="font-size:14px; font-weight:900; color:#0f172a; margin-top:2px;">${sale.name}</div>
        ${sale.phone ? `<div style="color:#475569; font-family:monospace; margin-top:2px;">Ph: ${sale.phone}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div>Bill No: <strong style="color:#4338ca; font-family:monospace;">#${sale.billNo}</strong></div>
        <div>Date: <strong>${formatDateDDMMYYYY(sale.date)}</strong></div>
        <div>Type: <strong>${sale.saleType} • ${sale.paymentMode}</strong></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:28px; text-align:center;">#</th>
          <th>Item Description</th>
          <th style="width:70px; text-align:center;">Pack</th>
          <th style="width:40px; text-align:center;">Qty</th>
          <th style="width:75px; text-align:right;">Rate</th>
          <th style="width:80px; text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map((item, idx) => `
          <tr>
            <td style="text-align:center; color:#64748b; font-family:monospace;">${idx + 1}</td>
            <td style="font-weight:bold;">${item.productName}</td>
            <td style="text-align:center; color:#475569;">${formatPackDisplay(item)}</td>
            <td style="text-align:center; font-family:monospace; font-weight:bold;">${item.qty}</td>
            <td style="text-align:right; font-family:monospace;">₹ ${Number(item.rate).toFixed(2)}</td>
            <td style="text-align:right; font-family:monospace; font-weight:bold;">₹ ${Number(item.total).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row">
        <span>Sub Total:</span>
        <strong style="font-family:monospace;">₹ ${sale.grandTotal.toFixed(2)}</strong>
      </div>
      <div class="totals-row grand-row">
        <span>Grand Total:</span>
        <strong style="font-family:monospace;">₹ ${sale.grandTotal.toFixed(2)}</strong>
      </div>
      <div class="totals-row paid-row">
        <span>Paid Amount:</span>
        <strong style="font-family:monospace;">₹ ${sale.paidAmount.toFixed(2)}</strong>
      </div>
      ${sale.pendingAmount > 0 ? `
        <div class="totals-row due-row">
          <span>Balance Due:</span>
          <strong style="font-family:monospace;">₹ ${sale.pendingAmount.toFixed(2)}</strong>
        </div>
      ` : ''}
      ${(sale.excessAmount || 0) > 0 ? `
        <div class="totals-row excess-row">
          <span>Excess Return:</span>
          <strong style="font-family:monospace;">₹ ${(sale.excessAmount || 0).toFixed(2)}</strong>
        </div>
      ` : ''}
    </div>

    <div class="footer">
      <p style="font-weight:bold; color:#334155;">Thank you for choosing FIA Clean & Care!</p>
      <p style="font-size:10px; color:#94a3b8; margin-top:2px;">Edathanattukara • Mob: 8086452106</p>
    </div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>
`;

      const blob = new Blob([invoiceHtml], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);

      // Attempt to open print window directly
      const printTab = window.open(blobUrl, '_blank');
      if (!printTab || printTab.closed || typeof printTab.closed === 'undefined') {
        // Fallback if browser blocked popups: trigger anchor click
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Also attempt parent window.print in case the host browser is not sandboxed
      try {
        if (window.self === window.top) {
          window.print();
        }
      } catch {
        // Ignore iframe sandbox violation
      }

      setTimeout(() => {
        setPrintStatus(null);
      }, 3000);
    } catch (err) {
      console.error('Print generation error:', err);
      // If printing fails, immediately fallback to direct vector PDF download
      handleDownloadPDF();
    }
  };


  const handleDownloadPDF = () => {
    try {
      setIsGeneratingPDF(true);
      const doc = buildInvoicePDF(sale);
      const safeCustomerName = (sale.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`FIA_CashBill_${sale.billNo}_${safeCustomerName}.pdf`);
    } catch (error) {
      console.error('Error generating vector PDF:', error);
      alert('Unable to generate PDF directly. Please use "Print Invoice" -> "Save as PDF".');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = createWhatsAppBillMessage(sale);
    const rawPhone = (sale.phone || '').replace(/\D/g, '');
    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if (rawPhone.length >= 10) {
      const fullPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
      url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 print:p-0 print:static print:bg-white print:z-auto print:block">
      <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl print:border-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:w-full print:block">
        {/* Modal Header (Hidden on print) */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded border border-indigo-200">
              #{sale.billNo}
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Cash Bill Preview</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Invoice Container */}
        <div
          className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-white text-slate-900 print:overflow-visible print:p-2 print:space-y-4 print:w-full"
          id="printableInvoice"
        >
          {/* Header & Brand */}
          <div className="text-center border-b-2 border-slate-900 pb-3 space-y-0.5">
            <h2 className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight uppercase">
              FIA CLEAN AND CARE
            </h2>
            <p className="text-xs sm:text-sm text-slate-800 font-bold">
              Wholesale and Retail
            </p>
            <p className="text-xs text-slate-600 font-medium">
              Edathanattukara
            </p>
            <p className="text-xs font-mono font-bold text-slate-800">
              Mob:8086452106
            </p>
            <div className="inline-block mt-1 text-[10px] uppercase tracking-widest font-mono font-bold bg-slate-100 text-slate-900 px-3.5 py-0.5 rounded border border-slate-300">
              CASH BILL
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-3 rounded-md border border-slate-200">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase font-bold text-slate-500">Customer Details:</p>
              <p className="font-black text-slate-900 text-sm">{sale.name}</p>
              {sale.phone && (
                <p className="font-mono text-slate-700 font-semibold text-xs">Ph: {sale.phone}</p>
              )}
            </div>

            <div className="text-right space-y-0.5">
              <p>
                <span className="text-slate-500">Bill No:</span>{' '}
                <strong className="font-mono text-indigo-700">#{sale.billNo}</strong>
              </p>
              <p>
                <span className="text-slate-500">Date:</span>{' '}
                <strong className="font-mono">{formatDateDDMMYYYY(sale.date)}</strong>
              </p>
              <p>
                <span className="text-slate-500">Type:</span>{' '}
                <span className="font-semibold text-slate-800">
                  {sale.saleType} • {sale.paymentMode}
                </span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2.5 text-center w-8">#</th>
                  <th className="py-2 px-2.5">Product</th>
                  <th className="py-2 px-2 text-center w-24">Quantity</th>
                  <th className="py-2 px-2 text-center w-14">Unit</th>
                  <th className="py-2 px-2.5 text-right w-24">Price</th>
                  <th className="py-2 px-2.5 text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2 px-2.5 text-center text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-2.5 font-bold text-slate-900">
                      {getCleanInvoiceProductName(item.productName)}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-600 font-medium font-mono text-[11px]">
                      {formatPackDisplay(item)}
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-800">
                      {item.qty}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                      ₹ {Number(item.rate).toFixed(2)}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                      ₹ {Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Summary */}
          <div className="flex justify-end pt-1">
            <div className="w-64 sm:w-72 space-y-1.5 text-xs text-right bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(sale.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-black text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">
                  {formatCurrency(sale.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
                <span>Paid Amount:</span>
                <span className="font-mono">{formatCurrency(sale.paidAmount)}</span>
              </div>
              {sale.pendingAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-black border-t border-dashed border-slate-300 pt-1">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatCurrency(sale.pendingAmount)}</span>
                </div>
              )}
              {(sale.excessAmount || 0) > 0 && (
                <div className="flex justify-between text-amber-600 font-black border-t border-dashed border-slate-300 pt-1">
                  <span>Excess Return:</span>
                  <span className="font-mono">{formatCurrency(sale.excessAmount || 0)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-slate-200 pt-3 text-[11px] text-slate-500">
            <p className="font-semibold text-slate-700">Thank you for choosing FIA Clean & Care!</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Edathanattukara • Mob: 8086452106
            </p>
          </div>
        </div>

        {/* Print status alert */}
        {printStatus && (
          <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 text-indigo-800 text-xs font-semibold flex items-center justify-between print:hidden">
            <span>{printStatus}</span>
            <span className="text-[11px] text-slate-500 font-normal">Check the opened print window</span>
          </div>
        )}

        {/* Modal Action Footer (Hidden on print) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGeneratingPDF ? 'Creating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Share WhatsApp</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
