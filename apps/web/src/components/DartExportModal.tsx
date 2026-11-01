import React, { useState } from 'react';
import { useStore } from '../storeContext';
import { exportAllModelsToDart } from '@eventflow/core';
import { X, Copy, Download, Check, FileCode } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DartExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const project = useStore((s) => s.project);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const dartCode = exportAllModelsToDart(project);

  const handleCopy = () => {
    navigator.clipboard.writeText(dartCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([dartCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_models.dart`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">Dart Model-Code Export</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generierte Dart-Klassen mit Konstruktoren, fromJson & toJson für alle Models.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 overflow-auto font-mono text-xs text-slate-800 dark:text-slate-300 leading-relaxed border-y border-slate-200 dark:border-slate-800">
          <pre>{dartCode}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {project.models.length} Model{project.models.length === 1 ? '' : 's'} generiert
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Kopiert!' : 'In Zwischenablage'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Als .dart herunterladen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
