import React, { useState, useEffect } from 'react';
import {
  FileTerminal,
  Search,
  Download,
  Trash2,
  Filter,
  FileCode,
  RefreshCw,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LogsDiagnosticsView: React.FC = () => {
  const { logs, clearLogs } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'audit_logs' | 'diagnostic_reports'>('audit_logs');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<string>('prompt_report');
  const [reportContent, setReportContent] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'ALL' || log.level === levelFilter;
    const matchesSearch =
      searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const loadDiagnosticReport = async (reportName: string) => {
    if (!window.api) return;
    setLoadingReport(true);
    try {
      let filename = 'phase0_1_prompt_report.json';
      if (reportName === 'prompt_summary') filename = 'phase0_1_prompt_summary.txt';
      if (reportName === 'completion_report') filename = 'phase0_1_completion_report.json';
      if (reportName === 'completion_summary') filename = 'phase0_1_completion_summary.txt';

      const content = await window.api.readDiagnosticReport(filename);
      setReportContent(content || 'File is empty or not found.');
    } catch (err: any) {
      setReportContent(`Error loading diagnostic file: ${err.message || String(err)}`);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'diagnostic_reports') {
      loadDiagnosticReport(selectedReport);
    }
  }, [activeSubTab, selectedReport]);

  const handleExportLogs = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `autopilot_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopy = () => {
    if (activeSubTab === 'audit_logs') {
      navigator.clipboard.writeText(JSON.stringify(filteredLogs, null, 2));
    } else {
      navigator.clipboard.writeText(reportContent);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <FileTerminal size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Logs &amp; Diagnostics</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                {logs.length} System Records
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Audit log stream, security redactor outputs, and raw Windows UI Automation diagnostic reports.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* SubTab switcher */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSubTab('audit_logs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'audit_logs'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Stream
            </button>
            <button
              onClick={() => setActiveSubTab('diagnostic_reports')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === 'diagnostic_reports'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Diagnostic Files
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title="Copy current content to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {activeSubTab === 'audit_logs' && (
            <>
              <button
                onClick={handleExportLogs}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                title="Download JSON log file"
              >
                <Download size={14} />
                <span>Export</span>
              </button>

              <button
                onClick={clearLogs}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-900/60 transition-colors cursor-pointer"
                title="Clear current log buffer"
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeSubTab === 'audit_logs' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search logs by keyword, message, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-500" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
                <option value="SAFETY">SAFETY</option>
              </select>
            </div>
          </div>

          {/* Logs List */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-xs max-h-[650px] overflow-y-auto space-y-2">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const isError = log.level === 'ERROR';
                const isWarn = log.level === 'WARN';
                const isSafety = log.level === 'SAFETY';
                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-slate-900"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <span className="text-slate-500 text-[11px] shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ${
                          isError
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : isSafety
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-slate-400 font-semibold shrink-0">
                        [{log.category}]
                      </span>
                      <span className={isError ? 'text-rose-200' : 'text-slate-200'}>
                        {log.message}
                      </span>
                    </div>

                    {log.metadata && (
                      <span className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                        {JSON.stringify(log.metadata)}
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-slate-600">
                No log entries match the current filter criteria.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Diagnostic Reports Viewer */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedReport('prompt_report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedReport === 'prompt_report'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode size={14} />
              <span>phase0_1_prompt_report.json</span>
            </button>

            <button
              onClick={() => setSelectedReport('prompt_summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedReport === 'prompt_summary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={14} />
              <span>phase0_1_prompt_summary.txt</span>
            </button>

            <button
              onClick={() => setSelectedReport('completion_report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedReport === 'completion_report'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode size={14} />
              <span>phase0_1_completion_report.json</span>
            </button>

            <button
              onClick={() => setSelectedReport('completion_summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedReport === 'completion_summary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={14} />
              <span>phase0_1_completion_summary.txt</span>
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 font-mono text-xs text-slate-300 max-h-[650px] overflow-y-auto">
            {loadingReport ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
                <RefreshCw size={18} className="animate-spin" />
                <span>Loading diagnostic file...</span>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap leading-relaxed">{reportContent}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
