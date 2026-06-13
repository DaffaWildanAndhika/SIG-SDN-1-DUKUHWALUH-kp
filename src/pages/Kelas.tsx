/**
 * Kelas.tsx
 * Halaman manajemen rombongan belajar (kelas) dan data murid di dalamnya.
 * Mendukung pembatasan akses edit kelas untuk Guru, pengelolaan biodata siswa
 * (tambah/edit/hapus siswa di kelas), serta ekspor laporan kelas/siswa ke format PDF dan Excel.
 */
import React, { useState, useEffect } from "react";
import { School, User, Hash, MoreHorizontal, Plus, Edit2, Trash2, Users, MapPin, Search, Download, FileSpreadsheet, FileText, ArrowRight } from "lucide-react";
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
import { FormattedDateInput } from "@/components/ui/formatted-date-input";
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
import { logActivity } from "@/lib/activityLogger";
import XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface PageProps {
  user?: any;
  role?: string;
}

export default function Kelas({ user: propUser, role: propRole }: PageProps = {}) {
  const [currentUser, setCurrentUser] = useState<any>(propUser || null);
  const [isAdmin, setIsAdmin] = useState(propRole ? (propRole === "admin" || propUser?.email?.includes("admin@sekolah")) : false);
  const [isTeacher, setIsTeacher] = useState(propRole ? (propRole === "guru") : false);
  const [isKepalaSekolah, setIsKepalaSekolah] = useState(propRole ? (propRole === "kepala_sekolah") : false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [gurus, setGurus] = useState<any[]>([]);
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
    nis: "",
    nisn: "",
    pob: "",
    dob: "",
    origin: "",
    parent_name: "",
    phone: "",
    status: "Aktif"
  });

  // Filter & Search State
  const [searchClassesQuery, setSearchClassesQuery] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("all");
  const [searchStudentsQuery, setSearchStudentsQuery] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    wali_kelas_id: "",
    academic_year: "2025/2026"
  });

  useEffect(() => {
    checkUserRole();
    fetchGurus();
    fetchClasses(true);
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
    let user = propUser;
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    }
    if (user) {
      setCurrentUser(user);
      
      let role = propRole;
      if (!role) {
        try {
          const { data: profilesById } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id);

          let profilesByEmail: any[] = [];
          if (user.email) {
            const { data } = await supabase
              .from('profiles')
              .select('role')
              .ilike('email', user.email.trim());
            if (data) {
              profilesByEmail = data;
            }
          }

          const uniqueRoles = Array.from(new Set([...(profilesById || []), ...profilesByEmail].map(p => p.role)));
          if (uniqueRoles.length > 0) {
            role = uniqueRoles.find(r => r === "admin" || r === "kepala_sekolah") || uniqueRoles[0];
          } else {
            role = user.user_metadata?.role || "guru";
          }
        } catch (err) {
          console.warn("Failed fetching profiles for checkUserRole in Kelas.tsx:", err);
        }
      }
      
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      const adminStatus = role === "admin" || isSpecialAdmin;
      setIsAdmin(adminStatus);
      setIsTeacher(role === "guru");
      setIsKepalaSekolah(role === "kepala_sekolah");
    }
  };

  const canManageStudents = isAdmin || isTeacher || isKepalaSekolah;

  const fetchGurus = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'guru').order('full_name');
    setGurus(data || []);
  };

  const fetchClasses = async (isInitial = false) => {
    if (isInitial || classes.length === 0) {
      setLoading(true);
    }
    try {
      let user = propUser;
      if (!user) {
        const { data } = await supabase.auth.getUser();
        user = data?.user;
      }
      if (!user) return;

      let role = propRole || "guru";
      let matchedUserProfileIds: string[] = [user.id];

      if (!propRole) {
        try {
          const { data: profilesById } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', user.id);

          let profilesByEmail: any[] = [];
          if (user.email) {
            const { data } = await supabase
              .from('profiles')
              .select('id, role')
              .ilike('email', user.email.trim());
            if (data) {
              profilesByEmail = data;
            }
          }

          // Combine unique profiles
          const uniqueProfilesMap = new Map<string, any>();
          [...(profilesById || []), ...profilesByEmail].forEach(p => {
            uniqueProfilesMap.set(p.id, p);
          });
          const matchedProfiles = Array.from(uniqueProfilesMap.values());
          
          if (matchedProfiles.length > 0) {
            matchedUserProfileIds = matchedProfiles.map(p => p.id);
            const primaryProfile = matchedProfiles.find(p => p.id === user.id) || matchedProfiles[0];
            role = primaryProfile?.role || user.user_metadata?.role || "guru";
          }
        } catch (err) {
          console.warn("Failed resolving profiles in fetchClasses:", err);
        }
      }
      
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      const isAdminRole = role === "admin" || isSpecialAdmin;

      let fetchedClasses: any[] = [];
      if (!isAdminRole) {
        // Query classes where the user has a teaching schedule
        const { data: teachingSchedules } = await supabase
          .from('teaching_schedules')
          .select('class_id')
          .in('guru_id', matchedUserProfileIds);
        
        const scheduleClassIds = Array.from(
          new Set(
            (teachingSchedules || [])
              .map(s => s.class_id)
              .filter((id): id is string => !!id)
          )
        );

        // Fetch classes where user is Wali Kelas
        const { data: wkClasses, error: wkError } = await supabase
          .from('classes')
          .select('*, wali:profiles(full_name), student_count:students(count)')
          .in('wali_kelas_id', matchedUserProfileIds);
        
        if (wkError) throw wkError;

        let scClasses: any[] = [];
        if (scheduleClassIds.length > 0) {
          const { data: tsClasses, error: tsError } = await supabase
            .from('classes')
            .select('*, wali:profiles(full_name), student_count:students(count)')
            .in('id', scheduleClassIds);
          
          if (tsError) throw tsError;
          scClasses = tsClasses || [];
        }

        // Combine unique classes
        const uniqueClassesMap = new Map<string, any>();
        [...(wkClasses || []), ...scClasses].forEach(cls => {
          uniqueClassesMap.set(cls.id, cls);
        });
        fetchedClasses = Array.from(uniqueClassesMap.values());
      } else {
        const { data, error } = await supabase
          .from('classes')
          .select('*, wali:profiles(full_name), student_count:students(count)')
          .order('name');
        
        if (error) throw error;
        fetchedClasses = data || [];
      }

      setClasses(fetchedClasses);
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
        await logActivity(
          "Mengubah Data Siswa", 
          `Mengubah data siswa ${studentFormData.full_name} (NIS: ${studentFormData.nis || '-'}) di kelas ${selectedKelas.name}`,
          selectedStudent,
          studentFormData
        );
        toast.success("Data murid diperbarui");
      } else {
        const { error } = await supabase
          .from('students')
          .insert([{ ...studentFormData, class_id: selectedKelas.id }]);
        if (error) throw error;
        await logActivity("Menambahkan Data Siswa", `Menambahkan siswa baru ${studentFormData.full_name} (NIS: ${studentFormData.nis || '-'}) ke kelas ${selectedKelas.name}`);
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
      // Fetch details first
      const { data: stdData } = await supabase
        .from('students')
        .select('full_name')
        .eq('id', studentId)
        .single();
      const studentName = stdData?.full_name || "Siswa";

      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;

      await logActivity("Menghapus Data Siswa", `Menghapus data siswa ${studentName} dari kelas ${selectedKelas?.name || ''}`);
      toast.success("Data murid dihapus");
      if (selectedKelas) fetchStudents(selectedKelas.id);
      fetchClasses(); // Refresh counts
    } catch (error: any) {
      toast.error("Gagal menghapus data murid: " + error.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const canManageClass = isAdmin || isKepalaSekolah;
    if (!canManageClass) {
      toast.error("Hanya admin atau kepala sekolah yang dapat mengelola data kelas");
      return;
    }
    setSaving(true);
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
        await logActivity(
          "Mengubah Data Kelas", 
          `Mengubah informasi kelas ${payload.name} (Tahun Ajaran: ${payload.academic_year})`,
          selectedKelas,
          payload
        );
        toast.success("Data kelas diperbarui");
      } else {
        const { error } = await supabase
          .from('classes')
          .insert([payload]);
        if (error) throw error;
        await logActivity("Menambahkan Kelas Baru", `Menambahkan kelas baru ${payload.name} (Tahun Ajaran: ${payload.academic_year})`);
        toast.success("Kelas baru ditambahkan");
      }
      setIsDialogOpen(false);
      fetchClasses();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus kelas ini? Semua jadwal terkait juga akan dihapus.")) {
      try {
        const { data: clsData } = await supabase
          .from('classes')
          .select('name')
          .eq('id', id)
          .single();
        const className = clsData?.name || "Kelas";

        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (error) throw error;

        await logActivity("Menghapus Kelas", `Menghapus data kelas ${className}`);
        toast.success("Kelas berhasil dihapus");
        fetchClasses();
      } catch (error: any) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  const activeAcademicYears = Array.from(new Set(classes.map(c => c.academic_year))).sort().reverse();

  const filteredClasses = classes.filter(cls => {
    const matchesSearch = cls.name.toLowerCase().includes(searchClassesQuery.toLowerCase()) || 
                         (cls.wali?.full_name || "").toLowerCase().includes(searchClassesQuery.toLowerCase());
    const matchesYear = academicYearFilter === "all" || cls.academic_year === academicYearFilter;
    return matchesSearch && matchesYear;
  });

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchStudentsQuery.toLowerCase()) ||
                         (s.nisn || "").includes(searchStudentsQuery) ||
                         (s.nis || "").includes(searchStudentsQuery);
    const matchesStatus = studentStatusFilter === "all" || s.status === studentStatusFilter;
    return matchesSearch && matchesStatus;
  });

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
    <div className="space-y-8 pb-20 md:pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">Administrasi</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Manajemen Kelas</h1>
          <p className="text-slate-500 font-medium mt-1">
            Pengelolaan data kelompok belajar dan wali kelas <span className="text-slate-900 font-bold">SDN 1 Dukuhwaluh</span>.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-12 px-6 border-slate-200 hover:border-slate-900 hover:bg-slate-50 rounded-xl font-bold text-slate-600 transition-all gap-2 shadow-sm">
                <Download size={18} />
                <span>Export Data</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] rounded-xl border-slate-100 shadow-xl p-1">
              <DropdownMenuItem onClick={exportToExcel} className="gap-3 py-3 px-4 rounded-lg cursor-pointer focus:bg-emerald-50 focus:text-emerald-700">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Excel Report</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight">Format Spreadsheet</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="gap-3 py-3 px-4 rounded-lg cursor-pointer focus:bg-red-50 focus:text-red-700">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                  <FileText size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">PDF Document</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight">Format Dokumen Cetak</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <Button 
              onClick={() => { setSelectedKelas(null); setIsDialogOpen(true); }} 
              className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 rounded-xl transition-all flex items-center gap-2 group"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
              <span>Tambah Kelas</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Cari kelas atau wali kelas..." 
            value={searchClassesQuery}
            onChange={(e) => setSearchClassesQuery(e.target.value)}
            className="h-12 pl-12 bg-slate-50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
          />
        </div>
        <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}>
          <SelectTrigger className="h-12 w-full md:w-[220px] bg-slate-50 border-none rounded-2xl font-bold text-slate-600 px-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 capitalize whitespace-nowrap">Tahun:</span>
              <SelectValue placeholder="Pilih Tahun" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
            <SelectItem value="all" className="font-bold">Semua Tahun</SelectItem>
            {activeAcademicYears.map(year => (
              <SelectItem key={year} value={year} className="font-bold">{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white border border-slate-100 rounded-[32px] animate-pulse"></div>
          ))
        ) : filteredClasses.length > 0 ? (
          filteredClasses.map((cls, index) => (
            <Card key={cls.id} className="border border-slate-100 rounded-[32px] shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden group bg-white relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <CardContent className="p-8 relative z-10">
                 <div className="flex justify-between items-start mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all duration-300">
                      <School size={28} />
                    </div>
                    {(isAdmin || isKepalaSekolah) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={() => { setSelectedKelas(cls); setIsDialogOpen(true); }} 
                          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="Edit Kelas"
                        >
                          <Edit2 size={16} />
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(cls.id)} 
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Hapus Kelas"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                 </div>
                 
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors uppercase">
                      {cls.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{cls.academic_year}</span>
                    </div>
                 </div>
                 
                 <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                            <User size={14} />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wali Kelas</span>
                             <span className="text-xs font-black text-slate-800 tracking-tight truncate max-w-[140px] uppercase">
                                {cls.wali?.full_name || "Belum Ditentukan"}
                             </span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                            <Users size={14} />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Populasi</span>
                             <span className="text-xs font-black text-slate-800 tracking-tight uppercase">
                                {cls.student_count?.[0]?.count || 0} Siswa Terdaftar
                             </span>
                          </div>
                       </div>
                       <Badge className="bg-slate-900 text-white border-none font-black text-[9px] px-2.5 py-0.5 rounded-md uppercase tracking-[0.1em]">
                          Aktif
                       </Badge>
                    </div>
                 </div>
                 
                 <Button 
                    onClick={() => handleOpenStudentDetail(cls)}
                    className="w-full mt-8 h-12 bg-white hover:bg-blue-50 border-2 border-slate-100 hover:border-blue-200 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 shadow-sm shadow-slate-100"
                 >
                    Manajemen Murid <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-20 bg-white border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-center p-12">
            <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mb-6">
              <School size={48} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Belum Ada Kelas</h3>
            <p className="text-slate-500 font-medium max-w-xs mt-2 mb-8">
              Sistem membutuhkan data kelas untuk memulai manajemen akademik dan jadwal mengajar.
            </p>
            {isAdmin && (
              <Button 
                onClick={() => setIsDialogOpen(true)}
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-100"
              >
                Inisialisasi Kelas Sekarang
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[420px] p-0 border-none shadow-2xl rounded-[32px] overflow-hidden bg-white flex flex-col max-h-[90vh]">
          <div className="bg-slate-900 p-6 text-white relative shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <School size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black uppercase tracking-tight">
                    {selectedKelas ? "Edit Kelas" : "Tambah Kelas"}
                  </DialogTitle>
                  <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                    Administrasi Kelompok Belajar
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Kelas</Label>
              <Input 
                placeholder="Contoh: Kelas 1A" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required 
                className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wali Kelas</Label>
              <Select 
                value={formData.wali_kelas_id}
                onValueChange={(val) => setFormData({ ...formData, wali_kelas_id: val })}
              >
                <SelectTrigger className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm">
                  <SelectValue placeholder="Pilih wali kelas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  {gurus.map(guru => (
                    <SelectItem key={guru.id} value={guru.id} className="font-bold py-2 text-xs">{guru.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tahun Ajaran</Label>
              <Input 
                placeholder="Contoh: 2025/2026" 
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                required 
                className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
              />
            </div>

            <DialogFooter className="pt-4 gap-2 flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-10 rounded-xl font-bold text-slate-400 text-xs">
                Batal
              </Button>
              <Button type="submit" className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg flex-1 text-xs uppercase" disabled={saving}>
                {saving ? "..." : (selectedKelas ? "Simpan" : "Tambah")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Student Detail Dialog */}
      <Dialog open={isStudentDetailOpen} onOpenChange={setIsStudentDetailOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-[40px]">
          <div className="bg-[#0f172a] p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-40 -mt-40"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-white/10 flex items-center justify-center">
                    <Users size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                      Kelas {selectedKelas?.name}
                    </Badge>
                    <h2 className="text-3xl font-black uppercase tracking-tight leading-none">Daftar Murid</h2>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Wali Kelas</span>
                    <span className="text-sm font-black text-white uppercase tracking-tight">
                      {selectedKelas?.wali?.full_name || "Belum Ditentukan"}
                    </span>
                  </div>
                  <div className="w-[1px] h-8 bg-white/10"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tahun Pelajaran</span>
                    <span className="text-sm font-black text-white uppercase tracking-tight">{selectedKelas?.academic_year}</span>
                  </div>
                  <div className="w-[1px] h-8 bg-white/10"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Populasi</span>
                    <span className="text-sm font-black text-blue-400 uppercase tracking-tight">{filteredStudents.length} Siswa Sesuai Filter</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-sm self-start md:self-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-11 px-6 text-white hover:bg-white/10 font-bold transition-all gap-2 text-xs uppercase tracking-widest">
                       <Download size={16} className="text-blue-400" /> Export List
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px] rounded-xl border-slate-100 shadow-2xl p-1">
                    <DropdownMenuItem onClick={() => exportSpecificClassToExcel(selectedKelas, filteredStudents)} className="gap-3 py-3 px-4 rounded-lg cursor-pointer">
                      <FileSpreadsheet size={16} className="text-emerald-600" /> 
                      <span className="font-bold text-xs uppercase">Excel Spreadsheet</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportSpecificClassToPDF(selectedKelas, filteredStudents)} className="gap-3 py-3 px-4 rounded-lg cursor-pointer">
                      <FileText size={16} className="text-red-600" /> 
                      <span className="font-bold text-xs uppercase">PDF Document</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-[1px] h-6 bg-white/10"></div>

                {(isAdmin || isTeacher || isKepalaSekolah) && (
                  <Button 
                    onClick={() => { 
                      setSelectedStudent(null); 
                      setStudentFormData({ 
                        full_name: "", 
                        nis: "",
                        nisn: "",
                        pob: "",
                        dob: "",
                        origin: "",
                        parent_name: "",
                        phone: "",
                        status: "Aktif"
                      }); 
                      setIsAddStudentOpen(true); 
                    }} 
                    className="h-11 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-900/20 text-xs uppercase tracking-widest gap-2"
                  >
                    <Plus size={16} /> <span>Pendaftaran Murid</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="px-10 py-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Cari nama atau NISN murid..." 
                value={searchStudentsQuery}
                onChange={(e) => setSearchStudentsQuery(e.target.value)}
                className="h-10 pl-10 bg-white border-slate-200 rounded-xl font-bold text-sm focus-visible:ring-blue-500"
              />
            </div>
            <Select value={studentStatusFilter} onValueChange={setStudentStatusFilter}>
              <SelectTrigger className="h-10 w-full md:w-[150px] bg-white border-slate-200 rounded-xl font-bold text-slate-600 px-4 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                <SelectItem value="all" className="font-bold">Semua Status</SelectItem>
                <SelectItem value="Aktif" className="font-bold">Aktif</SelectItem>
                <SelectItem value="Lulus" className="font-bold">Lulus</SelectItem>
                <SelectItem value="Pindah" className="font-bold">Pindah</SelectItem>
                <SelectItem value="Keluar" className="font-bold">Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-0 bg-white">
            <div className="max-h-[500px] overflow-y-auto">
              <Table className="border-collapse">
                <TableHeader className="bg-slate-50 sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent border-b-2 border-slate-900">
                    <TableHead className="h-14 font-black text-[10px] text-slate-900 uppercase tracking-[0.2em] pl-10 border-r-2 border-slate-900">NISN & Profil</TableHead>
                    <TableHead className="h-14 font-black text-[10px] text-slate-900 uppercase tracking-[0.2em] border-r-2 border-slate-900">Informasi Kelahiran</TableHead>
                    <TableHead className="h-14 font-black text-[10px] text-slate-900 uppercase tracking-[0.2em] border-r-2 border-slate-900">Kontak & Orang Tua</TableHead>
                    {(isAdmin || isTeacher || isKepalaSekolah) && (
                      <TableHead className="h-14 text-right font-black text-[10px] text-slate-900 uppercase tracking-[0.2em] pr-10">Kontrol</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingStudents ? (
                    Array(4).fill(0).map((_, i) => (
                      <TableRow key={i} className="border-b-2 border-slate-100">
                        <TableCell className="pl-10 py-8 border-r-2 border-slate-50"><div className="h-10 w-48 bg-slate-50 rounded-xl animate-pulse" /></TableCell>
                        <TableCell className="border-r-2 border-slate-50"><div className="h-10 w-32 bg-slate-50 rounded-xl animate-pulse" /></TableCell>
                        <TableCell className="border-r-2 border-slate-50"><div className="h-10 w-40 bg-slate-50 rounded-xl animate-pulse" /></TableCell>
                        <TableCell className="pr-10"><div className="h-10 w-24 bg-slate-50 rounded-xl float-right animate-pulse" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredStudents.length > 0 ? (
                    filteredStudents.map((student, idx) => (
                      <TableRow key={student.id} className="group hover:bg-blue-50/30 transition-colors border-b-2 border-slate-900 last:border-b-0">
                        <TableCell className="pl-10 py-6 border-r-2 border-slate-900">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                              <span className="font-black text-xs">{idx + 1}</span>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">NIS: {student.nis || "-"} • NISN: {student.nisn || "-"}</span>
                                <Badge className={`text-[8px] font-black px-1.5 py-0 rounded-md ${
                                  student.status === 'Aktif' ? 'bg-emerald-100 text-emerald-600' :
                                  student.status === 'Lulus' ? 'bg-blue-100 text-blue-600' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {student.status || 'Aktif'}
                                </Badge>
                              </div>
                              <span className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{student.full_name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="border-r-2 border-slate-900">
                          <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                               <MapPin size={12} className="text-blue-500" />
                               <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{student.pob || "Sidoarjo"}</span>
                             </div>
                             <span className="text-[10px] font-bold text-slate-400 pl-5 uppercase">{student.dob || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="border-r-2 border-slate-900">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wali Murid</span>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">{student.parent_name || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                {student.phone || "No HP -"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        {(isAdmin || isTeacher || isKepalaSekolah) && (
                          <TableCell className="text-right pr-10">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => { 
                                  setSelectedStudent(student); 
                                  setStudentFormData({ 
                                    full_name: student.full_name || "", 
                                    nis: student.nis || "",
                                    nisn: student.nisn || "",
                                    pob: student.pob || "",
                                    dob: student.dob || "",
                                    origin: student.origin || "",
                                    parent_name: student.parent_name || "",
                                    phone: student.phone || "",
                                    status: student.status || "Aktif"
                                  }); 
                                  setIsAddStudentOpen(true); 
                                }} 
                                className="w-10 h-10 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all"
                              >
                                <Edit2 size={16} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteStudent(student.id)} 
                                className="w-10 h-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={(isAdmin || isTeacher || isKepalaSekolah) ? 4 : 3} className="text-center py-20 bg-slate-50/50">
                        <div className="flex flex-col items-center justify-center max-w-xs mx-auto">
                          <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-slate-200 mb-4 border border-slate-100">
                             <Users size={32} />
                          </div>
                          <p className="text-slate-900 font-black uppercase tracking-tight text-sm">Belum Ada Murid</p>
                          <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">
                            Database kelas ini masih kosong atau tidak ada murid yang sesuai dengan filter.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                 Data Akademik SDN 1 Dukuhwaluh • Pencarian Aktif: {searchStudentsQuery || 'Semua'} • Filter: {studentStatusFilter === 'all' ? 'Semua Status' : studentStatusFilter}
               </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] p-0 border-none shadow-2xl rounded-[32px] overflow-hidden bg-white flex flex-col max-h-[95vh]">
          <div className="bg-blue-600 p-6 text-white relative shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black uppercase tracking-tight">
                    {selectedStudent ? "Edit Murid" : "Pendaftaran Murid"}
                  </DialogTitle>
                  <p className="text-blue-100 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                    Kelas {selectedKelas?.name}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSaveStudent} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</Label>
                <Input 
                  placeholder="Nama Lengkap Siswa" 
                  value={studentFormData.full_name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, full_name: e.target.value })}
                  required 
                  className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIS</Label>
                  <Input 
                    placeholder="Nomor Induk" 
                    value={studentFormData.nis}
                    onChange={(e) => setStudentFormData({ ...studentFormData, nis: e.target.value })}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NISN</Label>
                  <Input 
                    placeholder="10 Digit" 
                    value={studentFormData.nisn}
                    onChange={(e) => setStudentFormData({ ...studentFormData, nisn: e.target.value })}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. HP Orang Tua</Label>
                <Input 
                  placeholder="08..." 
                  value={studentFormData.phone}
                  onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                  className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tempat Lahir</Label>
                  <Input 
                    placeholder="Banyumas" 
                    value={studentFormData.pob}
                    onChange={(e) => setStudentFormData({ ...studentFormData, pob: e.target.value })}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Lahir</Label>
                  <FormattedDateInput 
                    value={studentFormData.dob}
                    onChange={(val) => setStudentFormData({ ...studentFormData, dob: val })}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Keaktifan</Label>
                <Select 
                  value={studentFormData.status}
                  onValueChange={(val) => setStudentFormData({ ...studentFormData, status: val })}
                >
                  <SelectTrigger className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm capitalize">
                    <SelectValue placeholder="Pilih Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    <SelectItem value="Aktif" className="font-bold">Aktif</SelectItem>
                    <SelectItem value="Lulus" className="font-bold">Lulus</SelectItem>
                    <SelectItem value="Pindah" className="font-bold">Pindah</SelectItem>
                    <SelectItem value="Keluar" className="font-bold">Keluar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Orang Tua/Wali</Label>
                <Input 
                  placeholder="Nama Orang Tua" 
                  value={studentFormData.parent_name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, parent_name: e.target.value })}
                  className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Tinggal</Label>
                <Input 
                  placeholder="Alamat Lengkap" 
                  value={studentFormData.origin}
                  onChange={(e) => setStudentFormData({ ...studentFormData, origin: e.target.value })}
                  className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 text-sm"
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2 flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setIsAddStudentOpen(false)} className="h-10 rounded-xl font-bold text-slate-400 text-xs">
                Batal
              </Button>
              <Button type="submit" className="h-10 px-8 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg flex-1 text-xs uppercase" disabled={loadingStudents}>
                {loadingStudents ? "..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
