import type { BatchFile, BatchItem, BatchRecord } from "../domain/batch";
import type { RuntimeRequest, RuntimeResponse } from "../shared/types";

const app = document.querySelector<HTMLElement>("#batch-app")!;
const batchId = decodeURIComponent(location.hash.slice(1));
const selectedFiles = new Set<string>();
const initializedItems = new Set<string>();
const generatedLinks = new Map<string, string>();
const generationErrors = new Map<string, string>();
let batch: BatchRecord | null = null;
let generating = false;

async function send(request: RuntimeRequest): Promise<RuntimeResponse> {
  return browser.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function fileKey(itemId: string, fileId: string): string {
  return `${itemId}\u0000${fileId}`;
}

function makeButton(label: string, action: () => void | Promise<void>, className = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", () => void action());
  return button;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1_024 && index < units.length - 1) {
    value /= 1_024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function stateLabel(state: BatchItem["state"]): string {
  return ({
    queued: "Queued",
    creating: "Creating",
    create_unknown: "Create outcome unknown",
    processing: "Processing",
    ready_to_generate: "Ready to generate",
    failed: "Failed",
    cancelled: "Cancelled",
    timed_out: "Timed out",
  })[state];
}

function readyPairs(): Array<{ item: BatchItem; file: BatchFile; key: string }> {
  if (!batch) return [];
  return batch.items.flatMap((item) => item.state === "ready_to_generate"
    ? item.files.map((file) => ({ item, file, key: fileKey(item.id, file.id) }))
    : []);
}

function initializeSelection(): void {
  if (!batch) return;
  for (const item of batch.items) {
    if (item.state !== "ready_to_generate" || initializedItems.has(item.id)) continue;
    initializedItems.add(item.id);
    if (item.files.length <= 100) {
      for (const file of item.files) selectedFiles.add(fileKey(item.id, file.id));
    }
  }
}

async function refresh(): Promise<void> {
  const response = await send({ type: "REFRESH_BATCH", batchId });
  if (!response.ok || !response.batch) {
    renderError(response.ok ? "Batch not found." : response.error);
    return;
  }
  batch = response.batch;
  initializeSelection();
  render();
}

async function generate(pairs: Array<{ item: BatchItem; file: BatchFile; key: string }>): Promise<void> {
  if (generating) return;
  if (pairs.length === 0) {
    window.alert("Select at least one reported file.");
    return;
  }
  if (pairs.length > 100) {
    window.alert("One Generate action can request at most 100 links. Unselect some files and try again.");
    return;
  }
  generating = true;
  generationErrors.clear();
  render();
  let index = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const pair = pairs[index];
      index += 1;
      if (!pair) return;
      const response = await send({ type: "GENERATE_LINK", batchId, itemId: pair.item.id, fileId: pair.file.id });
      if (response.ok && response.generatedUrl) generatedLinks.set(pair.key, response.generatedUrl);
      else generationErrors.set(pair.key, response.ok ? "TorBox returned no link." : response.error);
      render();
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, pairs.length) }, () => worker()));
  generating = false;
  render();
}

function renderFile(item: BatchItem, file: BatchFile): HTMLLIElement {
  const key = fileKey(item.id, file.id);
  const row = document.createElement("li");
  row.className = "file-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selectedFiles.has(key);
  checkbox.setAttribute("aria-label", `Select ${file.name}`);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedFiles.add(key);
    else selectedFiles.delete(key);
    render();
  });
  const details = document.createElement("div");
  const name = document.createElement("div");
  name.textContent = file.name;
  const meta = document.createElement("div");
  meta.className = "file-meta";
  meta.textContent = `${formatBytes(file.size)}${file.mimetype ? `, ${file.mimetype}` : ""}`;
  details.append(name, meta);
  const result = document.createElement("div");
  const generated = generatedLinks.get(key);
  if (generated) {
    const link = document.createElement("a");
    link.href = generated;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = file.name;
    result.append(link);
  } else if (generationErrors.has(key)) {
    result.className = "error";
    result.textContent = generationErrors.get(key) ?? "Generation failed";
  }
  row.append(checkbox, details, result);
  return row;
}

