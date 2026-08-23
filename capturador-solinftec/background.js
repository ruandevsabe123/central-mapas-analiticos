const CENTRAL_URL = "https://central-mapas-analiticos.onrender.com/";

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type !== "CAPTURE_SOLINFTEC") return;
  capture(message.payload)
    .then(() => respond({ ok: true }))
    .catch((error) => respond({ ok: false, error: error.message }));
  return true;
});

async function capture(selection) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId) throw new Error("Aba ativa não encontrada.");
  if (tab.url?.includes("central-mapas-analiticos.onrender.com"))
    throw new Error("Abra o mapa da Solinftec antes de capturar.");

  const [{ result: page }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectPageData,
  });
  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  const packet = {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    screenshot,
    sourceUrl: tab.url,
    ...page,
    ...selection,
  };
  await chrome.storage.local.set({ pendingSolinftecCapture: packet });

  const tabs = await chrome.tabs.query({ url: `${CENTRAL_URL}*` });
  if (tabs[0]?.id) {
    await chrome.tabs.update(tabs[0].id, { active: true, url: `${CENTRAL_URL}?captura=${Date.now()}` });
  } else {
    await chrome.tabs.create({ url: `${CENTRAL_URL}?captura=${Date.now()}` });
  }
}

function collectPageData() {
  const rawText = document.body.innerText || "";
  const chartText = [...document.querySelectorAll("svg text")]
    .map((element) => element.textContent?.trim())
    .filter(Boolean)
    .join("\n");
  const normalized = rawText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const equipmentStart = normalized.lastIndexOf("equipamento");
  const operationStart = normalized.indexOf("operacao", equipmentStart + 11);
  const panelSlice = equipmentStart >= 0
    ? rawText.slice(equipmentStart, operationStart > equipmentStart ? operationStart : equipmentStart + 1200)
    : rawText;
  return { rawText, panelText: `${panelSlice}\n${chartText}`, pageTitle: document.title };
}
