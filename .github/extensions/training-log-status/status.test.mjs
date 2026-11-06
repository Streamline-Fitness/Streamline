import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parsePrototypeStatus, readPrototypeStatus } from "./status.mjs";

const sample = `# Prototype Status

## Current state
- **Overall phase:** Implementation
- **Current slice:** Journaling
- **Next implementation slice:** Verify hosted sign-in and password recovery
- **Prototype runnable:** Yes
- **Hosting:** GitHub Pages
- **Last updated:** 2026-11-06

## Completed
- Added journal archive
- Added session summary

## In progress
- None
`;

test("parses current milestone and recent completion entries", () => {
  assert.deepEqual(parsePrototypeStatus(sample), {
    overallPhase: "Implementation",
    currentSlice: "Journaling",
    nextImplementationSlice: "Verify hosted sign-in and password recovery",
    prototypeRunnable: "Yes",
    hosting: "GitHub Pages",
    lastUpdated: "2026-11-06",
    recentlyCompleted: ["Added journal archive", "Added session summary"],
    notYetImplemented: [],
  });
});

test("rejects a status document missing required fields", () => {
  assert.throws(() => parsePrototypeStatus("# Prototype Status\n\n## Current state\n"), /Overall phase/);
});

test("reads status from the supplied workspace identity", async () => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "training-log-status-"));
  try {
    await mkdir(path.join(workspaceRoot, "docs"));
    await writeFile(path.join(workspaceRoot, "docs", "PROTOTYPE_STATUS.md"), sample);
    const status = await readPrototypeStatus(workspaceRoot);
    assert.equal(status.currentSlice, "Journaling");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("requires an absolute workspace path", async () => {
  await assert.rejects(() => readPrototypeStatus("relative/path"), /absolute path/);
});
