/**
 * Service worker: context menu, pending selection, detached window,
 * and reliable bubble injection on http(s) tabs.
 */
"use strict";

const MENU_ID = "process-with-clipboard-alchemist";
const PENDING_KEY = "pendingSelection";
let detachedWindowId = null;

function setPending(text, source) {
  return chrome.storage.local.set({
    [PENDING_KEY]: {
      text: String(text || ""),
      source: source || "context-menu",
      at: Date.now(),
    },
  });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

function setPendingBadge() {
  chrome.action.setBadgeBackgroundColor({ color: "#8b6bb8" });
  chrome.action.setBadgeText({ text: "!" });
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function injectFloat(tabId) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["content/float.js"],
    });
  } catch (_) {
    /* Restricted page (chrome://, Web Store, etc.) or no permission yet */
  }
}

async function ensureFloatOnTab(tab) {
  if (!tab || tab.id == null || !isHttpUrl(tab.url)) return;
  await injectFloat(tab.id);
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ca-ensure-float" });
  } catch (_) {
    /* script may still be starting */
  }
}

async function openDetachedWindow() {
  if (detachedWindowId != null) {
    try {
      await chrome.windows.update(detachedWindowId, { focused: true });
      return { ok: true, reused: true };
    } catch (_) {
      detachedWindowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("popup.html?window=1"),
    type: "popup",
    width: 380,
    height: 600,
    focused: true,
  });
  detachedWindowId = win && win.id != null ? win.id : null;
  return { ok: true, reused: false };
}

chrome.windows.onRemoved.addListener((id) => {
  if (id === detachedWindowId) detachedWindowId = null;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Process with Clipboard Alchemist",
      contexts: ["selection"],
    });
  });
  clearBadge();

  // Seed the bubble onto already-open http(s) tabs after install/update
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    (tabs || []).forEach((tab) => {
      if (tab.id != null) injectFloat(tab.id);
    });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isHttpUrl(tab && tab.url)) {
    injectFloat(tabId);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await ensureFloatOnTab(tab);
  } catch (_) {
    /* ignore */
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const selection = (info.selectionText || "").trim();
  if (!selection) return;

  await setPending(selection, "context-menu");
  setPendingBadge();

  try {
    if (chrome.action && typeof chrome.action.openPopup === "function") {
      await chrome.action.openPopup();
      clearBadge();
    }
  } catch (_) {
    /* badge stays until popup / float opens */
  }

  try {
    const target = tab && tab.id != null ? tab : null;
    if (target) {
      await injectFloat(target.id);
      chrome.tabs.sendMessage(target.id, {
        type: "ca-toggle-float-panel",
        open: true,
      });
    }
  } catch (_) {
    /* content script may be unavailable on this page */
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "clear-pending-badge") {
    clearBadge();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "open-detached-window") {
    openDetachedWindow()
      .then((result) => sendResponse(result))
      .catch((err) =>
        sendResponse({
          ok: false,
          error: err && err.message ? err.message : "Failed",
        })
      );
    return true;
  }

  if (message.type === "ensure-float-active-tab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      ensureFloatOnTab(tab)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
    });
    return true;
  }

  return false;
});
