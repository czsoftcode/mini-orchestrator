# Fáze 48 — Verze z package.json

**Cíl:** mini --version čte verzi dynamicky z package.json (přes import JSON nebo čtení souboru relativně k buildu) místo natvrdo zapsaného '0.1.0' v cli.ts; ověřitelné testem, že vrácená verze odpovídá poli version v package.json, a zelenou bránou.

## Kroky
- [hotovo] Helper readPackageVersion() ve version.ts
- [hotovo] cli.ts použije helper
- [hotovo] Test helperu
- [hotovo] Zelená brána

## Auto-commit
- Fáze 48: Verze z package.json (`ddb070f7679c3afc9d9b053217c0fe6c69d6a3a7`)

## Run report
---
phase: 48
verdict: done
steps:
  - title: "Helper readPackageVersion() ve version.ts"
    status: done
  - title: "cli.ts použije helper"
    status: done
  - title: "Test helperu"
    status: done
  - title: "Zelená brána"
    status: done
verify:
  - title: "Globální `mini --version` po přeinstalování"
    detail: "node dist/cli.js --version vrací správně 0.2.16. Nainstalovaný mini v ~/.local/bin běží starý build, proto pořád hlásí 0.1.0 — projeví se až po `npm run install-local`. To jsem nespouštěl, ať nezasahuju do tvého prostředí bez svolení."
---

# Fáze 48 — report z auto session

## Co se udělalo

Příčina nesouladu byla v `src/cli.ts:42`, kde byla verze natvrdo `.version('0.1.0')`.

- **`readPackageVersion()` ve `version.ts`** — čte vlastní `package.json` přes `readFileSync(new URL('../package.json', import.meta.url))`. Cesta se odvozuje od umístění modulu, takže funguje ze `src/` (přes `tsx`/vitest) i z `dist/` (build) — v obou je `package.json` o úroveň výš. Při jakékoli chybě (chybějící soubor, nevalidní JSON, chybějící/prázdné pole) vrací bezpečný fallback `'0.0.0'`, aby `mini --version` nikdy nespadl.
- **`cli.ts`** nahrazuje natvrdo zapsanou hodnotu voláním `.version(readPackageVersion())`.
- **Test** v `version.test.ts` ověří, že `readPackageVersion()` vrací tutéž hodnotu jako pole `version` v reálném `package.json`.

## Ověření

- `npm run build` — OK
- `npm run typecheck` — OK
- `npm test` — 36 souborů, 466 testů zelených
- `node dist/cli.js --version` → `0.2.16` ✅

V projektu není `lint` script (používá se `typecheck`), tak jsem místo lintu spustil `typecheck`.

## Poznámka

Volil jsem čtení souboru za běhu místo JSON `import` schválně: `package.json` je mimo `rootDir: src`, takže přímý `import ... with { type: 'json' }` by tsc odmítl (soubor mimo rootDir) a navíc by tsc JSON nekopíroval do `dist/`. Čtení přes `import.meta.url` je bez těchto problémů.
