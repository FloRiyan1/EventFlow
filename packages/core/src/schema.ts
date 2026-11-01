import { z } from 'zod';

/**
 * Domain model of EventFlow. The zod schemas are the single source of truth:
 * TypeScript types are inferred from them and project files are validated with them.
 */

export const SCHEMA_VERSION = 1 as const;

const id = z.string().min(1);
const XYSchema = z.object({ x: z.number(), y: z.number() });

// ---------------------------------------------------------------------------
// Registry entities (exist once per project, referenced from boards)
// ---------------------------------------------------------------------------

/** A field of a model or a parameter of an endpoint, e.g. `String? nummer`. */
export const FieldSchema = z.object({
  id,
  name: z.string(),
  /** Type expression without the trailing `?`, e.g. `List<TaetigkeitPositionRESTModel>`. */
  type: z.string(),
  nullable: z.boolean().default(false),
});

export const ModelSchema = z.object({
  id,
  name: z.string(),
  description: z.string().default(''),
  fields: z.array(FieldSchema).default([]),
});

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const EndpointSchema = z.object({
  id,
  method: HttpMethodSchema,
  path: z.string(),
  description: z.string().default(''),
  params: z.array(FieldSchema).default([]),
  requestModelId: z.string().optional(),
  responseModelId: z.string().optional(),
});

/** Reusable UI component (e.g. "Positions-Listeneintrag") that hotspots can be instances of. */
export const ComponentDefSchema = z.object({
  id,
  name: z.string(),
  kind: z.string().default('button'),
});

export const AssetSchema = z.object({
  id,
  mime: z.string(),
  width: z.number(),
  height: z.number(),
  /** In memory the image is held as data URL. In project files it is stored separately (see `file`). */
  dataUrl: z.string().default(''),
  file: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Board content
// ---------------------------------------------------------------------------

export const TriggerSchema = z.object({
  id,
  /** Event name, e.g. `onTap`, `onSubmit`, `onScan`. */
  event: z.string(),
  /** Optional free-text condition, e.g. `unvollstaendig == true`. */
  condition: z.string().default(''),
});

/** Rectangle in fractions (0..1) of the screen image, so it is independent of the display size. */
export const RectSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });

export const HotspotSchema = z.object({
  id,
  label: z.string(),
  rect: RectSchema,
  componentId: z.string().optional(),
  triggers: z.array(TriggerSchema).default([]),
});

const nodeBase = {
  id,
  position: XYSchema,
  width: z.number().optional(),
  height: z.number().optional(),
};

export const ScreenNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal('screen'),
  title: z.string().default(''),
  assetId: z.string(),
  width: z.number().default(240),
  hotspots: z.array(HotspotSchema).default([]),
  figmaUrl: z.string().optional(),
});

export const UserActionNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal('userAction'),
  label: z.string(),
});

export const EndpointNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal('endpoint'),
  endpointId: z.string(),
});

export const ModelNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal('model'),
  modelId: z.string(),
});

export const NoteNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal('note'),
  text: z.string(),
});

export const FlowRefNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal('flowRef'),
  targetBoardId: z.string(),
  label: z.string().default(''),
});

export const FlowNodeSchema = z.discriminatedUnion('kind', [
  ScreenNodeSchema,
  UserActionNodeSchema,
  EndpointNodeSchema,
  ModelNodeSchema,
  NoteNodeSchema,
  FlowRefNodeSchema,
]);

export const EdgeKindSchema = z.enum(['trigger', 'navigation', 'request', 'response', 'flow']);

export const FlowEdgeSchema = z.object({
  id,
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().default(null),
  targetHandle: z.string().nullable().default(null),
  kind: EdgeKindSchema,
  label: z.string().default(''),
});

export const LaneKindSchema = z.enum(['ui', 'api', 'model', 'custom']);

export const LaneSchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
  height: z.number(),
  kind: LaneKindSchema,
});

export const BoardSchema = z.object({
  id,
  name: z.string(),
  lanes: z.array(LaneSchema),
  nodes: z.array(FlowNodeSchema).default([]),
  edges: z.array(FlowEdgeSchema).default([]),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  name: z.string(),
  boards: z.array(BoardSchema).min(1),
  models: z.array(ModelSchema).default([]),
  endpoints: z.array(EndpointSchema).default([]),
  components: z.array(ComponentDefSchema).default([]),
  assets: z.record(AssetSchema).default({}),
});

export type Field = z.infer<typeof FieldSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type HttpMethod = z.infer<typeof HttpMethodSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type ComponentDef = z.infer<typeof ComponentDefSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type Rect = z.infer<typeof RectSchema>;
export type Hotspot = z.infer<typeof HotspotSchema>;
export type ScreenNode = z.infer<typeof ScreenNodeSchema>;
export type UserActionNode = z.infer<typeof UserActionNodeSchema>;
export type EndpointNode = z.infer<typeof EndpointNodeSchema>;
export type ModelNode = z.infer<typeof ModelNodeSchema>;
export type NoteNode = z.infer<typeof NoteNodeSchema>;
export type FlowRefNode = z.infer<typeof FlowRefNodeSchema>;
export type FlowNode = z.infer<typeof FlowNodeSchema>;
export type FlowNodeKind = FlowNode['kind'];
export type EdgeKind = z.infer<typeof EdgeKindSchema>;
export type FlowEdge = z.infer<typeof FlowEdgeSchema>;
export type LaneKind = z.infer<typeof LaneKindSchema>;
export type Lane = z.infer<typeof LaneSchema>;
export type Board = z.infer<typeof BoardSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type XY = z.infer<typeof XYSchema>;

/** Validates unknown data (e.g. from a file or autosave) and returns a typed project. */
export function parseProject(raw: unknown): Project {
  return ProjectSchema.parse(raw);
}
