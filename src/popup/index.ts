import {
  Download,
  ExternalLink,
  ListChecks,
  ListPlus,
  ListX,
  LoaderCircle,
  Settings,
  createElement as createLucideElement,
  type IconNode,
} from "lucide";

import type { BatchItem, BatchRecord, BatchSelection } from "../domain/batch";
import type { CandidateLink } from "../domain/catalog";
import type { PopupState, RuntimeRequest, RuntimeResponse } from "../shared/types";

const app = document.querySelector<HTMLElement>("#app")!;
const selected = new Set<string>();
const passwords = new Map<string, string>();
const generatedLinks = new Map<string, string>();
const generationErrors = new Map<string, string>();
const generatingLinks = new Set<string>();
let state: PopupState | null = null;
let submitting = false;
let refreshingQuickBatch = false;
let quickRefreshTimer: number | undefined;
let popupError: string | null = null;

async function send(request: RuntimeRequest): Promise<RuntimeResponse> {
  return browser.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function icon(iconNode: IconNode, className = "icon"): SVGElement {
  return createLucideElement(iconNode, {
    class: className,
    width: 22,
    height: 22,
    "aria-hidden": "true",
    focusable: "false",
  });
}

function makeButton(label: string, action: () => void | Promise<void>, className = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", () => void action());
  return button;
}

function makeIconButton(
  label: string,
  iconNode: IconNode,
  action: () => void | Promise<void>,
  className = "icon-button",
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(icon(iconNode));
  button.addEventListener("click", () => void action());
  return button;
}

function message(text: string, className = "muted"): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = text;
  return paragraph;
}

function renderCandidate(candidate: CandidateLink): HTMLElement {
  const row = document.createElement("div");
  row.className = "candidate";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selected.has(candidate.url);
  checkbox.setAttribute("aria-label", `Select ${candidate.url}`);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      if (selected.size >= 60) {
        checkbox.checked = false;
        window.alert("One batch can contain at most 60 links.");
        return;
      }
      selected.add(candidate.url);
    } else {
      selected.delete(candidate.url);
    }
    render();
  });
  const url = document.createElement("span");
  url.className = "url";
  url.textContent = candidate.url;
  const passwordRow = document.createElement("div");
  passwordRow.className = "password-row";
  if (selected.has(candidate.url)) {
    const label = document.createElement("label");
    label.textContent = "Optional Hoster password";
    const input = document.createElement("input");
    input.type = "password";
    input.autocomplete = "off";
    input.value = passwords.get(candidate.url) ?? "";
    input.addEventListener("input", () => passwords.set(candidate.url, input.value));
    label.append(input);
    passwordRow.append(label);
  }
  row.append(checkbox, url, passwordRow);
  return row;
}

function generatedLinkKey(batchId: string, item: BatchItem): string | null {
  const file = item.files[0];
  return file ? `${batchId}:${item.id}:${file.id}` : null;
}

async function openBatch(batchId: string): Promise<void> {
  const options = state?.windowId === undefined
    ? { url: browser.runtime.getURL(`batch.html#${encodeURIComponent(batchId)}`) }
    : { url: browser.runtime.getURL(`batch.html#${encodeURIComponent(batchId)}`), windowId: state.windowId };
  await browser.tabs.create(options);
  window.close();
}

function quickBatchIsActive(batch: BatchRecord): boolean {
  return batch.items.some((item) => ["queued", "creating", "processing"].includes(item.state));
}

function scheduleQuickRefresh(): void {
  if (quickRefreshTimer !== undefined) window.clearInterval(quickRefreshTimer);
  quickRefreshTimer = undefined;
  if (!state?.quickBatch || !quickBatchIsActive(state.quickBatch)) return;
  quickRefreshTimer = window.setInterval(() => void refreshQuickBatch(), 5_000);
}

async function refreshQuickBatch(): Promise<void> {
  if (!state?.quickBatch || refreshingQuickBatch) return;
  refreshingQuickBatch = true;
  const response = await send({
    type: "REFRESH_BATCH",
    batchId: state.quickBatch.id,
    sourceTabId: state.tabId,
  });
  refreshingQuickBatch = false;
  if (!response.ok || !response.batch) {
    popupError = response.ok ? "The quick batch is unavailable." : response.error;
    render();
    return;
  }
  state.quickBatch = response.batch;
  render();
  scheduleQuickRefresh();
  await maybeGenerateQuickLink();
}

