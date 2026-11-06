import { randomUUID } from "node:crypto";
import { open, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readPrototypeStatus } from "./status.mjs";

const format = "streamline-training-log-kanban";
const version = 1;
const maxBoardBytes = 1_000_000;
const columns = ["backlog", "ready", "inProgress", "done"];
const columnNames = {
  backlog: "Backlog",
  ready: "Ready",
  inProgress: "In progress",
  done: "Done",
};
const locks = new Map();
const lockTimeoutMs = 15_000;

export class BoardInputError extends Error {}
export class BoardNotFoundError extends Error {}

function assertText(value, label, maxLength, allowEmpty = false) {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    (!allowEmpty && value.trim().length === 0)
  ) {
    throw new BoardInputError(`${label} must be ${allowEmpty ? "a string" : "non-empty text"} of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function validateCard(card) {
  if (card === null || typeof card !== "object" || Array.isArray(card)) {
    throw new Error("Board contains an invalid card.");
  }
  if (
    typeof card.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(card.id) ||
    typeof card.title !== "string" ||
    card.title.trim().length === 0 ||
    card.title.length > 140 ||
    typeof card.description !== "string" ||
    card.description.length > 2000 ||
    card.description.length > 2000 ||
    typeof card.createdAt !== "string" ||
    !Number.isFinite(Date.parse(card.createdAt)) ||
    typeof card.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(card.updatedAt))
  ) {
    throw new Error("Board contains a malformed card.");
  }
  if (Object.keys(card).some((key) => !["id", "title", "description", "createdAt", "updatedAt"].includes(key))) {
    throw new Error("Board contains an unrecognized card field.");
  }
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

function validateBoard(board) {
  if (
    board === null ||
    typeof board !== "object" ||
    Array.isArray(board) ||
    board.format !== format ||
    board.version !== version ||
    board.columns === null ||
    typeof board.columns !== "object" ||
    Array.isArray(board.columns)
  ) {
    throw new Error("Board file has an unrecognized format or version.");
  }
  if (Object.keys(board).some((key) => !["format", "version", "columns"].includes(key))) {
    throw new Error("Board file contains an unrecognized field.");
  }

  const normalized = { format, version, columns: {} };
  const ids = new Set();
  for (const column of columns) {
    if (!Array.isArray(board.columns[column])) {
      throw new Error(`Board file has an invalid "${columnNames[column]}" column.`);
    }
    normalized.columns[column] = board.columns[column].map((item) => {
      const card = validateCard(item);
      if (ids.has(card.id)) throw new Error(`Board contains duplicate card ID "${card.id}".`);
      ids.add(card.id);
      return card;
    });
  }
  if (Object.keys(board.columns).some((column) => !columns.includes(column))) {
    throw new Error("Board file contains an unknown column.");
  }
  if (Object.keys(board.columns).length !== columns.length) {
    throw new Error("Board file is missing a column.");
  }
  return normalized;
}

function makeCard(title, description = "") {
  const now = new Date().toISOString();
  let cardTitle = title;
  let cardDescription = description;
  if (typeof title === "string" && title.length > 140) {
    let boundary = title.lastIndexOf(" ", 137);
    if (boundary < 1) boundary = 137;
    cardTitle = title.slice(0, boundary).trim();
    cardTitle = `${cardTitle}...`;
    cardDescription = `${title.slice(boundary).trim()}${description ? `\n${description}` : ""}`;
  }
  return {
    id: randomUUID(),
    title: assertText(cardTitle, "Title", 140),
    description: assertText(cardDescription, "Description", 2000, true),
    createdAt: now,
    updatedAt: now,
  };
}

function initialBoard(status) {
  const board = {
    format,
    version,
    columns: { backlog: [], ready: [], inProgress: [], done: [] },
  };
  board.columns.inProgress.push(makeCard(status.currentSlice));
  board.columns.ready.push(makeCard(status.nextImplementationSlice));
  for (const item of status.notYetImplemented ?? []) {
    board.columns.backlog.push(makeCard(item));
  }
  for (const item of status.recentlyCompleted ?? []) {
    board.columns.done.push(makeCard(item));
  }
  return board;
}

function boardPath(workspaceRoot) {
  if (typeof workspaceRoot !== "string" || !path.isAbsolute(workspaceRoot)) {
    throw new Error("workspaceRoot must be an absolute path.");
  }
  return path.join(path.resolve(workspaceRoot), "docs", "PROTOTYPE_BOARD.json");
}

async function writeBoard(file, board) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(`${JSON.stringify(validateBoard(board), null, 2)}\n`, "utf8");
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

async function readOrInitialize(workspaceRoot) {
  const file = boardPath(workspaceRoot);
  let info;
  try {
    info = await stat(file);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const status = await readPrototypeStatus(workspaceRoot);
    const board = initialBoard(status);
    await writeBoard(file, board);
    return board;
  }

  if (!info.isFile() || info.size > maxBoardBytes) {
    throw new Error("docs/PROTOTYPE_BOARD.json must be a regular file no larger than 1 MB.");
  }
  let data;
  try {
    data = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error("docs/PROTOTYPE_BOARD.json is corrupt and was not changed.");
  }
  try {
    return validateBoard(data);
  } catch (error) {
    throw new Error(`docs/PROTOTYPE_BOARD.json is invalid and was not changed: ${error.message}`);
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function acquireFileLock(file) {
  const lockFile = `${file}.lock`;
  const token = randomUUID();
  const deadline = Date.now() + lockTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const handle = await open(lockFile, "wx");
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, token }), "utf8");
        await handle.close();
        return async () => {
          try {
            const lock = JSON.parse(await readFile(lockFile, "utf8"));
            if (lock.token === token) await unlink(lockFile);
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }
        };
      } catch (error) {
        await handle.close().catch(() => {});
        await unlink(lockFile).catch(() => {});
        throw error;
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    try {
      const [contents, info] = await Promise.all([
        readFile(lockFile, "utf8").catch(() => ""),
        stat(lockFile).catch(() => undefined),
      ]);
      let owner;
      try {
        owner = JSON.parse(contents);
      } catch {
        owner = undefined;
      }
      const stale = info && Date.now() - info.mtimeMs > 5000 && (!owner || !processIsAlive(owner.pid));
      if (stale) {
        const current = await readFile(lockFile, "utf8").catch(() => undefined);
        if (current === contents) await unlink(lockFile).catch(() => {});
      }
    } catch {
      // Another writer may have removed the lock while it was inspected.
    }
    await delay(35);
  }
  throw new Error("The shared board is busy; try again in a moment.");
}

async function exclusive(file, operation) {
  const previous = locks.get(file) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(file, current);
  await previous;
  try {
    const releaseFileLock = await acquireFileLock(file);
    try {
      return await operation();
    } finally {
      await releaseFileLock();
    }
  } finally {
    release();
    if (locks.get(file) === current) locks.delete(file);
  }
}

export async function readBoard(workspaceRoot) {
  const file = boardPath(workspaceRoot);
  return exclusive(file, () => readOrInitialize(workspaceRoot));
}

export async function createCard(workspaceRoot, { title, description = "", column = "backlog" }) {
  const file = boardPath(workspaceRoot);
  return exclusive(file, async () => {
    const board = await readOrInitialize(workspaceRoot);
    if (!columns.includes(column)) throw new BoardInputError("Choose a valid board column.");
    const card = makeCard(title, description);
    board.columns[column].push(card);
    await writeBoard(file, board);
    return { board, card };
  });
}

export async function updateCard(workspaceRoot, { id, title, description }) {
  const file = boardPath(workspaceRoot);
  return exclusive(file, async () => {
    const board = await readOrInitialize(workspaceRoot);
    for (const column of columns) {
      const card = board.columns[column].find((item) => item.id === id);
      if (card) {
        card.title = assertText(title, "Title", 140);
        card.description = assertText(description ?? "", "Description", 2000, true);
        card.updatedAt = new Date().toISOString();
        await writeBoard(file, board);
        return { board, card };
      }
    }
    throw new BoardNotFoundError(`No board card exists with ID "${id}".`);
  });
}

export async function moveCard(workspaceRoot, { id, column }) {
  const file = boardPath(workspaceRoot);
  return exclusive(file, async () => {
    const board = await readOrInitialize(workspaceRoot);
    if (!columns.includes(column)) throw new BoardInputError("Choose a valid board column.");
    for (const source of columns) {
      const index = board.columns[source].findIndex((item) => item.id === id);
      if (index >= 0) {
        const [card] = board.columns[source].splice(index, 1);
        card.updatedAt = new Date().toISOString();
        board.columns[column].push(card);
        await writeBoard(file, board);
        return { board, card };
      }
    }
    throw new BoardNotFoundError(`No board card exists with ID "${id}".`);
  });
}

export async function deleteCard(workspaceRoot, id) {
  const file = boardPath(workspaceRoot);
  return exclusive(file, async () => {
    const board = await readOrInitialize(workspaceRoot);
    for (const column of columns) {
      const index = board.columns[column].findIndex((item) => item.id === id);
      if (index >= 0) {
        const [card] = board.columns[column].splice(index, 1);
        await writeBoard(file, board);
        return { board, card };
      }
    }
    throw new BoardNotFoundError(`No board card exists with ID "${id}".`);
  });
}

export const boardColumns = columns.map((id) => ({ id, name: columnNames[id] }));
