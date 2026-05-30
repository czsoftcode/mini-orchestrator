/**
 * Regex/scanner-based Go mapper. Pracuje nad dvěma očištěnými variantami zdroje:
 *  - `noComments` (komentáře → mezery, **stringy zachované**) — odsud se tahají
 *    importy, protože cesta balíčku je string literál (`import "fmt"`).
 *  - `stripped` (komentáře i stringy → mezery stejné délky) — odsud se tahají
 *    top-level deklarace, aby brace-counting a čísla řádků seděla.
 *
 * Exportované = symbol s velkým počátečním písmenem (Go konvence). Metody
 * (`func (r T) Name`) se připojují jako `methods` k exportu typu `T`. Záměrně
 * konzervativní: top-level = brace-depth 0; těla `func`/`struct`/`interface` se
 * při skenu přeskakují, takže se do nich nezanořujeme.
 */
export function mapGoFile(content, relPath) {
    const noComments = stripGo(content, /* blankStrings */ false);
    const stripped = stripGo(content, /* blankStrings */ true);
    const imports = extractGoImports(noComments);
    const exports = extractGoExports(stripped);
    return {
        path: relPath.replace(/\\/g, '/'),
        exports,
        imports,
    };
}
/**
 * Smaže komentáře (`//` řádkové, `/* *​/` blokové — Go je **nevnořuje**) a podle
 * `blankStrings` buď i obsah stringů/runů (náhrada mezerami stejné délky se
 * zachováním `\n`), nebo je nechá beze změny. String literály se vždy korektně
 * přeskočí, ať `//` uvnitř stringu není považováno za komentář.
 */
function stripGo(content, blankStrings) {
    const out = [];
    let i = 0;
    const n = content.length;
    while (i < n) {
        const c = content[i];
        if (c === undefined)
            break;
        const c2 = content[i + 1];
        // block /* ... */ — v Go se nevnořuje
        if (c === '/' && c2 === '*') {
            const end = content.indexOf('*/', i + 2);
            const stop = end === -1 ? n : end + 2;
            for (let j = i; j < stop; j++)
                out.push(content[j] === '\n' ? '\n' : ' ');
            i = stop;
            continue;
        }
        // line // ...
        if (c === '/' && c2 === '/') {
            while (i < n && content[i] !== '\n') {
                out.push(' ');
                i++;
            }
            continue;
        }
        // raw string `...` — bez escapů, může být víceřádkový
        if (c === '`') {
            out.push(blankStrings ? ' ' : '`');
            let j = i + 1;
            while (j < n && content[j] !== '`') {
                out.push(blankStrings ? (content[j] === '\n' ? '\n' : ' ') : content[j]);
                j++;
            }
            if (j < n) {
                out.push(blankStrings ? ' ' : '`');
                j++;
            }
            i = j;
            continue;
        }
        // interpreted string "..." (s escapy)
        if (c === '"') {
            out.push(blankStrings ? ' ' : '"');
            let j = i + 1;
            while (j < n) {
                if (content[j] === '\\' && j + 1 < n) {
                    if (blankStrings) {
                        out.push(' ', ' ');
                    }
                    else {
                        out.push(content[j], content[j + 1]);
                    }
                    j += 2;
                    continue;
                }
                if (content[j] === '"')
                    break;
                out.push(blankStrings ? (content[j] === '\n' ? '\n' : ' ') : content[j]);
                j++;
            }
            if (j < n) {
                out.push(blankStrings ? ' ' : '"');
                j++;
            }
            i = j;
            continue;
        }
        // rune literál 'x' / '\n' / 'ሴ'
        if (c === "'") {
            const m = /^'(?:\\(?:x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)|[^'\\])'/.exec(content.slice(i));
            if (m) {
                for (let k = 0; k < m[0].length; k++)
                    out.push(blankStrings ? ' ' : m[0][k]);
                i += m[0].length;
                continue;
            }
        }
        out.push(c);
        i++;
    }
    return out.join('');
}
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
function matchBracket(text, openPos) {
    return matchPair(text, openPos, '[', ']');
}
function splitTopLevelCommas(s) {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '{' || c === '(' || c === '[')
            depth++;
        else if (c === '}' || c === ')' || c === ']')
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
/** Go: exportovaný = velké počáteční písmeno (Unicode uppercase). */
function isExported(name) {
    return /^\p{Lu}/u.test(name);
}
function skipWs(text, pos) {
    let i = pos;
    while (i < text.length && isWhitespace(text[i]))
        i++;
    return i;
}
function endOfLine(text, pos) {
    let i = pos;
    while (i < text.length && text[i] !== '\n')
        i++;
    return i;
}
/** Slovo bezprostředně před `pos` (přes whitespace), nebo prázdný řetězec. */
function precedingWord(text, pos) {
    let j = pos - 1;
    while (j >= 0 && isWhitespace(text[j]))
        j--;
    const end = j + 1;
    while (j >= 0 && isWordChar(text[j]))
        j--;
    return text.slice(j + 1, end);
}
// ---------------------------------------------------------------------------
// Importy
// ---------------------------------------------------------------------------
/**
 * Najde `import "..."` (single) i `import ( ... )` (blok). Čte z `noComments`,
 * kde jsou stringy zachované. Tvary specifikace:
 *  - `"fmt"` → symbol = poslední segment cesty
 *  - `alias "path"` → symbol = alias
 *  - `_ "path"` → blank import (side-effect, prázdné symboly)
 *  - `. "path"` → dot import (`['*']`)
 */
