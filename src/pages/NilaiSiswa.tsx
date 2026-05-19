import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  GraduationCap, 
  Search, 
  Save, 
  Calculator,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  Download
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import XLSX from "xlsx-js-style";

export default function NilaiSiswa() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classList, setClassList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [scopeName, setScopeName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"harian" | "rapor">("harian");
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, any>>({});
  const [semesterGrades, setSemesterGrades] = useState<Record<string, any>>({});
  const [userRole, setUserRole] = useState<string>("");

  const subjects = [
    "Pendidikan Pancasila",
    "Bahasa Indonesia",
    "Matematika",
    "IPAS",
    "Seni Budaya",
    "PJOK",
    "Bahasa Inggris",
    "Agama"
  ];

  useEffect(() => {
    checkUserRole();
    fetchClasses();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const role = profile?.role || user.user_metadata?.role || "guru";
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      const finalRole = isSpecialAdmin ? "admin" : role;
      setUserRole(finalRole);
      
      // If user is guru or kepala_sekolah, they CAN manage grades
      const canEdit = finalRole === "admin" || finalRole === "guru" || finalRole === "kepala_sekolah";
      if (!canEdit) {
        toast.error("Anda tidak memiliki akses untuk menginput nilai.");
      }
    }
  };

  const fetchClasses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const role = profile?.role || user.user_metadata?.role || "guru";
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      const isAdminRole = role === "admin" || isSpecialAdmin;

      let query = supabase.from('classes').select('*').order('name');
      
      if (!isAdminRole) {
        query = query.eq('wali_kelas_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClassList(data || []);
      
      // Handle URL params
      const paramClassId = searchParams.get("classId");
      const paramSubject = searchParams.get("subject");
      
      if (paramClassId) {
        // Only set if the class is actually in the visible list for this user
        if (!data?.find(c => c.id === paramClassId)) {
          if (data && data.length > 0) setSelectedClassId(data[0].id);
        } else {
          setSelectedClassId(paramClassId);
        }
      } else if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
      }

      if (paramSubject) {
        setSelectedSubject(paramSubject);
      }
    } catch (error: any) {
      toast.error("Gagal memuat kelas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      if (viewMode === "harian") {
        fetchStudentsAndGrades();
      } else {
        fetchSemesterGrades();
      }
    }
  }, [selectedClassId, selectedSubject, scopeName, viewMode]);

  const fetchSemesterGrades = async () => {
    if (!selectedClassId || !selectedSubject) return;
    setLoading(true);
    try {
      // 1. Fetch Students
      const { data: studentsData, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, nisn')
        .eq('class_id', selectedClassId)
        .order('full_name');
      
      if (studentError) throw studentError;

      // 2. Fetch all Scope Grades for this subject to calculate average formative
      const { data: harianData, error: harianError } = await supabase
        .from('student_grades')
        .select('student_id, average_score')
        .eq('class_id', selectedClassId)
        .eq('subject', selectedSubject);
      
      if (harianError) throw harianError;

      // 3. Fetch existing semester grades (UTS/UAS)
      const { data: semData, error: semError } = await supabase
        .from('semester_grades')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('subject', selectedSubject);
      
      if (semError) throw semError;

      const aggregatedGrades: Record<string, any> = {};
      studentsData?.forEach(student => {
        // Calculate average formative from all babs
        const studentHarian = harianData?.filter(h => h.student_id === student.id) || [];
        const avgFormative = studentHarian.length > 0
          ? studentHarian.reduce((acc, curr) => acc + (curr.average_score || 0), 0) / studentHarian.length
          : 0;
        
        const existingSem = semData?.find(s => s.student_id === student.id);
        aggregatedGrades[student.id] = {
          average_formative: Math.round(avgFormative * 100) / 100,
          uts: existingSem?.uts || 0,
          uas: existingSem?.uas || 0,
          final_score: existingSem?.final_score || 0,
          id: existingSem?.id
        };
        
        // Initial calc for final score if not exists
        if (!existingSem) {
           const finalScore = (aggregatedGrades[student.id].average_formative + 0 + 0) / 3;
           aggregatedGrades[student.id].final_score = Math.round(finalScore * 100) / 100;
        }
      });

      setStudents(studentsData || []);
      setSemesterGrades(aggregatedGrades);
    } catch (error: any) {
      toast.error("Gagal memuat rekap rapor: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndGrades = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      // Fetch students in class
      const { data: studentsData, error: studentError } = await supabase
        .from('students')
        .select('id, full_name, nisn')
        .eq('class_id', selectedClassId)
        .order('full_name');
      
      if (studentError) throw studentError;

      // Fetch existing grades for this scope/subject
      let gradesData: any[] = [];
      if (selectedSubject && scopeName) {
        const { data, error } = await supabase
          .from('student_grades')
          .select('*')
          .eq('class_id', selectedClassId)
          .eq('subject', selectedSubject)
          .eq('scope_name', scopeName);
        if (error) throw error;
        gradesData = data || [];
      }

      const initialGrades: Record<string, any> = {};
      studentsData?.forEach(student => {
        const existingGrade = gradesData.find(g => g.student_id === student.id);
        initialGrades[student.id] = existingGrade || {
          tp1: 0, tp2: 0, tp3: 0, tp4: 0, uts: 0, uas: 0, average_score: 0
        };
      });

      setStudents(studentsData || []);
      setGrades(initialGrades);
    } catch (error: any) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (studentId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.min(100, Math.max(0, numValue));
    
    setGrades(prev => {
      const studentGrades = { ...prev[studentId], [field]: clampedValue };
      
      // Calculate average (Summatif Bab)
      // Only average the TP scores for 'harian' mode
      const tpAvg = (studentGrades.tp1 + studentGrades.tp2 + studentGrades.tp3 + studentGrades.tp4) / 4;
      
      studentGrades.average_score = Math.round(tpAvg * 100) / 100;
      
      return { ...prev, [studentId]: studentGrades };
    });
  };

  const handleSemesterGradeChange = (studentId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.min(100, Math.max(0, numValue));
    
    setSemesterGrades(prev => {
      const sGrades = { ...prev[studentId], [field]: clampedValue };
      
      // Formula: (Avg Bab + UTS + UAS) / 3
      const finalScore = (sGrades.average_formative + sGrades.uts + sGrades.uas) / 3;
      sGrades.final_score = Math.round(finalScore * 100) / 100;
      
      return { ...prev, [studentId]: sGrades };
    });
  };

  const saveAllGrades = async () => {
    if (viewMode === "harian") {
      if (!selectedClassId || !selectedSubject || !scopeName) {
        toast.error("Pilih Kelas, Mapel, dan Lingkup Materi");
        return;
      }
    } else {
      if (!selectedClassId || !selectedSubject) {
        toast.error("Pilih Kelas dan Mapel");
        return;
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let validTeacherId = null;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
        if (profile) validTeacherId = profile.id;
      }

      const selectedClass = classList.find(c => c.id === selectedClassId);
      
      if (viewMode === "harian") {
        const payload = students.map(student => {
          const grade = grades[student.id];
          const data: any = {
            student_id: student.id,
            class_id: selectedClassId,
            subject: selectedSubject,
            scope_name: scopeName,
            tp1: grade.tp1,
            tp2: grade.tp2,
            tp3: grade.tp3,
            tp4: grade.tp4,
            average_score: grade.average_score,
            academic_year: selectedClass?.academic_year || "2025/2026",
            teacher_id: validTeacherId
          };
          if (grade.id) data.id = grade.id;
          return data;
        });

        const { error } = await supabase
          .from('student_grades')
          .upsert(payload, { onConflict: 'student_id,class_id,subject,scope_name' });

        if (error) throw error;
      } else {
        const payload = students.map(student => {
          const grade = semesterGrades[student.id];
          const data: any = {
            student_id: student.id,
            class_id: selectedClassId,
            subject: selectedSubject,
            uts: grade.uts,
            uas: grade.uas,
            average_formative: grade.average_formative,
            final_score: grade.final_score,
            academic_year: selectedClass?.academic_year || "2025/2026",
            teacher_id: validTeacherId
          };
          if (grade.id) data.id = grade.id;
          return data;
        });

        const { error } = await supabase
          .from('semester_grades')
          .upsert(payload, { onConflict: 'student_id,class_id,subject,academic_year' });

        if (error) throw error;
      }

      toast.success("Nilai berhasil disimpan!");
      if (viewMode === "harian") fetchStudentsAndGrades();
      else fetchSemesterGrades();
    } catch (error: any) {
      toast.error("Gagal menyimpan nilai: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = async () => {
    if (!selectedClassId || !selectedSubject) {
      toast.error("Pilih Kelas dan Mapel terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, full_name, nisn')
        .eq('class_id', selectedClassId)
        .order('full_name');
        
      if (!studentsData) return;

      const { data: harianData } = await supabase
        .from('student_grades')
        .select('student_id, scope_name, tp1, tp2, tp3, tp4, average_score')
        .eq('class_id', selectedClassId)
        .eq('subject', selectedSubject);

      const { data: semData } = await supabase
        .from('semester_grades')
        .select('student_id, uts, uas, final_score')
        .eq('class_id', selectedClassId)
        .eq('subject', selectedSubject);

      const selectedClass = classList.find(c => c.id === selectedClassId);
      const className = selectedClass?.name || "Kelas";
      const academicYear = selectedClass?.academic_year || "2025/2026";

      // 1. Prepare Header Structure
      const headerRow1 = ["REKAPITULASI NILAI SISWA"];
      const headerRow2 = [`Mata Pelajaran: ${selectedSubject}`];
      const headerRow3 = [`Kelas: ${className} | Tahun Ajaran: ${academicYear}`];
      const headerRow4 = [""]; // Spacer

      // Row 5: Main Category Headers
      const tableHeaderRow5 = [
        "No", "Nama Siswa", "NISN",
        "Lingkup Materi 1", "", "", "", "",
        "Lingkup Materi 2", "", "", "", "",
        "Lingkup Materi 3", "", "", "", "",
        "Lingkup Materi 4", "", "", "", "",
        "Lingkup Materi 5", "", "", "", "",
        "Penilaian Sumatif Tengah & Akhir Semester", "", "", "NILAI"
      ];

      // Row 6: Sub Headers
      const tableHeaderRow6 = [
        "", "", "",
        "TP1", "TP2", "TP3", "TP4", "AVG",
        "TP1", "TP2", "TP3", "TP4", "AVG",
        "TP1", "TP2", "TP3", "TP4", "AVG",
        "TP1", "TP2", "TP3", "TP4", "AVG",
        "TP1", "TP2", "TP3", "TP4", "AVG",
        "UTS", "UAS", "RATA LM", "RAPOR"
      ];

      // 2. Build Data Rows
      const dataRows = studentsData.map((student, index) => {
        const studentHarian = harianData?.filter(h => h.student_id === student.id) || [];
        const sGrade = semData?.find(s => s.student_id === student.id);
        
        const row = [
          index + 1,
          student.full_name,
          student.nisn || "-",
        ];

        // LM 1-5
        let totalAvgLM = 0;
        let countLM = 0;

        [1, 2, 3, 4, 5].forEach(num => {
          const scope = studentHarian.find(h => String(h.scope_name) === String(num));
          row.push(scope?.tp1 || 0);
          row.push(scope?.tp2 || 0);
          row.push(scope?.tp3 || 0);
          row.push(scope?.tp4 || 0);
          row.push(scope?.average_score || 0);

          if (scope) {
            totalAvgLM += scope.average_score || 0;
            countLM++;
          }
        });

        const finalRataLM = countLM > 0 ? Math.round(totalAvgLM / countLM) : 0;

        row.push(sGrade?.uts || 0);
        row.push(sGrade?.uas || 0);
        row.push(finalRataLM);
        row.push(sGrade?.final_score || 0);
        
        return row;
      });

      // Combine all rows
      const allRows = [
        headerRow1,
        headerRow2,
        headerRow3,
        headerRow4,
        tableHeaderRow5,
        tableHeaderRow6,
        ...dataRows
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(allRows);

      // 3. Styling
      const headerStyle = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const tableHeaderStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo 600
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };

      const cellStyle = {
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const nameCellStyle = {
        ...cellStyle,
        alignment: { horizontal: "left", vertical: "center" }
      };

      // Apply styles to headers
      // Title
      worksheet["A1"].s = headerStyle;
      worksheet["A2"].s = { ...headerStyle, font: { bold: true, size: 11 } };
      worksheet["A3"].s = { ...headerStyle, font: { bold: true, size: 11 } };

      // Table headers (Rows 5 and 6)
      for (let col = 0; col < 34; col++) {
        const cell5 = XLSX.utils.encode_cell({ r: 4, c: col });
        const cell6 = XLSX.utils.encode_cell({ r: 5, c: col });
        if (worksheet[cell5]) worksheet[cell5].s = tableHeaderStyle;
        if (worksheet[cell6]) worksheet[cell6].s = tableHeaderStyle;
      }

      // Special colors for category groups
      const lmColors = ["3B82F6", "10B981", "F59E0B", "8B5CF6", "6366F1"];
      for (let lm = 0; lm < 5; lm++) {
        for (let j = 0; j < 5; j++) {
          const col = 3 + (lm * 5) + j;
          const cell5 = XLSX.utils.encode_cell({ r: 4, c: col });
          const cell6 = XLSX.utils.encode_cell({ r: 5, c: col });
          const style = { 
            ...tableHeaderStyle, 
            fill: { fgColor: { rgb: lmColors[lm] } } 
          };
          if (worksheet[cell5]) worksheet[cell5].s = style;
          if (worksheet[cell6]) worksheet[cell6].s = style;
        }
      }

      // Semester headers color (amber)
      for (let col = 28; col < 32; col++) {
        const cell5 = XLSX.utils.encode_cell({ r: 4, c: col });
        const cell6 = XLSX.utils.encode_cell({ r: 5, c: col });
        const style = { 
          ...tableHeaderStyle, 
          fill: { fgColor: { rgb: "D97706" } } 
        };
        if (worksheet[cell5]) worksheet[cell5].s = style;
        if (worksheet[cell6]) worksheet[cell6].s = style;
      }

      // Final Rapor column color (emerald)
      const raporCol = 31;
      const cell5R = XLSX.utils.encode_cell({ r: 4, c: raporCol });
      const cell6R = XLSX.utils.encode_cell({ r: 5, c: raporCol });
      const raporStyle = { 
        ...tableHeaderStyle, 
        fill: { fgColor: { rgb: "059669" } } 
      };
      if (worksheet[cell5R]) worksheet[cell5R].s = raporStyle;
      if (worksheet[cell6R]) worksheet[cell6R].s = raporStyle;

      // Apply styles to data rows
      dataRows.forEach((row, rowIndex) => {
        const r = rowIndex + 6;
        for (let c = 0; c < row.length; c++) {
          const cell = XLSX.utils.encode_cell({ r, c });
          if (!worksheet[cell]) continue;
          
          if (c === 1) { // Name column
            worksheet[cell].s = nameCellStyle;
          } else {
            worksheet[cell].s = cellStyle;
            // Conditional formatting for grades
            const val = row[c];
            if (typeof val === "number" && c > 2) {
              if (val < 75) {
                worksheet[cell].s = { 
                  ...cellStyle, 
                  font: { color: { rgb: "EF4444" }, bold: true } 
                };
              } else if (val >= 85) {
                worksheet[cell].s = { 
                  ...cellStyle, 
                  font: { color: { rgb: "10B981" }, bold: true } 
                };
              }
            }
          }
        }
      });

      // 4. Merges
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 31 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 31 } }, // Subject
        { s: { r: 2, c: 0 }, e: { r: 2, c: 31 } }, // Class
        // Table headers merge
        { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // No
        { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // Nama
        { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // NISN
        // LM groups
        { s: { r: 4, c: 3 }, e: { r: 4, c: 7 } }, // LM 1
        { s: { r: 4, c: 8 }, e: { r: 4, c: 12 } }, // LM 2
        { s: { r: 4, c: 13 }, e: { r: 4, c: 17 } }, // LM 3
        { s: { r: 4, c: 18 }, e: { r: 4, c: 22 } }, // LM 4
        { s: { r: 4, c: 23 }, e: { r: 4, c: 27 } }, // LM 5
        // Semester & Rapor merge
        { s: { r: 4, c: 28 }, e: { r: 4, c: 31 } }, // Penilaian Semester group
      ];

      // 5. Column Widths
      const colWidths = [
        { wch: 5 }, // No
        { wch: 30 }, // Nama Siswa
        { wch: 15 }, // NISN
      ];
      for (let i = 0; i < 29; i++) colWidths.push({ wch: 8 });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Nilai");

      const fileName = `Rekap_Nilai_${selectedSubject}_${className}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Excel berhasil diekspor dengan format profesional");
    } catch (error: any) {
      toast.error("Gagal ekspor excel: " + error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getGradeColor = (score: number) => {
    if (score >= 85) return "text-emerald-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-10 pb-20 md:pb-12">
      {/* Enhanced Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">Akademik</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Input Nilai Siswa
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
            {viewMode === "harian" 
              ? "Input skor TP (Tujuan Pembelajaran) 1-4 untuk setiap Lingkup Materi. Nilai akan dirata-rata otomatis." 
              : "Finalisasi nilai dengan menginput skor UTS dan UAS. Sistem akan menghitung otomatis Nilai Rapor (Rerata Bab + UTS + UAS) / 3."}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className={`border-blue-200 text-blue-600 font-bold ${viewMode === 'harian' ? 'bg-blue-50' : 'opacity-50'}`}>
              TP: Input di Mode Harian
            </Badge>
            <Badge variant="outline" className={`border-amber-200 text-amber-600 font-bold ${viewMode === 'rapor' ? 'bg-amber-50' : 'opacity-50'}`}>
              UTS & UAS: Input di Mode Rapor
            </Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-2xl flex w-full sm:w-auto border border-slate-200/50 shadow-sm">
            <button
              onClick={() => setViewMode("harian")}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${viewMode === "harian" ? "bg-white text-blue-600 shadow-md shadow-blue-100" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"}`}
            >
              Harian / Bab
            </button>
            <button
              onClick={() => setViewMode("rapor")}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${viewMode === "rapor" ? "bg-white text-blue-600 shadow-md shadow-blue-100" : "text-slate-500 hover:text-slate-700 hover:bg-white/50"}`}
            >
              Rapor Akhir
            </button>
          </div>
        </div>
      </div>

      {/* Control & Filter Section */}
      <Card className="border-slate-100 shadow-xl shadow-slate-200/40 rounded-[32px] overflow-hidden bg-white">
        <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-3 space-y-3">
            <div className="flex items-center gap-2 ml-1">
              <div className="w-1 h-1 rounded-full bg-blue-500"></div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rombongan Belajar</label>
            </div>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 focus:ring-blue-500 transition-all">
                <SelectValue placeholder="Pilih Kelas" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                {classList.map(cls => (
                  <SelectItem key={cls.id} value={cls.id} className="font-bold py-3 px-4">{cls.name} <span className="text-[10px] text-slate-400 ml-2 font-medium">{cls.academic_year}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3 space-y-3">
             <div className="flex items-center gap-2 ml-1">
              <div className="w-1 h-1 rounded-full bg-blue-500"></div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mata Pelajaran</label>
            </div>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 focus:ring-blue-500 transition-all">
                <SelectValue placeholder="Pilih Mapel" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                {subjects.map(sub => (
                  <SelectItem key={sub} value={sub} className="font-bold py-3 px-4">{sub}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3 space-y-3">
            <div className="flex items-center gap-2 ml-1">
              <div className="w-1 h-1 rounded-full bg-blue-500"></div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {viewMode === "harian" ? "Lingkup Materi" : "Config Rapor"}
              </label>
            </div>
            {viewMode === "harian" ? (
              <Select value={scopeName} onValueChange={setScopeName}>
                <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 focus:ring-blue-500 transition-all">
                  <SelectValue placeholder="Pilih Bab" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                  {[1, 2, 3, 4, 5].map(num => (
                    <SelectItem key={num} value={String(num)} className="font-bold py-3 px-4">Lingkup Materi {num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-12 flex items-center px-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-[10px] font-black uppercase tracking-wider italic">
                AUTO-REKAP DARI SEMUA BAB
              </div>
            )}
          </div>

          <div className="md:col-span-3 flex items-center gap-3">
             <Button 
               variant="outline"
               onClick={exportToExcel}
               className="h-12 flex-1 border-slate-100 hover:border-slate-900 hover:bg-slate-50 rounded-xl font-black text-slate-600 transition-all gap-2 shadow-sm text-[10px] uppercase tracking-widest"
             >
                <Download size={16} /> Export
             </Button>
             <Button 
               onClick={saveAllGrades} 
               disabled={saving || loading || !selectedSubject || (viewMode === "harian" && !scopeName)}
               className="h-12 flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-lg shadow-blue-100 gap-2 text-[10px] uppercase tracking-widest group"
             >
               {saving ? "..." : <><Save size={16} className="group-hover:scale-110 transition-transform" /> Simpan</>}
             </Button>
          </div>
        </div>
      </Card>

      {!selectedSubject || (viewMode === "harian" && !scopeName) ? (
        <div className="py-24 bg-white border-2 border-dashed border-slate-100 rounded-[48px] flex flex-col items-center justify-center text-center p-12">
          <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mb-6">
            <AlertCircle size={48} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Konfigurasi Dibutuhkan</h3>
          <p className="text-slate-500 font-medium max-w-xs mt-2">
            Silakan lengkapi filter kelas dan mata pelajaran di atas untuk memulai penginputan nilai akademik.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="border border-slate-100 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group bg-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:opacity-100 transition-opacity opacity-0"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rerata Kolektif</span>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">
                    {students.length > 0 ? (
                      Math.round(students.reduce((acc, s) => {
                        const val = viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0);
                        return acc + val;
                      }, 0) / students.length)
                    ) : 0}
                  </p>
                  <div className="flex items-center gap-1 mt-3">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                     <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Normal Range</span>
                  </div>
                </div>
            </Card>

            <Card className="border border-slate-100 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group bg-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:opacity-100 transition-opacity opacity-0"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Skor Tertinggi</span>
                  <p className="text-4xl font-black text-emerald-600 tracking-tighter">
                    {students.length > 0 ? Math.max(...students.map(s => viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0))) : 0}
                  </p>
                  <div className="flex items-center gap-1 mt-3">
                     <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Target Tercapai</span>
                  </div>
                </div>
            </Card>

            <Card className="border border-slate-100 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group bg-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:opacity-100 transition-opacity opacity-0"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Skor Terendah</span>
                  <p className="text-4xl font-black text-red-600 tracking-tighter">
                    {students.length > 0 ? Math.min(...students.map(s => viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0))) : 0}
                  </p>
                  <div className="flex items-center gap-1 mt-3">
                     <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest">Intervensi Dibutuhkan</span>
                  </div>
                </div>
            </Card>

            <Card className="border border-slate-100 rounded-[32px] shadow-sm hover:shadow-xl transition-all duration-500 group bg-white p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-3xl -mr-12 -mt-12 group-hover:opacity-100 transition-opacity opacity-0"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Progress Kelas</span>
                  <p className="text-4xl font-black text-indigo-600 tracking-tighter">
                    {students.length > 0 ? Math.round((students.filter(s => (viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0)) > 0).length / students.length) * 100) : 0}%
                  </p>
                  <div className="flex items-center gap-1 mt-3">
                     <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">Entry Completed</span>
                  </div>
                </div>
            </Card>
          </div>

          <div className="bg-white border border-slate-100 rounded-[40px] shadow-2xl shadow-slate-200/50 overflow-hidden relative">
            <div className="overflow-x-auto">
              <Table className="min-w-full border-collapse">
                {viewMode === "harian" ? (
                  <>
                    <TableHeader className="bg-slate-900 border-b-2 border-slate-950">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[80px] h-16 font-black text-[10px] text-white uppercase tracking-[0.2em] text-center border-r border-white/5">No</TableHead>
                        <TableHead className="min-w-[250px] h-16 font-black text-[10px] text-white uppercase tracking-[0.2em] pl-10 border-r border-white/5">Profil Murid</TableHead>
                        {[1, 2, 3, 4].map(tp => (
                          <TableHead key={tp} className="w-[100px] h-16 text-center font-black text-[10px] text-white uppercase tracking-[0.2em] border-r border-white/5">TP {tp}</TableHead>
                        ))}
                        <TableHead className="w-[140px] h-16 text-center font-black text-[10px] text-white bg-blue-600 uppercase tracking-[0.2em]">RATA KELAS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, index) => {
                        const sGrade = grades[student.id] || {};
                        const avg = sGrade.average_score || 0;
                        return (
                          <TableRow key={student.id} className="group hover:bg-blue-50/40 transition-colors border-b border-slate-100 last:border-0 h-24">
                            <TableCell className="text-center font-black text-slate-300 group-hover:text-blue-500 transition-colors border-r border-slate-50">{index + 1}</TableCell>
                            <TableCell className="pl-10 border-r border-slate-50">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-600 group-hover:border-blue-100 transition-all duration-300 shadow-sm">
                                  <span className="font-black text-xs">{(student.full_name || '??').charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">NISN: {student.nisn || "-"}</span>
                                  <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">{student.full_name}</span>
                                </div>
                              </div>
                            </TableCell>
                            {[1, 2, 3, 4].map(tp => (
                              <TableCell key={tp} className="p-4 border-r border-slate-50">
                                <div className="relative group/input flex justify-center">
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={sGrade[`tp${tp}`] || ""}
                                    onChange={(e) => handleGradeChange(student.id, `tp${tp}`, e.target.value)}
                                    className="w-16 h-12 text-center bg-slate-50 border-slate-100 rounded-xl font-black focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-none px-1 text-sm border-2"
                                    placeholder="0"
                                  />
                                </div>
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-blue-50/50">
                              <div className="flex flex-col items-center gap-2">
                                <span className={`text-2xl font-black tracking-tighter transition-all ${getGradeColor(avg)} group-hover:scale-110`}>
                                  {avg}
                                </span>
                                <div className="w-12 h-1.5 bg-white rounded-full overflow-hidden border border-blue-100">
                                  <div 
                                    className={`h-full transition-all duration-500 ${avg >= 75 ? 'bg-emerald-500' : avg >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${avg}%` }}
                                  ></div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </>
                ) : (
                  <>
                    <TableHeader className="bg-slate-900 border-b-2 border-slate-950">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[80px] h-16 font-black text-[10px] text-white uppercase tracking-[0.2em] text-center border-r border-white/5">No</TableHead>
                        <TableHead className="min-w-[250px] h-16 font-black text-[10px] text-white uppercase tracking-[0.2em] pl-10 border-r border-white/5">Profil Murid</TableHead>
                        <TableHead className="w-[120px] h-16 text-center font-black text-[10px] text-white uppercase tracking-[0.2em] border-r border-white/5">RATA HARIAN</TableHead>
                        <TableHead className="w-[110px] h-16 text-center font-black text-[10px] text-amber-400 bg-white/5 uppercase tracking-[0.2em] border-r border-white/5">UTS</TableHead>
                        <TableHead className="w-[110px] h-16 text-center font-black text-[10px] text-amber-400 bg-white/5 uppercase tracking-[0.2em] border-r border-white/5">UAS</TableHead>
                        <TableHead className="w-[160px] h-16 text-center font-black text-[10px] text-white bg-emerald-600 uppercase tracking-[0.2em]">NILAI RAPOR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, index) => {
                        const semGrade = semesterGrades[student.id] || {};
                        const final = semGrade.final_score || 0;
                        return (
                          <TableRow key={student.id} className="group hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 h-24">
                            <TableCell className="text-center font-black text-slate-300 border-r border-slate-50">{index + 1}</TableCell>
                            <TableCell className="pl-10 border-r border-slate-50">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black shadow-sm uppercase">
                                  {student.full_name?.substring(0, 1) || '?'}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">ID: {student.nisn || "-"}</span>
                                  <span className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">{student.full_name}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center bg-slate-50/40 border-r border-slate-50">
                               <div className="flex flex-col items-center">
                                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Recap Bab</span>
                                  <span className="text-lg font-black text-slate-800">{semGrade.average_formative || 0}</span>
                               </div>
                            </TableCell>
                            <TableCell className="p-4 bg-amber-50/10 border-r border-slate-50">
                               <div className="flex justify-center">
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={semGrade.uts || ""}
                                    onChange={(e) => handleSemesterGradeChange(student.id, "uts", e.target.value)}
                                    className="w-16 h-12 text-center font-black border-amber-100/50 shadow-none border-2 focus:ring-2 focus:ring-amber-500 rounded-xl bg-white"
                                    placeholder="0"
                                  />
                               </div>
                            </TableCell>
                            <TableCell className="p-4 bg-amber-50/10 border-r border-slate-50">
                              <div className="flex justify-center">
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={semGrade.uas || ""}
                                    onChange={(e) => handleSemesterGradeChange(student.id, "uas", e.target.value)}
                                    className="w-16 h-12 text-center font-black border-amber-100/50 shadow-none border-2 focus:ring-2 focus:ring-amber-500 rounded-xl bg-white"
                                    placeholder="0"
                                  />
                               </div>
                            </TableCell>
                            <TableCell className="text-center bg-emerald-50/40">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className={`text-3xl font-black tracking-tighter ${getGradeColor(final)}`}>
                                  {final}
                                </span>
                                <Badge className={`${final >= 75 ? 'bg-emerald-600' : 'bg-red-600'} border-none text-[8px] font-black px-3 py-1 rounded-full text-white uppercase tracking-widest`}>
                                  {final >= 75 ? "KOMPETEN" : "REMIDIAL"}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-slate-900 border-none shadow-2xl rounded-[40px] overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px] -mr-40 -mt-40 transition-opacity opacity-50 group-hover:opacity-100 duration-700"></div>
          <CardHeader className="relative z-10 p-10 pb-4">
            <CardTitle className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Calculator size={24} className="text-blue-400" /> Insight Penilaian
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 p-10 pt-0">
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b border-white/10 pb-6">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Status Dashboard</p>
                  <p className="text-white font-bold uppercase tracking-tight">{viewMode === "harian" ? "Evaluasi Formatif" : "Evaluasi Rapor Akhir"}</p>
                </div>
                <Badge className={`${viewMode === "harian" ? "bg-blue-600" : "bg-emerald-600"} hover:opacity-80 font-black border-none px-4 py-1 rounded-lg uppercase text-[9px] tracking-widest`}>
                  {viewMode === "harian" ? "BAB MODE" : "RAPOR MODE"}
                </Badge>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">
                {viewMode === "harian" 
                  ? "Input indikator capaian TP 1-4 untuk kalkulasi otomatis nilai harian. Sistem akan memvalidasi rentang nilai 0-100 secara otomatis."
                  : "Finalisasi rekapitulasi nilai rapor dengan mengintegrasikan rata-rata seluruh bab, hasil UTS, dan UAS tahun akademik berjalan."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-xl rounded-[40px] border-l-8 border-l-blue-600 bg-white relative group overflow-hidden">
           <CardHeader className="p-10 pb-4">
              <div className="flex justify-between items-start">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div> Panduan Operasional
                </CardTitle>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300">
                  <FileSpreadsheet size={20} />
                </div>
              </div>
           </CardHeader>
           <CardContent className="p-10 pt-0 space-y-6">
              {viewMode === "harian" ? (
                <div className="space-y-5">
                  <div className="flex gap-4 items-start group/step">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-black shrink-0 border border-blue-100 group-hover/step:bg-blue-600 group-hover/step:text-white transition-all duration-300">1</div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Input Indikator</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">Masukkan skor TP 1 s/d TP 4 sesuai data penilaian otentik di kelas.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start group/step">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-black shrink-0 border border-blue-100 group-hover/step:bg-blue-600 group-hover/step:text-white transition-all duration-300">2</div>
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Sinkronisasi Data</h4>
                       <p className="text-xs text-slate-500 font-medium leading-relaxed">Gunakan tombol "Simpan" setelah pengisian selesai untuk mengupdate database pusat.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                   <div className="flex gap-4 items-start group/step">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black shrink-0 border border-indigo-100 group-hover/step:bg-indigo-600 group-hover/step:text-white transition-all duration-300">1</div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Auto-Calculation</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Sistem secara cerdas merangkum seluruh bab kompetensi dasar siswa.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start group/step">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-black shrink-0 border border-indigo-100 group-hover/step:bg-indigo-600 group-hover/step:text-white transition-all duration-300">2</div>
                    <div className="space-y-1">
                       <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Semester Finalize</h4>
                       <p className="text-xs text-slate-500 font-medium leading-relaxed">Input nilai UTS & UAS. Nilai akhir dihitung: (Rerata Bab + UTS + UAS) / 3.</p>
                    </div>
                  </div>
                </div>
              )}
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
