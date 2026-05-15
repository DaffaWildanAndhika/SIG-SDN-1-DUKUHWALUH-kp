import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { 
  Users, 
  Calendar, 
  LayoutDashboard, 
  BookOpen, 
  School, 
  Bell, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  GraduationCap
} from "lucide-react";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "./lib/supabase";
import type { Profile } from "./types";

// Pages
import Dashboard from "./pages/Dashboard";
import GuruList from "./pages/GuruList";
import JadwalPiket from "./pages/JadwalPiket";
import JadwalMengajar from "./pages/JadwalMengajar";
import Kelas from "./pages/Kelas";
import Pengumuman from "./pages/Pengumuman";
import NilaiSiswa from "./pages/NilaiSiswa";
import Login from "./pages/Login";

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link to={to}>
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group ${active ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      <Icon size={18} className={`${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-white'}`} />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  </Link>
);

const Layout = ({ user, children }: { user: any, children: React.ReactNode }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  
  const userRole = user?.user_metadata?.role || "admin";
  const isAdmin = userRole === "admin";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === "/") return "Dashboard Overview";
    if (path.startsWith("/guru")) return "Manajemen Data Guru";
    if (path === "/piket") return "Jadwal Piket Guru";
    if (path === "/mengajar") return "Jadwal Kegiatan Belajar";
    if (path === "/kelas") return "Manajemen Kelas";
    if (path === "/pengumuman") return "Pusat Pengumuman";
    if (path === "/nilai") return "Input Nilai Siswa";
    return "Halaman";
  };

  return (
    <div className="flex h-screen bg-main-bg text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-[#1E293B] flex flex-col border-r border-slate-800 shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shrink-0">
              S
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col overflow-hidden">
                <span className="text-white font-bold leading-none tracking-tight">SIA GURU</span>
                <span className="text-slate-400 text-[10px] mt-1 uppercase tracking-wider truncate">SDN 1 Dukuhwaluh</span>
              </motion.div>
            )}
          </div>

          <nav className="space-y-1">
            <SidebarItem to="/" icon={LayoutDashboard} label={isSidebarOpen ? "Dashboard" : ""} active={location.pathname === "/"} />
            {(isAdmin || userRole === "guru") && (
              <SidebarItem to="/guru" icon={Users} label={isSidebarOpen ? "Data Guru" : ""} active={location.pathname.startsWith("/guru")} />
            )}
            <SidebarItem to="/piket" icon={Calendar} label={isSidebarOpen ? "Jadwal Piket" : ""} active={location.pathname === "/piket"} />
            <SidebarItem to="/mengajar" icon={BookOpen} label={isSidebarOpen ? "Jadwal Mengajar" : ""} active={location.pathname === "/mengajar"} />
            {(isAdmin || userRole === "guru") && (
              <SidebarItem to="/kelas" icon={School} label={isSidebarOpen ? "Manajemen Kelas" : ""} active={location.pathname === "/kelas"} />
            )}
            <SidebarItem to="/pengumuman" icon={Bell} label={isSidebarOpen ? "Pengumuman" : ""} active={location.pathname === "/pengumuman"} />
            {(isAdmin || userRole === "guru") && (
              <SidebarItem to="/nilai" icon={GraduationCap} label={isSidebarOpen ? "Nilai Siswa" : ""} active={location.pathname === "/nilai"} />
            )}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-600 shrink-0 flex items-center justify-center text-[10px] text-white font-bold">
              {user?.user_metadata?.full_name?.charAt(0) || "A"}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.user_metadata?.full_name || "Admin Sekolah"}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  {userRole === "admin" ? "Administrator" : "Guru / Pengajar"}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 hidden sm:flex">
              <span className="uppercase tracking-widest text-[10px] font-bold">SIA GURU</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-semibold">{getBreadcrumb()}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <input type="text" placeholder="Cari data..." className="bg-slate-100 text-sm py-1.5 px-4 rounded-full border border-slate-100 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all focus:w-64" />
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center relative text-slate-500 hover:bg-slate-100 transition-colors">
                <Bell size={18} />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
              </button>
              <button onClick={handleLogout} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors ml-2" title="Keluar">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
           <AnimatePresence mode="wait">
             <motion.div
               key={location.pathname}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
             >
               {children}
             </motion.div>
           </AnimatePresence>
        </div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for real Supabase session first
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
        } else {
          // Fallback to demo mode only if no real session
          const demoUser = localStorage.getItem("demo_user");
          if (demoUser) {
            setSession({ user: JSON.parse(demoUser) });
          }
        }
      } catch (error) {
        console.warn("Supabase connection issue, checking demo mode");
        const demoUser = localStorage.getItem("demo_user");
        if (demoUser) {
          setSession({ user: JSON.parse(demoUser) });
        }
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Clear demo user if real session starts
      if (session) localStorage.removeItem("demo_user");
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("demo_user");
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore if supabase not configured
    }
    setSession(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Menyiapkan sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        <Route path="/*" element={
          session ? (
            <Layout user={session.user}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/guru" element={<GuruList />} />
                <Route path="/piket" element={<JadwalPiket />} />
                <Route path="/mengajar" element={<JadwalMengajar />} />
                <Route path="/kelas" element={<Kelas />} />
                <Route path="/pengumuman" element={<Pengumuman />} />
                <Route path="/nilai" element={<NilaiSiswa />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </Router>
  );
}
