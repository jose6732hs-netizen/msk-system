/*! MSK SYSTEM • SOFTWARE PROPRIETÁRIO E RESTRITO • Cópia, clonagem, modificação ou redistribuição não autorizada é proibida. */
chrome.action.onClicked.addListener((tab) => {
chrome.sidePanel.open({ tabId: tab.id });
});
