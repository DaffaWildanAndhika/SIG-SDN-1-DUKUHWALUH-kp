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
  CalendarCheck
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        .eq('day', selectedDay);
      
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
    <div className="space-y-8 pb-20 md:pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jadwal Piket Guru</h1>
          <p className="text-sm text-slate-500">Monitoring kehadiran dan tugas piket harian</p>
        </div>
        {canManage && (
          <Button onClick={() => { setSelectedPiket(null); setIsDialogOpen(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus size={16} /> Tambah Jadwal
          </Button>
        )}
      </div>

      <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 whitespace-nowrap ${selectedDay === day ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-blue-600 border border-slate-200'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48"></CardContent>
            </Card>
          ))
        ) : piketList.length > 0 ? (
          piketList.map(item => (
            <Card key={item.id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <div className="h-1 bg-blue-600 w-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className={`${item.shift === 'Pagi' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'} border-none font-bold uppercase tracking-wider text-[10px]`}>
                    Shift {item.shift}
                  </Badge>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedPiket(item); setIsDialogOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-blue-600">
                     {item.guru?.full_name?.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                     <p className="font-bold text-slate-800 truncate">{item.guru?.full_name}</p>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">GURU PIKET</p>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-50">
                  {item.picket_date && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 font-bold leading-none mb-2">
                      <CalendarIcon size={14} className="shrink-0" />
                      <span>{new Date(item.picket_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium leading-none">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium leading-none">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span>{item.shift === 'Pagi' ? '06:30 - 13:00' : '13:00 - 16:00'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full py-12 flex flex-col items-center justify-center border-dashed bg-slate-50/50">
            <CalendarCheck className="text-slate-300 mb-2" size={40} />
            <p className="text-slate-500 text-sm font-medium">Tidak ada jadwal piket hari ini</p>
          </Card>
        )}
      </div>
      
      <div className="bg-blue-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl shadow-blue-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
            <CalendarIcon size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Butuh Bantuan Jadwal?</h2>
            <p className="text-blue-100/80 text-sm font-medium">Reset atau buat ulang jadwal piket bulanan secara otomatis.</p>
          </div>
        </div>
        {canManage ? (
          <Button variant="outline" className="relative z-10 bg-white text-blue-600 border-none hover:bg-blue-50 font-bold h-12 px-8">
             Generate Jadwal
          </Button>
        ) : (
          <Button variant="outline" className="relative z-10 bg-white/20 text-white border-white/40 hover:bg-white/30 font-bold h-12 px-8">
             Cetak Jadwal
          </Button>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 border-none overflow-hidden">
          <div className="bg-blue-600 p-6">
            <DialogHeader>
              <DialogTitle className="text-white font-bold">{selectedPiket ? "Edit Jadwal Piket" : "Tambah Jadwal Piket"}</DialogTitle>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Nama Guru</Label>
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
              <Label>Tanggal (Opsional)</Label>
              <Input 
                type="date"
                value={formData.picket_date}
                onChange={(e) => {
                  const dateVal = e.target.value;
                  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                  const selectedDayName = dateVal ? dayNames[new Date(dateVal).getDay()] : formData.day;
                  
                  // Only auto-set Day if it matches one of our DAYS (Senin-Sabtu)
                  const finalDay = DAYS.includes(selectedDayName) ? selectedDayName : formData.day;
                  
                  setFormData({ ...formData, picket_date: dateVal, day: finalDay });
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hari</Label>
                <Select 
                  value={formData.day} 
                  onValueChange={(val) => setFormData({ ...formData, day: val })}
                >
                  <SelectTrigger className="bg-slate-50">
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
                <Label>Shift</Label>
                <Select 
                  value={formData.shift} 
                  onValueChange={(val) => setFormData({ ...formData, shift: val })}
                >
                  <SelectTrigger className="bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pagi">Pagi</SelectItem>
                    <SelectItem value="Siang">Siang</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lokasi Tugas</Label>
              <Input 
                placeholder="Contoh: Gerbang Utama" 
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
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
