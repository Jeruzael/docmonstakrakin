import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  Download,
  Upload,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  RefreshCw,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { Project } from '../types';

interface PackageTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  // App supplies only a fully loaded, matching, ready project for export.
  currentProject: Project | null;
  initialTab?: 'export' | 'import';
  onProjectImported: (importedProjectId: string) => void;
}

export const PackageTransferModal: React.FC<PackageTransferModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  initialTab='export',
  onProjectImported,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(currentProject ? initialTab : 'import');
  useEffect(()=>{if(!currentProject)setActiveTab('import');},[currentProject]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<any | null>(null);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [importStatus, setImportStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Package Export
  const handleExport = async () => {
    if (!currentProject || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/package/export?actor=docmonstakrakin UI Operator`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Failed to generate package');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${currentProject.id}_package.docmonstakrakin`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const stateHash = response.headers.get('x-docmonstakrakin-state-hash');
      const envelopeHash = response.headers.get('x-docmonstakrakin-envelope-hash');

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || 'Error exporting package');
    } finally {
      setIsExporting(false);
    }
  };

  // Process File Selection
  const processFile = (file: File) => {
    setUploadedFile(file);
    setVerificationResult(null);
    setImportStatus('IDLE');
    setImportError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        setFileContent(parsed);
        // Automatically trigger verification on upload
        await verifyPackage(parsed);
      } catch (err: any) {
        setVerificationResult({
          valid: false,
          errors: ['Failed to parse JSON file: ' + err.message],
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Cryptographic Verification Request
  const verifyPackage = async (payload: any) => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/projects/package/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: payload }),
      });
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        errors: ['Network error verifying package: ' + err.message],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Import Request
  const handleImport = async () => {
    if (!fileContent) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await fetch('/api/projects/package/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: fileContent,
          overwrite,
          actor: 'docmonstakrakin Package Restore UI',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setImportError(`Project already exists (${data.existingName || data.projectId}). Check "Overwrite existing project" to replace it.`);
        } else {
          setImportError(data.error || 'Failed to import package');
        }
        setImportStatus('ERROR');
        return;
      }

      setImportStatus('SUCCESS');
      if (data.project && data.project.id) {
        onProjectImported(data.project.id);
        onClose();
      }
    } catch (err: any) {
      setImportError(err.message || 'Import error');
      setImportStatus('ERROR');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      id="portable-package-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Portable project package"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Portable Project Package (.docmonstakrakin)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  SLSA Sealed
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Deterministic SHA-256 state seal & chronological audit chain
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-4 text-xs font-bold">
          <button
            disabled={!currentProject}
            onClick={() => setActiveTab('export')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Sealed Package
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Verify & Import Package
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-700 text-xs">
          {activeTab === 'export' && currentProject ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Active Project Snapshot
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{currentProject.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{currentProject.description}</p>
                  </div>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    {currentProject.id}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Lifecycle Phase</span>
                    <span className="font-semibold text-slate-800">{currentProject.lifecyclePhase}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Methodology</span>
                    <span className="font-semibold text-slate-800">{currentProject.deliveryMethod}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">State Version</span>
                    <span className="font-mono font-semibold text-slate-800">v{currentProject.stateVersion}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Deterministic Cryptographic Sealing (SEC-CTRL-018)</span>
                </div>
                <p className="text-emerald-800/90 leading-relaxed text-[11px]">
                  When you export, the control plane serializes the complete canonical knowledge graph
                  (requirements, risks, threats, standards, work items, evidence, ADRs, approvals) in
                  canonical sorted order, generates a SHA-256 state seal, and verifies the sequential hash
                  linkage of all audit events.
                </p>
                <div className="flex items-center gap-4 text-[10px] font-mono text-emerald-700 pt-1">
                  <span>• Magic: DOCMONSTAKRAKIN_PACKAGE</span>
                  <span>• Format: v0.1.0</span>
                  <span>• Envelope: SHA-256</span>
                </div>
              </div>

              {exportError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{exportError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleExport}
                  disabled={!currentProject || isExporting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sealing & Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download .docmonstakrakin Package
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Upload Zone (Drag and drop + click) */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose package file"
                onKeyDown={e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();fileInputRef.current?.click();}}}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : uploadedFile
                    ? 'border-emerald-300 bg-slate-50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".docmonstakrakin,.json"
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600">
                    <Upload className="w-5 h-5 text-emerald-600" />
                  </div>
                  {uploadedFile ? (
                    <div>
                      <span className="font-bold text-slate-900 block">{uploadedFile.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-bold text-slate-800 block">
                        Drag and drop .docmonstakrakin package here
                      </span>
                      <span className="text-[11px] text-slate-400">
                        or click to browse from your filesystem
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Progress Indicator */}
              {isVerifying && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Computing canonical state hash and verifying cryptographic audit chain...</span>
                </div>
              )}

              {/* Verification Result Card */}
              {verificationResult && (
                <div
                  className={`rounded-xl p-4 border space-y-3 ${
                    verificationResult.valid
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {verificationResult.valid ? (
                        <>
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-emerald-950 text-xs block">
                              Cryptographic Seal Verified
                            </span>
                            <span className="text-[11px] text-emerald-800">
                              Package integrity authenticated against SHA-256 seal
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                          <div>
                            <span className="font-bold text-rose-950 text-xs block">
                              Cryptographic Seal Verification Failed
                            </span>
                            <span className="text-[11px] text-rose-800">
                              Package integrity violation or corrupted file
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    {verificationResult.valid && (
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-[10px]">
                        GENUINE
                      </span>
                    )}
                  </div>

                  {verificationResult.valid ? (
                    <div className="space-y-2 pt-1 border-t border-emerald-200/80 text-[11px] text-slate-700 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans">Project:</span>
                        <span className="font-bold font-sans text-slate-900">
                          {verificationResult.projectName} ({verificationResult.projectId})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans">Canonical State Hash:</span>
                        <span className="truncate max-w-[280px] bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">
                          {verificationResult.canonicalStateHash}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans">Envelope Seal Hash:</span>
                        <span className="truncate max-w-[280px] bg-white px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-900">
                          {verificationResult.envelopeHash}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-sans">Audit Chain:</span>
                        <span className="text-emerald-800 font-sans font-semibold">
                          ✓ {verificationResult.auditEventsCount} events cryptographically linked
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1 border-t border-rose-200/80 text-rose-900 text-[11px]">
                      <span className="font-bold block">Verification Errors:</span>
                      <ul className="list-disc pl-4 space-y-1">
                        {verificationResult.errors?.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Import Options & Action */}
              {verificationResult?.valid && (
                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Overwrite project if project ID already exists in the workspace</span>
                  </label>

                  {importError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{importError}</span>
                    </div>
                  )}

                  {importStatus === 'SUCCESS' && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>Project restored successfully! Switching context...</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleImport}
                      disabled={isImporting || importStatus === 'SUCCESS'}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Restoring Project...
                        </>
                      ) : (
                        <>
                          <FileCheck className="w-4 h-4" />
                          Restore Project into Control Plane
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
