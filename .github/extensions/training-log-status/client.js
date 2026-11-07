const boardElement = document.querySelector("#board");
const message = document.querySelector("#message");
const form = document.querySelector("#new-card-form");
const chatForm = document.querySelector("#chat-form");
const chatHistory = document.querySelector("#chat-history");
const chatMessage = document.querySelector("#chat-message");
const chatSendButton = document.querySelector("#chat-send");
const searchInput = document.querySelector("#work-search");
const columns = [
  { id: "backlog", name: "Backlog" },
  { id: "ready", name: "Ready" },
  { id: "inProgress", name: "In progress" },
  { id: "done", name: "Done" },
];
let board;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.dataset.error = String(isError);
}

async function request(path, method = "GET", data) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Board request failed.");
  return result;
}

function button(text, className, handler) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text;
  element.addEventListener("click", handler);
  return element;
}

function addChatMessage(role, content, isError = false) {
  const entry = document.createElement("article");
  entry.className = `chat-entry ${role}${isError ? " chat-error" : ""}`;
  const label = document.createElement("h3");
  label.textContent = role === "user" ? "You" : "Copilot";
  const body = document.createElement("p");
  body.textContent = content;
  entry.append(label, body);
  chatHistory.append(entry);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function loadChatHistory() {
  try {
    const result = await request("/api/chat/history");
    for (const item of result.messages) addChatMessage(item.role, item.content, item.error);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "The conversation could not be loaded.", true);
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = chatMessage.value.trim();
  if (!content) return;
  addChatMessage("user", content);
  chatMessage.value = "";
  chatMessage.disabled = true;
  chatSendButton.disabled = true;
  chatSendButton.textContent = "Waiting for Copilot…";
  setMessage("Sending your message to this Copilot conversation…");
  try {
    const result = await request("/api/chat", "POST", { message: content });
    addChatMessage("assistant", result.content);
    setMessage("Copilot replied. You can continue the discussion or add a work card.");
  } catch (error) {
    chatMessage.value = content;
    addChatMessage("assistant", error instanceof Error ? error.message : "Copilot could not respond.", true);
    setMessage(`${error instanceof Error ? error.message : "Copilot could not respond."} Your message is ready to retry.`, true);
  } finally {
    chatMessage.disabled = false;
    chatSendButton.disabled = false;
    chatSendButton.textContent = "Send to Copilot";
    chatMessage.focus();
  }
});

async function implementCard(card, implementButton) {
  implementButton.disabled = true;
  implementButton.textContent = "Implementing…";
  setMessage(`Sending "${card.title}" to Copilot to implement…`);
  try {
    const result = await request(`/api/cards/${card.id}/implement`, "POST", {});
    board = result.board;
    render();
    addChatMessage("user", `Implement board item: ${result.card.title}`);
    addChatMessage("assistant", result.content);
    setMessage(`Copilot finished the implementation request for "${result.card.title}".`);
  } catch (error) {
    await loadBoard();
    addChatMessage("assistant", error instanceof Error ? error.message : "Copilot could not implement this item.", true);
    setMessage(error instanceof Error ? error.message : "Copilot could not implement this item.", true);
  }
}

function makeCard(card) {
  const article = document.createElement("article");
  article.className = "card";
  article.draggable = true;
  article.dataset.cardId = card.id;
  article.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", card.id);
    event.dataTransfer.effectAllowed = "move";
    article.classList.add("dragging");
  });
  article.addEventListener("dragend", () => article.classList.remove("dragging"));

  const title = document.createElement("h3");
  title.textContent = card.title;
  article.append(title);
  if (card.description) {
    const description = document.createElement("p");
    description.className = "card-description";
    description.textContent = card.description;
    article.append(description);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const implementButton = button("Implement", "implement-button", () => implementCard(card, implementButton));
  implementButton.setAttribute("aria-label", `Implement ${card.title} with Copilot`);
  implementButton.title = `Ask Copilot to implement "${card.title}" in this repository`;
  actions.append(implementButton);
  article.append(actions);

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Edit card";
  details.append(summary);
  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Title";
  const titleInput = document.createElement("input");
  titleInput.required = true;
  titleInput.maxLength = 140;
  titleInput.value = card.title;
  titleLabel.append(titleInput);
  const descriptionLabel = document.createElement("label");
  descriptionLabel.textContent = "Description";
  const descriptionInput = document.createElement("textarea");
  descriptionInput.maxLength = 2000;
  descriptionInput.rows = 3;
  descriptionInput.value = card.description;
  descriptionLabel.append(descriptionInput);
  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "small-button";
  saveButton.textContent = "Save changes";
  editForm.append(titleLabel, descriptionLabel, saveButton);
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await mutate(`/api/cards/${card.id}`, "PUT", {
      title: titleInput.value,
      description: descriptionInput.value,
    }, "Card updated.");
  });
  details.append(editForm);
  article.append(details);
  article.append(button("Delete card", "delete-button", async () => {
    if (globalThis.confirm(`Delete "${card.title}"? This cannot be undone.`)) {
      await mutate(`/api/cards/${card.id}`, "DELETE", undefined, "Card deleted.");
    }
  }));
  return article;
}

