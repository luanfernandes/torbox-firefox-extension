import type { BatchSelection } from "../domain/batch";
import type { CandidateLink } from "../domain/catalog";
import type { PopupState, RuntimeRequest, RuntimeResponse } from "../shared/types";

const app = document.querySelector<HTMLElement>("#app")!;
const selected = new Set<string>();
const passwords = new Map<string, string>();
let state: PopupState | null = null;

async function send(request: RuntimeRequest): Promise<RuntimeResponse> {
  return browser.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function makeButton(label: string, action: () => void | Promise<void>, className = ""): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
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

async function createSelected(allowDuplicates: boolean): Promise<void> {
  if (!state) return;
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
  const request: Extract<RuntimeRequest, { type: "CREATE_BATCH" }> = {
    type: "CREATE_BATCH",
    selections,
    private: state.private,
    allowDuplicates,
  };
  if (state.windowId !== undefined) request.windowId = state.windowId;
  const response = await send(request);
  if (!response.ok && response.duplicateSources && !allowDuplicates) {
    const proceed = window.confirm(`${response.duplicateSources.length} selected link(s) already exist in a recent batch. Create them again?`);
    if (proceed) await createSelected(true);
    return;
  }
  if (!response.ok) {
    const status = document.querySelector<HTMLElement>("#popup-status");
    if (status) {
      status.textContent = response.error;
      status.className = "status error";
    }
    return;
  }
  window.close();
}

function render(): void {
  app.replaceChildren();
  if (!state) {
    app.append(message("Loading current page..."));
    return;
  }
  const title = document.createElement("h1");
  title.textContent = "TorBox links";
  app.append(title);

  if (!state.settings.keyValidated) {
    app.append(
      message("Save and validate a TorBox API key before automatic discovery begins."),
      makeButton("Open settings", () => browser.runtime.openOptionsPage()),
    );
    return;
  }

  const controls = document.createElement("div");
  controls.className = "button-row";
  controls.append(
    makeButton(state.settings.globalPaused ? "Resume everywhere" : "Pause everywhere", async () => {
      await send({ type: "SET_GLOBAL_PAUSED", paused: !state!.settings.globalPaused });
      await load();
    }, "secondary"),
  );
  if (state.hostname) {
    const excluded = state.settings.excludedHosts.includes(state.hostname);
    controls.append(makeButton(excluded ? `Resume on ${state.hostname}` : `Pause on ${state.hostname}`, async () => {
      await send({ type: "SET_HOST_EXCLUDED", hostname: state!.hostname, excluded: !excluded });
      await load();
    }, "secondary"));
  }
  controls.append(makeButton("Settings", () => browser.runtime.openOptionsPage(), "secondary"));
  app.append(controls);

  if (state.private) app.append(message("Private batch data lasts only for this browser session.", "warning"));
  if (!state.verified && state.candidates.length > 0) app.append(message("Cached matches are shown. TorBox availability will be checked before creation.", "warning"));
  if (state.truncated) app.append(message("This page exceeded the tested candidate cap. Results were truncated.", "warning"));
  if (state.settings.globalPaused || state.settings.excludedHosts.includes(state.hostname)) {
    app.append(message("Automatic discovery is paused here."));
    return;
  }
  if (state.candidates.length === 0) {
    app.append(message("No supported Hoster links were found on this page."));
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  const count = document.createElement("strong");
  count.textContent = `${state.candidates.length} link(s), ${selected.size} selected`;
  const actions = document.createElement("div");
  actions.className = "button-row";
  actions.append(
    makeButton("Select all", () => {
      for (const candidate of state!.candidates.slice(0, 60)) selected.add(candidate.url);
      render();
    }, "secondary"),
    makeButton("Unselect all", () => {
      selected.clear();
      render();
    }, "secondary"),
  );
  toolbar.append(count, actions);
  app.append(toolbar);

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
    app.append(group);
  }

  const footer = document.createElement("div");
  footer.className = "button-row";
  const create = makeButton("Create batch", () => createSelected(false));
  create.disabled = selected.size === 0;
  footer.append(create);
  const status = document.createElement("p");
  status.id = "popup-status";
  status.className = "status";
  app.append(footer, status);
}

async function load(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) {
    app.replaceChildren(message("The current tab is unavailable.", "error"));
    return;
  }
  const response = await send({ type: "GET_POPUP_STATE", tabId: tab.id });
  if (!response.ok || !response.popupState) {
    app.replaceChildren(message(response.ok ? "The current page is unavailable." : response.error, "error"));
    return;
  }
  state = response.popupState;
  const validUrls = new Set(state.candidates.map((candidate) => candidate.url));
  for (const url of selected) if (!validUrls.has(url)) selected.delete(url);
  render();
}

void load();
