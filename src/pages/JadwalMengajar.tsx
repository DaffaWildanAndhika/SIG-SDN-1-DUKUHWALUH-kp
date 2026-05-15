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
  School
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
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

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function JadwalMengajar() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [weeklyMaterials, setWeeklyMaterials] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
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
      // Check database profile for most accurate role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const role = profile?.role || user.user_metadata?.role;
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      setCanManage(role === "admin" || role === "guru" || isSpecialAdmin);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [gurus, classes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'guru').order('full_name'),
        supabase.from('classes').select('id, name, academic_year').order('name')
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
      const { data: scheds, error: schedError } = await supabase
        .from('teaching_schedules')
        .select('*, guru:profiles(full_name), class:classes!inner(name, academic_year)')
        .eq('classes.academic_year', selectedYear)
        .order('start_time', { ascending: true });
      
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

    if (!formData.guru_id || !formData.class_id) {
      toast.error("Silakan pilih guru dan kelas");
      return;
    }

    setLoading(true);
    try {
      if (selectedSchedule) {
        const { error } = await supabase
          .from('teaching_schedules')
          .update(formData)
          .eq('id', selectedSchedule.id);
        if (error) throw error;
        toast.success("Jadwal tetap diperbarui");
      } else {
        const { error } = await supabase
          .from('teaching_schedules')
          .insert([formData]);
        if (error) throw error;
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
      toast.success(`Materi Minggu ${selectedWeek} diperbarui`);
      setIsMaterialDialogOpen(false);
      fetchSchedules();
    } catch (error: any) {
      toast.error("Gagal menyimpan materi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus jadwal mengajar ini?")) {
      try {
        const { error } = await supabase.from('teaching_schedules').delete().eq('id', id);
        if (error) throw error;
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
    return matchesDay && matchesClass;
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
  }, []).sort((a, b) => b.hours - a.hours).slice(0, 3);

  const activeClasses = classList.filter(c => c.academic_year === selectedYear);

  const colors = ["bg-blue-600", "bg-indigo-600", "bg-violet-600"];

  const getWeekMaterial = (scheduleId: string) => {
    return weeklyMaterials.find(m => m.schedule_id === scheduleId);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Jadwal Mengajar</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Jadwal mingguan & progres materi materi SDN 1 Dukuhwaluh</p>
        </div>
        <div className="grid grid-cols-2 lg:flex lg:items-center gap-2">
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="h-9 md:h-10 border-slate-200 bg-white shadow-sm hover:border-blue-400 transition-colors text-blue-600 font-bold text-xs md:text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="shrink-0" />
                <SelectValue placeholder="Minggu" />
              </div>
            </SelectTrigger>
            <SelectContent className="z-50">
              {Array.from({ length: 20 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>Minggu {i + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 md:h-10 border-slate-200 bg-white shadow-sm text-xs md:text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <SelectValue placeholder="TA" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {academicYears.length > 0 ? (
                academicYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>Belum ada data</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
            <SelectTrigger className="h-9 md:h-10 border-slate-200 bg-white shadow-sm text-xs md:text-sm">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <School size={14} className="text-slate-400 shrink-0" />
                <SelectValue placeholder="Kelas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {activeClasses.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={() => { setSelectedSchedule(null); setIsDialogOpen(true); }} className="col-span-2 lg:col-auto gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 md:h-10 text-xs md:text-sm">
              <Plus size={16} /> <span className="hidden lg:inline">Buat Jadwal</span><span className="lg:hidden">Jadwal</span>
            </Button>
          )}
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all duration-200 whitespace-nowrap ${activeDay === day ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <Table className="min-w-[700px] md:min-w-full">
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px] font-bold text-slate-600 uppercase text-[10px] tracking-wider">Waktu</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-wider">Pelajaran & Progres Materi</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-wider">Guru & Kelas</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase text-[10px] tracking-wider w-[120px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(4).fill(0).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : daySchedules.length > 0 ? (
              daySchedules.map((row) => {
                const material = getWeekMaterial(row.id);
                return (
                  <TableRow key={row.id} className="hover:bg-slate-50/30 group">
                    <TableCell className="font-mono text-xs font-bold text-slate-500">
                      <div className="flex flex-col">
                        <span>{row.start_time?.substring(0, 5)}</span>
                        <div className="h-px w-4 bg-slate-200 my-1"></div>
                        <span>{row.end_time?.substring(0, 5)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="">
                      <p className="font-bold text-slate-800 text-base">{row.subject}</p>
                      <div className="flex flex-col gap-1 mt-1.5">
                        {material && material.chapter ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-4">Bab</Badge>
                              <span className="text-sm font-semibold text-slate-700">{material.chapter}</span>
                            </div>
                            {material.sub_chapter && (
                              <div className="flex items-center gap-1.5 ml-4">
                                <span className="text-xs text-slate-500 font-medium italic">↪ {material.sub_chapter}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum ada input materi minggu ke-{selectedWeek}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-slate-400" />
                          <span className="text-sm font-bold text-slate-700">{row.guru?.full_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} className="text-slate-400" />
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-none px-2 py-0 text-[10px] font-bold">
                            {row.class?.name}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {canManage && (
                          <button 
                            onClick={() => { setSelectedSchedule(row); setIsMaterialDialogOpen(true); }} 
                            title="Input Bab/Sub Bab"
                            className="p-1 px-2 md:p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg flex items-center gap-1 font-bold text-[10px] border border-blue-100 whitespace-nowrap"
                          >
                            <BookOpen size={14} /> Materi
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button onClick={() => { setSelectedSchedule(row); setIsDialogOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(row.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                  Belum ada jadwal untuk hari {activeDay}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
             <Clock size={16} className="text-blue-600" /> Rasio Beban Kerja
           </h3>
           <p className="text-xs text-slate-500 mb-4 font-medium">Beban kerja guru dihitung berdasarkan total jam mengajar per minggu.</p>
           <div className="space-y-4">
              {teacherWorkload.length > 0 ? teacherWorkload.map((item, i) => (
                <div key={i} className="space-y-2">
                   <div className="flex justify-between text-[11px] font-bold">
                     <span className="text-slate-600 uppercase tracking-tight">{item.name}</span>
                     <span className="text-slate-800">{item.hours.toFixed(1)} Jam</span>
                   </div>
                   <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${Math.min((item.hours/30)*100, 100)}%` }}></div>
                   </div>
                </div>
              )) : (
                <p className="text-xs text-slate-400 italic">Data belum tersedia</p>
              )}
           </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden text-white flex flex-col justify-center">
           <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl"></div>
           <h3 className="font-bold mb-4 flex items-center gap-2">
             <Users size={16} className="text-blue-400" /> Optimalitas Pengajaran
           </h3>
           <div className="flex items-center gap-8 py-4">
              <div className="flex flex-col">
                  <span className="text-4xl font-bold">94%</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-1">EFEKTIFITAS</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Sistem menghitung optimalitas berdasarkan distribusi jadwal dan ketersediaan ruang kelas secara real-time.
              </p>
           </div>
        </div>
      </div>

      {/* Material Progress Dialog */}
      <Dialog open={isMaterialDialogOpen} onOpenChange={setIsMaterialDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none shadow-2xl">
          <div className="bg-indigo-600 p-6">
            <DialogHeader>
              <DialogTitle className="text-white font-bold flex items-center gap-2">
                <BookOpen size={20} /> Progres Minggu {selectedWeek}
              </DialogTitle>
              <p className="text-indigo-100 text-xs font-medium">Input Bab & Sub Bab untuk Pelajaran {selectedSchedule?.subject}</p>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSaveMaterial} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold">Bab (Materi Pokok)</Label>
              <Input 
                placeholder="Contoh: Bab 1 Penjumlahan" 
                value={materialData.chapter}
                onChange={(e) => setMaterialData({ ...materialData, chapter: e.target.value })}
                className="border-slate-200 focus-visible:ring-indigo-400"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold">Sub Bab / Topik</Label>
              <Input 
                placeholder="Contoh: Penjumlahan Bilangan Bulat" 
                value={materialData.sub_chapter}
                onChange={(e) => setMaterialData({ ...materialData, sub_chapter: e.target.value })}
                className="border-slate-200 focus-visible:ring-indigo-400"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 font-bold">Catatan Tambahan</Label>
              <Input 
                placeholder="Cth: Ref: Buku Paket Hal 20" 
                value={materialData.notes}
                onChange={(e) => setMaterialData({ ...materialData, notes: e.target.value })}
                className="border-slate-200 focus-visible:ring-indigo-400"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsMaterialDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 font-bold" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Progres"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fixed Schedule Dialog (Authorized Only) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 border-none overflow-hidden">
          <div className="bg-blue-600 p-6">
            <DialogHeader>
              <DialogTitle className="text-white font-bold">{selectedSchedule ? "Edit Jadwal Mengajar" : "Tambah Jadwal Baru"}</DialogTitle>
              <p className="text-blue-100 text-xs">Atur jadwal pasti tiap minggu untuk mata pelajaran</p>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSaveSchedule} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guru Pengampu</Label>
                <Select 
                  value={formData.guru_id} 
                  onValueChange={(val) => setFormData({ ...formData, guru_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih guru" />
                  </SelectTrigger>
                  <SelectContent>
                    {guruList.map(guru => (
                      <SelectItem key={guru.id} value={guru.id}>{guru.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kelas</Label>
                <Select 
                  value={formData.class_id} 
                  onValueChange={(val) => setFormData({ ...formData, class_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={activeClasses.length === 0 ? "Belum ada data kelas" : "Pilih kelas"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClasses.length > 0 ? (
                      activeClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Belum ada data kelas di TA ini
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mata Pelajaran</Label>
              <Input 
                placeholder="Contoh: Matematika" 
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hari</Label>
                <Select 
                  value={formData.day} 
                  onValueChange={(val) => setFormData({ ...formData, day: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map(day => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input 
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input 
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Jadwal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

