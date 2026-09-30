import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../../../.env.local", import.meta.url));
const { error: envError } = config({ path: envPath });

if (envError) {
  throw new Error(`Could not load .env.local at ${envPath}`, {
    cause: envError,
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env.local",
  );
} else {
  console.log("Connected to Database!");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
