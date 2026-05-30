---
phase: 49
verdict: done
steps:
  - title: "Git helpery pro tagy"
    status: done
  - title: "bumpVersion vrací novou verzi"
    status: done
  - title: "Tag + push při done --push"
    status: done
  - title: "Testy git helperů"
    status: done
  - title: "Zelená brána"
    status: done
---

# Fáze 49 — report z auto session

## Co se udělalo
- **git.ts**: přidány best-effort helpery `createTag(cwd, tag)` (`git tag <tag>` na HEAD) a `pushTag(cwd, tag)` (`git push origin <tag>`). Stejně jako `push` nikdy nehází — chybu vracejí jako `ok: false` s gitovým stderr.
- **done.ts — `bumpVersion`**: nově vrací výslednou verzi (`to`), nebo `null`, když projekt nemá `package.json`.
- **done.ts — `commitPhaseWork`**: výslednou verzi z bumpu si drží a při `--push` ji po úspěšném pushi předá nové funkci `tagVersion`. Ta založí a pushne tag `v<verze>`; když verze není (`null`), tiše přeskočí. Logy/warningy kopírují styl okolního push kódu (success / warn + detail + hint).
- **git.test.ts**: testy pro `createTag` (vytvoření tagu + ok=false při duplicitě) a `pushTag` (push tagu na lokální bare remote + ok=false bez remote).

## Návrh chování
Tag se vytváří **až po úspěšném pushi commitu** — pořadí je: commit → push → tag → push tagu. Když selže push commitu, tag se vůbec nezakládá (nemá co doprovázet). Když selže založení tagu (např. už existuje), push tagu se přeskočí a jen se zaloguje warning.

## Ověření
- `npm test` — 470 testů zelených (36 souborů), včetně nových testů tagů.
- `npm run typecheck` a `npm run build` (tsc) — bez chyb.
- Projekt nemá `lint` skript; brána = typecheck + test.

Vše ověřeno strojově, nic nezbývá na člověka.
