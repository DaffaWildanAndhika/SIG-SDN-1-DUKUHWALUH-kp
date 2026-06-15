
import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Save, 
  Info, 
  Copy,
  PlusCircle,
  GraduationCap
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

const DEFAULT_SUBJECTS = [
  { id: "1", name: "Pendidikan Pancasila", kkm: 75 },
  { id: "2", name: "Bahasa Indonesia", kkm: 75 },
  { id: "3", name: "Matematika", kkm: 75 },
  { id: "4", name: "IPA", kkm: 75 },
  { id: "5", name: "Seni Budaya", kkm: 75 },
  { id: "6", name: "PJOK", kkm: 75 },
  { id: "7", name: "Bahasa Inggris", kkm: 75 },
  { id: "8", name: "Agama", kkm: 75 }
];

interface PageProps {
  user?: any;
  role?: string;
}

export default function MataPelajaran({ user: propUser, role: propRole }: PageProps = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectKkm, setSubjectKkm] = useState<number>(75);
  
  // DB vs Local Fallback Status
  const [dbTableExists, setDbTableExists] = useState<boolean>(true);
  const [showSqlInstruction, setShowSqlInstruction] = useState<boolean>(false);

  const sqlStatement = `-- Salin perintah SQL berikut ke SQL Editor di Supabase Anda:

-- JALANKAN INI JIKA TABEL SUDAH ADA:
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS kkm INTEGER DEFAULT 75;

-- JALANKAN INI JIKA TABEL BELUM ADA:
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kkm INTEGER DEFAULT 75,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- Buat Policy agar Semua Pengguna bisa Melihat Mata Pelajaran
CREATE POLICY "Subjects are viewable by everyone" ON subjects FOR SELECT USING (true);

-- Buat Policy agar Admin bisa Mengelola Mata Pelajaran
CREATE POLICY "Admins can manage subjects" ON subjects FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);`;

  useEffect(() => {
    fetchSubjects(true);
  }, []);

  const fetchSubjects = async (isInitial = false) => {
    if (isInitial || subjects.length === 0) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      if (error) {
        // If table does not exist
        if (error.code === "P0001" || error.message.includes("does not exist") || error.code === "42P01") {
          setDbTableExists(false);
          const cached = localStorage.getItem("subjects_list");
          if (cached) {
            setSubjects(JSON.parse(cached));
          } else {
            setSubjects(DEFAULT_SUBJECTS);
            localStorage.setItem("subjects_list", JSON.stringify(DEFAULT_SUBJECTS));
          }
        } else {
          throw error;
        }
      } else {
        setDbTableExists(true);
        setSubjects(data || []);
      }
    } catch (err: any) {
      console.warn("Table 'subjects' failed fetching, using local storage fallback:", err);
      setDbTableExists(false);
      const cached = localStorage.getItem("subjects_list");
      if (cached) {
        setSubjects(JSON.parse(cached));
      } else {
        setSubjects(DEFAULT_SUBJECTS);
        localStorage.setItem("subjects_list", JSON.stringify(DEFAULT_SUBJECTS));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      return toast.error("Nama mata pelajaran tidak boleh kosong");
    }
    const cleanName = subjectName.trim();
    const kkmVal = parseInt(String(subjectKkm)) || 75;
    setSaving(true);
    try {
      if (dbTableExists) {
        if (selectedSubject) {
          const { error } = await supabase
            .from('subjects')
            .update({ name: cleanName, kkm: kkmVal })
            .eq('id', selectedSubject.id);
          
          if (error) {
            // Handle if kkm column doesn't exist (e.g. 42703 is undefined column)
            if (error.message.includes("column \"kkm\" of relation \"subjects\" does not exist") || error.code === "42703") {
              const { error: fallbackError } = await supabase
                .from('subjects')
                .update({ name: cleanName })
                .eq('id', selectedSubject.id);
              if (fallbackError) throw fallbackError;
              toast.warning("Mata pelajaran diperbarui, tetapi KKM gagal disimpan karena kolom 'kkm' belum dibuat di database. Harap jalankan script migrasi SQL.");
            } else {
              throw error;
            }
          } else {
            toast.success("Mata pelajaran berhasil diperbarui");
          }
          await logActivity("Mengubah Mata Pelajaran", `Mengubah nama mata pelajaran "${selectedSubject.name}" menjadi "${cleanName}" (KKM: ${kkmVal})`);
        } else {
          // Check duplicate
          if (subjects.some(s => s.name.toLowerCase() === cleanName.toLowerCase())) {
            throw new Error("Mata pelajaran sudah terdaftar.");
          }
          const { error } = await supabase
            .from('subjects')
            .insert([{ name: cleanName, kkm: kkmVal }]);
          
          if (error) {
            if (error.message.includes("column \"kkm\" of relation \"subjects\" does not exist") || error.code === "42703") {
              const { error: fallbackError } = await supabase
                .from('subjects')
                .insert([{ name: cleanName }]);
              if (fallbackError) throw fallbackError;
              toast.warning("Mata pelajaran ditambahkan, tetapi KKM gagal disimpan karena kolom 'kkm' belum dibuat di database. Harap jalankan script migrasi SQL.");
            } else {
              throw error;
            }
          } else {
            toast.success("Mata pelajaran berhasil ditambahkan");
          }
          await logActivity("Menambahkan Mata Pelajaran", `Menambahkan mata pelajaran baru: "${cleanName}" (KKM: ${kkmVal})`);
        }
        fetchSubjects();
      } else {
        // Fallback localStorage
        let updated = [...subjects];
        if (selectedSubject) {
          updated = updated.map(s => s.id === selectedSubject.id ? { ...s, name: cleanName, kkm: kkmVal } : s);
          await logActivity("Mengubah Mata Pelajaran (Lokal)", `Mengubah nama mata pelajaran lokal "${selectedSubject.name}" menjadi "${cleanName}" (KKM: ${kkmVal})`);
          toast.success("Perubahan mata pelajaran disimpan lokal!");
        } else {
          if (subjects.some(s => s.name.toLowerCase() === cleanName.toLowerCase())) {
            throw new Error("Mata pelajaran sudah terdaftar.");
          }
          const newSub = { id: Date.now().toString(), name: cleanName, kkm: kkmVal };
          updated.push(newSub);
          await logActivity("Menambahkan Mata Pelajaran (Lokal)", `Menambahkan mata pelajaran lokal baru: "${cleanName}" (KKM: ${kkmVal})`);
          toast.success("Mata pelajaran baru disimpan lokal!");
        }
        localStorage.setItem("subjects_list", JSON.stringify(updated));
        setSubjects(updated);
      }
      setIsDialogOpen(false);
      setSubjectName("");
      setSubjectKkm(75);
      setSelectedSubject(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal menyimpan mata pelajaran");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus mata pelajaran "${name}"?`)) return;
    try {
      if (dbTableExists) {
        const { error } = await supabase
          .from('subjects')
          .delete()
          .eq('id', id);
        if (error) throw error;
        await logActivity("Menghapus Mata Pelajaran", `Menghapus mata pelajaran: "${name}"`);
        toast.success("Mata pelajaran berhasil dihapus");
        fetchSubjects();
      } else {
        const updated = subjects.filter(s => s.id !== id);
        localStorage.setItem("subjects_list", JSON.stringify(updated));
        setSubjects(updated);
        await logActivity("Menghapus Mata Pelajaran (Lokal)", `Menghapus mata pelajaran lokal: "${name}"`);
        toast.success("Mata pelajaran berhasil dihapus secara lokal");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gagal menghapus mata pelajaran");
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlStatement);
    toast.success("Perintah SQL berhasil disalin ke clipboard!");
  };

  const filteredSubjects = subjects.filter(sub => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-[#0f172a] text-white rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl transform -translate-x-10 translate-y-10" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest rounded-full">
              <GraduationCap size={12} className="shrink-0" />
              Kelola Kurikulum - Administrator
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">
              Mata Pelajaran
            </h1>
            <p className="text-slate-400 font-medium text-sm">
              Kelola basis data mata pelajaran SDN 1 Dukuhwaluh untuk digunakan pada jadwal dan rapor.
            </p>
          </div>
          
          <Button 
            onClick={() => { setSelectedSubject(null); setSubjectName(""); setSubjectKkm(75); setIsDialogOpen(true); }}
            className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wide px-6 flex items-center gap-2 shadow-lg shadow-blue-600/20 shrink-0"
          >
            <PlusCircle size={16} />
            Tambah Mata Pelajaran
          </Button>
        </div>
      </div>

      {/* SQL Setup Fallback Alert Banner */}
      {!dbTableExists && (
        <Card className="border-amber-200 bg-amber-50/50 rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-6 md:p-8 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                <Info size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">INFORMASI DATA MATA PELAJARAN</h3>
                <p className="text-slate-600 text-xs font-bold leading-relaxed">
                  Tabel <code className="bg-amber-100/60 px-1.5 py-0.5 rounded font-mono text-amber-800">subjects</code> belum terbuat di database Supabase Anda. Untuk sementara, data mata pelajaran akan disimpan secara lokal di browser ini. Agar sinkron di cloud, silakan salin dan jalankan script SQL berikut di SQL Editor Supabase Anda.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pl-14">
              <Button 
                variant="outline" 
                onClick={() => setShowSqlInstruction(!showSqlInstruction)}
                className="h-10 rounded-xl bg-white border-amber-200 font-bold text-xs text-amber-800 uppercase tracking-wider"
              >
                {showSqlInstruction ? "Sembunyikan SQL Setup" : "Lihat SQL Setup"}
              </Button>
              <Button 
                onClick={handleCopySql}
                className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2"
              >
                <Copy size={14} />
                Salin Script SQL
              </Button>
            </div>

            {showSqlInstruction && (
              <div className="mt-4 p-4 pl-14 bg-slate-900 rounded-2xl overflow-x-auto border border-slate-850">
                <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre leading-normal">
                  {sqlStatement}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Widget */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 flex items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
          <Input 
            placeholder="Cari berdasarkan nama mata pelajaran..." 
            className="pl-12 h-12 bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-medium rounded-xl w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Subjects Table */}
      <Card className="rounded-[32px] border-slate-200/60 shadow-sm bg-white overflow-hidden">
        <div className="p-6 md:p-8 bg-slate-50/60 border-b border-slate-100">
          <h3 className="text-md font-black text-slate-900 uppercase tracking-tighter">
            Daftar Mata Pelajaran Terdaftar
          </h3>
          <p className="text-slate-500 text-[10px] font-bold">Total mata pelajaran aktif: {filteredSubjects.length}</p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm font-bold animate-pulse">Memuat data...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <BookOpen size={32} />
            </div>
            <div className="space-y-1">
              <h4 className="text-md font-black text-slate-800 uppercase">Mata Pelajaran Kosong</h4>
              <p className="text-slate-400 text-xs font-semibold max-w-sm">
                Belum ada data mata pelajaran yang cocok atau terdaftar. Silakan tambahkan baru.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/40">
                <TableRow className="border-slate-100">
                  <TableHead className="w-[80px] text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">No</TableHead>
                  <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nama Mata Pelajaran</TableHead>
                  <TableHead className="w-[120px] text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">KKM</TableHead>
                  <TableHead className="w-[180px] text-right pr-8 text-[10px] font-black text-slate-400 uppercase tracking-wider">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((sub, index) => (
                  <TableRow key={sub.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                    <TableCell className="text-center font-mono font-bold text-xs text-slate-400">
                      {index + 1}
                    </TableCell>
                    <TableCell className="py-4 font-bold text-slate-800">
                      {sub.name}
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-700">
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none font-bold text-xs px-2.5 py-0.5 rounded-md">
                        {sub.kkm || 75}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="inline-flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedSubject(sub);
                            setSubjectName(sub.name);
                            setSubjectKkm(sub.kkm || 75);
                            setIsDialogOpen(true);
                          }}
                          className="h-9 w-9 hover:bg-slate-100 text-slate-500 rounded-lg hover:text-blue-600"
                        >
                          <Edit2 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSubject(sub.id, sub.name)}
                          className="h-9 w-9 hover:bg-red-50 text-slate-500 rounded-lg hover:text-red-650"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Add / Edit Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] border-none shadow-2xl overflow-hidden p-0">
          <div className="h-2 bg-blue-600 w-full" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                {selectedSubject ? "Ubah Mata Pelajaran" : "Tambah Mata Pelajaran"}
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-xs mt-1">
                Tentukan nama mata pelajaran akademik kurikulum sekolah.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveSubject} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Mata Pelajaran</Label>
                <Input 
                  placeholder="Contoh: Matematika"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="h-12 bg-slate-50 border-slate-100 rounded-2xl font-bold text-slate-700 focus-visible:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nilai KKM</Label>
                <Input 
                  type="number"
                  min="0"
                  max="100"
                  placeholder="75"
                  value={subjectKkm}
                  onChange={(e) => setSubjectKkm(parseInt(e.target.value) || 0)}
                  className="h-12 bg-slate-50 border-slate-100 rounded-2xl font-bold text-slate-700 focus-visible:ring-blue-500"
                  required
                />
              </div>

              <DialogFooter className="pt-4 flex-col sm:flex-row gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsDialogOpen(false)}
                  className="h-12 rounded-2xl font-bold text-slate-500 hover:bg-slate-100"
                >
                  Batal
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Simpan Mapel"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
