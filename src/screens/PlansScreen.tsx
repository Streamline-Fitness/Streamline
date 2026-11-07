import { useEffect, useState } from "react";
import { newId } from "../domain/ids";
import { getPlanDays } from "../domain/plan";
import { createSharedWorkoutPlanContent, isPlanEligibleForSharing } from "../domain/sharedPlans";
import type { AppState } from "../state/appState";
import type { Action } from "../state/reducer";
import type { AppSupabaseClient } from "../storage/supabaseClient";
import { getSharedPlanVisibility, publishSharedWorkoutPlan, unshareWorkoutPlan } from "../storage/sharedWorkoutPlansRepository";

type Props = { state: AppState; dispatch: (action: Action) => void; client: AppSupabaseClient; userId: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The shared-plan change could not be completed.";
}

export function PlansScreen({ state, dispatch, client, userId }: Props) {
  const [newName, setNewName] = useState("");
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [sharingSettingsLoading, setSharingSettingsLoading] = useState(true);
  const [sharingSettingsError, setSharingSettingsError] = useState(false);
  const [workingPlanId, setWorkingPlanId] = useState<string>();
  const [shareError, setShareError] = useState<string>();
  const plans = Object.values(state.data.plans);
  const planIdsKey = plans.map((plan) => plan.id).sort().join("|");

  useEffect(() => {
    let active = true;
    setSharingSettingsLoading(true);
    setSharingSettingsError(false);
    setShareError(undefined);
    void getSharedPlanVisibility(client, userId, planIdsKey ? planIdsKey.split("|") : [])
      .then((result) => {
        if (active) {
          setVisibility(result);
          setSharingSettingsError(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSharingSettingsError(true);
          setShareError(errorMessage(error));
        }
      })
      .finally(() => { if (active) setSharingSettingsLoading(false); });
    return () => { active = false; };
  }, [client, planIdsKey, userId]);

  function createPlan() {
    if (!newName.trim()) return;
    dispatch({ type: "CREATE_PLAN", planId: newId("plan"), name: newName.trim(), now: Date.now() });
    setNewName("");
  }

  async function sharePlan(planId: string) {
    setWorkingPlanId(planId);
    setShareError(undefined);
    try {
      const content = createSharedWorkoutPlanContent(state.data, planId);
      await publishSharedWorkoutPlan(client, planId, content);
      setVisibility((current) => ({ ...current, [planId]: true }));
    } catch (error) {
      setShareError(errorMessage(error));
    } finally {
      setWorkingPlanId(undefined);
    }
  }

  async function stopSharing(planId: string, name: string) {
    if (!window.confirm(`Stop sharing “${name}”? It will no longer appear in Discover.`)) return;
    setWorkingPlanId(planId);
    setShareError(undefined);
    try {
      await unshareWorkoutPlan(client, userId, planId);
      setVisibility((current) => ({ ...current, [planId]: false }));
    } catch (error) {
      setShareError(errorMessage(error));
    } finally {
      setWorkingPlanId(undefined);
    }
  }

  async function deletePlan(planId: string, name: string, isShared: boolean) {
    const message = isShared
      ? `Delete “${name}”? It will also stop appearing in Discover. Completed workout history will be kept. This cannot be undone.`
      : `Delete “${name}”? Completed workout history will be kept. This cannot be undone.`;
    if (!window.confirm(message)) return;
    setWorkingPlanId(planId);
    setShareError(undefined);
    try {
      if (isShared) await unshareWorkoutPlan(client, userId, planId);
      dispatch({ type: "DELETE_PLAN", planId });
      setVisibility((current) => {
        const next = { ...current };
        delete next[planId];
        return next;
      });
    } catch (error) {
      setShareError(errorMessage(error));
    } finally {
      setWorkingPlanId(undefined);
    }
  }

  return (
    <section className="screen narrow-screen">
      <div className="section-heading"><div><div className="eyebrow">YOUR TRAINING</div><h2>Plans</h2><p>Create the structure you want to follow. The example is only a starting point.</p></div></div>
      {shareError && <p className="error-banner" role="alert">{shareError}</p>}
      <div className="create-row">
        <input value={newName} maxLength={100} onChange={(event) => setNewName(event.target.value)} placeholder="New plan name" onKeyDown={(event) => { if (event.key === "Enter") createPlan(); }} />
        <button className="button primary" disabled={!newName.trim()} onClick={createPlan}>Create plan</button>
      </div>
      <div className="plan-list">
        {plans.map((plan) => {
          const days = getPlanDays(state.data, plan.id);
          const isShared = visibility[plan.id] ?? false;
          const canShare = isPlanEligibleForSharing(plan);
          const isWorking = workingPlanId === plan.id;
          const sharingUnavailable = sharingSettingsLoading || sharingSettingsError;
          const sharingLabel = sharingSettingsLoading
            ? "Checking sharing…"
            : sharingSettingsError
              ? "Sharing status unavailable"
              : !canShare
                ? `${plan.shareOrigin === "copy" ? "Copied" : "Starter"} plan · edit to share`
                : isShared
                  ? "Shared with the community"
                  : "Private";
          return <article className={plan.isActive ? "plan-card active-plan" : "plan-card"} key={plan.id}>
            <div className="plan-card-top"><div><div className="plan-status">{plan.isActive ? "ACTIVE PLAN" : "AVAILABLE PLAN"}</div><h3>{plan.name}</h3><p>{plan.description || "No description yet."}</p></div><div className="plan-card-actions"><button className="button secondary" title={`Edit ${plan.name}, including its days and blocks`} onClick={() => { dispatch({ type: "SELECT_PLAN", planId: plan.id }); dispatch({ type: "NAVIGATE", route: "plan-editor" }); }}>Edit</button><button className="button danger" disabled={sharingUnavailable || isWorking} title={`Delete ${plan.name}; completed workout history is preserved`} onClick={() => void deletePlan(plan.id, plan.name, isShared)}>Delete</button></div></div>
            <div className="plan-days">{days.length ? days.map((day) => <span key={day.id}>{day.name}{day.weekday ? ` · ${["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day.weekday]}` : ""}</span>) : <span>No training days yet</span>}</div>
            {!plan.isActive && <button className="text-button" title={`Use ${plan.name} when opening Today`} onClick={() => dispatch({ type: "ACTIVATE_PLAN", planId: plan.id })}>Make active</button>}
            <div className="plan-sharing-actions">
              <span className="share-state">{sharingLabel}</span>
              <div>
                <button className="button secondary small" disabled={sharingUnavailable || isWorking || !canShare} title={!canShare ? "Edit the plan name, description, days, blocks, or exercise targets before sharing." : undefined} onClick={() => void sharePlan(plan.id)}>{isWorking ? "Saving…" : isShared ? "Update shared version" : "Share plan"}</button>
                {isShared && <button className="text-button" disabled={sharingUnavailable || isWorking} onClick={() => void stopSharing(plan.id, plan.name)}>Stop sharing</button>}
              </div>
            </div>
          </article>;
        })}
      </div>
      <div className="info-panel"><strong>Sharing is opt-in</strong><p>Only the plan name, description, training days, exercises, and targets are shared. Your sessions, journal, account details, and other plans stay private. Shared plans appear in Discover and can be copied by other members.</p></div>
      <div className="info-panel"><strong>Why plans come first</strong><p>Every exercise and block below is user-editable. When a session starts, the plan is snapshotted so later plan changes never rewrite history.</p></div>
    </section>
  );
}
