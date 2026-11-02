import type {
  Board,
  ComponentDef,
  Endpoint,
  Field,
  FlowNode,
  FlowEdge,
  HttpMethod,
  Model,
  ModelNode,
  EndpointNode,
  ScreenNode,
  UserActionNode,
  NoteNode,
  FlowRefNode,
  Project,
} from './schema';
import { uid } from './ids';
import { createBoard, createModel, createEndpoint } from './factory';

export interface ParsedPlantUmlField {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ParsedPlantUmlModel {
  name: string;
  fields: ParsedPlantUmlField[];
  rawAlias: string;
}

export interface ParsedPlantUmlEndpoint {
  method: HttpMethod;
  path: string;
  params: ParsedPlantUmlField[];
  rawAlias: string;
}

export interface ParsedPlantUmlNode {
  kind: 'screen' | 'userAction' | 'endpoint' | 'model' | 'note' | 'flowRef';
  label: string;
  rawAlias: string;
  screenTitle?: string;
  hotspots?: { label: string; event?: string }[];
  endpointData?: ParsedPlantUmlEndpoint;
  modelName?: string;
  noteText?: string;
  flowName?: string;
}

export interface ParsedPlantUmlEdge {
  sourceAlias: string;
  targetAlias: string;
  label?: string;
  isComposition?: boolean;
}

export interface PlantUmlParseResult {
  title?: string;
  models: ParsedPlantUmlModel[];
  endpoints: ParsedPlantUmlEndpoint[];
  nodes: ParsedPlantUmlNode[];
  edges: ParsedPlantUmlEdge[];
  warnings: string[];
}

export interface PlantUmlImportOptions {
  targetBoardId?: string | 'new';
  newBoardName?: string;
  mergeModels?: boolean;
  mergeEndpoints?: boolean;
  addNodesToBoard?: boolean;
}

export interface PlantUmlImportStats {
  createdModels: Model[];
  createdEndpoints: Endpoint[];
  boardId?: string;
  createdNodesCount: number;
  createdEdgesCount: number;
}

/**
 * Strips HTML formatting like <b>...</b>, <i>...</i>, <color:...>, etc.
 */
function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]+>/g, '').trim();
}

/**
 * Unescapes PlantUML string escapes (\n, \", etc.).
 */
