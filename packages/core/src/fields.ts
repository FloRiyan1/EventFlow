import { uid } from './ids';
import type { Field } from './schema';

/**
 * Parsing and formatting of the compact field notation used in the flows, e.g.
 *
 *   String uuid
 *   String? nummer
 *   List<TaetigkeitKriterienRESTModel> kriterien
 *   +int page            (leading "+" marks a required parameter)
 *   name?: string        (TypeScript style is accepted as well)
 */

export interface ParsedField {
  name: string;
  type: string;
  nullable: boolean;
}

const MODIFIERS = new Set([
  'final', 'late', 'required', 'private', 'public', 'protected', 'static', 'readonly', 'const', 'var', 'val',
]);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Built-in / library types that are never treated as references to project models. */
export const PRIMITIVE_TYPES = new Set([
  // Dart
  'String', 'int', 'double', 'bool', 'num', 'dynamic', 'void', 'Object', 'DateTime', 'Duration',
  'List', 'Map', 'Set', 'Iterable', 'Future', 'Stream', 'Uint8List', 'Null', 'Never',
  // Java / Kotlin
  'Integer', 'Long', 'Float', 'Double', 'Boolean', 'Short', 'Byte', 'Character', 'Char', 'BigDecimal',
  'BigInteger', 'LocalDate', 'LocalDateTime', 'LocalTime', 'Instant', 'ZonedDateTime', 'OffsetDateTime',
  'UUID', 'Optional', 'Collection', 'ArrayList', 'HashMap', 'Any', 'Unit', 'Int',
  // TypeScript / JSON
  'string', 'number', 'boolean', 'any', 'unknown', 'object', 'Date', 'Array', 'Record', 'null', 'undefined',
]);

export function parseFieldLine(line: string): ParsedField | null {
  let s = line.replace(/\/\/.*$/, '').trim().replace(/[;,]$/, '').trim();
  if (!s) return null;

  let required = false;
  if (s.startsWith('+')) {
    required = true;
    s = s.slice(1).trim();
  }

  // TypeScript style: `name?: Type`
  const ts = /^([A-Za-z_$][\w$]*)(\?)?\s*:\s*(.+)$/.exec(s);
  if (ts) {
    let type = ts[3].trim();
    let nullable = Boolean(ts[2]);
    const withoutNull = type.replace(/\s*\|\s*(null|undefined)\b/g, '').trim();
    if (withoutNull !== type) {
      nullable = true;
      type = withoutNull;
    }
    return { name: ts[1], type, nullable: required ? false : nullable };
  }

  const idx = s.search(/\s[^\s]*$/);
  if (idx < 0) return null;
  const name = s.slice(idx + 1).trim();
  if (!IDENTIFIER.test(name)) return null;

  const words = s.slice(0, idx).trim().split(/\s+/);
  while (words.length > 1 && MODIFIERS.has(words[0])) words.shift();
  let type = words.join(' ').trim();
  if (!type) return null;

  let nullable = false;
  if (type.endsWith('?')) {
    nullable = true;
    type = type.slice(0, -1).trim();
  }
  return { name, type, nullable: required ? false : nullable };
}

export function parseFieldsText(text: string): ParsedField[] {
  return text
    .split(/\r?\n/)
    .map(parseFieldLine)
    .filter((f): f is ParsedField => f !== null);
}

/**
 * Converts text into fields. Ids of previous fields with the same name are kept,
 * so references and edges stay stable when a user edits the text.
 */
export function fieldsFromText(text: string, previous: Field[] = []): Field[] {
  const byName = new Map(previous.map((f) => [f.name, f]));
  return parseFieldsText(text).map((p) => ({
    id: byName.get(p.name)?.id ?? uid('f_'),
    name: p.name,
    type: p.type,
    nullable: p.nullable,
  }));
}

export function formatField(f: Pick<Field, 'name' | 'type' | 'nullable'>): string {
  return `${f.type}${f.nullable ? '?' : ''} ${f.name}`;
}

/** Endpoint parameters: required parameters are prefixed with "+" like in the existing diagrams. */
export function formatParam(f: Pick<Field, 'name' | 'type' | 'nullable'>): string {
  return `${f.nullable ? '' : '+'}${formatField(f)}`;
}

export function fieldsToText(fields: Field[], mode: 'model' | 'params' = 'model'): string {
  return fields.map(mode === 'params' ? formatParam : formatField).join('\n');
}

/** Returns all identifiers in a type expression that are not built-in types. */
export function referencedTypeNames(type: string): string[] {
  const names = type.match(/[A-Za-z_$][\w$]*/g) ?? [];
  return [...new Set(names.filter((n) => !PRIMITIVE_TYPES.has(n)))];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Renames a type inside a type expression, e.g. `List<A>` -> `List<B>`. */
export function renameTypeInExpr(type: string, oldName: string, newName: string): string {
  return type.replace(new RegExp(`(?<![\\w$])${escapeRegExp(oldName)}(?![\\w$])`, 'g'), newName);
}
