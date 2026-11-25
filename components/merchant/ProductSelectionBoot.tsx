"use client";

import { useEffect, useState } from "react";

/**
 * Cross-page product selection via sessionStorage + native DOM.
 */
export function ProductSelectionBoot({
  storageKey,
  rowCount,
  formId,
}: {
  storageKey: string;
  rowCount: number;
  formId: string;
}) {
  const [selectedCount, setSelectedCount] = useState<number>(0);

  useEffect(() => {
    function load(): Record<string, string> {
      try {
        return JSON.parse(sessionStorage.getItem(storageKey) || "{}");
      } catch {
        return {};
      }
    }

    function save(map: Record<string, string>) {
      sessionStorage.setItem(storageKey, JSON.stringify(map));
    }

    function renderCount() {
      const n = Object.keys(load()).length;
      setSelectedCount(n);
      const el = document.getElementById("prod-sel-count");
      if (el) {
        el.textContent = n ? `${n} selected across pages` : "None selected";
      }
    }

    function restorePage() {
      const map = load();
      document.querySelectorAll<HTMLInputElement>("[data-prod-pick]").forEach((el) => {
        const id = el.getAttribute("data-prod-id");
        el.checked = !!(id && map[id]);
      });
      renderCount();
    }

    const prodSel = {
      selectPage() {
        const map = load();
        document.querySelectorAll<HTMLInputElement>("[data-prod-pick]").forEach((el) => {
          el.checked = true;
          const id = el.getAttribute("data-prod-id");
          if (id) map[id] = id;
        });
        save(map);
        renderCount();
      },
      clearAll() {
        save({});
        document.querySelectorAll<HTMLInputElement>("[data-prod-pick]").forEach((el) => {
          el.checked = false;
        });
        save({});
        renderCount();
      },
      injectPicks(form: HTMLFormElement) {
        form.querySelectorAll("[data-prod-injected]").forEach((n) => n.remove());
        const map = load();
        Object.keys(map).forEach((id) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "pick";
          input.value = map[id];
          input.setAttribute("data-prod-injected", "1");
          form.appendChild(input);
        });
        return Object.keys(map).length;
      },
    };

    (window as unknown as { __prodSel: typeof prodSel }).__prodSel = prodSel;

    function handleChange(ev: Event) {
      const t = ev.target as HTMLInputElement | null;
      if (!t || t.getAttribute?.("data-prod-pick") !== "1") return;
      const map = load();
      const id = t.getAttribute("data-prod-id");
      if (!id) return;
      if (t.checked) map[id] = id;
      else delete map[id];
      save(map);
      renderCount();
    }

    function handleSubmit(ev: Event) {
      const form = ev.target as HTMLFormElement | null;
      if (!form || form.id !== formId) return;
      const n = prodSel.injectPicks(form);
      if (!n) {
        ev.preventDefault();
        alert("Select at least one product first (can span pages).");
        return;
      }
      if (
        !confirm(
          `Delete ${n} selected product(s) across all pages? This permanently deletes them from Shopify.`,
        )
      ) {
        ev.preventDefault();
      }
    }

    if (/[?&]deleted=/.test(window.location.search)) {
      save({});
    }

    restorePage();

    document.addEventListener("change", handleChange);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("change", handleChange);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [storageKey, formId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
        disabled={rowCount === 0}
        onClick={() => {
          (window as unknown as { __prodSel?: { selectPage: () => void } }).__prodSel?.selectPage();
        }}
      >
        Select all on page ({rowCount})
      </button>
      <button
        type="button"
        className="rounded-md border border-border px-3 py-1.5 text-sm"
        onClick={() => {
          (window as unknown as { __prodSel?: { clearAll: () => void } }).__prodSel?.clearAll();
        }}
      >
        Clear all selected
      </button>
      <span
        id="prod-sel-count"
        className={`text-sm ${
          selectedCount > 0
            ? "rounded-md bg-amber-500/15 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
        }`}
      >
        {selectedCount > 0 ? `${selectedCount} selected across pages` : "None selected"}
      </span>
    </div>
  );
}
