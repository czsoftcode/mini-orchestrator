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
