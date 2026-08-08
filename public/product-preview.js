/**
 * Reload proxied PDP iframe (our /pdp route), not Shopify host.
 */
(function () {
  function bustSrc(iframe) {
    var base = iframe.getAttribute("data-preview-base");
    if (!base) {
      return;
    }
    iframe.src = base + "?bust=" + Date.now();
  }

  function scheduleBust(iframe) {
    if (iframe._previewTimer) {
      clearTimeout(iframe._previewTimer);
    }
    iframe._previewTimer = setTimeout(function () {
      bustSrc(iframe);
    }, 1600);
  }

  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest("[data-preview-refresh]")) {
        return;
      }
      var iframe = document.getElementById("merchant-product-preview-iframe");
      if (iframe) {
        event.preventDefault();
        bustSrc(iframe);
      }
    },
    true,
  );

  document.addEventListener(
    "input",
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest("#merchant-product-edit-form")) {
        return;
      }
      var iframe = document.getElementById("merchant-product-preview-iframe");
      if (iframe) {
        scheduleBust(iframe);
      }
    },
    true,
  );

  document.addEventListener(
    "change",
    function (event) {
      var target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest("#merchant-product-edit-form")) {
        return;
      }
      var iframe = document.getElementById("merchant-product-preview-iframe");
      if (iframe) {
        scheduleBust(iframe);
      }
    },
    true,
  );
})();
