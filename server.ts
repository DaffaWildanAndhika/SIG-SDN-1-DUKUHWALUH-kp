import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

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

      // 1. Create the user in Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role }
      });

      if (authError) throw authError;

      // 2. Create the profile
      if (authData.user) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert([{ 
            id: authData.user.id, 
            full_name, 
            role, 
            email,
            is_active: true
          }]);
          
        if (profileError) {
          console.error("Profile creation error:", profileError);
          // We don't necessarily want to fail if the profile insert fails, 
          // but usually it's better to clean up or report.
        }
      }

      res.status(200).json({ status: "success", user: authData.user });
    } catch (error: any) {
      console.error("User creation error:", error);
      res.status(400).json({ error: error.message });
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
