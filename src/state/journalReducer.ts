import { cloneData } from "../domain/seed";
import type { Action } from "./actions";
import type { AppState } from "./appState";

type JournalAction = Extract<Action, { type:
  | "SAVE_JOURNAL_ENTRY"
  | "DELETE_JOURNAL_ENTRY"
  | "ADD_JOURNAL_CATEGORY"
  | "RENAME_JOURNAL_CATEGORY"
  | "DELETE_JOURNAL_CATEGORY"
}>;

function updateJournalState(state: AppState, data: AppState["data"]): AppState {
  return { ...state, data, error: undefined };
}

export function journalReducer(state: AppState, action: JournalAction): AppState {
  switch (action.type) {
    case "SAVE_JOURNAL_ENTRY": {
      const data = cloneData(state.data);
      if (!data.journalCategories[action.categoryId]) {
        return { ...state, error: "Choose a journal category before saving." };
      }
      if (!action.text.trim()) return { ...state, error: "Write something before saving your journal entry." };
      data.journalEntries[action.entryId] = {
        id: action.entryId,
        date: action.date,
        text: action.text,
        categoryId: action.categoryId,
        updatedAt: action.updatedAt,
      };
      return updateJournalState(state, data);
    }
    case "DELETE_JOURNAL_ENTRY": {
      if (!state.data.journalEntries[action.entryId]) return state;
      const data = cloneData(state.data);
      delete data.journalEntries[action.entryId];
      return updateJournalState(state, data);
    }
    case "ADD_JOURNAL_CATEGORY": {
      const name = action.name.trim();
      if (!name) return { ...state, error: "Enter a category name." };
      if (Object.values(state.data.journalCategories).some((category) => category.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0)) {
        return { ...state, error: "That journal category already exists." };
      }
      const data = cloneData(state.data);
      data.journalCategories[action.categoryId] = { id: action.categoryId, name };
      return updateJournalState(state, data);
    }
    case "RENAME_JOURNAL_CATEGORY": {
      const category = state.data.journalCategories[action.categoryId];
      const name = action.name.trim();
      if (!category) return { ...state, error: "That journal category is no longer available." };
      if (!name) return { ...state, error: "Enter a category name." };
      if (Object.values(state.data.journalCategories).some((candidate) => candidate.id !== category.id && candidate.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0)) {
        return { ...state, error: "That journal category already exists." };
      }
      const data = cloneData(state.data);
      data.journalCategories[action.categoryId] = { ...category, name };
      return updateJournalState(state, data);
    }
    case "DELETE_JOURNAL_CATEGORY": {
      if (!state.data.journalCategories[action.categoryId]) return state;
      const data = cloneData(state.data);
      delete data.journalCategories[action.categoryId];
      for (const entry of Object.values(data.journalEntries)) {
        if (entry.categoryId === action.categoryId) delete entry.categoryId;
      }
      return updateJournalState(state, data);
    }
  }
}