function extractGoImports(noComments) {
    const imports = [];
    const regex = /\bimport\b/g;
    let m;
    while ((m = regex.exec(noComments)) !== null) {
        let p = skipWs(noComments, m.index + 'import'.length);
        if (noComments[p] === '(') {
            const close = matchParen(noComments, p);
            const inner = noComments.slice(p + 1, close);
            for (const line of inner.split('\n'))
                parseImportSpec(line, imports);
            regex.lastIndex = close + 1;
        }
        else {
            const e = endOfLine(noComments, p);
            parseImportSpec(noComments.slice(p, e), imports);
            regex.lastIndex = e;
        }
    }
    return imports;
}
function parseImportSpec(spec, out) {
    const m = /^\s*(?:(\.|_|[A-Za-z_]\w*)\s+)?"([^"]*)"/.exec(spec);
    if (!m)
        return;
    const alias = m[1];
    const path = m[2];
    if (path === undefined)
        return;
    const segments = path.split('/');
    const last = segments[segments.length - 1] ?? path;
    let symbols;
    if (alias === '_')
        symbols = [];
    else if (alias === '.')
        symbols = ['*'];
    else if (alias)
        symbols = [alias];
    else
        symbols = [last];
    out.push({ source: path, symbols });
}
const KEYWORDS = ['func', 'type', 'const', 'var'];
/**
 * Jednoprůchodový sken očištěného textu. Na brace-depth 0 hledá deklarační
 * klíčová slova a každou deklaraci **celou spotřebuje** (vrátí pozici za ní),
 * takže se nikdy nezanoří do těla `func`/`struct`/`interface`. Tím se vyhne i
 * falešnému `func` uvnitř `type H func(...)`.
 */
