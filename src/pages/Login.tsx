import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Key, Mail, School, Shield, GraduationCap, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'guru'>('admin');
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email, full_name, avatar_url')
          .eq('role', 'guru')
          .limit(3);
        if (!error && data) {
          setTeachers(data);
        }
      } catch (err) {
        console.warn("Failed to fetch teachers for login suggestions:", err);
      }
    };
    fetchTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const emailTrimmed = email.trim().toLowerCase();
    const isSpecialAdminEmail = emailTrimmed === "admin@sekolah.id" || emailTrimmed === "admin@sekolah.is";

    if (selectedRole === 'guru' && isSpecialAdminEmail) {
      toast.error("Akses ditolak: Akun Administrator tidak diizinkan masuk melalui menu Guru.");
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password,
      });

      if (authError) throw authError;

      // Dynamically verify user's role from profile
      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        const actualRole = profile?.role || (isSpecialAdminEmail ? 'admin' : 'guru');

        if (selectedRole === 'guru' && actualRole === 'admin') {
          await supabase.auth.signOut();
          throw new Error("Akses ditolak: Akun Administrator tidak diizinkan masuk melalui menu Guru.");
        }

        if (selectedRole === 'admin' && actualRole === 'guru') {
          await supabase.auth.signOut();
          throw new Error("Akses ditolak: Akun Guru/Pengajar tidak diizinkan masuk melalui menu Administrator.");
        }
      }

      toast.success("Berhasil masuk!");
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-200 mb-4 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center overflow-hidden relative w-16 h-16">
            <img 
              src="/logo.jpg" 
              alt="School Logo" 
              className="absolute inset-0 w-full h-full object-contain bg-blue-600 z-10"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <School className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">SDN 1 Dukuhwaluh</h1>
          <p className="text-slate-500 text-sm">Sistem Informasi Akademik Guru</p>
        </div>

        <Card className="border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="h-1 bg-blue-600 w-full"></div>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold">Selamat Datang</CardTitle>
            <CardDescription>
              Silakan masuk ke akun Anda untuk melanjutkan
            </CardDescription>
          </CardHeader>
          
          {/* Role Choice Selector */}
          <div className="px-6 pb-2">
            <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Pilih Peran Masuk (Role)
            </Label>
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
                  selectedRole === 'admin'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shield size={14} className={selectedRole === 'admin' ? "animate-bounce" : ""} />
                ADMINISTRATOR
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('guru')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
                  selectedRole === 'guru'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap size={15} className={selectedRole === 'guru' ? "animate-bounce" : ""} />
                GURU / PENGAJAR
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email {selectedRole === 'admin' ? 'Admin' : 'Guru'}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder={selectedRole === 'admin' ? 'admin@sekolah.id' : 'nama.guru@sekolah.id'} 
                      className="pl-10 h-11" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      id="password" 
                      type="password" 
                      className="pl-10 h-11" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-white font-semibold" disabled={loading}>
                  {loading ? "Memproses..." : `Masuk Sebagai ${selectedRole === 'admin' ? 'Admin' : 'Guru'}`}
                </Button>
                
                
              </CardFooter>
            </form>
          </Card>
        
        <p className="mt-8 text-center text-slate-400 text-xs text-balance">
          Sistem Informasi Akademik Guru SDN 1 Dukuhwaluh
        </p>
      </div>
    </div>
  );
}
