import React, { useState, useEffect } from "react";
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
      // First check metadata
      const metaRole = user.user_metadata?.role || "";
      setUserRole(metaRole);
      
      // Verification against profiles table to avoid FK issues
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setUserRole(profile.role);
      }
    }
  };

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('name');
      if (error) throw error;
      setClassList(data || []);
      if (data && data.length > 0) {
        setSelectedClassId(data[0].id);
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <GraduationCap className="text-blue-600" /> Input Nilai Siswa
          </h1>
          <p className="text-sm text-slate-500">
            {viewMode === "harian" 
              ? "Input nilai per Lingkup Materi (Bab) dengan 4 TP" 
              : "Rekap Nilai Rapor (Rata-rata Bab + UTS + UAS)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button
              onClick={() => setViewMode("harian")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "harian" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Harian / Bab
            </button>
            <button
              onClick={() => setViewMode("rapor")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "rapor" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Rapor Akhir
            </button>
          </div>
          <Button 
            variant="outline"
            onClick={exportToExcel}
            className="border-blue-200 text-blue-600 hover:bg-blue-50 gap-2 font-bold"
          >
             <Download size={16} /> Ekspor Excel
          </Button>
          <Button 
            onClick={saveAllGrades} 
            disabled={saving || loading || !selectedSubject || (viewMode === "harian" && !scopeName)}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 gap-2"
          >
            {saving ? "Menyimpan..." : <><Save size={16} /> Simpan Semua Nilai</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Pilih Kelas</label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="bg-white border-slate-200">
              <SelectValue placeholder="Pilih Kelas" />
            </SelectTrigger>
            <SelectContent>
              {classList.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name} ({cls.academic_year})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">Mata Pelajaran</label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="bg-white border-slate-200">
              <SelectValue placeholder="Pilih Mapel" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(sub => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">
            {viewMode === "harian" ? "Lingkup Materi" : "Keterangan"}
          </label>
          {viewMode === "harian" ? (
            <Select value={scopeName} onValueChange={setScopeName}>
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue placeholder="Pilih Lingkup" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(num => (
                  <SelectItem key={num} value={String(num)}>Lingkup Materi {num}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md text-slate-400 text-sm font-medium italic">
              Otomatis menghitung rata-rata dari semua Bab
            </div>
          )}
        </div>
      </div>

      {!selectedSubject || (viewMode === "harian" && !scopeName) ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
            <AlertCircle size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">
              Silakan pilih Mata Pelajaran {viewMode === "harian" && "dan isi Lingkup Materi"} terlebih dahulu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="bg-white border-slate-200 shadow-sm border-b-4 border-b-blue-600">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rerata Kelas</p>
                  <p className="text-2xl font-black text-slate-800">
                    {students.length > 0 ? (
                      Math.round(students.reduce((acc, s) => {
                        const val = viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0);
                        return acc + val;
                      }, 0) / students.length)
                    ) : 0}
                  </p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                  <Calculator size={16} />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm border-b-4 border-b-emerald-600">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nilai Tertinggi</p>
                  <p className="text-2xl font-black text-emerald-600">
                    {students.length > 0 ? Math.max(...students.map(s => viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0))) : 0}
                  </p>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                  <ChevronRight size={16} className="-rotate-90" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm border-b-4 border-b-amber-600">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nilai Terendah</p>
                  <p className="text-2xl font-black text-amber-600">
                    {students.length > 0 ? Math.min(...students.map(s => viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0))) : 0}
                  </p>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm border-b-4 border-b-indigo-600">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partisipasi</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-black text-indigo-600">
                      {students.length > 0 ? Math.round((students.filter(s => (viewMode === "harian" ? (grades[s.id]?.average_score || 0) : (semesterGrades[s.id]?.final_score || 0)) > 0).length / students.length) * 100) : 0}%
                    </p>
                  </div>
                </div>
                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                  <GraduationCap size={16} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                {viewMode === "harian" ? (
                  <>
                    <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="w-[50px] font-bold text-slate-600 text-center">No</TableHead>
                        <TableHead className="min-w-[200px] font-bold text-slate-600">Nama Murid</TableHead>
                        <TableHead className="w-[90px] text-center font-bold text-slate-600">TP 1</TableHead>
                        <TableHead className="w-[90px] text-center font-bold text-slate-600">TP 2</TableHead>
                        <TableHead className="w-[90px] text-center font-bold text-slate-600">TP 3</TableHead>
                        <TableHead className="w-[90px] text-center font-bold text-slate-600">TP 4</TableHead>
                        <TableHead className="w-[120px] text-center font-bold bg-blue-50/50 text-blue-700">RERATA BAB</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, index) => {
                        const sGrade = grades[student.id] || {};
                        const avg = sGrade.average_score || 0;
                        return (
                          <TableRow key={student.id} className="hover:bg-slate-50/80 transition-colors border-slate-100 group">
                            <TableCell className="text-center font-bold text-slate-300 group-hover:text-blue-400 transition-colors">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[10px] shrink-0 border border-blue-100">
                                  {student.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-slate-800 truncate">{student.full_name}</span>
                                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">NISN: {student.nisn || "-"}</span>
                                </div>
                              </div>
                            </TableCell>
                            {[1, 2, 3, 4].map(tp => (
                              <TableCell key={tp} className="p-2">
                                <div className="relative group/input">
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={sGrade[`tp${tp}`] || ""}
                                    onChange={(e) => handleGradeChange(student.id, `tp${tp}`, e.target.value)}
                                    className="text-center h-10 bg-white border-slate-200 focus:border-blue-400 focus:ring-blue-100 font-medium transition-all shadow-none"
                                    placeholder="0"
                                  />
                                  <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-blue-500 transition-all group-focus-within/input:w-full"></div>
                                </div>
                              </TableCell>
                            ))}
                            <TableCell className="text-center bg-blue-50/20 border-l border-blue-100">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-lg font-black tracking-tight ${getGradeColor(avg)}`}>
                                  {avg}
                                </span>
                                <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
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
                    <TableHeader className="bg-slate-50/80 sticky top-0 z-10 shadow-sm">
                      <TableRow className="border-b border-slate-200">
                        <TableHead className="w-[50px] font-bold text-slate-600 text-center">No</TableHead>
                        <TableHead className="min-w-[200px] font-bold text-slate-600">Nama Murid</TableHead>
                        <TableHead className="w-[120px] text-center font-bold text-slate-600">Rerata Bab</TableHead>
                        <TableHead className="w-[110px] text-center font-bold text-amber-700 bg-amber-50/50">UTS</TableHead>
                        <TableHead className="w-[110px] text-center font-bold text-amber-700 bg-amber-50/50">UAS</TableHead>
                        <TableHead className="w-[140px] text-center font-bold text-emerald-700 bg-emerald-50/50">NILAI RAPOR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, index) => {
                        const semGrade = semesterGrades[student.id] || {};
                        const final = semGrade.final_score || 0;
                        return (
                          <TableRow key={student.id} className="hover:bg-slate-50/80 transition-colors border-slate-100 group">
                            <TableCell className="text-center font-medium text-slate-300">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px] shrink-0 border border-indigo-100">
                                  {student.full_name.substring(0, 1).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800">{student.full_name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">ID: {student.nisn || "-"}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center bg-slate-50/30">
                              <Badge variant="secondary" className="bg-white border-slate-200 text-slate-700 font-bold">
                                {semGrade.average_formative || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="p-2 bg-amber-50/10 border-l border-amber-100">
                              <Input 
                                type="number"
                                min="0"
                                max="100"
                                value={semGrade.uts || ""}
                                onChange={(e) => handleSemesterGradeChange(student.id, "uts", e.target.value)}
                                className="text-center h-10 font-bold border-amber-100 focus:border-amber-400 focus:ring-amber-100 bg-white shadow-sm"
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="p-2 bg-amber-50/10">
                              <Input 
                                type="number"
                                min="0"
                                max="100"
                                value={semGrade.uas || ""}
                                onChange={(e) => handleSemesterGradeChange(student.id, "uas", e.target.value)}
                                className="text-center h-10 font-bold border-amber-100 focus:border-amber-400 focus:ring-amber-100 bg-white shadow-sm"
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="text-center bg-emerald-50/20 border-l border-emerald-100">
                              <div className="flex flex-col items-center justify-center">
                                <span className={`text-2xl font-black tracking-tighter ${getGradeColor(final)}`}>
                                  {final}
                                </span>
                                <Badge className={`${final >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} border-none text-[8px] font-bold py-1 h-auto`}>
                                  {final >= 75 ? "LULUS" : "REMIDI"}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </>
                )}
                {students.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-slate-400 italic font-medium bg-slate-50">
                      Tidak ada data murid yang ditemukan untuk kelas ini
                    </TableCell>
                  </TableRow>
                )}
              </Table>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calculator size={20} className="text-blue-400" /> Analisis Nilai {viewMode === "harian" ? "Bab" : "Rapor"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/10 pb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Status Pengisian</p>
                  <p className="text-white font-medium">{viewMode === "harian" ? "Input Formatif" : "Siap Rapor"}</p>
                </div>
                <Badge className={`${viewMode === "harian" ? "bg-blue-500" : "bg-emerald-500"} hover:opacity-80 font-bold border-none`}>
                  {viewMode === "harian" ? "MODE BAB" : "MODE RAPOR"}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                {viewMode === "harian" 
                  ? "Input TP 1-4 untuk menghitung nilai rata-rata per lingkup materi (Formatif/Sumatif Bab)."
                  : "Finalisasi nilai rapor dengan menggabungkan rata-rata harian, UTS, dan UAS menggunakan bobot Kurikulum Merdeka."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm border-l-4 border-l-blue-600">
           <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-bold text-slate-600 group flex items-center gap-1">
                  PANDUAN INPUT <ChevronRight size={14} className="text-slate-400" />
                </CardTitle>
                <FileSpreadsheet size={16} className="text-slate-200" />
              </div>
           </CardHeader>
           <CardContent className="space-y-3">
              {viewMode === "harian" ? (
                <>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                    <p className="text-xs text-slate-600">Isi TP 1 sampai TP 4 sesuai capaian pembelajaran per bab.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                    <p className="text-xs text-slate-600">Tekan "Simpan" untuk menyimpan nilai formatif bab ini.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                    <p className="text-xs text-slate-600 font-medium text-slate-800">Sistem otomatis mengambil rata-rata dari semua Bab yang sudah diinput.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                    <p className="text-xs text-slate-600">Input nilai UTS dan UAS untuk mendapatkan Nilai Akhir Rapor.</p>
                  </div>
                </>
              )}
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
