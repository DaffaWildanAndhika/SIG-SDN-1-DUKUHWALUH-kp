import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

// Safe Body Parser Middleware for Vercel Serverless
// In Vercel, the req.body is often pre-parsed into an object before reaching the function.
// Parsing it again can cause requests to hang or time out.
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[Vercel Serverless] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Determine logs path - Vercel only allows writing to /tmp
const LOGS_FILE_PATH = process.env.VERCEL 
  ? path.join("/tmp", "activity_logs.json") 
  : path.join(process.cwd(), "activity_logs.json");

// Router to handle paths without'/api' prefix inside the routes
const apiRouter = express.Router();

// GET /health
apiRouter.get("/health", (req, res) => {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  res.json({ 
    status: "ok", 
    message: "Resilient Serverless API is running", 
    timestamp: new Date().toISOString(),
    diagnostics: {
      has_supabase_url: !(!rawUrl),
      has_supabase_service_role_key: !(!rawKey),
      supabase_url_preview: rawUrl ? `${rawUrl.substring(0, 15)}...` : null,
      environment_keys: Object.keys(process.env).filter(k => 
        k.includes("SUPABASE") || k.includes("SERVICE") || k.includes("PORT") || k.includes("NODE")
      )
    }
  });
});

// GET /school-info
apiRouter.get("/school-info", (req, res) => {
  res.json({
    name: "SD Negeri 1 Dukuhwaluh",
    npsn: "20302148",
    address: "Jl. Raya Dukuhwaluh, Kec. Kembaran, Kab. Banyumas",
  });
});

// GET /supabase-config
apiRouter.get("/supabase-config", (req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  res.json({ url: url || null, anonKey: anonKey || null });
});

// POST /activity-logs
apiRouter.post("/activity-logs", (req, res) => {
  const { user_id, user_fullname, user_role, action, details, prev_data, new_data } = req.body;
  try {
    let logs: any[] = [];
    try {
      if (fs.existsSync(LOGS_FILE_PATH)) {
        const fileData = fs.readFileSync(LOGS_FILE_PATH, "utf-8");
        try {
          logs = JSON.parse(fileData || "[]");
        } catch (pe) {
          logs = [];
        }
      }
    } catch (e) {
      console.warn("Could not read logs file, initializing empty:", e);
    }

    const newLog = {
      id: Math.random().toString(36).substring(2, 11) + "_" + Date.now(),
      user_id,
      user_fullname: user_fullname || "Anonim",
      user_role: user_role || "guru",
      action: action || "Aksi",
      details: details || "",
      prev_data: prev_data || null,
      new_data: new_data || null,
      created_at: new Date().toISOString()
    };

    logs.unshift(newLog);
    if (logs.length > 1000) {
      logs = logs.slice(0, 1000);
    }

    try {
      fs.writeFileSync(LOGS_FILE_PATH, JSON.stringify(logs, null, 2), "utf-8");
    } catch (writeErr) {
      console.error("Failed to write log file to disk:", writeErr);
    }

    res.status(200).json({ status: "success", log: newLog });
  } catch (error: any) {
    console.error("Error writing activity log:", error);
    res.status(200).json({ status: "partial_success", message: error.message });
  }
});

// GET /activity-logs
apiRouter.get("/activity-logs", (req, res) => {
  try {
    let logs = [];
    if (fs.existsSync(LOGS_FILE_PATH)) {
      const fileData = fs.readFileSync(LOGS_FILE_PATH, "utf-8");
      try {
        logs = JSON.parse(fileData || "[]");
      } catch (parseError) {
        console.error("Corrupted logs file resetting to empty array:", parseError);
        logs = [];
      }
    }
    res.status(200).json(logs);
  } catch (error: any) {
    console.error("Error reading activity logs:", error);
    res.status(200).json([]);
  }
});

// DELETE /activity-logs
apiRouter.delete("/activity-logs", (req, res) => {
  try {
    try {
      fs.writeFileSync(LOGS_FILE_PATH, JSON.stringify([], null, 2), "utf-8");
    } catch (writeErr) {
      console.error("Failed to clear log file on disk:", writeErr);
    }
    res.status(200).json({ status: "success", message: "Log aktivitas berhasil dihapus" });
  } catch (error: any) {
    res.status(200).json({ status: "partial_success", message: error.message });
  }
});

// POST /admin/create-user
apiRouter.post("/admin/create-user", async (req, res) => {
  const { email, password, full_name, role } = req.body;
  
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  const supabaseUrl = rawUrl ? rawUrl.trim() : "";
  const supabaseServiceKey = rawKey ? rawKey.trim() : "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Konfigurasi server bermasalah: SUPABASE_SERVICE_ROLE_KEY belum diatur di menu Settings -> Secrets di AI Studio Anda / Environment Variables di Vercel. Silakan isi terlebih dahulu." });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });

    if (authError) throw authError;

    // 2. Create profile
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert([{ 
          id: authData.user.id, 
          full_name, 
          role, 
          email,
          avatar_url: password,
          is_active: true
        }]);
        
      if (profileError) throw profileError;
    }

    res.status(200).json({ status: "success", user: authData.user });
  } catch (error: any) {
    console.error("User creation error:", error);
    res.status(400).json({ error: error.message });
  }
});

