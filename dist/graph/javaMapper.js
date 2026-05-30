/**
 * Regex/scanner-based Java mapper. Pracuje nad očištěnou variantou zdroje, kde
 * jsou komentáře (`//`, `/* *​/`, javadoc `/** *​/`), stringy (`"..."`), text bloky
 * (`"""..."""`, Java 15+) i char literály (`'x'`) nahrazené mezerami stejné délky
 * (`\n` se zachovává, aby čísla řádků seděla). Importy mají cestu jako identifikátor
 * (žádné stringy), takže stačí jedna varianta.
 *
 * Mapuje top-level typy (`class` / `interface` / `enum` / `record` / `@interface`)
 * deklarované jako `public`/`protected` na brace-depth 0; `public`/`protected`
 * členy (metody jako `methods`, pole jako `field` exporty s `parentem`) se hledají
 * uvnitř těla typu. Záměrně konzervativní: do těl metod se nezanořuje.
 */
export function mapJavaFile(content, relPath) {
    const stripped = stripJava(content);
    const imports = extractJavaImports(stripped);
    const exports = extractJavaExports(stripped);
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
 * Smaže komentáře (`//` řádkové, `/* *​/` i javadoc `/** *​/` blokové — Java je
 * **nevnořuje**), stringy (`"..."` s escapy), text bloky (`"""..."""`, Java 15+)
 * a char literály (`'x'`, `'\n'`). Nahrazuje mezerami stejné délky se zachováním
 * `\n`, takže pozice i čísla řádků zůstávají. String/char literály se vždy
 * korektně přeskočí, aby `//` uvnitř stringu nebylo bráno jako komentář.
 */
function stripJava(content) {
    const out = [];
    let i = 0;
    const n = content.length;
    while (i < n) {
        const c = content[i];
        if (c === undefined)
            break;
        const c2 = content[i + 1];
        // block /* ... */ (vč. javadoc /** ... */) — v Javě se nevnořuje
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
        // text block """ ... """ (Java 15+) — víceřádkový, escapy ignorujeme uvnitř
        if (c === '"' && c2 === '"' && content[i + 2] === '"') {
            out.push(' ', ' ', ' ');
            let j = i + 3;
            while (j < n) {
                if (content[j] === '\\' && j + 1 < n) {
                    out.push(' ', ' ');
                    j += 2;
                    continue;
                }
                if (content[j] === '"' && content[j + 1] === '"' && content[j + 2] === '"')
                    break;
                out.push(content[j] === '\n' ? '\n' : ' ');
                j++;
            }
            if (j < n) {
                out.push(' ', ' ', ' ');
                j += 3;
            }
            i = j;
            continue;
        }
        // string "..." (s escapy)
        if (c === '"') {
            out.push(' ');
            let j = i + 1;
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
            i = j;
            continue;
        }
        // char literál 'x' / '\n' / 'é'
        if (c === "'") {
            const m = /^'(?:\\(?:u[0-9A-Fa-f]{4}|[0-7]{1,3}|.)|[^'\\])'/.exec(content.slice(i));
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
    return /[A-Za-z0-9_$]/.test(c);
}
function skipWs(text, pos) {
    let i = pos;
    while (i < text.length && isWhitespace(text[i]))
        i++;
    return i;
}
// ---------------------------------------------------------------------------
// Importy
// ---------------------------------------------------------------------------
/**
 * Najde `import a.b.C;`, `import static a.b.C.member;` a `import a.b.*;`.
 * Symbol = poslední segment cesty (`C` / `member`), u `.*` → `['*']`. `static`
 * importy se chovají stejně (symbol = poslední segment). `source` = celá cesta
 * tak, jak je v kódu (bez `static` a `;`).
 */
function extractJavaImports(stripped) {
    const imports = [];
    const regex = /\bimport\b/g;
    let m;
    while ((m = regex.exec(stripped)) !== null) {
        // hranice slova zleva (ať `reimport` nechytneme)
        if (m.index > 0 && isWordChar(stripped[m.index - 1]))
            continue;
        let p = skipWs(stripped, m.index + 'import'.length);
        // volitelný `static`
        if (stripped.startsWith('static', p) && !isWordChar(stripped[p + 'static'.length])) {
            p = skipWs(stripped, p + 'static'.length);
        }
        const semi = stripped.indexOf(';', p);
        const end = semi === -1 ? stripped.length : semi;
        const path = stripped.slice(p, end).replace(/\s+/g, '');
        regex.lastIndex = end;
        if (!path)
            continue;
        const segments = path.split('.');
        const last = segments[segments.length - 1] ?? path;
        const symbols = last === '*' ? ['*'] : [last];
        imports.push({ source: path, symbols });
    }
    return imports;
}
// ---------------------------------------------------------------------------
// Exporty
// ---------------------------------------------------------------------------
const TYPE_KEYWORDS = ['class', 'interface', 'enum', 'record'];
const MEMBER_VISIBILITY = ['public', 'protected'];
/** Mapuje deklarační klíčové slovo na `ExportKind`. */
function typeKindFor(kw) {
    switch (kw) {
        case 'class':
        case 'record':
            return 'class';
        case 'enum':
            return 'enum';
        case 'interface':
        case 'annotation':
            return 'interface';
    }
}
/**
 * Jednoprůchodový sken očištěného textu. Na brace-depth 0 hledá top-level typy
 * (`public`/`protected class|interface|enum|record|@interface`). Tělo typu se
 * pak zpracuje zvlášť (`parseTypeBody`) pro `public`/`protected` členy a sken
 * pokračuje za koncem těla — do těla už se znovu nezanořuje.
 */
function extractJavaExports(stripped) {
    const exports = [];
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
 * Pokud na pozici `i` (na hranici slova) začíná typová deklarace, vrátí její
 * popis. Sklouzne přes anotace (`@Foo(...)`) a modifikátory (`public`,
 * `abstract`, `final`, `sealed`, …) až ke klíčovému slovu. `visible` = mezi
 * modifikátory bylo `public` nebo `protected`. Rozpozná i `@interface`.
 */
function typeDeclAt(text, i) {
    if (i > 0 && isWordChar(text[i - 1]))
        return null;
    const declStart = i;
    let p = i;
    let visible = false;
    while (p < text.length) {
        p = skipWs(text, p);
        // anotace @Foo nebo @Foo(...)
        if (text[p] === '@') {
            // @interface je deklarace anotačního typu, ne běžná anotace
            const after = skipWs(text, p + 1);
            if (text.startsWith('interface', after) && !isWordChar(text[after + 'interface'.length])) {
                return { declStart, kwPos: after, kw: 'annotation', visible };
            }
            p = skipAnnotation(text, p);
            continue;
        }
        if (text[p] === '-') {
            // pomlčka v `non-sealed`
            p++;
            continue;
        }
        const word = wordAt(text, p);
        if (word === null)
            return null;
        if (TYPE_KEYWORDS.includes(word)) {
            return { declStart, kwPos: p, kw: word, visible };
        }
        if (word === 'public' || word === 'protected') {
            visible = true;
            p += word.length;
            continue;
        }
        if (TYPE_MODIFIERS.has(word)) {
            p += word.length;
            continue;
        }
        // něco jiného (typ návratu apod.) → tady typová deklarace nezačíná
        return null;
    }
    return null;
}
const TYPE_MODIFIERS = new Set([
    'private',
    'abstract',
    'final',
    'static',
    'sealed',
    'non',
    'strictfp',
]);
/** Přeskočí anotaci `@Foo` i s případnými `(...)` argumenty; vrátí pozici za ní. */
function skipAnnotation(text, atPos) {
    let p = skipWs(text, atPos + 1);
    // jméno anotace (může být kvalifikované a.b.C)
    while (p < text.length && (isWordChar(text[p]) || text[p] === '.'))
        p++;
    p = skipWs(text, p);
    if (text[p] === '(')
        return matchParen(text, p) + 1;
    return p;
}
/** Identifikátor začínající na pozici `p`, nebo `null`. */
function wordAt(text, p) {
    const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text.slice(p));
    return m ? m[0] : null;
}
/**
 * Zpracuje jednu typovou deklaraci od `decl`. Najde jméno, tělo `{ ... }`,
 * spočítá kotvy (`line` = `declStart`, `endLine` = `}`). Když je typ
 * `public`/`protected`, vyrobí `ExportInfo` a doplní `public`/`protected` členy
 * z těla. `next` ukazuje za konec těla.
 */
function parseType(stripped, decl) {
    let p = skipWs(stripped, decl.kwPos + (decl.kw === 'annotation' ? 'interface' : decl.kw).length);
    const name = wordAt(stripped, p);
    if (name === null)
        return { next: stripped.indexOf('\n', p) + 1 || stripped.length, export: null };
    p += name.length;
    // generické parametry typu <T, U extends ...>
    p = skipWs(stripped, p);
    if (stripped[p] === '<')
        p = skipWs(stripped, matchAngle(stripped, p) + 1);
    // tělo typu — první `{` na top-levelu deklarace (přeskoč `extends`/`implements`,
    // record header `(...)` apod., které `{` neobsahují)
    const brace = stripped.indexOf('{', p);
    if (brace === -1) {
        // bez těla (nemělo by se u typu stát, ale buď konzervativní)
        const eol = stripped.indexOf('\n', p);
        return { next: eol === -1 ? stripped.length : eol + 1, export: null };
    }
    const close = matchBrace(stripped, brace);
    if (!decl.visible) {
        return { next: close + 1, export: null };
    }
    const exp = {
        name,
        kind: typeKindFor(decl.kw),
        line: lineAt(stripped, decl.declStart),
        endLine: lineAt(stripped, close),
    };
    // V interface (i `@interface`) jsou členy implicitně `public`.
    const implicitPublic = decl.kw === 'interface' || decl.kw === 'annotation';
    const methods = parseTypeBody(stripped, brace + 1, close, implicitPublic);
    if (methods.length > 0)
        exp.methods = methods;
    return { next: close + 1, export: exp };
}
/**
 * Projde tělo typu (mezi `{` a `}`) na jeho top-levelu (brace-depth 1 vůči
 * souboru = depth 0 uvnitř těla) a vytáhne `public`/`protected` **metody** jako
 * `MethodSignature` připojené k typu. Pole (`Type name [= ...];`) se korektně
 * rozpoznají a přeskočí — stejně jako Go nesleduje struct fields a Python class
 * atributy, model `ExportInfo` pro ně slot nemá. Těla metod a vnořené typy se
 * přeskočí (nezanořujeme se do nich).
 */
function parseTypeBody(stripped, from, to, implicitPublic) {
    const methods = [];
    let i = from;
    while (i < to) {
        i = skipWs(stripped, i);
        if (i >= to)
            break;
        const c = stripped[i];
        // přeskoč vnořené bloky/závorky, které nezačínají členem (statické bloky apod.)
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
 * Zkusí načíst jeden člen od `pos`. Sklouzne přes anotace a modifikátory; pokud
 * mezi nimi je `public`/`protected`, jde o exportovaný člen. Rozliší metodu
 * (`... name(params) { ... }` / `... name(params);` u abstraktních/interface)
 * od pole (`... name [= ...];`). Vrací `next` za koncem členu (vč. těla/`;`),
 * aby se sken nezanořoval.
 */
function parseMember(stripped, pos, limit, implicitPublic) {
    let p = pos;
    let visible = false;
    let hasPrivate = false;
    let isStatic = false;
    // modifikátory + anotace
    for (;;) {
        p = skipWs(stripped, p);
        if (p >= limit)
            return null;
        if (stripped[p] === '@') {
            p = skipAnnotation(stripped, p);
            continue;
        }
        if (stripped[p] === '-') {
            // pomlčka v `non-sealed`
            p++;
            continue;
        }
        const word = wordAt(stripped, p);
        if (word === null)
            break;
        if (MEMBER_VISIBILITY.includes(word)) {
            visible = true;
            p += word.length;
            continue;
        }
        if (word === 'private') {
            hasPrivate = true;
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
    // V interface jsou členy implicitně public, pokud nejsou výslovně private.
    if (implicitPublic && !hasPrivate)
        visible = true;
    // vnořený typ (public class Inner ...) — necháme top-level sken na pokoji a
    // přeskočíme ho celý, ať se nepřehrabujeme v jeho členech jako v polích
    const nested = typeDeclAt(stripped, p);
    if (nested && nested.kwPos >= p) {
        const r = parseType(stripped, { ...nested, visible: false });
        return { next: r.next };
    }
    if (!visible) {
        // neexportovaný člen — přeskoč ho celý (po `;` nebo po těle `{}`)
        return { next: skipMember(stripped, p, limit) };
    }
    // exportovaný člen: hledáme `name (` pro metodu, jinak je to pole
    const decl = scanToParenOrSemi(stripped, p, limit);
    if (decl.kind === 'method' && decl.namePos !== undefined && decl.parenPos !== undefined) {
        const name = wordAt(stripped, decl.namePos);
        if (name === null)
            return { next: skipMember(stripped, p, limit) };
        const paramsClose = matchParen(stripped, decl.parenPos);
        const sig = buildSignature(stripped, decl.parenPos, paramsClose);
        const method = { name, signature: sig };
        if (isStatic)
            method.isStatic = true;
        return { next: skipMember(stripped, paramsClose + 1, limit), method };
    }
    // pole nebo něco bez závorek → přeskoč po `;`
    return { next: skipMember(stripped, p, limit) };
}
const MEMBER_MODIFIERS = new Set([
    'private',
    'abstract',
    'final',
    'synchronized',
    'native',
    'transient',
    'volatile',
    'default',
    'strictfp',
    'sealed',
    'non',
]);
/**
 * Od `pos` (za modifikátory) zjistí, jestli člen je metoda (najde `(` dřív než
 * `;`/`=`/`{`) nebo pole. U metody vrátí pozici jména (poslední identifikátor
 * před `(`) a pozici `(`.
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
            // generika v návratovém typu / před jménem — přeskoč
            i = matchAngle(stripped, i) + 1;
            continue;
        }
        if (isWordChar(c)) {
            lastWordStart = i;
            while (i < limit && isWordChar(stripped[i]))
                i++;
            continue;
        }
        i++;
    }
    return { kind: 'field' };
}
/**
 * Přeskočí jeden člen od `pos`: dojde na `;` (pole / abstraktní metoda) nebo na
 * tělo `{ ... }` (konkrétní metoda / inicializační blok) a vrátí pozici za ním.
 * Co přijde dřív, to vyhrává.
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
 * Signatura metody: parametry (mezi `(` a `)`) + návratový typ. Návratový typ
 * Java metody stojí **před** jménem (`public int foo()`), takže ho čteme z textu
 * mezi začátkem členu a jménem metody. Konstruktor (návratový typ prázdný) nechá
 * `returnType` nevyplněný.
 */
function buildSignature(stripped, parenOpen, parenClose) {
    const sig = {
        parameters: parseJavaParams(stripped.slice(parenOpen + 1, parenClose)),
    };
    return sig;
}
/**
 * Parametry Java metody. Každý je `Type name` (případně s modifikátorem `final`,
 * anotacemi, generikou `<...>`, poli `[]` nebo varargs `...`). Poslední token je
 * jméno, zbytek je typ. `final` a anotace se z typu odstraní; varargs → `rest`.
 */
function parseJavaParams(paramsStr) {
    const result = [];
    for (const seg of splitTopLevelCommas(paramsStr)) {
        let s = seg.trim();
        // odstraň anotace parametru (@NotNull apod.)
        s = s.replace(/@[A-Za-z_$][\w$.]*(?:\([^)]*\))?\s*/g, '');
        // odstraň leading `final`
        s = s.replace(/^final\s+/, '');
        s = s.trim();
        if (!s)
            continue;
        let rest = false;
        if (s.includes('...')) {
            rest = true;
            s = s.replace(/\.\.\./, ' ');
        }
        const m = /^(.*?)\s+([A-Za-z_$][\w$]*)(\[\s*\])*$/.exec(s);
        if (m && m[1] !== undefined && m[2] !== undefined) {
            const param = { name: m[2], type: m[1].trim() };
            if (rest)
                param.rest = true;
            result.push(param);
        }
        else {
            // nešlo rozdělit (jen typ?) — vezmi jako nepojmenovaný
            const param = { name: '_', type: s };
            if (rest)
                param.rest = true;
            result.push(param);
        }
    }
    return result;
}
