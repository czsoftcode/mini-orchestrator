# Fáze 48 — Verze z package.json

**Cíl:** mini --version čte verzi dynamicky z package.json (přes import JSON nebo čtení souboru relativně k buildu) místo natvrdo zapsaného '0.1.0' v cli.ts; ověřitelné testem, že vrácená verze odpovídá poli version v package.json, a zelenou bránou.

## Kroky
- [hotovo] Helper readPackageVersion() ve version.ts
- [hotovo] cli.ts použije helper
- [hotovo] Test helperu
- [hotovo] Zelená brána

## Auto-commit
- Fáze 48: Verze z package.json (`ddb070f7679c3afc9d9b053217c0fe6c69d6a3a7`)
