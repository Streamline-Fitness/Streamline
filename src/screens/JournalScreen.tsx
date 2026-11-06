import { useState, type FormEvent } from "react";
import { todayISO } from "../domain/plan";
import type { JournalEntry } from "../domain/model";
import type { AppState } from "../state/appState";
import { newActionId, type Action } from "../state/reducer";

type Props = {
  state: AppState;
  dispatch: (action: Action) => void;
  onDraftStatusChange: (isDirty: boolean) => void;
};

function displayDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function compareEntries(a: JournalEntry, b: JournalEntry): number {
  return b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt;
}

export function JournalScreen({ state, dispatch, onDraftStatusChange }: Props) {
  const categories = Object.values(state.data.journalCategories).sort((a, b) => a.name.localeCompare(b.name));
  const entries = Object.values(state.data.journalEntries).sort(compareEntries);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renamingCategoryName, setRenamingCategoryName] = useState("");

  const editingEntry = editingEntryId && editingEntryId !== "new" ? state.data.journalEntries[editingEntryId] : undefined;
  const isNewEntry = editingEntryId === "new";
  const isDirty = isNewEntry
    ? Boolean(draftText.trim() || draftCategoryId)
    : Boolean(editingEntry && (draftText !== editingEntry.text || draftCategoryId !== (editingEntry.categoryId ?? "")));
  const groupedEntries = entries.reduce<Record<string, JournalEntry[]>>((groups, entry) => {
    (groups[entry.date] ??= []).push(entry);
    return groups;
  }, {});

  function setDirty(text: string, categoryId: string) {
    const dirty = isNewEntry
      ? Boolean(text.trim() || categoryId)
      : Boolean(editingEntry && (text !== editingEntry.text || categoryId !== (editingEntry.categoryId ?? "")));
    onDraftStatusChange(dirty);
  }

  function startNewEntry() {
    setDraftText("");
    setDraftCategoryId("");
    setEditingEntryId("new");
    onDraftStatusChange(false);
  }

  function editEntry(entry: JournalEntry) {
    if (isDirty && !window.confirm("Discard your unsaved journal changes?")) return;
    setDraftText(entry.text);
    setDraftCategoryId(entry.categoryId ?? "");
    setEditingEntryId(entry.id);
    onDraftStatusChange(false);
  }

  function closeEditor() {
    if (isDirty && !window.confirm("Discard your unsaved journal changes?")) return;
    setEditingEntryId(null);
    onDraftStatusChange(false);
  }

  function saveEntry() {
    if (!editingEntryId || editingEntryId === "new" && !draftText.trim() || !draftCategoryId || !draftText.trim()) return;
    const entryId = editingEntry?.id ?? newActionId("journal-entry");
    dispatch({
      type: "SAVE_JOURNAL_ENTRY",
      entryId,
      date: editingEntry?.date ?? todayISO(),
      text: draftText,
      categoryId: draftCategoryId,
      updatedAt: Date.now(),
    });
    setEditingEntryId(null);
    onDraftStatusChange(false);
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const categoryId = newActionId("journal-category");
    dispatch({ type: "ADD_JOURNAL_CATEGORY", categoryId, name: newCategoryName });
    if (!newCategoryName.trim() || categories.some((category) => category.name.localeCompare(newCategoryName.trim(), undefined, { sensitivity: "base" }) === 0)) return;
    setNewCategoryName("");
    if (isNewEntry) {
      setDraftCategoryId(categoryId);
      setDirty(draftText, categoryId);
    }
  }

  function renameCategory(event: FormEvent<HTMLFormElement>, categoryId: string) {
    event.preventDefault();
    dispatch({ type: "RENAME_JOURNAL_CATEGORY", categoryId, name: renamingCategoryName });
    const original = state.data.journalCategories[categoryId];
    if (!renamingCategoryName.trim() || categories.some((category) => category.id !== categoryId && category.name.localeCompare(renamingCategoryName.trim(), undefined, { sensitivity: "base" }) === 0)) return;
    if (original?.name === renamingCategoryName.trim()) {
      setRenamingCategoryId(null);
      return;
    }
    setRenamingCategoryId(null);
  }

  function deleteEntry(entry: JournalEntry) {
    const discardingChanges = entry.id === editingEntryId && isDirty;
    const warning = discardingChanges ? " This also discards its unsaved changes." : "";
    if (!window.confirm(`Delete this journal entry from ${displayDate(entry.date)}?${warning}`)) return;
    dispatch({ type: "DELETE_JOURNAL_ENTRY", entryId: entry.id });
    if (entry.id === editingEntryId) {
      setEditingEntryId(null);
      onDraftStatusChange(false);
    }
  }

  return <section className="screen narrow-screen journal-screen">
    <div className="section-heading">
      <div><div className="eyebrow">YOUR SPACE</div><h2>Journal</h2><p>Write as often as you like and organize entries with your own categories.</p></div>
      {!editingEntryId && <button className="button primary" onClick={startNewEntry}>Write an entry</button>}
    </div>

    {editingEntryId && <article className="journal-editor-card">
      <div className="journal-date-controls">
        <strong>{isNewEntry ? `New entry · ${displayDate(todayISO())}` : `Edit entry · ${displayDate(editingEntry!.date)}`}</strong>
        <button className="text-button" onClick={closeEditor}>Cancel</button>
      </div>
      <label className="journal-category-picker">
        <span>Category</span>
        <select value={draftCategoryId} onChange={(event) => {
          setDraftCategoryId(event.target.value);
          setDirty(draftText, event.target.value);
        }}>
          <option value="">Choose a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="journal-writing">
        <span>Your entry</span>
        <textarea value={draftText} onChange={(event) => {
          setDraftText(event.target.value);
          setDirty(event.target.value, draftCategoryId);
        }} placeholder="What’s on your mind today?" rows={8} />
      </label>
      {!categories.length && <p className="journal-hint">Create a category below before saving your entry.</p>}
      <div className="journal-save-row">
        <span role="status">{isDirty ? "Unsaved changes" : "Changes are saved"}</span>
        <button className="button primary" disabled={!draftText.trim() || !draftCategoryId} onClick={saveEntry}>Save entry</button>
      </div>
    </article>}

    <details className="journal-categories" open={!categories.length}>
      <summary>Manage categories</summary>
      <form className="journal-category-create" onSubmit={addCategory}>
        <label htmlFor="journal-new-category">Create a category</label>
        <div><input id="journal-new-category" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="e.g. Recovery, Ideas" maxLength={40} />
          <button className="button secondary" disabled={!newCategoryName.trim()} type="submit">Add category</button></div>
      </form>
      {categories.length > 0 && <ul className="journal-category-list">{categories.map((category) => <li key={category.id}>
        {renamingCategoryId === category.id ? <form onSubmit={(event) => renameCategory(event, category.id)}>
          <input aria-label="Category name" value={renamingCategoryName} onChange={(event) => setRenamingCategoryName(event.target.value)} maxLength={40} autoFocus />
          <button className="text-button" type="submit">Save</button>
          <button className="text-button" type="button" onClick={() => setRenamingCategoryId(null)}>Cancel</button>
        </form> : <>
          <span>{category.name}</span>
          <button className="text-button" onClick={() => {
            setRenamingCategoryId(category.id);
            setRenamingCategoryName(category.name);
          }}>Rename</button>
          <button className="text-button" onClick={() => {
            const count = entries.filter((entry) => entry.categoryId === category.id).length;
            const note = count ? ` ${count} ${count === 1 ? "entry will" : "entries will"} become uncategorized; their text will be kept.` : "";
            if (!window.confirm(`Delete the “${category.name}” category?${note}`)) return;
            dispatch({ type: "DELETE_JOURNAL_CATEGORY", categoryId: category.id });
            if (draftCategoryId === category.id) {
              setDraftCategoryId("");
              onDraftStatusChange(isNewEntry ? Boolean(draftText.trim()) : Boolean(editingEntry && draftText !== editingEntry.text));
            }
          }}>Delete</button>
        </>}
      </li>)}</ul>}
    </details>

    <section className="journal-history">
      <div className="subheading">ENTRIES</div>
      {entries.length ? <div className="journal-entry-list">{Object.entries(groupedEntries).map(([date, dayEntries]) => <section className="journal-entry-day" key={date}>
        <h3>{date === todayISO() ? `Today · ${displayDate(date)}` : displayDate(date)}</h3>
        {dayEntries.map((entry) => <article className="journal-entry-card" key={entry.id}>
          <div className="journal-entry-card-top">
            <span className="journal-category-tag">{state.data.journalCategories[entry.categoryId ?? ""]?.name ?? "Uncategorized"}</span>
            <time>{new Date(entry.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
          </div>
          <p className="journal-entry-text">{entry.text}</p>
          <div className="journal-entry-actions">
            <button className="text-button" onClick={() => editEntry(entry)}>Edit entry</button>
            <button className="text-button" onClick={() => deleteEntry(entry)}>Delete</button>
          </div>
        </article>)}
      </section>)}</div> : <div className="empty-panel"><h3>Your journal starts here</h3><p>Create a category, then write an entry whenever you like.</p></div>}
    </section>
  </section>;
}
