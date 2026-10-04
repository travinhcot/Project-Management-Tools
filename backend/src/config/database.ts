import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../../../.env.local", import.meta.url));
config({ path: envPath, quiet: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env.local",
  );
}

// Never share a mutable user session between requests in a Node server.
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export function createAuthClient() {
  return createClient(supabaseUrl!, supabasePublishableKey!, clientOptions);
}

export function getAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing backend-only SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl!, key, clientOptions);
}

export const supabase = createAuthClient();