async function maybeGenerateQuickLink(): Promise<void> {
  const batch = state?.quickBatch;
  const item = batch?.items[0];
  if (!batch || !item || item.state !== "ready_to_generate" || item.files.length !== 1) return;
  const file = item.files[0]!;
  const key = generatedLinkKey(batch.id, item)!;
  if (generatedLinks.has(key) || generatingLinks.has(key)) return;
  generatingLinks.add(key);
  generationErrors.delete(key);
  render();
  const response = await send({
    type: "GENERATE_LINK",
    batchId: batch.id,
    itemId: item.id,
    fileId: file.id,
    sourceTabId: state!.tabId,
  });
  generatingLinks.delete(key);
  if (response.ok && response.generatedUrl) generatedLinks.set(key, response.generatedUrl);
  else generationErrors.set(key, response.ok ? "TorBox returned no download link." : response.error);
  render();
}

function renderQuickBatch(batch: BatchRecord): HTMLElement {
  const section = document.createElement("section");
  section.className = "quick-download card";
  const heading = document.createElement("h2");
  heading.textContent = "Quick download";
  section.append(heading);
  const item = batch.items[0];
  if (!item) {
    section.append(message("The quick batch contains no item.", "error"));
    return section;
  }

  if (["queued", "creating", "processing"].includes(item.state)) {
    const progress = document.createElement("div");
    progress.className = "quick-state";
    progress.append(icon(LoaderCircle, "icon spin"), message(
      item.state === "processing"
        ? "TorBox is downloading the selected file. The download button will appear here when it is ready."
        : "Sending the selected link to TorBox. This popup will update while it is open.",
    ));
    section.append(progress);
  } else if (item.state === "ready_to_generate" && item.files.length === 1) {
    const key = generatedLinkKey(batch.id, item)!;
    const generatedUrl = generatedLinks.get(key);
    if (generatedUrl) {
      const file = item.files[0]!;
      const ready = document.createElement("div");
      ready.className = "quick-download-ready";
      const filename = document.createElement("p");
      filename.className = "quick-filename";
      filename.textContent = file.name;
      const link = document.createElement("a");
      link.className = "icon-button quick-download-link";
      link.href = generatedUrl;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.title = `Download ${file.name}`;
      link.setAttribute("aria-label", `Download ${file.name}`);
      link.append(icon(Download));
      ready.append(filename, link);
      section.append(ready);
    } else if (generationErrors.has(key)) {
      section.append(
        message(generationErrors.get(key)!, "error"),
        makeIconButton("Open batch details", ExternalLink, () => openBatch(batch.id), "icon-button secondary"),
      );
    } else {
      const progress = document.createElement("div");
      progress.className = "quick-state";
      progress.append(icon(LoaderCircle, "icon spin"), message("TorBox finished processing. Generating the download link..."));
      section.append(progress);
    }
  } else if (item.state === "ready_to_generate") {
    section.append(
      message(`TorBox reported ${item.files.length} files. Open the batch to choose which ones to generate.`),
      makeIconButton("Open batch details", ExternalLink, () => openBatch(batch.id), "icon-button secondary"),
    );
  } else {
    section.append(
      message(item.error ?? batch.attentionReason ?? "This quick download needs your attention.", "error"),
      makeIconButton("Open batch details", ExternalLink, () => openBatch(batch.id), "icon-button secondary"),
    );
  }
  if (batch.attentionReason && !item.error) section.append(message(batch.attentionReason, "warning"));
  return section;
}

async function createSelected(allowDuplicates: boolean): Promise<void> {
  if (!state || submitting) return;
  const byUrl = new Map(state.candidates.map((candidate) => [candidate.url, candidate]));
  const selections: BatchSelection[] = [...selected].flatMap((url) => {
    const candidate = byUrl.get(url);
    if (!candidate) return [];
    const selection: BatchSelection = {
      url: candidate.url,
      hosterId: candidate.hosterId,
      hosterName: candidate.hosterName,
    };
    const password = passwords.get(url);
    if (password) selection.password = password;
    return [selection];
  });
  const quickMode = selections.length === 1;
  const request: Extract<RuntimeRequest, { type: "CREATE_BATCH" }> = {
    type: "CREATE_BATCH",
    selections,
    private: state.private,
    allowDuplicates,
    openBatchTab: !quickMode,
    sourceTabId: state.tabId,
  };
  if (state.windowId !== undefined) request.windowId = state.windowId;
  submitting = true;
  popupError = null;
  render();
  const response = await send(request);
  if (!response.ok && response.duplicateSources && !allowDuplicates) {
    submitting = false;
    const proceed = window.confirm(`${response.duplicateSources.length} selected link(s) already exist in a recent batch. Create them again?`);
    if (proceed) await createSelected(true);
    else render();
    return;
  }
  if (!response.ok) {
    submitting = false;
    popupError = response.error;
    render();
    return;
  }
  if (!quickMode) {
    window.close();
    return;
  }
  submitting = false;
  selected.clear();
  passwords.clear();
  if (response.batch) state.quickBatch = response.batch;
  else await load();
  render();
  scheduleQuickRefresh();
  await maybeGenerateQuickLink();
}

