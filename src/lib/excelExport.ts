/**
 * excelExport.ts
 * Layanan utilitas untuk mengekspor data tabel (siswa, kelas, guru, jadwal, presensi, nilai)
 * ke dalam format Excel (.xlsx) dengan menerapkan kustomisasi gaya (styling) tabel
 * menggunakan library xlsx-js-style.
 */
import * as XLSX from 'xlsx';
import 'xlsx-js-style';

// Definisi tipe untuk styling Excel
declare global {
  namespace XLSX {
    interface CellObject {
      s?: any;
    }
  }
}

interface SchoolInfo {
  name: string;
  npsn: string;
  address: string;
  city?: string;
  province?: string;
  academicYear: string;
}

interface ExportOptions {
  title: string;
  filename: string;
  schoolInfo: SchoolInfo;
  data: any[];
  columns: { key: string; label: string; width?: number }[];
  showRowNumbers?: boolean;
  headerColor?: string;
  alternateColor?: boolean;
  totals?: { [key: string]: 'sum' | 'count' | 'average' };
  signatures?: Array<{ title: string; name: string }>;
  footerNotes?: string[];
}

// Color definitions (hex format)
const COLORS = {
  darkBlue: 'FF1F4E78',
  darkGreen: 'FF2D5016',
  lightGray: 'FFF2F2F2',
  white: 'FFFFFFFF',
  black: 'FF000000',
  borderGray: 'FFC6C6C6',
};

// Styling functions
const createHeaderStyle = (color: string = COLORS.darkBlue) => ({
  fill: { fgColor: { rgb: color } },
  font: { bold: true, color: { rgb: COLORS.white }, name: 'Calibri', sz: 11 },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: {
    left: { style: 'thin', color: { rgb: COLORS.borderGray } },
    right: { style: 'thin', color: { rgb: COLORS.borderGray } },
    top: { style: 'thin', color: { rgb: COLORS.borderGray } },
    bottom: { style: 'thin', color: { rgb: COLORS.borderGray } },
  },
});

const createCellStyle = (bgColor?: string) => ({
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.black } },
  alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  border: {
    left: { style: 'thin', color: { rgb: COLORS.borderGray } },
    right: { style: 'thin', color: { rgb: COLORS.borderGray } },
    top: { style: 'thin', color: { rgb: COLORS.borderGray } },
    bottom: { style: 'thin', color: { rgb: COLORS.borderGray } },
  },
  fill: bgColor ? { fgColor: { rgb: bgColor } } : undefined,
});

const createTitleStyle = () => ({
  font: { bold: true, name: 'Calibri', sz: 14, color: { rgb: COLORS.darkBlue } },
  alignment: { horizontal: 'center', vertical: 'middle' },
});

const createSubtitleStyle = () => ({
  font: { name: 'Calibri', sz: 10, color: { rgb: COLORS.black } },
  alignment: { horizontal: 'left', vertical: 'middle' },
});

const createSignatureStyle = () => ({
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.black } },
  alignment: { horizontal: 'center', vertical: 'top' },
});

