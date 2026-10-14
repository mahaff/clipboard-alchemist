/**
 * Friendly, non-technical text hints for Clipboard Alchemist.
 */
(function (global) {
  "use strict";

  const EMAIL_RE =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const URL_RE =
    /https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi;
  const PHONE_RE =
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;

  function count(re, text) {
    const m = text.match(re);
    return m ? m.length : 0;
  }

  function detect(raw) {
    const text = String(raw || "").trim();
    if (!text) {
      return {
        type: "empty",
        label: "Ready",
        explanation: "Paste or type some text, then choose an action below.",
      };
    }

    const emails = count(EMAIL_RE, text);
    const links = count(URL_RE, text);
    const phones = count(PHONE_RE, text);
    const bits = [];
    if (emails) bits.push(emails === 1 ? "email" : "emails");
    if (links) bits.push(links === 1 ? "link" : "links");
    if (phones) bits.push(phones === 1 ? "possible phone" : "possible phones");

    if (bits.length) {
      return {
        type: "mixed",
        label: "Looks useful",
        explanation: `This text may include ${bits.join(", ")}. Try an extract button.`,
      };
    }

    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      type: "text",
      label: "Text",
      explanation:
        words === 1
          ? "One word ready to clean or search."
          : `${words} words ready to clean or search.`,
    };
  }

  global.AlchemistDetect = { detect };
})(typeof globalThis !== "undefined" ? globalThis : window);
