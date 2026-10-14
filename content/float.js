/**
 * Draggable floating helper for regular http(s) pages.
 * Safe to inject more than once (e.g. after extension reload).
 */
(function () {
  "use strict";

  const ROOT_ID = "clipboard-alchemist-float-root";

  // Extension was reloaded → old node is dead; remove and rebuild.
  try {
    const existing = document.getElementById(ROOT_ID);
    if (existing) {
      let currentId = "";
      try {
        currentId = (chrome.runtime && chrome.runtime.id) || "";
      } catch (_) {
        currentId = "";
      }
      if (currentId && existing.dataset && existing.dataset.extId === currentId) {
        return;
      }
      existing.remove();
    }
  } catch (_) {
    const stale = document.getElementById(ROOT_ID);
    if (stale) stale.remove();
  }

  const ICON_FILES = {
    strawberry: "icons/mascots/strawberry.png",
    navy: "icons/mascots/navy.png",
    "sky-blue": "icons/mascots/sky-blue.png",
    watermelon: "icons/mascots/watermelon.png",
    "aqua-fish": "icons/mascots/aqua-fish.png",
  };

  const DEFAULTS = {
    floatEnabled: true,
    floatIcon: "strawberry",
    floatX: null,
    floatY: null,
  };

  let prefs = Object.assign({}, DEFAULTS);
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let open = false;
  let alive = true;

  // Fallback icon if getURL fails (extension reload / invalidated context)
  const FALLBACK_ICON =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
        '<circle cx="28" cy="28" r="28" fill="#8b6bb8"/>' +
        '<circle cx="28" cy="20" r="8" fill="#f7f3fb"/>' +
        '<path d="M12 46c2-10 10-14 16-14s14 4 16 14" fill="#f7f3fb"/>' +
        "</svg>"
    );

  let EXT_ID = "";
  try {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      return;
    }
    EXT_ID = chrome.runtime.id || "";
  } catch (_) {
    return;
  }

  function extUrl(path) {
    try {
      if (!alive || !chrome || !chrome.runtime || !chrome.runtime.id) {
        alive = false;
        return "";
      }
      const url = chrome.runtime.getURL(String(path || ""));
      return typeof url === "string" ? url : "";
    } catch (_) {
      alive = false;
      return "";
    }
  }

  const host = document.createElement("div");
  host.id = ROOT_ID;
  host.dataset.extId = EXT_ID;
  host.setAttribute(
    "style",
    "all:initial;position:fixed!important;z-index:2147483646!important;top:0!important;left:0!important;width:0!important;height:0!important;pointer-events:none!important;"
  );

  const shadow = host.attachShadow({ mode: "closed" });

  // Inline CSS so the bubble still shows if the stylesheet link is blocked
  const style = document.createElement("style");
  style.textContent = `
    .ca-root { position: fixed; inset: 0; width: 0; height: 0; pointer-events: none; }
    .ca-bubble {
      position: fixed; width: 56px; height: 56px; border: 0; padding: 0; margin: 0;
      border-radius: 50%; cursor: grab; pointer-events: auto; background: transparent;
      box-shadow: 0 8px 22px rgba(40,30,60,.28); overflow: visible; z-index: 1;
    }
    .ca-bubble:hover { transform: scale(1.06); }
    .ca-bubble.is-dragging { cursor: grabbing; }
    .ca-bubble img {
      width: 56px; height: 56px; display: block; border-radius: 50%;
      object-fit: cover; pointer-events: none; user-select: none; -webkit-user-drag: none;
    }
    .ca-panel {
      position: fixed; width: 360px; height: 540px;
      max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);
      border-radius: 16px; overflow: hidden; pointer-events: auto;
      background: #efe6f4; box-shadow: 0 16px 40px rgba(40,30,60,.28);
      border: 1px solid rgba(90,60,120,.18); display: none; z-index: 2;
    }
    .ca-panel.is-open { display: block; }
    .ca-panel iframe { width: 100%; height: 100%; border: 0; display: block; background: transparent; }
    .ca-close {
      position: absolute; top: 8px; right: 8px; z-index: 3; width: 28px; height: 28px;
      border: 0; border-radius: 50%; background: rgba(255,255,255,.9); color: #2d2438;
      font-size: 18px; line-height: 1; cursor: pointer; font-family: Georgia, serif;
    }
  `;

  const root = document.createElement("div");
  root.className = "ca-root";

  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "ca-bubble";
  bubble.title = "Clipboard Alchemist — drag to move, click to open";
  bubble.setAttribute("aria-label", "Clipboard Alchemist");

  const img = document.createElement("img");
  img.alt = "Clipboard Alchemist";
  bubble.appendChild(img);

  const panel = document.createElement("div");
  panel.className = "ca-panel";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ca-close";
  closeBtn.title = "Close";
  closeBtn.textContent = "×";

  const frame = document.createElement("iframe");
  frame.title = "Clipboard Alchemist";
  const panelUrl = extUrl("popup.html?embed=1");
  if (panelUrl) frame.src = panelUrl;

  panel.appendChild(closeBtn);
  panel.appendChild(frame);
  root.appendChild(bubble);
  root.appendChild(panel);
  shadow.appendChild(style);
  shadow.appendChild(root);

  function mount() {
    const parent = document.documentElement || document.body;
    if (!parent) return false;
    if (!host.isConnected) parent.appendChild(host);
    return true;
  }

  if (!mount()) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        mount();
        loadPrefs();
      },
      { once: true }
    );
  }

  function iconUrl(id) {
    const path = ICON_FILES[id] || ICON_FILES.strawberry;
    const url = extUrl(path);
    return url || FALLBACK_ICON;
  }

  function clamp(left, top, w, h) {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 540;
    const maxL = Math.max(8, vw - w - 8);
    const maxT = Math.max(8, vh - h - 8);
    let l = Number(left);
    let t = Number(top);
    if (!Number.isFinite(l)) l = maxL;
    if (!Number.isFinite(t)) t = Math.max(8, vh - 120);
    return {
      left: Math.min(Math.max(8, l), maxL),
      top: Math.min(Math.max(8, t), maxT),
    };
  }

  function defaultPos() {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 540;
    return {
      left: Math.max(8, vw - 72),
      top: Math.max(8, vh - 140),
    };
  }

  function applyBubblePos(left, top) {
    const pos = clamp(left, top, 56, 56);
    bubble.style.left = pos.left + "px";
    bubble.style.top = pos.top + "px";
    return pos;
  }

  function placePanelNearBubble() {
    const rect = bubble.getBoundingClientRect();
    const pw = Math.min(360, (window.innerWidth || 360) - 16);
    const ph = Math.min(540, (window.innerHeight || 540) - 16);
    let left = rect.left - pw - 10;
    let top = rect.top;
    if (left < 8) left = rect.right + 10;
    if (top + ph > (window.innerHeight || 540) - 8) {
      top = (window.innerHeight || 540) - ph - 8;
    }
    const pos = clamp(left, top, pw, ph);
    panel.style.left = pos.left + "px";
    panel.style.top = pos.top + "px";
    panel.style.width = pw + "px";
    panel.style.height = ph + "px";
  }

  function setOpen(next) {
    open = Boolean(next);
    panel.classList.toggle("is-open", open);
    if (open) {
      const url = extUrl("popup.html?embed=1");
      if (url && frame.src !== url) frame.src = url;
      if (!url) {
        open = false;
        panel.classList.remove("is-open");
        return;
      }
      placePanelNearBubble();
    }
  }

  function applyPrefs() {
    mount();
    const enabled = prefs.floatEnabled !== false;
    host.style.display = enabled ? "block" : "none";
    img.src = iconUrl(prefs.floatIcon || "strawberry");

    const fallback = defaultPos();
    const hasX = prefs.floatX != null && prefs.floatX !== "";
    const hasY = prefs.floatY != null && prefs.floatY !== "";
    const left = hasX ? Number(prefs.floatX) : fallback.left;
    const top = hasY ? Number(prefs.floatY) : fallback.top;
    applyBubblePos(left, top);
    if (open) placePanelNearBubble();
  }

  function savePos(left, top) {
    const pos = clamp(left, top, 56, 56);
    prefs.floatX = pos.left;
    prefs.floatY = pos.top;
    try {
      chrome.storage.local.get(["prefs"], (data) => {
        if (chrome.runtime.lastError) return;
        const next = Object.assign({}, data.prefs || {}, {
          floatX: pos.left,
          floatY: pos.top,
        });
        chrome.storage.local.set({ prefs: next });
      });
    } catch (_) {
      alive = false;
    }
  }

  function loadPrefs() {
    try {
      chrome.storage.local.get(["prefs"], (data) => {
        if (chrome.runtime.lastError) {
          applyPrefs();
          return;
        }
        prefs = Object.assign({}, DEFAULTS, data.prefs || {});
        applyPrefs();
      });
    } catch (_) {
      applyPrefs();
    }
  }

  bubble.addEventListener("pointerdown", (e) => {
    if (!alive || e.button !== 0) return;
    dragging = true;
    moved = false;
    bubble.classList.add("is-dragging");
    try {
      bubble.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    startX = e.clientX;
    startY = e.clientY;
    const rect = bubble.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    e.preventDefault();
  });

  bubble.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    const pos = applyBubblePos(originLeft + dx, originTop + dy);
    if (open) placePanelNearBubble();
    prefs.floatX = pos.left;
    prefs.floatY = pos.top;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    bubble.classList.remove("is-dragging");
    try {
      bubble.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    const rect = bubble.getBoundingClientRect();
    savePos(rect.left, rect.top);
    if (!moved) setOpen(!open);
  }

  bubble.addEventListener("pointerup", endDrag);
  bubble.addEventListener("pointercancel", endDrag);

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(false);
  });

  window.addEventListener("resize", () => {
    const rect = bubble.getBoundingClientRect();
    applyBubblePos(rect.left, rect.top);
    if (open) placePanelNearBubble();
  });

  // Some sites briefly detach the node — put it back
  const mo = new MutationObserver(() => {
    if (!host.isConnected) mount();
  });
  try {
    mo.observe(document.documentElement, { childList: true });
  } catch (_) {
    /* ignore */
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      mount();
      applyBubblePos(
        prefs.floatX != null ? prefs.floatX : defaultPos().left,
        prefs.floatY != null ? prefs.floatY : defaultPos().top
      );
    }
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.prefs) return;
      prefs = Object.assign({}, DEFAULTS, changes.prefs.newValue || {});
      applyPrefs();
    });
  } catch (_) {
    alive = false;
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message) return;
      if (message.type === "ca-toggle-float-panel") {
        if (prefs.floatEnabled === false) return;
        setOpen(Boolean(message.open));
      }
      if (message.type === "ca-ensure-float") {
        mount();
        applyPrefs();
        sendResponse({ ok: true });
        return true;
      }
    });
  } catch (_) {
    alive = false;
  }

  loadPrefs();
})();