function unescapePuml(str: string): string {
  return str.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * Parses a single field string line into name, type, and nullable.
 * Handles formats like:
 *   +name: type
 *   -name: type?
 *   name: type
 *   String uuid
 *   String? nummer
 *   List<Order> orders
 */
export function parsePumlField(raw: string): ParsedPlantUmlField | null {
  let line = raw.trim();
  if (!line || line.startsWith("'") || line.startsWith('//') || line === '..') {
    return null;
  }

  // Strip visibility symbols (+, -, #, ~)
  line = line.replace(/^[+\-#~]\s*/, '').trim();
  // Strip bullet points if present (•)
  line = line.replace(/^[•*\-]\s*/, '').trim();

  if (!line) return null;

  // Format 1: name: type (e.g. `uuid: String?` or `items: List<Item>`)
  if (line.includes(':')) {
    const parts = line.split(':');
    const name = parts[0].trim();
    let type = parts.slice(1).join(':').trim();
    let nullable = false;

    if (type.endsWith('?')) {
      nullable = true;
      type = type.slice(0, -1).trim();
    }

    if (name && type) {
      return { name, type, nullable };
    }
  }

  // Format 2: type name (Dart/Java style, e.g. `String uuid`, `String? nummer`, `List<Taetigkeit> positionen`)
  const match = line.match(/^(.+)\s+([a-zA-Z0-9_]+)$/);
  if (match) {
    let type = match[1].trim();
    const name = match[2].trim();
    let nullable = false;

    if (type.endsWith('?')) {
      nullable = true;
      type = type.slice(0, -1).trim();
    }

    if (name && type) {
      return { name, type, nullable };
    }
  }

  // Fallback: single identifier treated as String field
  const clean = line.replace(/[^a-zA-Z0-9_]/g, '');
  if (clean) {
    return { name: clean, type: 'String', nullable: false };
  }

  return null;
}

/**
 * Parses PlantUML source code into structured representations of models, endpoints, nodes, and edges.
 */
export function parsePlantUml(pumlCode: string): PlantUmlParseResult {
  const result: PlantUmlParseResult = {
    models: [],
    endpoints: [],
    nodes: [],
    edges: [],
    warnings: [],
  };

  const lines = pumlCode.split(/\r?\n/);
  let inMultiLineComment = false;
  let inNote = false;
  let currentNoteAlias = '';
  const currentNoteLines: string[] = [];

  let inClass = false;
  let currentClassModel: ParsedPlantUmlModel | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Comments
    if (inMultiLineComment) {
      if (line.includes("'/")) inMultiLineComment = false;
      continue;
    }
    if (line.startsWith("/'")) {
      inMultiLineComment = true;
      continue;
    }
    if (line.startsWith("'") || !line) {
      continue;
    }

    // 2. Note block handling
    if (inNote) {
      if (line.startsWith('end note') || line === 'endnote') {
        inNote = false;
        const text = currentNoteLines.join('\n').trim();
        result.nodes.push({
          kind: 'note',
          label: text.split('\n')[0] || 'Notiz',
          rawAlias: currentNoteAlias,
          noteText: text,
        });
        currentNoteAlias = '';
        currentNoteLines.length = 0;
      } else {
        currentNoteLines.push(unescapePuml(rawLine));
      }
      continue;
    }

    // 3. Class block handling
    if (inClass && currentClassModel) {
      if (line.startsWith('}')) {
        inClass = false;
        result.models.push(currentClassModel);
        currentClassModel = null;
      } else {
        const field = parsePumlField(line);
        if (field) {
          currentClassModel.fields.push(field);
        }
      }
      continue;
    }

    // 4. Diagram Directives
    if (
      line.startsWith('@startuml') ||
      line.startsWith('@enduml') ||
      line.startsWith('skinparam') ||
      line.startsWith('hide') ||
      line.startsWith('set')
    ) {
      continue;
    }

    // 5. Title
    if (line.startsWith('title ')) {
      let t = line.substring(6).trim();
      t = t.replace(/^EventFlow\s*-\s*/i, '').replace(/^Projekt:\s*/i, '');
      result.title = unescapePuml(t);
      continue;
    }

    // 6. Multi-line note start: `note as alias`
    const noteMatch = line.match(/^note\s+(?:as\s+)?([a-zA-Z0-9_]+)/i);
    if (noteMatch && !line.includes('"')) {
      inNote = true;
      currentNoteAlias = noteMatch[1];
      currentNoteLines.length = 0;
      continue;
    }

    // 7. Inline note: `note "text" as alias`
    const inlineNoteMatch = line.match(/^note\s+"([^"]+)"\s+(?:as\s+)?([a-zA-Z0-9_]+)/i);
    if (inlineNoteMatch) {
      const text = unescapePuml(inlineNoteMatch[1]);
      result.nodes.push({
        kind: 'note',
        label: text.split('\n')[0] || 'Notiz',
        rawAlias: inlineNoteMatch[2],
        noteText: text,
      });
      continue;
    }

    // 8. Class definition: `class "Name" as alias {` or `class Name {`
    const classMatch = line.match(/^class\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))(?:\s+as\s+([a-zA-Z0-9_]+))?(?:[^{]*)\{/i);
    if (classMatch) {
      inClass = true;
      const className = classMatch[1] || classMatch[2];
      const classAlias = classMatch[3] || className;
      currentClassModel = {
        name: className,
        rawAlias: classAlias,
        fields: [],
      };
      continue;
    }

    // Standalone class: `class Name`
    const simpleClassMatch = line.match(/^class\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))(?:\s+as\s+([a-zA-Z0-9_]+))?$/i);
    if (simpleClassMatch) {
      const className = simpleClassMatch[1] || simpleClassMatch[2];
      const classAlias = simpleClassMatch[3] || className;
      result.models.push({
        name: className,
        rawAlias: classAlias,
        fields: [],
      });
      continue;
    }

    // 9. Rectangle / Component / Node element
    const elemMatch = line.match(/^(rectangle|component|node|artifact|actor|database|interface)\s+"([^"]+)"\s+(?:as\s+)?([a-zA-Z0-9_]+)(?:\s+#[a-zA-Z0-9_]+)?/i);
    if (elemMatch) {
      const elemType = elemMatch[1].toLowerCase();
      const content = unescapePuml(elemMatch[2]);
      const alias = elemMatch[3];

      parseRectangleOrComponent(elemType, content, alias, result);
      continue;
    }

    // 10. Edges / Connections
    const edgeMatch = line.match(/^([a-zA-Z0-9_]+)(?:\s+"[^"]*")?\s*(-->|->|\.\.>|<--|<-|\*--|o--|--)\s*(?:"[^"]*"\s*)?([a-zA-Z0-9_]+)(?:\s*:\s*(.*))?$/);
    if (edgeMatch) {
      const sourceAlias = edgeMatch[1];
      const arrow = edgeMatch[2];
      const targetAlias = edgeMatch[3];
      const label = edgeMatch[4] ? unescapePuml(edgeMatch[4].trim()) : undefined;
      const isComposition = arrow.includes('*--') || arrow.includes('o--');

      result.edges.push({
        sourceAlias,
        targetAlias,
        label,
        isComposition,
      });
      continue;
    }
  }

  // Deduplicate models by name
  const uniqueModels = new Map<string, ParsedPlantUmlModel>();
  for (const m of result.models) {
    if (!uniqueModels.has(m.name)) {
      uniqueModels.set(m.name, m);
    } else {
      const existing = uniqueModels.get(m.name)!;
      for (const f of m.fields) {
        if (!existing.fields.some((ef) => ef.name === f.name)) {
          existing.fields.push(f);
        }
      }
    }
  }
  result.models = Array.from(uniqueModels.values());

  return result;
}

