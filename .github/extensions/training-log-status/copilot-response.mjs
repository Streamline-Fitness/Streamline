export class CopilotNoTextResponseError extends Error {
  constructor(response) {
    super(
      response
        ? "Copilot finished without a text reply. Your message is still in the composer; retry after Copilot is ready."
        : "Copilot finished without returning a reply. Your message is still in the composer; retry after Copilot is ready.",
    );
    this.name = "CopilotNoTextResponseError";
    this.statusCode = 502;
    this.responseKind = response ? "empty" : "missing";
  }
}

export function getCopilotResponseContent(response) {
  const content = response?.data?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new CopilotNoTextResponseError(response);
  }
  return content;
}

export class CopilotResponseTimeoutError extends Error {
  constructor(timeout) {
    super(`Copilot did not finish within ${Math.ceil(timeout / 1000)} seconds. Your message is still in the composer; retry after Copilot is ready.`);
    this.name = "CopilotResponseTimeoutError";
    this.statusCode = 504;
  }
}

export async function sendAndWaitForAssistant(session, options, timeout) {
  let messageId;
  let requestStarted = false;
  let assistantMessage;
  let unsubscribe = () => {};
  const pendingEvents = [];

  const response = new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      unsubscribe();
    };
    const settle = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };
    const observe = (event) => {
      if (event.agentId) return;
      if (event.type === "user.message" && event.data.messageId === messageId) {
        requestStarted = true;
        return;
      }
      if (
        event.type === "assistant.message" &&
        (event.data.originatingMessageId === messageId ||
          requestStarted && !event.data.originatingMessageId)
      ) {
        requestStarted = true;
        assistantMessage = event;
        return;
      }
      if (
        event.type === "session.error" &&
        (event.data.originatingMessageId === messageId ||
          requestStarted && !event.data.originatingMessageId)
      ) {
        const error = new Error(event.data.message);
        error.stack = event.data.stack;
        settle(reject, error);
        return;
      }
      if (event.type === "session.idle" && requestStarted && event.data.mode !== "autopilot") {
        settle(resolve, assistantMessage);
        return;
      }
      if (event.type === "session.autopilot_stopped" && event.data.requestId === messageId) {
        if (event.data.reason === "error") {
          settle(reject, new Error("Copilot could not complete the request."));
        } else if (event.data.reason === "aborted") {
          settle(reject, new Error("Copilot stopped before completing the request."));
        } else {
          settle(resolve, assistantMessage);
        }
      }
    };

    unsubscribe = session.on((event) => {
      if (event.agentId) return;
      if (!["user.message", "assistant.message", "session.error", "session.idle", "session.autopilot_stopped"].includes(event.type)) {
        return;
      }
      if (!messageId) {
        pendingEvents.push(event);
        return;
      }
      observe(event);
    });
    const timer = setTimeout(() => settle(reject, new CopilotResponseTimeoutError(timeout)), timeout);

    Promise.resolve()
      .then(() => session.send(options))
      .then((id) => {
        if (typeof id !== "string" || id.length === 0) {
          throw new Error("Copilot did not accept the message.");
        }
        messageId = id;
        for (const event of pendingEvents) observe(event);
        pendingEvents.length = 0;
      })
      .catch((error) => settle(reject, error));
  });

  return getCopilotResponseContent(await response);
}
