import React, { useState, useEffect } from "react";
import { 
  History, 
  Search, 
  Filter, 
  RefreshCw, 
  Clock, 
  User, 
  Activity,
  UserCheck,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

interface ActivityLog {
  id: string;
  user_id: string;
  user_fullname: string;
  user_role: string;
  action: string;
  details: string;
  created_at: string;
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    try {
      const localBackup = localStorage.getItem("activity_logs_backup");
      if (localBackup) {
        const parsed = JSON.parse(localBackup);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const fetchLogs = async () => {
    if (logs.length === 0) {
      setLoading(true);
    }
    try {
      const response = await fetch("/api/activity-logs");
      if (!response.ok) throw new Error("Gagal memuat log dari server");
      
      const text = await response.text();
      if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html") || text.trim().startsWith("<!DOCTYPE")) {
        throw new Error("Format respon tidak valid (diterima berkas HTML)");
      }

      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        setLogs(data);
        try {
          localStorage.setItem("activity_logs_backup", JSON.stringify(data));
        } catch (err) {
          console.warn("Storage write failed:", err);
        }
      }
    } catch (error: any) {
      console.warn("Tolerated server log fetch fail, using current stored logs:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  };

  const getRoleLabel = (role: string) => {
    const roleNames: Record<string, string> = {
      admin: "Admin",
      kepala_sekolah: "Kepala Sekolah",
      guru: "Guru",
    };
    return roleNames[role] || role;
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      admin: "bg-red-50 text-red-700 border-red-200/50",
      kepala_sekolah: "bg-amber-50 text-amber-700 border-amber-200/50",
      guru: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
    };

    return (
      <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg border uppercase tracking-wider ${roleColors[role] || "bg-slate-100 text-slate-700"}`}>
        {getRoleLabel(role)}
      </span>
    );
  };

  const getActionIcon = (action: string) => {
    if (action.includes("Hapus")) return <ShieldAlert className="text-red-500" size={18} />;
    if (action.includes("Menambah") || action.includes("Mendaftar")) return <UserCheck className="text-emerald-500" size={18} />;
    return <Activity className="text-blue-500" size={18} />;
  };

  const filteredLogs = logs.filter(log => {
    const actor = log.user_fullname || "";
    const action = log.action || "";
    const details = log.details || "";
    const role = log.user_role || "";

    const matchesSearch = 
      actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || role === roleFilter;

    const matchesActionType = 
      actionFilter === "all" ||
      (actionFilter === "tambah" && (action.includes("Menambah") || action.includes("Mendaftar") || action.includes("Mengisi"))) ||
      (actionFilter === "ubah" && action.includes("Mengubah")) ||
      (actionFilter === "hapus" && action.includes("Menghapus"));

    return matchesSearch && matchesActionType && matchesRole;
  });

  const clearLogs = async () => {
    if (!confirm("Apakah Anda yakin ingin mengosongkan riwayat log aktivitas? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }
    
    // Optimistic Update: Clear local UI data instantly for instant response
    setLogs([]);
    try {
      localStorage.removeItem("activity_logs_backup");
    } catch (e) {}
    toast.success("Log aktivitas berhasil dibersihkan di perangkat ini!");

    // Fire API request in the background without blocking the UI
    fetch("/api/activity-logs", {
      method: "DELETE"
    }).then((res) => {
      if (!res.ok) {
        console.warn("Server failed to clear logs, response code:", res.status);
      } else {
        toast.success("Log aktivitas di server berhasil disinkronisasi!");
      }
    }).catch((err) => {
      console.warn("Background clear logs request failed:", err);
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
        <div className="space-y-1.5 font-medium">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Log Aktivitas</h1>
              <p className="text-slate-400 text-xs font-semibold">Pantau dan verifikasi setiap perubahan data yang dilakukan oleh Guru dan Staf.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            onClick={fetchLogs} 
            disabled={loading}
            className="h-12 px-5 rounded-2xl font-bold bg-[#F8FAFC] border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            <RefreshCw size={16} className={`shrink-0 ${loading ? 'animate-spin' : ''}`} />
            Perbarui
          </Button>
          <Button 
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="h-12 px-6 rounded-2xl bg-red-600 hover:bg-red-700 font-bold text-white flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-600/15 transition-all duration-300 border-none"
          >
            <Trash2 size={16} className="shrink-0" />
            Kosongkan Riwayat
          </Button>
        </div>
      </div>

      {/* Filter and Stats Block */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Active Stats Dashboard widgets in 1 column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-[28px] border-none shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 relative overflow-hidden">
            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="space-y-4 relative z-10">
              <span className="text-[10px] font-black tracking-widest uppercase text-blue-200">Total Log</span>
              <div className="space-y-1">
                <span className="text-4xl font-black">{logs.length}</span>
                <p className="text-[11px] text-blue-100 font-semibold">Log aktivitas direkam</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border border-slate-200/60 p-6 bg-white space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Metode Pemantauan</h3>
            <p className="text-xs font-bold leading-relaxed text-slate-500">
              Setiap kali guru mengubah, menambah, atau menghapus jadwal, siswa, atau nilai, sistem melakukan logging server-side untuk audit data internal secara otomatis.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-slate-400 text-[11px] font-bold uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif & Terlindungi
            </div>
          </Card>
        </div>

        {/* Filters and List in 3 column layout */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/60 flex flex-col md:flex-row gap-4 items-center">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                type="text"
                placeholder="Cari pelaku, kata aksi, atau detail log..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-12 pl-12 bg-[#F8FAFC] border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500 w-full text-sm"
              />
            </div>
            
            {/* Filter by Role */}
            <div className="w-full md:w-auto shrink-0 flex items-center gap-2">
              <Filter className="text-slate-400 hidden md:flex" size={16} />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="h-12 px-4 rounded-2xl bg-[#F8FAFC] border-none font-bold text-slate-600 focus:outline-none text-sm w-full md:w-44"
              >
                <option value="all">Semua Akun</option>
                <option value="guru">Hanya Guru</option>
                <option value="admin">Hanya Admin</option>
              </select>
            </div>

            {/* Filter by Action Type */}
            <div className="w-full md:w-auto shrink-0 flex items-center gap-2">
              <Filter className="text-slate-400 hidden md:flex" size={16} />
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="h-12 px-4 rounded-2xl bg-[#F8FAFC] border-none font-bold text-slate-600 focus:outline-none text-sm w-full md:w-56"
              >
                <option value="all">Semua Tipe Aksi</option>
                <option value="tambah">Penambahan / Input</option>
                <option value="ubah">Perubahan / Edit</option>
                <option value="hapus">Penghapusan / Delete</option>
              </select>
            </div>
          </div>

          {/* Logs Timeline List */}
          <Card className="rounded-[32px] border border-slate-200/50 p-0 overflow-hidden bg-white shadow-sm">
            <CardHeader className="px-8 py-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black uppercase text-slate-900 tracking-tight">Riwayat Aktivitas Terbaru</CardTitle>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">Menampilkan {filteredLogs.length} dari {logs.length} aktivitas log yang terdeteksi</p>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-sm font-bold">Memuat log...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <History size={28} />
                  </div>
                  <p className="text-slate-700 font-extrabold text-base">Tidak ada log aktivitas</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto font-medium">Log baru akan dicatat segera setelah terdapat aktivitas pengelolaan data oleh sistem guru.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <AnimatePresence initial={false}>
                    {filteredLogs.map((log) => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-6 md:px-8 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row gap-4 items-start justify-between"
                      >
                        <div className="flex gap-4 items-start flex-1 min-w-0 w-full">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                            {getActionIcon(log.action)}
                          </div>
                          
                          <div className="space-y-1.5 min-w-0 flex-1 w-full">
                            {/* Title & Badge */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900 tracking-tight">{log.action}</span>
                              {getRoleBadge(log.user_role)}
                            </div>

                            {/* Details Descriptions */}
                            <p className="text-xs text-slate-500 font-semibold leading-relaxed break-words">{log.details}</p>

                            {/* Prominent Account Information */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-slate-50 border border-slate-100/80 rounded-xl px-3 py-1.5 w-fit">
                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Akun Pelaku:</span>
                              <span className="text-xs font-black text-slate-800">{log.user_fullname}</span>
                              <span className="text-[9px] font-extrabold tracking-wider text-blue-700 bg-blue-50/70 px-1.5 py-0.5 rounded uppercase">
                                ({getRoleLabel(log.user_role)})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Timestamp Info */}
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 md:self-center shrink-0 mt-2 md:mt-0">
                          <Clock size={13} className="text-slate-300" />
                          <span>{formatDateTime(log.created_at)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
