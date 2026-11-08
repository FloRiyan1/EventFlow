import { uid } from './ids';
import { createModel } from './factory';
import type { Field, Model, Project } from './schema';

export interface ParsedJavaField {
  name: string;
  type: string;
  nullable: boolean;
  rawJavaType: string;
  jsonName?: string;
}

export interface ParsedJavaModel {
  name: string;
  kind: 'record' | 'class';
  isAbstract?: boolean;
  extendsModelName?: string;
  fields: ParsedJavaField[];
  packageName?: string;
  rawText?: string;
}

export interface JavaParseResult {
  packageName?: string;
  models: ParsedJavaModel[];
  errors: string[];
}

export interface JavaImportOptions {
  /** If true, existing models with the same name will be updated with new fields instead of skipped or duplicated. Defaults to true. */
  mergeExisting?: boolean;
  /** If true, creates empty placeholder models for referenced sub-models that do not exist yet. Defaults to true. */
  createReferencedModels?: boolean;
}

export interface JavaImportResult {
  importedModels: Model[];
  createdCount: number;
  updatedCount: number;
  referencedCreatedCount: number;
  errors: string[];
}

/**
 * Strips comments from Java source code while preserving string literals.
 */
function stripComments(source: string): string {
  let result = '';
  let inBlockComment = false;
  let inLineComment = false;
  let inString = false;
  let inChar = false;
  let escape = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = i + 1 < source.length ? source[i + 1] : '';

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++; // skip /
      }
      continue;
    }

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += '\n';
      }
      continue;
    }

    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (inChar) {
      result += ch;
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === "'") {
        inChar = false;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    if (ch === "'") {
      inChar = true;
      result += ch;
      continue;
    }

    result += ch;
  }

  return result;
}

/**
 * Normalizes a Java type into an EventFlow type representation.
 * E.g.:
 * - `Integer` -> `int`
 * - `Double` / `BigDecimal` -> `double`
 * - `Boolean` / `boolean` -> `bool`
 * - `List<Customer>` -> `List<Customer>`
 * - `Map<String, Object>` -> `Map<String, dynamic>`
 */
export function normalizeJavaType(rawType: string): { type: string; isPrimitive: boolean } {
  let t = rawType.trim();

  // Strip annotations inside type (e.g., `@NonNull String`)
  t = t.replace(/@[A-Za-z0-9_.]+(\s*\([^)]*\))?\s*/g, '').trim();

  // Generics handling: List<X>, Set<X>, Collection<X>, ArrayList<X>
  const collectionMatch = /^(?:List|ArrayList|LinkedList|Collection|Set|HashSet|TreeSet)<(.+)>$/.exec(t);
  if (collectionMatch) {
    const inner = normalizeJavaType(collectionMatch[1]).type;
    return { type: `List<${inner}>`, isPrimitive: false };
  }

  const mapMatch = /^(?:Map|HashMap|LinkedHashMap|TreeMap)<(.+?),\s*(.+)>$/.exec(t);
  if (mapMatch) {
    const key = normalizeJavaType(mapMatch[1]).type;
    const val = normalizeJavaType(mapMatch[2]).type;
    return { type: `Map<${key}, ${val}>`, isPrimitive: false };
  }

  switch (t) {
    case 'int':
      return { type: 'int', isPrimitive: true };
    case 'Integer':
    case 'long':
    case 'Long':
    case 'short':
    case 'Short':
    case 'byte':
    case 'Byte':
      return { type: 'int', isPrimitive: false };

    case 'double':
      return { type: 'double', isPrimitive: true };
    case 'Double':
    case 'float':
    case 'Float':
    case 'BigDecimal':
      return { type: 'double', isPrimitive: false };

    case 'boolean':
      return { type: 'bool', isPrimitive: true };
    case 'Boolean':
      return { type: 'bool', isPrimitive: false };

    case 'String':
    case 'CharSequence':
      return { type: 'String', isPrimitive: false };

    case 'LocalDateTime':
    case 'LocalDate':
    case 'Instant':
    case 'Date':
    case 'OffsetDateTime':
    case 'ZonedDateTime':
      return { type: 'DateTime', isPrimitive: false };

    case 'Object':
    case 'JsonNode':
      return { type: 'dynamic', isPrimitive: false };

    default:
      return { type: t, isPrimitive: false };
  }
}

