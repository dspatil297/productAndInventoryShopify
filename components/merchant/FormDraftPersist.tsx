"use client";

import { useEffect, useRef } from "react";

type DraftValues = Record<string, string>;

function readDraft(key: string): DraftValues | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as DraftValues;
  } catch {
    return null;
  }
}

function writeDraft(key: string, form: HTMLFormElement): void {
  const values: DraftValues = {};
  for (const [name, value] of new FormData(form).entries()) {
    if (typeof value !== "string" || name === "returnTo") {
      continue;
    }
    values[name] = value;
  }
  sessionStorage.setItem(key, JSON.stringify(values));
}

function applyDraft(form: HTMLFormElement, draft: DraftValues): void {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLElement) || !("name" in element)) {
      continue;
    }
    const name = (element as HTMLInputElement).name;
    if (!name || name === "returnTo") {
      continue;
    }

    if (element instanceof HTMLInputElement) {
      if (element.type === "file") {
        continue;
      }
      // React-owned metafield hiddens — restored via mf-draft-restored detail
      if (element.type === "hidden" && name.startsWith("mf[")) {
        continue;
      }
      if (element.type === "checkbox" || element.type === "radio") {
        const raw = draft[name];
        element.checked =
          raw === element.value || raw === "true" || raw === "on";
        continue;
      }
      if (name in draft) {
        element.value = draft[name];
      }
      continue;
    }

    if (
      (element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement) &&
      name in draft
    ) {
      element.value = draft[name];
    }
  }
}

interface FormDraftPersistProps {
  storageKey: string;
  children: React.ReactNode;
}

/** Survives tunnel/HMR full page reloads by restoring text fields from sessionStorage. */
export function FormDraftPersist({ storageKey, children }: FormDraftPersistProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const form = root.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const draft = readDraft(storageKey);
    if (draft) {
      applyDraft(form, draft);
      form.dispatchEvent(
        new CustomEvent("mf-draft-restored", { detail: draft }),
      );
    }

    const persist = () => {
      writeDraft(storageKey, form);
    };

    form.addEventListener("input", persist);
    form.addEventListener("change", persist);
    form.addEventListener("submit", () => {
      sessionStorage.removeItem(storageKey);
    });

    return () => {
      form.removeEventListener("input", persist);
      form.removeEventListener("change", persist);
    };
  }, [storageKey]);

  return <div ref={rootRef}>{children}</div>;
}