function render() {
  const expandedColumns = new Map(
    [...boardElement.querySelectorAll(".column")].map((section) => [section.dataset.column, section.open]),
  );
  boardElement.replaceChildren();
  const query = searchInput.value.trim().toLocaleLowerCase();
  for (const column of columns) {
    const section = document.createElement("details");
    section.className = "column";
    section.dataset.column = column.id;
    section.open = Boolean(query) || expandedColumns.get(column.id) || (!expandedColumns.has(column.id) && column.id !== "done");
    section.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      section.classList.add("drop-target");
    });
    section.addEventListener("dragleave", (event) => {
      if (!section.contains(event.relatedTarget)) section.classList.remove("drop-target");
    });
    section.addEventListener("drop", async (event) => {
      event.preventDefault();
      section.classList.remove("drop-target");
      const id = event.dataTransfer.getData("text/plain");
      const currentColumn = columns.find((item) => board.columns[item.id].some((card) => card.id === id));
      if (!id || currentColumn?.id === column.id) return;
      if (id) await mutate(`/api/cards/${id}/move`, "POST", { column: column.id }, `Moved to ${column.name}.`);
    });

    const heading = document.createElement("summary");
    heading.className = "column-heading";
    heading.textContent = column.name;
    const cards = board.columns[column.id];
    const visibleCards = cards.filter((card) =>
      `${card.title}\n${card.description}`.toLocaleLowerCase().includes(query),
    );
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = query ? `${visibleCards.length}/${cards.length}` : String(cards.length);
    const countLabel = (value) => `${value} work ${value === 1 ? "item" : "items"}`;
    count.setAttribute("aria-label", query
      ? `${countLabel(visibleCards.length)} matching; ${countLabel(cards.length)} total`
      : countLabel(cards.length));
    heading.append(count);
    section.append(heading);

    const list = document.createElement("div");
    list.className = "cards";
    if (visibleCards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = query ? "No work matches this filter." : "Drop work here or add a new item.";
      list.append(empty);
    }
    for (const card of visibleCards) list.append(makeCard(card));
    section.append(list);
    boardElement.append(section);
  }
}

searchInput.addEventListener("input", render);

async function mutate(path, method, data, successMessage) {
  try {
    const result = await request(path, method, data);
    board = result.board;
    render();
    setMessage(successMessage);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "The board could not be updated.", true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = document.querySelector("#new-title");
  const description = document.querySelector("#new-description");
  const column = document.querySelector("#new-column");
  try {
    const result = await request("/api/cards", "POST", {
      title: title.value,
      description: description.value,
      column: column.value,
    });
    board = result.board;
    render();
    form.reset();
    title.focus();
    setMessage("Card added.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "The card could not be added.", true);
  }
});

async function loadBoard() {
  try {
    board = await request("/api/board");
    render();
    setMessage("Board loaded. Changes are saved to docs/PROTOTYPE_BOARD.json.");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "The board could not be loaded.", true);
  }
}

loadBoard();
loadChatHistory();

setInterval(async () => {
  const active = document.activeElement;
  if (
    active &&
    boardElement.contains(active) &&
    (active.tagName === "INPUT" || active.tagName === "TEXTAREA")
  ) return;
  try {
    const latest = await request("/api/board");
    if (JSON.stringify(latest) !== JSON.stringify(board)) {
      board = latest;
      render();
      setMessage("Board updated.");
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "The board could not be refreshed.", true);
  }
}, 3000);
