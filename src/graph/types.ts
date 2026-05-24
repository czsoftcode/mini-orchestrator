/**
 * Typ exportovaného symbolu. `variable` pokrývá `export const/let/var`;
 * `const` je samostatný kind jen kvůli stávajícím konvencím.
 */
export type ExportKind =
  | 'function'
  | 'class'
  | 'type'
  | 'const'
  | 'interface'
  | 'enum'
  | 'variable'
  | 'struct'
  | 'trait';

export interface Parameter {
  name: string;
  type?: string;
  optional?: boolean;
  rest?: boolean;
}

export interface FunctionSignature {
  parameters: Parameter[];
  returnType?: string;
}

export interface MethodSignature {
  name: string;
  signature: FunctionSignature;
  isStatic?: boolean;
}

export interface ExportInfo {
  name: string;
  kind: ExportKind;
  /** Signatura pro `function` exporty. */
  signature?: FunctionSignature;
  /** Veřejné metody pro `class` export. */
  methods?: MethodSignature[];
  /** True pro `export default ...` formy. */
  isDefault?: boolean;
}

export interface ImportInfo {
  /** Modulový specifier (`'./foo'`, `'commander'`, ...) tak jak je v kódu. */
  source: string;
  /**
   * Importované symboly. Speciální hodnoty:
   *  - `'*'` — namespace import (`import * as foo`)
   *  - `'default'` — default import (`import foo from`)
   * Side-effect import (`import './x'`) má prázdné pole.
   */
  symbols: string[];
  /** True pro `import type ...`. */
  typeOnly?: boolean;
}

export interface FileGraph {
  /** Cesta relativní ke kořeni projektu, vždy s `/` jako separátorem. */
  path: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
}
