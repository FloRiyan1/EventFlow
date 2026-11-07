import type { Board, Model, Project, ScreenNode, EndpointNode, ModelNode } from './schema';
import { findTrigger, triggerLabel } from './ops';
import { referencedTypeNames } from './fields';

/**
 * Sanitizes an ID to be a safe PlantUML identifier.
 */
function toPlantUmlId(id: string): string {
  return 'node_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Escapes characters for PlantUML strings and notes.
 */
function escapePuml(str: string): string {
  return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n');
}

/**
 * Exports a single Flow Board as a PlantUML architecture / component diagram.
 */
export function exportBoardToPlantUml(project: Project, board: Board): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push(`title EventFlow - ${escapePuml(board.name)}`);
  lines.push('');
  lines.push('skinparam roundcorner 10');
  lines.push('skinparam shadowing false');
  lines.push('skinparam defaultFontName Arial');
  lines.push('skinparam ArrowColor #2563EB');
  lines.push('skinparam ArrowThickness 1.5');
  lines.push('skinparam classAttributeIconSize 0');
  lines.push('');

  // 1. Render nodes
  for (const node of board.nodes) {
    const alias = toPlantUmlId(node.id);

    switch (node.kind) {
      case 'screen': {
        const screen = node as ScreenNode;
        const title = escapePuml(screen.title || 'Screen');
        const hotspotLines = (screen.hotspots || []).map((h) => {
          const triggers = h.triggers?.map((t) => t.event).join(', ') || 'onTap';
          return `• ${escapePuml(h.label || 'Hotspot')} (${triggers})`;
        });

        if (hotspotLines.length > 0) {
          lines.push(`rectangle "<b>Screen</b>\\n${title}\\n..\\nHotspots:\\n${hotspotLines.join('\\n')}" as ${alias} #FEF3C7`);
        } else {
          lines.push(`rectangle "<b>Screen</b>\\n${title}" as ${alias} #FEF3C7`);
        }
        break;
      }

      case 'userAction': {
        const label = escapePuml(node.label || 'User Action');
        lines.push(`rectangle "<b>Action</b>\\n${label}" as ${alias} #FEF9C3`);
        break;
      }

      case 'endpoint': {
        const epNode = node as EndpointNode;
        const ep = project.endpoints.find((e) => e.id === epNode.endpointId);
        const method = ep?.method || 'POST';
        const path = escapePuml(ep?.path || '/api');
        const params = (ep?.params || []).map((p) => `• ${p.name}: ${p.type}${p.nullable ? '?' : ''}`);

        if (params.length > 0) {
          lines.push(`rectangle "<b>API: ${method}</b>\\n${path}\\n..\\nParams:\\n${params.map(escapePuml).join('\\n')}" as ${alias} #E0F2FE`);
        } else {
          lines.push(`rectangle "<b>API: ${method}</b>\\n${path}" as ${alias} #E0F2FE`);
        }
        break;
      }

      case 'model': {
        const mNode = node as ModelNode;
        const model = project.models.find((m) => m.id === mNode.modelId);
        const name = escapePuml(model?.name || 'Model');
        const fields = (model?.fields || []).map(
          (field) => `• ${escapePuml(field.name)}: ${escapePuml(field.type)}${field.nullable ? '?' : ''}`
        );

        if (fields.length > 0) {
          lines.push(
            `rectangle "<b>Model: ${name}</b>\\n..\\nFields:\\n${fields.join('\\n')}" as ${alias} #FFF7ED`
          );
        } else {
          lines.push(`rectangle "<b>Model: ${name}</b>" as ${alias} #FFF7ED`);
        }
        break;
      }

      case 'flowRef': {
        const targetBoard = project.boards.find((b) => b.id === node.targetBoardId);
        const flowName = escapePuml(node.label || targetBoard?.name || 'Flow');
        lines.push(`rectangle "<b>Sub-Flow</b>\\n${flowName}" as ${alias} #F3E8FF`);
        break;
      }

      case 'note': {
        const noteText = (node.text || 'Notiz').split('\n').map((l) => escapePuml(l)).join('\n');
        lines.push(`note as ${alias}`);
        lines.push(noteText);
        lines.push('end note');
        break;
      }
    }
  }

  lines.push('');

  // 2. Render edges / connections
  for (const edge of board.edges) {
    const sAlias = toPlantUmlId(edge.source);
    const tAlias = toPlantUmlId(edge.target);

    let edgeLabel = edge.label || '';

    // If source handle is a trigger on a hotspot
    if (!edgeLabel && edge.sourceHandle?.startsWith('t:')) {
      const tr = findTrigger(board, edge.sourceHandle);
      if (tr) {
        edgeLabel = triggerLabel(tr);
      }
    }

    // Default semantic labels if empty
    if (!edgeLabel) {
      const sourceNode = board.nodes.find((n) => n.id === edge.source);
      const targetNode = board.nodes.find((n) => n.id === edge.target);

      if (sourceNode?.kind === 'screen' && targetNode?.kind === 'endpoint') {
        edgeLabel = 'calls API';
      } else if (sourceNode?.kind === 'userAction' && targetNode?.kind === 'endpoint') {
        edgeLabel = 'triggers';
      } else if (sourceNode?.kind === 'endpoint' && targetNode?.kind === 'model') {
        edgeLabel = 'response';
      } else if (sourceNode?.kind === 'screen' && targetNode?.kind === 'screen') {
        edgeLabel = 'navigates to';
      }
    }

    const labelPart = edgeLabel ? ` : ${escapePuml(edgeLabel)}` : '';
    lines.push(`${sAlias} --> ${tAlias}${labelPart}`);
  }

  lines.push('');
  lines.push('@enduml');
  return lines.join('\n');
}

