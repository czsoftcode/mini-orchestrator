/**
 * Regex/scanner-based C# mapper. Pracuje nad očištěnou variantou zdroje, kde
 * jsou komentáře (`//`, `///` XML doc, `/* *​/`), stringy (`"..."`, verbatim
 * `@"..."`, interpolované `$"..."`/`$@"..."`/`@$"..."`, raw `"""..."""` C# 11+) i
 * char literály (`'x'`, `'\n'`) nahrazené mezerami stejné délky (`\n` se
 * zachovává, aby čísla řádků seděla). `using` cesty jsou identifikátory (žádné
 * stringy), takže stačí jedna varianta.
 *
 * Mapuje top-level typy (`class` / `struct` / `interface` / `enum` / `record`)
 * na úrovni souboru i uvnitř `namespace` (block i file-scoped — namespace braces
 * jsou pro sken průhledné). Top-level typ je export, pokud není `file`-scoped ani
 * `private` (default top-level je `internal` = bereme jako export). `public`/
 * `internal` členy (metody) se připojí jako `methods`. Záměrně konzervativní: do
 * těl metod a vnořených typů se nezanořuje.
 */
export function mapCSharpFile(content, relPath) {
    const stripped = stripCSharp(content);
    const imports = extractCSharpUsings(stripped);
    const exports = extractCSharpExports(stripped);
    return {
        path: relPath.replace(/\\/g, '/'),
        exports,
        imports,
    };
}
// ---------------------------------------------------------------------------
// Stripping
// ---------------------------------------------------------------------------
/**
 * Smaže komentáře (`//`, `///`, `/* *​/` — C# je **nevnořuje**), stringy včetně
 * verbatim (`@"..."`, kde `""` je escapovaná uvozovka), interpolovaných (`$"..."`
 * a kombinací `$@`/`@$`) i raw string literálů (`"""..."""`, C# 11) a char
 * literály. Nahrazuje mezerami stejné délky se zachováním `\n`, takže pozice
 * i čísla řádků zůstávají. String/char literály se vždy korektně přeskočí, aby
 * `//` uvnitř stringu nebylo bráno jako komentář.
 */
function stripCSharp(content) {
    const out = [];
    let i = 0;
    const n = content.length;
    while (i < n) {
        const c = content[i];
        if (c === undefined)
            break;
        const c2 = content[i + 1];
        // block /* ... */ — v C# se nevnořuje
        if (c === '/' && c2 === '*') {
            const end = content.indexOf('*/', i + 2);
            const stop = end === -1 ? n : end + 2;
            for (let j = i; j < stop; j++)
                out.push(content[j] === '\n' ? '\n' : ' ');
            i = stop;
            continue;
        }
        // line // ... (vč. /// XML doc)
        if (c === '/' && c2 === '/') {
            while (i < n && content[i] !== '\n') {
                out.push(' ');
                i++;
            }
            continue;
        }
        // string s volitelným prefixem @ (verbatim) a/nebo $ (interpolovaný)
        if (c === '"' || c === '@' || c === '$') {
            let q = i;
            let verbatim = false;
            while (content[q] === '@' || content[q] === '$') {
                if (content[q] === '@')
                    verbatim = true;
                q++;
            }
            if (content[q] === '"') {
                const prefixLen = q - i;
                for (let k = 0; k < prefixLen; k++)
                    out.push(' ');
                // raw string """ ... """ (C# 11) — bez escapů
                if (content[q + 1] === '"' && content[q + 2] === '"') {
                    i = blankRawString(content, q, out);
                    continue;
                }
                i = verbatim
                    ? blankVerbatimString(content, q, out)
                    : blankRegularString(content, q, out);
                continue;
            }
            // `@` před něčím jiným než `"` je verbatim identifikátor (`@class`) —
            // necháme projít normálně; `$` mimo string je vzácné, taky propustíme.
        }
        // char literál 'x' / '\n' / 'A'
        if (c === "'") {
            const m = /^'(?:\\(?:u[0-9A-Fa-f]{4}|x[0-9A-Fa-f]{1,4}|[0-7]{1,3}|.)|[^'\\])'/.exec(content.slice(i));
            if (m) {
                for (let k = 0; k < m[0].length; k++)
                    out.push(' ');
                i += m[0].length;
                continue;
            }
        }
        out.push(c);
        i++;
    }
    return out.join('');
}
/** Vyblankuje normální string `"..."` (s `\` escapy) od pozice `quotePos` (`"`). */
function blankRegularString(content, quotePos, out) {
    const n = content.length;
    out.push(' ');
    let j = quotePos + 1;
    while (j < n) {
        if (content[j] === '\\' && j + 1 < n) {
            out.push(' ', ' ');
            j += 2;
            continue;
        }
        if (content[j] === '"')
            break;
        out.push(content[j] === '\n' ? '\n' : ' ');
        j++;
    }
    if (j < n) {
        out.push(' ');
        j++;
    }
    return j;
}
/**
 * Vyblankuje verbatim string `@"..."` od pozice `quotePos` (`"`). `\` není escape;
 * `""` je escapovaná uvozovka (zůstává ve stringu), osamocená `"` string ukončuje.
 */
