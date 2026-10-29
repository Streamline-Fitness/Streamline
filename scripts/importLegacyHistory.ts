import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { createSeedData } from "../src/domain/seed";
import { withLegacyHistory } from "./legacyHistory";
import type { DataDocument } from "../src/domain/model";
import type { Database } from "../src/storage/database.types";
import { parseDataDocument } from "../src/storage/document";

const environment = { ...loadEnv("development", process.cwd(), ""), ...process.env };
const supabaseUrl = environment.VITE_SUPABASE_URL;
const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
const targetEmail = environment.TRAINING_LOG_TARGET_EMAIL?.trim().toLowerCase();

if (!supabaseUrl || !serviceRoleKey || !targetEmail) {
  throw new Error("Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TRAINING_LOG_TARGET_EMAIL before running this private migration.");
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserId(email: string): Promise<string> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not find the target account: ${error.message}`);
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 1000) break;
  }
  throw new Error("No Supabase account matches TRAINING_LOG_TARGET_EMAIL. Sign in once before running this migration.");
}

async function importHistory(): Promise<void> {
  const userId = await findUserId(targetEmail);
  const { data: existing, error: loadError } = await admin
    .from("user_training_documents")
    .select("document, version")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw new Error(`Could not read the target account's training data: ${loadError.message}`);

  const current = existing ? parseDataDocument(existing.document) : createSeedData();
  const merged: DataDocument = withLegacyHistory(current);
  const importedSessions = Object.values(merged.sessions).filter((session) => session.importKey?.startsWith("legacy-log:")).length;
  const expectedSessions = 46;
  if (importedSessions !== expectedSessions) {
    throw new Error(`Expected ${expectedSessions} bundled historical sessions, found ${importedSessions}; no data was written.`);
  }

  if (existing && importedSessions === Object.values(current.sessions).filter((session) => session.importKey?.startsWith("legacy-log:")).length) {
    console.log("The supplied history is already present in the target account; no changes made.");
    return;
  }

  if (!existing) {
    const { error } = await admin.from("user_training_documents").insert({
      user_id: userId,
      document: JSON.parse(JSON.stringify(merged)),
      version: 1,
    });
    if (error) throw new Error(`Could not create the account training document: ${error.message}`);
  } else {
    const { data, error } = await admin
      .from("user_training_documents")
      .update({ document: JSON.parse(JSON.stringify(merged)), version: existing.version + 1 })
      .eq("user_id", userId)
      .eq("version", existing.version)
      .select("user_id")
      .maybeSingle();
    if (error) throw new Error(`Could not add the supplied history to the account: ${error.message}`);
    if (!data) throw new Error("The account data changed during migration. No history was written; rerun after resolving the latest data.");
  }

  console.log(`Added the supplied history to the selected account (${importedSessions} sessions).`);
}

await importHistory();
