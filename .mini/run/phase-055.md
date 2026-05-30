---
phase: 55
verdict: done
steps:
  - title: "Přidat typ BumpChoice s none"
    status: done
  - title: "CLI: none ve volbě a validace push"
    status: done
  - title: "Done: default none a přeskočení bumpu"
    status: done
  - title: "Aktualizovat prompt v sessionContext"
    status: done
  - title: "Testy a zelený build"
    status: done
---

# Fáze 55 — report

Hotovo, cíl splněn: `--bump` má novou hodnotu `none`, která je výchozí a verzi
nenavyšuje. Verze se zvedne jen na explicitní `--bump patch|minor|major`.

## Co se udělalo
- **`version.ts`** — přidán typ `BumpChoice = BumpLevel | 'none'`. `BumpLevel`,
  `BUMP_LEVELS` i `isBumpLevel` zůstaly semver-only (jak bylo dohodnuto).
- **`commands/types.ts`** — `bump` u `FinalizeOptions` i `AutoOptions` je nově
  `BumpChoice`; komentáře aktualizované na default `none`.
- **`cli.ts`** — `parseBumpLevel` přijímá i `none`; help texty obou `--bump`
  (`done` i `auto`) mění default na `none` a uvádějí, že `--push` vyžaduje
  explicitní úroveň. Přidána funkce `ensurePushHasBump`, kterou volají action
  handlery `done` i `auto`: při `--push` bez explicitního `--bump`
  (tj. undefined nebo `none`) vypíše českou hlášku a `process.exit(1)`.
- **`commands/done.ts`** — `commitPhaseWork`: `const level = finalizeOpts.bump ?? 'none'`
  a `version = level === 'none' ? null : await bumpVersion(...)`. Při `none` se
  `bumpVersion` vůbec nevolá, `version` zůstane `null`, takže se přirozeně
  přeskočí tag (`tagVersion` má `if (!version) return`) i changelog stamp
  (guard `minor|major`). `bumpVersion` zúžena na `BumpLevel`.
- **`prompts/sessionContext.ts`** — text done promptu: default verzi nenavyšuje
  (`none`, vhodné pro dílčí fáze), pro povýšení přidej `--bump patch|minor|major`,
  `--push` vyžaduje explicitní `--bump`.
- **`commands/done.test.ts`** — upraveny/doplněny testy: výchozí volání (`{}`)
  verzi nenavyšuje (bump se nevolá) a přesto fázi uzavře; `--bump patch` bumpuje;
  `--push` + `--bump patch` vytvoří tag `v1.0.1`; `--push` bez bumpu tag nevytváří;
  best-effort test bumpu přepnut na explicitní `--bump patch`.

## Ověření (strojově)
- `npx tsc --noEmit` → bez chyb.
- `npm run build` → ok.
- `src/commands/done.test.ts` → 57 testů zelených (nové i upravené případy).
- Ruční smoke přes `tsx src/cli.ts`: `done --push`, `auto --push` i
  `done --bump none --push` korektně končí chybou „Při --push musíš zvolit úroveň
  verze: --bump patch | minor | major." a exit kódem 1.
- **Snapshot:** rozšíření textu `done` promptu zvětšilo jeho šablonu
  (≈ 465 → 539 tok), což měnilo fixní snapshot token-reportu v
  `src/tokens/measure.test.ts`. Snapshot jsem regeneroval přes `vitest -u`
  (jen měřená velikost promptu, ne logika). Pozn. pro uživatele: `done` prompt
  o tu část narostl — pokud chceš šetřit tokeny, dá se znění validace zkrátit.

## Pozn. k chování / na co dát pozor při review
- Validace none+push žije **v CLI vrstvě** (`ensurePushHasBump`). Programové volání
  `applyDone(cwd, { push: true })` (bez bumpu) guardem neprochází — jen tiše
  pushne commit bez tagu/stampu (verze `null`). To je záměr (hranice je CLI);
  pokryto testem „s --push bez bumpu (none) tag nevytváří".
- Změna chování: dřív bump vždy změnil package.json, takže `done` skoro vždy
  commitnul. U `none` se package.json nemění — když fáze nezmění nic jiného,
  commit se přeskočí (`hasChanges`).
- CHANGELOG logika beze změny: Unreleased se plní průběžně, stampuje se až u
  `minor|major` + `--push`.