function blankVerbatimString(content, quotePos, out) {
    const n = content.length;
    out.push(' ');
    let j = quotePos + 1;
    while (j < n) {
        if (content[j] === '"') {
            if (content[j + 1] === '"') {
                out.push(' ', ' ');
                j += 2;
                continue;
            }
            break;
        }
        out.push(content[j] === '\n' ? '\n' : ' ');
        j++;
    }
    if (j < n) {
        out.push(' ');
        j++;
    }
    return j;
}
/**
 * Vyblankuje raw string literál `"""..."""` (C# 11) od pozice `quotePos` (první
 * `"`). Best-effort: bere přesně tři uvozovky jako delimiter, bez escapů.
 */
function blankRawString(content, quotePos, out) {
    const n = content.length;
    out.push(' ', ' ', ' ');
    let j = quotePos + 3;
    while (j < n) {
        if (content[j] === '"' && content[j + 1] === '"' && content[j + 2] === '"')
            break;
        out.push(content[j] === '\n' ? '\n' : ' ');
        j++;
    }
    if (j < n) {
        out.push(' ', ' ', ' ');
        j += 3;
    }
    return j;
}
// ---------------------------------------------------------------------------
// Sdílené pomůcky
// ---------------------------------------------------------------------------
/** Číslo řádku (1-based), na kterém leží znak na dané pozici. */
function lineAt(text, position) {
    let line = 1;
    const stop = Math.min(position, text.length);
    for (let i = 0; i < stop; i++) {
        if (text[i] === '\n')
            line++;
    }
    return line;
}
function matchPair(text, openPos, open, close) {
    let depth = 0;
    for (let i = openPos; i < text.length; i++) {
        if (text[i] === open)
            depth++;
        else if (text[i] === close) {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return text.length;
}
function matchBrace(text, openPos) {
    return matchPair(text, openPos, '{', '}');
}
function matchParen(text, openPos) {
    return matchPair(text, openPos, '(', ')');
}
function matchAngle(text, openPos) {
    return matchPair(text, openPos, '<', '>');
}
function splitTopLevelCommas(s) {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '{' || c === '(' || c === '[' || c === '<')
            depth++;
        else if (c === '}' || c === ')' || c === ']' || c === '>')
            depth--;
        else if (c === ',' && depth === 0) {
            out.push(s.slice(start, i));
            start = i + 1;
        }
    }
    out.push(s.slice(start));
    return out.map((p) => p.trim()).filter(Boolean);
}
function isWhitespace(c) {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}
function isWordChar(c) {
    if (c === undefined)
        return false;
    return /[A-Za-z0-9_]/.test(c);
}
function skipWs(text, pos) {
    let i = pos;
    while (i < text.length && isWhitespace(text[i]))
        i++;
    return i;
}
/** Identifikátor začínající na pozici `p` (povolí verbatim `@`), nebo `null`. */
function wordAt(text, p) {
    const m = /^@?[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(p));
    return m ? m[0] : null;
}
/** Přeskočí atribut `[...]` (i `[assembly: ...]`); vrátí pozici za `]`. */
function skipAttribute(text, bracketPos) {
    return matchPair(text, bracketPos, '[', ']') + 1;
}
// ---------------------------------------------------------------------------
// Usingy (importy)
// ---------------------------------------------------------------------------
/**
 * Najde `using System;`, `using System.Collections.Generic;`,
 * `using static System.Math;`, `global using ...;` a aliasy
 * `using Foo = System.Bar;`. `source` = cesta namespace tak, jak je v kódu;
 * `symbols` = poslední segment cesty, u aliasu jméno aliasu. `using (var x = ...)`
 * (using statement v těle metody) ignorujeme — má za klíčovým slovem `(`.
 */
