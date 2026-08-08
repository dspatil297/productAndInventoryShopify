/**
 * Sync contenteditable / data-visual-* controls → hidden inputs before submit.
 * Tunnel-safe (no React handlers).
 */
(function () {
  function findHidden(root, name) {
    return root.querySelector('input[type="hidden"][name="' + name + '"]');
  }

  function syncOne(el) {
    var form = el.closest("form");
    if (!form) {
      return;
    }
    var name = el.getAttribute("data-visual-name");
    if (!name) {
      return;
    }
    var hidden = findHidden(form, name);
    if (!hidden) {
      return;
    }
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
      hidden.value = el.value;
      return;
    }
    if (el.getAttribute("data-visual-html") === "1") {
      hidden.value = el.innerHTML.trim();
      return;
    }
    hidden.value = (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function syncAll(form) {
    form.querySelectorAll("[data-visual-name]").forEach(syncOne);
  }

  document.addEventListener(
    "input",
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.hasAttribute("data-visual-name")) {
        return;
      }
      syncOne(target);
    },
    true,
  );

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }
      if (!form.hasAttribute("data-visual-product-form")) {
        return;
      }
      syncAll(form);
    },
    true,
  );

  function boot() {
    document.querySelectorAll("form[data-visual-product-form]").forEach(syncAll);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
