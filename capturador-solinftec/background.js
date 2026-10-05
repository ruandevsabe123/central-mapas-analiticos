const CENTRAL_URL = "https://ruandevsabe123.github.io/central-mapas-analiticos/";

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "TAKE_SCREENSHOT") {
    takeScreenshot().then((screenshot) => respond({ ok: true, screenshot })).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === "SEND_MANUAL_MAP") {
    sendManualMap(message.payload).then(() => respond({ ok: true })).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
});

async function activeSourceTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId) throw new Error("Aba ativa não encontrada.");
  if (tab.url?.startsWith(CENTRAL_URL)) throw new Error("Abra o mapa da Solinftec antes de tirar o print.");
  return tab;
}

async function takeScreenshot() {
  const tab = await activeSourceTab();
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
}

async function sendManualMap(payload) {
  const tab = await activeSourceTab();
  const screenshot = payload.screenshot || await takeScreenshot();
  const packet = {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    screenshot,
    sourceUrl: tab.url,
    rawText: "",
    panelText: "",
    directAverages: payload.manualAverages,
    ...payload,
  };
  delete packet.manualAverages;
  await chrome.storage.local.set({ pendingSolinftecCapture: packet });
  const tabs = await chrome.tabs.query({ url: `${CENTRAL_URL}*` });
  if (tabs[0]?.id) await chrome.tabs.update(tabs[0].id, { active: true, url: `${CENTRAL_URL}?captura=${Date.now()}` });
  else await chrome.tabs.create({ url: `${CENTRAL_URL}?captura=${Date.now()}` });
}
