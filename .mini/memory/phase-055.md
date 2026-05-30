# Fáze 55 — Done --bump none jako default

**Cíl:** Přidat k volbě --bump (u done i auto) hodnotu none, která se stane novou výchozí a verzi v package.json nenavýší; verze se zvedne jen při explicitním --bump patch|minor|major.

## Kroky
- [hotovo] Přidat typ BumpChoice s none
- [hotovo] CLI: none ve volbě a validace push
- [hotovo] Done: default none a přeskočení bumpu
- [hotovo] Aktualizovat prompt v sessionContext
- [hotovo] Testy a zelený build

## Auto-commit
- Fáze 55: Done --bump none jako default (`dde2408b9fdc01f5d4be64495e582ab16688f688`)

## Diskuse
# Fáze 55 — Done --bump none jako default

## Záměr
Přidat k volbě `--bump` (u `done` i `auto`) hodnotu `none`, která se stane novou
výchozí a verzi v `package.json` nenavýší. Verze se zvedne jen na explicitní
`--bump patch|minor|major`.

Motivace: dílčí fáze (oprava chyby nebo funkce rozdělená do víc fází) chce
uživatel uzavírat bez navýšení verze a verzi/tag/push provést až na konci celku
v jedné verzi. CHANGELOG se přitom plní průběžně a zaklapne se až u finální verze.

## Klíčová rozhodnutí
- **Default `none` u `done` i `auto`** (oba stejně, konzistentně). Dnešní default
  `patch` se mění na `none`.
- **`none` + `--push` je zakázaná kombinace** → skončí chybou s jasnou hláškou.
  Protože default je `none`, nově `--push` **vyžaduje explicitní** `--bump
  patch|minor|major` (i `mini done --push` bez `--bump` musí spadnout do chyby).
  Push = vydání = vědomá volba verze, pod kterou se otaguje a pushne.
- **CHANGELOG.md beze změny logiky.** Claude dál průběžně plní `## [Unreleased]`
  bez ohledu na bump (řídí prompt v `sessionContext.ts`). `stampChangelog` se
  spouští jen u `minor|major` (+push), takže se položky kumulují v Unreleased a
  zaklapnou se najednou až u finální verze. Patche se nestampují (jako dnes).
- **Typy:** `BumpLevel` v `version.ts` nechat semver-only (`patch|minor|major`) —
  používá ho `bumpSemver`/`bumpPackageVersion`/`BUMP_LEVELS`/`isBumpLevel`.
  Přidat širší typ pro volbu, např. `BumpChoice = BumpLevel | 'none'`, a ten
  použít v `FinalizeOptions.bump` / `AutoOptions.bump` a v CLI.
- **`none` = `bumpVersion` se vůbec nevolá.** V `commitPhaseWork` (done.ts:273-274):
  `const level = finalizeOpts.bump ?? 'none'`; když `level === 'none'`, nech
  `version = null` (nevolat `bumpVersion`). Tím se přirozeně přeskočí tag
  (`tagVersion` má `if (!version) return`) i stamp (guard `minor|major`).

## Pozor na
- Dotčená místa: `version.ts` (typ), `commands/types.ts` (typy bump), `cli.ts`
  (`parseBumpLevel` přijme `none`; help texty „default none"; action typy;
  validace none+push u `done` i `auto`), `commands/done.ts:273` (default + guard
  none), `prompts/sessionContext.ts:217-221` (text: default nenavyšuje verzi, pro
  povýšení přidej `--bump`, push vyžaduje explicitní bump).
- **Validaci none+push** dej do CLI action vrstvy (hranice uživatelského vstupu) —
  vidí `bump` i `push` najednou; `parseBumpLevel` jednotlivě ostatní volby nevidí.
  Stejnou kontrolu pro `done` i `auto`. Jasná česká hláška + `process.exit(1)`.
- `bumpVersion` (done.ts:401) má signaturu `level: NonNullable<FinalizeOptions['bump']>`
  — po rozšíření typu by mohla dostat `'none'`; buď zúžit na `BumpLevel`, nebo
  nevolat při none (preferováno: nevolat, viz výše).
- **Změna chování commitu:** dnes sám bump vždy změnil `package.json`, takže
  `done` skoro vždy commitnul. U `none` se package.json nemění — když fáze nezměnila
  nic jiného v gitu, commit se přeskočí (`hasChanges` false). U reálných fází
  nehrozí, ale je to změna.
- Testy: `commands/done.test.ts` — nový default (`{}`) nebumpuje a netaguje;
  explicitní `--bump patch|minor|major` bumpuje jako dřív; none+push vrací chybu.
  Zkontrolovat snapshot/asserty v `prompts/sessionContext.test.ts` (zmínka o
  `--bump`/defaultu) a případně `auto.test.ts`.
- `BUMP_LEVELS`/`isBumpLevel` nechat semver-only — nepřidávat do nich `none`.

## Run report
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
