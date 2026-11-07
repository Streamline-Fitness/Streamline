import type { SharedWorkoutPlanContent } from "../domain/sharedPlans";
import { parseSharedWorkoutPlanContent } from "../domain/sharedPlans";
import type { ID } from "../domain/model";
import type { AppSupabaseClient } from "./supabaseClient";

export type SharedWorkoutPlanListing = {
  id: string;
  title: string;
  description: string;
  content: SharedWorkoutPlanContent;
  updatedAt: string;
};

export type SharedWorkoutPlanSearchResult = {
  listings: SharedWorkoutPlanListing[];
  warnings: string[];
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The shared plan data is invalid.";
}

export async function searchSharedWorkoutPlans(
  client: AppSupabaseClient,
  query: string,
): Promise<SharedWorkoutPlanSearchResult> {
  const { data, error } = await client.rpc("search_shared_workout_plans", {
    p_query: query.trim() ? query.trim().slice(0, 100) : null,
  });
  if (error) throw new Error(`Could not search shared plans: ${error.message}`);
  const listings: SharedWorkoutPlanListing[] = [];
  const warnings: string[] = [];
  for (const listing of data) {
    try {
      listings.push({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        content: parseSharedWorkoutPlanContent(listing.plan_data),
        updatedAt: listing.updated_at,
      });
    } catch (error) {
      warnings.push(`“${listing.title}” could not be displayed: ${errorMessage(error)}`);
    }
  }
  return { listings, warnings };
}

export async function getSharedPlanVisibility(
  client: AppSupabaseClient,
  userId: string,
  planIds: ID[],
): Promise<Record<ID, boolean>> {
  if (planIds.length === 0) return {};
  const { data, error } = await client
    .from("shared_workout_plans")
    .select("source_plan_id, is_public")
    .eq("owner_id", userId)
    .in("source_plan_id", planIds);
  if (error) throw new Error(`Could not load your shared-plan settings: ${error.message}`);
  return Object.fromEntries(data.map((row) => [row.source_plan_id, row.is_public]));
}

export async function publishSharedWorkoutPlan(
  client: AppSupabaseClient,
  sourcePlanId: ID,
  content: SharedWorkoutPlanContent,
): Promise<void> {
  const { error } = await client.rpc("publish_shared_workout_plan", {
    p_source_plan_id: sourcePlanId,
    p_title: content.name,
    p_description: content.description,
    p_plan_data: content,
  });
  if (error) throw new Error(`Could not share this plan: ${error.message}`);
}

export async function unshareWorkoutPlan(
  client: AppSupabaseClient,
  userId: string,
  sourcePlanId: ID,
): Promise<void> {
  const { error } = await client
    .from("shared_workout_plans")
    .update({ is_public: false })
    .eq("owner_id", userId)
    .eq("source_plan_id", sourcePlanId);
  if (error) throw new Error(`Could not stop sharing this plan: ${error.message}`);
}
