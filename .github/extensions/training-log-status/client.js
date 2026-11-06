const boardElement = document.querySelector("#board");
const message = document.querySelector("#message");
const form = document.querySelector("#new-card-form");
const scrollLeftButton = document.querySelector("#scroll-left");
const scrollRightButton = document.querySelector("#scroll-right");
const columns = [
  { id: "backlog", name: "Backlog" },
  { id: "ready", name: "Ready" },
  { id: "inProgress", name: "In progress" },
  { id: "done", name: "Done" },
];
let board;

function updateScrollControls() {
  const maxScroll = boardElement.scrollWidth - boardElement.clientWidth;
  scrollLeftButton.disabled = boardElement.scrollLeft <= 1;
  scrollRightButton.disabled = boardElement.scrollLeft >= maxScroll - 1;
}

scrollLeftButton.addEventListener("click", () => {
  boardElement.scrollBy({ left: -boardElement.clientWidth * 0.8, behavior: "smooth" });
});
scrollRightButton.addEventListener("click", () => {
  boardElement.scrollBy({ left: boardElement.clientWidth * 0.8, behavior: "smooth" });
});
boardElement.addEventListener("scroll", updateScrollControls, { passive: true });
const boardResizeObserver = new ResizeObserver(updateScrollControls);
boardResizeObserver.observe(boardElement);
window.addEventListener("resize", updateScrollControls);

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

function makeCard(card, columnId) {
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
  const moveLabel = document.createElement("label");
  moveLabel.className = "move-label";
  moveLabel.textContent = "Destination";
  const moveSelect = document.createElement("select");
  moveSelect.setAttribute("aria-label", `Move ${card.title} to column`);
  for (const column of columns) {
    const option = document.createElement("option");
    option.value = column.id;
    option.textContent = column.name;
    option.selected = column.id === columnId;
    moveSelect.append(option);
  }
  moveLabel.append(moveSelect);
  actions.append(moveLabel);
  const moveButton = button("Move card", "small-button", async () => {
    if (moveSelect.value !== columnId) await mutate(`/api/cards/${card.id}/move`, "POST", { column: moveSelect.value }, "Card moved.");
  });
  moveButton.setAttribute("aria-label", `Move ${card.title}`);
  moveButton.title = `Move "${card.title}" to the selected destination`;
  actions.append(moveButton);
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
  boardElement.replaceChildren();
  for (const column of columns) {
    const section = document.createElement("section");
    section.className = "column";
    section.dataset.column = column.id;
    section.style.scrollSnapAlign = "start";
    section.setAttribute("aria-labelledby", `column-${column.id}`);
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
      if (id) await mutate(`/api/cards/${id}/move`, "POST", { column: column.id }, `Moved to ${column.name}.`);
    });

    const heading = document.createElement("h2");
    heading.id = `column-${column.id}`;
    heading.textContent = column.name;
    const cards = board.columns[column.id];
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(cards.length);
    count.setAttribute("aria-label", `${cards.length} cards`);
    heading.append(count);
    section.append(heading);

    const list = document.createElement("div");
    list.className = "cards";
    if (cards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Drop a card here or add new work.";
      list.append(empty);
    }
    for (const card of cards) list.append(makeCard(card, column.id));
    section.append(list);
    boardElement.append(section);
  }
  requestAnimationFrame(updateScrollControls);
}

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
