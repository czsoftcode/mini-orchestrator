# Fáze 46 — Čísla řádků v mapách grafu

**Cíl:** mini map zapíše ke každému exportu číslo řádku (ExportInfo.line, plněno TS/PHP/Rust mappery, vykresleno v renderFileGraph) a sdílený GRAPH_USAGE_HINT v bodě (3) navede agenta číst přímo od daného řádku přes Read s offset; ověřitelné aktualizovanými snapshoty map + zelená brána.

## Kroky
- [hotovo] ExportInfo.line + endLine v typu
- [hotovo] TS mapper plní line/endLine
- [hotovo] PHP + Rust mapper plní rozsah
- [hotovo] renderFileGraph vykreslí rozsah
- [hotovo] graphHint bod (3) na cílené čtení rozsahu
- [hotovo] Snapshoty + přegenerovat graf + brána

## Auto-commit
- Fáze 46: Čísla řádků v mapách grafu (`032612ac047ad45b8ee68112ddd472f0837194eb`)
