import type { PublicSettings, RuntimeRequest, RuntimeResponse } from "../shared/types";

const apiForm = document.querySelector<HTMLFormElement>("#api-form")!;
const apiKey = document.querySelector<HTMLInputElement>("#api-key")!;
const apiStatus = document.querySelector<HTMLElement>("#api-status")!;
const pageStatus = document.querySelector<HTMLElement>("#page-status")!;
const clearKey = document.querySelector<HTMLButtonElement>("#clear-key")!;
const globalPaused = document.querySelector<HTMLInputElement>("#global-paused")!;
const includeNsfw = document.querySelector<HTMLInputElement>("#include-nsfw")!;
const notifications = document.querySelector<HTMLInputElement>("#notifications")!;
const excludedHosts = document.querySelector<HTMLElement>("#excluded-hosts")!;

async function send(request: RuntimeRequest): Promise<RuntimeResponse> {
  return browser.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function setStatus(message: string, error = false): void {
  pageStatus.textContent = message;
  pageStatus.className = `status ${error ? "error" : "success"}`;
}

function renderExcluded(settings: PublicSettings): void {
  excludedHosts.replaceChildren();
  if (settings.excludedHosts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No hostname exclusions.";
    excludedHosts.append(empty);
    return;
  }
  for (const hostname of settings.excludedHosts) {
    const row = document.createElement("div");
    row.className = "toolbar";
    const label = document.createElement("span");
    label.textContent = hostname;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      const response = await send({ type: "SET_HOST_EXCLUDED", hostname, excluded: false });
      if (response.ok && response.settings) render(response.settings);
    });
    row.append(label, remove);
    excludedHosts.append(row);
  }
}

function render(settings: PublicSettings): void {
  globalPaused.checked = settings.globalPaused;
  includeNsfw.checked = settings.includeNsfw;
  notifications.checked = settings.notificationsEnabled;
  apiStatus.textContent = settings.keyConfigured && settings.keyValidated
    ? "A validated API key is stored locally. Enter a new key to replace it."
    : "No validated API key is stored.";
  apiStatus.className = `status ${settings.keyValidated ? "success" : "muted"}`;
  renderExcluded(settings);
}

apiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  apiStatus.textContent = "Checking the key with TorBox...";
  const response = await send({ type: "SAVE_API_KEY", apiKey: apiKey.value });
  apiKey.value = "";
  if (!response.ok) {
    apiStatus.textContent = response.error;
    apiStatus.className = "status error";
    return;
  }
  if (response.settings) render(response.settings);
  setStatus("Setup complete. Automatic discovery is active.");
});

clearKey.addEventListener("click", async () => {
  if (!window.confirm("Clear the saved TorBox API key and stop automatic discovery?")) return;
  const response = await send({ type: "CLEAR_API_KEY" });
  if (response.ok && response.settings) {
    render(response.settings);
    setStatus("The API key was cleared.");
  }
});

globalPaused.addEventListener("change", async () => {
  const response = await send({ type: "SET_GLOBAL_PAUSED", paused: globalPaused.checked });
  if (response.ok && response.settings) render(response.settings);
});

includeNsfw.addEventListener("change", async () => {
  const response = await send({ type: "SET_NSFW", enabled: includeNsfw.checked });
  if (response.ok && response.settings) render(response.settings);
});

notifications.addEventListener("change", async () => {
  if (notifications.checked) {
    const granted = await browser.permissions.request({ permissions: ["notifications"] });
    if (!granted) {
      notifications.checked = false;
      setStatus("Zen did not grant notification permission.", true);
      return;
    }
  } else {
    await browser.permissions.remove({ permissions: ["notifications"] });
  }
  const response = await send({ type: "SET_NOTIFICATIONS", enabled: notifications.checked });
  if (response.ok && response.settings) render(response.settings);
});

void send({ type: "GET_SETTINGS" }).then((response) => {
  if (response.ok && response.settings) render(response.settings);
  else if (!response.ok) setStatus(response.error, true);
});

