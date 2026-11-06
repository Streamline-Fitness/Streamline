import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCard, deleteCard, moveCard, readBoard, updateCard } from "./board.mjs";

const status = `# Prototype Status

## Current state
- **Overall phase:** Implementation
- **Current slice:** Account-backed persistence
- **Next implementation slice:** Deploy the prototype
- **Prototype runnable:** Yes
- **Hosting:** GitHub Pages
- **Last updated:** 2026-11-06

## Completed
- Added account-backed storage
- Added a particularly long completed prototype work item that exceeds the maximum board title length because the full source wording must still remain available to people reading its card in the visual kanban board

## Not yet implemented
- Analytics
- Export
`;

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "training-log-board-"));
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs", "PROTOTYPE_STATUS.md"), status);
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("seeds the workspace board from prototype status", async (t) => {
  const root = await workspace(t);
  const board = await readBoard(root);
  assert.equal(board.format, "streamline-training-log-kanban");
  assert.equal(board.version, 1);
  assert.equal(board.columns.inProgress[0].title, "Account-backed persistence");
  assert.equal(board.columns.ready[0].title, "Deploy the prototype");
  assert.deepEqual(board.columns.backlog.map((card) => card.title), ["Analytics", "Export"]);
  assert.equal(board.columns.done[0].title, "Added account-backed storage");
  assert.ok(board.columns.done[1].title.endsWith("..."));
  assert.ok(`${board.columns.done[1].title.slice(0, -3)} ${board.columns.done[1].description}`.includes("the full source wording"));
  assert.deepEqual(await readBoard(root), board);
});

test("creates, edits, moves, and deletes persistent cards", async (t) => {
  const root = await workspace(t);
  const { card } = await createCard(root, { title: "Test the board", description: "Across UI and agent", column: "ready" });
  let board = await readBoard(root);
  assert.ok(board.columns.ready.some((item) => item.id === card.id));

  await updateCard(root, { id: card.id, title: "Verify board changes", description: "Persist them" });
  await moveCard(root, { id: card.id, column: "inProgress" });
  board = await readBoard(root);
  assert.equal(board.columns.inProgress.find((item) => item.id === card.id).title, "Verify board changes");
  assert.equal(board.columns.ready.some((item) => item.id === card.id), false);

  await deleteCard(root, card.id);
  board = await readBoard(root);
  assert.equal(board.columns.inProgress.some((item) => item.id === card.id), false);
});

test("does not overwrite a corrupt existing board", async (t) => {
  const root = await workspace(t);
  const boardPath = path.join(root, "docs", "PROTOTYPE_BOARD.json");
  const corrupt = "{not valid json";
  await writeFile(boardPath, corrupt);
  await assert.rejects(() => readBoard(root), /corrupt and was not changed/);
  assert.equal(await readFile(boardPath, "utf8"), corrupt);
});

test("serializes concurrent creates to preserve both changes", async (t) => {
  const root = await workspace(t);
  const [first, second] = await Promise.all([
    createCard(root, { title: "First concurrent card" }),
    createCard(root, { title: "Second concurrent card" }),
  ]);
  const board = await readBoard(root);
  const ids = new Set(board.columns.backlog.map((card) => card.id));
  assert.ok(ids.has(first.card.id));
  assert.ok(ids.has(second.card.id));
});
