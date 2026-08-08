/**
 * Generic JSON object / object-list editor — any keys (title, quote, …).
 * Document delegation (tunnel-safe).
 */
(function () {
  function fieldsOf(root) {
    try {
      const raw = root.getAttribute("data-mf-json-fields") || "[]";
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String);
      }
    } catch (error) {
      // fall through
    }
    const hidden = root.querySelector("[data-mf-json-hidden]");
    if (!hidden) {
      return [];
    }
    const mode = root.getAttribute("data-mf-json-mode") || "object";
    const data = parseHidden(hidden, mode, []);
    if (mode === "object_list" && Array.isArray(data)) {
      return collectObjectFields(data);
    }
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return Object.keys(data);
    }
    return [];
  }

  function parseHidden(hidden, mode, fields) {
    const raw = (hidden.value || "").trim();
    if (!raw) {
      return mode === "object_list" ? [] : blankItem(fields);
    }
    try {
      const parsed = JSON.parse(raw);
      if (mode === "object_list") {
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed.map(function (item) {
          return normalizeItem(item, fields);
        });
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return normalizeItem(parsed, fields);
      }
      return blankItem(fields);
    } catch (error) {
      return mode === "object_list" ? [] : blankItem(fields);
    }
  }

  function blankItem(fields) {
    const item = {};
    fields.forEach(function (field) {
      item[field] = "";
    });
    return item;
  }

  function normalizeItem(item, fields) {
    const out = blankItem(fields);
    if (!item || typeof item !== "object") {
      return out;
    }
    fields.forEach(function (field) {
      const value = item[field];
      if (value == null) {
        out[field] = "";
        return;
      }
      if (
        typeof value === "string" ||
        Array.isArray(value) ||
        (typeof value === "object" && value !== null)
      ) {
        out[field] = value;
        return;
      }
      out[field] = String(value);
    });
    Object.keys(item).forEach(function (key) {
      if (out[key] === undefined) {
        out[key] = item[key];
      }
    });
    return out;
  }

  function labelFor(field) {
    return field
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, function (ch) {
        return ch.toUpperCase();
      });
  }

  function isMultiline(field) {
    return /quote|bio|description|body|text|content|story|html|paragraph/i.test(
      field,
    );
  }

  function fieldValueType(value) {
    if (value == null) {
      return "string";
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "string_array";
      }
      if (value.every(function (item) {
        return typeof item === "string";
      })) {
        return "string_array";
      }
      if (
        value.every(function (item) {
          return item && typeof item === "object" && !Array.isArray(item);
        })
      ) {
        return "object_array";
      }
      return "json";
    }
    if (typeof value === "object") {
      return "object";
    }
    return "string";
  }

  function collectObjectFields(items) {
    var seen = {};
    var fields = [];
    items.forEach(function (item) {
      Object.keys(item || {}).forEach(function (key) {
        if (!seen[key]) {
          seen[key] = true;
          fields.push(key);
        }
      });
    });
    return fields;
  }

  function renderNestedObjectList(container, items, fields, fieldName) {
    var wrap = document.createElement("div");
    wrap.className = "space-y-2 rounded-md border border-dashed border-border/70 p-2";
    wrap.setAttribute("data-mf-json-nested-list", fieldName);
    (Array.isArray(items) ? items : []).forEach(function (item, index) {
      var card = document.createElement("div");
      card.className = "space-y-2 rounded-md border border-border/60 p-2";
      card.setAttribute("data-mf-json-nested-item", String(index));
      fields.forEach(function (subField) {
        var row = document.createElement("label");
        row.className = "flex flex-col gap-1 text-xs";
        var caption = document.createElement("span");
        caption.className = "text-muted-foreground";
        caption.textContent = labelFor(subField);
        row.appendChild(caption);
        var input = document.createElement(
          isMultiline(subField) ? "textarea" : "input",
        );
        input.className =
          "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
        if (input instanceof HTMLTextAreaElement) {
          input.rows = 2;
        }
        input.value = item && item[subField] != null ? String(item[subField]) : "";
        input.setAttribute("data-mf-json-nested-field", subField);
        row.appendChild(input);
        card.appendChild(row);
      });
      wrap.appendChild(card);
    });
    container.appendChild(wrap);
  }

  function renderNestedObject(container, value, fieldName) {
    var wrap = document.createElement("div");
    wrap.className = "space-y-2 rounded-md border border-dashed border-border/70 p-2";
    wrap.setAttribute("data-mf-json-nested-object", fieldName);
    Object.keys(value || {}).forEach(function (subField) {
      var row = document.createElement("label");
      row.className = "flex flex-col gap-1 text-xs";
      var caption = document.createElement("span");
      caption.className = "text-muted-foreground";
      caption.textContent = labelFor(subField);
      row.appendChild(caption);
      var input = document.createElement(
        isMultiline(subField) ? "textarea" : "input",
      );
      input.className =
        "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
      if (input instanceof HTMLTextAreaElement) {
        input.rows = 2;
      }
      input.value =
        value[subField] == null ? "" : String(value[subField]);
      input.setAttribute("data-mf-json-nested-field", subField);
      row.appendChild(input);
      wrap.appendChild(row);
    });
    container.appendChild(wrap);
  }

  function renderItem(container, item, fields, index, mode) {
    const card = document.createElement("div");
    card.className = "space-y-2 rounded-md border border-border/80 p-2";
    card.setAttribute("data-mf-json-item", String(index));

    const keys = fields.slice();
    Object.keys(item).forEach(function (key) {
      if (keys.indexOf(key) === -1) {
        keys.push(key);
      }
    });

    keys.forEach(function (field) {
      const value = item[field];
      const valueType = fieldValueType(value);
      const wrap = document.createElement("div");
      wrap.className = "flex flex-col gap-1 text-xs";
      const caption = document.createElement("span");
      caption.className = "text-muted-foreground";
      caption.textContent = labelFor(field);
      wrap.appendChild(caption);

      if (valueType === "string_array") {
        var lines = document.createElement("textarea");
        lines.className =
          "min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
        lines.rows = 3;
        lines.value = Array.isArray(value) ? value.join("\n") : "";
        lines.setAttribute("data-mf-json-field", field);
        lines.setAttribute("data-mf-json-field-type", "string_array");
        wrap.appendChild(lines);
        card.appendChild(wrap);
        return;
      }

      if (valueType === "object_array") {
        renderNestedObjectList(
          wrap,
          value,
          collectObjectFields(value),
          field,
        );
        card.appendChild(wrap);
        return;
      }

      if (valueType === "object") {
        renderNestedObject(wrap, value, field);
        card.appendChild(wrap);
        return;
      }

      let input;
      if (isMultiline(field)) {
        input = document.createElement("textarea");
        input.className =
          "min-h-16 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
        input.rows = 3;
      } else {
        input = document.createElement("input");
        input.className =
          "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
        input.type = "text";
      }
      input.value = item[field] || "";
      input.setAttribute("data-mf-json-field", field);
      input.setAttribute("data-mf-json-field-type", "string");
      wrap.appendChild(input);
      card.appendChild(wrap);
    });

    if (mode === "object_list") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mf-btn px-2 text-xs";
      remove.textContent = "Remove";
      remove.setAttribute("data-mf-json-remove", "");
      card.appendChild(remove);
    }

    container.appendChild(card);
  }

  function readItems(root, mode, fields) {
    const nodes = root.querySelectorAll("[data-mf-json-item]");
    if (mode === "object") {
      const first = nodes[0];
      if (!first) {
        return blankItem(fields);
      }
      return readItem(first, fields);
    }
    const items = [];
    nodes.forEach(function (node) {
      items.push(readItem(node, fields));
    });
    return items;
  }

  function readItem(node, fields) {
    const item = blankItem(fields);
    node.querySelectorAll("[data-mf-json-field]").forEach(function (input) {
      const field = input.getAttribute("data-mf-json-field");
      const fieldType = input.getAttribute("data-mf-json-field-type") || "string";
      if (!field) {
        return;
      }
      if (fieldType === "string_array") {
        item[field] = input.value
          .split("\n")
          .map(function (line) {
            return line.trim();
          })
          .filter(function (line) {
            return line.length > 0;
          });
        return;
      }
      if (fieldType === "json") {
        const raw = input.value.trim();
        if (!raw) {
          item[field] = [];
          return;
        }
        try {
          item[field] = JSON.parse(raw);
        } catch (error) {
          item[field] = raw;
        }
        return;
      }
      if (
        /paragraphs|^meta$/i.test(field) &&
        fieldType === "string"
      ) {
        item[field] = input.value
          .split("\n")
          .map(function (line) {
            return line.trim();
          })
          .filter(function (line) {
            return line.length > 0;
          });
        return;
      }
      item[field] = input.value;
    });

    node.querySelectorAll("[data-mf-json-nested-list]").forEach(function (listEl) {
      const fieldName = listEl.getAttribute("data-mf-json-nested-list");
      if (!fieldName) {
        return;
      }
      const rows = [];
      listEl.querySelectorAll("[data-mf-json-nested-item]").forEach(function (row) {
        const record = {};
        row.querySelectorAll("[data-mf-json-nested-field]").forEach(function (input) {
          const subField = input.getAttribute("data-mf-json-nested-field");
          if (subField) {
            record[subField] = input.value;
          }
        });
        rows.push(record);
      });
      item[fieldName] = rows;
    });

    node.querySelectorAll("[data-mf-json-nested-object]").forEach(function (objEl) {
      const fieldName = objEl.getAttribute("data-mf-json-nested-object");
      if (!fieldName) {
        return;
      }
      const record = {};
      objEl.querySelectorAll("[data-mf-json-nested-field]").forEach(function (input) {
        const subField = input.getAttribute("data-mf-json-nested-field");
        if (subField) {
          record[subField] = input.value;
        }
      });
      item[fieldName] = record;
    });

    return item;
  }

  function syncHidden(root) {
    const hidden = root.querySelector("[data-mf-json-hidden]");
    if (!hidden) {
      return;
    }
    const mode = root.getAttribute("data-mf-json-mode") || "object";
    const fields = fieldsOf(root);
    const data = readItems(root, mode, fields);
    hidden.value = JSON.stringify(data);
    if (typeof window.mfMarkDirty === "function") {
      window.mfMarkDirty(hidden);
    }
  }

  function render(root) {
    const hidden = root.querySelector("[data-mf-json-hidden]");
    const itemsEl = root.querySelector("[data-mf-json-items]");
    if (!hidden || !itemsEl) {
      return;
    }
    const mode = root.getAttribute("data-mf-json-mode") || "object";
    const fields = fieldsOf(root);
    const data = parseHidden(hidden, mode, fields);
    itemsEl.innerHTML = "";
    if (mode === "object_list") {
      (Array.isArray(data) ? data : []).forEach(function (item, index) {
        renderItem(itemsEl, item, fields, index, mode);
      });
    } else {
      renderItem(itemsEl, data, fields, 0, mode);
    }
  }

  function boot(root) {
    if (root.getAttribute("data-mf-json-ready") === "1") {
      return;
    }
    root.setAttribute("data-mf-json-ready", "1");
    const itemsEl = root.querySelector("[data-mf-json-items]");
    if (itemsEl && itemsEl.querySelector("[data-mf-json-item]")) {
      syncHidden(root);
      return;
    }
    render(root);
  }

  function bootAll() {
    document.querySelectorAll("[data-mf-json-root]").forEach(boot);
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const addBtn = target.closest("[data-mf-json-add]");
    if (addBtn) {
      const root = addBtn.closest("[data-mf-json-root]");
      if (!root) {
        return;
      }
      const hidden = root.querySelector("[data-mf-json-hidden]");
      const fields = fieldsOf(root);
      if (!hidden) {
        return;
      }
      let items;
      try {
        items = JSON.parse(hidden.value || "[]");
      } catch (error) {
        items = [];
      }
      if (!Array.isArray(items)) {
        items = [];
      }
      items.push(blankItem(fields));
      hidden.value = JSON.stringify(items);
      render(root);
      syncHidden(root);
      return;
    }
    const removeBtn = target.closest("[data-mf-json-remove]");
    if (removeBtn) {
      const root = removeBtn.closest("[data-mf-json-root]");
      const item = removeBtn.closest("[data-mf-json-item]");
      if (!root || !item) {
        return;
      }
      item.remove();
      syncHidden(root);
    }
  });

  document.addEventListener("input", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.matches("[data-mf-json-field], [data-mf-json-nested-field]")) {
      const root = target.closest("[data-mf-json-root]");
      if (root) {
        syncHidden(root);
      }
    }
  });

  window.mfBootJsonObjects = function () {
    document.querySelectorAll("[data-mf-json-root]").forEach(function (root) {
      root.removeAttribute("data-mf-json-ready");
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
    window.mfBootJsonObjects();
  };
})();
