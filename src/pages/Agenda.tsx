import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  MapPin, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Info,
  CalendarDays,
  Target
} from "lucide-react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from "date-fns";
import { id } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Agenda() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendas, setAgendas] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "08:00",
    end_time: "10:00",
    location: "",
    category: "Agenda Sekolah"
  });

  useEffect(() => {
    checkUserRole();
    fetchAgendas();
  }, [currentDate]);

  useEffect(() => {
    if (selectedAgenda) {
      setFormData({
        title: selectedAgenda.title || "",
        description: selectedAgenda.description || "",
        event_date: selectedAgenda.event_date || format(new Date(), "yyyy-MM-dd"),
        start_time: selectedAgenda.start_time || "08:00",
        end_time: selectedAgenda.end_time || "10:00",
        location: selectedAgenda.location || "",
        category: selectedAgenda.category || "Agenda Sekolah"
      });
    } else {
      setFormData({
        title: "",
        description: "",
        event_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: "08:00",
        end_time: "10:00",
        location: "",
        category: "Agenda Sekolah"
      });
    }
  }, [selectedAgenda, isDialogOpen, selectedDate]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const role = user.user_metadata?.role;
      const isAdminEmail = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      setIsAdmin(role === "admin" || isAdminEmail);
    }
  };

  const fetchAgendas = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
      const end = format(endOfMonth(currentDate), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      setAgendas(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat agenda: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi berakhir, silakan login kembali");

      // Verify profile exists to avoid FK constraint error
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      let validCreatorId = null;
      if (profile) {
        validCreatorId = user.id;
      } else if (isAdmin) {
        // If admin but no profile, try to create one on the fly
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ 
            id: user.id, 
            full_name: user.user_metadata?.full_name || "Administrator",
            role: "admin",
            email: user.email
          }]);
        
        if (!insertError) validCreatorId = user.id;
      }

      const payload: any = {
        title: formData.title,
        description: formData.description,
        event_date: formData.event_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        location: formData.location,
        category: formData.category,
        creator_id: validCreatorId
      };

      if (selectedAgenda) {
        const { error } = await supabase
          .from('agendas')
          .update(payload)
          .eq('id', selectedAgenda.id);
        if (error) throw error;
        toast.success("Agenda berhasil diperbarui");
      } else {
        const { error } = await supabase
          .from('agendas')
          .insert([payload]);
        if (error) throw error;
        toast.success("Agenda baru berhasil ditambahkan");
      }
      setIsDialogOpen(false);
      fetchAgendas();
    } catch (error: any) {
      toast.error("Gagal menyimpan agenda: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus agenda ini?")) {
      try {
        const { error } = await supabase.from('agendas').delete().eq('id', id);
        if (error) throw error;
        toast.success("Agenda berhasil dihapus");
        fetchAgendas();
      } catch (error: any) {
        toast.error("Gagal menghapus agenda: " + error.message);
      }
    }
  };

  // Calendar Logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const agendasOnSelectedDate = agendas.filter(a => isSameDay(parseISO(a.event_date), selectedDate));

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">Kalender Pendidikan</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4 uppercase">
            Agenda Kegiatan
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
            Sistem penjadwalan dan agenda kegiatan resmi SDN 1 Dukuhwaluh. Pantau seluruh kegiatan sekolah dalam satu kalender terintegrasi.
          </p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => { setSelectedAgenda(null); setIsDialogOpen(true); }}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black h-14 px-8 rounded-2xl shadow-xl transition-all flex items-center gap-3 uppercase text-[10px] tracking-widest"
          >
            <Plus size={20} /> Tambah Agenda
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Column */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[40px] overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">
                      {format(currentDate, "MMMM yyyy", { locale: id })}
                    </CardTitle>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">
                      Pilih tanggal untuk melihat detail
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="p-3 hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-[10px] font-bold uppercase tracking-widest">
                    Hari Ini
                  </button>
                  <button onClick={nextMonth} className="p-3 hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-1">
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((day) => (
                  <div key={day} className="text-center py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, i) => {
                  const hasAgendas = agendas.some(a => isSameDay(parseISO(a.event_date), day));
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, monthStart);

                  return (
                    <motion.div
                      key={day.toString()}
                      whileHover={{ scale: 0.98 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        min-h-[100px] p-3 rounded-2xl cursor-pointer transition-all relative border-2
                        ${isSelected ? 'border-blue-600 bg-blue-50/30' : 'border-transparent hover:border-slate-100 hover:bg-slate-50/50'}
                        ${!isCurrentMonth ? 'opacity-20' : 'opacity-100'}
                      `}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`
                          text-sm font-black w-8 h-8 flex items-center justify-center rounded-lg
                          ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : isSelected ? 'text-blue-600' : 'text-slate-900'}
                        `}>
                          {format(day, "d")}
                        </span>
                        {hasAgendas && (
                          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {agendas
                          .filter(a => isSameDay(parseISO(a.event_date), day))
                          .slice(0, 2)
                          .map(agenda => (
                            <div key={agenda.id} className="text-[9px] font-bold text-slate-600 bg-white border border-slate-100 px-2 py-1 rounded-md truncate max-w-full">
                              {agenda.title}
                            </div>
                          ))}
                        {agendas.filter(a => isSameDay(parseISO(a.event_date), day)).length > 2 && (
                          <div className="text-[8px] font-black text-slate-400 pl-1">
                            +{agendas.filter(a => isSameDay(parseISO(a.event_date), day)).length - 2} Lainnya
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Detail Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-50 flex flex-col h-full overflow-hidden">
            <div className="p-8 bg-blue-600 text-white">
              <div className="flex items-center gap-3 mb-2">
                <CalendarDays size={20} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Agenda Harian</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">{format(selectedDate, "eeee, dd MMMM", { locale: id })}</h2>
            </div>

            <div className="flex-1 p-8 overflow-y-auto max-h-[600px] custom-scrollbar space-y-6">
              <AnimatePresence mode="wait">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-3xl w-full"></div>
                  ))
                ) : agendasOnSelectedDate.length > 0 ? (
                  agendasOnSelectedDate.map((agenda, index) => (
                    <motion.div
                      key={agenda.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group p-6 rounded-[32px] bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 relative"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <Badge className="bg-white text-blue-600 border border-blue-50 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest">
                          {agenda.category}
                        </Badge>
                        {isAdmin && (
                          <div className="flex gap-2">
                             <button 
                               onClick={() => { setSelectedAgenda(agenda); setIsDialogOpen(true); }}
                               className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                             >
                               <Edit2 size={14} />
                             </button>
                             <button 
                               onClick={() => handleDelete(agenda.id)}
                               className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                             >
                               <Trash2 size={14} />
                             </button>
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mb-3 leading-tight uppercase tracking-tight">{agenda.title}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock size={14} className="text-blue-600" />
                          <span className="text-xs font-bold">{agenda.start_time?.slice(0, 5)} - {agenda.end_time?.slice(0, 5)} WIB</span>
                        </div>
                        {agenda.location && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <MapPin size={14} className="text-blue-600" />
                            <span className="text-xs font-bold">{agenda.location}</span>
                          </div>
                        )}
                      </div>
                      {agenda.description && (
                        <p className="mt-4 text-xs font-medium text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                          {agenda.description}
                        </p>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100">
                      <Target size={40} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Tidak Ada Agenda</p>
                      <p className="text-xs font-medium text-slate-400 max-w-[150px]">Belum ada kegiatan yang dijadwalkan hari ini.</p>
                    </div>
                    {isAdmin && (
                      <Button 
                        variant="link" 
                        className="text-blue-600 font-bold text-xs uppercase tracking-widest"
                        onClick={() => setIsDialogOpen(true)}
                      >
                         + Tambah Sekarang
                      </Button>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Info size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Kapasitas Hari Ini</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{agendasOnSelectedDate.length} Acara Direncanakan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agenda Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 border-none shadow-2xl rounded-[40px] overflow-hidden bg-white">
          <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-40 -mt-40"></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                {selectedAgenda ? "Edit Agenda" : "Agenda Baru"}
              </DialogTitle>
              <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                Konfigurasi Detail Kegiatan Sekolah
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSave} className="p-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Kegiatan</Label>
                <Input 
                  placeholder="Contoh: Rapat Kerja Kurikulum..." 
                  className="h-12 border-slate-100 bg-slate-50 rounded-xl font-bold"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Mulai</Label>
                <Input 
                  type="time"
                  className="h-12 border-slate-100 bg-slate-50 rounded-xl font-bold"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Selesai</Label>
                <Input 
                  type="time"
                  className="h-12 border-slate-100 bg-slate-50 rounded-xl font-bold"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi Kegiatan</Label>
                <Input 
                  placeholder="Contoh: Ruang Rapat Lt. 2 / Aula Sekolah" 
                  className="h-12 border-slate-100 bg-slate-50 rounded-xl font-bold"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi Kegiatan</Label>
                <Textarea 
                  placeholder="Detail agenda atau poin-poin pembahasan..." 
                  className="min-h-[120px] border-slate-100 bg-slate-50 rounded-xl font-medium p-4 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-6 gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest border-slate-200"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                className="h-12 px-10 bg-slate-900 hover:bg-black text-white font-black rounded-xl uppercase text-[10px] tracking-widest"
                disabled={loading}
              >
                {loading ? "Memproses..." : "Simpan Agenda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
