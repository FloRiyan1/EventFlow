import type { Model, Project } from './schema';

export type JavaExportStyle = 'record' | 'pojo' | 'lombok';

export interface JavaExportOptions {
  style?: JavaExportStyle;
  packageName?: string;
  useJackson?: boolean;
  includeImports?: boolean;
  classNamePrefix?: string;
  classNameSuffix?: string;
}

/**
 * Maps an EventFlow / Dart / TypeScript type expression into an idiomatic Java type.
 */
export function mapTypeToJava(typeExpr: string, nullable: boolean = false): string {
  if (!typeExpr || typeof typeExpr !== 'string') return 'Object';
  const trimmed = typeExpr.trim().replace(/\?$/, '');
  if (!trimmed) return 'Object';

  // Generics: List<X>, Set<X>, Map<K, V>
  const listMatch = /^List<(.+)>$/.exec(trimmed);
  if (listMatch) {
    const inner = mapTypeToJava(listMatch[1], false);
    return `List<${inner}>`;
  }

  const setMatch = /^Set<(.+)>$/.exec(trimmed);
  if (setMatch) {
    const inner = mapTypeToJava(setMatch[1], false);
    return `Set<${inner}>`;
  }

  const mapMatch = /^Map<(.+?),\s*(.+)>$/.exec(trimmed);
  if (mapMatch) {
    const key = mapTypeToJava(mapMatch[1], false);
    const val = mapTypeToJava(mapMatch[2], false);
    return `Map<${key}, ${val}>`;
  }

  switch (trimmed.toLowerCase()) {
    case 'string':
      return 'String';
    case 'int':
    case 'integer':
      return nullable ? 'Integer' : 'Integer';
    case 'double':
    case 'float':
    case 'num':
      return nullable ? 'Double' : 'Double';
    case 'bool':
    case 'boolean':
      return nullable ? 'Boolean' : 'Boolean';
    case 'datetime':
    case 'date':
      return 'LocalDateTime';
    case 'dynamic':
    case 'any':
    case 'object':
      return 'Object';
    default:
      // Custom model class name
      return trimmed;
  }
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generates Java code for a single EventFlow Model.
 */
export function exportModelToJava(model: Model, options: JavaExportOptions = {}): string {
  const style = options.style ?? 'record';
  const packageName = options.packageName ?? 'com.example.models';
  const useJackson = options.useJackson ?? true;
  const includeImports = options.includeImports ?? true;
  const modelName = model?.name || 'Model';
  const className = `${options.classNamePrefix ?? ''}${modelName}${options.classNameSuffix ?? ''}`;
  const fields = model?.fields || [];

  const hasList = fields.some((f) => (f?.type || '').startsWith('List<'));
  const hasSet = fields.some((f) => (f?.type || '').startsWith('Set<'));
  const hasMap = fields.some((f) => (f?.type || '').startsWith('Map<'));
  const hasDate = fields.some((f) => /date/i.test(f?.type || ''));

  const imports: string[] = [];
  if (hasList) imports.push('import java.util.List;');
  if (hasSet) imports.push('import java.util.Set;');
  if (hasMap) imports.push('import java.util.Map;');
  if (hasDate) imports.push('import java.time.LocalDateTime;');

  if (useJackson) {
    imports.push('import com.fasterxml.jackson.annotation.JsonProperty;');
    imports.push('import com.fasterxml.jackson.annotation.JsonIgnoreProperties;');
  }

  if (style === 'pojo') {
    imports.push('import java.util.Objects;');
  } else if (style === 'lombok') {
    imports.push('import lombok.Data;');
    imports.push('import lombok.Builder;');
    imports.push('import lombok.NoArgsConstructor;');
    imports.push('import lombok.AllArgsConstructor;');
  }

  const importBlock = includeImports && imports.length > 0 ? imports.sort().join('\n') + '\n\n' : '';
  const packageBlock = packageName ? `package ${packageName};\n\n` : '';

  if (style === 'record') {
    const params = model.fields.map((f) => {
      const javaType = mapTypeToJava(f.type, f.nullable);
      const annotation = useJackson ? `@JsonProperty("${f.name}") ` : '';
      return `    ${annotation}${javaType} ${f.name}`;
    });

    const classAnnotations = useJackson ? '@JsonIgnoreProperties(ignoreUnknown = true)\n' : '';

    return `${packageBlock}${importBlock}${classAnnotations}public record ${className}(\n${params.join(',\n')}\n) {}`;
  }

  if (style === 'lombok') {
    const fieldLines = model.fields.map((f) => {
      const javaType = mapTypeToJava(f.type, f.nullable);
      const annotation = useJackson ? `    @JsonProperty("${f.name}")\n` : '';
      return `${annotation}    private ${javaType} ${f.name};`;
    });

    const lombokAnnotations = [
      '@Data',
      '@Builder',
      '@NoArgsConstructor',
      '@AllArgsConstructor',
      ...(useJackson ? ['@JsonIgnoreProperties(ignoreUnknown = true)'] : []),
    ].join('\n');

    return `${packageBlock}${importBlock}${lombokAnnotations}\npublic class ${className} {\n${fieldLines.join('\n\n')}\n}`;
  }

  // Default: Standard POJO (JavaBean)
  const fieldDecls = model.fields.map((f) => {
    const javaType = mapTypeToJava(f.type, f.nullable);
    const annotation = useJackson ? `    @JsonProperty("${f.name}")\n` : '';
    return `${annotation}    private ${javaType} ${f.name};`;
  });

  const ctorParams = model.fields
    .map((f) => `${mapTypeToJava(f.type, f.nullable)} ${f.name}`)
    .join(', ');

  const ctorAssignments = model.fields
    .map((f) => `        this.${f.name} = ${f.name};`)
    .join('\n');

  const gettersAndSetters = model.fields
    .map((f) => {
      const javaType = mapTypeToJava(f.type, f.nullable);
      const cap = capitalize(f.name);
      return `    public ${javaType} get${cap}() {\n        return ${f.name};\n    }\n\n    public void set${cap}(${javaType} ${f.name}) {\n        this.${f.name} = ${f.name};\n    }`;
    })
    .join('\n\n');

  const equalsFields = model.fields
    .map((f) => `Objects.equals(${f.name}, other.${f.name})`)
    .join(' &&\n               ');

  const hashFields = model.fields.map((f) => f.name).join(', ');

  const toStringFields = model.fields
    .map((f) => `"${f.name}=" + ${f.name}`)
    .join(' + ", " + ');

  const classAnnotations = useJackson ? '@JsonIgnoreProperties(ignoreUnknown = true)\n' : '';

  return `${packageBlock}${importBlock}${classAnnotations}public class ${className} {
${fieldDecls.join('\n\n')}

    public ${className}() {
    }

    public ${className}(${ctorParams}) {
${ctorAssignments}
    }

${gettersAndSetters}

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${className} other = (${className}) o;
        return ${equalsFields || 'true'};
    }

    @Override
    public int hashCode() {
        return Objects.hash(${hashFields});
    }

    @Override
    public String toString() {
        return "${className}{" +
               ${toStringFields ? toStringFields + ' +' : '"" +'}
               '}';
    }
}`;
}

/**
 * Exports all Models in a project to a single multi-class Java file or string representation.
 */
export function exportAllModelsToJava(project: Project, options: JavaExportOptions = {}): string {
  const models = project?.models || [];
  const packageName = options.packageName ?? 'com.example.models';
  const projectName = project?.name || 'Project';
  const header = `// Generated by EventFlow\n// Project: ${projectName}\n// Models: ${models.length}\n\n`;

  const parts = models.map((m) =>
    exportModelToJava(m, {
      ...options,
      packageName: '', // omit redundant package in each block when combined
      includeImports: false,
    })
  );

  const hasList = models.some((m) => (m?.fields || []).some((f) => (f?.type || '').startsWith('List<')));
  const hasSet = models.some((m) => (m?.fields || []).some((f) => (f?.type || '').startsWith('Set<')));
  const hasMap = models.some((m) => (m?.fields || []).some((f) => (f?.type || '').startsWith('Map<')));
  const hasDate = models.some((m) => (m?.fields || []).some((f) => /date/i.test(f?.type || '')));

  const imports: string[] = [];
  if (hasList) imports.push('import java.util.List;');
  if (hasSet) imports.push('import java.util.Set;');
  if (hasMap) imports.push('import java.util.Map;');
  if (hasDate) imports.push('import java.time.LocalDateTime;');

  const useJackson = options.useJackson ?? true;
  if (useJackson) {
    imports.push('import com.fasterxml.jackson.annotation.JsonProperty;');
    imports.push('import com.fasterxml.jackson.annotation.JsonIgnoreProperties;');
  }

  if (options.style === 'pojo') {
    imports.push('import java.util.Objects;');
  } else if (options.style === 'lombok') {
    imports.push('import lombok.Data;');
    imports.push('import lombok.Builder;');
    imports.push('import lombok.NoArgsConstructor;');
    imports.push('import lombok.AllArgsConstructor;');
  }

  const pkgLine = packageName ? `package ${packageName};\n\n` : '';
  const importLines = imports.length > 0 ? imports.sort().join('\n') + '\n\n' : '';

  return `${header}${pkgLine}${importLines}${parts.join('\n\n')}\n`;
}
