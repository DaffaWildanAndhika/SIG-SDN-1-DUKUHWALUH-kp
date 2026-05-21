import React, { useState, useRef } from "react";
import { 
  Database, 
  DownloadCloud, 
  UploadCloud, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  FileJson,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { logActivity } from "@/lib/activityLogger";
import {
  performBackup,
  downloadBackupFile,
  validateBackupSchema,
  performRestore,
  BackupData
} from "@/lib/backup-service";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function BackupRestore() {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<BackupData | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Backup Trigger
  const handleBackup = async () => {
    setLoading(true);
    setLoadingText("Mempersiapkan database...");
    try {
      toast.info("Sedang mengekspor seluruh basis data...");
      const backupData = await performBackup();
      
      // Download the backup file
      downloadBackupFile(backupData);
      
      await logActivity("Ekspor Database", "Melakukan backup basis data secara penuh.");
      toast.success("Database berhasil dibackup!");
    } catch (error: any) {
      console.error("Backup Error:", error);
      toast.error("Gagal melakukan backup: " + (error?.message || error));
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  // Handle Drag Events for file upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle File Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Manual File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Validate and parse the file
  const processFile = (file: File) => {
    // 1. Validate file extension or MIME type
    const isJson = file.type === "application/json" || file.name.endsWith(".json");
    if (!isJson) {
      toast.error("Berkas invalid: Hanya menerima berkas dengan format .json");
      return;
    }

    // 2. Validate maximum file size (5MB)
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      toast.error("Berkas terlalu besar: Ukuran maksimal berkas adalah 5MB");
      return;
    }

    setSelectedFile(file);

    // 3. Read & Parse JSON content
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // 4. Validate JSON Schema structure
        if (validateBackupSchema(parsed)) {
          setParsedData(parsed);
          toast.success("Berkas backup valid! Siap untuk dipulihkan.");
        } else {
          setParsedData(null);
          setSelectedFile(null);
          toast.error("Berkas invalid: Struktur schema backup data tidak cocok");
        }
      } catch (err: any) {
        setParsedData(null);
        setSelectedFile(null);
        toast.error("Format JSON tidak valid: " + err.message);
      }
    };
    reader.onerror = () => {
      setSelectedFile(null);
      setParsedData(null);
      toast.error("Gagal membaca file backup.");
    };
    reader.readAsText(file);
  };

  // Clear current selected file
  const clearSelection = () => {
    setSelectedFile(null);
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Trigger Restore database with confirmation
  const handleRestoreSubmit = async () => {
    if (!parsedData) {
      toast.error("Silakan unggah berkas backup `.json` yang valid terlebih dahulu.");
      return;
    }
    
    setIsConfirmOpen(false);
    setLoading(true);
    setLoadingText("Sedang memulihkan data...");

    try {
      await performRestore(parsedData);
      
      await logActivity("Pemulihan Database", `Memulihkan basis data menggunakan berkas cadangan: ${selectedFile?.name || "backup.json"}`);
      toast.success("Data berhasil direstore!");
      clearSelection();
    } catch (error: any) {
      console.error("Restore Error:", error);
      toast.error("Kritis: Gagal memulihkan database. Detail: " + (error?.message || error));
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[2px] bg-indigo-600 rounded-full"></span>
          <span className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">Pusat Administrasi</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Database className="text-indigo-600" size={32} /> Backup & Restore Data
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Pencadangan (backup) dan pemulihan (restore) basis data SDN 1 Dukuhwaluh secara mandiri.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-5 flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-wide">Pemberitahuan Keamanan Penting</h4>
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            Tindakan <span className="font-bold">Restore Data</span> akan menghapus seluruh data tabel saat ini yang terkait (guru, siswa, kelas, jadwal, nilai, dan pengumuman) sebelum menimpanya dengan cadangan baru. Pastikan berkas cadangan (JSON) Anda berasal dari sumber terpercaya untuk menghindari inkonsistensi struktur data.
          </p>
        </div>
      </div>

      {/* Grid of Backup & Restore Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* BACKUP DATABASE CARD */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-8 flex flex-col justify-between hover:shadow-2xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm relative group-hover:scale-110 transition-transform duration-300">
                <DownloadCloud size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pencadangan Sistem</h3>
                <p className="text-xs font-bold text-indigo-600/80 uppercase tracking-widest mt-0.5">Backup Database</p>
              </div>
            </div>

            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Ekspor seluruh basis data utama sekolah ke file format JSON terstruktur. File ini berisi semua data guru/profiles, data kelas, personil siswa, jadwal Piket & Mengajar, catatan nilai rapor, dan log pengumuman.
            </p>

            <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Format Ekspor Luaran:</p>
              <div className="flex items-center gap-3">
                <FileJson className="text-emerald-500" size={18} />
                <span className="font-mono text-xs font-bold text-slate-700 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-xl">
                  backup-YYYY-MM-DD.json
                </span>
              </div>
            </div>
          </div>

          <div className="pt-8 relative z-10 border-t border-slate-50 mt-6 md:mt-12">
            <Button
              onClick={handleBackup}
              disabled={loading}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-200 rounded-2xl transition-all flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Mengekspor Data...</span>
                </>
              ) : (
                <>
                  <DownloadCloud size={18} />
                  <span>Cadangkan Database</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* RESTORE DATABASE CARD */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-8 flex flex-col justify-between hover:shadow-2xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-rose-500/5 to-amber-500/5 rounded-full blur-3xl"></div>
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-sm relative group-hover:scale-110 transition-transform duration-300">
                <UploadCloud size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pemulihan Sistem</h3>
                <p className="text-xs font-bold text-rose-600/80 uppercase tracking-widest mt-0.5">Restore Database</p>
              </div>
            </div>

            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Tulis ulang tabel data penting sekolah menggunakan berkas cadangan JSON yang Anda unggah. Data lama akan dihapus dan digantikan seutuhnya dengan data cadangan.
            </p>

            {/* Drag & Drop File Container */}
            {!selectedFile ? (
              <div 
                className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? "border-rose-500 bg-rose-50/30 shadow-inner scale-[0.99]" 
                    : "border-slate-200 hover:border-rose-400 bg-slate-50/30"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="application/json, .json"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <FileJson size={24} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-700 font-bold block">
                      Tarik & Letakkan berkas .json di sini
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-1">
                      atau <span className="text-rose-600 font-bold underline">telusuri lokal</span> (maksimal 5 MB)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50/30 border border-rose-100 rounded-2xl p-5 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center relative shadow-sm">
                    <FileJson size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-xs font-black text-slate-800 uppercase block truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-[9px] font-bold text-rose-600 tracking-wider uppercase block mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Berkas Cadangan Valid
                    </span>
                  </div>
                </div>
                
                <Button 
                  onClick={clearSelection}
                  variant="ghost" 
                  className="text-slate-400 hover:text-rose-600 h-9 px-3 font-bold rounded-lg"
                >
                  Ubah file
                </Button>
              </div>
            )}
          </div>

          <div className="pt-8 relative z-10 border-t border-slate-50 mt-6 md:mt-12">
            <Button
              disabled={loading || !parsedData}
              onClick={() => setIsConfirmOpen(true)}
              className={`w-full h-12 font-black rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-lg ${
                parsedData 
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200" 
                  : "bg-slate-100 hover:bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            >
              <UploadCloud size={18} />
              <span>Pulihkan Database</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Global Processing Loader Panel */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0f172aff]/70 backdrop-blur-md flex items-center justify-center z-50 p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-10 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-6"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <Database className="absolute inset-0 m-auto text-indigo-600" size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Memproses Data</h4>
                <p className="text-sm font-semibold text-slate-500">{loadingText}</p>
              </div>
              <p className="text-[10px] text-rose-500 font-bold bg-rose-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
                Jangan mematikan atau menyegarkan halaman
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-[430px] rounded-[32px] border-none shadow-2xl overflow-hidden p-0">
          <div className="h-2 bg-rose-600 w-full" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-4 shadow-inner">
                <AlertTriangle size={28} />
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Konfirmasi Pemulihan</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-sm mt-1 leading-relaxed">
                Restore akan menimpa data lama. Lanjutkan?
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-500 font-medium leading-relaxed">
                  Tindakan ini menghapus data saat ini untuk tabel guru/profiles (kecuali Anda), kelas, siswa, jadwal, nilai, dan pengumuman.
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsConfirmOpen(false)}
                className="h-12 w-full rounded-2xl font-bold text-slate-500 hover:bg-slate-100"
              >
                Batal
              </Button>
              <Button 
                onClick={handleRestoreSubmit}
                className="h-12 w-full rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 shadow-lg shadow-rose-200"
              >
                Konfirmasi && Mulai
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
