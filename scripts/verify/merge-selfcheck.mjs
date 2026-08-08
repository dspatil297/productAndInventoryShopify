export async function runMergeKvSelfCheck() {
  const parseKv = (text) => {
    const out = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("K: ") || !trimmed.includes(" V: ")) {
        continue;
      }
      const afterKey = trimmed.slice(3);
      const splitIndex = afterKey.indexOf(" V: ");
      if (splitIndex < 0) {
        continue;
      }
      const key = afterKey.slice(0, splitIndex).trim();
      const value = afterKey.slice(splitIndex + 4).trim();
      if (key && value) {
        out[key] = value;
      }
    }
    return out;
  };

  const mergeKv = (oldValue, newValue) => {
    if (!newValue.trim()) {
      return oldValue;
    }
    const merged = { ...parseKv(oldValue), ...parseKv(newValue) };
    return Object.entries(merged)
      .map(([key, value]) => `K: ${key} V: ${value}`)
      .join("\n");
  };

  const merged = mergeKv(
    "K: Fabric V: Silk\nK: Region V: Varanasi",
    "K: Fabric V: Cotton\nK: Finish V: Matte",
  );
  if (!merged.includes("K: Fabric V: Cotton")) {
    throw new Error("merge_kv failed to overwrite");
  }
  if (!merged.includes("K: Region V: Varanasi")) {
    throw new Error("merge_kv failed to keep old key");
  }
  if (!merged.includes("K: Finish V: Matte")) {
    throw new Error("merge_kv failed to add new key");
  }
}
