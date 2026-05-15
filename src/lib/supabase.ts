/// <reference types="vite/client" />
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const getClient = (): SupabaseClient => {
  if (client) return client;
  
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  // Basic validation and check for common placeholder strings
  const isValid = url && 
                  key && 
                  url !== "" && 
                  !url.includes("your-project") && 
                  !key.includes("your-anon-key");

  if (!isValid) {
    throw new Error(
      "Supabase configuration is missing or invalid. " +
      "Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables/secrets. " +
      "See SUPABASE_SETUP.md for instructions."
    );
  }
  
  client = createClient(url, key);
  return client;
};

/**
 * Lazy-initialized Supabase client.
 * This proxy avoids crashing the app on load if environment variables are missing.
 * It will only throw an error when a property or method is accessed.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => {
    const c = getClient();
    const value = (c as any)[prop];
    
    // If the value is a function, bind it to the client instance
    if (typeof value === 'function') {
      return value.bind(c);
    }
    return value;
  }
});
