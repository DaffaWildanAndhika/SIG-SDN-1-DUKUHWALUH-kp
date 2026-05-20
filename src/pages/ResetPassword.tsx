import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Key, ShieldCheck, ArrowLeft, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we are actually in a recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const hasCode = new URLSearchParams(window.location.search).has("code");
      const hasHash = window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token");
      
      if (!session && !hasHash && !hasCode) {
        toast.error("Sesi pemulihan tidak valid atau kadaluarsa.");
        navigate("/login");
      }
    };
    checkSession();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      return toast.error("Kata sandi tidak cocok.");
    }
    if (newPassword.length < 6) {
      return toast.error("Kata sandi minimal 6 karakter.");
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      toast.success("Kata sandi berhasil diperbarui! Silakan masuk kembali.");
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui kata sandi.");
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
        <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 mb-4">
                <School size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">SDN 1 Dukuhwaluh</h1>
            <p className="text-slate-500 text-sm">Pemulihan Akses Akun</p>
        </div>

        <Card className="border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="h-2 bg-blue-600 w-full"></div>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <ShieldCheck size={20} />
                </div>
                <CardTitle className="text-xl font-bold">Atur Ulang Kata Sandi</CardTitle>
            </div>
            <CardDescription>
              Silakan masukkan kata sandi baru untuk akun Anda.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Kata Sandi Baru</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    id="newPassword" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.01] active:scale-[0.99]" 
                disabled={loading}
              >
                {loading ? "Menyimpan..." : "Perbarui Kata Sandi"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => navigate("/login")}
                className="w-full h-11 text-slate-400 hover:text-slate-600 font-bold flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Kembali ke Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
