/**
 * Regex-based PHP mapper. Smaže komentáře a stringy (nahrazením mezerami stejné
 * délky, aby pozice/řádky zůstaly stabilní pro brace-counting), pak v očištěném
 * textu hledá top-level `use`, `class`, `interface`, `trait` a `function` plus
 * veřejné metody uvnitř tříd.
 *
 * Konzervativní záměrně: raději symbol vynecháme, než abychom ho falešně
 * vyzobli z komentáře, heredocu nebo `function () use ($x)` closure. Žádný
 * pokus o jmenné prostory s blokovou formou (`namespace Foo { ... }`) — top
 * level se počítá jako brace-depth 0.
 */
export function mapPhpFile(content, relPath) {
    const stripped = stripPhpCommentsAndStrings(content);
    const imports = extractPhpImports(stripped);
    const exports = extractPhpExports(stripped);
    return {
        path: relPath.replace(/\\/g, '/'),
        exports,
        imports,
    };
}
function stripPhpCommentsAndStrings(content) {
    const out = [];
    let i = 0;
    const n = content.length;
    while (i < n) {
        const c = content[i];
        if (c === undefined)
            break;
        const c2 = content[i + 1];
        // block /* ... */
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
        // # line comment (ale ne #[Attribute])
        if (c === '#' && c2 !== '[') {
            while (i < n && content[i] !== '\n') {
                out.push(' ');
                i++;
            }
            continue;
        }
        // heredoc / nowdoc: <<<TAG ... TAG
        if (c === '<' && content.slice(i, i + 3) === '<<<') {
            const m = /^<<<(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[ \t]*\r?\n/.exec(content.slice(i));
            if (m) {
                const tag = m[2];
                const startBody = i + m[0].length;
                const closeRegex = new RegExp(`\\n[ \\t]*${tag}\\b`);
                const rest = content.slice(startBody);
                const endMatch = closeRegex.exec(rest);
                const stop = endMatch ? startBody + endMatch.index + endMatch[0].length : n;
                for (let j = i; j < stop; j++)
                    out.push(content[j] === '\n' ? '\n' : ' ');
                i = stop;
                continue;
            }
        }
        // single-quoted '...'
        if (c === "'") {
            out.push(' ');
            let j = i + 1;
            while (j < n) {
                if (content[j] === '\\' && j + 1 < n) {
                    out.push(' ');
                    out.push(' ');
                    j += 2;
                    continue;
                }
                if (content[j] === "'") {
                    out.push(' ');
                    j++;
                    break;
                }
                out.push(content[j] === '\n' ? '\n' : ' ');
                j++;
            }
            i = j;
            continue;
        }
        // double-quoted "..."
        if (c === '"') {
            out.push(' ');
            let j = i + 1;
            while (j < n) {
                if (content[j] === '\\' && j + 1 < n) {
                    out.push(' ');
                    out.push(' ');
                    j += 2;
                    continue;
                }
                if (content[j] === '"') {
                    out.push(' ');
                    j++;
                    break;
                }
                out.push(content[j] === '\n' ? '\n' : ' ');
                j++;
            }
            i = j;
            continue;
        }
        out.push(c);
        i++;
    }
    return out.join('');
}
function depthAt(stripped, position) {
    let depth = 0;
    for (let i = 0; i < position; i++) {
        const c = stripped[i];
        if (c === '{')
            depth++;
        else if (c === '}')
            depth--;
    }
    return depth;
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
function matchBrace(stripped, openPos) {
    let depth = 0;
    for (let i = openPos; i < stripped.length; i++) {
        if (stripped[i] === '{')
            depth++;
        else if (stripped[i] === '}') {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return stripped.length;
}
function matchParen(stripped, openPos) {
    let depth = 0;
    for (let i = openPos; i < stripped.length; i++) {
        if (stripped[i] === '(')
            depth++;
        else if (stripped[i] === ')') {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return stripped.length;
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
function extractPhpImports(stripped) {
    const imports = [];
    // `use [function|const] Foo\Bar\Baz [as X];`
    // `use Foo\Bar\{Baz, Qux as Q};`
    // Pojistka: tělo musí začínat identifierem (nikoli `(`) — vyhne se `function () use ($x)` closure.
    const regex = /\buse\s+(?:function\s+|const\s+)?([A-Za-z_\\][^;]*);/g;
    let m;
    while ((m = regex.exec(stripped)) !== null) {
        if (depthAt(stripped, m.index) !== 0)
            continue;
        const body = m[1];
        if (body === undefined)
            continue;
        parsePhpUseBody(body.trim(), imports);
    }
    return imports;
}
function parsePhpUseBody(body, out) {
    // Group: Foo\Bar\{ ... }
    const groupMatch = /^([A-Za-z_\\][A-Za-z0-9_\\]*)\\\{([\s\S]*)\}$/.exec(body);
    if (groupMatch) {
        const prefix = groupMatch[1];
        const inner = groupMatch[2];
        if (prefix === undefined || inner === undefined)
            return;
        const symbols = [];
        for (const raw of splitTopLevelCommas(inner)) {
            const aliasMatch = /^(?:function\s+|const\s+)?([A-Za-z_\\][A-Za-z0-9_\\]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(raw);
            if (aliasMatch && aliasMatch[2] !== undefined) {
                symbols.push(aliasMatch[2]);
            }
            else {
                const simple = /^(?:function\s+|const\s+)?([A-Za-z_\\][A-Za-z0-9_\\]*)$/i.exec(raw);
                if (!simple || simple[1] === undefined)
                    continue;
                const segments = simple[1].split('\\');
                const name = segments[segments.length - 1];
                if (name)
                    symbols.push(name);
            }
        }
        if (symbols.length > 0)
            out.push({ source: prefix, symbols });
        return;
    }
    // Comma-separated multi-use (legacy): use Foo, Bar as B;
    for (const part of splitTopLevelCommas(body)) {
        const aliasMatch = /^([A-Za-z_\\][A-Za-z0-9_\\]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(part);
        let fqn;
        let alias;
        if (aliasMatch && aliasMatch[1] !== undefined && aliasMatch[2] !== undefined) {
            fqn = aliasMatch[1];
            alias = aliasMatch[2];
        }
        else {
            const simple = /^([A-Za-z_\\][A-Za-z0-9_\\]*)$/.exec(part);
            if (!simple || simple[1] === undefined)
                continue;
            fqn = simple[1];
        }
        const segments = fqn.split('\\');
        const symbol = alias ?? segments[segments.length - 1];
        if (!symbol)
            continue;
        out.push({ source: fqn, symbols: [symbol] });
    }
}
function extractPhpExports(stripped) {
    const exports = [];
    // Třídy
    const classRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    let m;
    while ((m = classRegex.exec(stripped)) !== null) {
        if (depthAt(stripped, m.index) !== 0)
            continue;
        const name = m[1];
        if (name === undefined)
            continue;
        const openBrace = findOpenBrace(stripped, m.index + m[0].length);
        const info = { name, kind: 'class', line: lineAt(stripped, m.index) };
        if (openBrace !== -1) {
            const closeBrace = matchBrace(stripped, openBrace);
            info.endLine = lineAt(stripped, closeBrace);
            const body = stripped.slice(openBrace + 1, closeBrace);
            const methods = extractPhpMethods(body);
            if (methods.length > 0)
                info.methods = methods;
        }
        exports.push(info);
    }
    // Interface
    const interfaceRegex = /\binterface\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = interfaceRegex.exec(stripped)) !== null) {
        if (depthAt(stripped, m.index) !== 0)
            continue;
        const name = m[1];
        if (name === undefined)
            continue;
        exports.push({
            name,
            kind: 'interface',
            line: lineAt(stripped, m.index),
            ...bracedEnd(stripped, m.index + m[0].length),
        });
    }
    // Trait
    const traitRegex = /\btrait\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((m = traitRegex.exec(stripped)) !== null) {
        if (depthAt(stripped, m.index) !== 0)
            continue;
        const name = m[1];
        if (name === undefined)
            continue;
        exports.push({
            name,
            kind: 'trait',
            line: lineAt(stripped, m.index),
            ...bracedEnd(stripped, m.index + m[0].length),
        });
    }
    // Funkce — pouze top-level (depth 0)
    const fnRegex = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    while ((m = fnRegex.exec(stripped)) !== null) {
        if (depthAt(stripped, m.index) !== 0)
            continue;
        const name = m[1];
        if (name === undefined)
            continue;
        const openParen = m.index + m[0].length - 1;
        const sig = parsePhpSignature(stripped, openParen);
        const close = matchParen(stripped, openParen);
        exports.push({
            name,
            kind: 'function',
            signature: sig,
            line: lineAt(stripped, m.index),
            ...bracedEnd(stripped, close + 1),
        });
    }
    return exports;
}
/**
 * Best-effort konec deklarace s tělem `{ ... }`: od `fromPos` najde otevírací
 * `{` (přeskočí `extends`/`implements`/návratový typ) a vrátí řádek odpovídající
 * `}`. Když tělo nenajde (`-1`), vrátí prázdný objekt — `endLine` zůstane
 * nevyplněný. Start (`line`) plní volající z pozice klíčového slova.
 */
function bracedEnd(stripped, fromPos) {
    const openBrace = findOpenBrace(stripped, fromPos);
    if (openBrace === -1)
        return {};
    const closeBrace = matchBrace(stripped, openBrace);
    return { endLine: lineAt(stripped, closeBrace) };
}
function findOpenBrace(stripped, fromPos) {
    // Hledej první `{` přes whitespace, `extends ...`, `implements ...`
    let i = fromPos;
    while (i < stripped.length) {
        const c = stripped[i];
        if (c === '{')
            return i;
        if (c === ';')
            return -1; // class deklarace bez těla? V PHP se nestane, ale buďme opatrní.
        i++;
    }
    return -1;
}
function extractPhpMethods(classBody) {
    const methods = [];
    // Public metody: `public function name(...)`, případně se `static` v jakémkoliv pořadí.
    // Implicit visibility = public (chytíme i čistý `function name()` na úrovni 0 v classBody).
    // Privátní/protected metody přeskakujeme.
    // Pozn.: `function` může být i v anonymních closures uvnitř metody, takže
    // hlídáme depth uvnitř classBody (depth 0 = přímo v těle třídy).
    const regex = /(?:\b(public|protected|private|static|final|abstract|readonly)\s+)+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(|\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = regex.exec(classBody)) !== null) {
        if (depthAt(classBody, m.index) !== 0)
            continue;
        const name = m[2] ?? m[3];
        if (!name)
            continue;
        // Zjisti modifikátory uvnitř matche — najdi celé úvodí
        const headStart = findMethodHeadStart(classBody, m.index);
        const head = classBody.slice(headStart, m.index + m[0].length);
        if (/\b(private|protected)\b/i.test(head))
            continue;
        const isStatic = /\bstatic\b/i.test(head);
        const openParen = m.index + m[0].length - 1;
        const sig = parsePhpSignature(classBody, openParen);
        const method = { name, signature: sig };
        if (isStatic)
            method.isStatic = true;
        methods.push(method);
    }
    return methods;
}
function findMethodHeadStart(text, fnPos) {
    // Vrátí pozici, od které začínají modifikátory před `function`.
    // Iteruje zpět přes mezery a klíčová slova viditelnosti/static/final/abstract/readonly.
    const keywords = ['public', 'protected', 'private', 'static', 'final', 'abstract', 'readonly'];
    let start = fnPos;
    while (true) {
        let j = start - 1;
        while (j >= 0 && isMethodHeadSpace(text[j]))
            j--;
        const wordEnd = j + 1;
        while (j >= 0 && isWordChar(text[j]))
            j--;
        const word = text.slice(j + 1, wordEnd);
        if (keywords.includes(word.toLowerCase())) {
            start = j + 1;
            continue;
        }
        break;
    }
    return start;
}
function isMethodHeadSpace(c) {
    return c === ' ' || c === '\t' || c === '\n';
}
function isWordChar(c) {
    if (c === undefined)
        return false;
    return /[A-Za-z_]/.test(c);
}
function parsePhpSignature(stripped, openParenPos) {
    const close = matchParen(stripped, openParenPos);
    const paramsStr = stripped.slice(openParenPos + 1, close);
    const parameters = [];
    for (const raw of splitTopLevelCommas(paramsStr)) {
        const part = raw.trim();
        if (!part)
            continue;
        // [type] [&] [...]$name [= default]
        // Promotion (public/protected/private/readonly) zahodíme — bereme jen jméno/typ.
        const m = /^(?:public\s+|protected\s+|private\s+|readonly\s+)*([?]?[A-Za-z_\\][A-Za-z0-9_\\|&]*)?\s*&?\s*(\.{3})?\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*(=.*)?$/.exec(part);
        if (!m)
            continue;
        const name = m[3];
        if (name === undefined)
            continue;
        const type = m[1];
        const rest = !!m[2];
        const hasDefault = !!m[4];
        const param = { name };
        if (type)
            param.type = type;
        if (rest)
            param.rest = true;
        if (hasDefault)
            param.optional = true;
        parameters.push(param);
    }
    const sig = { parameters };
    const afterClose = stripped.slice(close + 1);
    const ret = /^\s*:\s*([?]?[A-Za-z_\\][A-Za-z0-9_\\|&]*)/.exec(afterClose);
    if (ret && ret[1] !== undefined)
        sig.returnType = ret[1];
    return sig;
}
