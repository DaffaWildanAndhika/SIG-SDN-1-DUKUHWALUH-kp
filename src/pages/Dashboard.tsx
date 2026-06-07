import React, { useState, useEffect } from "react";
import { 
  Users, 
  Calendar, 
  BookOpen, 
  Bell, 
  ArrowUpRight, 
  TrendingUp, 
  UserCheck,
  PlusCircle,
  FileText,
  Clock,
  Layout,
  ChevronRight,
  School,
  Info
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from "recharts";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";

const StatCard = ({ title, value, icon: Icon, description, trend, colorClass }: any) => (
  <Card className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 group overflow-hidden relative">
    <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-125 ${colorClass}`}></div>
    <div className="flex flex-col gap-4 relative z-10">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass} bg-opacity-10 transition-colors group-hover:bg-opacity-20`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{value}</span>
          {trend && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px]">
              <TrendingUp size={12} className="mr-1" /> {trend}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-slate-400 mt-2 font-medium flex items-center gap-1">
             <Clock size={12} /> {description}
          </p>
        )}
      </div>
    </div>
  </Card>
);

const data = [
  { name: 'Senin', count: 42, activity: 85 },
  { name: 'Selasa', count: 38, activity: 78 },
  { name: 'Rabu', count: 55, activity: 92 },
  { name: 'Kamis', count: 48, activity: 88 },
  { name: 'Jumat', count: 35, activity: 70 },
  { name: 'Sabtu', count: 28, activity: 65 },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [stats, setStats] = useState({
    totalGuru: 0,
    totalMurid: 0,
    totalKelas: 0,
  });
  const [agendas, setAgendas] = useState<any[]>([]);
  const [piketToday, setPiketToday] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [gradeType, setGradeType] = useState<"harian" | "rapor">("harian");
  const [isFallbackGrades, setIsFallbackGrades] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      let currentRole = "guru";
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        currentRole = profile?.role || user.user_metadata?.role || "guru";
        setUserRole(currentRole);
      }

      const isSpecialAdmin = user?.email === "admin@sekolah.is" || user?.email === "admin@sekolah.id";
      const isAdminRole = currentRole === "admin" || isSpecialAdmin;

      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const todayIndo = days[new Date().getDay()];
      const todayIso = new Date().toISOString().split('T')[0];

      // Define queries
      let studentQuery = supabase.from('students').select('*', { count: 'exact', head: true });
      let kelasQuery = supabase.from('classes').select('*', { count: 'exact', head: true });

      if (!isAdminRole && user) {
        // Teacher context: Find classes assigned to this teacher
        const { data: teacherClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('wali_kelas_id', user.id);
        
        const classIds = teacherClasses?.map(c => c.id) || [];
        
        if (classIds.length > 0) {
          studentQuery = studentQuery.in('class_id', classIds);
          kelasQuery = kelasQuery.eq('wali_kelas_id', user.id);
        } else {
          studentQuery = supabase.from('students').select('*', { count: 'exact', head: true }).eq('id', '00000000-0000-0000-0000-000000000000');
          kelasQuery = supabase.from('classes').select('*', { count: 'exact', head: true }).eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // Fetch dynamic class options list for the dropdown filter
      let classesListQuery = supabase.from('classes').select('id, name, academic_year');
      if (!isAdminRole && user) {
        classesListQuery = classesListQuery.eq('wali_kelas_id', user.id);
      }

      const [
        { count: guruCount },
        { count: studentCount },
        { count: kelasCount },
        { data: agendaData },
        { data: piketData },
        { data: classesData }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'guru'),
        studentQuery,
        kelasQuery,
        supabase.from('agendas').select('*').gte('event_date', todayIso).order('event_date', { ascending: true }).limit(4),
        supabase.from('picket_schedules').select('*, guru:profiles(full_name)').eq('day', todayIndo),
        classesListQuery.order('name')
      ]);

      setStats({
        totalGuru: guruCount || 0,
        totalMurid: studentCount || 0,
        totalKelas: kelasCount || 0,
      });

      setClasses(classesData || []);
      setAgendas(agendaData || []);
      setPiketToday(piketData || []);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGradeData = async () => {
    if (!currentUser) return;
    try {
      const isSpecialAdmin = currentUser.email === "admin@sekolah.is" || currentUser.email === "admin@sekolah.id";
      const isAdminRole = userRole === "admin" || isSpecialAdmin;

      let classIds: string[] = [];
      if (selectedClassId === "all") {
        if (!isAdminRole) {
          // Normal teacher can only view their own classes
          const { data: teacherClasses } = await supabase
            .from('classes')
            .select('id')
            .eq('wali_kelas_id', currentUser.id);
          classIds = teacherClasses?.map(c => c.id) || [];
        }
      } else {
        classIds = [selectedClassId];
      }

      // If filter is all but teacher has no assigned classes, show empty fallback
      if (!isAdminRole && selectedClassId === "all" && classIds.length === 0) {
        setGradeData([]);
        setIsFallbackGrades(true);
        return;
      }

      // Build database query
      let dbData: any[] = [];
      if (gradeType === "harian") {
        let query = supabase.from('student_grades').select('subject, average_score');
        if (classIds.length > 0) {
          query = query.in('class_id', classIds);
        }
        const { data, error } = await query;
        if (error) throw error;
        dbData = data || [];
      } else {
        let query = supabase.from('semester_grades').select('subject, final_score');
        if (classIds.length > 0) {
          query = query.in('class_id', classIds);
        }
        const { data, error } = await query;
        if (error) throw error;
        dbData = data || [];
      }

      const standardSubjects = [
        "Pendidikan Pancasila",
        "Bahasa Indonesia",
        "Matematika",
        "IPAS",
        "Seni Budaya",
        "PJOK",
        "Bahasa Inggris",
        "Agama"
      ];

      if (dbData && dbData.length > 0) {
        const subjectMap: Record<string, { total: number, count: number }> = {};
        
        // Pre-initialize map with standard subjects at 0 score so they all display beautifully
        standardSubjects.forEach(sub => {
          subjectMap[sub] = { total: 0, count: 0 };
        });

        dbData.forEach(g => {
          const score = gradeType === "harian" ? (g.average_score || 0) : (g.final_score || 0);
          if (subjectMap[g.subject] !== undefined) {
            subjectMap[g.subject].total += score;
            subjectMap[g.subject].count += 1;
          } else if (g.subject) {
            // Include other non-standard subjects
            subjectMap[g.subject] = { total: score, count: 1 };
          }
        });

        const formattedGrades = Object.entries(subjectMap).map(([subject, data]) => ({
          name: subject,
          score: data.count > 0 ? Math.round(data.total / data.count) : 0
        })).sort((a, b) => b.score - a.score);

        setGradeData(formattedGrades);
        
        // If all aggregated scores are 0, mark as fallback/empty state
        const allZeros = formattedGrades.every(g => g.score === 0);
        setIsFallbackGrades(allZeros);
      } else {
        // Fallback display if no grades entered in database
        setGradeData(standardSubjects.map(sub => ({
          name: sub,
          score: 0
        })));
        setIsFallbackGrades(true);
      }
    } catch (err: any) {
      console.error("Error loading grade chart data:", err.message);
    }
  };

  // Re-fetch grades dynamically when class filter selection or grade type changes
  useEffect(() => {
    fetchGradeData();
  }, [selectedClassId, gradeType, userRole, currentUser]);

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  const isSpecialAdmin = currentUser?.email === "admin@sekolah.is" || currentUser?.email === "admin@sekolah.id";
  const isAdmin = userRole === "admin" || isSpecialAdmin;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-bold tracking-widest animate-pulse uppercase">Syncing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
        {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[2px] bg-blue-600 rounded-full"></span>
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em]">{getTimeOfDay()}</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            Halo, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{currentUser?.user_metadata?.full_name?.split(' ')[0] || "Admin"}</span>
          </h1>
          <p className="text-slate-500 font-medium mt-2 max-w-xl text-sm md:text-base leading-relaxed">
            Selamat datang kembali di dashboard administrasi. Hari ini adalah <span className="text-slate-900 font-bold">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>.
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <StatCard 
          title="Total Guru" 
          value={stats.totalGuru} 
          trend="Aktif"
          description="Terdaftar di sistem"
          icon={Users}
          colorClass="bg-blue-600"
        />
        <StatCard 
          title="Total Murid" 
          value={stats.totalMurid} 
          trend="Tahun ini"
          description={`${stats.totalMurid} siswa terdata`}
          icon={Users}
          colorClass="bg-emerald-600"
        />
        <StatCard 
          title="Kelas Aktif" 
          value={stats.totalKelas} 
          trend="Fixed"
          description="Rombongan belajar"
          icon={School}
          colorClass="bg-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart Section */}
        <Card className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col hover:shadow-md transition-all">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Grafik Nilai Siswa</h3>
              <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest leading-none flex items-center gap-1">
                <Clock size={12} /> Rata-rata nilai per mata pelajaran
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Kelas Selector */}
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-8 w-[140px] bg-slate-50 border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl shadow-none focus:ring-0">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-100 rounded-xl shadow-lg">
                  <SelectItem value="all" className="text-xs font-medium">Semua Kelas</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                      {c.name} ({c.academic_year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Tipe Nilai Selector */}
              <Select value={gradeType} onValueChange={(val: "harian" | "rapor") => setGradeType(val)}>
                <SelectTrigger className="h-8 w-[170px] bg-slate-50 border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl shadow-none focus:ring-0">
                  <SelectValue placeholder="Jenis Nilai" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-100 rounded-xl shadow-lg">
                  <SelectItem value="harian" className="text-xs font-medium">Formatif (Nilai Harian)</SelectItem>
                  <SelectItem value="rapor" className="text-xs font-medium">Sumatif Rapor (Nilai Rapor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFallbackGrades && (
            <div className="mb-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-[10px] font-bold text-amber-900 leading-tight">Belum Ada Nilai Terinput</p>
                <p className="text-[9px] text-slate-600 mt-0.5 leading-normal">
                  Grafik saat ini menampilkan struktur mata pelajaran akademik standar dengan rata-rata 0. Anda dapat menambahkan nilai untuk menyinkronkan data grafik melalui menu <Link to="/nilai" className="font-bold underline text-blue-600 hover:text-blue-700">Nilai Siswa</Link>.
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: any) => [`${value} Poin`, "Rata-rata Nilai"]}
                />
                <Bar 
                  dataKey="score" 
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Right Column Grid */}
        <div className="flex flex-col gap-6">
          {/* Quick Actions */}
          <Card className="bg-blue-600 rounded-2xl p-6 shadow-xl shadow-blue-200 overflow-hidden relative group text-left">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            <h3 className="text-lg font-bold text-white mb-4 relative z-10">Aksi Cepat</h3>
            <div className="grid grid-cols-2 gap-3 relative z-10">
              <Link to="/nilai" className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white gap-2">
                <FileText size={20} />
                <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Nilai Siswa</span>
              </Link>
              {isAdmin && (
                <Link to="/guru" className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white gap-2">
                  <PlusCircle size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Tambah Guru</span>
                </Link>
              )}
              <Link to="/pengumuman" className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white gap-2">
                <Calendar size={20} />
                <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Agenda</span>
              </Link>
              <Link to="/mengajar" className="flex flex-col items-center justify-center p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white gap-2">
                <BookOpen size={20} />
                <span className="text-[10px] font-bold uppercase tracking-tighter text-center">Jadwal</span>
              </Link>
            </div>
          </Card>

          {/* Agenda Section */}
          <Card className="flex-1 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col hover:shadow-md transition-all text-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Agenda Sekolah</h3>
              <Link to="/pengumuman">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-50 text-slate-400">
                  <ChevronRight size={18} />
                </Button>
              </Link>
            </div>
            <div className="space-y-4 flex-1">
              {agendas.length > 0 ? agendas.map((ag, i) => (
                <div key={ag.id} className="group cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${i === 0 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 uppercase tracking-tight">{ag.title}</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1">
                         <Calendar size={10} /> {new Date(ag.event_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                         <span className="text-slate-300 mx-1">•</span>
                         <Clock size={10} /> {ag.start_time?.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                  <Calendar size={32} strokeWidth={1.5} />
                  <p className="text-[10px] font-bold uppercase mt-2 italic tracking-widest text-slate-300">Belum Ada Agenda</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Row Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Today's Picket */}
         <Card className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col hover:shadow-md transition-all overflow-hidden relative text-left">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-50 rounded-full translate-x-1/3 translate-y-1/3 opacity-50"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Piket Hari Ini</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daftar Guru Bertugas</p>
              </div>
              <Badge className="bg-blue-600 text-white border-none font-bold">Shift Pagi & Siang</Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              {piketToday.length > 0 ? piketToday.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-default overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black text-blue-600 border border-slate-100 shadow-sm text-xs shrink-0">
                    {p.guru?.full_name?.charAt(0) || "G"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-800 truncate">{p.guru?.full_name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 border-t border-slate-100 pt-1.5">
                      <Badge variant="outline" className={`h-4 text-[8px] px-1 font-black uppercase border-none ${p.shift === 'Pagi' ? 'text-blue-600 bg-blue-100' : 'text-amber-600 bg-amber-100'}`}>
                        {p.shift}
                      </Badge>
                      {p.picket_date && (
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded leading-none shrink-0">
                          {new Date(p.picket_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-bold truncate max-w-[100px]">{p.location || "Area Sekolah"}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 py-6 text-center text-slate-400 italic text-sm font-medium border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                  Tidak ada jadwal piket hari ini
                </div>
              )}
            </div>
         </Card>

         {/* School Status / Info */}
         <Card className="bg-[#1e293b] rounded-2xl p-8 shadow-xl shadow-slate-200 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden text-white text-left">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 -mr-32 -mt-32"></div>
            <div className="bg-blue-600/20 p-6 rounded-3xl backdrop-blur-xl border border-white/10 shrink-0">
               <School size={48} className="text-white" />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-black tracking-tight mb-2 uppercase">Profil Sekolah</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
                Terwujudnya peserta didik yang bertaqwa, cerdas, terampil, mandiri dan berwawasan lingkungan.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-tight">Akreditasi</span>
                    <span className="text-xl font-black">Grade A</span>
                 </div>
                 <div className="w-[1px] h-10 bg-white/10 hidden sm:block"></div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-tight">NPSN</span>
                    <span className="text-xl font-black">20302148</span>
                 </div>
                 <div className="w-[1px] h-10 bg-white/10 hidden sm:block"></div>
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-tight">Kurikulum</span>
                    <span className="text-xl font-black">Merdeka</span>
                 </div>
              </div>
            </div>
         </Card>
      </div>
    </div>
  );
}
