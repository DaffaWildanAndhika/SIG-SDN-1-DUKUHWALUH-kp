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
    <div className="space-y-6 pb-20 md:pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Pengumuman Sekolah</h1>
          <p className="text-xs md:text-sm text-slate-500">Pusat informasi dan komunikasi SDN 1 Dukuhwaluh</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setSelectedAnnouncement(null); setIsDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 gap-2 h-9 md:h-10 text-xs md:text-sm">
            <Plus size={16} /> Buat Pengumuman
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-40 border-none shadow-sm"></Card>
          ))
        ) : announcements.length > 0 ? (
          announcements.map(item => (
            <Card key={item.id} className={`border-none shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-all duration-300 border-l-4 ${item.is_featured ? 'border-l-blue-600 bg-blue-50/30' : 'border-l-white'}`}>
              <div className="flex-1">
                 <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                         <Badge variant="secondary" className="bg-white text-blue-600 border border-blue-100 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                            {item.category}
                         </Badge>
                         {item.is_featured && (
                           <Badge className="bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                             PENTING
                           </Badge>
                         )}
                      </div>
                      <CardTitle className="text-xl font-bold text-slate-800">{item.title}</CardTitle>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedAnnouncement(item); setIsDialogOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                           <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                           <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                 </CardHeader>
                 <CardContent>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-4 md:gap-8 items-center border-t border-slate-100 pt-4">
                       <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                          <User size={14} className="text-blue-600" />
                          Petugas Sekolah
                       </div>
                       <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                          <Calendar size={14} className="text-blue-600" />
                          {format(new Date(item.created_at), 'dd MMMM yyyy', { locale: id })}
                       </div>
                       <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                          <Eye size={14} className="text-blue-600" />
                          Informasi Terverifikasi
                       </div>
                    </div>
                 </CardContent>
              </div>
            </Card>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <Megaphone className="text-slate-200 mb-4" size={64} />
            <h3 className="text-xl font-bold text-slate-400">Belum ada pengumuman</h3>
            <p className="text-sm text-slate-400 mt-2">Semua informasi penting akan muncul di sini</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-blue-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">{selectedAnnouncement ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</DialogTitle>
              <DialogDescription className="text-blue-100">
                Sampaikan informasi penting kepada seluruh warga sekolah.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Judul Pengumuman</Label>
                  <Input 
                    placeholder="Contoh: Libur Hari Raya" 
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="border-slate-200 focus:ring-blue-500 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Kategori</Label>
                  <Select 
                    value={formData.category}
                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Isi Pengumuman</Label>
                <Textarea 
                  placeholder="Tuliskan detail pengumuman secara lengkap..." 
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  className="min-h-[150px] border-slate-200 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100">
                <input 
                  type="checkbox" 
                  id="is_featured"
                  className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  checked={formData.is_featured}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                />
                <Label htmlFor="is_featured" className="text-sm font-bold text-blue-700 cursor-pointer">
                  Tandai sebagai pengumuman penting (Featured)
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="font-bold text-slate-500 hover:bg-slate-50">
                Batal
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold px-8" disabled={loading}>
                {loading ? "Menyimpan..." : selectedAnnouncement ? "Simpan Perubahan" : "Terbitkan Sekarang"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