function renderActionBar(): HTMLElement {
  const bar = document.createElement("footer");
  bar.className = "popup-action-bar";
  const selectAll = makeIconButton("Select all links", ListChecks, () => {
    for (const candidate of state?.candidates.slice(0, 60) ?? []) selected.add(candidate.url);
    render();
  });
  const pausedHere = Boolean(state && (
    state.settings.globalPaused || state.settings.excludedHosts.includes(state.hostname)
  ));
  selectAll.disabled = !state?.settings.keyValidated || state.candidates.length === 0 || pausedHere;
  const unselectAll = makeIconButton("Unselect all links", ListX, () => {
    selected.clear();
    render();
  });
  unselectAll.disabled = selected.size === 0;
  const create = makeIconButton(submitting ? "Creating batch" : "Create batch", ListPlus, () => createSelected(false));
  create.disabled = selected.size === 0 || submitting;
  const settings = makeIconButton("Settings", Settings, () => browser.runtime.openOptionsPage());
  bar.append(selectAll, unselectAll, create, settings);
  return bar;
}

function render(): void {
  const content = document.createElement("div");
  content.className = "popup-content";
  if (!state) {
    content.append(message(popupError ?? "Loading current page...", popupError ? "error" : "muted"));
    app.replaceChildren(content, renderActionBar());
    return;
  }
  const title = document.createElement("h1");
  title.textContent = "TorBox links";
  content.append(title);

  if (!state.settings.keyValidated) {
    content.append(message("Save and validate a TorBox API key before automatic discovery begins."));
    app.replaceChildren(content, renderActionBar());
    return;
  }

  const controls = document.createElement("div");
  controls.className = "button-row";
  controls.append(makeButton(state.settings.globalPaused ? "Resume everywhere" : "Pause everywhere", async () => {
    await send({ type: "SET_GLOBAL_PAUSED", paused: !state!.settings.globalPaused });
    await load();
  }, "secondary"));
  if (state.hostname) {
    const excluded = state.settings.excludedHosts.includes(state.hostname);
    controls.append(makeButton(excluded ? `Resume on ${state.hostname}` : `Pause on ${state.hostname}`, async () => {
      await send({ type: "SET_HOST_EXCLUDED", hostname: state!.hostname, excluded: !excluded });
      await load();
    }, "secondary"));
  }
  content.append(controls);

  if (state.quickBatch) content.append(renderQuickBatch(state.quickBatch));
  if (state.private) content.append(message("Private batch data lasts only for this browser session.", "warning"));
  if (!state.verified && state.candidates.length > 0) content.append(message("Cached matches are shown. TorBox availability will be checked before creation.", "warning"));
  if (state.truncated) content.append(message("This page exceeded the tested candidate cap. Results were truncated.", "warning"));
  if (popupError) content.append(message(popupError, "status error"));

  const pausedHere = state.settings.globalPaused || state.settings.excludedHosts.includes(state.hostname);
  if (pausedHere) {
    content.append(message("Automatic discovery is paused here."));
  } else if (state.candidates.length === 0) {
    content.append(message("No supported Hoster links were found on this page."));
  } else {
    const count = document.createElement("strong");
    count.className = "candidate-count";
    count.textContent = `${state.candidates.length} link(s), ${selected.size} selected`;
    content.append(count);

    const grouped = new Map<string, CandidateLink[]>();
    for (const candidate of state.candidates) {
      const key = `${candidate.hosterId}:${candidate.hosterName}`;
      grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
    }
    for (const [key, candidates] of grouped) {
      const group = document.createElement("section");
      group.className = "hoster-group";
      const heading = document.createElement("h2");
      heading.textContent = key.slice(key.indexOf(":") + 1);
      group.append(heading, ...candidates.map(renderCandidate));
      content.append(group);
    }
  }

  app.replaceChildren(content, renderActionBar());
}

async function load(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) {
    popupError = "The current tab is unavailable.";
    render();
    return;
  }
  const response = await send({ type: "GET_POPUP_STATE", tabId: tab.id });
  if (!response.ok || !response.popupState) {
    popupError = response.ok ? "The current page is unavailable." : response.error;
    render();
    return;
  }
  popupError = null;
  state = response.popupState;
  const validUrls = new Set(state.candidates.map((candidate) => candidate.url));
  for (const url of selected) if (!validUrls.has(url)) selected.delete(url);
  render();
  scheduleQuickRefresh();
  await maybeGenerateQuickLink();
}

window.addEventListener("unload", () => {
  if (quickRefreshTimer !== undefined) window.clearInterval(quickRefreshTimer);
});

void load();
