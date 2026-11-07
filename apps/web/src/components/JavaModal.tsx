import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, useEditorStore } from '../storeContext';
import {
  exportModelToJava,
  exportAllModelsToJava,
  parseJavaCode,
  importJavaIntoProject,
  type JavaExportStyle,
  type JavaExportOptions,
  type Model,
} from '@eventflow/core';
import {
  X,
  Copy,
  Download,
  Upload,
  Check,
  FileCode,
  Database,
  Coffee,
  Sparkles,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Layers,
  Settings,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  initialTab?: 'export' | 'import';
  selectedModelId?: string | null;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

const SAMPLE_RECORD_JAVA = `package com.example.models;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

public record CustomerDto(
    @NotNull String id,
    @JsonProperty("company_name") String companyName,
    String email,
    @Nullable Integer creditScore,
    boolean active,
    List<OrderDto> orders
) {}

public record OrderDto(
    String orderId,
    double totalAmount,
    String status
) {}
`;

const SAMPLE_POJO_JAVA = `package com.example.models;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

public class ProductDto {
    @JsonProperty("sku")
    private String sku;
    private String title;
    private Double price;
    private boolean inStock;
    private List<String> categories;

    public ProductDto() {
    }

    public ProductDto(String sku, String title, Double price) {
        this.sku = sku;
        this.title = title;
        this.price = price;
    }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
`;

export const JavaModal: React.FC<Props> = ({
  isOpen,
  initialTab = 'export',
  selectedModelId = null,
  onClose,
  onShowToast,
}) => {
  const store = useEditorStore();
  const project = useStore((s) => s.project);

  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Export States
  const [exportTarget, setExportTarget] = useState<string>(selectedModelId || 'all');
  const [exportStyle, setExportStyle] = useState<JavaExportStyle>('record');
  const [packageName, setPackageName] = useState('com.example.models');
  const [useJackson, setUseJackson] = useState(true);
  const [copied, setCopied] = useState(false);

  // Sync selectedModelId if passed
  useEffect(() => {
    if (selectedModelId) {
      setExportTarget(selectedModelId);
    }
  }, [selectedModelId]);

  // Import States
  const [importCode, setImportCode] = useState(SAMPLE_RECORD_JAVA);
  const [mergeExisting, setMergeExisting] = useState(true);
  const [createReferencedModels, setCreateReferencedModels] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Compute Generated Java Code
  const generatedJavaCode = useMemo(() => {
    const options: JavaExportOptions = {
      style: exportStyle,
      packageName,
      useJackson,
    };

    if (exportTarget === 'all') {
      return exportAllModelsToJava(project, options);
    } else {
      const model = project.models.find((m) => m.id === exportTarget);
      if (!model) return '// Model nicht gefunden';
      return exportModelToJava(model, options);
    }
  }, [project, exportTarget, exportStyle, packageName, useJackson]);

  // Compute Import Live Preview
  const previewParse = useMemo(() => {
    if (!importCode.trim()) return null;
    return parseJavaCode(importCode);
  }, [importCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedJavaCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast?.('Java-Code in die Zwischenablage kopiert!');
  };

  const handleDownload = () => {
    const blob = new Blob([generatedJavaCode], { type: 'text/x-java-source;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename =
      exportTarget === 'all'
        ? `${project.name.toLowerCase().replace(/\s+/g, '_')}_models.java`
        : `${project.models.find((m) => m.id === exportTarget)?.name || 'Model'}.java`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.(`Datei "${filename}" heruntergeladen!`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportCode(content);
        onShowToast?.(`Java-Datei "${file.name}" geladen`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteImport = () => {
    if (!importCode.trim()) return;

    store.update((draft) => {
      const res = importJavaIntoProject(draft, importCode, {
        mergeExisting,
        createReferencedModels,
      });

      const total = res.createdCount + res.updatedCount;
      const refMsg = res.referencedCreatedCount > 0 ? ` (+${res.referencedCreatedCount} Untermodelle)` : '';
      onShowToast?.(
        `Erfolgreich ${total} Java-Modell${total === 1 ? '' : 'e'} importiert${refMsg}!`
      );
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/30">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Java Datenmodellierung
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 font-mono">
                  Records & POJOs
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Java-Klassen & Records aus bestehenden Modellen generieren oder per Code-Import neue Modelle anlegen.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('export')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'export'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export (Java Code)</span>
              </button>
              <button
                onClick={() => setActiveTab('import')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'import'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import (Java Code)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-2"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'export' ? (
          /* ======================== EXPORT TAB ======================== */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Options Bar */}
            <div className="px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Target Model Selection */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Modell:</span>
                  <select
                    value={exportTarget}
                    onChange={(e) => setExportTarget(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="all">Alle Modelle ({project.models.length})</option>
                    <optgroup label="Einzelne Modelle">
                      {project.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.fields.length} Felder)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Java Style Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Format:</span>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setExportStyle('record')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                        exportStyle === 'record'
                          ? 'bg-amber-500 text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Moderne Java Records (Java 16+)"
                    >
                      Record
                    </button>
                    <button
                      onClick={() => setExportStyle('pojo')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                        exportStyle === 'pojo'
                          ? 'bg-amber-500 text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Standard JavaBean POJO mit Konstruktoren, Gettern/Settern"
                    >
                      POJO (JavaBean)
                    </button>
                    <button
                      onClick={() => setExportStyle('lombok')}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                        exportStyle === 'lombok'
                          ? 'bg-amber-500 text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="Lombok-Klasse mit @Data und @Builder"
                    >
                      Lombok
                    </button>
                  </div>
                </div>

                {/* Package Name Input */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Package:</span>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="com.example.models"
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-mono w-44 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Jackson Annotations Toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={useJackson}
                    onChange={(e) => setUseJackson(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Jackson (@JsonProperty)</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.java Datei herunterladen</span>
                </button>
              </div>
            </div>

            {/* Code Output Viewer */}
            <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 overflow-auto font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed border-t border-slate-200 dark:border-slate-800 select-text">
              <pre className="whitespace-pre">{generatedJavaCode}</pre>
            </div>
          </div>
        ) : (
          /* ======================== IMPORT TAB ======================== */
          <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            {/* Left: Input Editor */}
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Java Quellcode einfügen
                  </span>
                  <span className="text-[11px] text-slate-400">
                    (Unterstützt Records & Klassen)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sample inserts */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400">Beispiel:</span>
                    <button
                      onClick={() => setImportCode(SAMPLE_RECORD_JAVA)}
                      className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline px-1 py-0.5"
                    >
                      Record
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      onClick={() => setImportCode(SAMPLE_POJO_JAVA)}
                      className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline px-1 py-0.5"
                    >
                      POJO
                    </button>
                  </div>

                  <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />

                  {/* File upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".java,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-2xs"
                  >
                    <Upload className="w-3 h-3 text-amber-500" />
                    <span>.java Datei laden</span>
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="flex-1 p-3 min-h-0 bg-slate-50 dark:bg-slate-950">
                <textarea
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value)}
                  placeholder="Füge hier Java-Records oder Java-Klassen ein..."
                  className="w-full h-full p-3 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none leading-relaxed"
                />
              </div>

              {/* Import Options */}
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mergeExisting}
                      onChange={(e) => setMergeExisting(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Bestehende Modelle aktualisieren (Merge)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createReferencedModels}
                      onChange={(e) => setCreateReferencedModels(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Referenzierte Untermodelle automatisch anlegen</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Live Preview of Parsed Models */}
            <div className="w-full md:w-96 flex flex-col min-h-0 bg-white dark:bg-slate-900">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Erkannte Modelle
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  {previewParse?.models.length || 0} gefunden
                </span>
              </div>

              {/* Model Cards List */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0">
                {!previewParse || previewParse.models.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
                    <HelpCircle className="w-8 h-8 stroke-1 mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs">Keine Java-Records oder Klassen erkannt.</p>
                    <p className="text-[11px] mt-1 text-slate-400">
                      Füge links gültigen Java-Code ein oder klicke auf "Beispiel".
                    </p>
                  </div>
                ) : (
                  previewParse.models.map((model, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/60 dark:bg-slate-850/60 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800/80 pb-2 mb-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <Database className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {model.name}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {model.kind}
                        </span>
                      </div>

                      {/* Fields Table */}
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {model.fields.map((f, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex items-center justify-between text-[11px] py-0.5 px-1 rounded hover:bg-white dark:hover:bg-slate-800 transition-colors"
                          >
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                              {f.name}
                              {f.nullable && <span className="text-slate-400 ml-0.5 font-mono">?</span>}
                            </span>
                            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-amber-100/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 truncate max-w-[130px]">
                              {f.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Action Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  onClick={handleExecuteImport}
                  disabled={!previewParse || previewParse.models.length === 0}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
                    previewParse && previewParse.models.length > 0
                      ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-[0.99]'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {previewParse && previewParse.models.length > 0
                      ? `${previewParse.models.length} Modell${
                          previewParse.models.length === 1 ? '' : 'e'
                        } ins Projekt importieren`
                      : 'Keine Modelle zum Importieren'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
