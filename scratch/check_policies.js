import { createClient } from "@supabase/supabase-js";

const url = "https://xqgoyzywgfzfthewvqfh.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZ295enl3Z2Z6ZnRoZXd2cWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIwNjk1OCwiZXhwIjoyMDkzNzgyOTU4fQ.0FWjskYXVEkL5-J4oL-BhJIdjfyaGqYdoowHkR_sM4g";

const supabase = createClient(url, key);

async function check() {
  console.log("=== POLICIES ON attendance ===");
  const { data, error } = await supabase.rpc("get_policies"); // Wait, RPC might not exist, let's run a raw query
  
  // We can query pg_policies using an sql RPC, or we can just try to run sql if there is an rpc function.
  // Wait, let's query pg_policies using postgres syntax if we have a way.
  // Wait, does Supabase have a way to run raw SQL? Usually not via the client, unless we have a specific RPC.
  // Let's check if there are any RPC functions.
  // Let's run a query on `pg_catalog.pg_policies`.
  // Wait, we can't run raw SQL from client.
  // But we can check if the user is authenticated, or if there is a policy issue.
  // Let's see what policies exist by checking what tables are present.
  console.log("Trying to read from attendance:");
  const { data: att, error: attErr } = await supabase.from("attendance").select("*").limit(5);
  console.log("Read attendance:", att, attErr);
}

check();
