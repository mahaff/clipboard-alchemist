/**
 * chrome.storage.local helpers for Clipboard Alchemist.
 */
(function (global) {
  "use strict";

  const KEYS = {
    snippets: "snippets",
    history: "history",
    prefs: "prefs",
    pendingSelection: "pendingSelection",
  };

  const MAX_HISTORY = 40;
  const MAX_SNIPPETS = 100;

  const DEFAULT_PREFS = {
    mode: "light",
    accent: "lavender",
    customAccent: "#8b6bb8",
    floatIcon: "strawberry",
    floatEnabled: true,
    floatX: null,
    floatY: null,
    confirmClear: true,
    // legacy key kept so older installs still load
    theme: "lavender",
  };

  const FLOAT_ICONS = [
    { id: "strawberry", label: "Strawberry", file: "icons/mascots/strawberry.png" },
    { id: "navy", label: "Navy", file: "icons/mascots/navy.png" },
    { id: "sky-blue", label: "Sky Blue", file: "icons/mascots/sky-blue.png" },
    { id: "watermelon", label: "Watermelon", file: "icons/mascots/watermelon.png" },
    { id: "aqua-fish", label: "Aqua Fish", file: "icons/mascots/aqua-fish.png" },
  ];

  const SNIPPET_COLORS = [
    { id: "violet", hex: "#a78bfa" },
    { id: "teal", hex: "#2dd4bf" },
    { id: "rose", hex: "#fb7185" },
    { id: "amber", hex: "#fbbf24" },
    { id: "sky", hex: "#38bdf8" },
    { id: "mint", hex: "#86efac" },
  ];

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(obj, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function getPrefs() {
    const data = await storageGet([KEYS.prefs]);
    return Object.assign({}, DEFAULT_PREFS, data[KEYS.prefs] || {});
  }

  async function savePrefs(prefs) {
    const merged = Object.assign({}, DEFAULT_PREFS, prefs);
    await storageSet({ [KEYS.prefs]: merged });
    return merged;
  }

  async function getSnippets() {
    const data = await storageGet([KEYS.snippets]);
    const list = Array.isArray(data[KEYS.snippets]) ? data[KEYS.snippets] : [];
    return list;
  }

  async function saveSnippet(snippet) {
    const list = await getSnippets();
    if (list.length >= MAX_SNIPPETS) {
      throw new Error(`Snippet limit reached (${MAX_SNIPPETS}). Delete some first.`);
    }
    const item = {
      id: snippet.id || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: String(snippet.title || "Untitled").slice(0, 80),
      text: String(snippet.text || ""),
      color: snippet.color || "violet",
      emoji: snippet.emoji || "✨",
      createdAt: snippet.createdAt || Date.now(),
    };
    list.unshift(item);
    await storageSet({ [KEYS.snippets]: list });
    return item;
  }

  async function deleteSnippet(id) {
    const list = await getSnippets();
    const next = list.filter((s) => s.id !== id);
    await storageSet({ [KEYS.snippets]: next });
    return next;
  }

  async function updateSnippet(id, patch) {
    const list = await getSnippets();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch, { id });
    await storageSet({ [KEYS.snippets]: list });
    return list[idx];
  }

  async function getHistory() {
    const data = await storageGet([KEYS.history]);
    return Array.isArray(data[KEYS.history]) ? data[KEYS.history] : [];
  }

  async function addHistoryEntry(entry) {
    const list = await getHistory();
    const item = {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action: String(entry.action || "transform"),
      label: String(entry.label || "Transform"),
      before: String(entry.before || "").slice(0, 2000),
      after: String(entry.after || "").slice(0, 2000),
      createdAt: Date.now(),
    };
    list.unshift(item);
    await storageSet({ [KEYS.history]: list.slice(0, MAX_HISTORY) });
    return item;
  }

  async function clearHistory() {
    await storageSet({ [KEYS.history]: [] });
  }

  async function consumePendingSelection() {
    const data = await storageGet([KEYS.pendingSelection]);
    const pending = data[KEYS.pendingSelection] || null;
    if (pending) {
      await storageSet({ [KEYS.pendingSelection]: null });
    }
    return pending;
  }

  global.AlchemistStorage = {
    KEYS,
    DEFAULT_PREFS,
    FLOAT_ICONS,
    SNIPPET_COLORS,
    MAX_HISTORY,
    MAX_SNIPPETS,
    getPrefs,
    savePrefs,
    getSnippets,
    saveSnippet,
    deleteSnippet,
    updateSnippet,
    getHistory,
    addHistoryEntry,
    clearHistory,
    consumePendingSelection,
    storageGet,
    storageSet,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
