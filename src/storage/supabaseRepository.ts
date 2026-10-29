import type { DataDocument } from "../domain/model";
import { supabase } from "./supabaseClient";
import { parseDataDocument } from "./document";

function configuredClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export const supabaseRepository = {
  async load(userId: string): Promise<{ data: DataDocument; version: number } | null> {
    const { data, error } = await configuredClient()
      .from("user_training_documents")
      .select("document, version")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(`Could not load your training data: ${error.message}`);
    return data ? { data: parseDataDocument(data.document), version: data.version } : null;
  },

  async save(userId: string, document: DataDocument, expectedVersion: number): Promise<number> {
    const { data, error } = await configuredClient().rpc("save_training_document", {
      p_document: JSON.parse(JSON.stringify(document)),
      p_expected_version: expectedVersion,
    });

    if (error?.message.includes("document_version_conflict")) {
      throw new Error("Your training data changed in another session. This change was not saved; reload to get the latest copy before continuing.");
    }
    if (error) throw new Error(`Could not save your training data: ${error.message}`);
    if (typeof data !== "number") throw new Error("The server returned an invalid training-data version.");
    return data;
  },
};
