import { useEffect, useState } from "react";
import { newId } from "../domain/ids";
import { formatTarget } from "../domain/plan";
import { planBlockLabels, weekdayLabels } from "../domain/model";
import { createImportedPlan } from "../domain/sharedPlans";
import type { Action } from "../state/reducer";
import type { AppSupabaseClient } from "../storage/supabaseClient";
import { searchSharedWorkoutPlans, type SharedWorkoutPlanListing } from "../storage/sharedWorkoutPlansRepository";

type Props = { dispatch: (action: Action) => void; client: AppSupabaseClient };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Shared plans could not be loaded.";
}

function displayTitle(title: string): string {
  return title.replace(/^\s*#+\s*/, "").trim();
}

function dayGroups(listing: SharedWorkoutPlanListing) {
  return listing.content.days.map((day) => ({
    day,
    blocks: listing.content.blocks
      .filter((block) => block.dayId === day.id)
      .sort((a, b) => a.order - b.order)
      .map((block) => ({
        block,
        exercises: listing.content.planExercises
          .filter((item) => item.blockId === block.id)
          .sort((a, b) => a.order - b.order),
      })),
  }));
}

function planCounts(listing: SharedWorkoutPlanListing) {
  const restDays = listing.content.days.filter((day) => day.isRestDay).length;
  const workoutDays = listing.content.days.length - restDays;
  const exerciseCount = listing.content.planExercises.length;
  const blockCount = listing.content.blocks.length;
  return [
    `${workoutDays} ${workoutDays === 1 ? "workout day" : "workout days"}`,
    ...(restDays ? [`${restDays} ${restDays === 1 ? "rest day" : "rest days"}`] : []),
    `${blockCount} ${blockCount === 1 ? "block" : "blocks"}`,
    `${exerciseCount} ${exerciseCount === 1 ? "exercise assignment" : "exercise assignments"}`,
  ];
}

export function CommunityPlansScreen({ dispatch, client }: Props) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [listings, setListings] = useState<SharedWorkoutPlanListing[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    setWarnings([]);
    void searchSharedWorkoutPlans(client, submittedQuery)
      .then((result) => {
        if (active) {
          setListings(result.listings);
          setWarnings(result.warnings);
        }
      })
      .catch((failure: unknown) => { if (active) setError(errorMessage(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, submittedQuery]);

  function copyPlan(listing: SharedWorkoutPlanListing) {
    try {
      const importedPlan = createImportedPlan(listing.content, newId, Date.now());
      dispatch({ type: "IMPORT_SHARED_PLAN", importedPlan });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <section className="screen narrow-screen">
      <div className="section-heading"><div><div className="eyebrow">COMMUNITY</div><h2>Discover plans</h2><p>Search plans other members chose to share, then copy one into your private plan library.</p></div></div>
      <form className="community-search" onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query.trim().slice(0, 100)); }}>
        <input value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder="Search plan names and descriptions" aria-label="Search shared workout plans" />
        <button className="button primary" type="submit" disabled={loading}>Search</button>
      </form>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {warnings.map((warning, index) => <p className="error-banner" role="alert" key={`${index}-${warning}`}>{warning}</p>)}
      {loading ? <p role="status">Searching shared plans…</p> : listings.length === 0
        ? <div className="empty-panel"><h3>No shared plans found</h3><p>{submittedQuery ? "Try another search, or check back later." : "When members share plans, they will appear here."}</p></div>
        : <div className="plan-list">{listings.map((listing) => <article className="plan-card community-plan-card" key={listing.id}>
          <div className="community-plan-heading">
            <div className="community-plan-title">
              <span className="community-label">Shared plan</span>
              <h3>{displayTitle(listing.title)}</h3>
            </div>
            <time className="community-updated" dateTime={listing.updatedAt}>Updated {new Date(listing.updatedAt).toLocaleDateString()}</time>
          </div>
          {listing.description && <p className={expandedDescriptions[listing.id] ? "community-description expanded" : "community-description"}>{listing.description}</p>}
          {listing.description.length > 180 && <button className="community-description-toggle" aria-expanded={expandedDescriptions[listing.id] ?? false} onClick={() => setExpandedDescriptions((current) => ({ ...current, [listing.id]: !current[listing.id] }))}>
            {expandedDescriptions[listing.id] ? "Show less" : "Read full description"}
          </button>}
          <ul className="community-plan-facts" aria-label="Plan summary">
            {planCounts(listing).map((count) => <li key={count}>{count}</li>)}
          </ul>
          <div className="community-day-list">
            <span className="community-section-label">In this plan</span>
            <ul>{listing.content.days.map((day) => <li className={day.isRestDay ? "rest-day" : ""} key={day.id}>{day.weekday ? `${weekdayLabels[day.weekday]} · ` : ""}{day.name}{day.isRestDay ? " · Rest" : ""}</li>)}</ul>
          </div>
          <details className="community-plan-details">
            <summary>Preview days and exercises</summary>
            <div className="community-day-details">{dayGroups(listing).map(({ day, blocks }) => <section key={day.id}>
              <h4>{day.name}{day.isRestDay ? " · Rest day" : ""}</h4>
              {blocks.length === 0 ? <p className="community-empty-day">{day.isRestDay ? "Rest and recovery" : "No exercises in this day."}</p> : blocks.map(({ block, exercises }) => <div className="community-block-preview" key={block.id}>
                <h5>{block.name} <span>{planBlockLabels[block.type]}</span></h5>
                {exercises.length === 0 ? <p className="community-empty-day">No exercises in this block.</p> : <ul>{exercises.map((item) => {
                  const exercise = listing.content.exercises.find((candidate) => candidate.id === item.exerciseId);
                  return <li key={item.id}><span>{exercise?.name ?? "Exercise"}</span><span>{formatTarget(item)}</span></li>;
                })}</ul>}
              </div>)}
            </section>)}</div>
          </details>
          <button className="button secondary community-copy-button" onClick={() => copyPlan(listing)}>Copy plan to My Plans</button>
        </article>)}</div>}
      <div className="info-panel"><strong>Your workouts remain yours</strong><p>Discover never shows a member’s email or workout history. Copying a plan makes an independent, private version you can edit without changing the shared original.</p></div>
    </section>
  );
}
