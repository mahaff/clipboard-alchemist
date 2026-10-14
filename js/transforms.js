/**
 * Everyday local text tools for Clipboard Alchemist.
 */
(function (global) {
  "use strict";

  const EMAIL_RE =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const URL_RE =
    /https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi;
  // Possible phone-like patterns (not verified numbers)
  const PHONE_RE =
    /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b/g;
  const DATE_RE =
    /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/gi;
  // Standalone numbers after phones/dates are masked out
  const NUMBER_RE =
    /(?<![\w.])(?:\$|€|£)?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])(?:\$|€|£)?-?\d+(?:\.\d+)?%?(?![\w.])/g;

  function uniquePreserve(list, normalize) {
    const seen = new Set();
    const out = [];
    list.forEach((item) => {
      const key = normalize ? normalize(item) : item;
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function maskRanges(text, regexes) {
    let masked = String(text || "");
    regexes.forEach((re) => {
      const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
      const copy = new RegExp(re.source, flags);
      masked = masked.replace(copy, (m) => " ".repeat(m.length));
    });
    return masked;
  }

  function cleanText(text) {
    const cleaned = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!cleaned) {
      return {
        ok: false,
        error: "Nothing to clean yet. Paste some text first.",
        result: "",
        empty: true,
      };
    }
    return { ok: true, result: cleaned, error: null, count: 1 };
  }

  function extractEmails(text) {
    const raw = String(text || "");
    if (!raw.trim()) {
      return {
        ok: false,
        error: "Paste some text first.",
        result: "",
        empty: true,
      };
    }
    const matches = raw.match(EMAIL_RE) || [];
    const unique = uniquePreserve(matches, (e) => e.toLowerCase());
    if (!unique.length) {
      return {
        ok: false,
        error: "No email addresses found in this text.",
        result: "",
        empty: true,
      };
    }
    return {
      ok: true,
      result: unique.join("\n"),
      error: null,
      count: unique.length,
      note:
        unique.length === 1
          ? "Found 1 email address."
          : `Found ${unique.length} email addresses.`,
    };
  }

  function extractPhones(text) {
    const raw = String(text || "");
    if (!raw.trim()) {
      return {
        ok: false,
        error: "Paste some text first.",
        result: "",
        empty: true,
      };
    }
    const matches = raw.match(PHONE_RE) || [];
    const cleaned = matches
      .map((p) => p.trim())
      .filter((p) => p.replace(/\D/g, "").length >= 7);
    const unique = uniquePreserve(cleaned, (p) => p.replace(/\D/g, ""));
    if (!unique.length) {
      return {
        ok: false,
        error: "No possible phone numbers found.",
        result: "",
        empty: true,
      };
    }
    return {
      ok: true,
      result: unique.join("\n"),
      error: null,
      count: unique.length,
      note:
        unique.length === 1
          ? "Found 1 possible phone number (not verified)."
          : `Found ${unique.length} possible phone numbers (not verified).`,
    };
  }

  function extractLinks(text) {
    const raw = String(text || "");
    if (!raw.trim()) {
      return {
        ok: false,
        error: "Paste some text first.",
        result: "",
        empty: true,
      };
    }
    const matches = raw.match(URL_RE) || [];
    const cleaned = matches.map((u) => u.replace(/[.,;:!?)]+$/g, ""));
    const unique = uniquePreserve(cleaned, (u) => u.toLowerCase());
    if (!unique.length) {
      return {
        ok: false,
        error: "No links found in this text.",
        result: "",
        empty: true,
      };
    }
    return {
      ok: true,
      result: unique.join("\n"),
      error: null,
      count: unique.length,
      note:
        unique.length === 1
          ? "Found 1 link."
          : `Found ${unique.length} links.`,
    };
  }

  function extractNumbers(text) {
    const raw = String(text || "");
    if (!raw.trim()) {
      return {
        ok: false,
        error: "Paste some text first.",
        result: "",
        empty: true,
      };
    }
    // Prefer not to pull digits that are part of phones or dates
    const masked = maskRanges(raw, [PHONE_RE, DATE_RE, EMAIL_RE, URL_RE]);
    const matches = masked.match(NUMBER_RE) || [];
    const cleaned = matches
      .map((n) => n.trim())
      .filter((n) => {
        const digits = n.replace(/\D/g, "");
        // Skip year-like alone if very short context; keep ordinary amounts
        return digits.length > 0;
      });
    const unique = uniquePreserve(cleaned, (n) => n.replace(/[,\s]/g, ""));
    if (!unique.length) {
      return {
        ok: false,
        error: "No separate numbers found (phone-like and date-like digits are skipped).",
        result: "",
        empty: true,
      };
    }
    return {
      ok: true,
      result: unique.join("\n"),
      error: null,
      count: unique.length,
      note:
        unique.length === 1
          ? "Found 1 number."
          : `Found ${unique.length} numbers.`,
    };
  }

  const ACTIONS = {
    extractEmails: {
      id: "extractEmails",
      label: "Extract Emails",
      icon: "✉️",
      run: extractEmails,
    },
    extractPhones: {
      id: "extractPhones",
      label: "Extract Phone Numbers",
      icon: "📞",
      run: extractPhones,
    },
    extractLinks: {
      id: "extractLinks",
      label: "Extract Links",
      icon: "🔗",
      run: extractLinks,
    },
    extractNumbers: {
      id: "extractNumbers",
      label: "Extract Numbers",
      icon: "🔢",
      run: extractNumbers,
    },
    cleanText: {
      id: "cleanText",
      label: "Clean Text",
      icon: "✨",
      run: cleanText,
    },
  };

  global.AlchemistTransforms = {
    ACTIONS,
    extractEmails,
    extractPhones,
    extractLinks,
    extractNumbers,
    cleanText,
    EMAIL_RE,
    URL_RE,
    PHONE_RE,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
