import assert from "node:assert/strict";
import test from "node:test";
import {
  CopilotNoTextResponseError,
  CopilotResponseTimeoutError,
  getCopilotResponseContent,
  sendAndWaitForAssistant,
} from "./copilot-response.mjs";

class MockSession {
  #listeners = new Set();
  #events;

  constructor(events) {
    this.#events = events;
  }

  on(handler) {
    this.#listeners.add(handler);
    return () => this.#listeners.delete(handler);
  }

  async send() {
    for (const event of this.#events) this.emit(event);
    return "message-1";
  }

  emit(event) {
    for (const listener of this.#listeners) listener(event);
  }

  get listenerCount() {
    return this.#listeners.size;
  }
}

test("returns the assistant's text without altering it", () => {
  assert.equal(getCopilotResponseContent({ data: { content: "  Board chat is connected.  " } }), "  Board chat is connected.  ");
});

test("reports a missing assistant message with a retryable error", () => {
  assert.throws(
    () => getCopilotResponseContent(undefined),
    (error) => error instanceof CopilotNoTextResponseError &&
      error.responseKind === "missing" &&
      error.statusCode === 502 &&
      error.message.includes("still in the composer"),
  );
});

test("reports an empty or malformed assistant message", () => {
  for (const response of [{ data: { content: " \n " } }, { data: {} }]) {
    assert.throws(
      () => getCopilotResponseContent(response),
      (error) => error instanceof CopilotNoTextResponseError && error.responseKind === "empty",
    );
  }
});

test("correlates the assistant reply to the submitted message ID", async () => {
  const session = new MockSession([
    { type: "assistant.message", data: { originatingMessageId: "other", content: "Unrelated" } },
    { type: "assistant.message", agentId: "subagent", data: { originatingMessageId: "message-1", content: "Sub-agent" } },
    { type: "user.message", data: { messageId: "message-1" } },
    { type: "assistant.message", data: { originatingMessageId: "message-1", content: "The next step is deployment." } },
    { type: "session.idle", data: { mode: "interactive" } },
  ]);
  assert.equal(
    await sendAndWaitForAssistant(session, { prompt: "What should I do next?" }, 100),
    "The next step is deployment.",
  );
  assert.equal(session.listenerCount, 0);
});

test("buffers matching completion events delivered before send resolves", async () => {
  const session = new MockSession([
    { type: "user.message", data: { messageId: "message-1" } },
    { type: "assistant.message", data: { originatingMessageId: "message-1", content: "Ready." } },
    { type: "session.idle", data: { mode: "interactive" } },
  ]);
  assert.equal(await sendAndWaitForAssistant(session, { prompt: "Check" }, 100), "Ready.");
  assert.equal(session.listenerCount, 0);
});

test("waits for matching assistant events delivered after send resolves", async () => {
  const session = new MockSession([]);
  const response = sendAndWaitForAssistant(session, { prompt: "Check" }, 100);
  await new Promise((resolve) => setImmediate(resolve));
  session.emit({ type: "user.message", data: { messageId: "message-1" } });
  session.emit({ type: "assistant.message", data: { originatingMessageId: "message-1", content: "Reply." } });
  session.emit({ type: "session.idle", data: { mode: "interactive" } });
  assert.equal(await response, "Reply.");
  assert.equal(session.listenerCount, 0);
});

test("rejects completion without an assistant message", async () => {
  const session = new MockSession([
    { type: "user.message", data: { messageId: "message-1" } },
    { type: "session.idle", data: { mode: "interactive" } },
  ]);
  await assert.rejects(
    sendAndWaitForAssistant(session, { prompt: "No response" }, 100),
    CopilotNoTextResponseError,
  );
});

test("reports a correlated session error", async () => {
  const session = new MockSession([
    { type: "user.message", data: { messageId: "message-1" } },
    { type: "session.error", data: { originatingMessageId: "message-1", message: "Model request failed" } },
  ]);
  await assert.rejects(
    sendAndWaitForAssistant(session, { prompt: "Fail" }, 100),
    /Model request failed/,
  );
});

test("times out if the submitted message never completes", async () => {
  const session = new MockSession([{ type: "user.message", data: { messageId: "message-1" } }]);
  await assert.rejects(
    sendAndWaitForAssistant(session, { prompt: "Wait" }, 5),
    CopilotResponseTimeoutError,
  );
});
