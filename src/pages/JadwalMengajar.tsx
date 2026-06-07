import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2,
  CalendarDays,
  Search,
  School,
  ArrowRight,
  UserCircle,
  Layout,
  ChevronRight
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { logActivity } from "@/lib/activityLogger";
import { GraduationCap } from "lucide-react";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function JadwalMengajar() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [weeklyMaterials, setWeeklyMaterials] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [selectedGuruFilter, setSelectedGuruFilter] = useState<string>("all");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("");
  const [canManage, setCanManage] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [activeDay, setActiveDay] = useState("Senin");
  const [selectedWeek, setSelectedWeek] = useState<string>("1");

  // Fixed Schedule Form State
  const [formData, setFormData] = useState({
    guru_id: "",
    class_id: "",
    subject: "",
    day: "Senin",
    start_time: "07:30",
    end_time: "08:30"
  });

  // Weekly Material Form State
  const [materialData, setMaterialData] = useState({
    chapter: "",
    sub_chapter: "",
    notes: ""
  });

  useEffect(() => {
    checkUserRole();
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      fetchSchedules();
    }
  }, [selectedYear, selectedWeek]);

  useEffect(() => {
    if (selectedSchedule && isDialogOpen) {
      setFormData({
        guru_id: selectedSchedule.guru_id || "",
        class_id: selectedSchedule.class_id || "",
        subject: selectedSchedule.subject || "",
        day: selectedSchedule.day || "Senin",
        start_time: selectedSchedule.start_time?.substring(0, 5) || "07:30",
        end_time: selectedSchedule.end_time?.substring(0, 5) || "08:30"
      });
    } else if (!isDialogOpen) {
      setFormData({
        guru_id: "",
        class_id: "",
        subject: "",
        day: activeDay,
        start_time: "07:30",
        end_time: "08:30"
      });
    }
  }, [selectedSchedule, isDialogOpen]);

  useEffect(() => {
    if (selectedSchedule && isMaterialDialogOpen) {
      const material = weeklyMaterials.find(m => m.schedule_id === selectedSchedule.id);
      setMaterialData({
        chapter: material?.chapter || "",
        sub_chapter: material?.sub_chapter || "",
        notes: material?.notes || ""
      });
    }
  }, [selectedSchedule, isMaterialDialogOpen]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      // Check database profile for most accurate role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();
      
      const role = profile?.role || user.user_metadata?.role || "guru";
      setUserRole(role);
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      const isAdminRole = role === "admin" || isSpecialAdmin;
      
      // Allow manage if admin, special admin, or guru
      setCanManage(isAdminRole || role === "guru");
      
      // If teacher, default filter to self
      if (role === "guru" && !isAdminRole) {
        setSelectedGuruFilter(user.id);
      }
    }
  };

  const fetchInitialData = async () => {
    try {
      const [gurus, classes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'guru').order('full_name'),
        supabase.from('classes').select('id, name, academic_year, wali_kelas_id').order('name')
      ]);
      
      if (gurus.error) throw gurus.error;
      if (classes.error) throw classes.error;

      setGuruList(gurus.data || []);
      const classesData = classes.data || [];
      setClassList(classesData);
      
      const years = Array.from(new Set(classesData.map(c => c.academic_year)))
        .filter((y): y is string => !!y)
        .sort()
        .reverse();
      setAcademicYears(years);
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0]);
      } else if (years.length === 0) {
        setSelectedYear("");
      }
    } catch (error: any) {
      console.error("Error fetching initial data:", error);
      toast.error("Gagal memuat data pendukung: " + error.message);
    }
  };

  const fetchSchedules = async () => {
    if (!selectedYear) return;
    setLoading(true);
    try {
      // 1. Fetch Fixed Schedules for the year
      // We use !inner hint to allow filtering on the joined table
      let query = supabase
        .from('teaching_schedules')
        .select('*, guru:profiles(full_name), class:classes!inner(name, academic_year)')
        .eq('classes.academic_year', selectedYear);

      // Role-based filtering
      const isAdmin = userRole === "admin" || currentUser?.email?.includes("admin@sekolah");
      
      if (!isAdmin || selectedGuruFilter !== "all") {
        query = query.eq('guru_id', isAdmin ? selectedGuruFilter : currentUser?.id);
      }

      const { data: scheds, error: schedError } = await query.order('start_time', { ascending: true });
      
      if (schedError) throw schedError;
      setSchedules(scheds || []);

      // 2. Fetch Weekly Materials for the selected week
      if (scheds && scheds.length > 0) {
        const schedIds = scheds.map(s => s.id);
        const { data: materials, error: matError } = await supabase
          .from('lesson_materials')
          .select('*')
          .in('schedule_id', schedIds)
          .eq('week_number', parseInt(selectedWeek));
        
        if (matError) throw matError;
        setWeeklyMaterials(materials || []);
      } else {
        setWeeklyMaterials([]);
      }
    } catch (error: any) {
      toast.error("Gagal memuat jadwal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    const isAdmin = userRole === "admin" || currentUser?.email?.includes("admin@sekolah");
    const finalGuruId = isAdmin ? formData.guru_id : currentUser?.id;

    if (!finalGuruId || !formData.class_id) {
      toast.error("Silakan pilih guru dan kelas");
      return;
    }

    if (!isAdmin) {
      const selectedCls = classList.find(c => c.id === formData.class_id);
      if (!selectedCls || selectedCls.wali_kelas_id !== currentUser?.id) {
        toast.error("Anda hanya dapat menambahkan jadwal mengajar untuk kelas di mana Anda terdaftar sebagai Wali Kelas.");
        return;
      }
    }

    setLoading(true);
    try {
      // Check for overlaps
      const { data: conflicts, error: checkError } = await supabase
        .from('teaching_schedules')
        .select('id, subject, start_time, end_time, class:classes(name)')
        .eq('guru_id', finalGuruId)
        .eq('day', formData.day);

      if (checkError) throw checkError;

      const hasOverlap = conflicts?.some(conflict => {
        // Skip current schedule if editing
        if (selectedSchedule && conflict.id === selectedSchedule.id) return false;

        const startA = formData.start_time;
        const endA = formData.end_time;
        const startB = conflict.start_time.substring(0, 5);
        const endB = conflict.end_time.substring(0, 5);
        
        // Overlap logic: (StartA < EndB) AND (EndA > StartB)
        return startA < endB && endA > startB;
      });

      if (hasOverlap) {
        const conflict = conflicts?.find(c => {
          if (selectedSchedule && c.id === selectedSchedule.id) return false;
          return formData.start_time < c.end_time.substring(0, 5) && formData.end_time > c.start_time.substring(0, 5);
        });
        const conflictClassName = Array.isArray(conflict?.class) ? (conflict.class as any)[0]?.name : (conflict?.class as any)?.name;
        toast.error(`Bentrok Jadwal! Anda sudah memiliki jadwal Mengajar ${conflict?.subject} di kelas ${conflictClassName || "Lain"} pada jam tersebut.`);
        setLoading(false);
        return;
      }

      const payload = { 
        ...formData, 
        guru_id: finalGuruId 
      };

      // Fetch teacher and class names for descriptive logs
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', finalGuruId)
        .single();
      const { data: classData } = await supabase
        .from('classes')
        .select('name')
        .eq('id', formData.class_id)
        .single();

      const teacherName = teacherProfile?.full_name || "Guru";
      const className = classData?.name || "Kelas";

      if (selectedSchedule) {
        const { error } = await supabase
          .from('teaching_schedules')
          .update(payload)
          .eq('id', selectedSchedule.id);
        if (error) throw error;
        await logActivity(
          "Mengubah Jadwal Mengajar", 
          `Mengubah jadwal mengajar ${teacherName} di ${className} pelajaran ${payload.subject} hari ${payload.day} pukul ${payload.start_time}-${payload.end_time}`,
          selectedSchedule,
          payload
        );
        toast.success("Jadwal tetap diperbarui");
      } else {
        const { error } = await supabase
          .from('teaching_schedules')
          .insert([payload]);
        if (error) throw error;
        await logActivity("Menambahkan Jadwal Mengajar", `Menambah jadwal mengajar baru untuk ${teacherName} di ${className} pelajaran ${payload.subject} hari ${payload.day} pukul ${payload.start_time}-${payload.end_time}`);
        toast.success("Jadwal tetap ditambahkan");
      }
      setIsDialogOpen(false);
      fetchSchedules();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;

    setLoading(true);
    try {
      const payload = {
        schedule_id: selectedSchedule.id,
        week_number: parseInt(selectedWeek),
        ...materialData
      };

      const { error } = await supabase
        .from('lesson_materials')
        .upsert(payload, { onConflict: 'schedule_id,week_number' });

      if (error) throw error;
      await logActivity("Mengisi Progres Materi", `Mengisi materi mengajar Minggu ${selectedWeek} untuk pelajaran ${selectedSchedule.subject} (Bab: ${materialData.chapter || '-'}, Sub-Bab: ${materialData.sub_chapter || '-'})`);
      toast.success(`Materi Minggu ${selectedWeek} diperbarui`);
      setIsMaterialDialogOpen(false);
      fetchSchedules();
    } catch (error: any) {
      toast.error("Gagal menyimpan materi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkFill = async () => {
    if (schedules.length === 0) {
      toast.error("Tidak ada jadwal yang tersedia untuk diproses");
      return;
    }

    if (!confirm("Otomatis lengkapi data jadwal untuk seluruh 20 minggu berdasarkan mata pelajaran saat ini?")) {
      return;
    }

    setLoading(true);
    try {
      const payloads: any[] = [];
      schedules.forEach(sched => {
        for (let i = 1; i <= 20; i++) {
          payloads.push({
            schedule_id: sched.id,
            week_number: i,
            chapter: "Jadwal Terdaftar",
            sub_chapter: sched.subject,
            notes: "Diisi secara otomatis"
          });
        }
      });

      // Split into batches to avoid large payload errors
      const batchSize = 100;
      for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);
        const { error } = await supabase
          .from('lesson_materials')
          .upsert(batch, { onConflict: 'schedule_id,week_number' });
        if (error) throw error;
      }

      await logActivity("Pengisian Otomatis Progres Mengajar", "Mengisi otomatis progres mengajar 20 minggu untuk seluruh jadwal");
      toast.success("Jadwal 20 minggu berhasil diisi secara otomatis!");
      fetchSchedules();
    } catch (error: any) {
      toast.error("Gagal mengisi otomatis: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleBulkFill = async (schedId: string, subject: string) => {
    if (!confirm(`Otomatis lengkapi data progres mengajar untuk seluruh 20 minggu pada mata pelajaran "${subject}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const payloads: any[] = [];
      for (let i = 1; i <= 20; i++) {
        payloads.push({
          schedule_id: schedId,
          week_number: i,
          chapter: "Jadwal Terdaftar",
          sub_chapter: subject,
          notes: "Diisi secara otomatis"
        });
      }

      const { error } = await supabase
        .from('lesson_materials')
        .upsert(payloads, { onConflict: 'schedule_id,week_number' });

      if (error) throw error;

      await logActivity("Pengisian Otomatis Progres Mengajar", `Mengisi otomatis progres mengajar 20 minggu untuk pelajaran ${subject}`);
      toast.success(`Jadwal 20 minggu untuk "${subject}" berhasil diisi secara otomatis!`);
      fetchSchedules();
    } catch (error: any) {
      toast.error("Gagal mengisi otomatis: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus jadwal mengajar ini?")) {
      try {
        // Fetch details before delete
        const { data: schedData } = await supabase
          .from('teaching_schedules')
          .select('subject, day, profiles(full_name)')
          .eq('id', id)
          .single();

        const { error } = await supabase.from('teaching_schedules').delete().eq('id', id);
        if (error) throw error;

        const teacherName = (schedData as any)?.profiles?.full_name || "Guru";
        const subject = schedData?.subject || "Pelajaran";
        const day = schedData?.day || "";
        await logActivity("Menghapus Jadwal Mengajar", `Menghapus jadwal mengajar ${teacherName} pelajaran ${subject} pada hari ${day}`);

        toast.success("Jadwal dihapus");
        fetchSchedules();
      } catch (error: any) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  const daySchedules = schedules.filter(s => {
    const matchesDay = s.day === activeDay;
    const matchesClass = selectedClassFilter === "all" || s.class_id === selectedClassFilter;
    const matchesSubject = !selectedSubjectFilter || s.subject.toLowerCase().includes(selectedSubjectFilter.toLowerCase());
    return matchesDay && matchesClass && matchesSubject;
  });

  // Calculate teacher workload
  const teacherWorkload = schedules.reduce((acc: any[], curr) => {
    const guruName = curr.guru?.full_name || "Unknown";
    const startTime = new Date(`1970-01-01T${curr.start_time}`);
    const endTime = new Date(`1970-01-01T${curr.end_time}`);
    const diffHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    const existing = acc.find(a => a.name === guruName);
    if (existing) {
      existing.hours += diffHours;
    } else {
      acc.push({ name: guruName, hours: diffHours });
    }
    return acc;
  }, []).sort((a, b) => b.hours - a.hours);

  const activeClasses = classList.filter(c => c.academic_year === selectedYear);

  const isUserAdmin = userRole === "admin" || currentUser?.email?.includes("admin@sekolah");
  const dialogClasses = isUserAdmin 
    ? activeClasses 
    : activeClasses.filter(c => c.wali_kelas_id === currentUser?.id);

  const colors = ["bg-blue-600", "bg-indigo-600", "bg-violet-600"];

  const getWeekMaterial = (scheduleId: string) => {
    return weeklyMaterials.find(m => m.schedule_id === scheduleId);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">
              {userRole === "admin" ? "Administrasi" : "Jadwal Saya"}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {userRole === "admin" ? "Manajemen Jadwal" : "Jadwal Mengajar"}
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Monitoring kegiatan belajar mengajar <span className="text-slate-900 font-bold">SDN 1 Dukuhwaluh</span>.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {(userRole === "admin" || currentUser?.email?.includes("admin@sekolah")) && (
            <div className="flex items-center gap-3 w-full">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Cari Mata Pelajaran..."
                    value={selectedSubjectFilter}
                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                    className="h-12 pl-10 bg-white border-slate-100 rounded-xl font-bold text-sm shadow-sm focus:ring-blue-500"
                  />
               </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-100 shadow-sm w-full md:w-auto">
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="h-10 w-[140px] border-none bg-transparent font-black text-blue-600 text-xs uppercase tracking-wider focus:ring-0">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="shrink-0" />
                  <SelectValue placeholder="Minggu" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                {Array.from({ length: 20 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="font-bold py-2.5">Minggu {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="w-[1px] h-6 bg-slate-100"></div>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-10 w-[120px] border-none bg-transparent font-bold text-slate-600 text-xs focus:ring-0">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <SelectValue placeholder="TA" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100">
                {academicYears.length > 0 ? (
                  academicYears.map(year => (
                    <SelectItem key={year} value={year} className="font-bold">{year}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Belum ada data</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
              <SelectTrigger className="h-12 w-full md:w-[160px] bg-white border-slate-100 rounded-xl font-bold text-slate-600 px-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <School size={16} className="text-slate-300" />
                  <SelectValue placeholder="Semua Kelas" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100">
                <SelectItem value="all" className="font-bold">Semua Kelas</SelectItem>
                {dialogClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id} className="font-bold">{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(userRole === "admin" || currentUser?.email?.includes("admin@sekolah")) && (
              <Select value={selectedGuruFilter} onValueChange={setSelectedGuruFilter}>
                <SelectTrigger className="h-12 w-full md:w-[180px] bg-white border-slate-100 rounded-xl font-bold text-slate-600 px-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <UserCircle size={16} className="text-slate-300" />
                    <SelectValue placeholder="Semua Guru" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100">
                  <SelectItem value="all" className="font-bold">Semua Guru</SelectItem>
                  {guruList.map(guru => (
                    <SelectItem key={guru.id} value={guru.id} className="font-bold text-xs">{guru.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}



            <Button 
                onClick={() => { setSelectedSchedule(null); setIsDialogOpen(true); }} 
                className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 rounded-xl transition-all flex items-center gap-2 group flex-1 md:flex-none"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                <span>{userRole === "admin" ? "Jadwal" : "Sesi KBM"}</span>
              </Button>
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div className="bg-white p-2 border border-slate-100 rounded-2xl shadow-sm flex overflow-x-auto gap-1 custom-scrollbar">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
              activeDay === day 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="border-collapse border-b-2 border-slate-900">
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-transparent border-b-2 border-slate-900">
                <TableHead className="w-[120px] h-14 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] pl-8 border-r-2 border-slate-900">Waktu</TableHead>
                <TableHead className="h-14 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-r-2 border-slate-900">Pelajaran & Materi</TableHead>
                <TableHead className="h-14 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-r-2 border-slate-900">Guru & Kelas</TableHead>
                <TableHead className="w-[150px] h-14 text-right pr-8 text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="border-b-2 border-slate-900">
                      <TableCell className="pl-8 py-6 border-r-2 border-slate-900"><div className="h-10 w-20 bg-slate-50 rounded-xl animate-pulse" /></TableCell>
                      <TableCell className="border-r-2 border-slate-900"><div className="space-y-2"><div className="h-4 w-48 bg-slate-50 rounded animate-pulse" /><div className="h-3 w-32 bg-slate-50 rounded animate-pulse" /></div></TableCell>
                      <TableCell className="border-r-2 border-slate-900"><div className="h-4 w-32 bg-slate-50 rounded animate-pulse" /></TableCell>
                      <TableCell className="pr-8"><div className="h-9 w-9 bg-slate-50 rounded-lg float-right animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : daySchedules.length > 0 ? (
                  daySchedules.map((row, index) => {
                    const material = getWeekMaterial(row.id);
                    return (
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        key={row.id} 
                        className="group hover:bg-blue-50/30 transition-colors border-b-2 border-slate-900 last:border-b-0"
                      >
                        <TableCell className="pl-8 py-5 border-r-2 border-slate-900">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock size={12} className="text-blue-500" />
                              <span className="text-sm font-black text-slate-900 tracking-tight">{row.start_time?.substring(0, 5)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-[1px] bg-slate-400 ml-1.5"></div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{row.end_time?.substring(0, 5)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="border-r-2 border-slate-900">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-lg tracking-tight group-hover:text-blue-600 transition-colors uppercase">
                                {row.subject}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2">
                              {material && material.chapter ? (
                                <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-2 max-w-sm">
                                  <div className="flex items-center gap-2">
                                    <div className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-black uppercase tracking-[0.2em]">
                                      Materi Pokok
                                    </div>
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{material.chapter}</span>
                                  </div>
                                  {material.sub_chapter && (
                                    <div className="flex items-start gap-2 pl-2 border-l-2 border-blue-200 ml-1">
                                      <span className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                                        "{material.sub_chapter}"
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 py-1 px-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 w-fit">
                                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] italic">Progres Materi Kosong</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="border-r-2 border-slate-900">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200/50 shadow-inner">
                                <UserCircle size={20} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Guru Pengampu</span>
                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{row.guru?.full_name}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200/50 shadow-inner">
                                <School size={20} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Lokasi Kelas</span>
                                <Badge className="bg-slate-900 border-none px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-md shadow-sm w-fit">
                                  {row.class?.name}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex flex-col items-end gap-2">
                            {canManage && (
                              <div className="flex flex-col gap-2 w-full md:w-32">
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSelectedSchedule(row); setIsMaterialDialogOpen(true); }} 
                                  className="h-9 px-4 border-blue-200 hover:border-blue-600 text-blue-600 hover:bg-blue-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all w-full shadow-sm"
                                >
                                  <BookOpen size={14} className="mr-2" /> Input Materi
                                </Button>
                                <Link to={`/nilai?classId=${row.class_id}&subject=${encodeURIComponent(row.subject)}`} className="w-full">
                                  <Button 
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-4 border-indigo-200 hover:border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all w-full shadow-sm"
                                  >
                                    <GraduationCap size={14} className="mr-2" /> Input Nilai
                                  </Button>
                                </Link>
                              </div>
                            )}
                            {canManage && (
                              <div className="flex items-center gap-1.5 w-full md:w-32 justify-end">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => { setSelectedSchedule(row); setIsDialogOpen(true); }}
                                  className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-transparent hover:border-indigo-100"
                                >
                                  <Edit2 size={16} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDelete(row.id)} 
                                  className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-80 text-center">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center gap-4 text-slate-300 max-w-xs mx-auto"
                      >
                        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center">
                          <CalendarDays size={40} className="text-slate-200" />
                        </div>
                        <div>
                          <p className="text-slate-900 font-bold">Jadwal Kosong</p>
                          <p className="text-sm font-medium mt-1">Tidak ada kegiatan mengajar yang terdaftar untuk hari {activeDay}.</p>
                        </div>
                        {canManage && (
                          <Button variant="outline" className="mt-2 rounded-xl h-10 px-6 font-bold" onClick={() => setIsDialogOpen(true)}>
                            Atur Jadwal Baru
                          </Button>
                        )}
                      </motion.div>
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
        <div className="p-6 bg-slate-50/30 border-t border-slate-50">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center">
            Total Sesi: <span className="text-blue-600">{daySchedules.length}</span> Sesi Aktif di Hari {activeDay}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl shadow-slate-200/40">
           <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Clock size={20} />
              </div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">Pemuatan Personil</h3>
           </div>
           
           <div className="space-y-6">
              {teacherWorkload.length > 0 ? teacherWorkload.map((item, i) => (
                <div key={i} className="space-y-3 group">
                   <div className="flex justify-between items-end">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nama Guru</span>
                        <span className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.name}</span>
                     </div>
                     <div className="text-right">
                        <span className="text-xs font-black text-slate-900">{item.hours.toFixed(1)}</span>
                        <span className="text-[10px] font-black text-slate-400 ml-1 uppercase">Jam / Mgg</span>
                     </div>
                   </div>
                   <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((item.hours/30)*100, 100)}%` }}
                        className={`h-full ${colors[i % colors.length]} rounded-full shadow-inner`}
                      ></motion.div>
                   </div>
                </div>
              )) : (
                <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Belum ada statistik pemuatan</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Material Progress Dialog */}
      <Dialog open={isMaterialDialogOpen} onOpenChange={setIsMaterialDialogOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 border-none shadow-2xl rounded-[32px] overflow-hidden">
          <div className="bg-[#4f46e5] p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">Progres Materi</DialogTitle>
                  <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">Minggu ke-{selectedWeek} • {selectedSchedule?.subject}</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSaveMaterial} className="p-8 space-y-6 bg-white">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bab / Materi Pokok</Label>
                <Input 
                  placeholder="Contoh: Bab 1 Operasi Hitung" 
                  value={materialData.chapter}
                  onChange={(e) => setMaterialData({ ...materialData, chapter: e.target.value })}
                  className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold focus-visible:ring-indigo-500 px-4"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub Bab / Topik Detail</Label>
                <Input 
                  placeholder="Contoh: Penjumlahan Bilangan Bulat" 
                  value={materialData.sub_chapter}
                  onChange={(e) => setMaterialData({ ...materialData, sub_chapter: e.target.value })}
                  className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold focus-visible:ring-indigo-500 px-4"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan Tambahan</Label>
                <Input 
                  placeholder="Opsional: Referensi halaman atau catatan" 
                  value={materialData.notes}
                  onChange={(e) => setMaterialData({ ...materialData, notes: e.target.value })}
                  className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold focus-visible:ring-indigo-500 px-4"
                />
              </div>
            </div>

            <DialogFooter className="gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsMaterialDialogOpen(false)} className="h-12 rounded-xl font-bold text-slate-400">
                Batal
              </Button>
              <Button type="submit" className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-100 transition-all flex-1 md:flex-none" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Menyimpan...</span>
                  </div>
                ) : "Simpan Progres"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fixed Schedule Dialog (Authorized Only) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-2xl rounded-[32px] overflow-hidden">
          <div className="bg-blue-600 p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">
                    {selectedSchedule ? "Perbarui Jadwal" : "Konfigurasi Jadwal"}
                  </DialogTitle>
                  <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Pengaturan Rutinitas KBM Mingguan</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSaveSchedule} className="p-8 space-y-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guru Pengampu</Label>
                {userRole === "admin" || currentUser?.email?.includes("admin@sekolah") ? (
                  <Select 
                    value={formData.guru_id} 
                    onValueChange={(val) => setFormData({ ...formData, guru_id: val })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 focus:ring-blue-500">
                      <SelectValue placeholder="Pilih Guru" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                      {guruList.map(guru => (
                        <SelectItem key={guru.id} value={guru.id} className="font-bold py-3">{guru.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center px-4 font-black text-slate-400 text-sm italic uppercase tracking-wider">
                    {guruList.find(g => g.id === currentUser?.id)?.full_name || "Data Guru Anda"}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Kelas</Label>
                <Select 
                  value={formData.class_id} 
                  onValueChange={(val) => setFormData({ ...formData, class_id: val })}
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 focus:ring-blue-500">
                    <SelectValue placeholder={dialogClasses.length === 0 ? (isUserAdmin ? "Belum ada data" : "Anda bukan Wali Kelas") : "Pilih Kelas"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    {dialogClasses.length > 0 ? (
                      dialogClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id} className="font-bold py-3">{cls.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled className="font-bold text-slate-400">
                        {isUserAdmin ? "Belum ada data kelas" : "Anda bukan Wali Kelas di kelas manapun"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Mata Pelajaran</Label>
              <Input 
                placeholder="Contoh: Ilmu Pengetahuan Alam" 
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold px-4 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hari</Label>
                <Select 
                  value={formData.day} 
                  onValueChange={(val) => setFormData({ ...formData, day: val })}
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold focus:ring-blue-500">
                    <div className="flex items-center gap-2">
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    {DAYS.map(day => (
                      <SelectItem key={day} value={day} className="font-bold">{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mulai</Label>
                <Input 
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                  className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selesai</Label>
                <Input 
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                  className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold focus:ring-blue-500"
                />
              </div>
            </div>

            <DialogFooter className="gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 rounded-xl font-bold text-slate-400">
                Tutup
              </Button>
              <Button type="submit" className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-100 transition-all flex-1" disabled={loading}>
                {loading ? "Proses..." : (selectedSchedule ? "Simpan Perubahan" : "Konfirmasi Jadwal")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