function renderItem(item: BatchItem): HTMLElement {
  const section = document.createElement("section");
  section.className = "batch-item";
  const headingRow = document.createElement("div");
  headingRow.className = "toolbar";
  const heading = document.createElement("h2");
  heading.textContent = item.torboxName || item.sourceDisplay || item.hosterName;
  const state = document.createElement("span");
  state.className = "state";
  state.textContent = stateLabel(item.state);
  headingRow.append(heading, state);
  section.append(headingRow);

  const hoster = document.createElement("p");
  hoster.className = "muted";
  hoster.textContent = `${item.hosterName}${item.sourceDisplay ? `, ${item.sourceDisplay}` : ""}`;
  section.append(hoster);
  if (item.error) {
    const error = document.createElement("p");
    error.className = "error";
    error.textContent = item.error;
    section.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "button-row";
  if (item.state === "queued") {
    actions.append(makeButton("Cancel queued item", async () => {
      const response = await send({ type: "CANCEL_ITEM", batchId, itemId: item.id });
      if (response.ok && response.batch) {
        batch = response.batch;
        render();
      }
    }, "secondary"));
  }
  if (item.state === "create_unknown") {
    actions.append(makeButton("Retry, duplicate possible", async () => {
      if (!window.confirm("TorBox may already contain this item. Retrying can create a duplicate. Continue?")) return;
      const response = await send({ type: "RETRY_UNKNOWN", batchId, itemId: item.id });
      if (response.ok && response.batch) {
        batch = response.batch;
        render();
      }
    }, "danger"));
  }
  if (actions.childElementCount > 0) section.append(actions);

  if (item.state === "ready_to_generate") {
    const list = document.createElement("ul");
    list.className = "file-list";
    list.append(...item.files.map((file) => renderFile(item, file)));
    section.append(list);
    const fileActions = document.createElement("div");
    fileActions.className = "button-row";
    fileActions.append(
      makeButton("Select all", () => {
        for (const file of item.files) selectedFiles.add(fileKey(item.id, file.id));
        render();
      }, "secondary"),
      makeButton("Unselect all", () => {
        for (const file of item.files) selectedFiles.delete(fileKey(item.id, file.id));
        render();
      }, "secondary"),
      makeButton("Generate selected in this item", () => generate(item.files
        .map((file) => ({ item, file, key: fileKey(item.id, file.id) }))
        .filter((pair) => selectedFiles.has(pair.key))),
      ),
    );
    section.append(fileActions);
  }
  return section;
}

function renderError(error: string): void {
  app.replaceChildren();
  const heading = document.createElement("h1");
  heading.textContent = "TorBox batch";
  const message = document.createElement("p");
  message.className = "error";
  message.textContent = error;
  app.append(heading, message);
}

function render(): void {
  if (!batch) return;
  app.replaceChildren();
  const header = document.createElement("header");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = batch.private ? "Private session batch" : "TorBox Web Download batch";
  const title = document.createElement("h1");
  title.textContent = `Batch ${batch.id.slice(0, 8)}`;
  const summary = document.createElement("p");
  summary.textContent = `${batch.items.length} item(s). Generated links stay only in this tab.`;
  header.append(eyebrow, title, summary);
  if (batch.private) {
    const privateNotice = document.createElement("p");
    privateNotice.className = "warning";
    privateNotice.textContent = "This batch disappears when the private browser session ends and sends no notifications.";
    header.append(privateNotice);
  }
  if (batch.attentionReason) {
    const attention = document.createElement("p");
    attention.className = "warning";
    attention.textContent = batch.attentionReason;
    header.append(attention);
  }
  app.append(header);

  const controls = document.createElement("div");
  controls.className = "button-row";
  controls.append(
    makeButton("Refresh status", refresh, "secondary"),
    makeButton("Select all files", () => {
      for (const pair of readyPairs()) selectedFiles.add(pair.key);
      render();
    }, "secondary"),
    makeButton("Unselect all files", () => {
      selectedFiles.clear();
      render();
    }, "secondary"),
    makeButton(generating ? "Generating..." : "Generate selected", () => generate(readyPairs().filter((pair) => selectedFiles.has(pair.key)))),
    makeButton("Generate all ready", () => generate(readyPairs())),
  );
  for (const button of controls.querySelectorAll("button")) if (generating) button.setAttribute("disabled", "");
  if (batch.items.some((item) => item.state === "timed_out")) {
    controls.append(makeButton("Resume for 24 hours", async () => {
      const response = await send({ type: "RESUME_BATCH", batchId });
      if (response.ok && response.batch) {
        batch = response.batch;
        render();
      }
    }));
  }
  if (batch.items.every((item) => ["ready_to_generate", "failed", "cancelled", "timed_out"].includes(item.state))) {
    controls.append(makeButton("Dismiss local history", async () => {
      if (!window.confirm("Remove this local batch history? TorBox items will remain in your account.")) return;
      const response = await send({ type: "DISMISS_BATCH", batchId });
      if (response.ok) window.close();
    }, "secondary"));
  }
  app.append(controls, ...batch.items.map(renderItem));

  const generatedCount = document.createElement("p");
  generatedCount.className = "status";
  generatedCount.setAttribute("role", "status");
  generatedCount.textContent = generating
    ? `Generated ${generatedLinks.size} link(s); work continues.`
    : `${generatedLinks.size} generated link(s) remain in this tab.`;
  app.append(generatedCount);
}

async function load(): Promise<void> {
  if (!batchId) {
    renderError("This batch URL has no batch identifier.");
    return;
  }
  const response = await send({ type: "GET_BATCH", batchId });
  if (!response.ok || !response.batch) {
    renderError(response.ok ? "Batch not found." : response.error);
    return;
  }
  batch = response.batch;
  initializeSelection();
  render();
}

window.setInterval(() => {
  if (document.visibilityState === "visible" && !generating) void refresh();
}, 5_000);

void load();
