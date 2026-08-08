/**
 * In-storefront Canva-style editor (runs inside proxied PDP).
 * Finds rendered product/metafield text → contenteditable → POST save URL.
 * Values not found on page land in floating "unplaced" panel.
 */
(function () {
  var payloadEl = document.getElementById("mop-pdp-editor-payload");
  if (!payloadEl) {
    return;
  }

  var payload;
  try {
    payload = JSON.parse(payloadEl.textContent || "{}");
  } catch (e) {
    return;
  }

  var dirty = false;
  var statusEl;

  function setStatus(text, isError) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#fca5a5" : "#e2e8f0";
  }

  function markDirty() {
    dirty = true;
    setStatus("Unsaved changes", false);
  }

  function stripHtml(html) {
    var div = document.createElement("div");
    div.innerHTML = html || "";
    return (div.textContent || "").replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function wrapTextNode(textNode, attrs) {
    if (!textNode || textNode.nodeType !== 3) {
      return null;
    }
    var parent = textNode.parentElement;
    if (!parent || parent.closest(".mop-editable, #mop-pdp-bar, #mop-pdp-unplaced, script, style")) {
      return null;
    }
    var span = document.createElement("span");
    span.className = "mop-editable";
    span.contentEditable = "true";
    span.setAttribute("spellcheck", "true");
    Object.keys(attrs).forEach(function (key) {
      span.setAttribute(key, attrs[key]);
    });
    span.textContent = textNode.textContent;
    parent.replaceChild(span, textNode);
    span.addEventListener("input", markDirty);
    return span;
  }

  function findExactTextNodes(needle) {
    var target = normalizeText(needle);
    if (!target || target.length < 1) {
      return [];
    }
    var out = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (
          node.parentElement.closest(
            "script,style,noscript,#mop-pdp-bar,#mop-pdp-unplaced,.mop-editable",
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (normalizeText(node.textContent) === target) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });
    var current;
    while ((current = walker.nextNode())) {
      out.push(current);
    }
    return out;
  }

  function wrapFirstMatch(value, attrs) {
    var nodes = findExactTextNodes(value);
    if (!nodes.length) {
      return false;
    }
    wrapTextNode(nodes[0], attrs);
    return true;
  }

  function wrapTitle() {
    var title = normalizeText(payload.title);
    if (!title) {
      return;
    }
    if (wrapFirstMatch(title, { "data-mop-kind": "title" })) {
      return;
    }
    var h1 = document.querySelector(
      "h1.product__title, h1.product-title, .product__title, [itemprop=name], main h1, h1",
    );
    if (h1 && !h1.closest(".mop-editable")) {
      h1.classList.add("mop-editable");
      h1.contentEditable = "true";
      h1.setAttribute("data-mop-kind", "title");
      h1.addEventListener("input", markDirty);
    }
  }

  function wrapDescription() {
    var plain = stripHtml(payload.descriptionHtml);
    if (plain && wrapFirstMatch(plain, { "data-mop-kind": "description" })) {
      return;
    }
    var el = document.querySelector(
      ".product__description, .product-description, [itemprop=description], .rte",
    );
    if (el && !el.closest(".mop-editable")) {
      el.classList.add("mop-editable");
      el.contentEditable = "true";
      el.setAttribute("data-mop-kind", "description");
      el.addEventListener("input", markDirty);
    }
  }

  var unplaced = [];

  function wrapMetafields() {
    (payload.metafields || []).forEach(function (mf) {
      var value = mf.value;
      if (!value) {
        unplaced.push(mf);
        return;
      }
      // Prefer plain display for list JSON: try raw then joined labels
      var candidates = [value];
      try {
        var parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          candidates.push(parsed.join(", "));
          candidates.push(parsed.join(" "));
        }
      } catch (e) {
        // ignore
      }

      var placed = false;
      for (var i = 0; i < candidates.length; i++) {
        if (
          wrapFirstMatch(candidates[i], {
            "data-mop-kind": "metafield",
            "data-mop-ns": mf.namespace,
            "data-mop-key": mf.key,
            "data-mop-type": mf.type,
            "data-mop-name": mf.name || mf.key,
            title: (mf.name || mf.key) + " (" + mf.namespace + "." + mf.key + ")",
          })
        ) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        unplaced.push(mf);
      }
    });
  }

  function buildBar() {
    var bar = document.createElement("div");
    bar.id = "mop-pdp-bar";
    bar.innerHTML =
      "<strong>PDP edit</strong>" +
      "<span>Click blue/green outlines · edit like Canva</span>" +
      '<button type="button" class="mop-primary" data-mop-save="">Save to Shopify</button>' +
      '<button type="button" class="mop-ghost" data-mop-reload="">Reload</button>' +
      '<a class="mop-ghost" href="' +
      (payload.simpleFormsUrl || "#") +
      '" target="_parent">Simple forms</a>' +
      '<span class="mop-status" data-mop-status="">Ready</span>';
    document.body.appendChild(bar);
    statusEl = bar.querySelector("[data-mop-status]");
    bar.querySelector("[data-mop-save]").addEventListener("click", save);
    bar.querySelector("[data-mop-reload]").addEventListener("click", function () {
      window.location.reload();
    });
  }

  function buildUnplaced() {
    if (!unplaced.length) {
      return;
    }
    var panel = document.createElement("div");
    panel.id = "mop-pdp-unplaced";
    panel.innerHTML =
      "<h3>Not found on theme (still editable)</h3>" +
      "<p style=\"margin:0 0 8px;opacity:.75\">Theme did not render these values as plain text — edit here; save still writes metafields.</p>";
    unplaced.forEach(function (mf) {
      var label = document.createElement("label");
      var column = mf.namespace + "." + mf.key;
      label.innerHTML =
        "<span>" +
        (mf.name || column) +
        " <code>" +
        column +
        "</code> · " +
        mf.type +
        "</span>";
      var input =
        mf.type === "multi_line_text_field" || mf.type === "json" || String(mf.type).indexOf("list.") === 0
          ? document.createElement("textarea")
          : document.createElement("input");
      input.setAttribute("data-mop-kind", "metafield");
      input.setAttribute("data-mop-ns", mf.namespace);
      input.setAttribute("data-mop-key", mf.key);
      input.setAttribute("data-mop-type", mf.type);
      input.value = mf.value || "";
      input.addEventListener("input", markDirty);
      label.appendChild(input);
      panel.appendChild(label);
    });
    document.body.appendChild(panel);
  }

  function readField(kind) {
    var el = document.querySelector('.mop-editable[data-mop-kind="' + kind + '"]');
    if (!el) {
      return null;
    }
    if (kind === "description") {
      return el.innerHTML;
    }
    return normalizeText(el.textContent);
  }

  function collectMetafields() {
    var map = {};
    document
      .querySelectorAll("[data-mop-kind=metafield][data-mop-ns][data-mop-key]")
      .forEach(function (el) {
        var ns = el.getAttribute("data-mop-ns");
        var key = el.getAttribute("data-mop-key");
        var type = el.getAttribute("data-mop-type") || "single_line_text_field";
        var id = ns + "." + key;
        var value =
          el.tagName === "INPUT" || el.tagName === "TEXTAREA"
            ? el.value
            : normalizeText(el.textContent);
        map[id] = { namespace: ns, key: key, type: type, value: value };
      });
    return Object.keys(map).map(function (id) {
      return map[id];
    });
  }

  function save() {
    setStatus("Saving…", false);
    var body = {
      title: readField("title"),
      descriptionHtml: readField("description"),
      metafields: collectMetafields(),
    };
    fetch(payload.saveUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          setStatus(result.data.error || "Save failed", true);
          return;
        }
        dirty = false;
        setStatus("Saved", false);
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: "mop-pdp-saved", productId: payload.numericId },
            "*",
          );
        }
      })
      .catch(function () {
        setStatus("Save failed (network)", true);
      });
  }

  wrapTitle();
  wrapDescription();
  wrapMetafields();
  buildBar();
  buildUnplaced();
  setStatus(
    (payload.metafields || []).length
      ? "Edit outlined fields · unplaced list if theme hid a value"
      : "Edit title/description · no metafields on product",
    false,
  );

  window.addEventListener("beforeunload", function (event) {
    if (!dirty) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });
})();
