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
    day: "Senin",
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
        day: selectedDay,
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

    setLoading(true);
    try {
      const payload = { ...formData };
      
      if (selectedPiket) {
        const { error } = await supabase
          .from('picket_schedules')
          .update(payload)
          .eq('id', selectedPiket.id);
        if (error) throw error;
        toast.success("Jadwal piket diperbarui");
      } else {
        const { error } = await supabase
          .from('picket_schedules')
          .insert([payload]);
        if (error) throw error;
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
        const { error } = await supabase.from('picket_schedules').delete().eq('id', id);
        if (error) throw error;
        toast.success("Jadwal dihapus");
        fetchPiketSchedules();
      } catch (error: any) {
        toast.error("Gagal menghapus: " + error.message);
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">Monitoring</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Jadwal Piket</h1>
          <p className="text-slate-500 font-medium mt-1">
            Pengaturan kehadiran dan tugas piket personil <span className="text-slate-900 font-bold">SDN 1 Dukuhwaluh</span>.
          </p>
        </div>
        {canManage && (
          <Button 
            onClick={() => { setSelectedPiket(null); setIsDialogOpen(true); }} 
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 rounded-xl transition-all flex items-center gap-2 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
            <span>Tambah Jadwal</span>
          </Button>
        )}
      </div>

      {/* Day Selector */}
      <div className="bg-white p-2 border border-slate-100 rounded-2xl shadow-sm flex overflow-x-auto gap-1 custom-scrollbar">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
              selectedDay === day 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={`skeleton-${i}`} className="bg-white rounded-2xl border-none shadow-sm animate-pulse">
                <div className="h-48"></div>
              </Card>
            ))
          ) : piketList.length > 0 ? (
            piketList.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:shadow-slate-300/40 transition-all group overflow-hidden flex flex-col h-full">
                  <div className={`h-1.5 w-full ${item.shift === 'Pagi' ? 'bg-blue-600' : 'bg-amber-500'}`}></div>
                  
                  <CardHeader className="p-6 pb-2">
                    <div className="flex justify-between items-center mb-4">
                      <Badge className={`${
                        item.shift === 'Pagi' 
                          ? 'bg-blue-50 text-blue-600 border-blue-100' 
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                        } font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-lg border shadow-sm`}>
                        Shift {item.shift}
                      </Badge>
                      
                      {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setSelectedPiket(item); setIsDialogOpen(true); }} className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner ${
                        item.shift === 'Pagi' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {item.guru?.full_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 leading-tight truncate">{item.guru?.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Petugas Piket</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6 pt-4 flex-1">
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                      {item.picket_date && (
                        <div className="flex items-start gap-3 group/info">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/info:bg-blue-50 group-hover/info:text-blue-600 transition-colors">
                            <CalendarIcon size={14} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Tanggal Tugas</p>
                            <p className="text-xs font-bold text-slate-600">
                              {new Date(item.picket_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-start gap-3 group/info">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/info:bg-blue-50 group-hover/info:text-blue-600 transition-colors">
                          <MapPin size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Tempat/Pos</p>
                          <p className="text-xs font-bold text-slate-600 truncate">{item.location}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 group/info">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/info:bg-blue-50 group-hover/info:text-blue-600 transition-colors">
                          <Clock size={14} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Estimasi Waktu</p>
                          <p className="text-xs font-bold text-slate-600">
                            {item.shift === 'Pagi' ? '06:30 - 13:00' : '13:00 - 16:00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-4">
                <CalendarCheck size={40} />
              </div>
              <p className="text-slate-900 font-bold">Tidak ada jadwal</p>
              <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Hari {selectedDay} ini kosong</p>
              {canManage && (
                <Button variant="outline" className="mt-6 rounded-xl font-bold h-10 px-6" onClick={() => setIsDialogOpen(true)}>
                  Buat Jadwal Pertama
                </Button>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 border-none shadow-2xl rounded-3xl overflow-hidden overflow-y-auto max-h-[90vh] custom-scrollbar">
          <div className="bg-[#0f172a] p-8 text-white relative overflow-hidden shrink-0">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-32 -mt-32"></div>
             <div className="flex items-center gap-5 relative z-10">
               <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-white/10 flex items-center justify-center shadow-inner">
                  <UserCircle size={32} className="text-blue-400" />
               </div>
               <div>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight uppercase">
                      {selectedPiket ? "Sunting Jadwal" : "Jadwal Piket"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 font-medium text-sm">
                      Penugasan personil guru piket harian sekolah.
                    </DialogDescription>
                  </DialogHeader>
               </div>
             </div>
          </div>
          
          <form onSubmit={handleSave} className="bg-white">
            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Petugas Guru</Label>
                <Select 
                  value={formData.guru_id} 
                  onValueChange={(val) => setFormData({ ...formData, guru_id: val })}
                >
                  <SelectTrigger className="h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold text-slate-700 px-4">
                    <SelectValue placeholder="Pilih guru..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100">
                    {guruList.map(guru => (
                      <SelectItem key={guru.id} value={guru.id} className="font-bold py-2.5">{guru.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tanggal (Opsional)</Label>
                <Input 
                  type="date"
                  className="h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold text-blue-600 px-4"
                  value={formData.picket_date}
                  onChange={(e) => {
                    const dateVal = e.target.value;
                    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                    const selectedDayName = dateVal ? dayNames[new Date(dateVal).getDay()] : formData.day;
                    const finalDay = DAYS.includes(selectedDayName) ? selectedDayName : formData.day;
                    setFormData({ ...formData, picket_date: dateVal, day: finalDay });
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Hari Kerja</Label>
                  <Select 
                    value={formData.day} 
                    onValueChange={(val) => setFormData({ ...formData, day: val })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {DAYS.map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Waktu (Shift)</Label>
                  <Select 
                    value={formData.shift} 
                    onValueChange={(val) => setFormData({ ...formData, shift: val })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Pagi">🌅 Shift Pagi</SelectItem>
                      <SelectItem value="Siang">☀️ Shift Siang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Lokasi / Pos Jaga</Label>
                <Input 
                  placeholder="Contoh: Gerbang Depan, Lobi Utama..." 
                  className="h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold px-4"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100 mt-2">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 font-black text-slate-400 hover:text-slate-900 rounded-xl">Batal</Button>
              <Button type="submit" className="h-12 px-10 bg-[#0f172a] hover:bg-slate-800 text-white font-black shadow-xl rounded-xl transition-all" disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Jadwal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
