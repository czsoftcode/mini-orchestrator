import ts from 'typescript';
/**
 * Z TS/TSX obsahu vyrobí strojovou mapu (exporty, importy, signatury). Žádné
 * fs I/O — volající si soubor přečte sám a předá obsah; testy si tak můžou
 * pohodlně předat fixture string.
 *
 * Parser používá `ts.createSourceFile` (čistě syntaktický průchod, žádný typový
 * resolver) — výsledné typy jsou textové, převzaté z anotací v kódu. To je
 * záměrné: full type checking by stálo řády víc CPU a pro mapu (cíl: dát Claudovi
 * přehled, ne validovat) je naprosto dostačující anotace, kterou tam autor sám
 * napsal.
 *
 * `relPath` se zařadí do `FileGraph.path` v unix-slash tvaru, aby byl graf
 * platformově stabilní (testy, gitové diffy).
 */
export function mapFile(content, relPath) {
    const sourceFile = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true, scriptKindFor(relPath));
    const exports = [];
    const imports = [];
    for (const statement of sourceFile.statements) {
        collectImports(statement, imports);
        collectExports(statement, exports, sourceFile);
    }
    return {
        path: relPath.replace(/\\/g, '/'),
        exports,
        imports,
    };
}
/**
 * Rozsah řádků (1-based) deklarace daného node — kotva pro cílené čtení
 * zdrojáku. `getStart` přeskakuje leading trivia/komentáře, takže `line` ukazuje
 * na první řádek samotné deklarace.
 */
function lineRange(sourceFile, node) {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    return { line, endLine };
}
/**
 * Vybere `ScriptKind` podle přípony. JSX (`.tsx`/`.jsx`) musí parser vědět
 * dopředu, jinak JSX syntaxe selže; čisté JS (`.js`/`.mjs`/`.cjs`) jede jako
 * `JS`, zbytek (`.ts` a spol.) jako `TS`. Syntaktický průchod (`mapFile`) je na
 * typech nezávislý, takže JS/TS rozdíl je tu jen kvůli korektnímu parsování.
 */
