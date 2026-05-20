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
  FileText,
  Clock,
  ArrowRight,
  UserCircle,
  Eye,
  EyeOff
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
  DialogDescription,
  DialogFooter
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
import { motion, AnimatePresence } from "motion/react";
import { logActivity } from "@/lib/activityLogger";
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function GuruList() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("guru");
  const [canManage, setCanManage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGuru, setSelectedGuru] = useState<any>(null);
  
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Form State
  const [formData, setFormData] = useState({
    nip: "",
    full_name: "",
    gender: "Laki-laki",
    subject: "",
    phone: "",
    is_active: true,
    address: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    checkUserRole();
    fetchData();
  }, []);

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      const role = profile?.role || user.user_metadata?.role || "guru";
      setUserRole(role);
      
      const isSpecialAdmin = user.email === "admin@sekolah.is" || user.email === "admin@sekolah.id";
      const isAdmin = role === "admin" || isSpecialAdmin;
      setCanManage(isAdmin);
    }
  };

  useEffect(() => {
    if (selectedGuru) {
      setFormData({
        nip: selectedGuru.nip || "",
        full_name: selectedGuru.full_name || "",
        gender: selectedGuru.gender || "Laki-laki",
        subject: selectedGuru.subject || "",
        phone: selectedGuru.phone || "",
        is_active: selectedGuru.is_active ?? true,
        address: selectedGuru.address || "",
        email: selectedGuru.email || "",
        password: "" // Don't show password on edit
      });
    } else {
      setFormData({
        nip: "",
        full_name: "",
        gender: "Laki-laki",
        subject: "",
        phone: "",
        is_active: true,
        address: "",
        email: "",
        password: ""
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
    
    // Search filter
    const nameMatch = item.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const nipMatch = item.nip?.includes(searchTerm);
    const searchCondition = nameMatch || nipMatch;

    // Status filter
    const statusCondition = 
      statusFilter === "all" || 
      (statusFilter === "active" && item.is_active) || 
      (statusFilter === "inactive" && !item.is_active);

    return searchCondition && statusCondition;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedGuru) {
        // Update existing guru via Admin Update API
        const response = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedGuru.id,
            email: formData.email,
            password: formData.password || undefined, // only update password if provided
            full_name: formData.full_name,
            role: selectedGuru.role || "guru",
            nip: formData.nip,
            gender: formData.gender,
            subject: formData.subject,
            phone: formData.phone,
            address: formData.address,
            is_active: formData.is_active
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Gagal memperbarui akun guru");
        }
        
        await logActivity("Mengubah Data Guru", `Mengubah informasi data akun guru ${formData.full_name} (NIP: ${formData.nip || '-'})`);
        toast.success("Data guru berhasil diperbarui");
      } else {
        // Create new guru via Admin API
        const response = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: "guru"
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Gagal membuat akun guru");
        }

        // Update profile with remaining fields since Admin API might only do basic insert
        const { error: patchError } = await supabase
          .from('profiles')
          .update({
            nip: formData.nip,
            gender: formData.gender,
            subject: formData.subject,
            phone: formData.phone,
            address: formData.address,
            is_active: formData.is_active
          })
          .eq('id', result.user.id);
          
        if (patchError) console.warn("Note: Profile patch failed", patchError.message);

        await logActivity("Mendaftarkan Guru Baru", `Mendaftarkan guru baru ${formData.full_name} (Email: ${formData.email}, Mapel: ${formData.subject || '-'})`);
        toast.success("Akun guru berhasil didaftarkan");
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
    if (confirm("Apakah Anda yakin ingin menghapus data guru ini?")) {
      try {
        setLoading(true);
        const { data: grData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', id)
          .single();
        const guruName = grData?.full_name || "Guru";

        await supabase.from('announcements').update({ author_id: null }).eq('author_id', id);
        await supabase.from('classes').update({ wali_kelas_id: null }).eq('wali_kelas_id', id);

        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        await logActivity("Menghapus Data Guru", `Menghapus data akun guru ${guruName}`);
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
      XLSX.writeFile(workbook, `Data_Guru_${new Date().toLocaleDateString('id-ID')}.xlsx`);
      toast.success("Export Excel berhasil");
    } catch (error) {
      toast.error("Gagal export Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.setTextColor(37, 99, 235);
      doc.text("SDN 1 DUKUHWALUH", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Data Guru - ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

      const tableData = filteredData.map((guru, index) => [
        index + 1,
        guru.full_name,
        guru.nip || '-',
        guru.gender === 'Laki-laki' ? 'L' : 'P',
        guru.subject || '-',
        guru.is_active ? 'Aktif' : 'Non-aktif'
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['No', 'Nama Guru', 'NIP', 'JK', 'Mapel', 'Status']],
        body: tableData,
        headStyles: { fillColor: [37, 99, 235] },
      });

      doc.save(`Data_Guru_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Export PDF berhasil");
    } catch (error) {
      toast.error("Gagal export PDF");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">Database</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Data Guru</h1>
          <p className="text-slate-500 font-medium mt-1">
            Manajemen informasi dan tenaga kependidikan <span className="text-slate-900 font-bold">SDN 1 Dukuhwaluh</span>.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 px-5 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                <Download size={18} className="mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] rounded-xl p-2 border-slate-100 shadow-xl">
              <DropdownMenuItem onClick={exportToExcel} className="rounded-lg py-2.5 cursor-pointer gap-3 font-medium">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                </div>
                <span>Excel Spreadsheet</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="rounded-lg py-2.5 cursor-pointer gap-3 font-medium">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <FileText size={16} className="text-red-600" />
                </div>
                <span>PDF Document</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canManage && (
            <Button 
               onClick={() => { setSelectedGuru(null); setIsDialogOpen(true); }} 
               className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 rounded-xl transition-all flex items-center gap-2 group"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
              <span>Tambah Guru</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Quick Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
           <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Users size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Guru</p>
              <p className="text-2xl font-black text-slate-900">{data.length}</p>
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
           <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Aktif</p>
              <p className="text-2xl font-black text-slate-900">{data.filter(g => g.is_active).length}</p>
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
           <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserCircle size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Update Terakhir</p>
              <p className="text-sm font-black text-slate-900">Hari ini</p>
           </div>
        </div>
      </div>

      {/* Filter & Search Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
          <Input 
            placeholder="Cari berdasarkan nama atau NIP..." 
            className="pl-12 h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-medium rounded-xl" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold text-slate-600 px-4">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-100">
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Guru Aktif</SelectItem>
              <SelectItem value="inactive">Non-aktif</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-12 w-12 border-slate-100 flex items-center justify-center shrink-0 rounded-xl text-slate-400">
            <Filter size={20} />
          </Button>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="w-[100px] h-14 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-8">Inisial</TableHead>
                <TableHead className="h-14 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identitas Guru</TableHead>
                {canManage && (
                  <TableHead className="h-14 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Password</TableHead>
                )}
                <TableHead className="h-14 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kredensial (NIP)</TableHead>
                <TableHead className="h-14 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bidang Keahlian</TableHead>
                <TableHead className="h-14 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</TableHead>
                <TableHead className="w-[120px] h-14 text-right pr-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="border-slate-50">
                      <TableCell className="pl-8 py-6"><div className="h-12 w-12 bg-slate-50 rounded-2xl animate-pulse" /></TableCell>
                      <TableCell><div className="space-y-2"><div className="h-4 w-40 bg-slate-50 rounded animate-pulse" /><div className="h-3 w-24 bg-slate-50 rounded animate-pulse" /></div></TableCell>
                      {canManage && <TableCell><div className="h-4 w-20 bg-slate-50 rounded animate-pulse" /></TableCell>}
                      <TableCell><div className="h-4 w-32 bg-slate-50 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-slate-50 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-6 w-20 bg-slate-50 rounded-full animate-pulse" /></TableCell>
                      <TableCell className="pr-8"><div className="h-9 w-9 bg-slate-50 rounded-lg float-right animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length > 0 ? (
                  filteredData.map((guru, index) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      key={guru.id} 
                      className="group hover:bg-blue-50/30 transition-colors border-slate-50 last:border-0"
                    >
                      <TableCell className="pl-8 py-5">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center font-black text-blue-600 shadow-sm relative group-hover:scale-110 transition-transform">
                          {guru.full_name.charAt(0)}
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${guru.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{guru.full_name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                           <Phone size={10} className="text-slate-300" /> {guru.phone || "No HP Kosong"}
                           {guru.gender === "Laki-laki" ? <span className="text-blue-300">♂</span> : <span className="text-pink-300">♀</span>}
                        </div>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm bg-slate-100 px-2.5 py-1 rounded-xl select-all font-bold text-slate-700">
                              {visiblePasswords[guru.id] 
                                ? (guru.avatar_url || "admin123") 
                                : "••••••••"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => togglePasswordVisibility(guru.id)}
                              className="h-8 w-8 hover:bg-slate-200 rounded-lg flex items-center justify-center shrink-0"
                            >
                              {visiblePasswords[guru.id] ? (
                                <EyeOff size={14} className="text-slate-500" />
                              ) : (
                                <Eye size={14} className="text-slate-500" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs font-black text-slate-400 tracking-widest bg-slate-50/30 rounded-lg px-3 py-1 scale-95 origin-left">
                        {guru.nip || "BELUM ADA NIP"}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-slate-900/5 hover:bg-slate-900/10 text-slate-900 border-none font-bold text-[10px] px-3 py-1 rounded-lg uppercase tracking-wider">
                          {guru.subject || "UMUM"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {guru.is_active ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                             Aktif
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-100">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                             Non-Aktif
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        {(canManage || currentUser?.id === guru.id) && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => { setSelectedGuru(guru); setIsDialogOpen(true); }}
                              className="h-10 w-10 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                            >
                              <Edit2 size={16} />
                            </Button>
                            {canManage && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDelete(guru.id)} 
                                className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                              >
                                <Trash2 size={16} />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </motion.tr>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-80 text-center">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center gap-4 text-slate-300 max-w-xs mx-auto"
                      >
                        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center">
                          <Users size={40} className="text-slate-200" />
                        </div>
                        <div>
                          <p className="text-slate-900 font-bold">Data tidak ditemukan</p>
                          <p className="text-sm font-medium mt-1">Coba gunakan kata kunci pencarian lain atau ubah filter status.</p>
                        </div>
                        <Button variant="outline" className="mt-2 rounded-xl h-10 px-6 font-bold" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                          Reset Semua Filter
                        </Button>
                      </motion.div>
                    </TableCell>
                  </TableRow>
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>

        <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
            Terarsip <span className="text-blue-600">{filteredData.length}</span> Guru dari <span className="text-slate-900">{data.length}</span> Total Personil
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 px-5 border-slate-100 font-bold text-slate-400 bg-white rounded-xl" disabled>Prev</Button>
            <Button variant="outline" className="h-10 px-5 border-slate-200 font-bold text-slate-900 bg-white shadow-sm hover:bg-slate-50 rounded-xl">Next Page</Button>
          </div>
        </div>
      </div>

      {/* Modern Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] p-0 border-none shadow-2xl rounded-3xl overflow-hidden overflow-y-auto custom-scrollbar">
          <div className="bg-[#0f172a] p-8 text-white relative overflow-hidden shrink-0">
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-32 -mt-32"></div>
             <div className="flex items-center gap-5 relative z-10">
               <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-white/10 flex items-center justify-center shadow-inner">
                  <UserCircle size={32} className="text-blue-400" />
               </div>
               <div>
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-black tracking-tight uppercase">
                      {selectedGuru ? "Sunting Profil" : "Guru Baru"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 font-medium text-sm">
                      Lengkapi data personil tenaga kependidikan untuk arsip sekolah.
                    </DialogDescription>
                  </DialogHeader>
               </div>
             </div>
          </div>
          
          <form onSubmit={handleSave} className="bg-white">
            <div className="p-8 space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Lengkap & Gelar</Label>
                    <Input 
                      placeholder="Masukkan nama lengkap..." 
                      className="h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold rounded-xl" 
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nomor Induk Pegawai (NIP)</Label>
                    <Input 
                      placeholder="Input NIP jika ada..." 
                      className="h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold rounded-xl font-mono text-blue-600"
                      value={formData.nip}
                      onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Login</Label>
                    <Input 
                      type="email"
                      placeholder="guru@sekolah.id" 
                      className="h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold rounded-xl" 
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={!!selectedGuru}
                    />
                  </div>
                  {!selectedGuru && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        Password Akun
                      </Label>
                      <Input 
                        type="password"
                        placeholder="Minimal 6 karakter..."
                        className="h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold rounded-xl" 
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Jenis Kelamin</Label>
                    <Select 
                      value={formData.gender}
                      onValueChange={(val) => setFormData({ ...formData, gender: val as any })}
                    >
                      <SelectTrigger className="h-12 bg-slate-50/50 border-slate-100 rounded-xl font-bold text-slate-700">
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                        <SelectItem value="Laki-laki">👨 Laki-laki</SelectItem>
                        <SelectItem value="Perempuan">👩 Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Bidang Studi (Mata Pelajaran)</Label>
                    <Input 
                      placeholder="Contoh: Matematika, IPA..." 
                      className="h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold rounded-xl" 
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Kontak Person (Handphone)</Label>
                    <Input 
                      placeholder="Nomor Whatsapp Aktif..." 
                      className="h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold rounded-xl" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Status Kepegawaian</Label>
                    <div className="flex items-center gap-6 h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setFormData({ ...formData, is_active: true })}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${formData.is_active ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                           {formData.is_active && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-wider ${formData.is_active ? 'text-blue-600' : 'text-slate-400'}`}>Aktif</span>
                      </div>
                      <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setFormData({ ...formData, is_active: false })}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${!formData.is_active ? 'border-red-500 bg-red-500' : 'border-slate-300'}`}>
                           {!formData.is_active && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-wider ${!formData.is_active ? 'text-red-500' : 'text-slate-400'}`}>Cuti / Non-aktif</span>
                      </div>
                    </div>
                  </div>
               </div>
               
               <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Keterangan Alamat / Rumah</Label>
                  <textarea 
                    className="w-full min-h-[120px] p-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                    placeholder="Contoh: Jl. Merdeka No. 123, Purwokerto..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  ></textarea>
               </div>
            </div>

            <div className="p-8 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 font-black text-slate-400 hover:text-slate-900 rounded-xl">Batal</Button>
              <Button type="submit" disabled={loading} className="h-12 px-10 bg-[#0f172a] hover:bg-slate-800 text-white font-black shadow-xl rounded-xl transition-all flex items-center gap-3">
                {loading ? "Memproses..." : (selectedGuru ? "Simpan Perubahan" : "Terbitkan Profil")}
                {!loading && <ArrowRight size={18} />}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
