const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xqgoyzywgfzfthewvqfh.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZ295enl3Z2Z6ZnRoZXd2cWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIwNjk1OCwiZXhwIjoyMDkzNzgyOTU4fQ.0FWjskYXVEkL5-J4oL-BhJIdjfyaGqYdoowHkR_sM4g";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('subjects').select('*').limit(1);
  if (error) {
    console.error('Error fetching subjects:', error);
  } else {
    console.log('Subjects columns:', data.length > 0 ? Object.keys(data[0]) : 'No data, but table exists');
  }
}
run();
