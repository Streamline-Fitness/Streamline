import { stat, readFile } from "node:fs/promises";
import path from "node:path";

const maxStatusBytes = 100_000;

function section(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const bodyStart = markdown.indexOf("\n", start);
  if (bodyStart < 0) return "";
  const body = markdown.slice(bodyStart + 1);
  const nextHeading = body.search(/^## /m);
  return nextHeading < 0 ? body : body.slice(0, nextHeading);
}

function fieldsFrom(currentState) {
  const fields = new Map();
  for (const line of currentState.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s+\*\*(.+?):\*\*\s*(.*?)\s*$/);
    if (match) fields.set(match[1], match[2]);
  }
  return fields;
}

export function parsePrototypeStatus(markdown) {
  if (typeof markdown !== "string") {
    throw new Error("The prototype status document is not valid text.");
  }

  const fields = fieldsFrom(section(markdown, "Current state"));
  const requiredFields = ["Overall phase", "Current slice", "Next implementation slice"];
  for (const field of requiredFields) {
    if (!fields.has(field)) {
      throw new Error(`The prototype status document is missing "${field}".`);
    }
  }

  const completed = section(markdown, "Completed")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.*\S)\s*$/)?.[1])
    .filter(Boolean)
    .slice(0, 5);
  const notYetImplemented = section(markdown, "Not yet implemented")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.*\S)\s*$/)?.[1])
    .filter(Boolean);

  return {
    overallPhase: fields.get("Overall phase"),
    currentSlice: fields.get("Current slice"),
    nextImplementationSlice: fields.get("Next implementation slice"),
    prototypeRunnable: fields.get("Prototype runnable") ?? "Not specified",
    hosting: fields.get("Hosting") ?? "Not specified",
    lastUpdated: fields.get("Last updated") ?? "Not specified",
    recentlyCompleted: completed,
    notYetImplemented,
  };
}

export async function readPrototypeStatus(workspaceRoot) {
  if (typeof workspaceRoot !== "string" || !path.isAbsolute(workspaceRoot)) {
    throw new Error("workspaceRoot must be an absolute path.");
  }

  const root = path.resolve(workspaceRoot);
  let rootInfo;
  try {
    rootInfo = await stat(root);
  } catch {
    throw new Error("The supplied workspace directory could not be accessed.");
  }
  if (!rootInfo.isDirectory()) {
    throw new Error("workspaceRoot must refer to a directory.");
  }

  const statusPath = path.join(root, "docs", "PROTOTYPE_STATUS.md");
  let fileInfo;
  try {
    fileInfo = await stat(statusPath);
  } catch {
    throw new Error("The workspace is missing docs/PROTOTYPE_STATUS.md.");
  }
  if (!fileInfo.isFile()) {
    throw new Error("docs/PROTOTYPE_STATUS.md must be a regular file.");
  }
  if (fileInfo.size > maxStatusBytes) {
    throw new Error("docs/PROTOTYPE_STATUS.md exceeds the supported size limit.");
  }

  let markdown;
  try {
    markdown = await readFile(statusPath, "utf8");
  } catch {
    throw new Error("docs/PROTOTYPE_STATUS.md could not be read.");
  }
  return parsePrototypeStatus(markdown);
}
