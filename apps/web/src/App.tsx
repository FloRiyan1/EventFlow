import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
  MarkerType,
  OnConnect,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { useStore, useEditorStore } from './storeContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { HotspotEditorModal } from './components/HotspotEditorModal';
import { ModelQuickEditModal } from './components/ModelQuickEditModal';
import { EndpointQuickEditModal } from './components/EndpointQuickEditModal';
import { PlantUmlExportModal } from './components/PlantUmlExportModal';
import { JavaModal } from './components/JavaModal';
import { AiImportModal } from './components/AiImportModal';
import { DataModelsView } from './components/DataModelsView';
import { ScreenNode } from './nodes/ScreenNode';
import { EndpointNode } from './nodes/EndpointNode';
import { ModelNode } from './nodes/ModelNode';
import { UserActionNode } from './nodes/UserActionNode';
import { NoteNode } from './nodes/NoteNode';
import { FlowRefNode } from './nodes/FlowRefNode';
import { StepWithDeleteEdge } from './edges/StepWithDeleteEdge';
import { ContextMenu, type ContextMenuTarget } from './components/ContextMenu';
import {
  connect as domainConnect,
  removeNodes,
  removeEdges,
  uid,
  triggerHandleId,
  createModel,
  createEndpoint,
  createModelBoard,
  computeErdLayout,
  getModelHierarchyInfo,
  insertModelWithSubModels,
  insertSubModelsForNode,
  calculateAlignmentSnap,
  snapToGridValue,
  alignNodes,
  type FlowNode,
  type FlowEdge,
  type AlignmentGuideLine,
  type AlignmentMode,
} from '@eventflow/core';
import { AlignmentGuideLines } from './components/AlignmentGuideLines';
import {
  Database,
  Globe,
  Sparkles,
  Workflow,
  Hand,
  BoxSelect,
  Magnet,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
} from 'lucide-react';
import { ThemeProvider, useTheme } from './themeContext';

const nodeTypes = {
  screen: ScreenNode,
  endpoint: EndpointNode,
  model: ModelNode,
  userAction: UserActionNode,
  note: NoteNode,
  flowRef: FlowRefNode,
};

const edgeTypes = {
  step: StepWithDeleteEdge,
  default: StepWithDeleteEdge,
};

