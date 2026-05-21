import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // Simple Request Logger
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running (v2)", timestamp: new Date().toISOString() });
  });

  // Activity Logs Persistence (Local File on Server as bulletproof persistence)
  const LOGS_FILE_PATH = path.join(process.cwd(), "activity_logs.json");

  // Endpoint to save action log
  app.post("/api/activity-logs", (req, res) => {
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

      logs.unshift(newLog); // Put newest first
      // Keep only last 1000 logs
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

  // Endpoint to retrieve activity logs
  app.get("/api/activity-logs", (req, res) => {
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

  // Endpoint to clear all activity logs
  app.delete("/api/activity-logs", (req, res) => {
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

  // Example API for school info
  app.get("/api/school-info", (req, res) => {
    res.json({
      name: "SD Negeri 1 Dukuhwaluh",
      npsn: "20302148", // Example
      address: "Jl. Raya Dukuhwaluh, Kec. Kembaran, Kab. Banyumas",
    });
  });

  // API for Admin to create teacher accounts
  app.post("/api/admin/create-user", async (req, res) => {
    const { email, password, full_name, role } = req.body;
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Server configuration error: missing Supabase keys" });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // 1. Create the user in Auth with first_login in metadata
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, first_login: true }
      });

      if (authError) throw authError;

      // 2. Create the profile
      if (authData.user) {
        try {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert([{ 
              id: authData.user.id, 
              full_name, 
              role, 
              email,
              avatar_url: password,
              is_active: true,
              first_login: true
            }]);
            
          if (profileError) {
            console.error("Profile creation error, attempting fallback without first_login column:", profileError);
            const { error: fallbackError } = await supabaseAdmin
              .from('profiles')
              .upsert([{ 
                id: authData.user.id, 
                full_name, 
                role, 
                email,
                avatar_url: password,
                is_active: true
              }]);
            if (fallbackError) throw fallbackError;
          }
        } catch (e) {
          console.warn("first_login column not found, falling back:", e);
          await supabaseAdmin
            .from('profiles')
            .upsert([{ 
              id: authData.user.id, 
              full_name, 
              role, 
              email,
              avatar_url: password,
              is_active: true
            }]);
        }
      }

      res.status(200).json({ status: "success", user: authData.user });
    } catch (error: any) {
      console.error("User creation error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // API for Admin to update teacher accounts (including password)
  app.post("/api/admin/update-user", async (req, res) => {
    const { id, email, password, full_name, role, nip, gender, subject, phone, address, is_active } = req.body;
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Server configuration error: missing Supabase keys" });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Fetch the existing profile to compare values
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name, role")
        .eq("id", id)
        .single();

      const updateAuthData: any = {};
      
      // Update password if a new one is provided
      if (password) {
        updateAuthData.password = password;
        updateAuthData.user_metadata = {
          full_name: full_name || (existingProfile?.full_name || ""),
          role: role || (existingProfile?.role || "guru"),
          first_login: true
        };
      }

      // Only attempt to update email in Supabase Auth if it has actually changed
      if (email && (!existingProfile || existingProfile.email !== email)) {
        updateAuthData.email = email;
      }

      // Update user metadata if name or role has changed / is provided but not password
      if (!password && (full_name || role)) {
        updateAuthData.user_metadata = {
          full_name: full_name || (existingProfile?.full_name || ""),
          role: role || (existingProfile?.role || "guru")
        };
      }

      // Perform auth update in a single request if there are changes
      if (Object.keys(updateAuthData).length > 0) {
        try {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateAuthData);
          if (authError) {
            console.warn("Supabase Auth admin update bypassed:", authError.message);
          }
        } catch (authException: any) {
          console.warn("Auth update exception (non-blocking bypass):", authException);
        }
      }

      // 2. Update profiles table
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
        updateFields.avatar_url = password; // store plain-text password so admin can view it
        updateFields.first_login = true;
      }

      try {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(updateFields)
          .eq("id", id);

        if (profileError) {
          console.error("profiles update with first_login failed, attempting fallback:", profileError);
          delete updateFields.first_login;
          const { error: fallbackError } = await supabaseAdmin
            .from("profiles")
            .update(updateFields)
            .eq("id", id);
          if (fallbackError) throw fallbackError;
        }
      } catch (err) {
        console.warn("Table update first_login fallback triggered:", err);
        delete updateFields.first_login;
        await supabaseAdmin
          .from("profiles")
          .update(updateFields)
          .eq("id", id);
      }

      res.status(200).json({ status: "success" });
    } catch (error: any) {
      console.error("User update error:", error);
      res.status(400).json({ error: error?.message || error || "Failed to update user" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});
