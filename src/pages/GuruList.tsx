import React, { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Filter, 
  Download,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function GuruList() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGuru, setSelectedGuru] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    nip: "",
    full_name: "",
    gender: "Laki-laki",
    subject: "",
    phone: "",
    is_active: true,
    address: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedGuru) {
      setFormData({
        nip: selectedGuru.nip || "",
        full_name: selectedGuru.full_name || "",
        gender: selectedGuru.gender || "Laki-laki",
        subject: selectedGuru.subject || "",
        phone: selectedGuru.phone || "",
        is_active: selectedGuru.is_active ?? true,
        address: selectedGuru.address || ""
      });
    } else {
      setFormData({
        nip: "",
        full_name: "",
        gender: "Laki-laki",
        subject: "",
        phone: "",
        is_active: true,
        address: ""
      });
    }
  }, [selectedGuru, isDialogOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
        
      if (error) throw error;
      setData(profiles || []);
    } catch (error: any) {
      toast.error("Gagal memuat data guru: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = (data || []).filter(item => {
    if (!item) return false;
    const nameMatch = item.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const nipMatch = item.nip?.includes(searchTerm);
    return nameMatch || nipMatch;
  });

  const handleSave = async (formData: any) => {
    setLoading(true);
    try {
      if (selectedGuru) {
        const { error } = await supabase
          .from('profiles')
          .update(formData)
          .eq('id', selectedGuru.id);
        if (error) throw error;
        toast.success("Data guru berhasil diperbarui");
      } else {
        // Create a new record
        const insertData: any = {
          ...formData,
          role: 'guru'
        };
        
        // Only provide ID if we can generate a valid one, otherwise let DB handle it
        const newId = window.crypto?.randomUUID?.();
        if (newId) {
          insertData.id = newId;
        }

        const { error } = await supabase
          .from('profiles')
          .insert([insertData]);
        
        if (error) {
          if (error.message?.includes("foreign key constraint")) {
            throw new Error("Gagal: Tabel 'profiles' terhubung ketat dengan Auth Users. Silakan jalankan SQL di SUPABASE_SETUP.md (Bagian Update) untuk mengizinkan input manual.");
          }
          throw error;
        }
        toast.success("Guru baru berhasil ditambahkan");
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Gagal menyimpan data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data guru ini? Menghapus guru ini akan melepaskan jabatan wali kelas dan menghapus referensi penulis pada pengumuman.")) {
      try {
        setLoading(true);
        
        // 1. Clear references in announcements (set author_id to null)
        await supabase
          .from('announcements')
          .update({ author_id: null })
          .eq('author_id', id);

        // 2. Clear references in classes (set wali_kelas_id to null)
        await supabase
          .from('classes')
          .update({ wali_kelas_id: null })
          .eq('wali_kelas_id', id);

        // 3. Delete the profile
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        toast.success("Data guru berhasil dihapus");
        fetchData();
      } catch (error: any) {
        toast.error("Gagal menghapus data: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredData.map(guru => ({
        'Nama Lengkap': guru.full_name,
        'NIP': guru.nip || '-',
        'Jenis Kelamin': guru.gender,
        'Mata Pelajaran': guru.subject || '-',
        'No. HP': guru.phone || '-',
        'Status': guru.is_active ? 'Aktif' : 'Non-aktif',
        'Alamat': guru.address || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Guru");
      XLSX.writeFile(workbook, `Data_Guru_SDN1_Dukuhwaluh_${new Date().toLocaleDateString('id-ID')}.xlsx`);
      toast.success("Data guru berhasil diexport ke Excel");
    } catch (error) {
      console.error("Excel Export Error:", error);
      toast.error("Gagal mengeksport ke Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Add School Header Info
      doc.setFontSize(18);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text("SDN 1 DUKUHWALUH", 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("Data Profil Guru dan Tenaga Kependidikan", 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-400
      doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 38);

      const tableData = filteredData.map((guru, index) => [
        index + 1,
        guru.full_name,
        guru.nip || '-',
        guru.gender === 'Laki-laki' ? 'L' : 'P',
        guru.subject || '-',
        guru.is_active ? 'Aktif' : 'Non-aktif'
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['No', 'Nama Guru', 'NIP', 'JK', 'Mata Pelajaran', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 45 },
      });

      doc.save(`Data_Guru_SDN1_Dukuhwaluh_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Data guru berhasil diexport ke PDF");
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Gagal mengeksport ke PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Guru</h1>
          <p className="text-sm text-slate-500">Kelola informasi guru SDN 1 Dukuhwaluh</p>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download size={16} /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Export ke Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                <FileText size={16} className="text-red-600" />
                <span>Export ke PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setSelectedGuru(null); setIsDialogOpen(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus size={16} /> Tambah Guru
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari berdasarkan nama atau NIP..." 
              className="pl-10 h-10 border-slate-200 focus:ring-blue-500" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px] h-10 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Non-aktif</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200">
              <Filter size={16} className="text-slate-500" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-[80px]">Foto</TableHead>
                <TableHead>Guru</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Mata Pelajaran</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-10 w-10 bg-slate-100 rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" /></TableCell>
                    <TableCell className="text-right"><div className="h-8 w-8 bg-slate-100 rounded float-right animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((guru) => (
                  <TableRow key={guru.id} className="hover:bg-slate-50/50 border-slate-50">
                    <TableCell>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                        {guru.full_name.charAt(0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{guru.full_name}</div>
                      <div className="text-xs text-slate-500 font-medium">{guru.phone}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 tracking-wider">
                      {guru.nip}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none font-medium text-[10px] uppercase tracking-wider">
                        {guru.subject}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {guru.is_active ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                          <CheckCircle2 size={14} /> Aktif
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                          <XCircle size={14} /> Non-aktif
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => { setSelectedGuru(guru); setIsDialogOpen(true); }}
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(guru.id)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="bg-slate-50 p-4 rounded-full">
                        <Users className="text-slate-300" size={32} />
                      </div>
                      <p className="text-slate-500 font-medium">Tidak ada data guru yang ditemukan</p>
                      <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>Reset Pencarian</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">Menampilkan {filteredData.length} dari {data.length} guru</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 border-slate-200" disabled>Sebelumnya</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 border-slate-200">Selanjutnya</Button>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-blue-600 p-6 flex items-center justify-between">
            <div>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-white">
                  {selectedGuru ? "Edit Data Guru" : "Tambah Guru Baru"}
                </DialogTitle>
              </DialogHeader>
              <p className="text-blue-100/80 text-xs mt-1 font-medium">
                Sistem Informasi Administrasi SDN 1 Dukuhwaluh
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <Users className="text-white" size={24} />
            </div>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handleSave(formData); }}>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">NIP</Label>
                  <Input 
                    placeholder="Contoh: 19850312..." 
                    className="border-slate-200 focus:ring-blue-500"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">Nama Lengkap</Label>
                  <Input 
                    placeholder="Nama beserta gelar" 
                    className="border-slate-200 focus:ring-blue-500" 
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">Jenis Kelamin</Label>
                  <Select 
                    value={formData.gender}
                    onValueChange={(val) => setFormData({ ...formData, gender: val as any })}
                  >
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                      <SelectItem value="Perempuan">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">Mata Pelajaran</Label>
                  <Input 
                    placeholder="Mata pelajaran yang diampu" 
                    className="border-slate-200 focus:ring-blue-500" 
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">No. HP</Label>
                  <Input 
                    placeholder="Contoh: 0812..." 
                    className="border-slate-200 focus:ring-blue-500" 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-bold">Status Keaktifan</Label>
                  <div className="flex items-center gap-4 h-10 px-1">
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        id="active" 
                        name="status" 
                        checked={formData.is_active} 
                        onChange={() => setFormData({ ...formData, is_active: true })}
                        className="accent-blue-600" 
                      />
                      <label htmlFor="active" className="text-sm font-medium text-slate-700 cursor-pointer">Aktif</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        id="inactive" 
                        name="status" 
                        checked={!formData.is_active} 
                        onChange={() => setFormData({ ...formData, is_active: false })}
                        className="accent-blue-600" 
                      />
                      <label htmlFor="inactive" className="text-sm font-medium text-slate-700 cursor-pointer">Non-aktif</label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-slate-700 font-bold">Alamat</Label>
                <textarea 
                  className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                  placeholder="Alamat lengkap tempat tinggal"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                ></textarea>
              </div>
            </div>

            <div className="bg-slate-50 p-6 flex flex-col sm:flex-row gap-3 justify-end">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-11 font-bold text-slate-500 hover:text-slate-700">Batal</Button>
              <Button type="submit" disabled={loading} className="h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold px-8">
                {loading ? "Menyimpan..." : "Simpan Data Guru"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
