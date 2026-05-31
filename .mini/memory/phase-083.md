# Phase 83 — MIT license + visibility

**Goal:** mini-orchestrator ships under the MIT license: a root LICENSE file (auto-detected and shown by GitHub), the "license": "MIT" field in package.json (shown on npmjs.com), and a matching note in the README replacing the current placeholder.

## Steps
- [done] Add root LICENSE file (MIT)
- [done] Set "license": "MIT" in package.json
- [done] Update README license section
- [done] Verify license visibility, build and tests

## Auto-commit
- Phase 83: MIT license + visibility

## Run report
---
phase: 83
verdict: done
steps:
  - title: "Add root LICENSE file (MIT)"
    status: done
  - title: "Set \"license\": \"MIT\" in package.json"
    status: done
  - title: "Update README license section"
    status: done
  - title: "Verify license visibility, build and tests"
    status: done
---

# Phase 83 — report from the auto session

Celá fáze hotová. mini-orchestrator je teď publikovaný pod MIT licencí, viditelně
na obou platformách:

- **`LICENSE`** (kořen repa) — standardní MIT text, copyright `2026 Stanislav Kremeň`.
  GitHub kořenový `LICENSE` sám detekuje a zobrazí „MIT" v postranním panelu repa.
- **`package.json`** — přidáno pole `"license": "MIT"` (za `description`).
  npmjs.com bere licenci právě z tohohle pole. Ověřeno `npm pkg get license` → `"MIT"`.
- **README** — sekce `## License / attribution` (placeholder „Your own.") nahrazena
  sekcí `## License` s odkazem na `./LICENSE`, copyrightem a stručným shrnutím MIT.

**Ověření (mechanicky):**
- `npm pack --dry-run` — tarball obsahuje `LICENSE` (1.1kB) i přesto, že `files`
  whitelist v package.json listuje jen `dist` + `README.md`; npm `LICENSE` zahrnuje
  vždy automaticky. Takže licence dorazí i do npm balíčku, ne jen do gitu.
- `npm run build` — zelené.
- `npm test` — 652 testů zelených (50 souborů); žádný test se licence netýká, beze změny.

**Pozn. k vydání:** aby se MIT pole reálně objevilo na npmjs.com, musí proběhnout
`npm publish` nové verze (mimo mini workflow, vyžaduje 2FA OTP — viz paměť
`npm publish`). GitHub badge se objeví hned po pushnutí `LICENSE` na remote, což
zařídí commit této fáze. Bump verze necháno na uživateli přes `mini done` flagy.
