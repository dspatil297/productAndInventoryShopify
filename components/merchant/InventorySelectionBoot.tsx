"use client";

import { useEffect, useState } from "react";

/**
 * Cross-page inventory selection via sessionStorage + native DOM.
 * Works without React hydration (tunnel/HMR often breaks client JS).
 */
export function InventorySelectionBoot({
  storageKey,
  rowCount,
}: {
  storageKey: string;
  rowCount: number;
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
      const el = document.getElementById("inv-sel-count");
      if (el) {
        el.textContent = n ? `${n} selected across pages` : "None selected";
      }
    }

    function restorePage() {
      const map = load();
      document.querySelectorAll<HTMLInputElement>("[data-inv-pick]").forEach((el) => {
        const id = el.getAttribute("data-inv-id");
        el.checked = !!(id && map[id]);
      });
      renderCount();
    }

    const invSel = {
      selectPage() {
        const map = load();
        document.querySelectorAll<HTMLInputElement>("[data-inv-pick]").forEach((el) => {
          el.checked = true;
          const id = el.getAttribute("data-inv-id");
          if (id) map[id] = el.getAttribute("data-inv-value") || "";
        });
        save(map);
        renderCount();
      },
      clearAll() {
        save({});
        document.querySelectorAll<HTMLInputElement>("[data-inv-pick]").forEach((el) => {
          el.checked = false;
        });
        save({});
        renderCount();
      },
      injectPicks(form: HTMLFormElement) {
        form.querySelectorAll("[data-inv-injected]").forEach((n) => n.remove());
        const map = load();
        Object.keys(map).forEach((id) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "pick";
          input.value = map[id];
          input.setAttribute("data-inv-injected", "1");
          form.appendChild(input);
        });
        return Object.keys(map).length;
      },
    };

    (window as unknown as { __invSel: typeof invSel }).__invSel = invSel;

    function handleChange(ev: Event) {
      const t = ev.target as HTMLInputElement | null;
      if (!t || t.getAttribute?.("data-inv-pick") !== "1") return;
      const map = load();
      const id = t.getAttribute("data-inv-id");
      if (!id) return;
      if (t.checked) map[id] = t.getAttribute("data-inv-value") || "";
      else delete map[id];
      save(map);
      renderCount();
    }

    function handleSubmit(ev: Event) {
      const form = ev.target as HTMLFormElement | null;
      if (!form || form.id !== "inventory-bulk-form") return;
      const n = invSel.injectPicks(form);
      if (!n) {
        ev.preventDefault();
        alert("Select at least one row first (can span pages).");
      }
    }

    if (/[?&]saved=/.test(window.location.search)) {
      save({});
    }

    restorePage();

    document.addEventListener("change", handleChange);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("change", handleChange);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [storageKey]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="mf-btn disabled:opacity-50"
        disabled={rowCount === 0}
        onClick={() => {
          (window as unknown as { __invSel?: { selectPage: () => void } }).__invSel?.selectPage();
        }}
      >
        Select all on page ({rowCount})
      </button>
      <button
        type="button"
        className="mf-btn"
        onClick={() => {
          (window as unknown as { __invSel?: { clearAll: () => void } }).__invSel?.clearAll();
        }}
      >
        Clear all selected
      </button>
      <span
        id="inv-sel-count"
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