function scriptKindFor(relPath) {
    if (relPath.endsWith('.tsx'))
        return ts.ScriptKind.TSX;
    if (relPath.endsWith('.jsx'))
        return ts.ScriptKind.JSX;
    if (relPath.endsWith('.js') || relPath.endsWith('.mjs') || relPath.endsWith('.cjs')) {
        return ts.ScriptKind.JS;
    }
    return ts.ScriptKind.TS;
}
function collectImports(node, out) {
    if (!ts.isImportDeclaration(node))
        return;
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier))
        return;
    const source = moduleSpecifier.text;
    const importClause = node.importClause;
    const typeOnly = importClause?.isTypeOnly === true;
    if (!importClause) {
        out.push({ source, symbols: [] });
        return;
    }
    const symbols = [];
    if (importClause.name) {
        symbols.push('default');
    }
    const bindings = importClause.namedBindings;
    if (bindings) {
        if (ts.isNamespaceImport(bindings)) {
            symbols.push('*');
        }
        else if (ts.isNamedImports(bindings)) {
            for (const element of bindings.elements) {
                symbols.push(element.name.text);
            }
        }
    }
    out.push(typeOnly ? { source, symbols, typeOnly: true } : { source, symbols });
}
function collectExports(node, out, sourceFile) {
    const range = lineRange(sourceFile, node);
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node) && node.name) {
        const isDefault = hasDefaultModifier(node);
        out.push({
            name: isDefault ? (node.name?.text ?? 'default') : node.name.text,
            kind: 'function',
            signature: functionSignature(node),
            ...(isDefault ? { isDefault: true } : {}),
            ...range,
        });
        return;
    }
    if (ts.isClassDeclaration(node) && hasExportModifier(node) && node.name) {
        const isDefault = hasDefaultModifier(node);
        const methods = classMethods(node);
        const info = {
            name: isDefault ? (node.name?.text ?? 'default') : node.name.text,
            kind: 'class',
            ...range,
        };
        if (methods.length > 0)
            info.methods = methods;
        if (isDefault)
            info.isDefault = true;
        out.push(info);
        return;
    }
    if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
        out.push({ name: node.name.text, kind: 'interface', ...range });
        return;
    }
    if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
        out.push({ name: node.name.text, kind: 'type', ...range });
        return;
    }
    if (ts.isEnumDeclaration(node) && hasExportModifier(node)) {
        out.push({ name: node.name.text, kind: 'enum', ...range });
        return;
    }
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
        const isConst = (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
        for (const decl of node.declarationList.declarations) {
            if (!ts.isIdentifier(decl.name))
                continue;
            const exportInfo = variableExport(decl, isConst, lineRange(sourceFile, decl));
            out.push(exportInfo);
        }
        return;
    }
    if (ts.isExportAssignment(node)) {
        // `export default <expr>` nebo `export = <expr>` (CommonJS) — bereme jen
        // default a snažíme se vykoukat identifier z expression.
        if (node.isExportEquals)
            return;
        const name = ts.isIdentifier(node.expression) ? node.expression.text : 'default';
        out.push({ name, kind: 'const', isDefault: true, ...range });
        return;
    }
    if (ts.isExportDeclaration(node)) {
        // `export { foo, bar as baz }` nebo `export * from './x'`
        const clause = node.exportClause;
        if (clause && ts.isNamedExports(clause)) {
            for (const element of clause.elements) {
                out.push({ name: element.name.text, kind: 'const', ...range });
            }
        }
        else if (!clause && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            // `export * from './x'` — pojmenuju to jako re-export, kind 'const' jako fallback
            out.push({ name: `* from "${node.moduleSpecifier.text}"`, kind: 'const', ...range });
        }
    }
}
function variableExport(decl, isConst, range) {
    const name = decl.name.text;
    // const foo = function(...) {...} / arrow → považujeme za function
    if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
        return {
            name,
            kind: 'function',
            signature: functionSignature(decl.initializer),
            ...range,
        };
    }
    return { name, kind: isConst ? 'const' : 'variable', ...range };
}
function functionSignature(node) {
    const parameters = node.parameters.map((p) => {
        const pname = paramName(p.name);
        const param = { name: pname };
        if (p.type)
            param.type = printNode(p.type);
        if (p.questionToken)
            param.optional = true;
        if (p.dotDotDotToken)
            param.rest = true;
        return param;
    });
    const sig = { parameters };
    if (node.type)
        sig.returnType = printNode(node.type);
    return sig;
}
function paramName(node) {
    if (ts.isIdentifier(node))
        return node.text;
    // destructuring patterns — vrátíme placeholder podle tvaru
    if (ts.isObjectBindingPattern(node))
        return '{...}';
    if (ts.isArrayBindingPattern(node))
        return '[...]';
    return '_';
}
function classMethods(node) {
    const result = [];
    for (const member of node.members) {
        if (!ts.isMethodDeclaration(member))
            continue;
        if (!member.name || !ts.isIdentifier(member.name))
            continue;
        if (hasPrivateModifier(member))
            continue;
        const sig = {
            name: member.name.text,
            signature: functionSignature(member),
        };
        if (hasStaticModifier(member))
            sig.isStatic = true;
        result.push(sig);
    }
    return result;
}
function hasModifier(node, kind) {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!mods)
        return false;
    return mods.some((m) => m.kind === kind);
}
function hasExportModifier(node) {
    return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}
function hasDefaultModifier(node) {
    return hasModifier(node, ts.SyntaxKind.DefaultKeyword);
}
function hasStaticModifier(node) {
    return hasModifier(node, ts.SyntaxKind.StaticKeyword);
}
function hasPrivateModifier(node) {
    return hasModifier(node, ts.SyntaxKind.PrivateKeyword);
}
const printer = ts.createPrinter({ removeComments: true, omitTrailingSemicolon: true });
/**
 * Vytiskne typový node do textu, ze kterého se odstraní víceřádkové whitespace.
 * Záměrně přes printer (ne `.getText()`), aby si výstup nesl jen syntaxi, ne
 * originální formátování.
 */
function printNode(node) {
    try {
        const printed = printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
        return printed.replace(/\s+/g, ' ').trim();
    }
    catch {
        return node.getText().replace(/\s+/g, ' ').trim();
    }
}
