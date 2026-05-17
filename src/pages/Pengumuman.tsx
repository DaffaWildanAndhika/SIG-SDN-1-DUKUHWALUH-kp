import React, { useState, useEffect } from "react";
import { Bell, Calendar, User, Eye, Send, MoreVertical, Plus, Edit2, Trash2, Megaphone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { motion, AnimatePresence } from "motion/react";

const CATEGORIES = ["Akademik", "Info Umum", "Pelatihan", "Ekstrakurikuler", "Lainnya"];

export default function Pengumuman() {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "Info Umum",
    is_featured: false
  });

  useEffect(() => {
    checkUserRole();
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (selectedAnnouncement) {
      setFormData({
        title: selectedAnnouncement.title || "",
        content: selectedAnnouncement.content || "",
        category: selectedAnnouncement.category || "Info Umum",
        is_featured: selectedAnnouncement.is_featured || false
      });
    } else {
      setFormData({
        title: "",
        content: "",
        category: "Info Umum",
        is_featured: false
      });
    }
  }, [selectedAnnouncement, isDialogOpen]);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const role = user.user_metadata?.role;
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      setIsAdmin(role === "admin" || isSpecialAdmin);
    }
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat pengumuman: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Ensure profile exists to avoid FK constraint error
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || 'Petugas Sekolah',
        role: user.user_metadata?.role || 'admin'
      }, { onConflict: 'id' });

      if (profileError) {
        console.error("Profile sync error:", profileError);
        // We continue even if profile sync fails, 
        // but if the DB requires author_id, it will fail later
      }

      const payload = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        is_featured: formData.is_featured,
        author_id: user.id
      };

      if (selectedAnnouncement) {
        const { error } = await supabase
          .from('announcements')
          .update(payload)
          .eq('id', selectedAnnouncement.id);
        if (error) throw error;
        toast.success("Pengumuman diperbarui");
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert([payload]);
        if (error) throw error;
        toast.success("Pengumuman berhasil diterbitkan");
      }
      setIsDialogOpen(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Hapus pengumuman ini?")) {
      try {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;
        toast.success("Pengumuman dihapus");
        fetchAnnouncements();
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
            <span className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">Pusat Informasi</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Pengumuman Sekolah
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
            Pusat komunikasi resmi SDN 1 Dukuhwaluh. Dapatkan kabar terbaru mengenai kebijakan, prestasi, dan agenda pendidikan.
          </p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => { setSelectedAnnouncement(null); setIsDialogOpen(true); }} 
            className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-100 rounded-2xl transition-all flex items-center gap-3 group"
          >
            <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-180 transition-transform duration-500">
              <Plus size={20} />
            </div>
            <span className="uppercase text-[10px] tracking-widest">Buat Pengumuman</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={`skeleton-${i}`} className="bg-white rounded-[40px] border border-slate-50 h-48 animate-pulse p-10 space-y-4">
                <div className="w-24 h-6 bg-slate-50 rounded-lg"></div>
                <div className="w-full h-8 bg-slate-50 rounded-xl"></div>
                <div className="w-2/3 h-4 bg-slate-50 rounded-lg"></div>
              </div>
            ))
          ) : announcements.length > 0 ? (
            announcements.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.1, type: "spring", damping: 20 }}
              >
                <Card className={`border-none shadow-2xl shadow-slate-200/50 rounded-[48px] overflow-hidden flex flex-col md:flex-row hover:shadow-indigo-100/40 hover:-translate-y-1 transition-all duration-500 group relative ${item.is_featured ? 'bg-indigo-50/20 ring-2 ring-indigo-100' : 'bg-white'}`}>
                  {item.is_featured && (
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/5 rounded-full blur-[60px] -mr-20 -mt-20"></div>
                  )}

                  <div className="flex-1 p-10 md:p-12">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-3">
                           <Badge variant="secondary" className="bg-white text-indigo-600 border border-indigo-100 font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm">
                              {item.category}
                           </Badge>
                           {item.is_featured && (
                             <Badge className="bg-amber-500 text-white font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-amber-100 flex items-center gap-1.5">
                               <Bell size={10} /> PENTING
                             </Badge>
                           )}
                        </div>
                        
                        {isAdmin && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 duration-500">
                            <button 
                              onClick={() => { setSelectedAnnouncement(item); setIsDialogOpen(true); }} 
                              className="h-10 w-10 flex items-center justify-center bg-white shadow-xl text-slate-400 hover:text-indigo-600 rounded-2xl hover:scale-110 transition-all border border-slate-50"
                            >
                               <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)} 
                              className="h-10 w-10 flex items-center justify-center bg-white shadow-xl text-slate-400 hover:text-red-500 rounded-2xl hover:scale-110 transition-all border border-slate-50"
                            >
                               <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                     </div>

                     <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 tracking-tight group-hover:text-indigo-600 transition-colors leading-tight">{item.title}</h2>
                     
                     <div className="prose prose-slate max-w-none">
                        <p className="text-slate-600 text-base md:text-lg leading-relaxed whitespace-pre-wrap font-medium">
                          {item.content}
                        </p>
                     </div>

                     <div className="mt-10 flex flex-wrap gap-6 md:gap-12 items-center border-t border-slate-100 pt-8">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                              <User size={18} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Oleh Penulis</span>
                              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Petugas Sekolah</span>
                           </div>
                        </div>

                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                              <Calendar size={18} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal Terbit</span>
                              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                {format(new Date(item.created_at), 'dd MMMM yyyy', { locale: id })}
                              </span>
                           </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                              <Eye size={18} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status Data</span>
                              <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Terverifikasi</span>
                           </div>
                        </div>
                     </div>
                  </div>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="py-32 bg-white border-2 border-dashed border-slate-100 rounded-[64px] flex flex-col items-center justify-center text-center p-12 overflow-hidden relative">
              <div className="absolute inset-0 bg-slate-50/30 opacity-50"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 rounded-[32px] bg-white shadow-2xl flex items-center justify-center text-slate-200 mb-8 transform hover:scale-110 transition-transform duration-500">
                  <Megaphone size={56} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Belum Ada Informasi</h3>
                <p className="text-slate-500 font-medium max-w-xs mt-3 leading-relaxed">
                  Pusat pengumuman sedang kosong. Semua pembaruan resmi akan muncul di sini.
                </p>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    className="mt-10 rounded-2xl font-black h-14 px-10 border-slate-100 hover:border-indigo-600 hover:text-indigo-600 transition-all gap-2 uppercase text-[10px] tracking-widest" 
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Plus size={18} /> Tulis Pengumuman
                  </Button>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[650px] p-0 border-none shadow-2xl rounded-[40px] overflow-hidden overflow-y-auto max-h-[90vh] custom-scrollbar bg-white">
          <div className="bg-slate-900 p-10 text-white relative overflow-hidden shrink-0">
             <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600 rounded-full blur-[120px] opacity-20 -mr-40 -mt-40"></div>
             <div className="flex items-center gap-6 relative z-10">
               <div className="w-16 h-16 rounded-[24px] bg-indigo-600/20 border border-white/10 flex items-center justify-center shadow-inner group">
                  <Send size={32} className="text-indigo-400 group-hover:rotate-12 transition-transform duration-500" />
               </div>
               <div>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight uppercase">
                      {selectedAnnouncement ? "Edit Informasi" : "Terbitkan Pengumuman"}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                      <DialogDescription className="text-slate-400 font-black text-[10px] uppercase tracking-widest">
                        Kelola Alur Informasi Sekolah
                      </DialogDescription>
                    </div>
                  </DialogHeader>
               </div>
             </div>
          </div>

          <form onSubmit={handleSave} className="bg-white">
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 ml-1">
                    <div className="w-1 h-1 rounded-full bg-indigo-600"></div>
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Judul Informasi</Label>
                  </div>
                  <Input 
                    placeholder="Contoh: Jadwal Ujian Semester..." 
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-black text-slate-700 px-6 focus:ring-indigo-500 transition-all text-sm"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 ml-1">
                    <div className="w-1 h-1 rounded-full bg-indigo-600"></div>
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kategori Konten</Label>
                  </div>
                  <Select 
                    value={formData.category}
                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger className="h-14 bg-slate-50 border-slate-100 rounded-2xl font-black text-slate-700 px-6">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="font-black py-4 px-6 text-[10px] uppercase tracking-widest">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-1 h-1 rounded-full bg-indigo-600"></div>
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detail Narasi Pengumuman</Label>
                </div>
                <Textarea 
                  placeholder="Tuliskan isi pengumuman secara deskriptif dan mudah dipahami..." 
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  className="min-h-[220px] bg-slate-50 border-slate-100 rounded-[32px] font-medium p-8 focus:ring-indigo-500 transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-4 bg-indigo-50/50 p-6 rounded-[32px] border border-indigo-100 transition-all group hover:bg-indigo-50">
                <div className="flex items-center h-5">
                  <input 
                    type="checkbox" 
                    id="is_featured"
                    className="w-6 h-6 rounded-lg border-indigo-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  />
                </div>
                <Label htmlFor="is_featured" className="text-sm font-black text-indigo-700 cursor-pointer uppercase tracking-tight select-none">
                  Selesaikan sebagai pengumuman prioritas (Sticky Post)
                </Label>
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
                {loading ? "Processing..." : selectedAnnouncement ? "Update Data" : "Publish Info"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
