/**
 * エクスポートユーティリティ
 * CSV、Excel、PDFへのデータエクスポート機能
 */
import { formatDate, formatCurrency } from './format';

// Try to load libraries if available
let saveAs: ((data: Blob, filename: string) => void) | null = null;
let XLSX: any = null;

// Check if we can import libraries
try {
  const fileSaverModule = require('file-saver');
  saveAs = fileSaverModule.saveAs;
} catch (e) {
  console.warn('file-saver not available');
}

try {
  XLSX = require('xlsx');
} catch (e) {
  console.warn('xlsx not available');
}

/**
 * CSVエクスポート
 */
export const exportToCSV = (
  data: any[],
  filename: string = 'export',
  headers?: { [key: string]: string }
) => {
  if (!saveAs) {
    console.error('File saver not available');
    return;
  }
  if (!data.length) return;

  const keys = Object.keys(data[0]);
  const csvHeaders = headers
    ? keys.map((key) => headers[key] || key)
    : keys;

  const csvContent = [
    csvHeaders.join(','),
    ...data.map((row) =>
      keys
        .map((key) => {
          const value = row[key];
          // 値にカンマや改行が含まれる場合はダブルクォートで囲む
          if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',')
    ),
  ].join('\n');

  // BOMを追加（Excelで文字化けを防ぐ）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
  if (saveAs) {
    saveAs(blob, `${filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
  }
};

/**
 * Excelエクスポート
 */
export const exportToExcel = (
  data: any[],
  filename: string = 'export',
  sheetName: string = 'Sheet1',
  headers?: { [key: string]: string }
) => {
  if (!saveAs || !XLSX) {
    console.error('Export libraries not available');
    return;
  }
  if (!data.length) return;

  // ヘッダーマッピング
  const keys = Object.keys(data[0]);
  const mappedData = data.map((row) => {
    const mappedRow: any = {};
    keys.forEach((key) => {
      const header = headers?.[key] || key;
      mappedRow[header] = row[key];
    });
    return mappedRow;
  });

  // ワークブック作成
  const worksheet = XLSX.utils.json_to_sheet(mappedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 列幅の自動調整
  const maxWidths: { [key: string]: number } = {};
  const headerKeys = headers ? Object.values(headers) : keys;
  
  headerKeys.forEach((header) => {
    maxWidths[header] = header.length;
  });

  mappedData.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      const length = String(value || '').length;
      if (!maxWidths[key] || length > maxWidths[key]) {
        maxWidths[key] = Math.min(length, 50); // 最大幅を50に制限
      }
    });
  });

  worksheet['!cols'] = Object.keys(maxWidths).map((key) => ({
    wch: maxWidths[key] + 2,
  }));

  // ファイル保存
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const excelBlob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (saveAs) {
    saveAs(excelBlob, `${filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
  }
};

/**
 * JSONエクスポート
 */
export const exportToJSON = (
  data: any[],
  filename: string = 'export'
) => {
  if (!saveAs) {
    console.error('File saver not available');
    return;
  }
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  saveAs(blob, `${filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.json`);
};

/**
 * PDFエクスポート（簡易実装）
 * 実際の実装では、PDFライブラリ（jsPDF等）を使用
 */
export const exportToPDF = async (
  element: HTMLElement,
  filename: string = 'export'
) => {
  // 実装例（html2canvasとjsPDFを使用）
  try {
    const { default: html2canvas } = await import('html2canvas');
    const jsPDF = (await import('jspdf')).default;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 297; // A4横向きの幅（mm）
    const pageHeight = 210; // A4横向きの高さ（mm）
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('PDFのエクスポートに失敗しました');
  }
};

/**
 * データ整形オプション
 */
export interface ExportOptions {
  dateFormat?: string;
  numberFormat?: 'comma' | 'none';
  currencyFormat?: string;
  includeHeaders?: boolean;
  selectedColumns?: string[];
}

/**
 * データの整形
 */
export const formatDataForExport = (
  data: any[],
  options: ExportOptions = {}
): any[] => {
  const {
    dateFormat = 'yyyy/MM/dd',
    numberFormat = 'comma',
    currencyFormat,
    selectedColumns,
  } = options;

  return data.map((row) => {
    const formattedRow: any = {};
    const keys = selectedColumns || Object.keys(row);

    keys.forEach((key) => {
      let value = row[key];

      // 日付の整形
      if (value instanceof Date) {
        value = formatDate(value, dateFormat);
      }

      // 数値の整形
      if (typeof value === 'number' && numberFormat === 'comma') {
        value = value.toLocaleString('ja-JP');
      }

      // 通貨の整形
      if (currencyFormat && typeof value === 'number' && key.includes('price')) {
        value = formatCurrency(value, currencyFormat);
      }

      formattedRow[key] = value;
    });

    return formattedRow;
  });
};

/**
 * エクスポートタイプの判定とエクスポート実行
 */
export const exportData = (
  data: any[],
  format: 'csv' | 'excel' | 'json',
  filename: string,
  options?: {
    headers?: { [key: string]: string };
    sheetName?: string;
    exportOptions?: ExportOptions;
  }
) => {
  const formattedData = options?.exportOptions
    ? formatDataForExport(data, options.exportOptions)
    : data;

  switch (format) {
    case 'csv':
      exportToCSV(formattedData, filename, options?.headers);
      break;
    case 'excel':
      exportToExcel(
        formattedData,
        filename,
        options?.sheetName || 'Sheet1',
        options?.headers
      );
      break;
    case 'json':
      exportToJSON(formattedData, filename);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};