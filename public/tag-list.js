/**
 * Vanilla tag list widgets — works even if React hydration fails on tunnel/HMR.
 * Roots: [data-mf-tag-root]
 */
(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseItems(raw) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) {
      return [];
    }
    try {
      var parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(function (item) {
            return typeof item === "string" ? item.trim() : String(item).trim();
          })
          .filter(Boolean);
      }
    } catch (e) {
      // fall through
    }
    return trimmed
      .split(/[\n,]+/)
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function encodeItems(items) {
    if (!items.length) {
      return "";
    }
    return JSON.stringify(items);
  }

  function paint(root) {
    var hidden = root.querySelector("[data-mf-tag-hidden]");
    var chips = root.querySelector("[data-mf-tag-chips]");
    var empty = root.querySelector("[data-mf-tag-empty]");
    if (!hidden || !chips) {
      return;
    }
    var items = parseItems(hidden.value);
    chips.innerHTML = items
      .map(function (item, index) {
        return (
          '<span class="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs">' +
          escapeHtml(item) +
          '<button type="button" class="text-muted-foreground hover:text-destructive" data-mf-tag-remove="' +
          index +
          '" aria-label="Remove">×</button></span>'
        );
      })
      .join("");
    if (empty) {
      empty.hidden = items.length > 0;
    }
  }

  function addFromDraft(root) {
    var hidden = root.querySelector("[data-mf-tag-hidden]");
    var draft = root.querySelector("[data-mf-tag-draft]");
    if (!hidden || !draft) {
      return;
    }
    var raw = String(draft.value || "").trim();
    if (!raw) {
      return;
    }
    var pieces = raw
      .split(",")
      .map(function (piece) {
        return piece.trim();
      })
      .filter(Boolean);
    if (!pieces.length) {
      return;
    }
    var items = parseItems(hidden.value).concat(pieces);
    hidden.value = encodeItems(items);
    draft.value = "";
    paint(root);
    if (hidden.getAttribute("data-mf-input") === "1" && window.mfMarkDirty) {
      window.mfMarkDirty(hidden);
    }
  }

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      var addBtn = target.closest("[data-mf-tag-add]");
      if (addBtn) {
        event.preventDefault();
        event.stopPropagation();
        var addRoot = addBtn.closest("[data-mf-tag-root]");
        if (addRoot) {
          addFromDraft(addRoot);
        }
        return;
      }

      var removeBtn = target.closest("[data-mf-tag-remove]");
      if (removeBtn) {
        event.preventDefault();
        event.stopPropagation();
        var removeRoot = removeBtn.closest("[data-mf-tag-root]");
        var hidden = removeRoot && removeRoot.querySelector("[data-mf-tag-hidden]");
        if (!removeRoot || !hidden) {
          return;
        }
        var index = Number.parseInt(removeBtn.getAttribute("data-mf-tag-remove") || "", 10);
        if (!Number.isFinite(index)) {
          return;
        }
        var next = parseItems(hidden.value).filter(function (_item, i) {
          return i !== index;
        });
        hidden.value = encodeItems(next);
        paint(removeRoot);
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (event.key !== "Enter" && event.key !== ",") {
        return;
      }
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.matches("[data-mf-tag-draft]")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      var root = target.closest("[data-mf-tag-root]");
      if (root) {
        addFromDraft(root);
      }
    },
    true,
  );

  function boot() {
    document.querySelectorAll("[data-mf-tag-root]").forEach(paint);
  }

  window.mfBootTagLists = function () {
    document.querySelectorAll("[data-mf-tag-root]").forEach(paint);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  var prevBoot = window.mfBootMetafieldEditors;
  window.mfBootMetafieldEditors = function () {
    if (typeof prevBoot === "function") {
      prevBoot();
    }
    window.mfBootTagLists();
  };
})();
