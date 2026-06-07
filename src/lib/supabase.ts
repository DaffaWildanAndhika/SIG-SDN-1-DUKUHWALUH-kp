/// <reference types="vite/client" />
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let dynamicUrl: string | null = null;
let dynamicKey: string | null = null;

export const setDynamicSupabaseCredentials = (url: string, key: string) => {
  if (url && key) {
    dynamicUrl = url.trim();
    dynamicKey = key.trim();
    client = createClient(dynamicUrl, dynamicKey);
    console.log("Supabase Client initialized dynamically:", dynamicUrl);
  }
};

const getClient = (): SupabaseClient => {
  if (client) return client;
  
  const url = dynamicUrl || import.meta.env.VITE_SUPABASE_URL;
  const key = dynamicKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
  
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