// API to verify backup password (avatar_url plain-text fallback) bypassing any RLS issues
apiRouter.post("/auth/verify-bypass", async (req, res) => {
  const { email, password, clientUrl, clientKey } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi." });
  }

  const rawUrl = clientUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || clientKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl) {
    return res.status(500).json({ 
      error: "Fitur masuk pemulihan (Bypass) belum dapat digunakan: Kredensial Supabase URL tidak ditemukan. Pastikan Anda telah membuat file .env untuk lokal, atau mengonfigurasi Environment Variables di dashboard Vercel Anda." 
    });
  }

  if (!rawKey) {
    return res.status(500).json({ 
      error: "Fitur masuk pemulihan (Bypass) belum dapat digunakan: Kredensial Key Supabase tidak ditemukan. Silakan periksa konfigurasi Anda." 
    });
  }

  try {
    const supabaseAdmin = createClient(rawUrl.trim(), rawKey.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Find the profile in database
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role, avatar_url, is_active")
      .ilike("email", email.trim().toLowerCase())
      .maybeSingle();

    if (profileErr) {
      console.error("Bypass profile verification db error:", profileErr);
      return res.status(401).json({ 
        error: `Terjadi gangguan RLS (Row Level Security) database: ${profileErr.message}. Silakan buka SQL Editor di dashboard Supabase Anda lalu jalankan perintah berikut untuk mengizinkan verifikasi akun:\n\nCREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);` 
      });
    }

    if (!profile) {
      return res.status(401).json({ error: "Akun dengan email tersebut tidak ditemukan di database." });
    }

    if (profile.is_active === false) {
      return res.status(401).json({ error: "Akun guru ini dinonaktifkan sementara oleh Administrator." });
    }

    // Check if plain-text password matches avatar_url
    if (profile.avatar_url && profile.avatar_url === password) {
      return res.status(200).json({
        status: "success",
        user: {
          id: profile.id,
          email: profile.email,
          user_metadata: {
            full_name: profile.full_name,
            role: profile.role || "guru"
          }
        }
      });
    }

    return res.status(401).json({ error: "Kata sandi yang Anda masukkan salah atau email tidak cocok." });
  } catch (error: any) {
    console.error("Bypass auth wrapper general error:", error);
    return res.status(500).json({ error: "Gagal memproses verifikasi masuk: " + error.message });
  }
});

// POST /admin/update-user
apiRouter.post("/admin/update-user", async (req, res) => {
  const { id, email, password, full_name, role, nip, gender, subject, phone, address, is_active } = req.body;
  
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  const supabaseUrl = rawUrl ? rawUrl.trim() : "";
  const supabaseServiceKey = rawKey ? rawKey.trim() : "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Konfigurasi server bermasalah: SUPABASE_SERVICE_ROLE_KEY belum diatur di menu Settings -> Secrets di AI Studio Anda / Environment Variables di Vercel. Silakan isi terlebih dahulu." });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch the existing profile
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, role")
      .eq("id", id)
      .single();

    const updateAuthData: any = {};
    
    if (password) {
      updateAuthData.password = password;
      updateAuthData.user_metadata = {
        full_name: full_name || (existingProfile?.full_name || ""),
        role: role || (existingProfile?.role || "guru")
      };
    }

    if (email && (!existingProfile || existingProfile.email !== email)) {
      updateAuthData.email = email;
    }

    if (!password && (full_name || role)) {
      updateAuthData.user_metadata = {
        full_name: full_name || (existingProfile?.full_name || ""),
        role: role || (existingProfile?.role || "guru")
      };
    }

    if (Object.keys(updateAuthData).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateAuthData);
      if (authError) {
        if (password || email) {
          throw new Error(`Gagal memperbarui autentikasi guru di database: ${authError.message}. Pastikan SUPABASE_SERVICE_ROLE_KEY valid.`);
        }
      }
    }

    // Update profiles table
    const updateFields: any = {};
    if (full_name !== undefined) updateFields.full_name = full_name;
    if (email !== undefined) updateFields.email = email;
    if (role !== undefined) updateFields.role = role;
    if (nip !== undefined) updateFields.nip = nip;
    if (gender !== undefined) updateFields.gender = gender;
    if (subject !== undefined) updateFields.subject = subject;
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (is_active !== undefined) updateFields.is_active = is_active;

    if (password) {
      updateFields.avatar_url = password; // Archive raw password
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(updateFields)
      .eq("id", id);

    if (profileError) throw profileError;

    res.status(200).json({ status: "success" });
  } catch (error: any) {
    console.error("User update error:", error);
    res.status(400).json({ error: error?.message || error || "Failed to update user" });
  }
});

// API to update a user's password securely (bypassing any client session missing issues)
apiRouter.post("/auth/update-password", async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: "User ID dan password baru wajib diisi." });
  }

  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  const supabaseUrl = rawUrl ? rawUrl.trim() : "";
  const supabaseServiceKey = rawKey ? rawKey.trim() : "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Konfigurasi server bermasalah: SUPABASE_SERVICE_ROLE_KEY belum diatur di menu Settings -> Secrets di AI Studio Anda / Environment Variables di Vercel. Silakan isi terlebih dahulu." });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Update password in Supabase Auth via Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: password
    });

    if (authError) {
      console.warn("Supabase Auth admin updateUserById returned error:", authError.message);
    }

    // 2. Synchronize plain-text password in profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: password })
      .eq("id", userId);

    if (profileError) throw profileError;

    res.status(200).json({ status: "success" });
  } catch (error: any) {
    console.error("Error in update-password endpoint:", error);
    res.status(500).json({ error: error.message || "Gagal memperbarui kata sandi." });
  }
});

// Mount the apiRouter under both "/api" and "/"
app.use("/api", apiRouter);
app.use("/", apiRouter);

export default app;
