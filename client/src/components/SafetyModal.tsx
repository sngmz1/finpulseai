import React, { useState } from 'react';
import { ShieldAlert, UserX, Flag, CheckCircle, X } from 'lucide-react';

interface SafetyModalProps {
  targetPublicId: string;
  targetCharacterName: string;
  onClose: () => void;
  onReport: (reason: string, details?: string) => void;
  onBlock: () => void;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({
  targetPublicId,
  targetCharacterName,
  onClose,
  onReport,
  onBlock,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('harassment');
  const [details, setDetails] = useState('');
  const [submittedReport, setSubmittedReport] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const reportReasons = [
    { id: 'harassment', label: 'Harassment or Bullying' },
    { id: 'spam', label: 'Spam or Advertising' },
    { id: 'threats', label: 'Threats or Violence' },
    { id: 'sexual_content', label: 'Inappropriate / Sexual content' },
    { id: 'hate_abuse', label: 'Hate speech / Abuse' },
    { id: 'impersonation', label: 'Impersonation' },
    { id: 'other', label: 'Other Violations' },
  ];

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    onReport(selectedReason, details);
    setSubmittedReport(true);
  };

  const handleBlockConfirm = () => {
    onBlock();
    setBlocked(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-red-400">
          <ShieldAlert className="w-5 h-5" />
          <h3 className="font-bold text-sm uppercase tracking-wide">Safety & Privacy Controls</h3>
        </div>

        <div className="text-xs text-slate-300">
          Target User: <span className="font-bold text-white">{targetCharacterName}</span>{' '}
          <span className="font-mono text-slate-400">({targetPublicId})</span>
        </div>

        {submittedReport ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Thanks. This report has been submitted.</p>
            <p className="text-xs text-slate-400">
              Our automated moderation system and moderators will review this session.
            </p>
            <button
              onClick={onClose}
              className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium"
            >
              Done
            </button>
          </div>
        ) : blocked ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-2">
            <UserX className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm font-semibold text-white">User Blocked</p>
            <p className="text-xs text-slate-400">
              You will never be matched with this user again, and their messages are hidden.
            </p>
            <button
              onClick={onClose}
              className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Report Form */}
            <form onSubmit={handleSubmitReport} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Reason for report:
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs bg-surface-200 border border-white/10 text-white focus:ring-1 focus:ring-accent-cyan"
              >
                {reportReasons.map(r => (
                  <option key={r.id} value={r.id} className="bg-surface-300 text-white">
                    {r.label}
                  </option>
                ))}
              </select>

              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Optional details (max 200 chars)..."
                maxLength={200}
                rows={2}
                className="w-full glass-input rounded-xl px-3 py-2 text-xs resize-none placeholder-slate-500 text-white"
              />

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors"
              >
                <Flag className="w-4 h-4" />
                Submit Anonymous Report
              </button>
            </form>

            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleBlockConfirm}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                <UserX className="w-4 h-4 text-red-400" />
                Block {targetCharacterName}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
