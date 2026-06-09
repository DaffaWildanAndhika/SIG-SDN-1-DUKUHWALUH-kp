/**
 * Absensi.tsx
 * Halaman untuk mencatat presensi harian siswa (Hadir, Sakit, Izin, Alpa) dan
 * melakukan rekap presensi per semester dengan saringan rentang tanggal kustom,
 * lengkap dengan grafik ringkasan serta fitur ekspor laporan ke format Excel dan PDF.
 */
import React, { useState, useEffect } from "react";
import { 
  ClipboardCheck, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  BookOpen, 
  Search, 
  Save, 
  Download, 
  Sparkles, 
  Plus, 
  Info, 
  Check, 
  RefreshCw,
  Copy,
  Clock,
  UserCheck
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select";
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

export default function Absensi({ user: propUser, role: propRole }: PageProps = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(propUser || null);
  const [userRole, setUserRole] = useState<string>(propRole || "guru");
  const [isBypassMode, setIsBypassMode] = useState(false);
  
  // Class & Student listing states
  const [classList, setClassList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString("en-CA") // format YYYY-MM-DD in local time
  );

  // Attendance state: Map student ID to its attendance record (status & notes)
  // Record structure: { status: 'Hadir'|'Sakit'|'Izin'|'Alfa', notes: string }
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: string; notes: string }>>({});
  
  // Database vs Local fallback tracking
  const [dbTableExists, setDbTableExists] = useState<boolean>(true);
  const [showSqlInstruction, setShowSqlInstruction] = useState<boolean>(false);

  // Rekap Semester states
  const [activeTab, setActiveTab] = useState<"input" | "rekap">("input");
  const [selectedSemester, setSelectedSemester] = useState<string>("1");
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [loadingRekap, setLoadingRekap] = useState<boolean>(false);
  const [startDateSem, setStartDateSem] = useState<string>("");
  const [endDateSem, setEndDateSem] = useState<string>("");

  // SQL schema instruction
  const sqlStatement = `-- Salin perintah SQL berikut ke SQL Editor di Supabase Anda:

CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alfa')),
  notes TEXT,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  academic_year TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Buat Policy agar Semua Pengguna bisa Melihat Absensi
CREATE POLICY "Attendance is viewable by everyone" ON attendance FOR SELECT USING (true);

-- Buat Policy agar Admin dan Guru bisa Mengelola Data Absensi
CREATE POLICY "Admins and teachers can manage attendance" ON attendance FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR role = 'guru' OR role = 'kepala_sekolah')
  )
);`;

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadClassData(selectedClassId);
    } else {
      setStudents([]);
      setAttendanceMap({});
    }
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    if (selectedClassId) {
      const selectedClass = classList.find((c) => c.id === selectedClassId);
      const ay = selectedClass?.academic_year || ""; // e.g. "2025/2026"
      const match = ay.match(/(\d{4})\/(\d{4})/);
      let year1 = new Date().getFullYear();
      let year2 = year1 + 1;
      if (match) {
        year1 = parseInt(match[1]);
        year2 = parseInt(match[2]);
      }
      
      if (selectedSemester === "1") {
        setStartDateSem(`${year1}-07-01`);
        setEndDateSem(`${year1}-12-31`);
      } else {
        setStartDateSem(`${year2}-01-01`);
        setEndDateSem(`${year2}-06-30`);
      }
    }
  }, [selectedClassId, selectedSemester, classList]);

  useEffect(() => {
    if (activeTab === "rekap" && selectedClassId && startDateSem && endDateSem) {
      fetchRekapData(selectedClassId, startDateSem, endDateSem);
    }
  }, [selectedClassId, startDateSem, endDateSem, activeTab]);

  const getLocalAttendanceRecords = (classId: string) => {
    const records: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`attendance_${classId}_`)) {
        const dateStr = key.replace(`attendance_${classId}_`, "");
        try {
          const data = JSON.parse(localStorage.getItem(key) || "{}");
          Object.entries(data).forEach(([studentId, val]: any) => {
            records.push({
              student_id: studentId,
              date: dateStr,
              status: val.status,
              notes: val.notes || ""
            });
          });
        } catch (e) {}
      }
    }
    return records;
  };

  const fetchRekapData = async (classId: string, start: string, end: string) => {
    if (!classId) return;
    setLoadingRekap(true);
    try {
      const { data: classStudents, error: stdError } = await supabase
        .from('students')
        .select('id, full_name, nis, nisn')
        .eq('class_id', classId)
        .order('full_name');
      
      if (stdError) throw stdError;
      const studentsList = classStudents || [];

      let attendanceRecords: any[] = [];
      if (dbTableExists) {
        try {
          const { data: dbRecords, error: attError } = await supabase
            .from('attendance')
            .select('*')
            .eq('class_id', classId);
          
          if (attError) throw attError;
          attendanceRecords = dbRecords || [];
        } catch (dbErr) {
          console.warn("DB read failed for rekap, checking local storage fallback:", dbErr);
          attendanceRecords = getLocalAttendanceRecords(classId);
        }
      } else {
        attendanceRecords = getLocalAttendanceRecords(classId);
      }

      const filteredRecords = attendanceRecords.filter((rec) => {
        if (!rec.date) return false;
        return rec.date >= start && rec.date <= end;
      });

      const computed = studentsList.map((st) => {
        const studentRecords = filteredRecords.filter((r) => r.student_id === st.id);
        const hadir = studentRecords.filter((r) => r.status === "Hadir").length;
        const sakit = studentRecords.filter((r) => r.status === "Sakit").length;
        const izin = studentRecords.filter((r) => r.status === "Izin").length;
        const alfa = studentRecords.filter((r) => r.status === "Alfa").length;
        const total = hadir + sakit + izin + alfa;
        const percentage = total > 0 ? Math.round((hadir / total) * 100) : 100;

        return {
          id: st.id,
          full_name: st.full_name,
          nis: st.nis || "-",
          hadir,
          sakit,
          izin,
          alfa,
          percentage
        };
      });

      setRekapData(computed);
    } catch (err: any) {
      console.error("Gagal memuat rekap absensi:", err);
      toast.error("Gagal memuat rekap absensi: " + err.message);
    } finally {
      setLoadingRekap(false);
    }
  };

  const exportRekapToExcel = () => {
    if (rekapData.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const selectedClass = classList.find((c) => c.id === selectedClassId);
    const className = selectedClass ? selectedClass.name : "Kelas";
    const semesterLabel = selectedSemester === "1" ? "Ganjil (1)" : "Genap (2)";
    const academicYear = selectedClass ? selectedClass.academic_year : "-";

    const formatDateId = (dateStr: string) => {
      if (!dateStr) return "-";
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
    };

    const dateRangeLabel = `Periode: ${formatDateId(startDateSem)} s.d. ${formatDateId(endDateSem)}`;

    const title = `REKAPITULASI PRESENSI SISWA PER SEMESTER`;
    const subTitle1 = `SDN 1 DUKUHWALUH`;
    const subTitle2 = `Kelas: ${className} | Semester: ${semesterLabel} | TA: ${academicYear} | ${dateRangeLabel}`;

    const data = [
      [title],
      [subTitle1],
      [subTitle2],
      [],
      ["No", "Nama Siswa", "NIS", "Hadir", "Sakit", "Izin", "Alfa", "Persentase Kehadiran"]
    ];

    rekapData.forEach((row, idx) => {
      data.push([
        String(idx + 1),
        row.full_name.toUpperCase(),
        row.nis,
        String(row.hadir),
        String(row.sakit),
        String(row.izin),
        String(row.alfa),
        `${row.percentage}%`
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }
    ];

    const headerStyle = {
      font: { name: "Times New Roman", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A8A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    };

    const rowStyle = {
      font: { name: "Times New Roman", sz: 11 },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      }
    };

    const centerStyle = {
      ...rowStyle,
      alignment: { horizontal: "center" }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || "");
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellRef];
        if (!cell) continue;

        if (r === 0) {
          cell.s = {
            font: { name: "Times New Roman", sz: 16, bold: true },
            alignment: { horizontal: "center" }
          };
        } else if (r === 1) {
          cell.s = {
            font: { name: "Times New Roman", sz: 12, bold: true },
            alignment: { horizontal: "center" }
          };
        } else if (r === 2) {
          cell.s = {
            font: { name: "Times New Roman", sz: 11, italic: true },
            alignment: { horizontal: "center" }
          };
        } else if (r === 4) {
          cell.s = headerStyle;
        } else if (r > 4) {
          if (c === 0 || c >= 3) {
            cell.s = centerStyle;
          } else {
            cell.s = rowStyle;
          }
        }
      }
    }

    ws['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 22 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Presensi");
    XLSX.writeFile(wb, `Rekap_Presensi_${className}_Semester_${selectedSemester}_${academicYear.replace("/", "-")}.xlsx`);
    toast.success("Rekap Excel berhasil diunduh!");
  };

  const exportRekapToPDF = () => {
    if (rekapData.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const selectedClass = classList.find((c) => c.id === selectedClassId);
    const className = selectedClass ? selectedClass.name : "Kelas";
    const semesterLabel = selectedSemester === "1" ? "Ganjil (1)" : "Genap (2)";
    const academicYear = selectedClass ? selectedClass.academic_year : "-";

    const formatDateId = (dateStr: string) => {
      if (!dateStr) return "-";
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
    };

    const dateRangeLabel = `Periode: ${formatDateId(startDateSem)} s.d. ${formatDateId(endDateSem)}`;

    const doc = new jsPDF();

    doc.setFont("Times", "bold");
    doc.setFontSize(16);
    doc.text("REKAPITULASI PRESENSI SISWA PER SEMESTER", 105, 15, { align: "center" });
    
    doc.setFontSize(12);
    doc.text("SDN 1 DUKUHWALUH", 105, 22, { align: "center" });

    doc.setFont("Times", "italic");
    doc.setFontSize(10);
    doc.text(`Kelas: ${className} | Semester: ${semesterLabel} | TA: ${academicYear} | ${dateRangeLabel}`, 105, 28, { align: "center" });

    const tableColumns = ["No", "Nama Siswa", "NIS", "Hadir", "Sakit", "Izin", "Alfa", "Persentase"];
    
    const tableRows = rekapData.map((row, idx) => [
      String(idx + 1),
      row.full_name.toUpperCase(),
      row.nis,
      String(row.hadir),
      String(row.sakit),
      String(row.izin),
      String(row.alfa),
      `${row.percentage}%`
    ]);

    autoTable(doc, {
      head: [tableColumns],
      body: tableRows,
      startY: 35,
      theme: "striped",
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center"
      },
      bodyStyles: {
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left" },
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "center", cellWidth: 15 },
        4: { halign: "center", cellWidth: 15 },
        5: { halign: "center", cellWidth: 15 },
        6: { halign: "center", cellWidth: 15 },
        7: { halign: "center", cellWidth: 30 }
      },
      styles: {
        font: "Times",
        fontSize: 10
      }
    });

    doc.save(`Rekap_Presensi_${className}_Semester_${selectedSemester}_${academicYear.replace("/", "-")}.pdf`);
    toast.success("Rekap PDF berhasil diunduh!");
  };

  const initializeSession = async () => {
    setLoading(true);
    try {
      // 1. Resolve logged-in user
      const demoUser = localStorage.getItem("demo_user");
      const bypass = !!demoUser;
      setIsBypassMode(bypass);

      let finalUser = propUser;
      if (!finalUser) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        finalUser = currentUser || (demoUser ? JSON.parse(demoUser) : null);
      }

      if (!finalUser) {
        toast.error("Silakan login terlebih dahulu.");
        setLoading(false);
        return;
      }
      setUser(finalUser);

      // 2. Resolve Role & Profile
      let resolvedRole = propRole || finalUser.user_metadata?.role || "guru";
      let matchedUserProfileIds: string[] = [finalUser.id];

      if (!propRole) {
        try {
          const { data: profilesById } = await supabase.from('profiles').select('id, role').eq('id', finalUser.id);
          const { data: profilesByEmail } = finalUser.email ? await supabase.from('profiles').select('id, role').eq('email', finalUser.email) : { data: [] };
          
          const uniqueProfilesMap = new Map<string, any>();
          (profilesById || []).forEach(p => uniqueProfilesMap.set(p.id, p));
          (profilesByEmail || []).forEach(p => uniqueProfilesMap.set(p.id, p));
          const matchedProfiles = Array.from(uniqueProfilesMap.values());
          
          if (matchedProfiles.length > 0) {
            matchedUserProfileIds = matchedProfiles.map(p => p.id);
            const primaryProfile = matchedProfiles.find(p => p.id === finalUser.id) || matchedProfiles[0];
            resolvedRole = primaryProfile?.role || resolvedRole;
          }
        } catch (err) {
          console.warn("Error resolving profile data in Absensi:", err);
        }
      }
      setUserRole(resolvedRole);

      const isSpecialAdmin = finalUser.email === "admin@sekolah.is" || finalUser.email === "admin@sekolah.id";
      const isAdminRole = resolvedRole === "admin" || isSpecialAdmin;

      // 3. Fetch Classes list based on Authorization criteria
      let fetchedClasses: any[] = [];
      if (isAdminRole) {
        // Admins can fetch all classes
        const { data: dataAll, error } = await supabase
          .from('classes')
          .select('*, wali:profiles(full_name)')
          .order('name');
        
        if (error) {
          // If query with wali fails due to join setup, fallback to simple select
          const { data: dataSimple } = await supabase.from('classes').select('*').order('name');
          fetchedClasses = dataSimple || [];
        } else {
          fetchedClasses = dataAll || [];
        }

        if (fetchedClasses.length === 0) {
          // Fallback to simple classes query if dataAll fails
          const { data: fallbackSimple } = await supabase.from('classes').select('*').order('name');
          fetchedClasses = fallbackSimple || [];
        }
      } else {
        // Teachers (Guru): Only their OWN classes
        // Own classes = Wali Kelas of the class OR scheduled teacher in teaching_schedules
        
        // A. Filter by scheduled teaching
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

        // B. Filter by Wali Kelas
        const { data: wkClasses } = await supabase
          .from('classes')
          .select('*')
          .in('wali_kelas_id', matchedUserProfileIds);

        // C. Fetch final information of matching classes
        let mergedClasses: any[] = [];
        const mergedClassIds = Array.from(new Set([...scheduleClassIds, ...(wkClasses || []).map(c => c.id)]));

        if (mergedClassIds.length > 0) {
          const { data: matchClasses } = await supabase
            .from('classes')
            .select('*')
            .in('id', mergedClassIds)
            .order('name');
          mergedClasses = matchClasses || [];
        }
        fetchedClasses = mergedClasses;
      }

      setClassList(fetchedClasses);
      const years = Array.from(new Set(fetchedClasses.map((c: any) => c.academic_year || "Lainnya"))).sort().reverse();
      let defaultYear = "";
      if (years.length > 0) {
        defaultYear = years[0];
        setSelectedAcademicYear(defaultYear);
      }
      if (fetchedClasses.length > 0) {
        const classesInYear = fetchedClasses.filter(c => (c.academic_year || "Lainnya") === defaultYear);
        if (classesInYear.length > 0) {
          setSelectedClassId(classesInYear[0].id);
        } else {
          setSelectedClassId(fetchedClasses[0].id);
        }
      }
    } catch (err: any) {
      console.error("Gagal inisialisasi modul absensi:", err);
      toast.error("Gagal memuat pengaturan kelas.");
    } finally {
      setLoading(false);
    }
  };

  const loadClassData = async (classId: string) => {
    try {
      // 1. Fetch Students and existing attendance records in parallel
      const [studentsRes, attendanceRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('class_id', classId)
          .order('full_name'),
        supabase
          .from('attendance')
          .select('*')
          .eq('class_id', classId)
          .eq('date', selectedDate)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      const fetchedStudents = studentsRes.data || [];
      setStudents(fetchedStudents);

      // 2. Fetch existing attendance records
      // Reset map first
      const defaultMap: Record<string, { status: string; notes: string }> = {};
      fetchedStudents.forEach((st) => {
        defaultMap[st.id] = { status: "Hadir", notes: "" }; // default status is Hadir
      });

      try {
        const dbRecords = attendanceRes.data;
        const dbError = attendanceRes.error;

        if (dbError) {
          // If table error, flag that table is missing
          if (dbError.code === "P0001" || dbError.message.includes("does not exist") || dbError.code === "42P01") {
            setDbTableExists(false);
            // Load from localStorage as fallback
            const localKey = `attendance_${classId}_${selectedDate}`;
            const cachedVal = localStorage.getItem(localKey);
            if (cachedVal) {
              const loadedMap = JSON.parse(cachedVal);
              // Merge cached results to override defaults
              Object.keys(loadedMap).forEach((studentId) => {
                if (defaultMap[studentId]) {
                  defaultMap[studentId] = loadedMap[studentId];
                }
              });
            }
          } else {
            throw dbError;
          }
        } else if (dbRecords && dbRecords.length > 0) {
          setDbTableExists(true);
          dbRecords.forEach((rec) => {
            defaultMap[rec.student_id] = {
              status: rec.status,
              notes: rec.notes || "",
            };
          });
        }
      } catch (innerErr) {
        console.warn("Table 'attendance' not fetched, using Local Storage fallback:", innerErr);
        setDbTableExists(false);
        const localKey = `attendance_${classId}_${selectedDate}`;
        const cachedVal = localStorage.getItem(localKey);
        if (cachedVal) {
          const loadedMap = JSON.parse(cachedVal);
          Object.keys(loadedMap).forEach((stId) => {
            if (defaultMap[stId]) {
              defaultMap[stId] = loadedMap[stId];
            }
          });
        }
      }

      setAttendanceMap(defaultMap);
    } catch (err: any) {
      console.error("Gagal memuat absensi kelas:", err);
      toast.error("Gagal mendapatkan daftar murid / data absensi.");
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  const handleMarkAllHadir = () => {
    const updated = { ...attendanceMap };
    students.forEach((st) => {
      if (updated[st.id]) {
        updated[st.id] = {
          ...updated[st.id],
          status: "Hadir",
        };
      }
    });
    setAttendanceMap(updated);
    toast.info("Semua murid ditandai 'Hadir'");
  };

  const handleSaveAttendance = async () => {
    if (!selectedClassId) return;
    setSaving(true);
    
    try {
      const selectedClass = classList.find((c) => c.id === selectedClassId);
      const className = selectedClass ? selectedClass.name : "Kelas";
      
      const payloadRecords = students.map((st) => {
        const att = attendanceMap[st.id] || { status: "Hadir", notes: "" };
        return {
          student_id: st.id,
          class_id: selectedClassId,
          date: selectedDate,
          status: att.status,
          notes: att.notes || null,
          teacher_id: user?.id || null,
          academic_year: selectedClass?.academic_year || "2025/2026",
        };
      });

      let savedToDb = false;

      if (dbTableExists) {
        try {
          // We can delete existing records for class and date to avoid conflicts on unique keys, then insert
          await supabase
            .from('attendance')
            .delete()
            .eq('class_id', selectedClassId)
            .eq('date', selectedDate);

          const { error: insertError } = await supabase
            .from('attendance')
            .insert(payloadRecords);

          if (insertError) {
            throw insertError;
          }
          savedToDb = true;
        } catch (dbErr: any) {
          console.warn("DB write failed, fallback to local storage:", dbErr.message);
          if (dbErr.code === "42P01" || dbErr.message?.includes("does not exist")) {
            setDbTableExists(false);
          } else {
            throw dbErr;
          }
        }
      }

      // Always backup/write to local storage for failproof recovery
      const localKey = `attendance_${selectedClassId}_${selectedDate}`;
      localStorage.setItem(localKey, JSON.stringify(attendanceMap));

      // Log sistem
      const formattedDate = new Date(selectedDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      await logActivity(
        "Mengisi Kehadiran Siswa",
        `Melakukan absensi kelas ${className} untuk tanggal ${formattedDate}. Status: ${students.length} murid terhitung.`
      );

      if (savedToDb) {
        toast.success(`Absensi ${className} berhasil disinkronkan ke cloud database!`);
      } else {
        toast.success(`Absensi ${className} disimpan lokal di browser! Hubungi Admin untuk konfigurasi PostgreSQL.`);
      }
    } catch (err: any) {
      console.error("Gagal menyimpan absensi:", err);
      toast.error(err.message || "Gagal menyimpan absensi kuisioner.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlStatement);
    toast.success("Perintah SQL berhasil disalin ke clipboard!");
  };

  // Stats calculation
  const totalStudents = students.length;
  const countHadir = students.filter((s) => (attendanceMap[s.id]?.status || "Hadir") === "Hadir").length;
  const countSakit = students.filter((s) => (attendanceMap[s.id]?.status) === "Sakit").length;
  const countIzin = students.filter((s) => (attendanceMap[s.id]?.status) === "Izin").length;
  const countAlfa = students.filter((s) => (attendanceMap[s.id]?.status) === "Alfa").length;

  const pctHadir = totalStudents > 0 ? Math.round((countHadir / totalStudents) * 100) : 0;
  const pctSakit = totalStudents > 0 ? Math.round((countSakit / totalStudents) * 100) : 0;
  const pctIzin = totalStudents > 0 ? Math.round((countIzin / totalStudents) * 100) : 0;
  const pctAlfa = totalStudents > 0 ? Math.round((countAlfa / totalStudents) * 100) : 0;

  // Semester Stats calculation
  const totalHadirSem = rekapData.reduce((acc, row) => acc + (row.hadir || 0), 0);
  const totalSakitSem = rekapData.reduce((acc, row) => acc + (row.sakit || 0), 0);
  const totalIzinSem = rekapData.reduce((acc, row) => acc + (row.izin || 0), 0);
  const totalAlfaSem = rekapData.reduce((acc, row) => acc + (row.alfa || 0), 0);
  const averagePctSem = rekapData.length > 0
    ? Math.round(rekapData.reduce((acc, row) => acc + (row.percentage || 0), 0) / rekapData.length)
    : 100;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">Memuat Modul Kelayakan Absensi Siswa...</p>
      </div>
    );
  }

  // Display label translation
  const displayRole = userRole === "admin" 
    ? "Administrator" 
    : userRole === "kepala_sekolah" 
      ? "Kepala Sekolah" 
      : "Guru Kelas / Pengajar";

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-[#0f172a] text-white rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl transform -translate-x-10 translate-y-10" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest rounded-full">
              <UserCheck size={12} className="shrink-0" />
              Presensi Siswa - {displayRole}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              Absensi Kehadiran Siswa
            </h1>
            <p className="text-slate-400 font-medium text-sm">
              Mencatat, menyinkronkan, dan merekapitulasi presensi harian siswa SDN 1 Dukuhwaluh.
            </p>
          </div>
          
          {activeTab === "input" && totalStudents > 0 && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-800/40 border border-slate-700/40 rounded-2xl shrink-0">
              <Button 
                onClick={handleMarkAllHadir}
                className="h-10 rounded-xl bg-emerald-600/25 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-600/40 text-xs font-black uppercase tracking-wide px-4"
              >
                Tandai Semua Hadir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab("input")}
          className={`pb-3 px-4 font-bold text-sm tracking-tight border-b-2 transition-all ${
            activeTab === "input"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Pencatatan Harian
        </button>
        <button
          onClick={() => {
            setActiveTab("rekap");
          }}
          className={`pb-3 px-4 font-bold text-sm tracking-tight border-b-2 transition-all ${
            activeTab === "rekap"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Rekap Semester
        </button>
      </div>

      {/* SQL Setup Fallback Alert Banner */}
      {!dbTableExists && (
        <Card className="border-amber-200 bg-amber-50/50 rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                <Info size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">INFORMASI SINKRONISASI DATABASE</h3>
                <p className="text-slate-600 text-xs font-bold leading-relaxed">
                  Tabel <code className="bg-amber-100/60 px-1.5 py-0.5 rounded font-mono text-amber-800">attendance</code> belum terdeteksi di database Supabase Anda. Untuk saat ini data absensi Anda akan disimpan secara lokal di browser ini. Agar dapat tersimpan permanen di cloud dan diakses oleh pengguna lain, silakan beralih ke editor Supabase lalu jalankan script SQL pembentuk tabel.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pl-14">
              <Button 
                variant="outline" 
                onClick={() => setShowSqlInstruction(!showSqlInstruction)}
                className="h-10 rounded-xl bg-white border-amber-200 font-bold text-xs text-amber-800 uppercase tracking-wider"
              >
                {showSqlInstruction ? "Sembunyikan SQL Setup" : "Lihat SQL Setup"}
              </Button>
              <Button 
                onClick={handleCopySql}
                className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2"
              >
                <Copy size={14} />
                Salin Script SQL
              </Button>
            </div>

            {showSqlInstruction && (
              <div className="mt-4 p-4 pl-14 bg-slate-900 rounded-2xl overflow-x-auto border border-slate-850">
                <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre leading-normal">
                  {sqlStatement}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Widget & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Class Details Filtering Card */}
        <Card className="rounded-[32px] border-slate-200/60 p-6 shadow-sm space-y-6 bg-white shrink-0">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-md font-black text-slate-900 uppercase tracking-tighter">Filter Presensi</h2>
              <p className="text-slate-500 text-[10px] font-bold">
                {activeTab === "input" ? "Pilih kelas dan tanggal presensi" : "Pilih kelas dan semester"}
              </p>
            </div>
          </div>

          {classList.length === 0 ? (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-center text-xs font-bold border border-amber-100">
              {userRole === "admin" 
                ? "Belum ada kelas aktif di sekolah ini. Silakan tambahkan kelas baru di menu Manajemen Kelas." 
                : "Anda belum dikaitkan dengan kelas mana pun di jadwal mengajar maupun wali kelas saat ini."
              }
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Tahun Ajaran</label>
                <Select 
                  value={selectedAcademicYear} 
                  onValueChange={(year) => {
                    setSelectedAcademicYear(year);
                    const filtered = classList.filter(c => (c.academic_year || "Lainnya") === year);
                    if (filtered.length > 0) {
                      setSelectedClassId(filtered[0].id);
                    } else {
                      setSelectedClassId("");
                    }
                  }}
                >
                  <SelectTrigger className="h-12 bg-slate-50/70 border-none rounded-2xl font-bold text-slate-700 text-left px-4 focus-visible:ring-blue-500">
                    <SelectValue placeholder="Pilih Tahun Ajaran" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 font-bold text-slate-600 text-sm">
                    {Array.from(new Set(classList.map((c: any) => c.academic_year || "Lainnya"))).sort().reverse().map(year => (
                      <SelectItem key={year} value={year} className="rounded-xl font-bold">
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-12 bg-slate-50/70 border-none rounded-2xl font-bold text-slate-700 text-left px-4 focus-visible:ring-blue-500">
                    <SelectValue placeholder="Pilih Kelas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 font-bold text-slate-600 text-sm">
                    {classList
                      .filter(c => (c.academic_year || "Lainnya") === selectedAcademicYear)
                      .map(cls => (
                        <SelectItem key={cls.id} value={cls.id} className="rounded-xl font-bold">
                          {cls.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {activeTab === "input" ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Absensi</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-12 bg-slate-50/70 border-none rounded-2xl font-bold text-slate-700 px-4 focus:ring-blue-500 cursor-pointer text-sm"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Semester</label>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                      <SelectTrigger className="h-12 bg-slate-50/70 border-none rounded-2xl font-bold text-slate-700 text-left px-4 focus-visible:ring-blue-500">
                        <SelectValue placeholder="Pilih Semester" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-100 font-bold text-slate-600 text-sm">
                        <SelectItem value="1" className="rounded-xl font-bold">Semester 1 (Ganjil)</SelectItem>
                        <SelectItem value="2" className="rounded-xl font-bold">Semester 2 (Genap)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Mulai</label>
                    <Input
                      type="date"
                      value={startDateSem}
                      onChange={(e) => setStartDateSem(e.target.value)}
                      className="h-12 bg-slate-50/70 border-none rounded-2xl font-bold text-slate-700 px-4 focus:ring-blue-500 cursor-pointer text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Selesai</label>
                    <Input
                      type="date"
                      value={endDateSem}
                      onChange={(e) => setEndDateSem(e.target.value)}
                      className="h-12 bg-slate-50/70 border-none rounded-2xl font-bold text-slate-700 px-4 focus:ring-blue-500 cursor-pointer text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </Card>

        {/* Attendance Statistics Display Card */}
        <Card className="rounded-[32px] border-slate-200/60 p-6 shadow-sm bg-white lg:col-span-2 flex flex-col justify-between">
          {activeTab === "input" ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                      <ClipboardCheck size={20} />
                    </div>
                    <div>
                      <h2 className="text-md font-black text-slate-900 uppercase tracking-tighter">Rekapitulasi Hari Ini</h2>
                      <p className="text-slate-500 text-[10px] font-bold">Ringkasan grafik kehadiran siswa saat ini</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-900/5 hover:bg-slate-900/10 text-slate-900 border-none font-bold text-[10px] px-3 py-1 rounded-lg">
                    Tanggal: {new Date(selectedDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                  </Badge>
                </div>

                {totalStudents === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-xs font-bold gap-2">
                    <Users size={32} className="text-slate-300" />
                    <span>Pilih kelas yang memiliki terdaftar murid aktif</span>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Visual Segmented Progress Bar */}
                    <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                      <div 
                        style={{ width: `${pctHadir}%` }} 
                        className="bg-emerald-500 transition-all duration-500" 
                        title={`Hadir: ${pctHadir}%`}
                      />
                      <div 
                        style={{ width: `${pctSakit}%` }} 
                        className="bg-amber-400 transition-all duration-500" 
                        title={`Sakit: ${pctSakit}%`}
                      />
                      <div 
                        style={{ width: `${pctIzin}%` }} 
                        className="bg-sky-400 transition-all duration-500" 
                        title={`Izin: ${pctIzin}%`}
                      />
                      <div 
                        style={{ width: `${pctAlfa}%` }} 
                        className="bg-rose-500 transition-all duration-500" 
                        title={`Alfa: ${pctAlfa}%`}
                      />
                    </div>

                    {/* Grid Numeric Representation */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Hadir</span>
                        <span className="text-xl font-black text-emerald-800 mt-1">{countHadir} Siswa</span>
                        <span className="text-[10px] font-bold text-emerald-500/80 mt-0.5">{pctHadir}% dari total</span>
                      </div>

                      <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Sakit</span>
                        <span className="text-xl font-black text-amber-800 mt-1">{countSakit} Siswa</span>
                        <span className="text-[10px] font-bold text-amber-500/80 mt-0.5">{pctSakit}% dari total</span>
                      </div>

                      <div className="p-3.5 bg-sky-50/50 rounded-2xl border border-sky-100 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-sky-600 tracking-wider">Izin</span>
                        <span className="text-xl font-black text-sky-800 mt-1">{countIzin} Siswa</span>
                        <span className="text-[10px] font-bold text-sky-500/80 mt-0.5">{pctIzin}% dari total</span>
                      </div>

                      <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-100 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-rose-600 tracking-wider">Tanpa Keterangan (Alfa)</span>
                        <span className="text-xl font-black text-rose-800 mt-1">{countAlfa} Siswa</span>
                        <span className="text-[10px] font-bold text-rose-500/80 mt-0.5">{pctAlfa}% dari total</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {totalStudents > 0 && (
                <div className="text-right text-[10px] text-slate-400 font-bold mt-4">
                  Total murid terdaftar: {totalStudents} orang. Presentase dihitung otomatis.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                      <ClipboardCheck size={20} />
                    </div>
                    <div>
                      <h2 className="text-md font-black text-slate-900 uppercase tracking-tighter">Statistik Kehadiran Semester</h2>
                      <p className="text-slate-500 text-[10px] font-bold">Ringkasan persentase kehadiran kelas semester ini</p>
                    </div>
                  </div>
                  <Badge className="bg-indigo-950/5 hover:bg-indigo-950/10 text-indigo-950 border-none font-bold text-[10px] px-3 py-1 rounded-lg">
                    Semester: {selectedSemester === "1" ? "Ganjil (1)" : "Genap (2)"}
                  </Badge>
                </div>

                {rekapData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-xs font-bold gap-2">
                    <Users size={32} className="text-slate-300" />
                    <span>Tidak ada data absensi untuk semester ini</span>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Visual Segmented Progress Bar */}
                    <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                      <div 
                        style={{ width: `${averagePctSem}%` }} 
                        className="bg-indigo-600 transition-all duration-500" 
                        title={`Rata-rata Kehadiran: ${averagePctSem}%`}
                      />
                    </div>

                    {/* Grid Numeric Representation */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col col-span-2 sm:col-span-1">
                        <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">Rata-rata</span>
                        <span className="text-xl font-black text-indigo-950 mt-1">{averagePctSem}%</span>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">Kehadiran Kelas</span>
                      </div>

                      <div className="p-3 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Hadir</span>
                        <span className="text-xl font-black text-emerald-850 mt-1">{totalHadirSem}</span>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">Total Presensi</span>
                      </div>

                      <div className="p-3 bg-amber-50/30 rounded-2xl border border-amber-100/50 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Sakit</span>
                        <span className="text-xl font-black text-amber-850 mt-1">{totalSakitSem}</span>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">Total Hari Sakit</span>
                      </div>

                      <div className="p-3 bg-sky-50/30 rounded-2xl border border-sky-100/50 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-sky-600 tracking-wider">Izin</span>
                        <span className="text-xl font-black text-sky-800 mt-1">{totalIzinSem}</span>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">Total Hari Izin</span>
                      </div>

                      <div className="p-3 bg-rose-50/30 rounded-2xl border border-rose-100/50 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-rose-600 tracking-wider">Alfa</span>
                        <span className="text-xl font-black text-rose-850 mt-1">{totalAlfaSem}</span>
                        <span className="text-[8px] font-bold text-slate-400 mt-0.5">Total Hari Alfa</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {rekapData.length > 0 && (
                <div className="text-right text-[10px] text-slate-400 font-bold mt-4">
                  Rata-rata persentase kehadiran kelas dihitung berdasarkan seluruh riwayat absensi semester berjalan.
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Main Student Attendance List Table Grid */}
      {activeTab === "input" ? (
        <Card className="rounded-[32px] border-slate-200/60 shadow-sm bg-white overflow-hidden">
          <div className="p-6 md:p-8 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold">
                {classList.find(c => c.id === selectedClassId)?.name?.charAt(0) || "K"}
              </div>
              <div>
                <h3 className="text-md font-black text-slate-900 uppercase tracking-tighter">
                  Daftar Murid Kelas: {classList.find(c => c.id === selectedClassId)?.name || "Silakan pilih kelas"}
                </h3>
                <p className="text-slate-500 text-[10px] font-bold">Semua data siswa terupdate otomatis</p>
              </div>
            </div>
          </div>

          {totalStudents === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <Users size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-md font-black text-slate-800 uppercase">Belum Ada Murid Terdaftar</h4>
                <p className="text-slate-400 text-xs font-semibold max-w-sm">
                  Silakan isi data siswa terlebih dahulu di menu Manajemen Kelas untuk kelas ini sebelum melakukan pencatatan absensi.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/40">
                  <TableRow className="border-slate-100">
                    <TableHead className="w-[60px] text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">No</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[150px]">Nama Siswa</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">NIS</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center min-w-[280px]">Status Kehadiran</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[200px]">Catatan / Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((st, index) => {
                    const currentRecord = attendanceMap[st.id] || { status: "Hadir", notes: "" };
                    
                    return (
                      <TableRow key={st.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                        <TableCell className="text-center font-mono font-bold text-xs text-slate-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-bold text-slate-800">{st.full_name}</div>
                          <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">NISN: {st.nisn || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-none font-bold text-[10px] px-2.5 py-1 rounded-md">
                            {st.nis || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex gap-2 p-1 bg-slate-100/70 border border-slate-200/50 rounded-2xl shrink-0">
                            {/* HADIR BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(st.id, "Hadir")}
                              className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                                currentRecord.status === "Hadir"
                                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-200/60 font-black"
                                  : "text-slate-500 hover:bg-white"
                              }`}
                            >
                              {currentRecord.status === "Hadir" && <Check size={14} />}
                              Hadir
                            </button>

                            {/* SAKIT BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(st.id, "Sakit")}
                              className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                                currentRecord.status === "Sakit"
                                  ? "bg-amber-400 text-slate-900 shadow-md shadow-amber-200/60 font-black"
                                  : "text-slate-500 hover:bg-white"
                              }`}
                            >
                              {currentRecord.status === "Sakit" && <Check size={14} className="text-slate-900" />}
                              Sakit
                            </button>

                            {/* IZIN BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(st.id, "Izin")}
                              className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                                currentRecord.status === "Izin"
                                  ? "bg-sky-400 text-white shadow-md shadow-sky-200/60 font-black"
                                  : "text-slate-500 hover:bg-white"
                              }`}
                            >
                              {currentRecord.status === "Izin" && <Check size={14} />}
                              Izin
                            </button>

                            {/* ALFA BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(st.id, "Alfa")}
                              className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                                currentRecord.status === "Alfa"
                                  ? "bg-rose-500 text-white shadow-md shadow-rose-200/60 font-black"
                                  : "text-slate-500 hover:bg-white"
                              }`}
                            >
                              {currentRecord.status === "Alfa" && <Check size={14} />}
                              Alfa
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Input
                            placeholder="Keterangan duka, lomba, dll (opsional)..."
                            value={currentRecord.notes}
                            onChange={(e) => handleNotesChange(st.id, e.target.value)}
                            className="h-10 bg-slate-50/50 border-slate-100 rounded-xl font-medium focus:bg-white text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalStudents > 0 && (
            <div className="p-6 md:p-8 bg-slate-50/40 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Lakukan penyimpanan setelah selesai mengubah presensi
              </span>
              <Button 
                disabled={saving}
                onClick={handleSaveAttendance}
                className="w-full sm:w-auto h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-xs text-white uppercase tracking-wider px-10 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
              >
                <Save size={16} />
                {saving ? "Menyimpan data..." : "Simpan Data Presensi"}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="rounded-[32px] border-slate-200/60 shadow-sm bg-white overflow-hidden">
          <div className="p-6 md:p-8 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-900 text-white rounded-xl flex items-center justify-center font-bold">
                {classList.find(c => c.id === selectedClassId)?.name?.charAt(0) || "K"}
              </div>
              <div>
                <h3 className="text-md font-black text-slate-900 uppercase tracking-tighter">
                  Rekap Presensi Semester: {classList.find(c => c.id === selectedClassId)?.name || "Silakan pilih kelas"}
                </h3>
                <p className="text-slate-500 text-[10px] font-bold">
                  Semester: {selectedSemester === "1" ? "Ganjil (1)" : "Genap (2)"} | TA: {classList.find(c => c.id === selectedClassId)?.academic_year || "-"}
                </p>
              </div>
            </div>

            {rekapData.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  onClick={exportRekapToExcel}
                  className="flex-1 sm:flex-none h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-xs text-white uppercase tracking-wider px-5 flex items-center justify-center gap-2 shadow-md shadow-emerald-250"
                >
                  <Download size={14} />
                  Excel
                </Button>
                <Button 
                  onClick={exportRekapToPDF}
                  className="flex-1 sm:flex-none h-12 rounded-xl bg-red-600 hover:bg-red-700 font-black text-xs text-white uppercase tracking-wider px-5 flex items-center justify-center gap-2 shadow-md shadow-red-250"
                >
                  <Download size={14} />
                  PDF
                </Button>
              </div>
            )}
          </div>

          {loadingRekap ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm font-bold animate-pulse">Memuat Rekapitulasi Presensi...</p>
            </div>
          ) : rekapData.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <Users size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-md font-black text-slate-800 uppercase">Belum Ada Riwayat Absensi</h4>
                <p className="text-slate-400 text-xs font-semibold max-w-sm">
                  Tidak ditemukan riwayat kehadiran untuk kelas ini pada semester yang dipilih.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/40">
                  <TableRow className="border-slate-100">
                    <TableHead className="w-[60px] text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">No</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[200px]">Nama Siswa</TableHead>
                    <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">NIS</TableHead>
                    <TableHead className="text-center text-[10px] font-black text-emerald-600 uppercase tracking-wider">Hadir</TableHead>
                    <TableHead className="text-center text-[10px] font-black text-amber-600 uppercase tracking-wider">Sakit</TableHead>
                    <TableHead className="text-center text-[10px] font-black text-sky-600 uppercase tracking-wider">Izin</TableHead>
                    <TableHead className="text-center text-[10px] font-black text-rose-600 uppercase tracking-wider">Alfa</TableHead>
                    <TableHead className="text-center text-[10px] font-black text-indigo-600 uppercase tracking-wider min-w-[150px]">Persentase Kehadiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekapData.map((row, index) => {
                    let badgeColor = "bg-rose-50 text-rose-700";
                    if (row.percentage >= 90) {
                      badgeColor = "bg-emerald-50 text-emerald-700";
                    } else if (row.percentage >= 80) {
                      badgeColor = "bg-amber-50 text-amber-700";
                    }
                    
                    return (
                      <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                        <TableCell className="text-center font-mono font-bold text-xs text-slate-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-4 font-bold text-slate-800 uppercase">
                          {row.full_name}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-none font-bold text-[10px] px-2.5 py-1 rounded-md">
                            {row.nis}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold text-emerald-600">{row.hadir}</TableCell>
                        <TableCell className="text-center font-bold text-amber-600">{row.sakit}</TableCell>
                        <TableCell className="text-center font-bold text-sky-600">{row.izin}</TableCell>
                        <TableCell className="text-center font-bold text-rose-600">{row.alfa}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`border-none font-black text-xs px-3 py-1 rounded-full ${badgeColor}`}>
                            {row.percentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
