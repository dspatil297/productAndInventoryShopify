/**
 * Pair list editor for JSON metafields (k/v and FAQ q/a).
 * Document delegation — same tunnel-safe pattern as tag-list.js.
 */
(function () {
  var KV_LINE = /^K:\s*(.+?)\s+V:\s*(.+)$/i;
  var VK_LINE = /^V:\s*(.+?)\s+K:\s*(.+)$/i;
  var Q_LINE = /^Q:\s*(.+)$/i;
  var A_LINE = /^A:\s*(.+)$/i;

  function listFormatOf(root) {
    return root.getAttribute("data-mf-list-format") || "kv";
  }

  function storageOf(root) {
    return root.getAttribute("data-mf-pair-storage") || "json";
  }

  function listItemsToPairs(items, format) {
    var pairs = [];
    if (format === "kv") {
      items.forEach(function (item) {
        var match = String(item).match(KV_LINE);
        if (match) {
          pairs.push({ left: match[1].trim(), right: match[2].trim() });
        }
      });
      return pairs;
    }
    if (format === "vk") {
      items.forEach(function (item) {
        var match = String(item).match(VK_LINE);
        if (match) {
          pairs.push({ left: match[1].trim(), right: match[2].trim() });
        }
      });
      return pairs;
    }
    for (var index = 0; index < items.length; index += 2) {
      var qMatch = String(items[index] || "").match(Q_LINE);
      var aMatch = String(items[index + 1] || "").match(A_LINE);
      if (!qMatch) {
        continue;
      }
      pairs.push({
        left: qMatch[1].trim(),
        right: aMatch ? aMatch[1].trim() : "",
      });
    }
    return pairs;
  }

  function pairsToListItems(pairs, format) {
    var cleaned = pairs.filter(function (pair) {
      return pair.left || pair.right;
    });
    if (format === "kv") {
      return cleaned.map(function (pair) {
        return "K: " + pair.left + " V: " + pair.right;
      });
    }
    if (format === "vk") {
      return cleaned.map(function (pair) {
        return "V: " + pair.left + " K: " + pair.right;
      });
    }
    var lines = [];
    cleaned.forEach(function (pair) {
      lines.push("Q: " + pair.left);
      if (pair.right) {
        lines.push("A: " + pair.right);
      }
    });
    return lines;
  }

  function parseHidden(hidden) {
    const raw = (hidden.value || "").trim();
    const root = hidden.closest("[data-mf-pair-root]");
    const storage = root ? storageOf(root) : "json";
    const listFormat = root ? listFormatOf(root) : "kv";
    if (!raw) {
      return { pairs: [], leftKey: "k", rightKey: "v" };
    }
    try {
      const parsed = JSON.parse(raw);
      if (storage === "list_lines") {
        if (!Array.isArray(parsed)) {
          return { pairs: [], leftKey: "label", rightKey: "value" };
        }
        return {
          pairs: listItemsToPairs(parsed, listFormat),
          leftKey: listFormat === "faq_lines" ? "q" : "label",
          rightKey: listFormat === "faq_lines" ? "a" : "value",
        };
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { pairs: [], leftKey: "k", rightKey: "v" };
      }
      const sample = parsed[0] || {};
      const keys = Object.keys(sample);
      const lower = {};
      keys.forEach(function (key) {
        lower[key.toLowerCase()] = key;
      });
      const mode = hidden.closest("[data-mf-pair-root]")?.getAttribute("data-mf-pair-mode");
      let leftKey;
      let rightKey;
      if (mode === "faq") {
        leftKey = lower.q || lower.question || lower.prompt || "q";
        rightKey = lower.a || lower.answer || lower.response || "a";
      } else {
        leftKey = lower.k || lower.key || lower.label || lower.name || lower.title || "k";
        rightKey = lower.v || lower.value || lower.text || lower.content || lower.data || "v";
      }
      const pairs = parsed.map(function (item) {
        if (!item || typeof item !== "object") {
          return { left: "", right: "" };
        }
        return {
          left: String(item[leftKey] ?? "").trim(),
          right: String(item[rightKey] ?? "").trim(),
        };
      });
      return { pairs: pairs, leftKey: leftKey, rightKey: rightKey };
    } catch (error) {
      return { pairs: [], leftKey: "k", rightKey: "v" };
    }
  }

  function encode(pairs, leftKey, rightKey, root) {
    const cleaned = pairs.filter(function (pair) {
      return pair.left || pair.right;
    });
    if (root && storageOf(root) === "list_lines") {
      return JSON.stringify(pairsToListItems(cleaned, listFormatOf(root)));
    }
    return JSON.stringify(
      cleaned.map(function (pair) {
        const row = {};
        row[leftKey] = pair.left;
        row[rightKey] = pair.right;
        return row;
      }),
    );
  }

  function render(root) {
    const hidden = root.querySelector("[data-mf-pair-hidden]");
    const rowsEl = root.querySelector("[data-mf-pair-rows]");
    const emptyEl = root.querySelector("[data-mf-pair-empty]");
    if (!hidden || !rowsEl) {
      return;
    }
    const state = parseHidden(hidden);
    root._mfPairKeys = { leftKey: state.leftKey, rightKey: state.rightKey };
    rowsEl.innerHTML = "";
    state.pairs.forEach(function (pair, index) {
      const row = document.createElement("div");
      row.className =
        "grid gap-2 rounded-md border border-border/80 bg-background/80 p-2 sm:grid-cols-[1fr_1fr_auto]";
      row.setAttribute("data-mf-pair-row", String(index));

      const left = document.createElement("input");
      left.className =
        "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
      left.value = pair.left;
      left.setAttribute("data-mf-pair-row-left", "");

      const right = document.createElement("input");
      right.className =
        "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
      right.value = pair.right;
      right.setAttribute("data-mf-pair-row-right", "");

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mf-btn px-2 text-xs";
      remove.textContent = "Remove";
      remove.setAttribute("data-mf-pair-remove", "");

      row.appendChild(left);
      row.appendChild(right);
      row.appendChild(remove);
      rowsEl.appendChild(row);
    });
    if (emptyEl) {
      emptyEl.hidden = state.pairs.length > 0;
    }
  }

  function readRows(root) {
    const rows = [];
    root.querySelectorAll("[data-mf-pair-row]").forEach(function (row) {
      const left = row.querySelector("[data-mf-pair-row-left]");
      const right = row.querySelector("[data-mf-pair-row-right]");
      rows.push({
        left: left ? left.value.trim() : "",
        right: right ? right.value.trim() : "",
      });
    });
    return rows;
  }

  function syncHidden(root) {
    const hidden = root.querySelector("[data-mf-pair-hidden]");
    if (!hidden) {
      return;
    }
    const keys = root._mfPairKeys || { leftKey: "k", rightKey: "v" };
    const mode = root.getAttribute("data-mf-pair-mode");
    if (mode === "faq" && keys.leftKey === "k") {
      keys.leftKey = "q";
      keys.rightKey = "a";
    }
    hidden.value = encode(readRows(root), keys.leftKey, keys.rightKey, root);
    if (typeof window.mfMarkDirty === "function") {
      window.mfMarkDirty(hidden);
    }
  }

  function boot(root) {
    if (root.getAttribute("data-mf-pair-ready") === "1") {
      return;
    }
    root.setAttribute("data-mf-pair-ready", "1");
    render(root);
  }

  function bootAll() {
    document.querySelectorAll("[data-mf-pair-root]").forEach(boot);
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const addBtn = target.closest("[data-mf-pair-add]");
    if (addBtn) {
      const root = addBtn.closest("[data-mf-pair-root]");
      if (!root) {
        return;
      }
      const leftInput = root.querySelector("[data-mf-pair-left]");
      const rightInput = root.querySelector("[data-mf-pair-right]");
      const left = leftInput ? leftInput.value.trim() : "";
      const right = rightInput ? rightInput.value.trim() : "";
      if (!left && !right) {
        return;
      }
      const hidden = root.querySelector("[data-mf-pair-hidden]");
      if (!hidden) {
        return;
      }
      const state = parseHidden(hidden);
      state.pairs.push({ left: left, right: right });
      const keys = root._mfPairKeys || {
        leftKey: state.leftKey,
        rightKey: state.rightKey,
      };
      hidden.value = encode(state.pairs, keys.leftKey, keys.rightKey, root);
      if (leftInput) leftInput.value = "";
      if (rightInput) rightInput.value = "";
      render(root);
      syncHidden(root);
      return;
    }
    const removeBtn = target.closest("[data-mf-pair-remove]");
    if (removeBtn) {
      const root = removeBtn.closest("[data-mf-pair-root]");
      const row = removeBtn.closest("[data-mf-pair-row]");
      if (!root || !row) {
        return;
      }
      row.remove();
      syncHidden(root);
      const emptyEl = root.querySelector("[data-mf-pair-empty]");
      const count = root.querySelectorAll("[data-mf-pair-row]").length;
      if (emptyEl) {
        emptyEl.hidden = count > 0;
      }
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (
      target.matches("[data-mf-pair-row-left], [data-mf-pair-row-right]")
    ) {
      const root = target.closest("[data-mf-pair-root]");
      if (root) {
        syncHidden(root);
      }
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.matches("[data-mf-pair-left], [data-mf-pair-right]")) {
      event.preventDefault();
      const root = target.closest("[data-mf-pair-root]");
      const addBtn = root && root.querySelector("[data-mf-pair-add]");
      if (addBtn) {
        addBtn.click();
      }
    }
  });

  window.mfBootPairLists = function () {
    document.querySelectorAll("[data-mf-pair-root]").forEach(function (root) {
      root.removeAttribute("data-mf-pair-ready");
      boot(root);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAll);
  } else {
    bootAll();
  }

  var prevBoot = window.mfBootMetafieldEditors;
  window.mfBootMetafieldEditors = function () {
    if (typeof prevBoot === "function") {
      prevBoot();
    }
    window.mfBootPairLists();
  };
})();
