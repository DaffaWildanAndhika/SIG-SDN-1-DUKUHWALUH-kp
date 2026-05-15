import React, { useState, useEffect } from "react";
import { School, User, Hash, MoreHorizontal, Plus, Edit2, Trash2, Users, MapPin, Search, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function Kelas() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);
  const [gurus, setGurus] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKelas, setSelectedKelas] = useState<any>(null);
  
  // Student State
  const [isStudentDetailOpen, setIsStudentDetailOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentFormData, setStudentFormData] = useState({
    full_name: "",
    nisn: "",
    pob: "",
    dob: "",
    origin: "",
    parent_name: "",
    phone: ""
  });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    wali_kelas_id: "",
    academic_year: "2025/2026"
  });

  useEffect(() => {
    checkUserRole();
    fetchGurus();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedKelas) {
      setFormData({
        name: selectedKelas.name || "",
        wali_kelas_id: selectedKelas.wali_kelas_id || "",
        academic_year: selectedKelas.academic_year || "2025/2026"
      });
    } else {
      setFormData({
        name: "",
        wali_kelas_id: "",
        academic_year: "2025/2026"
      });
    }
  }, [selectedKelas, isDialogOpen]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const role = user.user_metadata?.role;
      setCanManage(role === "admin" || role === "guru");
    }
  };

  const fetchGurus = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'guru').order('full_name');
    setGurus(data || []);
  };

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*, wali:profiles(full_name), student_count:students(count)');
      if (error) throw error;
      setClasses(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data kelas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .order('full_name');
      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data murid: " + error.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleOpenStudentDetail = (cls: any) => {
    setSelectedKelas(cls);
    setIsStudentDetailOpen(true);
    fetchStudents(cls.id);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKelas) return;

    setLoadingStudents(true);
    try {
      if (selectedStudent) {
        const { error } = await supabase
          .from('students')
          .update(studentFormData)
          .eq('id', selectedStudent.id);
        if (error) throw error;
        toast.success("Data murid diperbarui");
      } else {
        const { error } = await supabase
          .from('students')
          .insert([{ ...studentFormData, class_id: selectedKelas.id }]);
        if (error) throw error;
        toast.success("Murid berhasil ditambahkan");
      }
      setIsAddStudentOpen(false);
      fetchStudents(selectedKelas.id);
      fetchClasses(); // Refresh counts
    } catch (error: any) {
      toast.error("Gagal menyimpan data murid: " + error.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Hapus data murid ini?")) return;
    
    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      toast.success("Data murid dihapus");
      if (selectedKelas) fetchStudents(selectedKelas.id);
      fetchClasses(); // Refresh counts
    } catch (error: any) {
      toast.error("Gagal menghapus data murid: " + error.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { 
        ...formData,
        wali_kelas_id: formData.wali_kelas_id === "" ? null : formData.wali_kelas_id
      };

      if (selectedKelas) {
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', selectedKelas.id);
        if (error) throw error;
        toast.success("Data kelas diperbarui");
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([payload]);
        if (error) throw error;
        toast.success("Kelas baru ditambahkan");
      }
      setIsDialogOpen(false);
      fetchClasses();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus kelas ini? Semua jadwal terkait juga akan dihapus.")) {
      try {
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (error) throw error;
        toast.success("Kelas berhasil dihapus");
        fetchClasses();
      } catch (error: any) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  const applyOfficialExcelStyle = (ws: any, columns: string[]) => {
    // Merge cells for header (already populated in aoa_to_sheet)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }, // School Name
      { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } }, // NPSN
      { s: { r: 2, c: 0 }, e: { r: 2, c: columns.length - 1 } }, // Address
      { s: { r: 3, c: 0 }, e: { r: 3, c: columns.length - 1 } }, // Academic Year
      { s: { r: 5, c: 0 }, e: { r: 5, c: columns.length - 1 } }, // Title
      { s: { r: 6, c: 0 }, e: { r: 6, c: columns.length - 1 } }, // Date
    ];

    // Styles
    const schoolNameStyle = {
      font: { name: "Times New Roman", sz: 16, bold: true },
      alignment: { horizontal: "center", vertical: "center" }
    };

    const infoStyle = {
      font: { name: "Times New Roman", sz: 10 },
      alignment: { horizontal: "center", vertical: "center" }
    };

    const titleStyle = {
      font: { name: "Times New Roman", sz: 14, bold: true },
      alignment: { horizontal: "center", vertical: "center" }
    };

    // Apply styles to header rows
    for (let r = 0; r < 8; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }; // Ensure cell exists
      
      if (r === 0) ws[cellRef].s = schoolNameStyle;
      else if (r === 5) ws[cellRef].s = titleStyle;
      else ws[cellRef].s = infoStyle;
    }

    // Styles for Table
    const headerStyle = {
      fill: { fgColor: { rgb: "FF9900" } }, // Orange
      font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    };

    const cellStyle = (isZebra: boolean) => ({
      fill: isZebra ? { fgColor: { rgb: "F8F8F8" } } : undefined,
      font: { name: "Times New Roman", sz: 11 },
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    });

    // Find table start row (after header info)
    const tableHeaderStart = 8;
    
    // Auto width columns
    const colWidths = columns.map(() => ({ wch: 20 }));
    ws['!cols'] = colWidths;

    // Apply Styles to Headers and Cells
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
    for (let R = tableHeaderStart; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) continue;
        
        if (R === tableHeaderStart) {
          ws[cellRef].s = headerStyle;
        } else {
          ws[cellRef].s = cellStyle((R - tableHeaderStart) % 2 === 0);
        }
      }
    }

    // Signature blocks
    const lastRow = range.e.r + 2;
    const adminCol = 0;
    const headmasterCol = columns.length - 2;

    const signatureLabelStyle = { font: { name: "Times New Roman", sz: 11 }, alignment: { horizontal: "center" } };
    const signatureNameStyle = { font: { name: "Times New Roman", sz: 11, bold: true, underline: true }, alignment: { horizontal: "center" } };

    const signRow1 = lastRow + 2;
    const signRow2 = signRow1 + 4;

    const addSign = (r: number, c: number, text: string, style: any) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      ws[ref] = { t: 's', v: text, s: style };
    };

    addSign(signRow1, adminCol, "Operator/Admin,", signatureLabelStyle);
    addSign(signRow2, adminCol, "Daffa Ahmad", signatureNameStyle);

    addSign(signRow1, headmasterCol, "Kepala Sekolah,", signatureLabelStyle);
    addSign(signRow2, headmasterCol, "Drs. H. Mulyono, M.Pd", signatureNameStyle);
    addSign(signRow2 + 1, headmasterCol, "NIP. 19700101 199501 1 001", signatureLabelStyle);

    // Freeze top row (table header)
    ws['!freeze'] = { xSplit: 0, ySplit: tableHeaderStart + 1 };
  };

  const exportToExcel = () => {
    try {
      const title = "DATA KELAS DAN WALI KELAS";
      const headers = ["NO", "NAMA KELAS", "TAHUN AKADEMIK", "WALI KELAS", "JUMLAH MURID"];
      
      const data = classes.map((cls, index) => [
        index + 1,
        cls.name,
        cls.academic_year,
        cls.wali?.full_name || '-',
        cls.student_count?.[0]?.count || 0
      ]);

      const ws = XLSX.utils.aoa_to_sheet([
        ["SDN 1 DUKUHWALUH"],
        ["NPSN: 20301234"],
        ["Jl. Raya Dukuhwaluh No. 1, Kec. Kembaran, Kab. Banyumas"],
        ["Tahun Ajaran 2025/2026"],
        [],
        [title],
        [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
        [],
        headers,
        ...data
      ]);

      applyOfficialExcelStyle(ws, headers);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Kelas");
      XLSX.writeFile(wb, `Data_Kelas_SDN1_Dukuhwaluh_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Laporan Excel berhasil dibuat");
    } catch (error) {
      console.error("Excel Export Error:", error);
      toast.error("Gagal mengeksport ke Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Add School Header Info
      doc.setFontSize(18);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text("SDN 1 DUKUHWALUH", 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("Daftar Kelas dan Wali Kelas", 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-400
      doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 38);

      const tableData = classes.map((cls, index) => [
        index + 1,
        cls.name,
        cls.academic_year,
        cls.wali?.full_name || '-',
        `${cls.student_count?.[0]?.count || 0} Siswa`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['No', 'Nama Kelas', 'Tahun Akademik', 'Wali Kelas', 'Jumlah Murid']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 45 },
      });

      doc.save(`Data_Kelas_SDN1_Dukuhwaluh_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Data kelas berhasil diexport ke PDF");
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Gagal mengeksport ke PDF");
    }
  };

  const exportSpecificClassToPDF = (cls: any, studentList: any[]) => {
    try {
      const doc = new jsPDF();
      
      // Header Sekolah
      doc.setFontSize(18);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text("SDN 1 DUKUHWALUH", 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(`DAFTAR MURID KELAS ${cls.name.toUpperCase()}`, 14, 28);
      
      // Informasi Kelas
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(`Wali Kelas: ${cls.wali?.full_name || 'Belum ditentukan'}`, 14, 38);
      doc.text(`Tahun Pelajaran: ${cls.academic_year}`, 14, 44);
      doc.text(`Total Murid: ${studentList.length} Siswa`, 14, 50);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-400
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 58);

      const tableData = studentList.map((student, index) => [
        index + 1,
        student.nisn || '-',
        student.full_name,
        student.pob || '-',
        student.dob || '-',
        student.parent_name || '-',
        student.origin || '-'
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['No', 'NISN', 'Nama Lengkap', 'Tempat Lahir', 'Tgl Lahir', 'Orang Tua', 'Alamat']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { top: 65 },
      });

      doc.save(`Daftar_Murid_Kelas_${cls.name}_${new Date().toLocaleDateString('id-ID')}.pdf`);
      toast.success(`Daftar murid kelas ${cls.name} berhasil diexport ke PDF`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Gagal mengeksport PDF kelas");
    }
  };

  const exportSpecificClassToExcel = (cls: any, studentList: any[]) => {
    try {
      const title = `DAFTAR MURID KELAS ${cls.name.toUpperCase()}`;
      const headers = ["NO", "NISN", "NAMA LENGKAP", "TEMPAT LAHIR", "TGL LAHIR", "ALAMAT", "ORANG TUA", "NO. HP"];
      
      const data = studentList.map((student, index) => [
        index + 1,
        student.nisn || '-',
        student.full_name,
        student.pob || '-',
        student.dob || '-',
        student.origin || '-',
        student.parent_name || '-',
        student.phone || '-'
      ]);

      const ws = XLSX.utils.aoa_to_sheet([
        ["SDN 1 DUKUHWALUH"],
        ["NPSN: 20301234"],
        ["Jl. Raya Dukuhwaluh No. 1, Kec. Kembaran, Kab. Banyumas"],
        ["Tahun Ajaran 2025/2026"],
        [],
        [title],
        [`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
        [],
        headers,
        ...data
      ]);

      applyOfficialExcelStyle(ws, headers);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data Murid");
      XLSX.writeFile(wb, `Data_Murid_${cls.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Daftar murid kelas ${cls.name} berhasil dieXport`);
    } catch (error) {
      console.error("Excel Export Error:", error);
      toast.error("Gagal mengeksport Excel kelas");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Kelas</h1>
          <p className="text-sm text-slate-500">Daftar kelas dan wali kelas SDN 1 Dukuhwaluh</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download size={16} /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Export ke Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                <FileText size={16} className="text-red-600" />
                <span>Export ke PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage && (
            <Button onClick={() => { setSelectedKelas(null); setIsDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus size={16} className="mr-2" /> Tambah Kelas
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-48"></Card>
          ))
        ) : classes.length > 0 ? (
          classes.map(cls => (
            <Card key={cls.id} className="border-none shadow-sm hover:shadow-md transition-all overflow-hidden group">
              <div className="h-2 bg-blue-600/10 group-hover:bg-blue-600 transition-colors"></div>
              <CardContent className="p-6">
                 <div className="flex justify-between items-start mb-6">
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                      <School size={24} />
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedKelas(cls); setIsDialogOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(cls.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                 </div>
                 
                 <h3 className="text-xl font-bold text-slate-800">{cls.name}</h3>
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{cls.academic_year}</p>
                 
                 <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between font-medium">
                       <div className="flex items-center gap-2 text-sm text-slate-600">
                          <User size={14} className="text-slate-400" />
                          <span>Wali Kelas</span>
                       </div>
                       <span className="text-sm text-slate-800 truncate max-w-[120px]">{cls.wali?.full_name || "Belum ada"}</span>
                    </div>
                    <div className="flex items-center justify-between font-medium">
                       <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users size={14} className="text-slate-400" />
                          <span>Nama Murid</span>
                       </div>
                       <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-bold">
                          {cls.student_count?.[0]?.count || 0} Siswa
                       </Badge>
                    </div>
                 </div>
                 
                 <Button 
                    variant="ghost" 
                    onClick={() => handleOpenStudentDetail(cls)}
                    className="w-full mt-6 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-none shadow-none font-bold text-xs"
                 >
                    Lihat Detail Kelas
                 </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl bg-white">
            <School className="text-slate-300 mb-2" size={48} />
            <p className="text-slate-500 font-medium">Belum ada data kelas</p>
            {canManage && <Button variant="link" onClick={() => setIsDialogOpen(true)}>Tambah kelas pertama</Button>}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedKelas ? "Edit Data Kelas" : "Tambah Kelas Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Kelas</Label>
              <Input 
                id="name" 
                placeholder="Contoh: Kelas 1A" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Wali Kelas</Label>
              <Select 
                value={formData.wali_kelas_id}
                onValueChange={(val) => setFormData({ ...formData, wali_kelas_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih wali kelas" />
                </SelectTrigger>
                <SelectContent>
                  {gurus.map(guru => (
                    <SelectItem key={guru.id} value={guru.id}>{guru.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="academic_year">Tahun Akademik</Label>
              <Input 
                id="academic_year" 
                placeholder="Contoh: 2025/2026" 
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                required 
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Kelas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Student Detail Dialog */}
      <Dialog open={isStudentDetailOpen} onOpenChange={setIsStudentDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto p-0 border-none">
          <div className="bg-slate-950 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
              <Badge className="bg-blue-600 hover:bg-blue-600 mb-2">{selectedKelas?.name}</Badge>
              <h2 className="text-3xl font-bold">Daftar Murid</h2>
              <p className="text-slate-400 text-sm mt-1">Wali Kelas: <span className="text-white font-medium">{selectedKelas?.wali?.full_name || "Belum ditentukan"}</span></p>
            </div>
          </div>

          <div className="p-8 space-y-6 bg-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{students.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Murid</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 sm:flex-none gap-2 font-bold">
                       <Download size={16} /> Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportSpecificClassToExcel(selectedKelas, students)} className="gap-2 cursor-pointer">
                      <FileSpreadsheet size={16} className="text-emerald-600" /> Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportSpecificClassToPDF(selectedKelas, students)} className="gap-2 cursor-pointer">
                      <FileText size={16} className="text-red-600" /> PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {canManage && (
                  <Button 
                    onClick={() => { 
                      setSelectedStudent(null); 
                      setStudentFormData({ 
                        full_name: "", 
                        nisn: "",
                        pob: "",
                        dob: "",
                        origin: "",
                        parent_name: "",
                        phone: ""
                      }); 
                      setIsAddStudentOpen(true); 
                    }} 
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 font-bold"
                  >
                    <Plus size={16} className="mr-2" /> Tambah Murid
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">NISN</TableHead>
                    <TableHead className="font-bold">Nama Lengkap</TableHead>
                    <TableHead className="font-bold">TTL</TableHead>
                    <TableHead className="font-bold">Alamat & Orang Tua</TableHead>
                    {canManage && <TableHead className="text-right font-bold">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStudents ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 5 : 4} className="text-center py-8">Memuat...</TableCell>
                    </TableRow>
                  ) : students.length > 0 ? (
                    students.map(student => (
                      <TableRow key={student.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono text-xs text-slate-500 font-medium">{student.nisn || "-"}</TableCell>
                        <TableCell className="font-bold text-slate-800">
                          {student.full_name}
                          <div className="text-[10px] text-slate-400 font-normal">{student.phone || "No HP -"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600">
                            {student.pob || "-"}, {student.dob || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <MapPin size={12} className="text-slate-400" />
                              {student.origin || "-"}
                            </div>
                            <div className="text-[10px] text-slate-400">Ortu: {student.parent_name || "-"}</div>
                          </div>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => { 
                                  setSelectedStudent(student); 
                                  setStudentFormData({ 
                                    full_name: student.full_name || "", 
                                    nisn: student.nisn || "",
                                    pob: student.pob || "",
                                    dob: student.dob || "",
                                    origin: student.origin || "",
                                    parent_name: student.parent_name || "",
                                    phone: student.phone || ""
                                  }); 
                                  setIsAddStudentOpen(true); 
                                }} 
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteStudent(student.id)} 
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={canManage ? 5 : 4} className="text-center py-12 text-slate-400 italic">
                        Belum ada data murid di kelas ini
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent ? "Edit Murid" : "Tambah Murid Baru"}</DialogTitle>
            <DialogDescription>Mengisi data murid untuk kelas {selectedKelas?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveStudent} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nama Lengkap</Label>
                <Input 
                  placeholder="Nama murid" 
                  value={studentFormData.full_name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, full_name: e.target.value })}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>NISN</Label>
                <Input 
                  placeholder="Nomor NISN" 
                  value={studentFormData.nisn}
                  onChange={(e) => setStudentFormData({ ...studentFormData, nisn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>No. HP (WhatsApp)</Label>
                <Input 
                  placeholder="Contoh: 0812..." 
                  value={studentFormData.phone}
                  onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tempat Lahir</Label>
                <Input 
                  placeholder="Contoh: Banyumas" 
                  value={studentFormData.pob}
                  onChange={(e) => setStudentFormData({ ...studentFormData, pob: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Lahir</Label>
                <Input 
                  type="date"
                  value={studentFormData.dob}
                  onChange={(e) => setStudentFormData({ ...studentFormData, dob: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nama Orang Tua / Wali</Label>
                <Input 
                  placeholder="Nama Ayah / Ibu" 
                  value={studentFormData.parent_name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, parent_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Alamat Lengkap</Label>
                <Input 
                  placeholder="Contoh: Desa Dukuhwaluh RT 01 RW 02" 
                  value={studentFormData.origin}
                  onChange={(e) => setStudentFormData({ ...studentFormData, origin: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setIsAddStudentOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold" disabled={loadingStudents}>
                {loadingStudents ? "Menyimpan..." : "Simpan Murid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