/**
 * Parses content inside a PlantUML rectangle/component/database.
 */
function parseRectangleOrComponent(
  elemType: string,
  content: string,
  alias: string,
  result: PlantUmlParseResult
) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const header = lines[0] || '';
  const cleanHeader = stripHtmlTags(header);

  // 1. API Endpoint: `<b>API: POST</b>` or `interface`
  if (
    cleanHeader.toLowerCase().startsWith('api:') ||
    cleanHeader.toLowerCase().startsWith('api ') ||
    elemType === 'interface' ||
    /^(GET|POST|PUT|DELETE|PATCH):?/i.test(cleanHeader)
  ) {
    let method: HttpMethod = 'POST';
    const methodMatch = cleanHeader.match(/(GET|POST|PUT|DELETE|PATCH)/i);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase() as HttpMethod;
    }

    let path = cleanHeader
      .replace(/^api\s*(?::\s*)?/i, '')
      .replace(/^(GET|POST|PUT|DELETE|PATCH):?\s*/i, '')
      .trim();

    if (!path && lines[1]) {
      path = stripHtmlTags(lines[1]);
    }
    if (!path) path = '/api';
    const params: ParsedPlantUmlField[] = [];

    // Parse params if listed
    let inParams = false;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.toLowerCase().includes('params:')) {
        inParams = true;
        continue;
      }
      if (l === '..') continue;
      if (inParams) {
        const param = parsePumlField(l);
        if (param) params.push(param);
      }
    }

    const epData: ParsedPlantUmlEndpoint = {
      method,
      path,
      params,
      rawAlias: alias,
    };

    result.endpoints.push(epData);
    result.nodes.push({
      kind: 'endpoint',
      label: `${method} ${path}`,
      rawAlias: alias,
      endpointData: epData,
    });
    return;
  }

  // 2. Model: `<b>Model: Name</b>` or `database`
  if (
    cleanHeader.toLowerCase().startsWith('model:') ||
    cleanHeader.toLowerCase().startsWith('model ') ||
    cleanHeader.toLowerCase() === 'model' ||
    elemType === 'database'
  ) {
    let name = cleanHeader.replace(/^model\s*(?::\s*)?/i, '').trim();
    if (!name && lines[1]) {
      name = stripHtmlTags(lines[1]);
    }
    if (!name) name = alias;

    const fields: ParsedPlantUmlField[] = [];
    let inFields = false;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.toLowerCase().includes('fields:')) {
        inFields = true;
        continue;
      }
      if (l === '..') continue;
      if (inFields) {
        const field = parsePumlField(l);
        if (field) fields.push(field);
      }
    }

    const mData: ParsedPlantUmlModel = {
      name,
      fields,
      rawAlias: alias,
    };

    result.models.push(mData);
    result.nodes.push({
      kind: 'model',
      label: name,
      rawAlias: alias,
      modelName: name,
    });
    return;
  }

  // 3. Screen: `<b>Screen</b>`
  if (
    cleanHeader.toLowerCase() === 'screen' ||
    cleanHeader.toLowerCase().startsWith('screen:') ||
    cleanHeader.toLowerCase().startsWith('screen ')
  ) {
    let title = cleanHeader.replace(/^screen\s*(?::\s*)?/i, '').trim();
    if (!title && lines[1]) {
      title = stripHtmlTags(lines[1]);
    }
    if (!title) title = 'Screen';

    const hotspots: { label: string; event?: string }[] = [];
    let inHotspots = false;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.toLowerCase().includes('hotspots:')) {
        inHotspots = true;
        continue;
      }
      if (l === '..') continue;
      if (inHotspots) {
        const clean = l.replace(/^[•*\-]\s*/, '').trim();
        const hsMatch = clean.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (hsMatch) {
          hotspots.push({
            label: hsMatch[1].trim(),
            event: hsMatch[2]?.trim() || 'onTap',
          });
        } else if (clean) {
          hotspots.push({ label: clean, event: 'onTap' });
        }
      }
    }

    result.nodes.push({
      kind: 'screen',
      label: title,
      rawAlias: alias,
      screenTitle: title,
      hotspots,
    });
    return;
  }

  // 4. Action / Actor: `<b>Action</b>` or `actor`
  if (
    cleanHeader.toLowerCase() === 'action' ||
    cleanHeader.toLowerCase().startsWith('action:') ||
    cleanHeader.toLowerCase().startsWith('action ') ||
    elemType === 'actor'
  ) {
    let label = cleanHeader.replace(/^action\s*(?::\s*)?/i, '').trim();
    if (!label && lines[1]) {
      label = stripHtmlTags(lines[1]);
    }
    if (!label) label = 'Action';

    result.nodes.push({
      kind: 'userAction',
      label,
      rawAlias: alias,
    });
    return;
  }

  // 5. Sub-Flow: `<b>Sub-Flow</b>`
  if (
    cleanHeader.toLowerCase() === 'sub-flow' ||
    cleanHeader.toLowerCase().startsWith('sub-flow:') ||
    cleanHeader.toLowerCase().startsWith('sub-flow ')
  ) {
    let flowName = cleanHeader.replace(/^sub-flow\s*(?::\s*)?/i, '').trim();
    if (!flowName && lines[1]) {
      flowName = stripHtmlTags(lines[1]);
    }
    if (!flowName) flowName = 'Flow';

    result.nodes.push({
      kind: 'flowRef',
      label: flowName,
      rawAlias: alias,
      flowName,
    });
    return;
  }

  // Fallback: Default to user action or component
  result.nodes.push({
    kind: 'userAction',
    label: cleanHeader || alias,
    rawAlias: alias,
  });
}

