const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (input, init) => {
  if (typeof input === "string") {
    input = input
      .replace("https://msksystem.online/api/public/license/validate", "https://msksystem.online/api/public/agent/license/validate")
      .replace("https://msksystem.online/api/public/license/heartbeat", "https://msksystem.online/api/public/agent/license/heartbeat");
  }
  return originalFetch(input, init);
};

await import("./background.js");
