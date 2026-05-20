import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { LogIn, Key, Mail, School, ShieldCheck } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Forgot Password State
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [emailResetLoading, setEmailResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success("Berhasil masuk!");
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailResetLoading(true);

    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${origin}/ResetPassword`,
      });

      if (error) throw error;
      
      toast.success("Email pemulihan dikirim! Silakan periksa inbox atau folder spam Anda.");
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengirim email pemulihan.");
    } finally {
      setEmailResetLoading(false);
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
            <CardTitle className="text-xl font-bold">Selamat Datang</CardTitle>
            <CardDescription>
              Silakan masuk ke akun Anda untuk melanjutkan
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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
                    <button 
                      type="button" 
                      onClick={() => setIsResetDialogOpen(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Lupa password?
                    </button>
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
                  {loading ? "Memproses..." : "Masuk ke Sistem"}
                </Button>
                
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 w-full space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    Gunakan Akun Berikut:
                  </p>
                  <button 
                    type="button"
                    onClick={() => { setEmail("admin@sekolah.id"); setPassword("admin123"); }}
                    className="text-[11px] text-slate-600 hover:bg-white hover:shadow-sm p-2 rounded-lg transition-all text-left flex items-center justify-between w-full font-bold border border-transparent hover:border-blue-100"
                  >
                    <span className="text-blue-600">Login Admin</span>
                    <span className="font-mono text-blue-400">admin@sekolah.id</span>
                  </button>
                </div>
              </CardFooter>
            </form>
          </Card>
        
        <p className="mt-8 text-center text-slate-400 text-xs text-balance">
          Sistem Informasi Administrasi Guru SDN 1 Dukuhwaluh
        </p>
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[32px] border-none shadow-2xl overflow-hidden p-0 bg-white">
          <div className="h-2 bg-blue-600 w-full" />
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                <ShieldCheck size={24} />
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Lupa Password</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Masukkan email Anda untuk menerima link pemulihan kata sandi.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEmailReset} className="space-y-6">
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-[12px] text-blue-700 leading-relaxed font-bold flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-[11px]">i</span>
                  Kami akan mengirimkan link khusus ke email Anda untuk membuat kata sandi baru.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Terdaftar</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    type="email" 
                    placeholder="email@anda.id" 
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="h-12 pl-12 bg-slate-50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500 w-full"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={emailResetLoading}
                className="w-full h-12 mt-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {emailResetLoading ? "Mengirim..." : "Kirim Link Pemulihan"}
              </Button>
            </form>

            <div className="mt-8 pt-4 border-t border-slate-100 text-center">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsResetDialogOpen(false)}
                className="w-full h-10 rounded-xl font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
              >
                Kembali ke Login
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
