import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  Filter,
  Edit2,
  Trash2,
  MoreVertical,
  CalendarCheck,
  ChevronRight,
  UserCircle,
  Layout,
  ArrowRight
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function JadwalPiket() {
  const [selectedDay, setSelectedDay] = useState("Senin");
  const [piketList, setPiketList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPiket, setSelectedPiket] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    guru_id: "",
    day: "",
    picket_date: "",
    shift: "Pagi",
    location: ""
  });

  useEffect(() => {
    checkUserRole();
    fetchGurus();
    fetchPiketSchedules();
  }, [selectedDay]);

  useEffect(() => {
    if (selectedPiket) {
      setFormData({
        guru_id: selectedPiket.guru_id || "",
        day: selectedPiket.day || "Senin",
        picket_date: selectedPiket.picket_date || "",
        shift: selectedPiket.shift || "Pagi",
        location: selectedPiket.location || ""
      });
    } else {
      setFormData({
        guru_id: "",
        day: "",
        picket_date: "",
        shift: "Pagi",
        location: ""
      });
    }
  }, [selectedPiket, isDialogOpen]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      const role = profile?.role || user.user_metadata?.role;
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      setCanManage(role === "admin" || isSpecialAdmin);
    }
  };

  const fetchGurus = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'guru').order('full_name');
    setGuruList(data || []);
  };

  const fetchPiketSchedules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('picket_schedules')
        .select('*, guru:profiles(full_name)')
        .eq('day', selectedDay)
        .order('shift');
      
      if (error) throw error;
      setPiketList(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat jadwal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.guru_id || formData.guru_id === "") {
      toast.error("Silakan pilih guru terlebih dahulu");
      return;
    }

    if (!formData.picket_date) {
      toast.error("Silakan tentukan atau pilih tanggal piket terlebih dahulu");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...formData };
      
      // Fetch teacher name for descriptive logs
      const { data: teacherProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', formData.guru_id)
        .single();
      const teacherName = teacherProfile?.full_name || "Guru";

      if (selectedPiket) {
        const { error } = await supabase
          .from('picket_schedules')
          .update(payload)
          .eq('id', selectedPiket.id);
        if (error) throw error;
        await logActivity(
          "Mengubah Jadwal Piket", 
          `Mengubah jadwal piket guru ${teacherName} pada hari ${payload.day} (${payload.shift}) di ${payload.location || '-'}`,
          selectedPiket,
          payload
        );
        toast.success("Jadwal piket diperbarui");
      } else {
        const { error } = await supabase
          .from('picket_schedules')
          .insert([payload]);
        if (error) throw error;
        await logActivity("Menambahkan Jadwal Piket", `Menambah jadwal piket guru ${teacherName} pada hari ${payload.day} (${payload.shift}) di ${payload.location || '-'}`);
        toast.success("Jadwal piket ditambahkan");
      }
      setIsDialogOpen(false);
      fetchPiketSchedules();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus jadwal ini?")) {
      try {
        // Fetch schedule detail first to know who it belongs to for the log
        const { data: scheduleData } = await supabase
          .from('picket_schedules')
          .select('day, shift, profiles(full_name)')
          .eq('id', id)
          .single();

        const { error } = await supabase.from('picket_schedules').delete().eq('id', id);
        if (error) throw error;

        const teacherName = (scheduleData as any)?.profiles?.full_name || "Guru";
        const day = scheduleData?.day || "";
        const shift = scheduleData?.shift || "";
        await logActivity("Menghapus Jadwal Piket", `Menghapus jadwal piket guru ${teacherName} pada hari ${day} (${shift})`);

        toast.success("Jadwal dihapus");
        fetchPiketSchedules();
      } catch (error: any) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  return (
    <div className="space-y-10 pb-20 md:pb-12">
      {/* Enhanced Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-[2px] bg-indigo-600 rounded-full"></span>
            <span className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">Manajemen Operasional</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Jadwal Piket Guru
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
            Sistem monitoring penugasan harian personil sekolah. Pastikan kehadiran dan pengawasan pada titik-titik krusial di lingkungan sekolah.
          </p>
        </div>
        {canManage && (
          <Button 
            onClick={() => { setSelectedPiket(null); setIsDialogOpen(true); }} 
            className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-100 rounded-2xl transition-all flex items-center gap-3 group"
          >
            <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-180 transition-transform duration-500">
              <Plus size={20} />
            </div>
            <span className="uppercase text-[10px] tracking-widest">Tambah Penugasan</span>
          </Button>
        )}
      </div>

      {/* Control Surface: Day Selection */}
      <section className="bg-white border border-slate-100 p-2 rounded-[32px] shadow-2xl shadow-slate-200/50 flex flex-wrap md:flex-nowrap gap-2">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-500 relative group overflow-hidden ${
              selectedDay === day 
                ? 'text-white' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {selectedDay === day && (
              <motion.div 
                layoutId="activeDay"
                className="absolute inset-0 bg-indigo-600 shadow-lg shadow-indigo-200"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{day}</span>
          </button>
        ))}
      </section>

      {/* Main Grid: Schedule Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-white rounded-[40px] border border-slate-50 h-72 animate-pulse overflow-hidden">
                <div className="h-2 w-full bg-slate-100"></div>
                <div className="p-8 space-y-4">
                  <div className="w-20 h-6 bg-slate-50 rounded-lg"></div>
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl"></div>
                    <div className="flex-1 space-y-2 mt-2">
                      <div className="w-full h-4 bg-slate-50 rounded"></div>
                      <div className="w-2/3 h-3 bg-slate-50 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : piketList.length > 0 ? (
            piketList.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1, type: "spring", damping: 20 }}
              >
                <Card className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-indigo-200/30 transition-all duration-500 group overflow-hidden flex flex-col h-full relative">
                  <div className={`h-2 w-full absolute top-0 left-0 transition-all duration-500 group-hover:h-3 ${
                    item.shift === 'Pagi' ? 'bg-indigo-600' : 'bg-amber-500'
                  }`}></div>
                  
                  <CardHeader className="p-10 pb-4 relative">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Waktu Tugas</span>
                        <Badge className={`${
                          item.shift === 'Pagi' 
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100' 
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                          } font-black uppercase tracking-widest text-[9px] px-4 py-1.5 rounded-full border shadow-sm block w-fit`}>
                           SHIFT {item.shift}
                        </Badge>
                      </div>
                      
                      {canManage && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 duration-500">
                          <button 
                            onClick={() => { setSelectedPiket(item); setIsDialogOpen(true); }} 
                            className="h-10 w-10 flex items-center justify-center bg-white shadow-xl text-slate-400 hover:text-indigo-600 rounded-2xl hover:scale-110 transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)} 
                            className="h-10 w-10 flex items-center justify-center bg-white shadow-xl text-slate-400 hover:text-red-500 rounded-2xl hover:scale-110 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-5">
                      <div className={`h-16 w-16 rounded-[24px] flex items-center justify-center font-black text-xl shadow-2xl transition-transform duration-500 group-hover:rotate-6 ${
                        item.shift === 'Pagi' 
                          ? 'bg-indigo-600 text-white shadow-indigo-200' 
                          : 'bg-amber-500 text-white shadow-amber-200'
                      }`}>
                        {item.guru?.full_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {item.guru?.full_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                           <div className={`w-1.5 h-1.5 rounded-full ${item.shift === 'Pagi' ? 'bg-indigo-500' : 'bg-amber-500'} animate-pulse`}></div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Petugas Aktif</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-10 pt-6 flex-1 bg-slate-50/30">
                    <div className="grid grid-cols-1 gap-6 relative">
                      <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-slate-200"></div>
                      
                      <div className="flex items-center gap-5 relative z-10">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors duration-500">
                          <MapPin size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Lokasi & Pos Jaga</p>
                          <p className="text-sm font-black text-slate-700 truncate">{item.location}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 relative z-10">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors duration-500">
                          <Clock size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Durasi Tugas</p>
                          <p className="text-sm font-black text-slate-700 italic">
                            {item.shift === 'Pagi' ? '07:30 — 09:00 WIB' : '13:00 — 14:30 WIB'}
                          </p>
                        </div>
                      </div>

                      {item.picket_date && (
                        <div className="flex items-center gap-5 relative z-10">
                          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors duration-500">
                            <CalendarIcon size={18} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tanggal Piket</p>
                            <p className="text-sm font-black text-slate-700">
                              {new Date(item.picket_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-5 relative z-10">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-amber-600 transition-colors duration-500">
                          <CalendarCheck size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Kehadiran</p>
                          <span className="text-[10px] font-black px-3 py-1 bg-white border border-slate-100 rounded-full text-slate-400 group-hover:border-emerald-200 group-hover:text-emerald-600 transition-all duration-500">
                            TERJADWAL
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-32 bg-white border-2 border-dashed border-slate-100 rounded-[64px] flex flex-col items-center justify-center text-center p-12">
              <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mb-8 transform hover:scale-110 transition-transform duration-500">
                <CalendarCheck size={56} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Tidak Ada Penugasan</h3>
              <p className="text-slate-500 font-medium max-w-xs mt-3 leading-relaxed">
                Belum ada personil yang ditugaskan untuk hari <span className="text-indigo-600 font-black">{selectedDay}</span>.
              </p>
              {canManage && (
                <Button 
                  variant="outline" 
                  className="mt-10 rounded-2xl font-black h-14 px-10 border-slate-100 hover:border-indigo-600 hover:text-indigo-600 transition-all gap-2 uppercase text-[10px] tracking-widest" 
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus size={18} /> Buat Jadwal Baru
                </Button>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Info Card Section */}
      <Card className="bg-slate-900 border-none shadow-2xl rounded-[48px] overflow-hidden relative group mt-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] -mr-48 -mt-48 transition-opacity opacity-50 group-hover:opacity-100 duration-700"></div>
        <CardContent className="p-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Layout size={24} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Protokol Kedisiplinan Piket</h2>
              </div>
              <p className="text-slate-400 font-medium text-lg leading-relaxed">
                Tugas piket adalah tanggung jawab kolektif. Setiap petugas diwajibkan untuk hadir 15 menit sebelum shift dimulai dan melakukan serah terima tugas pada pergantian shift.
              </p>
            </div>
            <div className="flex items-center justify-end">
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-[32px] border border-white/10 w-full text-center hover:bg-white/10 transition-colors duration-500 cursor-default">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Total Petugas Hari Ini</p>
                  <p className="text-6xl font-black text-white tracking-tighter">{piketList.length}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4">Personil Terdaftar</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[550px] p-0 border-none shadow-2xl rounded-[40px] overflow-hidden overflow-y-auto max-h-[90vh] custom-scrollbar bg-white">
          <div className="bg-slate-900 p-10 text-white relative overflow-hidden shrink-0">
             <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600 rounded-full blur-[120px] opacity-20 -mr-40 -mt-40"></div>
             <div className="flex items-center gap-6 relative z-10">
               <div className="w-16 h-16 rounded-[24px] bg-indigo-600/20 border border-white/10 flex items-center justify-center shadow-inner">
                  <CalendarIcon size={32} className="text-indigo-400" />
               </div>
               <div>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight uppercase">
                      {selectedPiket ? "Update Penugasan" : "Penugasan Baru"}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                      <DialogDescription className="text-slate-400 font-black text-[10px] uppercase tracking-widest">
                        Konfigurasi Jadwal Operasional Sekolah
                      </DialogDescription>
                    </div>
                  </DialogHeader>
               </div>
             </div>
          </div>
          
          <form onSubmit={handleSave} className="bg-white">
            <div className="p-10 space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-1 h-1 rounded-full bg-indigo-600"></div>
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pilih Petugas Guru</Label>
                </div>
                <Select 
                  value={formData.guru_id} 
                  onValueChange={(val) => setFormData({ ...formData, guru_id: val })}
                >
                  <SelectTrigger className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-black text-slate-700 px-6 focus:ring-indigo-500 transition-all">
                    <SelectValue placeholder="Cari nama guru..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                    {guruList.map(guru => (
                      <SelectItem key={guru.id} value={guru.id} className="font-black py-3.5 px-6">{guru.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tanggal Spesifik (Wajib) - Guide natural flow */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tanggal Piket (Wajib)</Label>
                </div>
                <Input 
                  type="date"
                  className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-black text-indigo-600 px-6 focus:ring-indigo-500 transition-all cursor-pointer"
                  value={formData.picket_date}
                  required
                  onChange={(e) => {
                    const dateVal = e.target.value;
                    if (dateVal) {
                      // Safe timezone-independent local day parsing
                      const [year, month, day] = dateVal.split("-").map(Number);
                      const localDate = new Date(year, month - 1, day);
                      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                      const selectedDayName = dayNames[localDate.getDay()];
                      
                      if (selectedDayName === "Minggu") {
                        toast.error("Hari Minggu adalah hari libur sekolah. Silakan pilih tanggal lain.");
                        setFormData({ ...formData, picket_date: "", day: "" });
                      } else {
                        setFormData({ ...formData, picket_date: dateVal, day: selectedDayName });
                        toast.success(`Hari otomatis diatur ke: ${selectedDayName}`);
                      }
                    } else {
                      setFormData({ ...formData, picket_date: dateVal, day: "" });
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <div className="flex items-center gap-2 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hari Piket</Label>
                  </div>
                  <Select 
                    value={formData.day} 
                    onValueChange={(val) => setFormData({ ...formData, day: val })}
                    disabled={true}
                  >
                    <SelectTrigger className={`h-14 rounded-2xl font-black px-6 bg-slate-100 border-slate-200 cursor-not-allowed ${formData.picket_date ? 'text-slate-800' : 'text-slate-400'}`}>
                      <SelectValue placeholder="Pilih tanggal terlebih dahulu" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {DAYS.map(day => (
                        <SelectItem key={day} value={day} className="font-black py-3 px-6">{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.picket_date ? (
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider block ml-1 bg-indigo-50 px-2 py-1 rounded w-fit">
                      ⚡ Diatur otomatis berdasarkan tanggal
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block ml-1 bg-amber-50 px-2 py-1 rounded w-fit animate-pulse">
                      ⚠️ Silakan pilih tanggal di atas terlebih dahulu
                    </span>
                  )}
                </div>
                <div className="space-y-4">
                   <div className="flex items-center gap-2 ml-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Waktu Shift</Label>
                  </div>
                  <Select 
                    value={formData.shift} 
                    onValueChange={(val) => setFormData({ ...formData, shift: val })}
                  >
                    <SelectTrigger className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-black text-slate-700 px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="Pagi" className="font-black py-3 px-6 text-indigo-600 uppercase text-[10px]">PAGI (06:30 - 13:00)</SelectItem>
                      <SelectItem value="Siang" className="font-black py-3 px-6 text-amber-600 uppercase text-[10px]">SIANG (13:00 - 16:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-2 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Lokasi Spesifik / Pos Jaga</Label>
                </div>
                <Input 
                  placeholder="Contoh: Gerbang Utama, Hall A, Kantin..." 
                  className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-black px-6 focus:ring-indigo-500 transition-all text-sm"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="p-10 bg-slate-50 flex items-center justify-end gap-5 border-t border-slate-100 shrink-0">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsDialogOpen(false)} 
                className="h-14 px-8 font-black text-slate-400 hover:text-slate-900 rounded-2xl uppercase text-[10px] tracking-widest"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                className="h-14 px-12 bg-slate-900 hover:bg-black text-white font-black shadow-2xl rounded-2xl transition-all uppercase text-[10px] tracking-[0.2em]" 
                disabled={loading}
              >
                {loading ? "Processing..." : "Konfirmasi Tugas"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
