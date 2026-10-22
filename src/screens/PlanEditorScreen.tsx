import { useMemo, useState } from "react";
import { newId } from "../domain/ids";
import { formatRange, formatTarget, getBlockExercises, getPlanBlocks, getPlanDays } from "../domain/plan";
import { planBlockLabels, weekdayLabels, type Exercise, type ExerciseCategory, type Metric, type Pattern, type PlanBlockType, type SideMode } from "../domain/model";
import type { AppState } from "../state/appState";
import type { Action } from "../state/reducer";

type Props = { state: AppState; dispatch: (action: Action) => void };

export function PlanEditorScreen({ state, dispatch }: Props) {
  const plan = state.data.plans[state.editorPlanId ?? ""] ?? Object.values(state.data.plans)[0];
  const [newDayName, setNewDayName] = useState("");
  const [planName, setPlanName] = useState(plan?.name ?? "");
  const [planDescription, setPlanDescription] = useState(plan?.description ?? "");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState<ExerciseCategory>("strength");
  const [newExerciseMetric, setNewExerciseMetric] = useState<Metric>("reps");
  const [newExercisePattern, setNewExercisePattern] = useState<Pattern | "">("");
  const [newExerciseSkillId, setNewExerciseSkillId] = useState("");
  const [newExerciseLeadIn, setNewExerciseLeadIn] = useState("");
  const [newExerciseDefaultHold, setNewExerciseDefaultHold] = useState("");
  const [newExerciseSideMode, setNewExerciseSideMode] = useState<SideMode>("none");
  const days = useMemo(() => plan ? getPlanDays(state.data, plan.id) : [], [state.data, plan]);
  const [selectedDay, setSelectedDay] = useState<string | undefined>(state.selectedPlanDayId ?? days[0]?.id);

  if (!plan) return <section className="screen"><p>Create a plan to begin.</p></section>;

  const dayId = selectedDay ?? days[0]?.id;
  const day = dayId ? state.data.planDays[dayId] : undefined;
  const addCustomExercise = () => {
    if (!newExerciseName.trim()) return;
    dispatch({
      type: "CREATE_CUSTOM_EXERCISE",
      exerciseId: newId("exercise"),
      name: newExerciseName.trim(),
      category: newExerciseCategory,
      metric: newExerciseMetric,
      pattern: newExercisePattern || undefined,
      skillId: newExerciseSkillId.trim() || undefined,
      leadInS: newExerciseLeadIn ? Number(newExerciseLeadIn) : undefined,
      defaultHoldS: newExerciseDefaultHold ? Number(newExerciseDefaultHold) : undefined,
      sideMode: newExerciseSideMode,
    });
    setNewExerciseName("");
    setNewExerciseSkillId("");
    setNewExerciseLeadIn("");
    setNewExerciseDefaultHold("");
    setNewExerciseSideMode("none");
  };

  return <section className="screen editor-screen">
    <div className="section-heading">
      <div>
        <button className="back-link" title="Return to the list of plans" onClick={() => dispatch({ type: "NAVIGATE", route: "plans" })}>← All plans</button>
        <div className="eyebrow">PLAN EDITOR</div>
        <h2>{plan.name}</h2>
        <p>Build days from blocks. Plans are yours to change.</p>
      </div>
      <div className="editor-heading-actions">
        <button className="button secondary" title="Save the plan name and description" disabled={!planName.trim()} onClick={() => dispatch({ type: "UPDATE_PLAN", planId: plan.id, name: planName.trim(), description: planDescription, now: Date.now() })}>Save plan</button>
        <button className={plan.isActive ? "button active-button" : "button primary"} title={plan.isActive ? "This plan supplies the Today screen" : "Use this plan for future Today sessions"} onClick={() => dispatch({ type: "ACTIVATE_PLAN", planId: plan.id })}>{plan.isActive ? "Active plan" : "Make active"}</button>
      </div>
    </div>

    <div className="plan-details-editor">
      <label>Plan name<input value={planName} onChange={(event) => setPlanName(event.target.value)} /></label>
      <label>Description <span>(optional)</span><input value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} placeholder="What is this plan for?" /></label>
    </div>

    <div className="editor-grid">
      <aside className="day-sidebar">
        <div className="subheading">Training days</div>
        {days.map((candidate) => <div className={candidate.id === dayId ? "day-tab-wrap selected" : "day-tab-wrap"} key={candidate.id}>
          <button className={candidate.id === dayId ? "day-tab selected" : "day-tab"} title={`Edit the ${candidate.name} training day`} onClick={() => { setSelectedDay(candidate.id); dispatch({ type: "SELECT_PLAN_DAY", dayId: candidate.id }); }}><strong>{candidate.name}</strong><span>{candidate.weekday ? weekdayLabels[candidate.weekday] : "Unscheduled"}</span></button>
          <button className="day-delete" title={`Delete ${candidate.name} and all of its blocks`} aria-label={`Delete ${candidate.name}`} onClick={() => { if (window.confirm(`Delete ${candidate.name}? Its blocks and exercises will also be removed.`)) { dispatch({ type: "DELETE_PLAN_DAY", dayId: candidate.id }); if (candidate.id === dayId) setSelectedDay(undefined); } }}>×</button>
        </div>)}
        <div className="add-day-form">
          <input value={newDayName} onChange={(event) => setNewDayName(event.target.value)} placeholder="New day" title="Name for the new training day" />
          <select id="new-day-weekday" defaultValue="" title="Optional weekday for automatically selecting this day in Today"><option value="">Unscheduled</option>{weekdayLabels.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
          <button className="button secondary full" title="Add a training day to this plan" disabled={!newDayName.trim()} onClick={() => { const select = document.querySelector("#new-day-weekday"); const weekday = select instanceof HTMLSelectElement && select.value ? Number(select.value) : undefined; const id = newId("day"); dispatch({ type: "ADD_PLAN_DAY", dayId: id, planId: plan.id, name: newDayName.trim(), weekday }); setSelectedDay(id); setNewDayName(""); }}>Add day</button>
        </div>
      </aside>

      <div className="editor-main">
        {!day ? <div className="empty-panel"><h3>Add a training day</h3><p>Your plan needs at least one day before it can appear in Today.</p></div> : <>
          <div className="day-editor-header"><div><input className="title-input" title="Training day name" value={day.name} onChange={(event) => dispatch({ type: "UPDATE_PLAN_DAY", dayId: day.id, name: event.target.value, weekday: day.weekday })} /><span>{day.weekday ? weekdayLabels[day.weekday] : "Unscheduled day"}</span></div><select value={day.weekday ?? ""} title="Choose which weekday automatically selects this day in Today" onChange={(event) => dispatch({ type: "UPDATE_PLAN_DAY", dayId: day.id, name: day.name, weekday: event.target.value ? Number(event.target.value) : undefined })}><option value="">Unscheduled</option>{weekdayLabels.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select><button className="button danger" title="Delete this day and its blocks" onClick={() => { if (window.confirm(`Delete ${day.name}? Its blocks and exercises will also be removed.`)) { dispatch({ type: "DELETE_PLAN_DAY", dayId: day.id }); setSelectedDay(undefined); } }}>Delete day</button></div>
          <div className="rest-day-options">
            <label><input type="checkbox" checked={day.isRestDay ?? false} onChange={(event) => dispatch({ type: "UPDATE_PLAN_DAY", dayId: day.id, name: day.name, weekday: day.weekday, isRestDay: event.target.checked, reflectionEnabled: event.target.checked && (day.reflectionEnabled ?? false) })} /><span><strong>Rest day</strong><small>No workout will be shown for this day.</small></span></label>
            {day.isRestDay && <label><input type="checkbox" checked={day.reflectionEnabled ?? false} onChange={(event) => dispatch({ type: "UPDATE_PLAN_DAY", dayId: day.id, name: day.name, weekday: day.weekday, isRestDay: true, reflectionEnabled: event.target.checked })} /><span><strong>Enable weekly reflection</strong><small>Show the weekly check-in on this rest day.</small></span></label>}
          </div>
          {day.isRestDay ? <div className="info-panel rest-day-note"><strong>Rest day</strong><p>Workout blocks are kept in the plan but hidden from Today while this is marked as a rest day.</p></div> : <>
            {getPlanBlocks(state.data, day.id).map((block) => <BlockEditor key={block.id} blockId={block.id} state={state} dispatch={dispatch} />)}
            <button className="button secondary add-block" title="Add a straight-set block to this training day" onClick={() => dispatch({ type: "ADD_PLAN_BLOCK", blockId: newId("block"), dayId: day.id, name: "New block", blockType: "straightSets" })}>+ Add block</button>
          </>}
          <div className="custom-exercise-panel">
            <div><div className="subheading">Add to exercise library</div><p>Add a movement and its tracking details. You can edit it later from the library picker.</p></div>
            <div className="create-exercise-form">
              <div className="create-exercise-row create-primary-fields"><input value={newExerciseName} onChange={(event) => setNewExerciseName(event.target.value)} placeholder="Custom exercise name" title="Name for a new custom exercise" /><select value={newExerciseCategory} title="Exercise category" onChange={(event) => setNewExerciseCategory(event.target.value as ExerciseCategory)}><option value="strength">Strength</option><option value="skill">Skill</option><option value="stretch">Stretch</option></select><select value={newExerciseMetric} title="What this exercise records" onChange={(event) => setNewExerciseMetric(event.target.value as Metric)}><option value="reps">Reps</option><option value="seconds">Seconds</option></select></div>
              <div className="create-exercise-row create-details-fields"><select value={newExercisePattern} title="Training pattern for analytics" onChange={(event) => setNewExercisePattern(event.target.value as Pattern | "")}><option value="">No pattern</option><option value="push">Push</option><option value="pull">Pull</option><option value="legs">Legs</option><option value="core">Core</option><option value="mobility">Mobility</option></select><select value={newExerciseSideMode} title="Mark whether this exercise is performed on each side" onChange={(event) => setNewExerciseSideMode(event.target.value as SideMode)}><option value="none">Total</option><option value="eachSide">Both Sides</option></select><input value={newExerciseSkillId} onChange={(event) => setNewExerciseSkillId(event.target.value)} placeholder="Skill ID (optional)" title="Skill identifier for progression tracking" /></div>
              <div className="create-exercise-row create-timing-fields"><input type="number" min="0" value={newExerciseLeadIn} onChange={(event) => setNewExerciseLeadIn(event.target.value)} placeholder="Lead-in sec" title="Optional lead-in countdown for timed holds" />{(newExerciseCategory === "stretch" || newExerciseMetric === "seconds") && <input type="number" min="0" value={newExerciseDefaultHold} onChange={(event) => setNewExerciseDefaultHold(event.target.value)} placeholder="Default hold sec" title="Default duration for stretches or timed holds" />}</div>
              <button className="button secondary" title="Add this fully defined custom exercise to the library" disabled={!newExerciseName.trim()} onClick={addCustomExercise}>Add to library</button>
            </div>
            <ExerciseLibrary state={state} dispatch={dispatch} />
          </div>
        </>}
      </div>
    </div>
  </section>;
}

function BlockEditor({ blockId, state, dispatch }: { blockId: string; state: AppState; dispatch: (action: Action) => void }) {
  const block = state.data.planBlocks[blockId];
  const [isOpen, setIsOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [metricMin, setMetricMin] = useState("");
  const [metricMax, setMetricMax] = useState("");
  if (!block) return null;
  const exercises = getBlockExercises(state.data, block.id);
  const selected = state.data.exercises[selectedExercise];
  const update = (field: "name" | "type" | "roundsMin" | "roundsMax" | "restMinS" | "restMaxS", value: string | number) => dispatch({ type: "UPDATE_PLAN_BLOCK", blockId: block.id, name: field === "name" ? String(value) : block.name, blockType: field === "type" ? value as PlanBlockType : block.type, roundsMin: field === "roundsMin" ? Number(value) : block.roundsMin, roundsMax: field === "roundsMax" ? Number(value) : block.roundsMax, restMinS: field === "restMinS" ? Number(value) : block.restMinS, restMaxS: field === "restMaxS" ? Number(value) : block.restMaxS });
  const validRange = (min: string, max: string) => min !== "" && max !== "" && Number(min) >= 0 && Number(max) >= Number(min);
  const canAdd = Boolean(selected && validRange(metricMin, metricMax));
  const resetAddForm = () => { setSelectedExercise(""); setMetricMin(""); setMetricMax(""); };
  const addExercise = () => {
    if (!selected || !canAdd) return;
    const isReps = selected.metric === "reps";
    const numberOrUndefined = (value: string) => value === "" ? undefined : Number(value);
    dispatch({ type: "ADD_PLAN_EXERCISE", planExerciseId: newId("plan-exercise"), blockId: block.id, exerciseId: selected.id, sideMode: selected.sideMode, ...(isReps ? { repsMin: Number(metricMin), repsMax: Number(metricMax) } : { secondsMin: Number(metricMin), secondsMax: Number(metricMax) }) });
    resetAddForm();
  };
  return <article className={isOpen ? "block-editor open" : "block-editor"}>
    <div className="block-editor-head"><button className="block-toggle" type="button" aria-expanded={isOpen} aria-label={`${isOpen ? "Collapse" : "Expand"} ${block.name}`} title={isOpen ? "Collapse this block" : `Expand ${block.name} to edit its exercises and settings`} onClick={() => setIsOpen(!isOpen)}><span className="accordion-chevron">{isOpen ? "⌄" : "›"}</span></button><input className="block-name-input" title="Name for this block" value={block.name} onChange={(event) => update("name", event.target.value)} /><select value={block.type} title="How exercises in this block are grouped during a session" onChange={(event) => update("type", event.target.value)}>{Object.entries(planBlockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="block-summary">{exercises.length} exercise{exercises.length === 1 ? "" : "s"}</span><button className="icon-button block-delete" title={`Delete ${block.name} and all of its exercises`} aria-label={`Delete ${block.name}`} onClick={() => { if (window.confirm(`Delete ${block.name}? Its exercises will also be removed from this plan.`)) dispatch({ type: "DELETE_PLAN_BLOCK", blockId: block.id }); }}>×</button></div>
    {isOpen && <div className="block-editor-content"><div className="block-settings"><label>Rounds min<input type="number" min="1" title="Minimum number of rounds" value={block.roundsMin} onChange={(event) => update("roundsMin", event.target.value)} /></label><label>Rounds max<input type="number" min="1" title="Maximum number of rounds" value={block.roundsMax} onChange={(event) => update("roundsMax", event.target.value)} /></label><label>Rest min (sec)<input type="number" min="0" title="Shortest planned rest after this block round" value={block.restMinS} onChange={(event) => update("restMinS", event.target.value)} /></label><label>Rest max (sec)<input type="number" min="0" title="Longest planned rest after this block round" value={block.restMaxS} onChange={(event) => update("restMaxS", event.target.value)} /></label></div>
      <div className="block-exercises">{exercises.map((planExercise) => { const exercise = state.data.exercises[planExercise.exerciseId]; return <div className="plan-exercise-row" key={planExercise.id}><span className="drag-handle">⋮⋮</span><strong>{exercise?.name}</strong><span>{formatTarget(planExercise)}{planExercise.sideMode === "eachSide" ? "" : ""}</span><button className="icon-button" title={`Remove ${exercise?.name} from this block`} onClick={() => dispatch({ type: "REMOVE_PLAN_EXERCISE", planExerciseId: planExercise.id })} aria-label={`Remove ${exercise?.name}`}>×</button></div>; })}</div>
      <div className="add-exercise-row"><select value={selectedExercise} title="Exercise to add to this block" onChange={(event) => { setSelectedExercise(event.target.value); setMetricMin(""); setMetricMax(""); }}><option value="">Choose an exercise…</option>{Object.values(state.data.exercises).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select><input type="number" min="0" value={metricMin} placeholder="Min" onChange={(event) => setMetricMin(event.target.value)} aria-label="Target minimum" title="Minimum reps or seconds" /><input type="number" min="0" value={metricMax} placeholder="Max" onChange={(event) => setMetricMax(event.target.value)} aria-label="Target maximum" title="Maximum reps or seconds" /><button className="button secondary" title="Add the selected exercise to this block" disabled={!canAdd} onClick={addExercise}>+ Add</button></div>
    </div>}
  </article>;
}

function ExerciseLibrary({ state, dispatch }: Props) {
  const exercises = Object.values(state.data.exercises).sort((a, b) => a.name.localeCompare(b.name));
  const [selectedId, setSelectedId] = useState("");
  const selected = state.data.exercises[selectedId];
  return <div className="exercise-library"><div className="library-heading"><div><strong>Exercise library</strong><span>Select one exercise to edit its details.</span></div></div><select className="library-picker" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} title="Choose one exercise to edit" aria-label="Exercise to edit"><option value="">Choose an exercise to edit…</option>{exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}{exercise.source === "user" ? " · Custom" : " · Built-in"}</option>)}</select>{selected ? <ExerciseLibraryItem key={selected.id} exercise={selected} state={state} dispatch={dispatch} /> : <p className="library-empty">No exercises in the library yet.</p>}</div>;
}

function ExerciseLibraryItem({ exercise, state, dispatch }: { exercise: Exercise; state: AppState; dispatch: (action: Action) => void }) {
  const [name, setName] = useState(exercise.name);
  const [category, setCategory] = useState<ExerciseCategory>(exercise.category);
  const [metric, setMetric] = useState<Metric>(exercise.metric);
  const [pattern, setPattern] = useState<Pattern | "">(exercise.pattern ?? "");
  const [skillId, setSkillId] = useState(exercise.skillId ?? "");
  const [leadInS, setLeadInS] = useState(exercise.leadInS?.toString() ?? "");
  const [defaultHoldS, setDefaultHoldS] = useState(exercise.defaultHoldS?.toString() ?? "");
  const [sideMode, setSideMode] = useState<SideMode>(exercise.sideMode);
  const isUsed = Object.values(state.data.planExercises).some((item) => item.exerciseId === exercise.id) || Object.values(state.data.setEntries).some((entry) => entry.exerciseId === exercise.id);
  const isDirty = name !== exercise.name || category !== exercise.category || metric !== exercise.metric || pattern !== (exercise.pattern ?? "") || skillId !== (exercise.skillId ?? "") || leadInS !== (exercise.leadInS?.toString() ?? "") || defaultHoldS !== (exercise.defaultHoldS?.toString() ?? "") || sideMode !== exercise.sideMode;
  const supportsDefaultHold = category === "stretch" || metric === "seconds";
  return <div className="library-item"><div className="library-item-fields"><input title="Exercise name" aria-label={`${exercise.name} name`} value={name} onChange={(event) => setName(event.target.value)} /><select title="Exercise category" aria-label={`${exercise.name} category`} value={category} onChange={(event) => { const next = event.target.value as ExerciseCategory; setCategory(next); if (next !== "stretch" && metric !== "seconds") setDefaultHoldS(""); }}><option value="strength">Strength</option><option value="skill">Skill</option><option value="stretch">Stretch</option></select><select title="What this exercise records" aria-label={`${exercise.name} metric`} value={metric} onChange={(event) => { const next = event.target.value as Metric; setMetric(next); if (next !== "seconds" && category !== "stretch") setDefaultHoldS(""); }}><option value="reps">Reps</option><option value="seconds">Seconds</option></select><select title="Training pattern for analytics" aria-label={`${exercise.name} pattern`} value={pattern} onChange={(event) => setPattern(event.target.value as Pattern | "")}><option value="">No pattern</option><option value="push">Push</option><option value="pull">Pull</option><option value="legs">Legs</option><option value="core">Core</option><option value="mobility">Mobility</option></select><select title="Mark whether this exercise is performed on both sides" aria-label={`${exercise.name} side mode`} value={sideMode} onChange={(event) => setSideMode(event.target.value as SideMode)}><option value="none">Total</option><option value="eachSide">Both Sides</option></select><input title="Skill identifier for progression tracking" placeholder="Skill ID" aria-label={`${exercise.name} skill ID`} value={skillId} onChange={(event) => setSkillId(event.target.value)} /><input type="number" min="0" title="Optional lead-in countdown in seconds" placeholder="Lead-in sec" aria-label={`${exercise.name} lead-in seconds`} value={leadInS} onChange={(event) => setLeadInS(event.target.value)} />{supportsDefaultHold && <input type="number" min="0" title="Default duration for stretches or timed holds in seconds" placeholder="Default hold sec" aria-label={`${exercise.name} default hold seconds`} value={defaultHoldS} onChange={(event) => setDefaultHoldS(event.target.value)} />}</div><div className="library-item-actions"><span className="library-source">{exercise.source === "system" ? "Built-in" : "Custom"}{isUsed ? " · in use" : ""}</span><button className="button secondary small" title="Save changes to this exercise" disabled={!name.trim() || !isDirty} onClick={() => dispatch({ type: "UPDATE_EXERCISE", exerciseId: exercise.id, name: name.trim(), category, metric, pattern: pattern || undefined, skillId: skillId.trim() || undefined, leadInS: leadInS ? Number(leadInS) : undefined, defaultHoldS: supportsDefaultHold && defaultHoldS ? Number(defaultHoldS) : undefined, sideMode })}>Save</button><button className="icon-button library-delete" title={exercise.source === "system" ? "Built-in exercises cannot be deleted" : isUsed ? "Remove this exercise from plans before deleting it" : "Delete this custom exercise"} disabled={exercise.source === "system" || isUsed} onClick={() => { if (window.confirm(`Delete ${exercise.name} from the exercise library?`)) dispatch({ type: "DELETE_EXERCISE", exerciseId: exercise.id }); }} aria-label={`Delete ${exercise.name}`}>×</button></div>{isUsed && metric !== exercise.metric && <small className="library-warning">Metric cannot change while this exercise is used in a plan or history.</small>}</div>;
}
