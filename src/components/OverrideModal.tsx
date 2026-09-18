import React, { useState } from 'react';
import { AlertOctagon, X, Check, ShieldAlert } from 'lucide-react';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateOrBlockerName: string;
  onConfirmOverride: (reason: string, riskAcknowledged: boolean) => Promise<void>;
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  gateOrBlockerName,
  onConfirmOverride,
}) => {
  const [reason, setReason] = useState('');
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !riskAcknowledged) return;

    setIsSubmitting(true);
    try {
      await onConfirmOverride(reason.trim(), riskAcknowledged);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">A-SSDLC Lifecycle Gate Override</h3>
              <p className="text-xs text-slate-500">Formal auditable risk acceptance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="text-slate-500 font-medium">Target Gate / Control:</div>
            <div className="text-slate-900 font-semibold font-mono text-sm">{gateOrBlockerName}</div>
            <p className="text-slate-500 text-[11px] pt-1">
              Per A-SSDLC Section 17, an override does not remove the risk. It creates an immutable, timestamped risk-acceptance event that is permanently visible in release readiness reviews.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Justification & Operational Scope <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Temporary authorization for local integration testing; production deployment remains blocked until REQ-SEC-019 resolution."
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-white"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(e) => setRiskAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="text-xs text-slate-700 font-medium">
                I explicitly acknowledge the inherent security risk and accept responsibility for overriding this assurance gate.
              </span>
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || !riskAcknowledged || isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              {isSubmitting ? 'Recording Override...' : 'Confirm Risk Acceptance & Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
