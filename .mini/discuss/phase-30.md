# Fáze 30 — Done: verze, push a clear

## Záměr
Po finalizaci fáze (`phase.status = done`) má `mini done` navíc:
1. navýšit verzi v `package.json` (default **patch**),
2. tu změnu zahrnout do auto-commitu fáze,
3. volitelně pushnout na remote,
4. na závěr vypsat nabídku spustit `/clear` (vyčištění kontextu session).

Cílem je, aby cyklus přes slash commandy končil "uklizeně" — verze povýšená,
práce na remote, kontext připravený k vyčištění před další fází.

## Klíčová rozhodnutí
- **Verze: automatický patch + flag pro větší skok.** Každá hotová fáze navýší
  patch (`x.y.Z+1`) v `package.json`. Nový flag `--bump <patch|minor|major>`
  (default `patch`) umožní minor/major. Bump se děje **před commitem**, aby ho
  `git add -A` pobral do commitu fáze.
- **Push: opt-in přes `--push`.** Default zůstává jako dosud (jen hint
  `git push`) — dosavadní vědomé rozhodnutí z fáze 11 se neruší, jen se přidá
  možnost. Push je **best-effort**: chybějící remote/upstream nebo selhání = jen
  warning + hint, workflow nespadne (stejně jako commit nikdy nehází).
- **Rozsah: sdílené ve finalizaci.** Chování (bump + případný push) zapojit tam,
  kde fáze končí jako `done` — tj. `applyDone`, interaktivní `done` i `auto`, aby
  se chovaly stejně. Flag `--push` (a `--bump`) protáhnout z CLI do finalizace
  ve všech těchto cestách.
- **`/clear` se jen nabízí.** `/clear` je vestavěný příkaz Claude Code, který
  musí napsat uživatel — `mini` z Bashe ho spustit nemůže. Takže `mini done`
  jen **vypíše nabídku/hint**, ať uživatel zváží `/clear`. Navíc `mini context
  done` (session prompt) zmíní, ať Claude `/clear` po uzavření fáze navrhne.
- **Pořadí side-effectů:** bump verze → commit (`add -A`) → push (jen s `--push`)
  → memory + graf (ty zůstávají mimo commit, jako dosud).
- **Bez package.json: tiše přeskočit bump.** Per-projekt/jazyk konfigurace
  (např. dotaz při `init`, jiný způsob verzování pro PHP/Rust) je **na jinou fázi**.

## Pozor na
- **`mini undo` po pushi.** `undo` dělá soft reset na `phase.autoCommit.preSha`.
  Když se commit už pushnul, lokální reset diverguje od remote (nutný force-push).
  Bump verze je součástí commitu fáze, takže `undo` ho korektně vrátí do stagingu;
  problém je jen s remote. Pro teď: push je opt-in, takže riziko bere uživatel
  vědomě — zmínit v hintu/dokumentaci, neřešit force-push automaticky.
- **Bump musí předcházet commitu**, jinak skončí mimo commit fáze (jako memory/graf)
  a rozbije se vazba undo ↔ verze. Capture `preSha` je HEAD před commitem fáze
  (předchozí fáze) — editace working tree (bump) ho nemění, takže pořadí
  bump → preSha → commit je v pořádku.
- **Parsování/zápis `package.json`** dělat opatrně: zachovat formátování (odsazení,
  koncový newline), ať diff obsahuje jen řádek `version`. Nepoužívat `npm version`
  (vytváří vlastní commit/tag) — verzi zapsat sami a nechat ji pobrat commitem fáze.
- **Idempotence/skipped fáze:** u `skipped` se finalizace side-effectů nevolá, takže
  bump ani push se tam nedějí — zachovat.
- **Slash command `/mini:done`** dnes volá `mini done --apply [--accept-verify]`.
  Pokud má jít push z session, je třeba, aby se `--push` dal předat — buď to zmínit
  v session promptu (Claude doplní `--push` na přání uživatele), nebo nechat push
  čistě na ručním `git push`. Zvážit v plánu, ať je flow jasné.
