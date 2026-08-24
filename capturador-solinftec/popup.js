const fields = ["operation", "sector", "shift", "mapType", "related"];
chrome.storage.local.get(fields, (saved) => fields.forEach((key) => { const element = document.getElementById(key); if (saved[key] !== undefined) element[element.type === "checkbox" ? "checked" : "value"] = saved[key]; }));

document.getElementById("inspect").addEventListener("click", inspect);
document.getElementById("capture").addEventListener("click", async () => {
  const payload = Object.fromEntries(fields.map((key) => { const element = document.getElementById(key); return [key, element.type === "checkbox" ? element.checked : element.value.trim()]; }));
  if (!payload.operation) return show("Escolha a operação antes de capturar.", true);
  chrome.storage.local.set(payload); show("Capturando e enviando...");
  const result = await chrome.runtime.sendMessage({ type: "CAPTURE_SOLINFTEC", payload });
  if (!result?.ok) return show(result?.error || "Não foi possível capturar.", true);
  show("Enviado! Abrindo a Central..."); setTimeout(() => window.close(), 700);
});

async function inspect() {
  show("Lendo dados diretamente da tela...");
  const result = await chrome.runtime.sendMessage({ type: "INSPECT_SOLINFTEC" });
  if (!result?.ok) return show(result?.error || "Não foi possível ler a página.", true);
  const data = result.data; const preview = document.getElementById("preview"); preview.hidden = false;
  preview.innerHTML = `<small>SETOR DETECTADO</small><b>${safe(data.detectedSector || "Não identificado")}</b><small>ATIVIDADE DA TELA</small><b>${safe(data.detectedActivity || "Não identificada")}</b><small>FROTAS E MÉDIAS</small><div>${data.directAverages.length ? data.directAverages.map((item) => `<strong>${safe(item.equipment)} → ${safe(item.average)}</strong>`).join("") : "Nenhum par encontrado"}</div>`;
  if (!document.getElementById("sector").value && data.detectedSector) document.getElementById("sector").value = data.detectedSector;
  show(data.directAverages.length ? "Confira e depois envie." : "O gráfico não está acessível no HTML.", !data.directAverages.length);
}
function safe(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function show(message, error = false) { const status = document.getElementById("status"); status.textContent = message; status.className = error ? "error" : ""; }
