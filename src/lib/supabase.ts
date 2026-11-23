import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError = !url || !anonKey
  ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to a .env file, then restart the dev server."
  : null;

export const supabase = createClient<Database>(
  url || "https://example.supabase.co",
  anonKey || "public-anon-key",
);
