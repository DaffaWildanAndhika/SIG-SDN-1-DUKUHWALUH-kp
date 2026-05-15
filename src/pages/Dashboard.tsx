import React, { useState, useEffect } from "react";
import { 
  Users, 
  Calendar, 
  BookOpen, 
  Bell, 
  ArrowUpRight, 
  TrendingUp, 
  UserCheck 
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area 
} from "recharts";
import { supabase } from "../lib/supabase";

const StatCard = ({ title, value, icon: Icon, description, trend, color }: any) => (
  <Card className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-md">
    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{title}</p>
    <div className="flex items-end gap-2 mt-1">
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {trend && (
        <span className="text-[10px] text-emerald-600 font-semibold mb-1">{trend}</span>
      )}
      {!trend && description && (
        <span className="text-[10px] text-slate-400 mb-1">{description}</span>
      )}
    </div>
  </Card>
);

const data = [
  { name: 'Sen', mng: 400 },
  { name: 'Sel', mng: 300 },
  { name: 'Rab', mng: 600 },
  { name: 'Kam', mng: 278 },
  { name: 'Jum', mng: 189 },
  { name: 'Sab', mng: 239 },
  { name: 'Min', mng: 100 },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGuru: 0,
    guruPiket: 0,
    totalKelas: 0,
    activityRate: "0%"
  });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [piketToday, setPiketToday] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const todayIndo = days[new Date().getDay()];

      const [
        { count: guruCount },
        { count: piketCount, data: piketData },
        { count: kelasCount },
        { data: announcementData }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'guru'),
        supabase.from('picket_schedules').select('*, guru:profiles(full_name)').eq('day', todayIndo),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3)
      ]);

      setStats({
        totalGuru: guruCount || 0,
        guruPiket: piketCount || 0,
        totalKelas: kelasCount || 0,
        activityRate: "98%" // Placeholder logic
      });

      setAnnouncements(announcementData || []);
      setPiketToday(piketData || []);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium">Memuat data dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        <StatCard 
          title="Total Guru" 
          value={stats.totalGuru} 
          trend={stats.totalGuru > 0 ? "+ Baru" : ""}
          color="bg-blue-600"
        />
        <StatCard 
          title="Guru Piket" 
          value={stats.guruPiket} 
          description="Aktif hari ini"
          color="bg-indigo-600"
        />
        <StatCard 
          title="Kelas Aktif" 
          value={stats.totalKelas} 
          description="Rombel"
          color="bg-violet-600"
        />
        <StatCard 
          title="Aktivitas Guru" 
          value={stats.activityRate} 
          trend="Excellent"
          color="bg-amber-500"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[460px]">
        {/* Activity Chart Section */}
        <Card className="flex-1 bg-white rounded-xl border border-slate-200 p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800">Statistik Aktivitas Mengajar (Mingguan)</h3>
            <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">Update Otomatis</div>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="mng" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Right Column: Announcements & Piket */}
        <div className="w-full lg:w-[320px] flex flex-col gap-6">
          {/* Announcements */}
          <Card className="flex-1 bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Pengumuman Terbaru</h3>
            <div className="space-y-4 flex-1 overflow-hidden">
              {announcements.length > 0 ? announcements.map((ann, i) => (
                <div key={ann.id} className={`border-l-2 ${i === 0 ? 'border-blue-500' : 'border-slate-200'} pl-3 py-1 transition-all hover:bg-slate-50 cursor-pointer rounded-r-md`}>
                  <p className="text-xs font-semibold text-slate-800 truncate">{ann.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(ann.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )) : (
                <p className="text-xs text-slate-400 italic">Belum ada pengumuman</p>
              )}
            </div>
            <Button variant="ghost" className="mt-4 w-full h-8 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors uppercase tracking-widest">
              Lihat Semua
            </Button>
          </Card>

          {/* Piket Highlights */}
          <Card className="h-44 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Piket Hari Ini</h3>
            <div className="flex -space-x-2">
              {piketToday.slice(0, 3).map((p, i) => (
                <div key={p.id} className={`w-8 h-8 rounded-full border-2 border-white ${['bg-blue-400', 'bg-indigo-400', 'bg-violet-400'][i % 3]} flex items-center justify-center text-[10px] text-white font-bold uppercase`}>
                  {p.guru?.full_name?.charAt(0) || "G"}
                </div>
              ))}
              {piketToday.length > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-400 flex items-center justify-center text-[10px] text-white font-bold">+{piketToday.length - 3}</div>
              )}
              {piketToday.length === 0 && (
                <p className="text-[10px] text-slate-400 italic ml-2">Tidak ada jadwal piket</p>
              )}
            </div>
            {piketToday.length > 0 && (
              <p className="text-[10px] text-slate-500 mt-3">Utama: <span className="font-semibold text-slate-800">{piketToday[0].guru?.full_name}</span></p>
            )}
            <div className="mt-3 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="w-full h-full bg-blue-500"></div>
            </div>
            <div className="flex justify-between mt-1">
               <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Status Kehadiran</span>
               <span className="text-[9px] text-blue-600 font-bold">100%</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

