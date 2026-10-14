/**
 * Clipboard Alchemist — friendly everyday popup
 */
(function () {
  "use strict";

  const Detect = globalThis.AlchemistDetect;
  const Transforms = globalThis.AlchemistTransforms;
  const Storage = globalThis.AlchemistStorage;

  const ACCENTS = [
    { id: "lavender", label: "Lavender" },
    { id: "rose", label: "Rose" },
    { id: "sage", label: "Sage" },
    { id: "sky", label: "Sky" },
  ];

  const SNIPPET_EMOJIS = ["✨", "📌", "💡", "🔗", "📧", "📞", "🪄", "📝", "💜", "🌿"];

  const els = {
    app: document.getElementById("app"),
    mascotImg: document.getElementById("mascotImg"),
    statusHint: document.getElementById("statusHint"),
    inputText: document.getElementById("inputText"),
    actionGrid: document.getElementById("actionGrid"),
    resultsBody: document.getElementById("resultsBody"),
    resultsNote: document.getElementById("resultsNote"),
    resultsTitle: document.getElementById("resultsTitle"),
    toast: document.getElementById("toast"),
    saveModal: document.getElementById("saveModal"),
    snippetTitle: document.getElementById("snippetTitle"),
    snippetColors: document.getElementById("snippetColors"),
    snippetEmojis: document.getElementById("snippetEmojis"),
    snippetList: document.getElementById("snippetList"),
    snippetEmpty: document.getElementById("snippetEmpty"),
    snippetSearch: document.getElementById("snippetSearch"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    historySearch: document.getElementById("historySearch"),
    themeGrid: document.getElementById("themeGrid"),
    modeRow: document.getElementById("modeRow"),
    iconChoiceGrid: document.getElementById("iconChoiceGrid"),
    accentPicker: document.getElementById("accentPicker"),
    prefConfirmClear: document.getElementById("prefConfirmClear"),
    prefFloat: document.getElementById("prefFloat"),
  };

  function setBtnClass(btn, base, selected) {
    btn.className = selected ? base + " is-selected" : base;
  }

  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get("embed") === "1";
  const isWindow = params.get("window") === "1";
  if (isEmbed) {
    document.documentElement.classList.add("is-embed");
    document.body.classList.add("is-embed");
  }
  if (isWindow) {
    document.documentElement.classList.add("is-window");
    document.body.classList.add("is-window");
  }

  const state = {
    prefs: Object.assign({}, Storage.DEFAULT_PREFS),
    lastResult: "",
    lastActionLabel: "",
    saveColor: "violet",
    saveEmoji: "✨",
    snippets: [],
    history: [],
    toastTimer: null,
  };

  function toast(message, isError) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    els.toast.classList.toggle("is-error", Boolean(isError));
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2400);
  }

  function setResults(text, note, isEmptyMessage) {
    state.lastResult = text || "";
    els.resultsBody.textContent =
      text ||
      (isEmptyMessage
        ? note || "Nothing here yet."
        : "Results will show up here.");
    els.resultsBody.classList.toggle(
      "is-empty",
      !text || Boolean(isEmptyMessage)
    );
    els.resultsNote.textContent = note || "";
  }

  function updateHint() {
    const info = Detect.detect(els.inputText.value);
    els.statusHint.textContent = info.explanation;
  }

  function migratePrefs(prefs) {
    const next = Object.assign({}, Storage.DEFAULT_PREFS, prefs || {});
    if (!next.mode) {
      next.mode =
        next.theme === "midnight" || next.theme === "cyberpunk"
          ? "dark"
          : "light";
    }
    if (!next.accent) {
      if (next.theme === "matcha") next.accent = "sage";
      else if (next.theme === "sunset") next.accent = "rose";
      else next.accent = "lavender";
    }
    if (!next.floatIcon) next.floatIcon = "strawberry";
    if (typeof next.floatEnabled !== "boolean") next.floatEnabled = true;
    return next;
  }

  function floatIconPath(id) {
    const found = (Storage.FLOAT_ICONS || []).find((i) => i.id === id);
    return found ? found.file : "icons/mascots/strawberry.png";
  }

  function applyTheme() {
    const mode = state.prefs.mode === "dark" ? "dark" : "light";
    const accent = state.prefs.accent || "lavender";
    els.app.dataset.mode = mode;
    els.app.dataset.accent = accent;
    if (accent === "custom" && state.prefs.customAccent) {
      els.app.style.setProperty("--accent", state.prefs.customAccent);
    } else {
      els.app.style.removeProperty("--accent");
    }
    els.accentPicker.value = state.prefs.customAccent || "#8b6bb8";
  }

  function applyMascot() {
    if (els.mascotImg) {
      els.mascotImg.src = chrome.runtime.getURL(
        floatIconPath(state.prefs.floatIcon || "strawberry")
      );
    }
  }

  function renderActions() {
    while (els.actionGrid.firstChild) {
      els.actionGrid.removeChild(els.actionGrid.firstChild);
    }
    Object.values(Transforms.ACTIONS).forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      setBtnClass(btn, "action-btn", false);
      btn.title = action.label;

      const icon = document.createElement("span");
      setBtnClass(icon, "action-icon", false);
      icon.textContent = action.icon || "•";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      setBtnClass(label, "action-label", false);
      label.textContent = action.label;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener("click", () => runAction(action.id));
      els.actionGrid.appendChild(btn);
    });
  }

  async function runAction(actionId) {
    const action = Transforms.ACTIONS[actionId];
    if (!action) return;
    const before = els.inputText.value;
    const outcome = action.run(before);

    if (!outcome.ok) {
      setResults("", outcome.error || "Nothing found.", true);
      els.resultsTitle.textContent = action.label;
      toast(outcome.error || "Nothing found.", true);
      return;
    }

    state.lastActionLabel = action.label;
    els.resultsTitle.textContent = action.label;
    setResults(outcome.result, outcome.note || "", false);

    // Clean Text also refreshes the input so editing feels natural
    if (actionId === "cleanText") {
      els.inputText.value = outcome.result;
      updateHint();
    }

    toast(outcome.note || `${action.label} done`);
    await Storage.addHistoryEntry({
      action: actionId,
      label: action.label,
      before,
      after: outcome.result,
    });
    state.history = await Storage.getHistory();
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
      toast("Paste isn’t available here. Try Ctrl+V.", true);
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      els.inputText.value = text;
      updateHint();
      toast(text ? "Pasted!" : "Clipboard was empty.");
    } catch (_) {
      toast("Couldn’t paste. Allow clipboard access, or press Ctrl+V.", true);
    }
  }

  async function copyResult() {
    const text = state.lastResult;
    if (!text) {
      toast("Nothing to copy yet.", true);
      return;
    }
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      toast("Copy isn’t available here.", true);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Results copied!");
    } catch (_) {
      toast("Couldn’t copy. Check clipboard permission.", true);
    }
  }

  function clearAll() {
    const doClear = () => {
      els.inputText.value = "";
      state.lastResult = "";
      state.lastActionLabel = "";
      els.resultsTitle.textContent = "Results";
      setResults("", "", false);
      updateHint();
      toast("Cleared.");
    };
    if (state.prefs.confirmClear && (els.inputText.value || state.lastResult)) {
      if (window.confirm("Clear your text and results?")) doClear();
    } else {
      doClear();
    }
  }

  function switchTab(name) {
    const target = String(name || "home");
    document.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.tab === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      const id = panel.id.replace("panel-", "");
      const active = id === target;
      panel.classList.toggle("is-active", active);
      if (active) {
        panel.hidden = false;
        panel.removeAttribute("hidden");
        panel.scrollTop = 0;
      } else {
        panel.hidden = true;
        panel.setAttribute("hidden", "");
      }
    });
    if (target === "snippets") renderSnippets();
    if (target === "history") renderHistory();
    if (target === "settings") {
      try {
        renderSettingsControls();
      } catch (err) {
        toast("Couldn’t open settings.", true);
      }
    }
  }

  function colorHex(id) {
    const found = Storage.SNIPPET_COLORS.find((c) => c.id === id);
    return found ? found.hex : "#8b6bb8";
  }

  function openSaveModal() {
    const text = state.lastResult || els.inputText.value;
    if (!String(text || "").trim()) {
      toast("Nothing to save yet.", true);
      return;
    }
    els.snippetTitle.value = state.lastActionLabel
      ? state.lastActionLabel
      : "";
    state.saveColor = "violet";
    state.saveEmoji = "✨";
    renderSavePickers();
    els.saveModal.hidden = false;
    els.snippetTitle.focus();
  }

  function renderSavePickers() {
    while (els.snippetColors.firstChild) {
      els.snippetColors.removeChild(els.snippetColors.firstChild);
    }
    Storage.SNIPPET_COLORS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      setBtnClass(btn, "color-dot", state.saveColor === c.id);
      btn.style.background = c.hex;
      btn.title = c.id;
      btn.addEventListener("click", () => {
        state.saveColor = c.id;
        renderSavePickers();
      });
      els.snippetColors.appendChild(btn);
    });

    while (els.snippetEmojis.firstChild) {
      els.snippetEmojis.removeChild(els.snippetEmojis.firstChild);
    }
    SNIPPET_EMOJIS.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.type = "button";
      setBtnClass(btn, "emoji-pick", state.saveEmoji === emoji);
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        state.saveEmoji = emoji;
        renderSavePickers();
      });
      els.snippetEmojis.appendChild(btn);
    });
  }

  async function confirmSaveSnippet() {
    const text = state.lastResult || els.inputText.value;
    const title = els.snippetTitle.value.trim() || "Saved item";
    try {
      await Storage.saveSnippet({
        title,
        text,
        color: state.saveColor,
        emoji: state.saveEmoji,
      });
      state.snippets = await Storage.getSnippets();
      els.saveModal.hidden = true;
      toast("Saved!");
    } catch (err) {
      toast(err.message || "Couldn’t save.", true);
    }
  }

  function renderSnippets() {
    const q = (els.snippetSearch.value || "").trim().toLowerCase();
    while (els.snippetList.firstChild) {
      els.snippetList.removeChild(els.snippetList.firstChild);
    }
    const filtered = state.snippets.filter((s) => {
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.text.toLowerCase().includes(q) ||
        (s.emoji || "").includes(q)
      );
    });
    els.snippetEmpty.hidden = filtered.length > 0;
    filtered.forEach((s) => {
      const card = document.createElement("article");
      card.className = "card-item";

      const top = document.createElement("div");
      top.className = "card-item-top";

      const emoji = document.createElement("span");
      emoji.className = "card-emoji";
      emoji.textContent = s.emoji || "✨";

      const title = document.createElement("span");
      title.className = "card-title";
      title.textContent = s.title || "Saved item";

      const dot = document.createElement("span");
      dot.className = "card-dot";
      dot.style.background = colorHex(s.color);

      top.appendChild(emoji);
      top.appendChild(title);
      top.appendChild(dot);

      const body = document.createElement("pre");
      body.className = "card-body";
      body.textContent = s.text;

      const actions = document.createElement("div");
      actions.className = "card-actions";

      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "btn btn-sm btn-secondary";
      useBtn.textContent = "Use";
      useBtn.addEventListener("click", () => {
        els.inputText.value = s.text;
        setResults(s.text, "Loaded from Saved.", false);
        updateHint();
        switchTab("home");
        toast("Loaded.");
      });

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "btn btn-sm btn-ghost";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(s.text);
          toast("Copied!");
        } catch (_) {
          toast("Copy failed.", true);
        }
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-sm btn-ghost";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!window.confirm(`Delete “${s.title}”?`)) return;
        state.snippets = await Storage.deleteSnippet(s.id);
        renderSnippets();
        toast("Deleted.");
      });

      actions.appendChild(useBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(delBtn);
      card.appendChild(top);
      card.appendChild(body);
      card.appendChild(actions);
      els.snippetList.appendChild(card);
    });
  }

  function renderHistory() {
    const q = (els.historySearch.value || "").trim().toLowerCase();
    while (els.historyList.firstChild) {
      els.historyList.removeChild(els.historyList.firstChild);
    }
    const filtered = state.history.filter((h) => {
      if (!q) return true;
      return (
        (h.label || "").toLowerCase().includes(q) ||
        (h.before || "").toLowerCase().includes(q) ||
        (h.after || "").toLowerCase().includes(q)
      );
    });
    els.historyEmpty.hidden = filtered.length > 0;
    filtered.forEach((h) => {
      const card = document.createElement("article");
      card.className = "card-item";

      const top = document.createElement("div");
      top.className = "card-item-top";
      const title = document.createElement("span");
      title.className = "card-title";
      title.textContent = h.label || "Action";
      const when = document.createElement("span");
      when.className = "meta-quiet";
      when.textContent = new Date(h.createdAt).toLocaleString();
      top.appendChild(title);
      top.appendChild(when);

      const body = document.createElement("pre");
      body.className = "card-body";
      body.textContent = h.after || h.before || "";

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const reuse = document.createElement("button");
      reuse.type = "button";
      reuse.className = "btn btn-sm btn-secondary";
      reuse.textContent = "Use again";
      reuse.addEventListener("click", () => {
        setResults(h.after || "", h.label || "", false);
        els.resultsTitle.textContent = h.label || "Results";
        state.lastActionLabel = h.label || "";
        switchTab("home");
        toast("Loaded from history.");
      });
      actions.appendChild(reuse);

      card.appendChild(top);
      card.appendChild(body);
      card.appendChild(actions);
      els.historyList.appendChild(card);
    });
  }

  function renderIconChoices() {
    if (!els.iconChoiceGrid) return;
    while (els.iconChoiceGrid.firstChild) {
      els.iconChoiceGrid.removeChild(els.iconChoiceGrid.firstChild);
    }
    (Storage.FLOAT_ICONS || []).forEach((icon) => {
      const btn = document.createElement("button");
      btn.type = "button";
      setBtnClass(btn, "icon-choice", state.prefs.floatIcon === icon.id);
      const img = document.createElement("img");
      img.src = chrome.runtime.getURL(icon.file);
      img.alt = icon.label;
      const label = document.createElement("span");
      label.textContent = icon.label;
      btn.appendChild(img);
      btn.appendChild(label);
      btn.addEventListener("click", async () => {
        state.prefs.floatIcon = icon.id;
        await Storage.savePrefs(state.prefs);
        applyMascot();
        renderIconChoices();
        toast(`${icon.label} icon`);
      });
      els.iconChoiceGrid.appendChild(btn);
    });
  }

  function renderSettingsControls() {
    if (!els.modeRow || !els.themeGrid) return;
    while (els.modeRow.firstChild) {
      els.modeRow.removeChild(els.modeRow.firstChild);
    }
    [
      { id: "light", label: "Light" },
      { id: "dark", label: "Dark" },
    ].forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      setBtnClass(btn, "mode-btn", state.prefs.mode === m.id);
      btn.textContent = m.label;
      btn.addEventListener("click", async () => {
        state.prefs.mode = m.id;
        await Storage.savePrefs(state.prefs);
        applyTheme();
        renderSettingsControls();
        toast(`${m.label} mode`);
      });
      els.modeRow.appendChild(btn);
    });

    while (els.themeGrid.firstChild) {
      els.themeGrid.removeChild(els.themeGrid.firstChild);
    }
    ACCENTS.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      setBtnClass(btn, "theme-btn", state.prefs.accent === t.id);
      btn.textContent = t.label;
      btn.addEventListener("click", async () => {
        state.prefs.accent = t.id;
        await Storage.savePrefs(state.prefs);
        applyTheme();
        renderSettingsControls();
        toast(`${t.label} accent`);
      });
      els.themeGrid.appendChild(btn);
    });

    renderIconChoices();

    els.prefConfirmClear.checked = Boolean(state.prefs.confirmClear);
    if (els.prefFloat) {
      els.prefFloat.checked = state.prefs.floatEnabled !== false;
    }
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    document.getElementById("btnSettings").addEventListener("click", () => {
      switchTab("settings");
    });
    document
      .getElementById("btnBackHome")
      .addEventListener("click", () => switchTab("home"));

    document.getElementById("btnPaste").addEventListener("click", pasteFromClipboard);
    document.getElementById("btnCopyResult").addEventListener("click", copyResult);
    document.getElementById("btnClear").addEventListener("click", clearAll);
    document.getElementById("btnSaveSnippet").addEventListener("click", openSaveModal);
    document.getElementById("btnCancelSave").addEventListener("click", () => {
      els.saveModal.hidden = true;
    });
    document
      .getElementById("btnConfirmSave")
      .addEventListener("click", confirmSaveSnippet);

    els.inputText.addEventListener("input", updateHint);
    els.snippetSearch.addEventListener("input", renderSnippets);
    els.historySearch.addEventListener("input", renderHistory);

    document
      .getElementById("btnClearHistory")
      .addEventListener("click", async () => {
        if (!window.confirm("Clear history?")) return;
        await Storage.clearHistory();
        state.history = [];
        renderHistory();
        toast("History cleared.");
      });

    document
      .getElementById("btnApplyAccent")
      .addEventListener("click", async () => {
        state.prefs.customAccent = els.accentPicker.value;
        state.prefs.accent = "custom";
        await Storage.savePrefs(state.prefs);
        applyTheme();
        renderSettingsControls();
        toast("Custom accent applied.");
      });

    els.prefConfirmClear.addEventListener("change", async () => {
      state.prefs.confirmClear = els.prefConfirmClear.checked;
      await Storage.savePrefs(state.prefs);
    });

    if (els.prefFloat) {
      els.prefFloat.addEventListener("change", async () => {
        state.prefs.floatEnabled = els.prefFloat.checked;
        await Storage.savePrefs(state.prefs);
        if (els.prefFloat.checked) {
          try {
            chrome.runtime.sendMessage({ type: "ensure-float-active-tab" });
          } catch (_) {
            /* ignore */
          }
          toast("Bubble on — check your webpage.");
        } else {
          toast("Bubble hidden on webpages.");
        }
      });
    }

    const btnOpenWindow = document.getElementById("btnOpenWindow");
    if (btnOpenWindow) {
      btnOpenWindow.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "open-detached-window" }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) {
            toast("Couldn’t open a free window.", true);
            return;
          }
          toast(res.reused ? "Window focused." : "Free window opened.");
        });
      });
    }

    els.saveModal.addEventListener("click", (e) => {
      if (e.target === els.saveModal) els.saveModal.hidden = true;
    });
  }

  async function loadPendingSelection() {
    try {
      const pending = await Storage.consumePendingSelection();
      if (pending && pending.text) {
        els.inputText.value = pending.text;
        updateHint();
        toast("Loaded selected text.");
        try {
          chrome.runtime.sendMessage({ type: "clear-pending-badge" });
        } catch (_) {
          /* ignore */
        }
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function init() {
    bindEvents();
    renderActions();
    setResults("", "", false);

    try {
      const raw = await Storage.getPrefs();
      state.prefs = migratePrefs(raw);
      await Storage.savePrefs(state.prefs);
      state.snippets = await Storage.getSnippets();
      state.history = await Storage.getHistory();
    } catch (_) {
      toast("Couldn’t load saved data.", true);
    }

    applyTheme();
    applyMascot();
    renderSettingsControls();
    updateHint();
    await loadPendingSelection();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
