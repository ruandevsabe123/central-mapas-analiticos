const CENTRAL_URL = "https://central-mapas-analiticos.onrender.com/";

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "INSPECT_SOLINFTEC") {
    inspectActiveTab().then((data) => respond({ ok: true, data })).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === "CAPTURE_SOLINFTEC") {
    capture(message.payload).then(() => respond({ ok: true })).catch((error) => respond({ ok: false, error: error.message }));
    return true;
  }
});

async function activeSolinftecTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.windowId) throw new Error("Aba ativa não encontrada.");
  if (tab.url?.includes("central-mapas-analiticos.onrender.com")) throw new Error("Abra o mapa da Solinftec antes de continuar.");
  return tab;
}

async function inspectActiveTab() {
  const tab = await activeSolinftecTab();
  await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: revealEquipmentPanel });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: collectPageData });
  const candidates = frames.map((frame) => frame.result).filter(Boolean).sort((left, right) => right.directAverages.length - left.directAverages.length || right.rawText.length - left.rawText.length);
  if (!candidates[0]) throw new Error("Conteúdo da Solinftec não encontrado.");
  return candidates[0];
}

async function capture(selection) {
  const tab = await activeSolinftecTab();
  const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const page = await inspectActiveTab();
  const panelScreenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const packet = { id: crypto.randomUUID(), capturedAt: new Date().toISOString(), screenshot, panelScreenshot, sourceUrl: tab.url, ...page, ...selection };
  await chrome.storage.local.set({ pendingSolinftecCapture: packet });
  const tabs = await chrome.tabs.query({ url: `${CENTRAL_URL}*` });
  if (tabs[0]?.id) await chrome.tabs.update(tabs[0].id, { active: true, url: `${CENTRAL_URL}?captura=${Date.now()}` });
  else await chrome.tabs.create({ url: `${CENTRAL_URL}?captura=${Date.now()}` });
}

function revealEquipmentPanel() {
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const targets = [...document.querySelectorAll("body *")].filter((element) => element.children.length === 0 && normalize(element.textContent || "") === "equipamento");
  const target = targets.sort((left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left)[0];
  if (!target) return false;
  let scrollBox = target.parentElement;
  while (scrollBox && scrollBox !== document.body && scrollBox.scrollHeight <= scrollBox.clientHeight + 20) scrollBox = scrollBox.parentElement;
  if (scrollBox && scrollBox !== document.body) {
    const box = scrollBox.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    scrollBox.scrollTop += item.top - box.top - 70;
  } else target.scrollIntoView({ block: "start", behavior: "instant" });
  return true;
}

function collectPageData() {
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const rawText = document.body.innerText || "";
  const normalized = normalize(rawText);
  const equipmentStart = normalized.lastIndexOf("equipamento");
  const operationStart = normalized.indexOf("operacao", equipmentStart + 11);
  const panelSlice = equipmentStart >= 0 ? rawText.slice(equipmentStart, operationStart > equipmentStart ? operationStart : equipmentStart + 1500) : rawText;
  const visibleTexts = [...document.querySelectorAll("svg text, body *")]
    .filter((element) => element.matches("svg text") || element.children.length === 0)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { text: (element.textContent || "").trim(), x: Math.round(rect.left), y: Math.round(rect.top + rect.height / 2), visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.left < Math.min(480, innerWidth * 0.3) };
    })
    .filter((item) => item.visible && item.text);
  const equipmentLabel = visibleTexts.filter((item) => normalize(item.text) === "equipamento").sort((a, b) => b.y - a.y)[0];
  const operationLabel = visibleTexts.filter((item) => normalize(item.text) === "operacao" && item.y > (equipmentLabel?.y || 0)).sort((a, b) => a.y - b.y)[0];
  const graphTop = (equipmentLabel?.y || 0) + 20;
  const graphBottom = operationLabel?.y || innerHeight;
  const graphNumbers = visibleTexts.filter((item) => item.y > graphTop && item.y < graphBottom && /^\d{1,6}(?:[.,]\d{1,3})?$/.test(item.text));
  const fleets = graphNumbers.filter((item) => /^\d{3,6}$/.test(item.text) && item.x < 140);
  const decimals = graphNumbers.filter((item) => /[.,]/.test(item.text) && item.x > 100);
  const directAverages = fleets.map((fleet) => {
    const average = decimals.map((item) => ({ ...item, distance: Math.abs(item.y - fleet.y) })).filter((item) => item.distance <= 18).sort((a, b) => a.distance - b.distance)[0];
    return average ? { equipment: fleet.text, average: average.text.replace(".", ",") } : null;
  }).filter(Boolean).filter((item, index, all) => all.findIndex((candidate) => candidate.equipment === item.equipment) === index);
  const chartText = visibleTexts.map((item) => item.text).join("\n");
  const sector = rawText.match(/\b([A-Z]{1,5}\d*)[_-]TA\s*\d+\b/i)?.[1] || "";
  const activity = rawText.match(/\b\d{4,8}\s*[-–]\s*([^\n]+(?:\n[A-ZÀ-Ú][A-ZÀ-Ú\s/-]{2,35})?)/i)?.[1] || "";
  return { rawText, panelText: `${panelSlice}\n${chartText}`, pageTitle: document.title, directAverages, detectedSector: sector.toUpperCase(), detectedActivity: activity.replace(/\s+/g, " ").trim() };
}
