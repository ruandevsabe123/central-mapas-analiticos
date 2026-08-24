const savedFields = ["operation", "sector", "shift", "mapType", "period", "related"];
let screenshot = "", rows = [], activeAverage = -1;
document.getElementById("period").value = new Date().toISOString().slice(0, 10);
chrome.storage.local.get(savedFields, (saved) => savedFields.forEach((key) => { const element = document.getElementById(key); if (saved[key] !== undefined) element[element.type === "checkbox" ? "checked" : "value"] = saved[key]; }));

document.getElementById("addFleet").onclick = () => { rows.push({ equipment: "", average: "" }); renderRows(); };
document.getElementById("take").onclick = async () => {
  show("Capturando a tela..."); const result = await chrome.runtime.sendMessage({ type: "TAKE_SCREENSHOT" });
  if (!result?.ok) return show(result?.error || "Não foi possível tirar o print.", true);
  screenshot = result.screenshot; const preview = document.getElementById("shotPreview"); preview.src = screenshot; preview.hidden = false; document.getElementById("shotEmpty").hidden = true; document.getElementById("send").disabled = false; show("Print pronto. Confira e envie.");
};
document.getElementById("send").onclick = async () => {
  syncRows(); const values = Object.fromEntries(savedFields.map((key) => { const element = document.getElementById(key); return [key, element.type === "checkbox" ? element.checked : element.value.trim()]; }));
  if (!values.operation || !values.sector) return show("Preencha operação e setor.", true);
  const manualAverages = rows.filter((item) => item.equipment && item.average);
  chrome.storage.local.set(values); show("Enviando mapa...");
  const result = await chrome.runtime.sendMessage({ type: "SEND_MANUAL_MAP", payload: { ...values, screenshot, manualAverages } });
  if (!result?.ok) return show(result?.error || "Não foi possível enviar.", true);
  show("Mapa enviado para a Central!"); setTimeout(() => window.close(), 700);
};

function renderRows() {
  const box = document.getElementById("fleetRows"); box.innerHTML = rows.length ? rows.map((item, index) => `<div class="fleetRow"><input data-fleet="${index}" inputmode="numeric" placeholder="Frota" value="${safe(item.equipment)}"><button data-average="${index}" class="average">${safe(item.average || "Digitar média")}</button><span>${document.getElementById("mapType").value === "Vazão" ? "L/ha" : "km/h"}</span><button data-remove="${index}" class="remove">×</button></div>`).join("") : `<p class="empty">Nenhuma frota adicionada.</p>`;
  box.querySelectorAll("[data-average]").forEach((button) => button.onclick = () => openPad(Number(button.dataset.average)));
  box.querySelectorAll("[data-remove]").forEach((button) => button.onclick = () => { syncRows(); rows.splice(Number(button.dataset.remove), 1); renderRows(); });
}
function syncRows() { document.querySelectorAll("[data-fleet]").forEach((input) => rows[Number(input.dataset.fleet)].equipment = input.value.trim()); }
function openPad(index) { syncRows(); activeAverage = index; document.getElementById("padFleet").textContent = rows[index].equipment || "SEM NÚMERO"; document.getElementById("padValue").textContent = rows[index].average || "0,00"; document.getElementById("pad").hidden = false; }
function press(key) { let value = document.getElementById("padValue").textContent; if (value === "0,00") value = ""; if (key === "⌫") value = value.slice(0, -1); else if (key === "," && !value.includes(",")) value += key; else if (/\d/.test(key) && value.replace(/\D/g, "").length < 6) value += key; document.getElementById("padValue").textContent = value || "0,00"; }
document.getElementById("digits").innerHTML = ["1","2","3","4","5","6","7","8","9",",","0","⌫"].map((key) => `<button data-key="${key}">${key}</button>`).join("");
document.querySelectorAll("[data-key]").forEach((button) => button.onclick = () => press(button.dataset.key));
document.getElementById("clear").onclick = () => document.getElementById("padValue").textContent = "0,00";
document.getElementById("confirmPad").onclick = () => { rows[activeAverage].average = document.getElementById("padValue").textContent; document.getElementById("pad").hidden = true; renderRows(); };
document.getElementById("mapType").onchange = renderRows;
function safe(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]); }
function show(message, error = false) { const status = document.getElementById("status"); status.textContent = message; status.className = error ? "error" : ""; }
rows.push({ equipment: "", average: "" }); renderRows();
