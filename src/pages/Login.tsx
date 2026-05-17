import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, Key, Mail, School, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("guru");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Use selected role from state
        const signupRole = role;
        
        // Sign Up with User Metadata
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: signupRole,
            }
          }
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          try {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([
                { 
                  id: signUpData.user.id, 
                  full_name: fullName, 
                  role: signupRole,
                  email: email
                }
              ]);
            if (profileError) console.warn("Note: Profile table sync optional/failed", profileError.message);
          } catch (e) {
            console.warn("Profile sync skipped");
          }
          
          setIsRegistered(true);
          // Clear sensitive data
          setPassword("");
        }

        toast.success("Pendaftaran berhasil!");
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Berhasil masuk!");
      }
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

      {/* Registration Success Dialog */}
      <Dialog open={isRegistered} onOpenChange={setIsRegistered}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl border-none p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="text-emerald-500 w-10 h-10" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Pendaftaran Berhasil!</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium text-base mt-2">
                Terima kasih telah mendaftar di SIA GURU.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 mt-6 w-full">
              <p className="text-blue-700 font-bold text-sm leading-relaxed">
                Silakan cek email Anda untuk konfirmasi akun. Klik tautan verifikasi yang kami kirimkan untuk mengaktifkan akun Anda.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button 
              className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-white font-bold rounded-xl"
              onClick={() => {
                setIsRegistered(false);
                // Clear all fields
                setEmail("");
                setPassword("");
                setFullName("");
                setRole("guru");
              }}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-200 mb-4 cursor-pointer hover:scale-105 transition-transform flex items-center justify-center overflow-hidden relative w-16 h-16"
               onClick={() => {
                 // Sneaky demo bypass remains as a hidden feature if needed
                 if (email === "demo" && password === "demo") {
                   toast.info("Demo mode enabled via console.");
                 }
               }}>
            <img 
              src="/logo_sekolah.png" 
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
          <p className="text-slate-500 text-sm">Sistem Informasi Administrasi Guru</p>
        </div>

        <Card className="border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="h-1 bg-blue-600 w-full"></div>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold">
              {isSignUp ? "Daftar Akun Baru" : "Selamat Datang"}
            </CardTitle>
            <CardDescription>
              {isSignUp 
                ? "Lengkapi data di bawah untuk mendaftar" 
                : "Silakan masuk ke akun Anda untuk melanjutkan"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nama Lengkap</Label>
                    <div className="relative">
                      <LogIn className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        id="fullName" 
                        placeholder="Budi Santoso, S.Pd." 
                        className="pl-10 h-11" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role / Jabatan</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Pilih Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru">Guru / Pengajar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="email@anda.id" 
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
                  {!isSignUp && (
                    <button type="button" className="text-xs text-blue-600 hover:underline">Lupa password?</button>
                  )}
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
                {loading ? "Memproses..." : isSignUp ? "Buat Akun Sekarang" : "Masuk ke Sistem"}
              </Button>
              
              <div className="text-center w-full">
                <button 
                  type="button" 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-slate-600 hover:text-blue-600 font-medium"
                >
                  {isSignUp 
                    ? "Sudah punya akun? Masuk di sini" 
                    : "Belum punya akun? Daftar di sini"}
                </button>
              </div>

              
            </CardFooter>
          </form>
        </Card>
        
        <p className="mt-8 text-center text-slate-400 text-xs">
          &copy; 2026 SDN 1 Dukuhwaluh. Tim IT Sekolah.
        </p>
      </div>
    </div>
  );
}