/**
 * Extracts `@JsonProperty("name")` if present.
 */
function extractJsonProperty(annotations: string): string | undefined {
  const match = /@JsonProperty\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/.exec(annotations);
  return match ? match[1] : undefined;
}

/**
 * Determines nullability based on annotations and primitive nature.
 */
function isNullable(annotations: string, isPrimitive: boolean): boolean {
  if (isPrimitive) return false;
  if (/@(NotNull|NonNull|Nonnull|NotBlank|NotEmpty)\b/i.test(annotations)) {
    return false;
  }
  if (/@Nullable\b/i.test(annotations)) {
    return true;
  }
  // For Java objects, nullability is true by default unless annotated @NotNull
  return true;
}

/**
 * Parses parameters inside record parens: `record Name(param1, param2, ...)`.
 */
function parseRecordParameters(paramsStr: string): ParsedJavaField[] {
  const fields: ParsedJavaField[] = [];
  if (!paramsStr.trim()) return fields;

  // Split on commas not inside angle brackets or parentheses
  const tokens: string[] = [];
  let depthAngle = 0;
  let depthParen = 0;
  let current = '';

  for (let i = 0; i < paramsStr.length; i++) {
    const ch = paramsStr[i];
    if (ch === '<') depthAngle++;
    else if (ch === '>') depthAngle = Math.max(0, depthAngle - 1);
    else if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);

    if (ch === ',' && depthAngle === 0 && depthParen === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  for (const token of tokens) {
    // Each token can be: `@JsonProperty("foo") @Nullable String foo`
    // Extract annotations
    const annoMatches = token.match(/@[A-Za-z0-9_.]+(\s*\([^)]*\))?/g) || [];
    const annotations = annoMatches.join(' ');
    const stripped = token.replace(/@[A-Za-z0-9_.]+(\s*\([^)]*\))?/g, '').trim();

    // The remaining text is `Type name`
    const lastSpace = stripped.lastIndexOf(' ');
    if (lastSpace <= 0) continue;

    const rawType = stripped.slice(0, lastSpace).trim();
    const name = stripped.slice(lastSpace + 1).trim();

    const { type, isPrimitive } = normalizeJavaType(rawType);
    const jsonName = extractJsonProperty(annotations);
    const nullable = isNullable(annotations, isPrimitive);

    fields.push({
      name,
      type,
      nullable,
      rawJavaType: rawType,
      jsonName,
    });
  }

  return fields;
}

/**
 * Parses fields from inside a Java class body.
 */
