/**
 * Type declarations for js-yaml
 * js-yamlは型定義が提供されていない場合の基本的な型定義
 */

declare module 'js-yaml' {
  export interface LoadOptions {
    filename?: string;
    onWarning?: (warning: Error) => void;
    schema?: Schema;
    json?: boolean;
  }

  export interface DumpOptions {
    indent?: number;
    noArrayIndent?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
    styles?: Record<string, unknown>;
    schema?: Schema;
    sortKeys?: boolean | ((a: unknown, b: unknown) => number);
    lineWidth?: number;
    noRefs?: boolean;
    noCompatMode?: boolean;
    condenseFlow?: boolean;
    quotingType?: '"' | "'";
    forceQuotes?: boolean;
  }

  export interface Schema {
    extend(types: Type[]): Schema;
  }

  export interface Type {
    constructor: (tag: string, options?: Record<string, unknown>) => Type;
  }

  export function load(str: string, options?: LoadOptions): unknown;
  export function loadAll(str: string, iterator?: (doc: unknown) => void, options?: LoadOptions): unknown;
  export function safeLoad(str: string, options?: LoadOptions): unknown;
  export function safeLoadAll(str: string, iterator?: (doc: unknown) => void, options?: LoadOptions): unknown;
  
  export function dump(obj: unknown, options?: DumpOptions): string;
  export function safeDump(obj: unknown, options?: DumpOptions): string;

  export const DEFAULT_SAFE_SCHEMA: Schema;
  export const DEFAULT_FULL_SCHEMA: Schema;
  export const FAILSAFE_SCHEMA: Schema;
  export const JSON_SCHEMA: Schema;
  export const CORE_SCHEMA: Schema;
}