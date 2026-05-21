import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Key, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface ChangePasswordProps {
  user: any;
  onPasswordChanged: () => void;
}

export default function ChangePassword({ user, onPasswordChanged }: ChangePasswordProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error("Konfirmasi password tidak cocok.");
    }
    if (newPassword.length < 6) {
      return toast.error("Password baru minimal harus 6 karakter.");
    }

    setLoading(true);
    try {
      // 1. Update password using official Supabase auth API
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (authError) throw authError;

      // 2. Set first_login = false in both profiles table and user_metadata
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_login: false })
        .eq("id", user.id);
      
      if (profileError) {
        console.warn("Table profile update error, continuing fallback sync...", profileError.message);
      }

      // Also update Auth metadata to keep in complete sync
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { first_login: false }
      });
      if (metadataError) {
        console.warn("Metadata edit warning:", metadataError.message);
      }

      await logActivity("Ubah Password Wajib", `Mengganti password pertama kali untuk akun: ${user.email}`);

      toast.success("Password Anda berhasil diperbarui! Selamat datang.");
      onPasswordChanged(); // notify parent to update state and redirect
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">SDN 1 Dukuhwaluh</h1>
          <p className="text-slate-500 text-sm font-medium animate-pulse">Ubah Password Wajib</p>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
          
          <div className="mb-6 space-y-2" id="psswd-instruct-box">
            <h2 className="text-xl font-black text-slate-900">Ubah Password Pertama</h2>
            <p className="text-sm font-semibold text-rose-500 bg-rose-50 px-4 py-2.5 rounded-2xl flex items-start gap-2 border border-rose-100 leading-relaxed">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" id="shield-alert-icon" />
              <span>Silakan ganti password sementara Anda terlebih dahulu demi keamanan akun Anda.</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chgPswd" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Baru</Label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  id="chgPswd"
                  type="password"
                  placeholder="Password baru minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 pl-12 bg-slate-50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chgPswdConfirm" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Konfirmasi Password Baru</Label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  id="chgPswdConfirm"
                  type="password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pl-12 bg-slate-50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>
            </div>

            <Button
              id="btn-sub-password"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
            >
              {loading ? "Menyimpan..." : "Perbarui Password & Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
