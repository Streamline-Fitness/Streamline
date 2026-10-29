import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import type { Database } from "../src/storage/database.types";

const environment = { ...loadEnv("development", process.cwd(), ""), ...process.env };
const supabaseUrl = environment.VITE_SUPABASE_URL;
const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
const targetEmail = environment.TRAINING_LOG_TARGET_EMAIL?.trim().toLowerCase();
const password = process.env.TRAINING_LOG_NEW_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !targetEmail || !password) {
  throw new Error("Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TRAINING_LOG_TARGET_EMAIL in .env.local, then provide the password through the documented secure PowerShell prompt.");
}
if (password.length < 8) {
  throw new Error("The new password must be at least 8 characters.");
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setPassword(): Promise<void> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not find the account: ${error.message}`);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
    if (user) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
      if (updateError) throw new Error(`Could not set the account password: ${updateError.message}`);
      console.log("Password set for the configured account. Sign in with email and password; no email was sent.");
      return;
    }

    if (data.users.length < 1000) break;
  }
  throw new Error("No Supabase account matches TRAINING_LOG_TARGET_EMAIL. The script did not create an account.");
}

await setPassword();
