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

  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: revealEquipmentPanel,
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const panelScreenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  const [{ result: page }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectPageData,
  });
  const packet = {
    id: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    screenshot,
    panelScreenshot,
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

function revealEquipmentPanel() {
  const normalize = (value) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const targets = [...document.querySelectorAll("body *")].filter(
    (element) =>
      element.children.length === 0 && normalize(element.textContent || "") === "equipamento",
  );
  const target = targets.sort(
    (left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left,
  )[0];
  if (!target) return false;
  let scrollBox = target.parentElement;
  while (
    scrollBox &&
    scrollBox !== document.body &&
    scrollBox.scrollHeight <= scrollBox.clientHeight + 20
  )
    scrollBox = scrollBox.parentElement;
  if (scrollBox && scrollBox !== document.body) {
    const box = scrollBox.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    scrollBox.scrollTop += item.top - box.top - 90;
  } else {
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return true;
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
