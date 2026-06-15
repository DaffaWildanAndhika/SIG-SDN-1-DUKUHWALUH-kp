
import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Tag,
  GraduationCap,
  Shield,
  Save,
  Key,
  IdCard,
  Building,
  Info,
  Copy,
  Eye,
  EyeOff
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { logActivity } from "../lib/activityLogger";

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("guru");
  const [isBypassMode, setIsBypassMode] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    nip: "",
    full_name: "",
    gender: "Laki-laki",
    subject: "",
    phone: "",
    address: "",
    email: "",
  });

  // School profile states
  const [schoolProfile, setSchoolProfile] = useState({
    name: "SDN 1 DUKUHWALUH",
    vision: "Terwujudnya peserta didik yang bertaqwa, cerdas, terampil, mandiri dan berwawasan lingkungan.",
    accreditation: "Grade A",
    npsn: "20302148",
    curriculum: "Merdeka",
    address: "Jl. Sunan Kalijaga No.1, Dukuhwaluh, Kec. Kembaran, Kabupaten Banyumas, Jawa Tengah 53182",
  });
  const [dbSchoolProfileExists, setDbSchoolProfileExists] = useState(true);
  const [showSchoolSqlInstruction, setShowSchoolSqlInstruction] = useState(false);
  const [schoolSaveLoading, setSchoolSaveLoading] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchProfileData(true);
  }, []);

  const fetchProfileData = async (isInitial = false) => {
    if (isInitial || !formData.full_name) {
      setLoading(true);
    }
    try {
      const demoUser = localStorage.getItem("demo_user");
      const bypass = !!demoUser;
      setIsBypassMode(bypass);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const finalUser = currentUser || (demoUser ? JSON.parse(demoUser) : null);

      if (finalUser) {
        setUser(finalUser);

        // Fetch from profiles table
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", finalUser.id)
          .single();

        let resolvedRole = "guru";
        if (profile) {
          resolvedRole = profile.role || "guru";
          setUserRole(resolvedRole);
          setFormData({
            nip: profile.nip || "",
            full_name: profile.full_name || finalUser.user_metadata?.full_name || "",
            gender: profile.gender || "Laki-laki",
            subject: profile.subject || "",
            phone: profile.phone || "",
            address: profile.address || "",
            email: profile.email || finalUser.email || "",
          });
        } else {
          // Fallback to metadata
          resolvedRole = finalUser.user_metadata?.role || "guru";
          setUserRole(resolvedRole);
          setFormData({
            nip: "",
            full_name: finalUser.user_metadata?.full_name || "",
            gender: "Laki-laki",
            subject: "",
            phone: "",
            address: "",
            email: finalUser.email || "",
          });
        }

        // Fetch school profile if role is admin
        const isSpecialAdmin = finalUser.email === "admin@sekolah.is" || finalUser.email === "admin@sekolah.id";
        const isAdminRole = resolvedRole === "admin" || isSpecialAdmin;
        
        if (isAdminRole) {
          try {
            const { data: schData, error: schErr } = await supabase
              .from("school_profile")
              .select("*")
              .eq("id", 1)
              .single();
            
            if (schErr) {
              if (
                schErr.code === "P0001" || 
                schErr.code === "42P01" || 
                schErr.code?.startsWith("PGRST") || 
                schErr.message?.includes("does not exist") || 
                schErr.message?.includes("schema cache") ||
                schErr.message?.includes("not found")
              ) {
                setDbSchoolProfileExists(false);
              }
              throw schErr;
            }
            if (schData) {
              setSchoolProfile({
                name: schData.name || "SDN 1 DUKUHWALUH",
                vision: schData.vision || "",
                accreditation: schData.accreditation || "Grade A",
                npsn: schData.npsn || "",
                curriculum: schData.curriculum || "Merdeka",
                address: schData.address || ""
              });
              setDbSchoolProfileExists(true);
            }
          } catch (schErr) {
            // Load fallback
            const localProfile = localStorage.getItem("school_profile");
            if (localProfile) {
              try {
                setSchoolProfile(JSON.parse(localProfile));
              } catch (e) {}
            }
          }
        }
      } else {
        toast.error("Sesi tidak ditemukan. Silakan login kembali.");
      }
    } catch (err: any) {
      console.error("Gagal memuat profil:", err.message);
      toast.error("Terjadi kesalahan saat memuat data profil.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      return toast.error("Nama lengkap tidak boleh kosong.");
    }

    setSaveLoading(true);
    if (passwordData.newPassword) {
      localStorage.setItem("session_updating_password", "true");
    }
    try {
      let updateSuccessful = false;

      // 1. Update securely via server API (which updates metadata and handles potential RLS bypass queries)
      try {
        const payload: any = {
          id: user.id,
          full_name: formData.full_name,
          nip: formData.nip || null,
          gender: formData.gender,
          subject: formData.subject || null,
          phone: formData.phone || null,
          address: formData.address || null,
          email: formData.email,
        };

        // If password fields are typed, update password too!
        if (passwordData.newPassword) {
          if (passwordData.newPassword.length < 6) {
            throw new Error("Password baru minimal harus 6 karakter.");
          }
          if (passwordData.newPassword !== passwordData.confirmPassword) {
            throw new Error("Konfirmasi password baru tidak cocok.");
          }
          payload.password = passwordData.newPassword;
        }

        const response = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          updateSuccessful = true;
        } else {
          const errData = await response.json();
          console.warn("Server profile update API returned non-ok:", errData.error);
        }
      } catch (apiErr: any) {
        console.warn("Server API update failed, falling back to direct client update:", apiErr.message);
        if (apiErr.message.includes("Password") || apiErr.message.includes("password")) {
          throw apiErr;
        }
      }

      // 2. Direct client-side update fallback
      try {
        const updateFields: any = {
          full_name: formData.full_name,
          nip: formData.nip || null,
          gender: formData.gender,
          subject: formData.subject || null,
          phone: formData.phone || null,
          address: formData.address || null,
          email: formData.email,
        };

        if (passwordData.newPassword) {
          updateFields.avatar_url = passwordData.newPassword;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update(updateFields)
          .eq("id", user.id);

        if (profileError) {
          console.error("Direct profiles table update failed:", profileError.message);
          if (!updateSuccessful) {
            throw new Error(`Gagal menyimpan perubahan ke database: ${profileError.message}`);
          }
        } else {
          updateSuccessful = true;
        }
      } catch (directErr: any) {
        console.warn("Direct DB update threw exception:", directErr.message);
        if (!updateSuccessful) {
          throw directErr;
        }
      }

      // 3. Client Auth password change (for real Supabase users)
      if (!isBypassMode && passwordData.newPassword) {
        try {
          const { error: authError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
          if (authError) {
            console.warn("Client-side auth updateUser error (ignored):", authError.message);
          }
          // Re-authenticate user immediately with the new password
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: passwordData.newPassword,
          });
          if (signInError) {
            console.warn("Failed to re-authenticate with new password:", signInError.message);
          } else if (signInData?.session) {
            console.log("Successfully re-authenticated with new password.");
          }
        } catch (authError: any) {
          console.warn("Silently ignoring client-side auth update user error:", authError.message);
        }
      }

      // 4. Update the local demo_user storage cache if in bypass mode
      if (isBypassMode) {
        const cachedStr = localStorage.getItem("demo_user");
        if (cachedStr) {
          const cachedUser = JSON.parse(cachedStr);
          cachedUser.email = formData.email;
          cachedUser.user_metadata = {
            ...cachedUser.user_metadata,
            full_name: formData.full_name,
          };
          if (passwordData.newPassword) {
            cachedUser.avatar_url = passwordData.newPassword;
          }
          localStorage.setItem("demo_user", JSON.stringify(cachedUser));
        }
      }

      await logActivity("Perbarui Profil Pribadi", `Memperbarui data profil pribadi (${formData.full_name})`);
      toast.success("Profil Anda berhasil diperbarui!");

      // Clear password field forms
      setPasswordData({
        newPassword: "",
        confirmPassword: "",
      });

      // Reload fresh data
      fetchProfileData();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui profil.");
    } finally {
      localStorage.removeItem("session_updating_password");
      setSaveLoading(false);
    }
  };

  const schoolSqlStatement = `-- Salin perintah SQL berikut ke SQL Editor di Supabase Anda:

CREATE TABLE IF NOT EXISTS school_profile (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL,
  vision TEXT NOT NULL,
  accreditation TEXT NOT NULL,
  npsn TEXT NOT NULL,
  curriculum TEXT NOT NULL,
  address TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT one_row CHECK (id = 1)
);

-- Enable Row Level Security (RLS)
ALTER TABLE school_profile ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read school profile
CREATE POLICY "School profile is viewable by everyone" ON school_profile FOR SELECT USING (true);

-- Allow admins to manage school profile
CREATE POLICY "Admins can manage school profile" ON school_profile FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Insert default row
INSERT INTO school_profile (id, name, vision, accreditation, npsn, curriculum)
VALUES (1, 'SDN 1 DUKUHWALUH', 'Terwujudnya peserta didik yang bertaqwa, cerdas, terampil, mandiri dan berwawasan lingkungan.', 'Grade A', '20302148', 'Merdeka')
ON CONFLICT (id) DO NOTHING;`;

  const handleUpdateSchoolProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolProfile.name.trim()) {
      return toast.error("Nama sekolah tidak boleh kosong.");
    }
    setSchoolSaveLoading(true);
    try {
      const payload = {
        id: 1,
        name: schoolProfile.name,
        vision: schoolProfile.vision,
        accreditation: schoolProfile.accreditation,
        npsn: schoolProfile.npsn,
        curriculum: schoolProfile.curriculum,
        address: schoolProfile.address
      };

      let savedToDb = false;

      if (dbSchoolProfileExists) {
        try {
          const { error } = await supabase
            .from("school_profile")
            .upsert(payload);
          
          if (error) throw error;
          savedToDb = true;
        } catch (dbErr: any) {
          console.warn("School profile DB upsert failed:", dbErr.message);
          if (
            dbErr.code === "42P01" || 
            dbErr.code?.startsWith("PGRST") || 
            dbErr.message?.includes("does not exist") || 
            dbErr.message?.includes("schema cache") ||
            dbErr.message?.includes("not found")
          ) {
            setDbSchoolProfileExists(false);
          } else {
            throw dbErr;
          }
        }
      }

      // Always save to local storage as fallback/cache
      localStorage.setItem("school_profile", JSON.stringify(schoolProfile));

      await logActivity("Perbarui Profil Sekolah", `Memperbarui data profil sekolah (${schoolProfile.name})`);
      
      if (savedToDb) {
        toast.success("Profil sekolah berhasil disinkronkan ke cloud database!");
      } else {
        toast.success("Profil sekolah disimpan lokal di browser! Hubungi Admin untuk setup tabel PostgreSQL.");
      }
    } catch (err: any) {
      console.error("Gagal memperbarui profil sekolah:", err);
      toast.error(err.message || "Gagal memperbarui profil sekolah.");
    } finally {
      setSchoolSaveLoading(false);
    }
  };

  const handleCopySchoolSql = () => {
    navigator.clipboard.writeText(schoolSqlStatement);
    toast.success("Script SQL berhasil disalin ke clipboard!");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">Memuat Profil Saya...</p>
      </div>
    );
  }

  const isTeacher = userRole === "guru";
  const displayRole = userRole === "admin"
    ? "Administrator"
    : userRole === "kepala_sekolah"
      ? "Kepala Sekolah"
      : "Guru Pengajar";

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-[#0f172a] text-white rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-2xl shadow-slate-900/10 border border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl transform -translate-x-10 translate-y-10" />

        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="w-24 h-24 rounded-3xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-3xl font-black text-blue-400 shadow-inner shrink-0 uppercase">
            {formData.full_name?.charAt(0) || "U"}
          </div>
          <div className="text-center md:text-left space-y-2 overflow-hidden flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest rounded-full">
              <Shield size={12} className="shrink-0" />
              {displayRole}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase truncate">
              {formData.full_name || "Nama Pengguna"}
            </h1>
            <p className="text-slate-400 font-medium text-sm flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {formData.email}</span>
              {formData.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {formData.phone}</span>}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleUpdateProfile} className="space-y-8">
        {/* Info Detail Card */}
        <div className="bg-white rounded-[32px] border border-slate-200/60 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Informasi Pengguna</h2>
              <p className="text-slate-500 text-xs font-semibold">Tinjau dan edit biodata diri Anda</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</Label>
              <div className="relative">
                <Input
                  placeholder="Nama Lengkap sesuai SK"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (Akun Login)</Label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="name@sekolah.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Nomor HP */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor Handphone (Hp/WA)</Label>
              <div className="relative">
                <Input
                  placeholder="Contoh: 08123456789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenis Kelamin</Label>
              <Select
                value={formData.gender}
                onValueChange={(val) => setFormData({ ...formData, gender: val })}
              >
                <SelectTrigger className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 text-left px-4 focus-visible:ring-blue-500">
                  <SelectValue placeholder="Pilih Jenis Kelamin" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 font-bold text-slate-600">
                  <SelectItem value="Laki-laki" className="rounded-xl">Laki-laki</SelectItem>
                  <SelectItem value="Perempuan" className="rounded-xl">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* NIP (Bila Guru) */}
            {isTeacher && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIP (Nomor Induk Pegawai)</Label>
                <div className="relative">
                  <Input
                    placeholder="Masukkan NIP jika ada"
                    value={formData.nip}
                    onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                    className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500 mb-1"
                  />
                </div>
              </div>
            )}

            {/* Mata Pelajaran (Bila Guru) */}
            {isTeacher && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bidang Studi / Mata Pelajaran</Label>
                <div className="relative">
                  <Input
                    placeholder="Contoh: Matematika, Wali Kelas II"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Role (Read Only Display) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hak Akses Sistem</Label>
              <div className="h-12 flex items-center px-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm border-none pointer-events-none uppercase">
                {userRole}
              </div>
            </div>

            {/* Alamat (Full Width) */}
            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Tempat Tinggal</Label>
              <div className="relative">
                <Input
                  placeholder="Tuliskan alamat domisili lengkap Anda"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-[32px] border border-slate-200/60 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Keamanan Kata Sandi</h2>
              <p className="text-slate-500 text-xs font-semibold">Ubah sandi login Anda sewaktu-waktu</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Baru</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Minimal 6 karakter"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500 pr-12 w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Konfirmasi Password Baru</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ulangi password baru"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500 pr-12 w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Button */}
        <div className="flex justify-end gap-3">
          <Button
            type="submit"
            disabled={saveLoading}
            className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 shadow-lg shadow-blue-200/50 fill-none flex items-center gap-2 uppercase tracking-wide text-sm"
          >
            <Save size={18} />
            {saveLoading ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </form>

      {/* School Profile Card (Admin Only) */}
      {userRole === "admin" && (
        <form onSubmit={handleUpdateSchoolProfile} className="space-y-8 mt-8">
          <div className="bg-white rounded-[32px] border border-slate-200/60 p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Building size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Profil Sekolah</h2>
                  <p className="text-slate-500 text-xs font-semibold">Kelola informasi instansi sekolah</p>
                </div>
              </div>
            </div>

            {/* SQL Setup Fallback Alert Banner */}
            {!dbSchoolProfileExists && (
              <Card className="border-amber-200 bg-amber-50/50 rounded-3xl overflow-hidden shadow-sm">
                <CardContent className="p-6 md:p-8 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                      <Info size={20} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">INFORMASI SINKRONISASI DATABASE</h3>
                      <p className="text-slate-600 text-xs font-bold leading-relaxed">
                        Tabel <code className="bg-amber-100/60 px-1.5 py-0.5 rounded font-mono text-amber-800">school_profile</code> belum terdeteksi di database Supabase Anda. Untuk saat ini data profil sekolah akan disimpan secara lokal di browser ini. Agar dapat tersimpan permanen di cloud dan diakses oleh pengguna lain, silakan beralih ke editor Supabase lalu jalankan script SQL pembentuk tabel.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pl-14">
                    <Button 
                      variant="outline" 
                      type="button"
                      onClick={() => setShowSchoolSqlInstruction(!showSchoolSqlInstruction)}
                      className="h-10 rounded-xl bg-white border-amber-200 font-bold text-xs text-amber-800 uppercase tracking-wider"
                    >
                      {showSchoolSqlInstruction ? "Sembunyikan SQL Setup" : "Lihat SQL Setup"}
                    </Button>
                    <Button 
                      type="button"
                      onClick={handleCopySchoolSql}
                      className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2"
                    >
                      <Copy size={14} />
                      Salin Script SQL
                    </Button>
                  </div>

                  {showSchoolSqlInstruction && (
                    <div className="mt-4 p-4 pl-14 bg-slate-900 rounded-2xl overflow-x-auto border border-slate-850">
                      <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre leading-normal">
                        {schoolSqlStatement}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nama Sekolah */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Sekolah</Label>
                <Input
                  placeholder="Nama Sekolah"
                  value={schoolProfile.name}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, name: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>

              {/* NPSN */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NPSN</Label>
                <Input
                  placeholder="Nomor Pokok Sekolah Nasional"
                  value={schoolProfile.npsn}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, npsn: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>

              {/* Akreditasi */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Akreditasi</Label>
                <Input
                  placeholder="Contoh: Grade A"
                  value={schoolProfile.accreditation}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, accreditation: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>

              {/* Kurikulum */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kurikulum</Label>
                <Input
                  placeholder="Contoh: Kurikulum Merdeka"
                  value={schoolProfile.curriculum}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, curriculum: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>

              {/* Visi Sekolah (Full Width) */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visi Sekolah</Label>
                <Input
                  placeholder="Visi Sekolah"
                  value={schoolProfile.vision}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, vision: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                  required
                />
              </div>

              {/* Alamat Sekolah (Full Width) */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Lengkap Sekolah</Label>
                <Input
                  placeholder="Alamat sekolah"
                  value={schoolProfile.address}
                  onChange={(e) => setSchoolProfile({ ...schoolProfile, address: e.target.value })}
                  className="h-12 bg-slate-50/50 border-none rounded-2xl font-bold text-slate-600 focus-visible:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={schoolSaveLoading}
              className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-10 shadow-lg shadow-indigo-200/50 fill-none flex items-center gap-2 uppercase tracking-wide text-sm"
            >
              <Save size={18} />
              {schoolSaveLoading ? "Menyimpan..." : "Simpan Profil Sekolah"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