function parseClassFields(bodyStr: string): ParsedJavaField[] {
  const fields: ParsedJavaField[] = [];

  // Match statements ending in semicolon
  // Ignore methods (which contain '(' before '{' or '=')
  const lines = bodyStr.split(';');

  for (const rawStmt of lines) {
    const stmt = rawStmt.trim();
    if (!stmt) continue;

    // If it has '(' before any assignment '=', it's a method or constructor declaration
    const openParen = stmt.indexOf('(');
    const eq = stmt.indexOf('=');
    if (openParen !== -1 && (eq === -1 || openParen < eq)) {
      continue;
    }

    // Strip default initializer (e.g., `= new ArrayList<>()` or `= 10`)
    const declPart = eq !== -1 ? stmt.slice(0, eq).trim() : stmt;

    // Check annotations
    const annoMatches = declPart.match(/@[A-Za-z0-9_.]+(\s*\([^)]*\))?/g) || [];
    const annotations = annoMatches.join(' ');
    let withoutAnnos = declPart.replace(/@[A-Za-z0-9_.]+(\s*\([^)]*\))?/g, '').trim();

    // Strip modifiers: public, private, protected, static, final, transient, volatile
    // But if static final, it might be a constant: e.g. serialVersionUID
    if (/\bstatic\s+final\b/.test(withoutAnnos)) {
      continue; // Skip static constants like serialVersionUID
    }

    withoutAnnos = withoutAnnos
      .replace(/\b(public|private|protected|transient|volatile|final)\b/g, '')
      .trim();

    // Now we should have: `Type fieldName`
    const lastSpace = withoutAnnos.lastIndexOf(' ');
    if (lastSpace <= 0) continue;

    const rawType = withoutAnnos.slice(0, lastSpace).trim();
    const name = withoutAnnos.slice(lastSpace + 1).trim();

    // Filter out invalid names or keywords
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) continue;
    if (['class', 'interface', 'enum', 'record', 'void'].includes(rawType)) continue;

    const { type, isPrimitive } = normalizeJavaType(rawType);
    const jsonName = extractJsonProperty(annotations);
    const nullable = isNullable(annotations, isPrimitive);

    fields.push({
      name,
      type,
      nullable,
      rawJavaType: rawType,
      jsonName,
    });
  }

  return fields;
}

/**
 * Parses arbitrary Java code and returns all recognized models (Classes and Records).
 */
export function parseJavaCode(source: string): JavaParseResult {
  const clean = stripComments(source);
  const models: ParsedJavaModel[] = [];
  const errors: string[] = [];

  // 1. Extract package if present
  const pkgMatch = /package\s+([a-zA-Z0-9_.]+)\s*;/.exec(clean);
  const packageName = pkgMatch ? pkgMatch[1] : undefined;

  // 2. Find all records and classes
  // We scan using regex with balanced brace matching for class/record bodies.
  const declRegex = /\b(?:(abstract)\s+)?(?:(?:public|protected|private|final)\s+)*(?:(abstract)\s+)?(record|class)\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+)(?:<[^>]+>)?)?/g;
  let match: RegExpExecArray | null;

  while ((match = declRegex.exec(clean)) !== null) {
    const isAbstract = match[1] === 'abstract' || match[2] === 'abstract';
    const kind = match[3] as 'record' | 'class';
    const name = match[4];
    const extendsModelName = match[5];
    const startIndex = match.index;

    if (kind === 'record') {
      // Find the parameter list in parentheses: `record Name(...)`
      const parenStart = clean.indexOf('(', startIndex);
      if (parenStart === -1) continue;

      let depth = 1;
      let parenEnd = -1;
      for (let i = parenStart + 1; i < clean.length; i++) {
        if (clean[i] === '(') depth++;
        else if (clean[i] === ')') {
          depth--;
          if (depth === 0) {
            parenEnd = i;
            break;
          }
        }
      }

      if (parenEnd === -1) {
        errors.push(`Unvollständiger Record-Header für: ${name}`);
        continue;
      }

      const paramsStr = clean.slice(parenStart + 1, parenEnd);
      const fields = parseRecordParameters(paramsStr);

      models.push({
        name,
        kind: 'record',
        isAbstract,
        extendsModelName,
        fields,
        packageName,
      });
    } else if (kind === 'class') {
      // Find opening brace '{' of the class body
      const braceStart = clean.indexOf('{', startIndex);
      if (braceStart === -1) continue;

      let depth = 1;
      let braceEnd = -1;
      for (let i = braceStart + 1; i < clean.length; i++) {
        if (clean[i] === '{') depth++;
        else if (clean[i] === '}') {
          depth--;
          if (depth === 0) {
            braceEnd = i;
            break;
          }
        }
      }

      if (braceEnd === -1) {
        errors.push(`Unvollständiger Klassen-Body für: ${name}`);
        continue;
      }

      const bodyStr = clean.slice(braceStart + 1, braceEnd);
      const fields = parseClassFields(bodyStr);

      models.push({
        name,
        kind: 'class',
        isAbstract,
        extendsModelName,
        fields,
        packageName,
      });
    }
  }

  return {
    packageName,
    models,
    errors,
  };
}

