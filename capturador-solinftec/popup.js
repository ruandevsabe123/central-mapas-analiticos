const savedFields = ["operation", "sector", "shift", "mapType", "period", "related"];
const DRAFT_KEY = "manualMapDraftV2";
let screenshot = "", rows = [], activeAverage = -1, initialized = false;

document.getElementById("period").value = new Date().toISOString().slice(0, 10);
chrome.storage.local.get([...savedFields, DRAFT_KEY], (saved) => {
  const draft = saved[DRAFT_KEY];
  savedFields.forEach((key) => {
    const element = document.getElementById(key);
    const value = draft?.values?.[key] ?? saved[key];
    if (value !== undefined) element[element.type === "checkbox" ? "checked" : "value"] = value;
  });
  document.getElementById("related").checked = true;
  rows = draft?.rows?.length ? draft.rows : [{ equipment: "", average: "" }];
  screenshot = draft?.screenshot || "";
  if (screenshot) restoreScreenshot();
  initialized = true;
  renderRows();
  if (draft) show("Rascunho restaurado automaticamente.");
});

document.addEventListener("input", (event) => {
  if (event.target.matches("input, select")) persistDraft();
});
document.addEventListener("change", (event) => {
  if (event.target.matches("input, select")) persistDraft();
});
document.getElementById("addFleet").onclick = () => {
  syncRows(); rows.push({ equipment: "", average: "" }); renderRows(); persistDraft();
};
document.getElementById("take").onclick = async () => {
  show("Capturando a tela...");
  const result = await chrome.runtime.sendMessage({ type: "TAKE_SCREENSHOT" });
  if (!result?.ok) return show(result?.error || "Não foi possível tirar o print.", true);
  screenshot = result.screenshot; restoreScreenshot(); persistDraft(); show("Print salvo no rascunho. Confira e envie.");
};
document.getElementById("send").onclick = async () => {
  syncRows(); const values = fieldValues();
  if (!values.operation || !values.sector) return show("Preencha operação e setor.", true);
  if (!screenshot) return show("Tire o print antes de enviar.", true);
  const manualAverages = rows.filter((item) => item.equipment && item.average);
  await chrome.storage.local.set(values); show("Enviando mapa...");
  const result = await chrome.runtime.sendMessage({ type: "SEND_MANUAL_MAP", payload: { ...values, screenshot, manualAverages } });
  if (!result?.ok) return show(result?.error || "Não foi possível enviar.", true);
  await chrome.storage.local.remove(DRAFT_KEY);
  show("Mapa enviado para a Central!"); setTimeout(() => window.close(), 700);
};

function fieldValues() {
  return Object.fromEntries(savedFields.map((key) => {
    const element = document.getElementById(key);
    return [key, element.type === "checkbox" ? element.checked : element.value.trim()];
  }));
}
function persistDraft() {
  if (!initialized) return;
  syncRows();
  chrome.storage.local.set({ [DRAFT_KEY]: { values: fieldValues(), rows, screenshot, savedAt: Date.now() } });
}
function restoreScreenshot() {
  const preview = document.getElementById("shotPreview");
  preview.src = screenshot; preview.hidden = false;
  document.getElementById("shotEmpty").hidden = true;
  document.getElementById("send").disabled = false;
}
function renderRows() {
  const box = document.getElementById("fleetRows");
  box.innerHTML = rows.length
    ? rows.map((item, index) => `<div class="fleetRow"><input data-fleet="${index}" inputmode="numeric" placeholder="Frota" value="${safe(item.equipment)}"><button data-average="${index}" class="average">${safe(item.average || "Digitar média")}</button><span>${document.getElementById("mapType").value === "Vazão" ? "L/ha" : "km/h"}</span><button data-remove="${index}" class="remove">×</button></div>`).join("")
    : `<p class="empty">Nenhuma frota adicionada.</p>`;
  box.querySelectorAll("[data-average]").forEach((button) => button.onclick = () => openPad(Number(button.dataset.average)));
  box.querySelectorAll("[data-remove]").forEach((button) => button.onclick = () => {
    syncRows(); rows.splice(Number(button.dataset.remove), 1); renderRows(); persistDraft();
  });
}
function syncRows() {
  document.querySelectorAll("[data-fleet]").forEach((input) => {
    if (rows[Number(input.dataset.fleet)]) rows[Number(input.dataset.fleet)].equipment = input.value.trim();
  });
}
function openPad(index) {
  syncRows(); activeAverage = index;
  document.getElementById("padFleet").textContent = rows[index].equipment || "SEM NÚMERO";
  document.getElementById("padValue").textContent = rows[index].average || "0,00";
  document.getElementById("pad").hidden = false;
}
function press(key) {
  let value = document.getElementById("padValue").textContent;
  if (value === "0,00") value = "";
  if (key === "⌫") value = value.slice(0, -1);
  else if (key === "," && !value.includes(",")) value += key;
  else if (/\d/.test(key) && value.replace(/\D/g, "").length < 6) value += key;
  document.getElementById("padValue").textContent = value || "0,00";
}
document.getElementById("digits").innerHTML = ["1","2","3","4","5","6","7","8","9",",","0","⌫"].map((key) => `<button data-key="${key}">${key}</button>`).join("");
document.querySelectorAll("[data-key]").forEach((button) => button.onclick = () => press(button.dataset.key));
document.getElementById("clear").onclick = () => document.getElementById("padValue").textContent = "0,00";
document.getElementById("confirmPad").onclick = () => {
  rows[activeAverage].average = document.getElementById("padValue").textContent;
  document.getElementById("pad").hidden = true; renderRows(); persistDraft();
};
document.getElementById("mapType").onchange = () => { renderRows(); persistDraft(); };
function safe(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]); }
function show(message, error = false) { const status = document.getElementById("status"); status.textContent = message; status.className = error ? "error" : ""; }
