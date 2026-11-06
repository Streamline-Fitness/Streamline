import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";
import {
  BoardInputError,
  BoardNotFoundError,
  boardColumns,
  createCard,
  deleteCard,
  moveCard,
  readBoard,
  updateCard,
} from "./board.mjs";

const extensionDirectory = path.dirname(fileURLToPath(import.meta.url));
const instances = new Map();
const maxRequestBytes = 16_384;
const columnIds = boardColumns.map(({ id }) => id);
const createInput = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 140 },
    description: { type: "string", maxLength: 2000 },
    column: { type: "string", enum: columnIds },
  },
  required: ["title"],
  additionalProperties: false,
};
const updateInput = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string", minLength: 1, maxLength: 140 },
    description: { type: "string", maxLength: 2000 },
  },
  required: ["id", "title"],
  additionalProperties: false,
};
const moveInput = {
  type: "object",
  properties: {
    id: { type: "string" },
    column: { type: "string", enum: columnIds },
  },
  required: ["id", "column"],
  additionalProperties: false,
};
const deleteInput = {
  type: "object",
  properties: { id: { type: "string" } },
  required: ["id"],
  additionalProperties: false,
};

class HttpInputError extends Error {}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function json(response, status, value) {
  send(response, status, "application/json; charset=utf-8", JSON.stringify(value));
}

function getRequestUrl(request, response) {
  try {
    return new URL(request.url ?? "/", "http://127.0.0.1");
  } catch {
    send(response, 400, "text/plain; charset=utf-8", "Invalid request URL");
    return undefined;
  }
}

function validateInput(input, schema) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new CanvasError("invalid_input", "Action input must be an object.");
  }
  for (const required of schema.required ?? []) {
    if (!(required in input)) throw new CanvasError("invalid_input", `Missing required input: ${required}.`);
  }
  const allowed = new Set(Object.keys(schema.properties));
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new CanvasError("invalid_input", "Action input contains an unsupported field.");
  }
  for (const [key, value] of Object.entries(input)) {
    const rule = schema.properties[key];
    if (typeof value !== rule.type) {
      throw new CanvasError("invalid_input", `${key} must be a ${rule.type}.`);
    }
    if (rule.minLength !== undefined && value.trim().length < rule.minLength) {
      throw new CanvasError("invalid_input", `${key} must not be empty.`);
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      throw new CanvasError("invalid_input", `${key} must be at most ${rule.maxLength} characters.`);
    }
    if (rule.enum && !rule.enum.includes(value)) {
      throw new CanvasError("invalid_input", `${key} must be one of: ${rule.enum.join(", ")}.`);
    }
  }
  return input;
}

function requireInstance(instanceId) {
  const instance = instances.get(instanceId);
  if (!instance) throw new CanvasError("canvas_instance_not_found", "Open the board before changing it.");
  return instance;
}

async function action(instanceId, operation) {
  const instance = requireInstance(instanceId);
  try {
    return await operation(instance.workspaceRoot);
  } catch (error) {
    if (error instanceof CanvasError) throw error;
    if (error instanceof BoardInputError) throw new CanvasError("invalid_input", error.message);
    if (error instanceof BoardNotFoundError) throw new CanvasError("board_card_not_found", error.message);
    throw new CanvasError("board_operation_failed", error instanceof Error ? error.message : "The board operation failed.");
  }
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > maxRequestBytes) throw new HttpInputError("Request body is too large.");

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxRequestBytes) throw new HttpInputError("Request body is too large.");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new HttpInputError("Request body must be a JSON object.");
    }
    return value;
  } catch (error) {
    if (error instanceof HttpInputError) throw error;
    throw new HttpInputError(error instanceof SyntaxError ? "Request body must contain valid JSON." : error.message);
  }
}

async function handleApi(request, response, instance, pathname) {
  try {
    if (request.method === "GET" && pathname === "/api/board") {
      json(response, 200, await readBoard(instance.workspaceRoot));
      return;
    }
    if (request.method === "POST" && pathname === "/api/cards") {
      const input = validateInput(await readJsonBody(request), createInput);
      json(response, 201, await createCard(instance.workspaceRoot, input));
      return;
    }

    const match = pathname.match(/^\/api\/cards\/([0-9a-f-]{36})(?:\/(move))?$/i);
    if (!match) {
      json(response, 404, { error: "Board endpoint not found." });
      return;
    }
    const [, id, moveRoute] = match;
    if (request.method === "PUT" && !moveRoute) {
      const body = await readJsonBody(request);
      if ("id" in body) throw new Error("Card ID must not be included in the request body.");
      const input = validateInput({ id, ...body }, updateInput);
      json(response, 200, await updateCard(instance.workspaceRoot, input));
      return;
    }
    if (request.method === "POST" && moveRoute) {
      const input = validateInput({ id, ...(await readJsonBody(request)) }, moveInput);
      json(response, 200, await moveCard(instance.workspaceRoot, input));
      return;
    }
    if (request.method === "DELETE" && !moveRoute) {
      json(response, 200, await deleteCard(instance.workspaceRoot, id));
      return;
    }
    json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The board request failed.";
    instance.log(`Board request failed: ${message}`);
    const status = error instanceof CanvasError || error instanceof BoardInputError || error instanceof HttpInputError ? 400
      : error instanceof BoardNotFoundError ? 404 : 500;
    json(response, status, { error: message });
  }
}