/**
 * Imports parsed Java models into an EventFlow Project.
 */
export function importJavaIntoProject(
  project: Project,
  sourceCode: string,
  options: JavaImportOptions = {}
): JavaImportResult {
  const mergeExisting = options.mergeExisting ?? true;
  const createReferencedModels = options.createReferencedModels ?? true;

  const parseResult = parseJavaCode(sourceCode);
  const importedModels: Model[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let referencedCreatedCount = 0;

  for (const parsed of parseResult.models) {
    const existingIndex = project.models.findIndex((m) => m.name === parsed.name);

    const convertedFields: Field[] = parsed.fields.map((f) => ({
      id: uid('f_'),
      name: f.name,
      type: f.type,
      nullable: f.nullable,
    }));

    if (existingIndex !== -1) {
      if (mergeExisting) {
        // Merge or replace fields
        const existing = project.models[existingIndex];
        if (parsed.isAbstract !== undefined) {
          existing.isAbstract = parsed.isAbstract;
        }

        for (const cf of convertedFields) {
          const idx = existing.fields.findIndex((f) => f.name === cf.name);
          if (idx !== -1) {
            existing.fields[idx].type = cf.type;
            existing.fields[idx].nullable = cf.nullable;
          } else {
            existing.fields.push(cf);
          }
        }
        importedModels.push(existing);
        updatedCount++;
      } else {
        // Create duplicate with suffix
        const newModel = createModel(`${parsed.name}_Imported`, convertedFields, undefined, parsed.isAbstract ?? false);
        project.models.push(newModel);
        importedModels.push(newModel);
        createdCount++;
      }
    } else {
      const newModel = createModel(parsed.name, convertedFields, undefined, parsed.isAbstract ?? false);
      project.models.push(newModel);
      importedModels.push(newModel);
      createdCount++;
    }
  }

  // Resolve inheritance (extends)
  for (const parsed of parseResult.models) {
    if (parsed.extendsModelName) {
      let parentModel = project.models.find((m) => m.name === parsed.extendsModelName);
      if (!parentModel && createReferencedModels) {
        parentModel = createModel(parsed.extendsModelName, [], undefined, true);
        project.models.push(parentModel);
        referencedCreatedCount++;
      }
      if (parentModel) {
        const childModel = project.models.find((m) => m.name === parsed.name);
        if (childModel && childModel.id !== parentModel.id) {
          childModel.extendsModelId = parentModel.id;
        }
      }
    }
  }

  // Auto-create referenced sub-models if option is active
  if (createReferencedModels) {
    const existingNames = new Set(project.models.map((m) => m.name));
    const toCreate = new Set<string>();

    for (const m of importedModels) {
      for (const f of m.fields) {
        // Check for referenced models: e.g. `List<SubModel>` or `SubModel`
        const match = f.type.match(/\b([A-Z][a-zA-Z0-9_]*)\b/g);
        if (match) {
          for (const typeName of match) {
            if (
              !['String', 'Integer', 'Double', 'Boolean', 'DateTime', 'List', 'Set', 'Map'].includes(typeName) &&
              !existingNames.has(typeName)
            ) {
              toCreate.add(typeName);
            }
          }
        }
      }
    }

    for (const missingName of toCreate) {
      project.models.push(createModel(missingName));
      existingNames.add(missingName);
      referencedCreatedCount++;
    }
  }

  return {
    importedModels,
    createdCount,
    updatedCount,
    referencedCreatedCount,
    errors: parseResult.errors,
  };
}