// Format tanggal Indonesia
const formatDateIndonesia = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Main export function
export const exportToExcel = (options: ExportOptions): void => {
  const {
    title,
    filename,
    schoolInfo,
    data,
    columns,
    showRowNumbers = true,
    headerColor = COLORS.darkBlue,
    alternateColor = true,
    totals,
    signatures = [],
    footerNotes = [],
  } = options;

  // Buat workbook dan worksheet
  const wb = XLSX.utils.book_new();
  const ws_data: any[] = [];
  let currentRow = 0;

  // 1. Header Sekolah
  ws_data[currentRow] = [schoolInfo.name];
  const schoolNameCell = ws_data[currentRow][0];
  currentRow++;

  ws_data[currentRow] = [`NPSN: ${schoolInfo.npsn}`];
  currentRow++;

  ws_data[currentRow] = [schoolInfo.address];
  if (schoolInfo.city) {
    ws_data[currentRow][0] += `, ${schoolInfo.city}`;
  }
  currentRow++;

  ws_data[currentRow] = []; // Spasi
  currentRow++;

  // 2. Judul Laporan
  ws_data[currentRow] = [title];
  currentRow++;

  // 3. Informasi Tahun Ajaran
  ws_data[currentRow] = [`Tahun Ajaran: ${schoolInfo.academicYear}`];
  currentRow++;

  ws_data[currentRow] = [`Tanggal Export: ${formatDateIndonesia(new Date())}`];
  currentRow++;

  ws_data[currentRow] = []; // Spasi
  currentRow++;

  // 4. Header Tabel
  const headerRow: string[] = [];
  if (showRowNumbers) {
    headerRow.push('No.');
  }
  columns.forEach(col => {
    headerRow.push(col.label);
  });

  const headerRowIndex = currentRow;
  ws_data[currentRow] = headerRow;
  currentRow++;

  // 5. Data Tabel
  const dataStartRow = currentRow;
  data.forEach((item, index) => {
    const row: any[] = [];
    if (showRowNumbers) {
      row.push(index + 1);
    }
    columns.forEach(col => {
      let value = item[col.key];
      // Format tanggal jika ada
      if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        value = formatDateIndonesia(value);
      }
      // Format angka dengan pemisah ribuan
      if (typeof value === 'number' && col.key.includes('total')) {
        value = new Intl.NumberFormat('id-ID').format(value);
      }
      row.push(value || '-');
    });
    ws_data[currentRow] = row;
    currentRow++;
  });

  // 6. Totals Row (jika ada)
  if (totals && Object.keys(totals).length > 0) {
    ws_data[currentRow] = [];
    const totalsRow = ws_data[currentRow];
    if (showRowNumbers) {
      totalsRow.push('');
    }

    let colIndex = showRowNumbers ? 1 : 0;
    columns.forEach((col, idx) => {
      if (totals[col.key] === 'sum') {
        const columnLetter = String.fromCharCode(65 + (showRowNumbers ? idx + 1 : idx));
        const startRow = dataStartRow + 1;
        const endRow = currentRow;
        totalsRow[idx + (showRowNumbers ? 1 : 0)] = `=SUM(${columnLetter}${startRow}:${columnLetter}${endRow})`;
      } else if (totals[col.key] === 'count') {
        totalsRow[idx + (showRowNumbers ? 1 : 0)] = data.length;
      } else if (totals[col.key] === 'average') {
        const columnLetter = String.fromCharCode(65 + (showRowNumbers ? idx + 1 : idx));
        const startRow = dataStartRow + 1;
        const endRow = currentRow;
        totalsRow[idx + (showRowNumbers ? 1 : 0)] = `=AVERAGE(${columnLetter}${startRow}:${columnLetter}${endRow})`;
      } else {
        totalsRow[idx + (showRowNumbers ? 1 : 0)] = col.label === 'No.' ? 'TOTAL' : '';
      }
      colIndex++;
    });
    currentRow++;
  }

  // 7. Spasi sebelum signature
  ws_data[currentRow] = [];
  currentRow++;

  // 8. Signatures
  if (signatures.length > 0) {
    const sigStartRow = currentRow;
    signatures.forEach((sig) => {
      ws_data[currentRow] = [sig.title];
      currentRow++;
    });

    // Spasi untuk tempat tanda tangan
    for (let i = 0; i < 3; i++) {
      ws_data[currentRow] = [];
      currentRow++;
    }

    // Nama tanda tangan
    let sigCol = 0;
    signatures.forEach((sig) => {
      if (!ws_data[currentRow]) ws_data[currentRow] = [];
      ws_data[currentRow][sigCol] = sig.name;
      sigCol += 8; // Jarak antar kolom signature
    });
    currentRow++;
  }

  // 9. Footer notes
  if (footerNotes.length > 0) {
    ws_data[currentRow] = [];
    currentRow++;
    footerNotes.forEach(note => {
      ws_data[currentRow] = [note];
      currentRow++;
    });
  }

  // Buat worksheet dari data
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Set column widths
  const colWidths: number[] = [];
  if (showRowNumbers) colWidths.push(6);
  columns.forEach(col => {
    colWidths.push(col.width || 15);
  });
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  // Set row heights
  ws['!rows'] = [];

  // Apply styling
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellRef];
      if (!cell) continue;

      // School info header styling
      if (row < 3) {
        cell.s = {
          font: { bold: true, name: 'Calibri', sz: row === 0 ? 13 : 10, color: { rgb: COLORS.darkBlue } },
          alignment: { horizontal: 'left', vertical: 'middle' },
        };
      }
      // Title styling
      else if (row === headerRowIndex - 2) {
        cell.s = createTitleStyle();
      }
      // Info styling
      else if (row === headerRowIndex - 1) {
        cell.s = createSubtitleStyle();
      }
      // Header row styling
      else if (row === headerRowIndex) {
        cell.s = createHeaderStyle(headerColor);
      }
      // Data rows styling
      else if (row > headerRowIndex && row < dataStartRow + data.length) {
        const isAlternate = (row - headerRowIndex - 1) % 2 === 1;
        const bgColor = alternateColor && isAlternate ? COLORS.lightGray : undefined;
        cell.s = createCellStyle(bgColor);

        // Center alignment untuk nomor
        if (col === 0 && showRowNumbers) {
          cell.s.alignment.horizontal = 'center';
        }
      }
      // Totals row styling
      else if (row === dataStartRow + data.length) {
        cell.s = {
          ...createCellStyle(),
          font: { ...createCellStyle().font, bold: true },
        };
      }
      // Signature styling
      else if (row > dataStartRow + data.length) {
        cell.s = createSignatureStyle();
      }
    }
  }

  // Set page setup untuk landscape
  ws['!pageSetup'] = {
    paperSize: 9, // A4
    orientation: 'landscape',
  };

  // Set margins
  ws['!margins'] = {
    left: 0.5,
    right: 0.5,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };

  // Freeze panes (freeze header dan info rows)
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 1 };

  // Add autofilter pada header
  ws['!autofilter'] = { ref: `A${headerRowIndex + 1}:${String.fromCharCode(65 + headerRow.length - 1)}${headerRowIndex + 1}` };

  // Tambahkan worksheet ke workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan');

  // Set workbook properties
  wb.Props = {
    Title: title,
    Author: 'Sistem Informasi Sekolah',
    CreatedDate: new Date(),
  };

  // Download file
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Specialized export functions

