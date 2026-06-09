import { createClient } from "@supabase/supabase-js";

const url = "https://xqgoyzywgfzfthewvqfh.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZ295enl3Z2Z6ZnRoZXd2cWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIwNjk1OCwiZXhwIjoyMDkzNzgyOTU4fQ.0FWjskYXVEkL5-J4oL-BhJIdjfyaGqYdoowHkR_sM4g";

const supabase = createClient(url, key);

async function check() {
  console.log("=== PROFILES ===");
  const { data: profiles, error: err1 } = await supabase.from("profiles").select("id, full_name, role, email");
  if (err1) console.error("Error profiles:", err1);
  else console.log(profiles);

  console.log("=== CLASSES ===");
  const { data: classes, error: err2 } = await supabase.from("classes").select("id, name, wali_kelas_id, academic_year");
  if (err2) console.error("Error classes:", err2);
  else console.log(classes);

  console.log("=== TEACHING SCHEDULES ===");
  const { data: schedules, error: err3 } = await supabase.from("teaching_schedules").select("id, guru_id, class_id, subject");
  if (err3) console.error("Error schedules:", err3);
  else console.log(schedules);
}

check();
