import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { useStore, useEditorStore } from '../storeContext';
import type { EndpointNode as EndpointNodeType, Endpoint, Field, HttpMethod } from '@eventflow/core';
import { fieldsFromText } from '@eventflow/core';
import { Globe, Plus, Trash2, Check, X, Edit2, Code2 } from 'lucide-react';

interface Props {
  id: string;
  data: EndpointNodeType & { endpoint?: Endpoint; params?: Endpoint['params'] };
  selected?: boolean;
}

export const EndpointNode = memo(({ id, data, selected }: Props) => {
  const store = useEditorStore();
  const storeEndpoint = useStore((s) => s.project.endpoints.find((e) => e.id === data.endpointId));
  const endpoint = data.endpoint ?? storeEndpoint;

  // Path inline editing
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState('');

  // Param inline editing
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [paramDraftType, setParamDraftType] = useState('String');
  const [paramDraftName, setParamDraftName] = useState('');
  const [paramDraftNullable, setParamDraftNullable] = useState(false);

  // New param input
  const [isAddingParam, setIsAddingParam] = useState(false);
  const [newParamRaw, setNewParamRaw] = useState('');
  const newParamInputRef = useRef<HTMLInputElement>(null);

  const handleResizeEnd = (_: unknown, params: { x: number; y: number; width: number; height: number }) => {
    store.update((draft) => {
      const b = draft.boards.find((item) => item.id === store.getState().activeBoardId);
      const n = b?.nodes.find((item) => item.id === id);
      if (n) {
        n.width = Math.round(params.width);
        n.height = Math.round(params.height);
        n.position = { x: Math.round(params.x), y: Math.round(params.y) };
      }
    });
  };

  useEffect(() => {
    if (endpoint) {
      setPathDraft(endpoint.path);
    }
  }, [endpoint?.path]);

  useEffect(() => {
    if (isAddingParam) {
      newParamInputRef.current?.focus();
    }
  }, [isAddingParam]);

  if (!endpoint) {
    return (
      <div className="px-4 py-2 bg-red-950/80 border border-red-500 text-red-200 rounded-md text-xs">
        Endpoint wurde gelöscht
      </div>
    );
  }

  // Method change
  const handleMethodChange = (newMethod: HttpMethod) => {
    store.update((draft) => {
      const ep = draft.endpoints.find((item) => item.id === endpoint.id);
      if (ep) ep.method = newMethod;
    });
  };

  // Path save
  const handleSavePath = () => {
    const trimmed = pathDraft.trim();
    if (trimmed && trimmed !== endpoint.path) {
      store.update((draft) => {
        const ep = draft.endpoints.find((item) => item.id === endpoint.id);
        if (ep) ep.path = trimmed;
      });
    } else {
      setPathDraft(endpoint.path);
    }
    setIsEditingPath(false);
  };

  // Add param
  const handleAddParam = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = newParamRaw.trim();
    if (!raw) {
      setIsAddingParam(false);
      return;
    }
    const textToParse = raw.includes(' ') ? raw : `String ${raw}`;
    const parsed = fieldsFromText(textToParse, []);
    if (parsed.length > 0) {
      store.update((draft) => {
        const ep = draft.endpoints.find((item) => item.id === endpoint.id);
        if (ep) {
          if (!Array.isArray(ep.params)) ep.params = [];
          ep.params.push(parsed[0]);
        }
      });
      setNewParamRaw('');
      setIsAddingParam(false);
    }
  };

  // Delete param
  const handleDeleteParam = (paramId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.update((draft) => {
      const ep = draft.endpoints.find((item) => item.id === endpoint.id);
      if (ep) {
        ep.params = (ep.params || []).filter((p) => p.id !== paramId);
      }
      for (const b of draft.boards) {
        b.edges = b.edges.filter(
          (edge) =>
            edge.sourceHandle !== `param-out-${paramId}` &&
            edge.targetHandle !== `param-in-${paramId}`
        );
      }
    });
  };

  // Start param edit
  const handleStartEditParam = (param: Field, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingParamId(param.id);
    setParamDraftType(param.type);
    setParamDraftName(param.name);
    setParamDraftNullable(param.nullable);
  };

  // Save param edit
  const handleSaveParamEdit = () => {
    if (!editingParamId) return;
    const trimmedName = paramDraftName.trim();
    if (trimmedName) {
      store.update((draft) => {
        const ep = draft.endpoints.find((item) => item.id === endpoint.id);
        if (ep) {
          const p = (ep.params || []).find((item) => item.id === editingParamId);
          if (p) {
            p.type = paramDraftType.trim() || 'String';
            p.name = trimmedName;
            p.nullable = paramDraftNullable;
          }
        }
      });
    }
    setEditingParamId(null);
  };

  // Open modal fallback
  const openModalEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('eventflow:edit-endpoint', { detail: { endpointId: data.endpointId } }));
  };

  return (
    <div
      className={`relative w-full h-full min-w-[200px] min-h-[80px] rounded-lg shadow-lg dark:shadow-xl transition-all duration-150 border flex flex-col ${
        selected ? 'border-white ring-2 ring-blue-500' : 'border-blue-400/50 hover:border-blue-300'
      } bg-[#0091FF] text-white group`}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={80}
        color="#0091FF"
        onResizeEnd={handleResizeEnd}
      />
      {/* Target handle on Top */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-white !w-3 !h-3 !border-2 !border-blue-600 shadow-sm"
      />
      {/* Target handle on Left */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-white !w-3 !h-3 !border-2 !border-blue-600"
      />

      {/* Header */}
      <div className="p-2.5 bg-[#007AE0] flex items-center justify-between border-b border-blue-400/30 rounded-t-lg">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1">
          <Globe className="w-4 h-4 opacity-80 shrink-0" />

          {/* Interactive method selector */}
          <select
            value={endpoint.method}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
            className="nodrag nopan bg-white/20 hover:bg-white/30 text-white font-extrabold text-[11px] uppercase rounded px-1.5 py-0.5 outline-none cursor-pointer border border-white/30 shrink-0"
            title="Methode ändern"
          >
            <option value="GET" className="text-slate-900 bg-white">GET</option>
            <option value="POST" className="text-slate-900 bg-white">POST</option>
            <option value="PUT" className="text-slate-900 bg-white">PUT</option>
            <option value="PATCH" className="text-slate-900 bg-white">PATCH</option>
            <option value="DELETE" className="text-slate-900 bg-white">DELETE</option>
          </select>

          {/* Inline path edit */}
          {isEditingPath ? (
            <input
              type="text"
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePath();
                if (e.key === 'Escape') {
                  setPathDraft(endpoint.path);
                  setIsEditingPath(false);
                }
              }}
              onBlur={handleSavePath}
              autoFocus
              className="nodrag nopan px-1.5 py-0.5 bg-white text-slate-900 rounded text-xs font-bold w-full outline-none ring-2 ring-white shadow-sm"
            />
          ) : (
            <span
              onClick={() => setIsEditingPath(true)}
              className="truncate cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded transition-colors text-xs font-bold"
              title="Klicken zum Bearbeiten des Pfads"
            >
              {endpoint.path}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setIsEditingPath(!isEditingPath)}
            title="Pfad bearbeiten"
            className="p-1 hover:bg-white/20 rounded text-white opacity-60 hover:opacity-100 transition-opacity"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={openModalEditor}
            title="Erweiterten Text-Editor öffnen"
            className="p-1 hover:bg-white/20 rounded text-white opacity-50 hover:opacity-100 transition-opacity"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Parameters */}
      <div className="p-2.5 text-xs font-mono space-y-1 rounded-b-lg flex-1 overflow-y-auto">
        {(!Array.isArray(endpoint.params) || endpoint.params.length === 0) && !isAddingParam ? (
          <div className="text-blue-100/70 italic text-[11px] py-1 text-center">
            Keine Parameter vorhanden
          </div>
        ) : (
          (Array.isArray(endpoint.params) ? endpoint.params : []).map((param) => {
            const isEditingThisParam = editingParamId === param.id;
            const isRequired = !param.nullable;

            if (isEditingThisParam) {
              return (
                <div
                  key={param.id}
                  className="p-1.5 bg-blue-700/80 rounded border border-blue-300 space-y-1 nodrag nopan text-white"
                >
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={paramDraftType}
                      onChange={(e) => setParamDraftType(e.target.value)}
                      placeholder="Typ (z.B. String)"
                      className="w-1/2 px-1.5 py-0.5 bg-white text-slate-900 rounded text-[11px] outline-none"
                    />
                    <input
                      type="text"
                      value={paramDraftName}
                      onChange={(e) => setParamDraftName(e.target.value)}
                      placeholder="Name"
                      className="w-1/2 px-1.5 py-0.5 bg-white text-slate-900 rounded text-[11px] outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-1 text-[10px] text-blue-100 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={paramDraftNullable}
                        onChange={(e) => setParamDraftNullable(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-0 w-3 h-3"
                      />
                      Optional (?)
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSaveParamEdit}
                        className="p-0.5 bg-white text-blue-700 font-bold rounded hover:bg-blue-50 transition-colors"
                        title="Speichern"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                      <button
                        onClick={() => setEditingParamId(null)}
                        className="p-0.5 bg-blue-900/60 text-white rounded hover:bg-blue-900 transition-colors"
                        title="Abbrechen"
                      >
                        <X className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={param.id}
                className="relative flex items-center justify-between gap-1 leading-tight px-1.5 py-1 rounded hover:bg-blue-800/40 group/row"
              >
                {/* Row Target Handle */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`param-in-${param.id}`}
                  className="!bg-white !w-2.5 !h-2.5 !border-2 !border-blue-600 !-left-2 opacity-35 group-hover/row:opacity-100 transition-opacity shadow-sm"
                  title={`Zu Parameter: ${param.name}`}
                />

                <div
                  onClick={(e) => handleStartEditParam(param, e)}
                  className="truncate flex-1 cursor-pointer select-none"
                  title="Klicken zum Bearbeiten"
                >
                  <span className={isRequired ? 'font-bold text-white' : 'text-blue-100/90'}>
                    {isRequired && <span className="text-yellow-300 mr-0.5">+</span>}
                    <span className="text-blue-200">{param.type}{param.nullable ? '?' : ''}</span>{' '}
                    <span className="text-white">{param.name}</span>
                  </span>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleStartEditParam(param, e)}
                    className="p-0.5 text-blue-200 hover:text-white transition-colors"
                    title="Parameter bearbeiten"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteParam(param.id, e)}
                    className="p-0.5 text-blue-200 hover:text-red-300 transition-colors"
                    title="Parameter löschen"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Row Source Handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`param-out-${param.id}`}
                  className="!bg-white !w-2.5 !h-2.5 !border-2 !border-blue-600 !-right-2 opacity-35 group-hover/row:opacity-100 transition-opacity shadow-sm"
                  title={`Von Parameter: ${param.name}`}
                />
              </div>
            );
          })
        )}

        {/* Inline Add Parameter Row */}
        {isAddingParam ? (
          <form onSubmit={handleAddParam} className="pt-1 nodrag nopan">
            <div className="flex items-center gap-1 bg-blue-800/60 p-1.5 rounded border border-blue-400/50">
              <input
                ref={newParamInputRef}
                type="text"
                value={newParamRaw}
                onChange={(e) => setNewParamRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsAddingParam(false);
                }}
                placeholder="z.B. String uuid oder +int page"
                className="flex-1 px-1.5 py-0.5 bg-white text-slate-900 rounded text-[11px] outline-none"
              />
              <button
                type="submit"
                className="px-2 py-0.5 bg-white text-blue-700 font-bold text-[10px] rounded hover:bg-blue-50 transition-colors"
                title="Hinzufügen"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setIsAddingParam(false)}
                className="p-0.5 text-blue-200 hover:text-white transition-colors"
                title="Abbrechen"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-1.5">
            <button
              onClick={() => setIsAddingParam(true)}
              className="w-full py-1 px-2 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Parameter hinzufügen
            </button>
          </div>
        )}
      </div>

      {/* Source handle on Bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-white !w-3 !h-3 !border-2 !border-blue-600"
      />
      {/* Source handle on Right */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-white !w-3 !h-3 !border-2 !border-blue-600"
      />
    </div>
  );
});

EndpointNode.displayName = 'EndpointNode';