function createInstanceServer(instance) {
  return createServer(async (request, response) => {
    const requestUrl = getRequestUrl(request, response);
    if (!requestUrl) return;

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, instance, requestUrl.pathname);
      return;
    }

    if (request.method !== "GET") {
      send(response, 405, "text/plain; charset=utf-8", "Method not allowed");
      return;
    }

    const assets = new Map([
      ["/", ["canvas.html", "text/html; charset=utf-8"]],
      ["/canvas.css", ["canvas.css", "text/css; charset=utf-8"]],
      ["/client.js", ["client.js", "text/javascript; charset=utf-8"]],
    ]);
    const asset = assets.get(requestUrl.pathname);
    if (!asset) {
      send(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    try {
      const body = await readFile(path.join(extensionDirectory, asset[0]), "utf8");
      send(response, 200, asset[1], body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load canvas assets.";
      instance.log(`Canvas asset request failed: ${message}`);
      send(response, 500, "text/plain; charset=utf-8", "Unable to load the board.");
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new CanvasError("server_start_failed", "The board could not start its local server.");
  }
  return `http://127.0.0.1:${address.port}/`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const canvas = createCanvas({
  id: "streamline-training-log-status",
  displayName: "Training Log Kanban Board",
  description: "View and collaboratively manage Training Log prototype work as a persistent workspace kanban board.",
  actions: [
    {
      name: "list-board",
      description: "Read all cards from the Training Log prototype kanban board.",
      handler: async ({ instanceId }) => action(instanceId, readBoard),
    },
    {
      name: "create-card",
      description: "Add a work card to the Training Log prototype board.",
      inputSchema: createInput,
      handler: async ({ instanceId, input }) => {
        const valid = validateInput(input, createInput);
        return action(instanceId, (root) => createCard(root, valid));
      },
    },
    {
      name: "update-card",
      description: "Edit a board card's title and description.",
      inputSchema: updateInput,
      handler: async ({ instanceId, input }) => {
        const valid = validateInput(input, updateInput);
        return action(instanceId, (root) => updateCard(root, valid));
      },
    },
    {
      name: "move-card",
      description: "Move a board card to a different kanban column.",
      inputSchema: moveInput,
      handler: async ({ instanceId, input }) => {
        const valid = validateInput(input, moveInput);
        return action(instanceId, (root) => moveCard(root, valid));
      },
    },
    {
      name: "delete-card",
      description: "Delete a board card by ID.",
      inputSchema: deleteInput,
      handler: async ({ instanceId, input }) => {
        const valid = validateInput(input, deleteInput);
        return action(instanceId, (root) => deleteCard(root, valid.id));
      },
    },
  ],
  open: async ({ instanceId }) => {
    const workspaceRoot = process.cwd();
    try {
      await readBoard(workspaceRoot);
    } catch (error) {
      throw new CanvasError("board_unavailable", error instanceof Error ? error.message : "Unable to open the board.");
    }

    const existing = instances.get(instanceId);
    if (existing) {
      existing.workspaceRoot = workspaceRoot;
      return { url: await existing.ready };
    }

    const instance = {
      workspaceRoot,
      log: (message) => session.log(message),
      server: undefined,
      ready: undefined,
    };
    instance.server = createInstanceServer(instance);
    instance.ready = listen(instance.server);
    instances.set(instanceId, instance);

    try {
      const url = await instance.ready;
      session.log(`Opened Training Log kanban board for ${workspaceRoot}.`);
      return { url };
    } catch (error) {
      if (instances.get(instanceId) === instance) instances.delete(instanceId);
      await closeServer(instance.server).catch(() => {});
      throw new CanvasError("server_start_failed", error instanceof Error ? error.message : "Unable to start the board.");
    }
  },
  onClose: async ({ instanceId }) => {
    const instance = instances.get(instanceId);
    if (!instance) return;
    instances.delete(instanceId);
    try {
      await instance.ready;
      await closeServer(instance.server);
    } catch (error) {
      session.log(`Board close failed: ${error instanceof Error ? error.message : "Unable to stop the board server."}`);
    }
  },
});

const session = await joinSession({ canvases: [canvas] });
