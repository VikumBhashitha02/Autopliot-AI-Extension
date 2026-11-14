import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ApprovalModal: React.FC = () => {
  const { pendingApproval, respondApproval } = useApp();

  if (!pendingApproval) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-500/40 p-4 sm:p-6 shadow-2xl shadow-amber-500/10 space-y-4 sm:space-y-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert size={24} className="sm:w-7 sm:h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Manual Authorization Required</h3>
            <p className="text-xs text-slate-400 mt-1">
              The active workflow has paused at an approval gate and requires your explicit authorization before proceeding.
            </p>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 font-medium break-words">
          {pendingApproval.prompt}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
          <button
            onClick={() => respondApproval(false)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <XCircle size={16} className="text-rose-400" />
            <span>Reject & Abort</span>
          </button>
          <button
            onClick={() => respondApproval(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <CheckCircle2 size={16} />
            <span>Approve & Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
