import React, { useState, useEffect } from 'react';
import { ApiService, getBackendUrl } from '../services/api';
import { Server, Check, X, RefreshCw, Globe, AlertTriangle, Copy } from 'lucide-react';

interface ServerSettingsModalProps {
  onClose: () => void;
  onServerConnected?: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  onClose,
  onServerConnected,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    const active = getBackendUrl();
    setCurrentUrl(active || 'Local / Standalone Mode');
    setUrlInput(active);
    setIsConnected(ApiService.isSocketConnected());

    // Test health on open
    testCurrentConnection(active);
  }, []);

  const testCurrentConnection = async (targetUrl: string) => {
    setIsTesting(true);
    setTestResult(null);

    const testEndpoint = targetUrl 
      ? `${targetUrl.replace(/\/$/, '')}/health`
      : '/health';

    const startTime = performance.now();
    try {
      const res = await fetch(testEndpoint, { signal: AbortSignal.timeout(4000) });
      const duration = Math.round(performance.now() - startTime);

      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connected! Response time: ${duration}ms`,
        });
        setIsConnected(true);
      } else {
        setTestResult({
          ok: false,
          message: `Server returned HTTP ${res.status}. Make sure the Node server is running.`,
        });
        setIsConnected(false);
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: targetUrl 
          ? `Could not reach ${targetUrl}. Check CORS and URL formatting.` 
          : 'Standalone mode (Netlify static host). Random internet matchmaking requires a backend server.',
      });
      setIsConnected(false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndConnect = async () => {
    const cleaned = urlInput.trim().replace(/\/$/, '');
    ApiService.setBackendUrl(cleaned);
    setCurrentUrl(cleaned || 'Local / Standalone Mode');
    await testCurrentConnection(cleaned);
    
    // Force socket reconnect
    ApiService.getSocket();

    if (onServerConnected) {
      onServerConnected();
    }
  };

  const handleResetDefault = async () => {
    ApiService.setBackendUrl('');
    setUrlInput('');
    setCurrentUrl('Local / Standalone Mode');
    await testCurrentConnection('');
  };

  const handleCopyDeployCmd = () => {
    navigator.clipboard.writeText('npx tsx server/src/index.ts');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 text-accent-cyan">
          <div className="w-10 h-10 rounded-2xl bg-accent-cyan/10 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Server & Network Status</h3>
            <p className="text-xs text-slate-400">Real-time WebSocket & API Configuration</p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="p-3.5 rounded-2xl bg-surface-200/70 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[11px] uppercase">Connection State:</span>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              isConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{isConnected ? 'Online & Synchronized' : 'Standalone / Netlify Static'}</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-300 break-all">
            <span className="text-slate-500">Active Target: </span>
            {currentUrl}
          </div>

          {testResult && (
            <div className={`text-xs p-2 rounded-xl flex items-center gap-2 ${
              testResult.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
            }`}>
              {testResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Custom Backend URL input */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Backend Server URL</span>
            <span className="text-[10px] text-slate-500">e.g. Render, Railway, VPS, Local</span>
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://my-backend.onrender.com or http://localhost:3001"
              className="flex-1 glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono"
            />
            <button
              onClick={handleSaveAndConnect}
              disabled={isTesting}
              className="px-4 py-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-accent-cyan/20 disabled:opacity-50"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Connect</span>
            </button>
          </div>
        </div>

        {/* Explanatory Info Card */}
        <div className="p-3 bg-surface-100/50 rounded-2xl border border-white/5 text-[11px] text-slate-300 space-y-2">
          <div className="flex items-center gap-1.5 text-accent-purple font-bold">
            <Globe className="w-4 h-4" />
            <span>Why is this needed when deployed online?</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            <b>Netlify</b> hosts the static frontend. Real-time random matchmaking and cross-device audio rooms require a live Node.js server.
          </p>
          <div className="space-y-1 bg-surface-300/60 p-2 rounded-xl border border-white/5 font-mono text-[10px]">
            <div className="text-accent-cyan font-bold">Free 1-Click Hosting:</div>
            <div>• <b>Render.com</b>: Create free Web Service ➔ Build: <code className="text-emerald-300">npm install</code> ➔ Start: <code className="text-emerald-300">npx tsx server/src/index.ts</code></div>
            <div>• <b>Railway.app</b>: Deploy root repo with Node 20.</div>
            <div className="flex items-center justify-between pt-1">
              <span>• Local server command:</span>
              <button
                type="button"
                onClick={handleCopyDeployCmd}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-accent-cyan flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedCmd ? 'Copied!' : 'Copy Command'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={handleResetDefault}
            className="text-[11px] text-slate-400 hover:text-white underline transition-colors"
          >
            Reset to Localhost / Default
          </button>

          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-200 text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