function extractCSharpUsings(stripped) {
    const imports = [];
    const regex = /\busing\b/g;
    let m;
    while ((m = regex.exec(stripped)) !== null) {
        if (m.index > 0 && isWordChar(stripped[m.index - 1]))
            continue;
        let p = skipWs(stripped, m.index + 'using'.length);
        // `using (...)` / `using var x = ...` jsou using statements v těle, ne direktiva
        if (stripped[p] === '(')
            continue;
        // volitelný `static`
        if (stripped.startsWith('static', p) && !isWordChar(stripped[p + 'static'.length])) {
            p = skipWs(stripped, p + 'static'.length);
        }
        const semi = stripped.indexOf(';', p);
        if (semi === -1)
            continue;
        const body = stripped.slice(p, semi);
        regex.lastIndex = semi + 1;
        // alias: `Foo = System.Bar`
        const eq = body.indexOf('=');
        let alias = null;
        let pathPart = body;
        if (eq !== -1) {
            alias = body.slice(0, eq).trim();
            pathPart = body.slice(eq + 1);
        }
        const path = pathPart.replace(/\s+/g, '');
        if (!path)
            continue;
        const segments = path.split('.');
        const last = segments[segments.length - 1] ?? path;
        const symbol = alias && /^[A-Za-z_@][\w]*$/.test(alias) ? alias : last;
        imports.push({ source: path, symbols: [symbol] });
    }
    return imports;
}
// ---------------------------------------------------------------------------
// Exporty
// ---------------------------------------------------------------------------
const TYPE_KEYWORDS = ['class', 'struct', 'interface', 'enum', 'record'];
/** Mapuje deklarační klíčové slovo na `ExportKind`. */
function typeKindFor(kw) {
    switch (kw) {
        case 'class':
        case 'record':
            return 'class';
        case 'struct':
            return 'struct';
        case 'enum':
            return 'enum';
        case 'interface':
            return 'interface';
    }
}
/** Modifikátory typu, které přeskakujeme při hledání klíčového slova. */
const TYPE_MODIFIERS = new Set([
    'abstract',
    'sealed',
    'static',
    'partial',
    'readonly',
    'ref',
    'unsafe',
    'new',
    'file',
]);
/** Modifikátory členu, které přeskakujeme při hledání jména. */
const MEMBER_MODIFIERS = new Set([
    'abstract',
    'sealed',
    'static',
    'partial',
    'readonly',
    'virtual',
    'override',
    'async',
    'extern',
    'unsafe',
    'new',
    'volatile',
    'const',
    'required',
    'file',
]);
/**
 * Jednoprůchodový sken očištěného textu. Na úrovni souboru (a uvnitř namespace,
 * jehož braces jsou průhledné) hledá top-level typy. Tělo typu se zpracuje zvlášť
 * (`parseType`) a sken pokračuje za koncem těla — dovnitř se znovu nezanořuje.
 */
function extractCSharpExports(stripped) {
    const exports = [];
    const n = stripped.length;
    const nsCloses = new Set();
    let i = 0;
    let depth = 0;
    while (i < n) {
        const c = stripped[i];
        if (c === '{') {
            depth++;
            i++;
            continue;
        }
        if (c === '}') {
            // namespace `}` je průhledné — neúčtujeme ho do depth
            if (nsCloses.has(i)) {
                nsCloses.delete(i);
                i++;
                continue;
            }
            depth--;
            i++;
            continue;
        }
        if (depth !== 0) {
            i++;
            continue;
        }
        const ns = namespaceAt(stripped, i);
        if (ns) {
            if (ns.closeBrace !== undefined)
                nsCloses.add(ns.closeBrace);
            i = Math.max(ns.next, i + 1);
            continue;
        }
        const t = typeDeclAt(stripped, i);
        if (t) {
            const r = parseType(stripped, t);
            if (r.export)
                exports.push(r.export);
            i = Math.max(r.next, i + 1);
            continue;
        }
        i++;
    }
    return exports;
}
/**
 * Pokud na pozici `i` (na hranici slova) začíná `namespace`, vrátí, kam skočit.
 * File-scoped (`namespace A.B;`) → `next` za `;`. Block (`namespace A { ... }`) →
 * `next` za `{` a `closeBrace` na odpovídající `}`, takže obsah skenujeme jako
 * top-level. Bere v potaz `[assembly: ...]` atributy před namespace nepotřebuje
 * (ty jsou samostatné). Vrací `null`, když tu namespace není.
 */
