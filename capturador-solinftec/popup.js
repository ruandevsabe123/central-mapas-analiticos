const fields = ["operation", "sector", "shift", "mapType", "related"];
chrome.storage.local.get(fields, (saved) => {
  for (const key of fields) {
    const element = document.getElementById(key);
    if (saved[key] !== undefined)
      element[element.type === "checkbox" ? "checked" : "value"] = saved[key];
  }
});

document.getElementById("capture").addEventListener("click", async () => {
  const payload = Object.fromEntries(
    fields.map((key) => {
      const element = document.getElementById(key);
      return [key, element.type === "checkbox" ? element.checked : element.value.trim()];
    }),
  );
  if (!payload.operation) return show("Escolha a operação antes de capturar.", true);
  chrome.storage.local.set(payload);
  show("Capturando e enviando...");
  const result = await chrome.runtime.sendMessage({ type: "CAPTURE_SOLINFTEC", payload });
  if (!result?.ok) return show(result?.error || "Não foi possível capturar.", true);
  show("Enviado! Abrindo a Central...");
  setTimeout(() => window.close(), 700);
});

function show(message, error = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = error ? "error" : "";
}