// Inner canvas component to access useReactFlow()
const CanvasInner: React.FC<{
  onSelectNodes: (ids: string[]) => void;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  onSelectEdge: (id: string | null) => void;
  onShowToast: (msg: string) => void;
  onAlign: (mode: AlignmentMode) => void;
  onOpenContextMenu: (
    screenX: number,
    screenY: number,
    target: ContextMenuTarget
  ) => void;
}> = ({
  onSelectNodes,
  selectedNodeIds,
  selectedEdgeId,
  onSelectEdge,
  onShowToast,
  onAlign,
  onOpenContextMenu,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);
  const { screenToFlowPosition } = useReactFlow();
  const { theme } = useTheme();

  // Selection mode: Hand (default, pan canvas) vs Box Selection (drag to marquee select)
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Snap to grid & smart center alignment state
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [guideLines, setGuideLines] = useState<{
    vertical: AlignmentGuideLine | null;
    horizontal: AlignmentGuideLine | null;
  }>({ vertical: null, horizontal: null });

  const activeBoard = useMemo(() => {
    return project.boards.find((b) => b.id === activeBoardId) ?? project.boards[0];
  }, [project.boards, activeBoardId]);

  // Drag-and-drop preview state
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
    type: 'model' | 'endpoint' | 'flowRef';
    title: string;
    sub?: string;
  } | null>(null);

  // Convert domain nodes to React Flow nodes
  // NOTE: We inject resolved `model`, `endpoint`, and `targetBoardName` so any edits re-render IMMEDIATELY!
  const rfNodes = useMemo<Node[]>(() => {
    return activeBoard.nodes.map((node) => {
      let injectedData: Record<string, unknown> = { ...node };

      if (node.kind === 'model') {
        const m = project.models.find((item) => item.id === node.modelId);
        injectedData = {
          ...node,
          model: m,
          fields: m ? [...m.fields] : [],
        };
      } else if (node.kind === 'endpoint') {
        const ep = project.endpoints.find((item) => item.id === node.endpointId);
        injectedData = {
          ...node,
          endpoint: ep,
          params: ep ? [...ep.params] : [],
        };
      } else if (node.kind === 'flowRef') {
        const targetB = project.boards.find((b) => b.id === node.targetBoardId);
        injectedData = {
          ...node,
          targetBoardName: targetB?.name || 'Flow',
        };
      }

      return {
        id: node.id,
        type: node.kind,
        position: node.position,
        data: injectedData,
        style: {
          width: node.width ?? undefined,
          height: node.height ?? undefined,
        },
      };
    });
  }, [activeBoard.nodes, project.models, project.endpoints, project.boards]);

  // Manage nodes and edges with React Flow's native state hooks
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync nodes from store while preserving measured dimensions & active selection
  useEffect(() => {
    setNodes((prevNodes) => {
      const prevMap = new Map(prevNodes.map((n) => [n.id, n]));
      return rfNodes.map((newNode) => {
        const prev = prevMap.get(newNode.id);
        if (!prev) {
          return {
            ...newNode,
            selected: selectedNodeIds.includes(newNode.id),
          };
        }
        return {
          ...newNode,
          selected: prev.selected ?? selectedNodeIds.includes(newNode.id),
          measured: prev.measured,
          style: {
            ...newNode.style,
            width: newNode.style?.width ?? prev.style?.width,
            height: newNode.style?.height ?? prev.style?.height,
          },
        };
      });
    });
  }, [rfNodes, setNodes]);

  // Sync external selection changes into nodes state smoothly
  useEffect(() => {
    setNodes((prevNodes) => {
      let changed = false;
      const updated = prevNodes.map((n) => {
        const isSelected = selectedNodeIds.includes(n.id);
        if (n.selected === isSelected) return n;
        changed = true;
        return { ...n, selected: isSelected };
      });
      return changed ? updated : prevNodes;
    });
  }, [selectedNodeIds, setNodes]);

  // Helper to determine exact orthogonal handles per user rules:
  // 1. API <-> API and API <-> UI: immer links rein und rechts raus
  // 2. API -> Model and UI -> Model: immer nach unten (bottom -> top)
  const getSmartHandles = useCallback(
    (edge: FlowEdge, sourceNode?: FlowNode, targetNode?: FlowNode) => {
      let sHandle = edge.sourceHandle ?? undefined;
      let tHandle = edge.targetHandle ?? undefined;

      const isApi = (n?: FlowNode) => n?.kind === 'endpoint';
      const isUi = (n?: FlowNode) => n?.kind === 'screen' || n?.kind === 'userAction';
      const isModel = (n?: FlowNode) => n?.kind === 'model';

      // 1. API <-> API: immer links rein und rechts raus
      if (isApi(sourceNode) && isApi(targetNode)) {
        if (!sHandle || sHandle === 'bottom') sHandle = 'right';
        if (!tHandle || tHandle === 'top') tHandle = 'left';
      }
      // 2. UI -> API: rechts raus, links rein
      else if (isUi(sourceNode) && isApi(targetNode)) {
        if (!sHandle || sHandle === 'bottom') sHandle = 'right';
        if (!tHandle || tHandle === 'top') tHandle = 'left';
      }
      // 3. API -> UI: rechts raus, links rein
      else if (isApi(sourceNode) && isUi(targetNode)) {
        if (!sHandle || sHandle === 'bottom') sHandle = 'right';
        if (!tHandle || tHandle === 'top') tHandle = 'left';
      }
      // 4. API -> Model: immer nach unten (bottom -> top)
      else if (isApi(sourceNode) && isModel(targetNode)) {
        if (!sHandle || sHandle === 'right') sHandle = 'bottom';
        if (!tHandle || tHandle === 'left') tHandle = 'top';
      }
      // 5. UI -> Model: immer nach unten (bottom -> top)
      else if (isUi(sourceNode) && isModel(targetNode)) {
        if (!sHandle || sHandle === 'right') sHandle = 'bottom';
        if (!tHandle || tHandle === 'left') tHandle = 'top';
      }
      // 6. Model -> Model: immer nach unten (bottom -> top)
      else if (isModel(sourceNode) && isModel(targetNode)) {
        if (!sHandle || sHandle === 'right') sHandle = 'bottom';
        if (!tHandle || tHandle === 'left') tHandle = 'top';
      }
      // 7. Model -> API: rechts raus, links rein
      else if (isModel(sourceNode) && isApi(targetNode)) {
        if (!sHandle || sHandle === 'bottom') sHandle = 'right';
        if (!tHandle || tHandle === 'top') tHandle = 'left';
      }

      return { sHandle, tHandle };
    },
    []
  );

  // Convert domain edges to React Flow edges with sharp orthogonal corners (type: 'step')
  const rfEdges = useMemo<Edge[]>(() => {
    return activeBoard.edges.map((edge) => {
      let strokeColor = '#94a3b8';
      let strokeWidth = 2;
      let animated = false;

      if (edge.kind === 'trigger') {
        strokeColor = '#f59e0b';
        strokeWidth = 2;
        animated = true;
      } else if (edge.kind === 'response') {
        strokeColor = '#0091FF';
        strokeWidth = 2;
      } else if (edge.kind === 'request') {
        strokeColor = '#f97316';
        strokeWidth = 2;
      }

      const sourceNode = activeBoard.nodes.find((n) => n.id === edge.source);
      const targetNode = activeBoard.nodes.find((n) => n.id === edge.target);
      const { sHandle, tHandle } = getSmartHandles(edge, sourceNode, targetNode);

      return {
        id: edge.id,
        type: 'step', // Crisp 90-degree orthogonal lines (keine Rundungen, keine schrägen Überschneidungen)
        source: edge.source,
        target: edge.target,
        sourceHandle: sHandle,
        targetHandle: tHandle,
        label: edge.label || undefined,
        animated,
        selected: edge.id === selectedEdgeId,
        style: { stroke: strokeColor, strokeWidth },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
      };
    });
  }, [activeBoard.edges, activeBoard.nodes, selectedEdgeId, getSmartHandles]);

  // Sync edges
  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdges, setEdges]);

  // Handle Edge connections with smart default handles to avoid overlapping
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const board = activeBoard;
      const sourceNode = board.nodes.find((n) => n.id === connection.source);
      const targetNode = board.nodes.find((n) => n.id === connection.target);

      let sourceHandle = connection.sourceHandle;
      let targetHandle = connection.targetHandle;

      // If dragged from a hotspot overlay handle (hs-...), resolve to its trigger
      if (sourceHandle?.startsWith('hs-') && sourceNode?.kind === 'screen') {
        const hsId = sourceHandle.slice(3);
        const screen = sourceNode;
        const hotspot = screen.hotspots.find((h) => h.id === hsId);
        if (hotspot) {
          if (hotspot.triggers.length > 0) {
            sourceHandle = triggerHandleId(hotspot.triggers[0].id);
          } else {
            const newTriggerId = uid('t_');
            store.update((draft) => {
              const b = draft.boards.find((item) => item.id === activeBoardId);
              const sn = b?.nodes.find((n) => n.id === sourceNode.id);
              if (sn && sn.kind === 'screen') {
                const hs = sn.hotspots.find((h) => h.id === hsId);
                if (hs) {
                  hs.triggers.push({ id: newTriggerId, event: 'onTap', condition: '' });
                }
              }
            });
            sourceHandle = triggerHandleId(newTriggerId);
          }
        }
      }

      // Smart orthogonal handles per user rules:
      const isApi = (n?: FlowNode) => n?.kind === 'endpoint';
      const isUi = (n?: FlowNode) => n?.kind === 'screen' || n?.kind === 'userAction';
      const isModel = (n?: FlowNode) => n?.kind === 'model';

      if (isApi(sourceNode) && isApi(targetNode)) {
        if (!sourceHandle || sourceHandle === 'bottom') sourceHandle = 'right';
        if (!targetHandle || targetHandle === 'top') targetHandle = 'left';
      } else if (isUi(sourceNode) && isApi(targetNode)) {
        if (!sourceHandle || sourceHandle === 'bottom') sourceHandle = 'right';
        if (!targetHandle || targetHandle === 'top') targetHandle = 'left';
      } else if (isApi(sourceNode) && isUi(targetNode)) {
        if (!sourceHandle || sourceHandle === 'bottom') sourceHandle = 'right';
        if (!targetHandle || targetHandle === 'top') targetHandle = 'left';
      } else if (isApi(sourceNode) && isModel(targetNode)) {
        if (!sourceHandle || sourceHandle === 'right') sourceHandle = 'bottom';
        if (!targetHandle || targetHandle === 'left') targetHandle = 'top';
      } else if (isUi(sourceNode) && isModel(targetNode)) {
        if (!sourceHandle || sourceHandle === 'right') sourceHandle = 'bottom';
        if (!targetHandle || targetHandle === 'left') targetHandle = 'top';
      } else if (isModel(sourceNode) && isModel(targetNode)) {
        if (!sourceHandle || sourceHandle === 'right') sourceHandle = 'bottom';
        if (!targetHandle || targetHandle === 'left') targetHandle = 'top';
      } else if (isModel(sourceNode) && isApi(targetNode)) {
        if (!sourceHandle || sourceHandle === 'bottom') sourceHandle = 'right';
        if (!targetHandle || targetHandle === 'top') targetHandle = 'left';
      }

      store.update((draft) => {
        const b = draft.boards.find((item) => item.id === activeBoardId);
        if (b) {
          domainConnect(draft, b, {
            source: connection.source,
            target: connection.target,
            sourceHandle,
            targetHandle,
          });
        }
      });
    },
    [store, activeBoardId, activeBoard]
  );

  // Handle node drag stop: persist position to history (handles both single and multiple dragged nodes)
  const handleNodesMoved = useCallback(
    (movedNodes: Node[]) => {
      if (!movedNodes || movedNodes.length === 0) return;
      store.update((draft) => {
        const board = draft.boards.find((b) => b.id === activeBoardId);
        if (!board) return;
        for (const moved of movedNodes) {
          const targetNode = board.nodes.find((n) => n.id === moved.id);
          if (targetNode) {
            targetNode.position = { x: Math.round(moved.position.x), y: Math.round(moved.position.y) };
          }
        }
      });
    },
    [store, activeBoardId]
  );

  // Handle node dragging with smart snapping to grid and other nodes' centers/edges
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      if (isSnapEnabled) {
        const draggingChanges = changes.filter(
          (c) => c.type === 'position' && c.dragging && c.position
        );

        if (draggingChanges.length === 1) {
          const change = draggingChanges[0];
          const draggedNode = nodes.find((n) => n.id === change.id);

          if (draggedNode && change.position) {
            const candidate = {
              ...draggedNode,
              position: change.position,
            };

            const otherNodes = nodes.filter((n) => n.id !== change.id);
            const snapRes = calculateAlignmentSnap(candidate, otherNodes, 10);

            let nextX = snapRes.x;
            let nextY = snapRes.y;

            // If not snapped to a smart guide along an axis, snap to grid (20px)
            if (!snapRes.verticalLine) {
              nextX = snapToGridValue(nextX, 20);
            }
            if (!snapRes.horizontalLine) {
              nextY = snapToGridValue(nextY, 20);
            }

            change.position = { x: nextX, y: nextY };
            setGuideLines({
              vertical: snapRes.verticalLine,
              horizontal: snapRes.horizontalLine,
            });
          }
        } else if (draggingChanges.length > 1) {
          // Multi-node drag with snap to grid
          for (const change of draggingChanges) {
            if (change.position) {
              change.position = {
                x: snapToGridValue(change.position.x, 20),
                y: snapToGridValue(change.position.y, 20),
              };
            }
          }
          if (guideLines.vertical || guideLines.horizontal) {
            setGuideLines({ vertical: null, horizontal: null });
          }
        } else {
          if (guideLines.vertical || guideLines.horizontal) {
            setGuideLines({ vertical: null, horizontal: null });
          }
        }
      } else {
        if (guideLines.vertical || guideLines.horizontal) {
          setGuideLines({ vertical: null, horizontal: null });
        }
      }

      onNodesChange(changes);
    },
    [isSnapEnabled, nodes, onNodesChange, guideLines]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node, nodes: Node[]) => {
      setGuideLines({ vertical: null, horizontal: null });
      handleNodesMoved(nodes && nodes.length > 0 ? nodes : [node]);
    },
    [handleNodesMoved]
  );

  const onSelectionDragStop = useCallback(
    (_: unknown, nodes: Node[]) => {
      setGuideLines({ vertical: null, horizontal: null });
      handleNodesMoved(nodes);
    },
    [handleNodesMoved]
  );

  // Drag over canvas handler (for drag-and-drop preview from sidebar or external file)
  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // Check if dragging from EventFlow sidebar
      const rawData = e.dataTransfer.getData('application/eventflow');
      if (rawData) {
        try {
          const item = JSON.parse(rawData);
          setDragPreview({
            x: flowPos.x,
            y: flowPos.y,
            type: item.type,
            title: item.name || item.path || 'Item',
            sub: item.method,
          });
          return;
        } catch (_) {}
      }

      // Check if dragging files
      if (e.dataTransfer.types.includes('Files')) {
        setDragPreview({
          x: flowPos.x,
          y: flowPos.y,
          type: 'model', // use placeholder style
          title: 'Bild-Datei ablegen',
        });
      }
    },
    [screenToFlowPosition]
  );

  const onDragLeave = useCallback(() => {
    setDragPreview(null);
  }, []);

  // Drop onto canvas
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragPreview(null);

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // 1. Check for EventFlow sidebar item
      const rawData = e.dataTransfer.getData('application/eventflow');
      if (rawData) {
        try {
          const item = JSON.parse(rawData);
          const newNodeId = uid('n_');

          store.update((draft) => {
            const b = draft.boards.find((board) => board.id === activeBoardId);
            if (!b) return;

            if (item.type === 'model') {
              if (item.includeSubModels) {
                const res = insertModelWithSubModels(b, draft, item.id, {
                  basePosition: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
                });
                onSelectNodes(res.createdNodeIds);
                onShowToast(`✨ Model "${item.name}" und ${res.createdNodeIds.length - 1} Untermodelle platziert!`);
                return;
              } else {
                b.nodes.push({
                  id: newNodeId,
                  kind: 'model',
                  modelId: item.id,
                  position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
                });
              }
            } else if (item.type === 'endpoint') {
              b.nodes.push({
                id: newNodeId,
                kind: 'endpoint',
                endpointId: item.id,
                position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
              });
            } else if (item.type === 'flowRef') {
              b.nodes.push({
                id: newNodeId,
                kind: 'flowRef',
                targetBoardId: item.id,
                label: item.name,
                position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
              });
            }
          });

          onSelectNodes([newNodeId]);
          onShowToast(
            `✓ ${
              item.type === 'model'
                ? 'Model'
                : item.type === 'endpoint'
                ? 'API Endpoint'
                : 'Flow Einstiegspunkt'
            } auf Canvas platziert!`
          );
          return;
        } catch (_) {}
        }

        // 2. Check for dropped image files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const assetId = uid('a_');
              const newNodeId = uid('n_');

              store.update((draft) => {
                draft.assets[assetId] = {
                  id: assetId,
                  mime: file.type,
                  width: 280,
                  height: 600,
                  dataUrl,
                };

                const b = draft.boards.find((board) => board.id === activeBoardId);
                if (!b) return;

                b.nodes.push({
                  id: newNodeId,
                  kind: 'screen',
                  title: file.name.replace(/\.[^/.]+$/, ''),
                  assetId,
                  width: 260,
                  hotspots: [],
                  position: { x: Math.round(flowPos.x), y: Math.round(flowPos.y) },
                });
              });

              onSelectNodes([newNodeId]);
              onShowToast(`📋 Bild "${file.name}" eingefügt!`);
            };
            reader.readAsDataURL(file);
          }
        }
      },
      [screenToFlowPosition, store, activeBoardId, onSelectNodes, onShowToast]
    );

    return (
      <div
        className="w-full h-full relative"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Floating Canvas Mode Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 shadow-xl backdrop-blur-md text-xs transition-colors">
          <button
            type="button"
            onClick={() => setIsSelectMode(false)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
              !isSelectMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Verschieben-Modus: Canvas mit linker Maustaste ziehen (oder Shift gedrückt halten für Rahmen-Auswahl)"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Verschieben</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSelectMode(true)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
              isSelectMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Rahmen-Auswahl: Mit linker Maustaste Rechteck ziehen, um mehrere Elemente zu markieren"
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span>Rahmen-Auswahl</span>
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Snap / Magnet Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isSnapEnabled;
              setIsSnapEnabled(next);
              onShowToast(next ? '🧲 Raster- & Mitten-Fang aktiviert' : 'Freies Verschieben (Fang deaktiviert)');
            }}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              isSnapEnabled
                ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title={isSnapEnabled ? 'Raster- & Mitten-Fang aktiv (Klicken zum Ausschalten)' : 'Freies Verschieben (Klicken zum Einschalten)'}
          >
            <Magnet className={`w-3.5 h-3.5 ${isSnapEnabled ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
            <span>Snap</span>
          </button>

          {/* Multi-Selection Tools */}
          {selectedNodeIds.length > 1 && (
            <>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                type="button"
                onClick={() => onAlign('centerH')}
                className="px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
                title="Ausgewählte Elemente horizontal mittig ausrichten"
              >
                <AlignHorizontalJustifyCenter className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="hidden sm:inline">Mitte H</span>
              </button>
              <button
                type="button"
                onClick={() => onAlign('centerV')}
                className="px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
                title="Ausgewählte Elemente vertikal mittig ausrichten"
              >
                <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="hidden sm:inline">Mitte V</span>
              </button>
              <span className="ml-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] rounded-lg border border-indigo-500/30">
                {selectedNodeIds.length} markiert
              </span>
            </>
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onSelectionDragStop={onSelectionDragStop}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag={isSelectMode}
          panOnDrag={isSelectMode ? [1, 2] : true}
          paneClickDistance={5}
          selectionKeyCode={['Shift', 'Control']}
          multiSelectionKeyCode={['Shift', 'Control']}
          onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
            const ids = selNodes.map((n) => n.id);
            if (ids.length !== selectedNodeIds.length || !ids.every((id) => selectedNodeIds.includes(id))) {
              onSelectNodes(ids);
            }
            if (selNodes.length > 0) {
              onSelectEdge(null);
            } else if (selEdges.length > 0) {
              onSelectEdge(selEdges[0].id);
            } else {
              onSelectEdge(null);
            }
          }}
          onNodeClick={() => {
            onSelectEdge(null);
          }}
          onEdgeClick={(_, edge) => {
            onSelectNodes([]);
            onSelectEdge(edge.id);
          }}
          onPaneClick={() => {
            setGuideLines({ vertical: null, horizontal: null });
            onSelectNodes([]);
            onSelectEdge(null);
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            onSelectEdge(null);
            let newSelected = selectedNodeIds;
            if (!selectedNodeIds.includes(node.id)) {
              newSelected = [node.id];
              onSelectNodes(newSelected);
            }
            const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            let hasSubModels = false;
            let targetModelId: string | undefined = undefined;
            if (node.type === 'model') {
              const nodeData = activeBoard.nodes.find((n) => n.id === node.id);
              if (nodeData && nodeData.kind === 'model') {
                targetModelId = nodeData.modelId;
                const info = getModelHierarchyInfo(project, nodeData.modelId);
                hasSubModels = info.subModels.length > 0;
              }
            }
            onOpenContextMenu(event.clientX, event.clientY, {
              type: 'node',
              nodeId: node.id,
              nodeKind: node.type,
              modelId: targetModelId,
              position: flowPos,
              selectedCount: newSelected.length,
              hasSubModels,
            });
          }}
          onEdgeContextMenu={(event, edge) => {
            event.preventDefault();
            onSelectNodes([]);
            onSelectEdge(edge.id);
            const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            onOpenContextMenu(event.clientX, event.clientY, {
              type: 'edge',
              edgeId: edge.id,
              position: flowPos,
            });
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            onSelectEdge(null);
            const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            onOpenContextMenu(event.clientX, event.clientY, {
              type: 'pane',
              position: flowPos,
            });
          }}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
          defaultViewport={{ x: 50, y: 50, zoom: 0.8 }}
        >
          {/* Smart Alignment Guides */}
          <AlignmentGuideLines
            verticalLine={guideLines.vertical}
            horizontalLine={guideLines.horizontal}
          />

          <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color={theme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.25)'}
        />
        <Controls
          className={
            theme === 'dark'
              ? '!bg-slate-900 !border-slate-800 !text-slate-300 fill-slate-300 [&>button]:!border-slate-800'
              : '!bg-white !border-slate-200 !text-slate-700 fill-slate-700 shadow-md [&>button]:!border-slate-200'
          }
        />
        <MiniMap
          className={
            theme === 'dark'
              ? '!bg-slate-900 !border-slate-800 rounded-lg shadow-xl'
              : '!bg-white !border-slate-200 rounded-lg shadow-md'
          }
          nodeColor={(n) => {
            if (n.type === 'screen') return '#f59e0b';
            if (n.type === 'endpoint') return '#0091FF';
            if (n.type === 'model') return '#FF9F1C';
            if (n.type === 'userAction') return '#FFC21A';
            if (n.type === 'flowRef') return '#a855f7';
            return '#64748b';
          }}
          maskColor={theme === 'dark' ? 'rgba(11, 15, 25, 0.8)' : 'rgba(241, 245, 249, 0.8)'}
        />

        {/* Drag Preview Ghost Box */}
        {dragPreview && (
          <div
            className={`absolute pointer-events-none rounded-lg border-2 border-dashed z-50 p-3 shadow-2xl backdrop-blur-sm transition-all duration-75 ${
              dragPreview.type === 'model'
                ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                : dragPreview.type === 'endpoint'
                ? 'border-blue-400 bg-blue-500/20 text-blue-200'
                : 'border-purple-400 bg-purple-500/20 text-purple-200'
            }`}
            style={{
              left: `${dragPreview.x}px`,
              top: `${dragPreview.y}px`,
              width: '240px',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="flex items-center gap-2 font-bold text-xs truncate">
              {dragPreview.type === 'model' ? (
                <Database className="w-4 h-4 text-orange-400 shrink-0" />
              ) : dragPreview.type === 'endpoint' ? (
                <Globe className="w-4 h-4 text-blue-400 shrink-0" />
              ) : (
                <Workflow className="w-4 h-4 text-purple-400 shrink-0" />
              )}
              {dragPreview.sub && (
                <span className="px-1 bg-white/20 rounded text-[10px] uppercase font-mono">
                  {dragPreview.sub}
                </span>
              )}
              <span className="truncate">{dragPreview.title}</span>
            </div>
            <div className="text-[10px] opacity-75 mt-1">Hier ablegen</div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
};

const AppContent: React.FC = () => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);
  const activeBoardId = useStore((s) => s.activeBoardId);

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [hotspotModalNodeId, setHotspotModalNodeId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'flows' | 'models'>('flows');
  const [modelViewMode, setModelViewMode] = useState<'canvas' | 'tree' | 'erd'>('canvas');
  const lastFlowBoardIdRef = useRef<string | null>(null);
  const lastModelBoardIdRef = useRef<string | null>(null);

  const handleSelectView = useCallback(
    (view: 'flows' | 'models') => {
      if (view === activeView) return;
      if (view === 'models') {
        lastFlowBoardIdRef.current = activeBoardId;
        // Find existing model board or create initial model board
        let mBoard = project.boards.find((b) => b.kind === 'model');
        if (!mBoard) {
          const newMBoard = createModelBoard('Datenmodell 1');
          if (project.models.length > 0) {
            const layout = computeErdLayout(project.models);
            newMBoard.nodes = project.models.map((m) => ({
              id: uid('n_'),
              kind: 'model',
              modelId: m.id,
              position: layout.get(m.id) || { x: 100, y: 100 },
            }));
          }
          store.update((draft) => {
            draft.boards.push(newMBoard);
          });
          mBoard = newMBoard;
        }
        const targetModelId =
          lastModelBoardIdRef.current &&
          project.boards.some((b) => b.id === lastModelBoardIdRef.current && b.kind === 'model')
            ? lastModelBoardIdRef.current
            : mBoard.id;
        store.setActiveBoard(targetModelId);
      } else {
        lastModelBoardIdRef.current = activeBoardId;
        const targetFlowId =
          lastFlowBoardIdRef.current &&
          project.boards.some((b) => b.id === lastFlowBoardIdRef.current && b.kind !== 'model')
            ? lastFlowBoardIdRef.current
            : project.boards.find((b) => b.kind !== 'model')?.id || project.boards[0].id;
        store.setActiveBoard(targetFlowId);
      }
      setActiveView(view);
    },
    [activeView, activeBoardId, project.boards, project.models, store]
  );
  const [plantUmlModalOpen, setPlantUmlModalOpen] = useState(false);
  const [plantUmlModalTab, setPlantUmlModalTab] = useState<'export' | 'import'>('export');
  const [javaModalOpen, setJavaModalOpen] = useState(false);
  const [javaModalTab, setJavaModalTab] = useState<'export' | 'import'>('export');
  const [javaModalModelId, setJavaModalModelId] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenPlantUml = useCallback((tab: 'export' | 'import' = 'export') => {
    setPlantUmlModalTab(tab);
    setPlantUmlModalOpen(true);
  }, []);

  const handleOpenJavaModal = useCallback((tab: 'export' | 'import' = 'export', modelId: string | null = null) => {
    setJavaModalTab(tab);
    setJavaModalModelId(modelId);
    setJavaModalOpen(true);
  }, []);

  const handleOpenAiModal = useCallback(() => {
    setAiModalOpen(true);
  }, []);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextMenuTarget;
  } | null>(null);

  // In-app copied nodes buffer (supports multiple elements)
  const [copiedNodes, setCopiedNodes] = useState<FlowNode[]>([]);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Helper to insert an image as a ScreenNode into the canvas
  const insertScreenFromBlob = useCallback(
    (blob: Blob, name = 'Figma Screen', targetPos?: { x: number; y: number }) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const assetId = uid('a_');
        const newNodeId = uid('n_');

        store.update((draft) => {
          draft.assets[assetId] = {
            id: assetId,
            mime: blob.type || 'image/png',
            width: 280,
            height: 600,
            dataUrl,
          };

          const board = draft.boards.find((b) => b.id === store.getState().activeBoardId) ?? draft.boards[0];
          if (!board) return;

          let pos = targetPos;
          if (!pos) {
            const lastScreen = [...board.nodes].reverse().find((n) => n.kind === 'screen');
            pos = {
              x: lastScreen ? lastScreen.position.x + 320 : 150,
              y: lastScreen ? lastScreen.position.y : 80,
            };
          }

          board.nodes.push({
            id: newNodeId,
            kind: 'screen',
            title: name,
            assetId,
            width: 260,
            hotspots: [],
            position: { x: Math.round(pos.x), y: Math.round(pos.y) },
          });
        });

        setSelectedNodeIds([newNodeId]);
        showToast('📋 Figma Screen erfolgreich eingefügt!');
      };
      reader.readAsDataURL(blob);
    },
    [store, showToast]
  );

  // Direct paste from clipboard via navigator.clipboard or fallback
  const handlePasteFromClipboard = useCallback(async (targetPos?: { x: number; y: number }) => {
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              insertScreenFromBlob(blob, 'Figma Screen', targetPos);
              return;
            }
          }
        }
      }
      showToast('ℹ️ Kein Bild in der Zwischenablage. Kopiere in Figma mit Shift+Strg+C (Copy as PNG)!');
    } catch (err) {
      showToast('⚠️ Zugriff auf Zwischenablage nicht gestattet. Nutze Strg+V direkt auf der Tastatur.');
    }
  }, [insertScreenFromBlob, showToast]);

  // Robust global Paste listener (Catches Ctrl+V from anywhere in the window)
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing text into an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      // Check for copied nodes in buffer first
      if (copiedNodes.length > 0) {
        const newSelectedIds: string[] = [];
        store.update((draft) => {
          const board = draft.boards.find((b) => b.id === activeBoardId);
          if (!board) return;

          for (const node of copiedNodes) {
            const newNodeId = uid('n_');
            newSelectedIds.push(newNodeId);

            const cloned: FlowNode = {
              ...JSON.parse(JSON.stringify(node)),
              id: newNodeId,
              position: {
                x: node.position.x + 40,
                y: node.position.y + 40,
              },
            };

            if (cloned.kind === 'screen') {
              cloned.hotspots = cloned.hotspots.map((h) => ({
                ...h,
                id: uid('h_'),
                triggers: h.triggers.map((t) => ({ ...t, id: uid('t_') })),
              }));
            }

            board.nodes.push(cloned);
          }
        });

        setSelectedNodeIds(newSelectedIds);
        showToast(
          newSelectedIds.length === 1
            ? '📋 Element eingefügt!'
            : `📋 ${newSelectedIds.length} Elemente eingefügt!`
        );
        return;
      }

      // 1. Check clipboard files
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/')) {
            e.preventDefault();
            insertScreenFromBlob(files[i], 'Figma Screen');
            return;
          }
        }
      }

      // 2. Check clipboard items
      const items = e.clipboardData?.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              insertScreenFromBlob(file, 'Figma Screen');
              return;
            }
          }
        }
      }
    };

    window.addEventListener('paste', onWindowPaste, true);
    return () => window.removeEventListener('paste', onWindowPaste, true);
  }, [insertScreenFromBlob, copiedNodes, activeBoardId, store, showToast]);

  // Copy node handler (supports multiple elements)
  const handleCopyNodes = useCallback((nodeId?: string) => {
    let idsToCopy: string[] = [];
    if (nodeId) {
      if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
        idsToCopy = selectedNodeIds;
      } else {
        idsToCopy = [nodeId];
      }
    } else {
      idsToCopy = selectedNodeIds;
    }

    if (idsToCopy.length === 0) return;

    const board = store.getState().project.boards.find((b) => b.id === store.getState().activeBoardId);
    if (!board) return;

    const nodes = board.nodes.filter((n) => idsToCopy.includes(n.id));
    if (nodes.length > 0) {
      setCopiedNodes(JSON.parse(JSON.stringify(nodes)));
      showToast(
        nodes.length === 1
          ? `📋 ${nodes[0].kind.toUpperCase()} kopiert!`
          : `📋 ${nodes.length} Elemente kopiert!`
      );
    }
  }, [selectedNodeIds, store, showToast]);

  // Duplicate node handler (supports multiple elements)
  const handleDuplicateNodes = useCallback((nodeId?: string) => {
    let idsToDup: string[] = [];
    if (nodeId) {
      if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
        idsToDup = selectedNodeIds;
      } else {
        idsToDup = [nodeId];
      }
    } else {
      idsToDup = selectedNodeIds;
    }

    if (idsToDup.length === 0) return;

    const newSelectedIds: string[] = [];
    store.update((draft) => {
      const board = draft.boards.find((b) => b.id === activeBoardId);
      if (!board) return;

      for (const id of idsToDup) {
        const original = board.nodes.find((n) => n.id === id);
        if (!original) continue;

        const newNodeId = uid('n_');
        newSelectedIds.push(newNodeId);

        const cloned: FlowNode = {
          ...JSON.parse(JSON.stringify(original)),
          id: newNodeId,
          position: {
            x: original.position.x + 40,
            y: original.position.y + 40,
          },
        };

        if (cloned.kind === 'screen') {
          cloned.title = `${cloned.title} (Kopie)`;
          cloned.hotspots = cloned.hotspots.map((h) => ({
            ...h,
            id: uid('h_'),
            triggers: h.triggers.map((t) => ({ ...t, id: uid('t_') })),
          }));
        }

        board.nodes.push(cloned);
      }
    });

    if (newSelectedIds.length > 0) {
      setSelectedNodeIds(newSelectedIds);
      showToast(
        newSelectedIds.length === 1
          ? '✨ Element dupliziert!'
          : `✨ ${newSelectedIds.length} Elemente dupliziert!`
      );
    }
  }, [selectedNodeIds, activeBoardId, store, showToast]);

  // Delete node handler (supports multiple elements)
  const handleDeleteNodes = useCallback((nodeIds?: string[] | string) => {
    let idsToDelete: string[] = [];
    if (Array.isArray(nodeIds)) {
      idsToDelete = nodeIds;
    } else if (typeof nodeIds === 'string') {
      if (selectedNodeIds.includes(nodeIds) && selectedNodeIds.length > 1) {
        idsToDelete = selectedNodeIds;
      } else {
        idsToDelete = [nodeIds];
      }
    } else {
      idsToDelete = selectedNodeIds;
    }

    if (idsToDelete.length === 0) return;

    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId);
      if (b) removeNodes(b, new Set(idsToDelete));
    });

    setSelectedNodeIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
    showToast(
      idsToDelete.length === 1
        ? '🗑️ Element gelöscht!'
        : `🗑️ ${idsToDelete.length} Elemente gelöscht!`
    );
  }, [selectedNodeIds, activeBoardId, store, showToast]);

  // Delete edge handler
  const handleDeleteEdge = useCallback((edgeId?: string) => {
    const idToDelete = edgeId || selectedEdgeId;
    if (!idToDelete) return;

    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId);
      if (b) removeEdges(b, new Set([idToDelete]));
    });

    if (selectedEdgeId === idToDelete) {
      setSelectedEdgeId(null);
    }
    showToast('🗑️ Verbindung gelöscht!');
  }, [selectedEdgeId, activeBoardId, store, showToast]);

  // Listen for delete edge events from custom StepWithDeleteEdge component
  useEffect(() => {
    const handleDeleteEdgeEvent = (e: CustomEvent<{ edgeId: string }>) => {
      handleDeleteEdge(e.detail.edgeId);
    };
    window.addEventListener('eventflow:delete-edge' as any, handleDeleteEdgeEvent);
    return () => {
      window.removeEventListener('eventflow:delete-edge' as any, handleDeleteEdgeEvent);
    };
  }, [handleDeleteEdge]);

  // Paste handler for context menu
  const handleContextMenuPaste = useCallback((flowPos: { x: number; y: number }) => {
    if (copiedNodes.length > 0) {
      const minX = Math.min(...copiedNodes.map((n) => n.position.x));
      const minY = Math.min(...copiedNodes.map((n) => n.position.y));
      const newSelectedIds: string[] = [];

      store.update((draft) => {
        const board = draft.boards.find((b) => b.id === activeBoardId);
        if (!board) return;

        for (const node of copiedNodes) {
          const newNodeId = uid('n_');
          newSelectedIds.push(newNodeId);

          const offsetX = node.position.x - minX;
          const offsetY = node.position.y - minY;

          const cloned: FlowNode = {
            ...JSON.parse(JSON.stringify(node)),
            id: newNodeId,
            position: {
              x: Math.round(flowPos.x + offsetX),
              y: Math.round(flowPos.y + offsetY),
            },
          };

          if (cloned.kind === 'screen') {
            cloned.hotspots = cloned.hotspots.map((h) => ({
              ...h,
              id: uid('h_'),
              triggers: h.triggers.map((t) => ({ ...t, id: uid('t_') })),
            }));
          }

          board.nodes.push(cloned);
        }
      });

      setSelectedNodeIds(newSelectedIds);
      showToast(
        newSelectedIds.length === 1
          ? '📋 Element an Mausposition eingefügt!'
          : `📋 ${newSelectedIds.length} Elemente eingefügt!`
      );
    } else {
      // Fallback: paste image from system clipboard at position
      handlePasteFromClipboard(flowPos);
    }
  }, [copiedNodes, activeBoardId, store, handlePasteFromClipboard, showToast]);

  // Node edit handler for context menu
  const handleContextMenuEdit = useCallback((nodeId: string) => {
    const board = store.getState().project.boards.find((b) => b.id === store.getState().activeBoardId);
    const node = board?.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.kind === 'screen') {
      setHotspotModalNodeId(node.id);
    } else if (node.kind === 'model') {
      setEditingModelId(node.modelId);
    } else if (node.kind === 'endpoint') {
      setEditingEndpointId(node.endpointId);
    }
  }, [store]);

  // Context menu creation handlers
  const handleCreateEndpoint = useCallback((pos: { x: number; y: number }) => {
    const newEp = createEndpoint('GET', `Taetigkeiten / neu_${project.endpoints.length + 1}`);
    const nodeId = uid('n_');
    store.update((draft) => {
      draft.endpoints.push(newEp);
      const b = draft.boards.find((item) => item.id === activeBoardId);
      if (b) {
        b.nodes.push({
          id: nodeId,
          kind: 'endpoint',
          endpointId: newEp.id,
          position: pos,
        });
      }
    });
    setSelectedNodeIds([nodeId]);
    showToast(`API-Endpoint "${newEp.path}" erstellt`);
  }, [project.endpoints.length, activeBoardId, store, showToast]);

  const handleCreateModel = useCallback((pos: { x: number; y: number }) => {
    const newModel = createModel(`NeuesModel${project.models.length + 1}`);
    const nodeId = uid('n_');
    store.update((draft) => {
      draft.models.push(newModel);
      const b = draft.boards.find((item) => item.id === activeBoardId);
      if (b) {
        b.nodes.push({
          id: nodeId,
          kind: 'model',
          modelId: newModel.id,
          position: pos,
        });
      }
    });
    setSelectedNodeIds([nodeId]);
    showToast(`Model "${newModel.name}" erstellt`);
  }, [project.models.length, activeBoardId, store, showToast]);

  const handleCreateUserAction = useCallback((pos: { x: number; y: number }) => {
    const nodeId = uid('n_');
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId);
      if (b) {
        b.nodes.push({
          id: nodeId,
          kind: 'userAction',
          label: 'User Aktion',
          position: pos,
        });
      }
    });
    setSelectedNodeIds([nodeId]);
    showToast('User Action erstellt');
  }, [activeBoardId, store, showToast]);

  const handleCreateNote = useCallback((pos: { x: number; y: number }) => {
    const nodeId = uid('n_');
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === activeBoardId);
      if (b) {
        b.nodes.push({
          id: nodeId,
          kind: 'note',
          text: '',
          position: pos,
        });
      }
    });
    setSelectedNodeIds([nodeId]);
    showToast('Notiz erstellt');
  }, [activeBoardId, store, showToast]);

  const handleInsertSubModelsForNode = useCallback((nodeId: string) => {
    let addedCount = 0;
    let newIds: string[] = [];
    store.update((draft) => {
      const b = draft.boards.find((board) => board.id === activeBoardId);
      if (!b) return;
      const res = insertSubModelsForNode(b, draft, nodeId);
      addedCount = res.createdNodeIds.length;
      newIds = res.createdNodeIds;
    });
    if (addedCount > 0) {
      setSelectedNodeIds(newIds);
      showToast(`✨ ${addedCount} Untermodelle eingefügt und verbunden!`);
    } else {
      showToast('ℹ️ Alle Untermodelle sind bereits auf diesem Board vorhanden.');
    }
  }, [activeBoardId, store, showToast]);

  const handleAlignSelection = useCallback(
    (mode: AlignmentMode) => {
      if (selectedNodeIds.length <= 1) return;
      const currentBoard = project.boards.find((b) => b.id === activeBoardId);
      if (!currentBoard) return;
      const nodesToAlign = currentBoard.nodes.filter((n) => selectedNodeIds.includes(n.id));
      const updates = alignNodes(nodesToAlign, mode);
      if (updates.length > 0) {
        store.update((draft) => {
          const b = draft.boards.find((board) => board.id === activeBoardId);
          if (!b) return;
          for (const u of updates) {
            const n = b.nodes.find((item) => item.id === u.id);
            if (n) {
              n.position = u.position;
            }
          }
        });
        const label =
          mode === 'centerH'
            ? 'Horizontal mittig zentriert'
            : mode === 'centerV'
            ? 'Vertikal mittig zentriert'
            : 'Ausgerichtet';
        showToast(`✨ ${updates.length} Elemente ${label}`);
      }
    },
    [selectedNodeIds, project.boards, activeBoardId, store, showToast]
  );

  // Listen to custom node edit events
  useEffect(() => {
    const handleOpenHotspots = (e: CustomEvent<{ nodeId: string }>) => {
      setHotspotModalNodeId(e.detail.nodeId);
    };
    const handleEditModel = (e: CustomEvent<{ modelId: string }>) => {
      setEditingModelId(e.detail.modelId);
    };
    const handleEditEndpoint = (e: CustomEvent<{ endpointId: string }>) => {
      setEditingEndpointId(e.detail.endpointId);
    };

    window.addEventListener('eventflow:open-hotspots' as any, handleOpenHotspots);
    window.addEventListener('eventflow:edit-model' as any, handleEditModel);
    window.addEventListener('eventflow:edit-endpoint' as any, handleEditEndpoint);

    return () => {
      window.removeEventListener('eventflow:open-hotspots' as any, handleOpenHotspots);
      window.removeEventListener('eventflow:edit-model' as any, handleEditModel);
      window.removeEventListener('eventflow:edit-endpoint' as any, handleEditEndpoint);
    };
  }, []);

  // Global keyboard shortcuts (Undo, Redo, Copy, Duplicate, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          handleCopyNodes();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          handleDuplicateNodes();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          handleDeleteNodes();
        } else if (selectedEdgeId) {
          e.preventDefault();
          handleDeleteEdge(selectedEdgeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, selectedNodeIds, selectedEdgeId, handleCopyNodes, handleDuplicateNodes, handleDeleteNodes, handleDeleteEdge]);

  return (
    <div
      ref={canvasContainerRef}
      tabIndex={0}
      className="h-full w-full flex flex-col bg-slate-100 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 select-none overflow-hidden outline-none transition-colors"
    >
      {/* Top Navigation */}
      <TopBar
        activeView={activeView}
        onSelectView={handleSelectView}
        modelViewMode={modelViewMode}
        onSelectModelViewMode={setModelViewMode}
        onOpenPlantUmlExport={() => handleOpenPlantUml('export')}
        onOpenPlantUmlModal={handleOpenPlantUml}
        onOpenJavaModal={(tab) => handleOpenJavaModal(tab)}
        onOpenAiModal={handleOpenAiModal}
        onEditModel={(id) => setEditingModelId(id)}
        onEditEndpoint={(id) => setEditingEndpointId(id)}
        onPasteFromClipboard={() => handlePasteFromClipboard()}
      />

      {/* Main Workspace Area */}
      {activeView === 'flows' ? (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar */}
          <Sidebar
            onEditModel={(id) => setEditingModelId(id)}
            onEditEndpoint={(id) => setEditingEndpointId(id)}
            onOpenDataModelsView={() => handleSelectView('models')}
            onOpenJavaModal={(tab) => handleOpenJavaModal(tab)}
            onOpenAiModal={handleOpenAiModal}
          />

          {/* Center: React Flow Canvas with Provider */}
          <main className="flex-1 h-full w-full relative bg-slate-100 dark:bg-[#0b0f19]">
            <ReactFlowProvider>
              <CanvasInner
                onSelectNodes={setSelectedNodeIds}
                selectedNodeIds={selectedNodeIds}
                selectedEdgeId={selectedEdgeId}
                onSelectEdge={setSelectedEdgeId}
                onShowToast={showToast}
                onAlign={handleAlignSelection}
                onOpenContextMenu={(x, y, target) => {
                  setContextMenu({ x, y, target });
                }}
              />
            </ReactFlowProvider>

            {/* Context Menu Modal / Dropdown */}
            {contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                target={contextMenu.target}
                onClose={() => setContextMenu(null)}
                onCopy={() => handleCopyNodes(contextMenu.target.nodeId)}
                onPaste={(pos) => handleContextMenuPaste(pos)}
                onDuplicate={(nodeId) => handleDuplicateNodes(nodeId)}
                onDelete={(nodeId) => handleDeleteNodes(nodeId)}
                onDeleteEdge={(edgeId) => handleDeleteEdge(edgeId)}
                onEdit={handleContextMenuEdit}
                onInsertSubModels={handleInsertSubModelsForNode}
                onCreateEndpoint={handleCreateEndpoint}
                onCreateModel={handleCreateModel}
                onCreateUserAction={handleCreateUserAction}
                onCreateNote={handleCreateNote}
                onAlign={handleAlignSelection}
                hasClipboardContent={copiedNodes.length > 0}
                onOpenPlantUmlExport={() => handleOpenPlantUml('export')}
                onOpenPlantUmlImport={() => handleOpenPlantUml('import')}
                onOpenJavaModal={(tab, modelId) => handleOpenJavaModal(tab, modelId ?? null)}
                onOpenAiModal={handleOpenAiModal}
              />
            )}
          </main>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          <DataModelsView
            viewMode={modelViewMode}
            onViewModeChange={setModelViewMode}
            onEditModel={(id) => setEditingModelId(id)}
            onOpenPlantUmlExport={() => handleOpenPlantUml('export')}
            onOpenPlantUmlImport={() => handleOpenPlantUml('import')}
            onOpenJavaModal={handleOpenJavaModal}
            onOpenAiModal={handleOpenAiModal}
            onShowToast={showToast}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-slate-900/95 border border-amber-500/50 text-amber-700 dark:text-amber-300 text-xs px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <HotspotEditorModal
        nodeId={hotspotModalNodeId}
        onClose={() => setHotspotModalNodeId(null)}
      />

      <ModelQuickEditModal
        modelId={editingModelId}
        onClose={() => setEditingModelId(null)}
      />

      <EndpointQuickEditModal
        endpointId={editingEndpointId}
        onClose={() => setEditingEndpointId(null)}
      />

      <PlantUmlExportModal
        isOpen={plantUmlModalOpen}
        initialTab={plantUmlModalTab}
        onClose={() => setPlantUmlModalOpen(false)}
        onShowToast={showToast}
        onOpenFlowsView={() => setActiveView('flows')}
        onOpenAiModal={handleOpenAiModal}
      />

      <JavaModal
        isOpen={javaModalOpen}
        initialTab={javaModalTab}
        selectedModelId={javaModalModelId}
        onClose={() => {
          setJavaModalOpen(false);
          setJavaModalModelId(null);
        }}
        onShowToast={showToast}
      />

      <AiImportModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onShowToast={showToast}
      />

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};