function namespaceAt(text, i) {
    if (i > 0 && isWordChar(text[i - 1]))
        return null;
    if (!text.startsWith('namespace', i))
        return null;
    if (isWordChar(text[i + 'namespace'.length]))
        return null;
    let p = skipWs(text, i + 'namespace'.length);
    // jméno (kvalifikované A.B.C)
    while (p < text.length && (isWordChar(text[p]) || text[p] === '.'))
        p++;
    p = skipWs(text, p);
    if (text[p] === ';')
        return { next: p + 1 };
    if (text[p] === '{') {
        const close = matchBrace(text, p);
        return { next: p + 1, closeBrace: close };
    }
    return null;
}
/**
 * Pokud na pozici `i` (na hranici slova) začíná typová deklarace, vrátí její
 * popis. Sklouzne přes atributy (`[Serializable]`) a modifikátory až ke klíčovému
 * slovu. Rozpozná `record class`/`record struct` (kw zůstává konkrétní). Default
 * top-level (bez access modifieru) je `internal` → `visible` true; `private`/
 * `file` → false.
 */
function typeDeclAt(text, i) {
    if (i > 0 && isWordChar(text[i - 1]))
        return null;
    const declStart = i;
    let p = i;
    let hasPrivate = false;
    let hasFile = false;
    while (p < text.length) {
        p = skipWs(text, p);
        if (text[p] === '[') {
            p = skipAttribute(text, p);
            continue;
        }
        const word = wordAt(text, p);
        if (word === null)
            return null;
        if (TYPE_KEYWORDS.includes(word)) {
            const kw = word;
            let kwPos = p;
            // `record class` / `record struct` → kind podle druhého slova
            if (kw === 'record') {
                const after = skipWs(text, p + word.length);
                const next = wordAt(text, after);
                if (next === 'class' || next === 'struct') {
                    return {
                        declStart,
                        kwPos: after,
                        kw: next,
                        visible: !hasPrivate && !hasFile,
                    };
                }
            }
            return { declStart, kwPos, kw, visible: !hasPrivate && !hasFile };
        }
        if (word === 'private') {
            hasPrivate = true;
            p += word.length;
            continue;
        }
        if (word === 'file') {
            hasFile = true;
            p += word.length;
            continue;
        }
        if (word === 'public' || word === 'internal' || word === 'protected') {
            p += word.length;
            continue;
        }
        if (TYPE_MODIFIERS.has(word)) {
            p += word.length;
            continue;
        }
        // něco jiného → tady typová deklarace nezačíná
        return null;
    }
    return null;
}
/**
 * Zpracuje jednu typovou deklaraci od `decl`. Najde jméno, tělo `{ ... }`,
 * spočítá kotvy (`line` = `declStart`, `endLine` = `}`). Když je typ `visible`,
 * vyrobí `ExportInfo` a doplní `public`/`internal` metody z těla. `next` ukazuje
 * za konec deklarace (za tělo, nebo za `;` u positional recordu bez těla).
 */
