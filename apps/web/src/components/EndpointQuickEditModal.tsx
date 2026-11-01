import React, { useState, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import { fieldsFromText, fieldsToText } from '@eventflow/core';
import type { HttpMethod } from '@eventflow/core';
import { X, Check, Globe } from 'lucide-react';

interface Props {
  endpointId: string | null;
  onClose: () => void;
}

export const EndpointQuickEditModal: React.FC<Props> = ({ endpointId, onClose }) => {
  const store = useEditorStore();
  const endpoint = useStore((s) => (endpointId ? s.project.endpoints.find((e) => e.id === endpointId) : null));
  const models = useStore((s) => s.project.models);

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState('');
  const [paramsText, setParamsText] = useState('');
  const [responseModelId, setResponseModelId] = useState<string>('');

  useEffect(() => {
    if (endpoint) {
      setMethod(endpoint.method);
      setPath(endpoint.path);
      setParamsText(fieldsToText(endpoint.params, 'params'));
      setResponseModelId(endpoint.responseModelId || '');
    }
  }, [endpoint]);

  if (!endpointId || !endpoint) return null;

  const parsedParams = fieldsFromText(paramsText, endpoint.params);

  const handleSave = () => {
    store.update((draft) => {
      const targetEp = draft.endpoints.find((e) => e.id === endpoint.id);
      if (targetEp) {
        targetEp.method = method;
        targetEp.path = path.trim();
        targetEp.params = parsedParams;
        targetEp.responseModelId = responseModelId || undefined;
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">API Endpoint bearbeiten</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Passe Methode, Pfad und Query/Body-Parameter an.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="w-32">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Methode</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-blue-600 dark:text-blue-300 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">Pfad / Name</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="z.B. Taetigkeiten / Positionen"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">
              Response Model (Ergebnis)
            </label>
            <select
              value={responseModelId}
              onChange={(e) => setResponseModelId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="">Kein Response Model verknüpft</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-400">
                Parameter ({parsedParams.length} erkannt)
              </label>
              <span className="text-[11px] text-slate-500">
                <code className="text-blue-600 dark:text-blue-300">+String uuid</code> (Pflicht) oder{' '}
                <code className="text-blue-600 dark:text-blue-300">bool? flag</code> (Optional)
              </span>
            </div>
            <textarea
              rows={6}
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              placeholder={`+String taetigkeitUuid\nbool? unvollstaendig\nString? query\n+ int page`}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Check className="w-4 h-4" /> Speichern
          </button>
        </div>
      </div>
    </div>
  );
};