/**
 * Exports all Models of a project as a PlantUML Class Diagram with relationships.
 */
export function exportModelsToPlantUml(project: Project): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push(`title ${escapePuml(project.name)} - Datenmodelle (Class Diagram)`);
  lines.push('');
  lines.push('skinparam classAttributeIconSize 0');
  lines.push('skinparam roundcorner 8');
  lines.push('skinparam shadowing false');
  lines.push('skinparam defaultFontName Arial');
  lines.push('');

  const modelMap = new Map<string, Model>();
  for (const m of project.models) {
    modelMap.set(m.name, m);
  }

  // Define classes
  for (const model of project.models) {
    const alias = toPlantUmlId(model.id);
    lines.push(`class "${escapePuml(model.name)}" as ${alias} #FFF7ED {`);
    for (const f of model.fields) {
      lines.push(`  +${escapePuml(f.name)}: ${escapePuml(f.type)}${f.nullable ? '?' : ''}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Draw relationships between models
  const renderedRelations = new Set<string>();
  for (const model of project.models) {
    const sAlias = toPlantUmlId(model.id);
    for (const f of model.fields) {
      const referencedNames = referencedTypeNames(f.type);
      for (const targetName of referencedNames) {
        const targetModel = modelMap.get(targetName);
        if (targetModel) {
          const tAlias = toPlantUmlId(targetModel.id);
          const isList = f.type.toLowerCase().includes('list<') || f.type.includes('[]');
          const relKey = `${model.name}->${targetName}:${f.name}`;
          if (!renderedRelations.has(relKey)) {
            renderedRelations.add(relKey);
            if (isList) {
              lines.push(`${sAlias} "1" *-- "*" ${tAlias} : ${escapePuml(f.name)}`);
            } else {
              lines.push(`${sAlias} --> ${tAlias} : ${escapePuml(f.name)}`);
            }
          }
        }
      }
    }
  }

  lines.push('');
  lines.push('@enduml');
  return lines.join('\n');
}

/**
 * Exports all boards in a project into a comprehensive PlantUML diagram.
 */
export function exportProjectToPlantUml(project: Project): string {
  const lines: string[] = [];

  lines.push('@startuml');
  lines.push(`title Projekt: ${escapePuml(project.name)} (Gesamtübersicht)`);
  lines.push('');
  lines.push('skinparam roundcorner 10');
  lines.push('skinparam shadowing false');
  lines.push('skinparam defaultFontName Arial');
  lines.push('skinparam ArrowColor #2563EB');
  lines.push('');

  for (const board of project.boards) {
    lines.push(`package "Flow: ${escapePuml(board.name)}" {`);
    for (const node of board.nodes) {
      const alias = toPlantUmlId(node.id);
      if (node.kind === 'screen') {
        lines.push(`  rectangle "Screen: ${escapePuml((node as ScreenNode).title || 'Screen')}" as ${alias} #FEF3C7`);
      } else if (node.kind === 'endpoint') {
        const ep = project.endpoints.find((e) => e.id === (node as EndpointNode).endpointId);
        lines.push(`  rectangle "${ep?.method || 'API'}: ${escapePuml(ep?.path || '/api')}" as ${alias} #E0F2FE`);
      } else if (node.kind === 'model') {
        const m = project.models.find((model) => model.id === (node as ModelNode).modelId);
        lines.push(`  rectangle "Model: ${escapePuml(m?.name || 'Model')}" as ${alias} #FFF7ED`);
      } else if (node.kind === 'userAction') {
        lines.push(`  rectangle "Action: ${escapePuml(node.label || 'Action')}" as ${alias} #FEF9C3`);
      } else if (node.kind === 'flowRef') {
        const targetB = project.boards.find((b) => b.id === node.targetBoardId);
        lines.push(`  rectangle "Sub-Flow: ${escapePuml(node.label || targetB?.name || 'Flow')}" as ${alias} #F3E8FF`);
      }
    }

    for (const edge of board.edges) {
      const sAlias = toPlantUmlId(edge.source);
      const tAlias = toPlantUmlId(edge.target);
      lines.push(`  ${sAlias} --> ${tAlias}`);
    }
    lines.push('}');
    lines.push('');
  }

  lines.push('@enduml');
  return lines.join('\n');
}
