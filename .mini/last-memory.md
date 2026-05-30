# Fáze 47 — Zapisovat jen změněné fáze

**Cíl:** save() ve store.ts zapíše soubor fáze jen když se její serializovaný JSON liší od obsahu na disku, a snapshotPrev kopíruje do phases-prev jen reálně změněné soubory místo rm+copy celého adresáře, takže počet diskových operací škáluje s počtem změn, ne s počtem fází; ověřitelné novým testem, že nezměněná fáze se znovu nezapíše, a zelenou bránou.

## Kroky
- [hotovo] Helper writeJsonIfChanged
- [hotovo] save() zapisuje jen změněné fáze
- [hotovo] snapshotPrev() synchronizuje diferenčně
- [hotovo] Test: nezměněná fáze se znovu nezapíše
- [hotovo] Zelená brána

## Auto-commit
- Fáze 47: Zapisovat jen změněné fáze (`40876e1aafd3b55440d245d6818132b7d7bd2e98`)