function extractGoExports(stripped) {
    const exports = [];
    const typeMap = new Map();
    const methods = [];
    const n = stripped.length;
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
            depth--;
            i++;
            continue;
        }
        if (depth !== 0) {
            i++;
            continue;
        }
        const kw = keywordAt(stripped, i);
        if (kw === 'func') {
            const r = parseFunc(stripped, i);
            for (const e of r.exports)
                exports.push(e);
            for (const mth of r.methods)
                methods.push(mth);
            i = Math.max(r.next, i + 1);
            continue;
        }
        if (kw === 'type') {
            const r = parseType(stripped, i);
            for (const e of r.exports) {
                exports.push(e);
                typeMap.set(e.name, e);
            }
            i = Math.max(r.next, i + 1);
            continue;
        }
        if (kw === 'const' || kw === 'var') {
            const r = parseConstVar(stripped, i, kw);
            for (const e of r.exports)
                exports.push(e);
            i = Math.max(r.next, i + 1);
            continue;
        }
        i++;
    }
    // Připoj nasbírané exportované metody k exportu jejich receiver typu.
    for (const { recv, method } of methods) {
        const target = typeMap.get(recv);
        if (!target)
            continue;
        (target.methods ??= []).push(method);
    }
    return exports;
}
/** Klíčové slovo na pozici `i` na hranici slova, nebo `null`. */
function keywordAt(text, i) {
    if (i > 0 && isWordChar(text[i - 1]))
        return null;
    for (const kw of KEYWORDS) {
        if (text.startsWith(kw, i) && !isWordChar(text[i + kw.length]))
            return kw;
    }
    return null;
}
function parseFunc(stripped, kwPos) {
    let p = skipWs(stripped, kwPos + 'func'.length);
    // Volitelný receiver: func (r *T) Name(...)
    let recvType;
    if (stripped[p] === '(') {
        const close = matchParen(stripped, p);
        recvType = parseReceiverType(stripped.slice(p + 1, close));
        p = skipWs(stripped, close + 1);
    }
    const nameMatch = /^([A-Za-z_]\w*)/.exec(stripped.slice(p));
    if (!nameMatch || nameMatch[1] === undefined)
        return { next: p, exports: [], methods: [] };
    const name = nameMatch[1];
    p = skipWs(stripped, p + name.length);
    // Volitelné generické parametry funkce: func F[T any](...)
    if (stripped[p] === '[')
        p = skipWs(stripped, matchBracket(stripped, p) + 1);
    if (stripped[p] !== '(')
        return { next: p, exports: [], methods: [] };
    const paramsOpen = p;
    const paramsClose = matchParen(stripped, paramsOpen);
    const sig = buildSignature(stripped, paramsOpen, paramsClose);
    // Konec deklarace: tělo `{ ... }` nebo (forward decl bez těla) konec řádku.
    const bodyBrace = findBodyBrace(stripped, paramsClose + 1);
    let endLine;
    let next;
    if (bodyBrace !== -1) {
        const bodyClose = matchBrace(stripped, bodyBrace);
        endLine = lineAt(stripped, bodyClose);
        next = bodyClose + 1;
    }
    else {
        next = endOfLine(stripped, paramsClose + 1);
    }
    if (recvType !== undefined) {
        if (isExported(name)) {
            return { next, exports: [], methods: [{ recv: recvType, method: { name, signature: sig } }] };
        }
        return { next, exports: [], methods: [] };
    }
    if (isExported(name)) {
        const exp = { name, kind: 'function', signature: sig, line: lineAt(stripped, kwPos) };
        if (endLine !== undefined)
            exp.endLine = endLine;
        return { next, exports: [exp], methods: [] };
    }
    return { next, exports: [], methods: [] };
}
/** Z receiver skupiny (`r *Stack[T]`, `Greeter`, `*Foo`) vytáhne název typu. */
function parseReceiverType(inner) {
    const tokens = inner.trim().split(/\s+/);
    let t = tokens[tokens.length - 1] ?? '';
    t = t.replace(/^\*/, ''); // pointer receiver
    t = t.replace(/\[.*\]$/, ''); // generické parametry typu
    return t;
}
/**
 * Signatura funkce/metody: parametry + návratový typ. Návrat je text mezi `)`
 * parametrů a tělem `{` (nebo koncem řádku u forward decl). Může to být jeden
 * typ (`error`), pointer (`*T`), slice (`[]byte`) i víc hodnot v závorkách
 * (`(int, error)` / pojmenované `(n int, err error)`).
 */
function buildSignature(stripped, paramsOpen, paramsClose) {
    const sig = {
        parameters: parseGoParams(stripped.slice(paramsOpen + 1, paramsClose)),
    };
    const bodyBrace = findBodyBrace(stripped, paramsClose + 1);
    const retEnd = bodyBrace === -1 ? endOfLine(stripped, paramsClose + 1) : bodyBrace;
    const ret = stripped.slice(paramsClose + 1, retEnd).trim();
    if (ret)
        sig.returnType = ret;
    return sig;
}
/**
 * Najde otevírací `{` těla od `fromPos`. Skoky přes inline `interface{}` /
 * `struct{ ... }` v návratovém typu (jejich závorky nejsou tělo funkce).
 * Hledá jen do konce řádku — gofmt dává `{` na řádek s `)` /návratovým typem;
 * forward decl (bez těla) tak vrátí `-1`.
 */
function findBodyBrace(stripped, fromPos) {
    let i = fromPos;
    while (i < stripped.length) {
        const c = stripped[i];
        if (c === '\n')
            return -1;
        if (c === '{') {
            const before = precedingWord(stripped, i);
            if (before === 'interface' || before === 'struct') {
                i = matchBrace(stripped, i) + 1;
                continue;
            }
            return i;
        }
        i++;
    }
    return -1;
}
/**
 * Parametry Go funkce. Řeší sdílený typ (`a, b int` → oba `int`), variadic
 * (`xs ...T` → `rest`) i nepojmenované typy (`(int, error)`). Jména bez typu se
 * drží jako „pending" a zdědí typ první následující otypované skupiny; co
 * zbude bez typu na konci, bereme jako nepojmenované typy.
 */