function parseType(stripped, decl) {
    let p = skipWs(stripped, decl.kwPos + decl.kw.length);
    const name = wordAt(stripped, p);
    if (name === null) {
        const eol = stripped.indexOf('\n', p);
        return { next: eol === -1 ? stripped.length : eol + 1, export: null };
    }
    p += name.length;
    // generické parametry typu <T, U>
    p = skipWs(stripped, p);
    if (stripped[p] === '<')
        p = skipWs(stripped, matchAngle(stripped, p) + 1);
    // positional record / primary constructor (...) — přeskoč
    if (stripped[p] === '(')
        p = skipWs(stripped, matchParen(stripped, p) + 1);
    // tělo `{` nebo `;` (positional record / partial bez těla); base list `: Base`
    // a constraints `where T : ...` neobsahují `{` ani `;` na top-levelu
    let scan = p;
    let brace = -1;
    let semi = -1;
    while (scan < stripped.length) {
        const c = stripped[scan];
        if (c === '{') {
            brace = scan;
            break;
        }
        if (c === ';') {
            semi = scan;
            break;
        }
        scan++;
    }
    if (brace === -1) {
        // bez těla (positional record `;`) — žádné metody
        const end = semi === -1 ? stripped.length : semi + 1;
        if (!decl.visible)
            return { next: end, export: null };
        const exp = {
            name: name.replace(/^@/, ''),
            kind: typeKindFor(decl.kw),
            line: lineAt(stripped, decl.declStart),
            endLine: lineAt(stripped, semi === -1 ? end : semi),
        };
        return { next: end, export: exp };
    }
    const close = matchBrace(stripped, brace);
    if (!decl.visible) {
        return { next: close + 1, export: null };
    }
    const exp = {
        name: name.replace(/^@/, ''),
        kind: typeKindFor(decl.kw),
        line: lineAt(stripped, decl.declStart),
        endLine: lineAt(stripped, close),
    };
    // V interface jsou členy implicitně public.
    const implicitPublic = decl.kw === 'interface';
    const methods = parseTypeBody(stripped, brace + 1, close, implicitPublic);
    if (methods.length > 0)
        exp.methods = methods;
    return { next: close + 1, export: exp };
}
/**
 * Projde tělo typu (mezi `{` a `}`) na jeho top-levelu a vytáhne `public`/
 * `internal` **metody** jako `MethodSignature`. Vlastnosti (`Type Name { get; }`),
 * pole a vnořené typy se přeskočí — model `ExportInfo` pro ně slot nemá. Těla
 * metod a vnořené typy se nezanořuje.
 */
function parseTypeBody(stripped, from, to, implicitPublic) {
    const methods = [];
    let i = from;
    while (i < to) {
        i = skipWs(stripped, i);
        if (i >= to)
            break;
        const c = stripped[i];
        if (c === '{') {
            i = matchBrace(stripped, i) + 1;
            continue;
        }
        if (c === ';') {
            i++;
            continue;
        }
        const member = parseMember(stripped, i, to, implicitPublic);
        if (member) {
            if (member.method)
                methods.push(member.method);
            i = Math.max(member.next, i + 1);
            continue;
        }
        i++;
    }
    return methods;
}
/**
 * Zkusí načíst jeden člen od `pos`. Sklouzne přes atributy a modifikátory; pokud
 * mezi nimi je `public`/`internal` (nebo je typ interface → implicitně public),
 * jde o exportovaný člen. Rozliší metodu (`... Name(params)`) od vlastnosti/pole.
 * Vnořený typ celý přeskočí. Vrací `next` za koncem členu (vč. těla/`;`).
 */
function parseMember(stripped, pos, limit, implicitPublic) {
    let p = pos;
    let visible = false;
    let hasExplicitAccess = false;
    let isStatic = false;
    for (;;) {
        p = skipWs(stripped, p);
        if (p >= limit)
            return null;
        if (stripped[p] === '[') {
            p = skipAttribute(stripped, p);
            continue;
        }
        const word = wordAt(stripped, p);
        if (word === null)
            break;
        if (word === 'public' || word === 'internal') {
            visible = true;
            hasExplicitAccess = true;
            p += word.length;
            continue;
        }
        if (word === 'private' || word === 'protected') {
            hasExplicitAccess = true;
            p += word.length;
            continue;
        }
        if (word === 'static') {
            isStatic = true;
            p += word.length;
            continue;
        }
        if (MEMBER_MODIFIERS.has(word)) {
            p += word.length;
            continue;
        }
        break;
    }
    // V interface jsou členy implicitně public, pokud nemají explicitní modifier.
    if (implicitPublic && !hasExplicitAccess)
        visible = true;
    // vnořený typ → přeskoč ho celý (parseType s visible:false vrátí next za tělem)
    const nested = typeDeclAt(stripped, p);
    if (nested && nested.kwPos >= p) {
        const r = parseType(stripped, { ...nested, visible: false });
        return { next: r.next };
    }
    if (!visible) {
        return { next: skipMember(stripped, p, limit) };
    }
    // exportovaný člen: metoda má `Name(` dřív než `;`/`=`/`{`/`=>`
    const decl = scanToParenOrSemi(stripped, p, limit);
    if (decl.kind === 'method' && decl.namePos !== undefined && decl.parenPos !== undefined) {
        const name = wordAt(stripped, decl.namePos);
        if (name === null)
            return { next: skipMember(stripped, p, limit) };
        const paramsClose = matchParen(stripped, decl.parenPos);
        const sig = {
            parameters: parseCSharpParams(stripped.slice(decl.parenPos + 1, paramsClose)),
        };
        const method = { name: name.replace(/^@/, ''), signature: sig };
        if (isStatic)
            method.isStatic = true;
        return { next: skipMember(stripped, paramsClose + 1, limit), method };
    }
    // vlastnost / pole / event → přeskoč po `;` nebo po těle `{}`
    return { next: skipMember(stripped, p, limit) };
}
/**
 * Od `pos` (za modifikátory) zjistí, jestli člen je metoda (najde `(` dřív než
 * `;`/`=`/`{`) nebo vlastnost/pole. U metody vrátí pozici jména (poslední
 * identifikátor před `(`) a pozici `(`. Generika v návratovém typu (`<...>`) se
 * přeskočí.
 */
