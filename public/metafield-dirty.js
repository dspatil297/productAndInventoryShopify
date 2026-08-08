(function () {
  function sync(input) {
    var cell = input.closest("td");
    if (!cell) {
      return;
    }
    var baseline = input.getAttribute("data-baseline") || "";
    var isDirty = input.value !== baseline;
    cell.classList.toggle("mf-dirty", isDirty);
    input.classList.toggle("mf-dirty-input", isDirty);
  }

  function bind(input) {
    sync(input);
    input.addEventListener("input", function () {
      sync(input);
    });
    input.addEventListener("change", function () {
      sync(input);
    });
  }

  function init() {
    document.querySelectorAll("[data-mf-input]").forEach(bind);
  }

  window.mfMarkDirty = sync;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
