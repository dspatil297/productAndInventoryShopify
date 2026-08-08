# Phase 12 — AI Excel mapper

## A. Prerequisites

- [ ] `.env.local` complete · `shopify app dev` running
- [ ] Phase 11 OK
- [ ] `AI_IMPORT_API_KEY` set (or `OPENAI_API_KEY`)
- [ ] Optional: `AI_IMPORT_MODEL` (default `gpt-4o-mini`)

## B. Automated verify

```bash
npm run verify:phase-12
```

- [ ] Exit **0**

## C. Prompt pack + system prompt

- [ ] Metafields → **Sync definitions** (or Import → **Refresh import columns**)
- [ ] AI import tab shows **System prompt** (generated from store metafields)
- [ ] Edit prompt → **Save prompt** persists
- [ ] **Regenerate from store schema** updates prompt after defs change

## D. Excel → preview → import

- [ ] Import → AI tab → upload messy `.xlsx`
- [ ] **Generate preview** → preview table shows rows (title, handle, price, template, metafield count)
- [ ] **Download mapped CSV** works from preview
- [ ] **Import N products** writes to Shopify (only after preview)
- [ ] Partial import failure → **Resume from handle** button appears
- [ ] Update rows show merged metafield notes in preview (merge_kv)
- [ ] Mapped CSV headers match store template (base + metafields)

## E. CSV import still works

- [ ] Direct template CSV upload unchanged (no AI)

## F. Security

- [ ] No access tokens in browser HTML/network
- [ ] AI prompt contains defs/headers only — no shop tokens

## G. Done when

- [ ] Messy spreadsheet → preview → confirmed import for that shop
- [ ] Automated verify pass

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `AI_IMPORT_API_KEY is not set` | Add key to `.env.local`, restart dev server |
| Prompt pack missing | Import → Refresh import columns |
| Title not mapped | Rename source column closer to "Product Name" or edit system prompt |
| Excel parse error | Save as `.xlsx`, first sheet must have header row + data |
| Import disabled | Fix preview rows with warnings (missing title/price) |