function scanToParenOrSemi(stripped, pos, limit) {
    let i = pos;
    let lastWordStart = -1;
    while (i < limit) {
        const c = stripped[i];
        if (c === undefined)
            break;
        if (c === ';' || c === '=' || c === '{' || c === '}')
            return { kind: 'field' };
        if (c === '(') {
            if (lastWordStart === -1)
                return { kind: 'field' };
            return { kind: 'method', namePos: lastWordStart, parenPos: i };
        }
        if (c === '<') {
            i = matchAngle(stripped, i) + 1;
            continue;
        }
        if (c === '@' || isWordChar(c)) {
            lastWordStart = i;
            const w = wordAt(stripped, i);
            i += w ? w.length : 1;
            continue;
        }
        i++;
    }
    return { kind: 'field' };
}
/**
 * Přeskočí jeden člen od `pos`: dojde na `;` (pole / abstraktní nebo interface
 * metoda) nebo na tělo `{ ... }` (metoda / vlastnost s accessory) a vrátí pozici
 * za ním. Expression-bodied (`=> expr;`) skončí na `;`. Co přijde dřív, vyhrává.
 */
function skipMember(stripped, pos, limit) {
    let i = pos;
    while (i < limit) {
        const c = stripped[i];
        if (c === ';')
            return i + 1;
        if (c === '{')
            return matchBrace(stripped, i) + 1;
        if (c === '}')
            return i; // konec těla typu
        i++;
    }
    return limit;
}
/**
 * Parametry C# metody. Každý je `Type name` (případně s modifikátory `ref`/`out`/
 * `in`/`params`/`this`, atributy `[...]`, generikou `<...>`, poli `[]` nebo
 * default hodnotou `= ...`). Poslední token před `=` je jméno, zbytek je typ.
 * `params` → `rest`, přítomnost `= ...` → `optional`.
 */
function parseCSharpParams(paramsStr) {
    const result = [];
    for (const segRaw of splitTopLevelCommas(paramsStr)) {
        let s = segRaw.trim();
        // odstraň úvodní atributy parametru [In], [Out] apod. (jen na začátku, ať
        // nesežereme pole `string[]` uprostřed)
        s = s.replace(/^(?:\[[^\]]*\]\s*)+/, '');
        s = s.trim();
        if (!s)
            continue;
        // default hodnota `= ...`
        let optional = false;
        const eq = s.indexOf('=');
        if (eq !== -1) {
            optional = true;
            s = s.slice(0, eq).trim();
        }
        // modifikátory parametru
        let rest = false;
        s = s.replace(/^(?:ref\s+readonly|ref|out|in|params|this|scoped)\s+/g, (mod) => {
            if (mod.trim().startsWith('params'))
                rest = true;
            return '';
        });
        s = s.trim();
        if (!s)
            continue;
        const m = /^(.*?)\s+(@?[A-Za-z_][\w]*)$/.exec(s);
        if (m && m[1] !== undefined && m[2] !== undefined) {
            const param = { name: m[2].replace(/^@/, ''), type: m[1].trim() };
            if (rest)
                param.rest = true;
            if (optional)
                param.optional = true;
            result.push(param);
        }
        else {
            const param = { name: '_', type: s };
            if (rest)
                param.rest = true;
            if (optional)
                param.optional = true;
            result.push(param);
        }
    }
    return result;
}