function parseGoParams(paramsStr) {
    const result = [];
    let pending = [];
    for (const seg of splitTopLevelCommas(paramsStr)) {
        const r = splitNameType(seg);
        if (r.single !== undefined) {
            pending.push(r.single);
            continue;
        }
        for (const name of pending)
            result.push({ name, type: r.type });
        pending = [];
        const param = { name: r.name };
        if (r.type)
            param.type = r.type;
        if (r.rest)
            param.rest = true;
        result.push(param);
    }
    for (const t of pending)
        result.push({ name: '_', type: t });
    return result;
}
function splitNameType(seg) {
    const s = seg.trim();
    let m = /^([A-Za-z_]\w*)\s+\.\.\.(.+)$/.exec(s);
    if (m && m[1] !== undefined && m[2] !== undefined) {
        return { name: m[1], type: m[2].trim(), rest: true };
    }
    m = /^\.\.\.(.+)$/.exec(s);
    if (m && m[1] !== undefined)
        return { name: '_', type: m[1].trim(), rest: true };
    m = /^([A-Za-z_]\w*)\s+(.+)$/.exec(s);
    if (m && m[1] !== undefined && m[2] !== undefined)
        return { name: m[1], type: m[2].trim() };
    return { single: s, name: s };
}
/** `type Name ...` (single) i `type ( ... )` (blok). */
function parseType(stripped, kwPos) {
    let p = skipWs(stripped, kwPos + 'type'.length);
    if (stripped[p] === '(') {
        const close = matchParen(stripped, p);
        const exports = [];
        let q = skipWs(stripped, p + 1);
        while (q < close) {
            if (/[A-Za-z_]/.test(stripped[q] ?? '')) {
                const r = parseOneType(stripped, q, q);
                for (const e of r.exports)
                    exports.push(e);
                q = skipWs(stripped, Math.max(r.next, q + 1));
            }
            else {
                q++;
            }
        }
        return { next: close + 1, exports };
    }
    const r = parseOneType(stripped, p, kwPos);
    return { next: r.next, exports: r.exports };
}
/**
 * Jeden typový spec od pozice jména. `anchorPos` určí řádkovou kotvu (u single
 * deklarace = `type` keyword, u blokové = jméno). Rozliší `struct` / `interface`
 * (tělo přes `matchBrace`, `endLine`) od ostatních aliasů (`type T = X`,
 * `type Celsius float64`, `type H func(...)` → kind `type`, single-line konec).
 */
function parseOneType(stripped, namePos, anchorPos) {
    const nameMatch = /^([A-Za-z_]\w*)/.exec(stripped.slice(namePos));
    if (!nameMatch || nameMatch[1] === undefined) {
        return { next: endOfLine(stripped, namePos), exports: [] };
    }
    const name = nameMatch[1];
    let p = skipWs(stripped, namePos + name.length);
    if (stripped[p] === '[')
        p = skipWs(stripped, matchBracket(stripped, p) + 1); // generika
    if (stripped[p] === '=')
        p = skipWs(stripped, p + 1); // alias `type T = X`
    const rest = stripped.slice(p);
    const exported = isExported(name);
    const line = lineAt(stripped, anchorPos);
    if (/^struct\b/.test(rest) || /^interface\b/.test(rest)) {
        const kind = rest.startsWith('struct') ? 'struct' : 'interface';
        const brace = stripped.indexOf('{', p);
        if (brace === -1)
            return { next: endOfLine(stripped, p), exports: [] };
        const close = matchBrace(stripped, brace);
        const exports = exported
            ? [{ name, kind, line, endLine: lineAt(stripped, close) }]
            : [];
        return { next: close + 1, exports };
    }
    const next = endOfLine(stripped, p);
    return { next, exports: exported ? [{ name, kind: 'type', line }] : [] };
}
/** `const`/`var Name ...` (single) i seskupené `const ( ... )` / `var ( ... )`. */
function parseConstVar(stripped, kwPos, kw) {
    const kind = kw === 'const' ? 'const' : 'variable';
    let p = skipWs(stripped, kwPos + kw.length);
    const exports = [];
    if (stripped[p] === '(') {
        const close = matchParen(stripped, p);
        let q = p + 1;
        while (q < close) {
            q = skipWs(stripped, q);
            if (q >= close)
                break;
            const lineStart = q;
            collectDeclNames(stripped, q, close, kind, lineStart, exports);
            q = endOfLine(stripped, q) + 1;
        }
        return { next: close + 1, exports };
    }
    collectDeclNames(stripped, p, endOfLine(stripped, p), kind, kwPos, exports);
    return { next: endOfLine(stripped, p), exports };
}
/**
 * Vytáhne úvodní skupinu jmen deklarace (`A`, `A, B`, `A Type = …`) od `pos` a
 * exportovaná zařadí. `anchorPos` určuje řádkovou kotvu.
 */
function collectDeclNames(stripped, pos, limit, kind, anchorPos, out) {
    const slice = stripped.slice(pos, limit);
    const m = /^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)/.exec(slice);
    if (!m || m[1] === undefined)
        return;
    for (const raw of m[1].split(',')) {
        const name = raw.trim();
        if (name && isExported(name))
            out.push({ name, kind, line: lineAt(stripped, anchorPos) });
    }
}