/**
 * Imports a parsed PlantUML result into an EventFlow project.
 */
export function importPlantUmlIntoProject(
  project: Project,
  parsed: PlantUmlParseResult,
  options: PlantUmlImportOptions = {}
): PlantUmlImportStats {
  const {
    targetBoardId,
    newBoardName,
    mergeModels = true,
    mergeEndpoints = true,
    addNodesToBoard = true,
  } = options;

  const stats: PlantUmlImportStats = {
    createdModels: [],
    createdEndpoints: [],
    createdNodesCount: 0,
    createdEdgesCount: 0,
  };

  // 1. Process & merge Models
  const aliasToModel = new Map<string, Model>();
  if (mergeModels) {
    for (const pModel of parsed.models) {
      let existing = project.models.find(
        (m) => m.name.toLowerCase() === pModel.name.toLowerCase()
      );

      if (existing) {
        for (const pf of pModel.fields) {
          if (!existing.fields.some((ef) => ef.name === pf.name)) {
            existing.fields.push({
              id: uid('f_'),
              name: pf.name,
              type: pf.type,
              nullable: pf.nullable,
            });
          }
        }
        aliasToModel.set(pModel.rawAlias, existing);
        aliasToModel.set(pModel.name, existing);
      } else {
        const newModel = createModel(
          pModel.name,
          pModel.fields.map((pf) => ({
            id: uid('f_'),
            name: pf.name,
            type: pf.type,
            nullable: pf.nullable,
          }))
        );
        project.models.push(newModel);
        stats.createdModels.push(newModel);
        aliasToModel.set(pModel.rawAlias, newModel);
        aliasToModel.set(pModel.name, newModel);
      }
    }
  }

  // 2. Process & merge Endpoints
  const aliasToEndpoint = new Map<string, Endpoint>();
  if (mergeEndpoints) {
    for (const pEp of parsed.endpoints) {
      let existing = project.endpoints.find(
        (e) =>
          e.method === pEp.method &&
          e.path.toLowerCase() === pEp.path.toLowerCase()
      );

      if (existing) {
        aliasToEndpoint.set(pEp.rawAlias, existing);
      } else {
        const newEp = createEndpoint(pEp.method, pEp.path);
        newEp.params = pEp.params.map((pp) => ({
          id: uid('f_'),
          name: pp.name,
          type: pp.type,
          nullable: pp.nullable,
        }));
        project.endpoints.push(newEp);
        stats.createdEndpoints.push(newEp);
        aliasToEndpoint.set(pEp.rawAlias, newEp);
      }
    }
  }

  // 3. Process Board Nodes & Edges
  if (addNodesToBoard && (parsed.nodes.length > 0 || parsed.edges.length > 0)) {
    let board: Board;

    if (targetBoardId === 'new') {
      const bName =
        newBoardName || parsed.title || `Importiert ${project.boards.length + 1}`;
      board = createBoard(bName);
      project.boards.push(board);
    } else if (targetBoardId) {
      board =
        project.boards.find((b) => b.id === targetBoardId) ??
        project.boards[0];
    } else {
      board = project.boards[0] ?? createBoard('Importierter Flow');
      if (!project.boards.includes(board)) {
        project.boards.push(board);
      }
    }

    stats.boardId = board.id;

    // Arrange nodes on lanes:
    // UI lane: Screens & UserActions (y: 80 - 240)
    // API lane: Endpoints (y: 560 - 640)
    // Model lane: Models (y: 840 - 920)
    const aliasToNodeId = new Map<string, string>();
    let uiCol = 0;
    let apiCol = 0;
    let modelCol = 0;

    for (const pNode of parsed.nodes) {
      const nodeId = uid('n_');
      let flowNode: FlowNode;

      switch (pNode.kind) {
        case 'screen': {
          const x = 100 + uiCol * 320;
          const y = 80;
          uiCol++;
          flowNode = {
            id: nodeId,
            kind: 'screen',
            title: pNode.screenTitle || pNode.label || 'Screen',
            width: 260,
            hotspots: (pNode.hotspots || []).map((h) => ({
              id: uid('h_'),
              label: h.label,
              x: 20,
              y: 40,
              width: 220,
              height: 40,
              triggers: [{ id: uid('t_'), event: h.event || 'onTap' }],
            })),
            position: { x, y },
          };
          break;
        }

        case 'userAction': {
          const x = 100 + uiCol * 300;
          const y = 140;
          uiCol++;
          flowNode = {
            id: nodeId,
            kind: 'userAction',
            label: pNode.label || 'Action',
            position: { x, y },
          };
          break;
        }

        case 'endpoint': {
          const ep =
            pNode.endpointData && aliasToEndpoint.get(pNode.endpointData.rawAlias)
              ? aliasToEndpoint.get(pNode.endpointData.rawAlias)!
              : project.endpoints[0] || createEndpoint('POST', '/api');

          const x = 100 + apiCol * 320;
          const y = 560;
          apiCol++;
          flowNode = {
            id: nodeId,
            kind: 'endpoint',
            endpointId: ep.id,
            position: { x, y },
          };
          break;
        }

        case 'model': {
          const model =
            pNode.modelName && aliasToModel.get(pNode.modelName)
              ? aliasToModel.get(pNode.modelName)!
              : aliasToModel.get(pNode.rawAlias) ||
                project.models[0] ||
                createModel('Model');

          const x = 100 + modelCol * 320;
          const y = 860;
          modelCol++;
          flowNode = {
            id: nodeId,
            kind: 'model',
            modelId: model.id,
            position: { x, y },
          };
          break;
        }

        case 'flowRef': {
          const x = 100 + uiCol * 300;
          const y = 180;
          uiCol++;
          flowNode = {
            id: nodeId,
            kind: 'flowRef',
            label: pNode.flowName || pNode.label,
            targetBoardId: project.boards[0]?.id || '',
            position: { x, y },
          };
          break;
        }

        case 'note':
        default: {
          const x = 100 + uiCol * 280;
          const y = 220;
          uiCol++;
          flowNode = {
            id: nodeId,
            kind: 'note',
            text: pNode.noteText || pNode.label,
            position: { x, y },
          };
          break;
        }
      }

      board.nodes.push(flowNode);
      stats.createdNodesCount++;
      aliasToNodeId.set(pNode.rawAlias, nodeId);
    }

    // Also map model aliases to model nodes if created
    for (const [alias, model] of aliasToModel.entries()) {
      if (!aliasToNodeId.has(alias)) {
        const mNode = board.nodes.find(
          (n) => n.kind === 'model' && (n as ModelNode).modelId === model.id
        );
        if (mNode) aliasToNodeId.set(alias, mNode.id);
      }
    }

    // Connect edges
    for (const pEdge of parsed.edges) {
      const sourceId = aliasToNodeId.get(pEdge.sourceAlias);
      const targetId = aliasToNodeId.get(pEdge.targetAlias);

      if (sourceId && targetId && sourceId !== targetId) {
        const newEdge: FlowEdge = {
          id: uid('e_'),
          source: sourceId,
          target: targetId,
          label: pEdge.label,
        };
        board.edges.push(newEdge);
        stats.createdEdgesCount++;
      }
    }
  }

  return stats;
}
