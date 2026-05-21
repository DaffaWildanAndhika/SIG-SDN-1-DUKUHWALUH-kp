import { supabase } from "./supabase";

// In-memory cache for current user and profile data to avoid heavy Supabase queries on every single log
let cachedUser: any = null;
let cachedProfile: any = null;
let cacheFetchedAt = 0;
const CACHE_TTL = 10 * 60 * 1000; // Cache for 10 minutes

async function getActorInfo() {
  const now = Date.now();
  if (cachedUser && cachedProfile && (now - cacheFetchedAt < CACHE_TTL)) {
    return { user: cachedUser, profile: cachedProfile };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    cachedUser = user;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    cachedProfile = profile || {};
    cacheFetchedAt = now;
    return { user, profile: cachedProfile };
  } catch (error) {
    console.warn("Error fetching actor info for logger:", error);
    if (cachedUser) {
      return { user: cachedUser, profile: cachedProfile || {} };
    }
    return null;
  }
}

export async function logActivity(action: string, details: string, prevData?: any, newData?: any) {
  // We perform the actual logging asynchronously to NEVER block the user's main dynamic action (e.g., adding schedule, grading, etc.)
  // By not awaiting the async wrapper, the UI continues instantly.
  (async () => {
    try {
      const actorInfo = await getActorInfo();
      if (!actorInfo || !actorInfo.user) return;

      const { user, profile } = actorInfo;
      const fullName = profile?.full_name || user.user_metadata?.full_name || user.email || "Pengguna";
      const role = profile?.role || user.user_metadata?.role || "guru";

      const newLog = {
        id: Math.random().toString(36).substring(2, 11) + "_" + Date.now(),
        user_id: user.id,
        user_fullname: fullName,
        user_role: role,
        action,
        details,
        prev_data: prevData || null,
        new_data: newData || null,
        created_at: new Date().toISOString()
      };

      // Store in localStorage as immediate backup for hybrid loading
      try {
        const existingStr = localStorage.getItem("activity_logs_backup") || "[]";
        let existingLogs = JSON.parse(existingStr);
        if (!Array.isArray(existingLogs)) existingLogs = [];
        existingLogs.unshift(newLog);
        if (existingLogs.length > 500) existingLogs = existingLogs.slice(0, 500);
        localStorage.setItem("activity_logs_backup", JSON.stringify(existingLogs));
      } catch (err) {
        console.warn("localStorage log write failed:", err);
      }

      // Send to server in the background (fire-and-forget, no awaiting this network call)
      fetch("/api/activity-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLog)
      }).catch(err => {
        console.warn("Background log request failed:", err);
      });

    } catch (error) {
      console.warn("Failed to write background activity log:", error);
    }
  })();

  // Return immediately to make the execution completely non-blocking
  return;
}
