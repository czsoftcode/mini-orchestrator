---
phase: 153
verdict: done
steps:
  - title: "cppMapper.ts core extraction"
    status: done
  - title: "Register C/C++ in buildGraph and map"
    status: done
  - title: "Unit tests cppMapper.test.ts"
    status: done
  - title: "Docs + green run"
    status: done
---

# Phase 153 — report from the auto session

What was done:

- **`src/graph/cppMapper.ts`** — a new scanner/regex mapper following the
  pattern of the C# mapper. It blanks comments, strings (incl. raw
  `R"delim(...)delim"` with `u8`/`u`/`U`/`L` prefixes), char literals (with a
  guard for digit separators like `1'000'000`) and preprocessor lines, then
  extracts:
  - `#include` imports — local includes keep the bare path (`util/strings.h`),
    system includes keep the angle form (`<vector>`) so the two stay
    distinguishable; `symbols` holds the base name without extension;
  - free functions (definitions and prototypes) with parameter/return
    signatures, incl. multi-line declarations, trailing return types and
    default values;
  - `class`/`struct` definitions with their **public** methods (constructors
    included; destructors, `operator` overloads, fields skipped; `public:`/
    `private:`/`protected:` sections tracked, `struct` defaults to public);
  - `enum` / `enum class`, `typedef` (incl. `typedef struct {...} Name` and
    function-pointer typedefs) and `using` aliases;
  - all with 1-based `line`/`endLine` anchors.
  `namespace { }` and `extern "C" { }` braces are transparent, so declarations
  inside them are mapped. Conservative choices: forward declarations,
  out-of-class definitions (`void Foo::bar()`) and unions are skipped; `static`
  free functions are mapped only in headers (`.h`/`.hpp`/`.hh`), where
  `static inline` is API — in `.c`/`.cpp` files `static` means file-local.
- **Registration** — `Lang` gains `'cpp'`, `detectLang` recognizes
  `.c`/`.h`/`.cpp`/`.hpp`/`.cc`/`.hh`, `mapByLang` dispatches to `mapCppFile`,
  `hasMappableProject` gained a `CMakeLists.txt` root marker. The
  no-mappable-files message in `src/commands/map.ts`, the progress line and the
  doc comments were updated (the Czech comments I touched were translated to
  English per CLAUDE.md).
- **Tests** — `src/graph/cppMapper.test.ts`, 20 tests in 3 suites: a C++ header
  fixture (includes local/system, class with public/private methods + static,
  struct, enum class, using alias, namespace transparency, multi-line
  declaration with default value, line anchors, fakes in comments), a C source
  fixture (typedef struct/enum/fn-pointer/simple, prototypes, static skipped,
  macros and string content ignored) and edge cases (static inline in header,
  `extern "C"`, forward decls, raw strings, digit separators, templates).
- **Docs** — `docs/non-interactive/map.md` language list mentions C/C++.
  README does not list languages anywhere, so no change there.

Verification: `npm test` — 76 files / 999 tests green (was 979), `tsc --noEmit`
clean.

Known limits (inherent to the regex approach, same trade-off as the other
mappers): preprocessor conditionals are not evaluated (code under `#if 0` is
still mapped), heavy macro-generated declarations are invisible, and `.h` files
are always treated as the one `cpp` language (no C/C++/Objective-C
distinction).