export const exportKelasList = (
  data: any[],
  schoolInfo: SchoolInfo
): void => {
  exportToExcel({
    title: 'LAPORAN DATA KELAS',
    filename: 'Laporan_Kelas',
    schoolInfo,
    data,
    columns: [
      { key: 'name', label: 'Nama Kelas', width: 18 },
      { key: 'wali_kelas', label: 'Wali Kelas', width: 20 },
      { key: 'academic_year', label: 'Tahun Ajaran', width: 15 },
      { key: 'student_count', label: 'Jumlah Siswa', width: 12 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    totals: {
      student_count: 'sum',
    },
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Operator/Admin', name: '___________________' },
    ],
  });
};

export const exportGuruList = (
  data: any[],
  schoolInfo: SchoolInfo
): void => {
  exportToExcel({
    title: 'LAPORAN DATA GURU/TENAGA PENDIDIK',
    filename: 'Laporan_Guru',
    schoolInfo,
    data,
    columns: [
      { key: 'nip', label: 'NIP', width: 15 },
      { key: 'full_name', label: 'Nama Lengkap', width: 22 },
      { key: 'subject', label: 'Mata Pelajaran', width: 18 },
      { key: 'gender', label: 'Jenis Kelamin', width: 15 },
      { key: 'phone', label: 'Telepon', width: 15 },
      { key: 'status', label: 'Status', width: 12 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    totals: {
      nip: 'count',
    },
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Operator/Admin', name: '___________________' },
    ],
  });
};

export const exportJadwalMengajar = (
  data: any[],
  schoolInfo: SchoolInfo
): void => {
  exportToExcel({
    title: 'LAPORAN JADWAL MENGAJAR',
    filename: 'Laporan_Jadwal_Mengajar',
    schoolInfo,
    data,
    columns: [
      { key: 'guru_name', label: 'Guru', width: 20 },
      { key: 'subject', label: 'Mata Pelajaran', width: 18 },
      { key: 'class_name', label: 'Kelas', width: 15 },
      { key: 'day', label: 'Hari', width: 12 },
      { key: 'start_time', label: 'Jam Mulai', width: 12 },
      { key: 'end_time', label: 'Jam Selesai', width: 12 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Operator/Admin', name: '___________________' },
    ],
  });
};

export const exportJadwalPiket = (
  data: any[],
  schoolInfo: SchoolInfo
): void => {
  exportToExcel({
    title: 'LAPORAN JADWAL PIKET',
    filename: 'Laporan_Jadwal_Piket',
    schoolInfo,
    data,
    columns: [
      { key: 'guru_name', label: 'Guru', width: 22 },
      { key: 'day', label: 'Hari', width: 12 },
      { key: 'shift', label: 'Shift', width: 15 },
      { key: 'location', label: 'Lokasi', width: 20 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Operator/Admin', name: '___________________' },
    ],
  });
};

export const exportSiswaList = (
  data: any[],
  schoolInfo: SchoolInfo,
  className?: string
): void => {
  exportToExcel({
    title: `LAPORAN DATA SISWA${className ? ` - ${className}` : ''}`,
    filename: `Laporan_Siswa${className ? `_${className.replace(/\//g, '-')}` : ''}`,
    schoolInfo,
    data,
    columns: [
      { key: 'nisn', label: 'NISN', width: 15 },
      { key: 'full_name', label: 'Nama Lengkap', width: 22 },
      { key: 'gender', label: 'Jenis Kelamin', width: 15 },
      { key: 'dob', label: 'Tanggal Lahir', width: 15 },
      { key: 'pob', label: 'Tempat Lahir', width: 18 },
      { key: 'parent_name', label: 'Nama Orang Tua', width: 22 },
      { key: 'phone', label: 'Telepon', width: 15 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    totals: {
      nisn: 'count',
    },
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Operator/Admin', name: '___________________' },
    ],
  });
};

export const exportAttendanceReport = (
  data: any[],
  schoolInfo: SchoolInfo,
  period?: string
): void => {
  exportToExcel({
    title: `LAPORAN KEHADIRAN${period ? ` - ${period}` : ''}`,
    filename: `Laporan_Kehadiran${period ? `_${period.replace(/\//g, '-')}` : ''}`,
    schoolInfo,
    data,
    columns: [
      { key: 'name', label: 'Nama', width: 22 },
      { key: 'hadir', label: 'Hadir', width: 10 },
      { key: 'izin', label: 'Izin', width: 10 },
      { key: 'sakit', label: 'Sakit', width: 10 },
      { key: 'alpha', label: 'Alpa', width: 10 },
      { key: 'percentage', label: 'Persentase %', width: 12 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    totals: {
      hadir: 'sum',
      izin: 'sum',
      sakit: 'sum',
      alpha: 'sum',
    },
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Operator/Admin', name: '___________________' },
    ],
  });
};

export const exportAcademicReport = (
  data: any[],
  schoolInfo: SchoolInfo,
  subject?: string
): void => {
  exportToExcel({
    title: `LAPORAN NILAI AKADEMIK${subject ? ` - ${subject}` : ''}`,
    filename: `Laporan_Nilai${subject ? `_${subject.replace(/\//g, '-')}` : ''}`,
    schoolInfo,
    data,
    columns: [
      { key: 'nisn', label: 'NISN', width: 15 },
      { key: 'name', label: 'Nama Siswa', width: 22 },
      { key: 'uh1', label: 'UH 1', width: 10 },
      { key: 'uh2', label: 'UH 2', width: 10 },
      { key: 'uts', label: 'UTS', width: 10 },
      { key: 'uas', label: 'UAS', width: 10 },
      { key: 'average', label: 'Rata-rata', width: 12 },
      { key: 'grade', label: 'Grade', width: 10 },
    ],
    showRowNumbers: true,
    alternateColor: true,
    totals: {
      average: 'average',
    },
    signatures: [
      { title: 'Kepala Sekolah', name: '___________________' },
      { title: 'Guru Mata Pelajaran', name: '___________________' },
    ],
  });
};
