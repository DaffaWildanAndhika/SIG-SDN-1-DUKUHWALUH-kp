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

// Pages
import Dashboard from "./pages/Dashboard";
import GuruList from "./pages/GuruList";
import JadwalPiket from "./pages/JadwalPiket";
import JadwalMengajar from "./pages/JadwalMengajar";
import Kelas from "./pages/Kelas";
import Pengumuman from "./pages/Pengumuman";
import NilaiSiswa from "./pages/NilaiSiswa";
import Login from "./pages/Login";

const SidebarItem = ({ to, icon: Icon, label, active, collapsed }: { to: string, icon: any, label: string, active: boolean, collapsed: boolean }) => (
  <Link to={to} className="block group">
    <motion.div 
      whileHover={{ x: collapsed ? 0 : 4 }}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 relative ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
      }`}
    >
      <Icon size={20} className={`shrink-0 transition-colors duration-300 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
      {!collapsed && (
        <span className="text-sm font-bold tracking-tight">
          {label}
        </span>
      )}
      {active && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute left-0 w-1 h-5 bg-white rounded-r-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.div>
  </Link>
);

const Layout = ({ user, children }: { user: any, children: React.ReactNode }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbRole, setDbRole] = useState<string>("");
  const location = useLocation();
  
  useEffect(() => {
    const fetchRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (data) setDbRole(data.role);
    };
    fetchRole();
  }, [user.id]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const userRole = dbRole || user?.user_metadata?.role || "guru";
  const isSpecialAdmin = user?.email === "admin@sekolah.is" || user?.email === "admin@sekolah.id";
  const isAdmin = userRole === "admin" || isSpecialAdmin;
  const isGuru = userRole === "guru" || isAdmin;

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
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden relative">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-[#0f172a] flex flex-col border-r border-slate-800/40 shrink-0 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarOpen ? 'lg:w-[260px]' : 'lg:w-24'}
      `}>
        <div className="flex flex-col h-full px-4 py-8">
          {/* Logo Area */}
          <div className="flex items-center justify-between mb-10 px-2">
            <div className={`flex items-center gap-3 ${!isSidebarOpen && !isMobileMenuOpen ? 'mx-auto' : ''}`}>
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shrink-0 overflow-hidden relative shadow-lg shadow-blue-600/20">
                <img 
                  src="/logo.jpg" 
                  alt="School Logo" 
                  className="absolute inset-0 w-full h-full object-contain bg-blue-600 z-10"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <span>S</span>
              </div>
              {(isSidebarOpen || isMobileMenuOpen) && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="flex flex-col overflow-hidden"
                >
                  <span className="text-white font-black leading-none tracking-tighter text-lg uppercase">SIA GURU</span>
                  <span className="text-blue-500/80 text-[9px] mt-1 font-bold uppercase tracking-widest truncate">SDN 1 Dukuhwaluh</span>
                </motion.div>
              )}
            </div>
            {isMobileMenuOpen && (
              <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50">
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            <div className="px-2 mb-4">
              <p className={`text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ${!isSidebarOpen ? 'text-center' : ''}`}>
                {isSidebarOpen ? 'General Menu' : '•••'}
              </p>
              <SidebarItem 
                to="/" 
                icon={LayoutDashboard} 
                label="Dashboard" 
                active={location.pathname === "/"} 
                collapsed={!isSidebarOpen && !isMobileMenuOpen} 
              />
              {isGuru && (
                <SidebarItem 
                  to="/guru" 
                  icon={Users} 
                  label="Data Guru" 
                  active={location.pathname.startsWith("/guru")} 
                  collapsed={!isSidebarOpen && !isMobileMenuOpen} 
                />
              )}
              <SidebarItem 
                to="/piket" 
                icon={Calendar} 
                label="Jadwal Piket" 
                active={location.pathname === "/piket"} 
                collapsed={!isSidebarOpen && !isMobileMenuOpen} 
              />
            </div>

            <div className="px-2 pt-4">
              <p className={`text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ${!isSidebarOpen ? 'text-center' : ''}`}>
                {isSidebarOpen ? 'Academic' : '•••'}
              </p>
              <SidebarItem 
                to="/mengajar" 
                icon={BookOpen} 
                label="Jadwal Mengajar" 
                active={location.pathname === "/mengajar"} 
                collapsed={!isSidebarOpen && !isMobileMenuOpen} 
              />
              {isGuru && (
                <SidebarItem 
                  to="/kelas" 
                  icon={School} 
                  label="Manajemen Kelas" 
                  active={location.pathname === "/kelas"} 
                  collapsed={!isSidebarOpen && !isMobileMenuOpen} 
                />
              )}
              {isGuru && (
                <SidebarItem 
                  to="/nilai" 
                  icon={GraduationCap} 
                  label="Nilai Siswa" 
                  active={location.pathname === "/nilai"} 
                  collapsed={!isSidebarOpen && !isMobileMenuOpen} 
                />
              )}
            </div>

            <div className="px-2 pt-4">
              <p className={`text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ${!isSidebarOpen ? 'text-center' : ''}`}>
                {isSidebarOpen ? 'Others' : '•••'}
              </p>
              <SidebarItem 
                to="/pengumuman" 
                icon={Bell} 
                label="Pengumuman" 
                active={location.pathname === "/pengumuman"} 
                collapsed={!isSidebarOpen && !isMobileMenuOpen} 
              />
            </div>
          </nav>

          {/* User Profile Hook */}
          <div className={`mt-auto pt-6 border-t border-slate-800/40 px-2 ${!isSidebarOpen ? 'flex justify-center' : ''}`}>
            <div className={`flex items-center gap-3 p-3 rounded-2xl bg-slate-900/50 border border-slate-800/40 group hover:border-slate-700 transition-all cursor-pointer`}>
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 shrink-0 flex items-center justify-center text-xs text-blue-400 font-black shadow-inner">
                {user?.user_metadata?.full_name?.charAt(0) || "A"}
              </div>
              {(isSidebarOpen || isMobileMenuOpen) && (
                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user?.user_metadata?.full_name || "Admin Sekolah"}</p>
                  <p className="text-[9px] text-blue-500/70 uppercase tracking-widest font-black mt-0.5">
                    {userRole === "admin" ? "Administrator" : userRole === "kepala_sekolah" ? "Kepala Sek." : "Pengajar"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
              <Menu size={20} />
            </button>
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="hidden lg:flex p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="uppercase tracking-widest text-[10px] font-bold hidden sm:flex">SIA GURU</span>
              <span className="text-slate-300 hidden sm:flex">/</span>
              <span className="text-slate-900 font-semibold truncate max-w-[120px] sm:max-w-none">{getBreadcrumb()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={handleLogout} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors ml-2" title="Keluar">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F8FAFC]">
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
