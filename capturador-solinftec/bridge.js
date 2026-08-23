chrome.storage.local.get("pendingSolinftecCapture", ({ pendingSolinftecCapture }) => {
  if (!pendingSolinftecCapture) return;
  const send = () =>
    window.postMessage(
      { type: "SOLINFTEC_CAPTURE", payload: pendingSolinftecCapture },
      window.location.origin,
    );
  const timer = setInterval(send, 500);
  send();
  const received = (event) => {
    if (
      event.source !== window ||
      event.data?.type !== "SOLINFTEC_CAPTURE_RECEIVED" ||
      event.data.id !== pendingSolinftecCapture.id
    )
      return;
    clearInterval(timer);
    window.removeEventListener("message", received);
    chrome.storage.local.remove("pendingSolinftecCapture");
  };
  window.addEventListener("message", received);
  setTimeout(() => clearInterval(timer), 15000);
});
