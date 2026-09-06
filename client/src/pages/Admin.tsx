import React, { useState } from 'react';
import { AbuseReport } from '../../../shared/types';
import { Shield, ShieldAlert, ArrowLeft, Ban, Lock } from 'lucide-react';

interface AdminProps {
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminProps> = ({ onBack }) => {
  const [adminKey, setAdminKey] = useState('anonymous_admin_secret_key_2026');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [reports, setReports] = useState<AbuseReport[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAdminData = async (key: string) => {
    setErrorMsg('');
    try {
      const [metricsRes, reportsRes] = await Promise.all([
        fetch('/api/admin/metrics', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/reports', { headers: { 'x-admin-key': key } }),
      ]);

      const metricsType = metricsRes.headers.get('content-type') || '';
      const reportsType = reportsRes.headers.get('content-type') || '';

      if (!metricsType.includes('application/json') || !reportsType.includes('application/json')) {
        throw new Error('Backend server is not reachable. Ensure the server is running to view live admin metrics.');
      }

      if (!metricsRes.ok || !reportsRes.ok) {
        throw new Error('Invalid admin credentials.');
      }

      const metricsData = await metricsRes.json();
      const reportsData = await reportsRes.json();

      setMetrics(metricsData);
      setReports(reportsData.reports || []);
      setIsAuthenticated(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate admin');
    }
  };

  const handleBanUser = async (publicId: string) => {
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ publicId }),
      });
      if (res.ok) {
        alert(`User ${publicId} banned successfully.`);
        fetchAdminData(adminKey);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent-cyan" />
            <span>Admin Moderation Dashboard</span>
          </h2>
          <p className="text-xs text-slate-400">System health, abuse moderation queue, and user bans.</p>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="glass-panel max-w-md mx-auto w-full p-6 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-accent-cyan text-xs font-mono font-bold uppercase">
            <Lock className="w-4 h-4" />
            <span>Admin Authorization</span>
          </div>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter admin secret key..."
            className="w-full glass-input rounded-xl px-4 py-2.5 text-xs text-white"
          />
          {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
          <button
            onClick={() => fetchAdminData(adminKey)}
            className="w-full py-3 bg-accent-cyan hover:bg-accent-blue text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-accent-cyan/20"
          >
            VERIFY CREDENTIALS
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metrics Grid */}
          {metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card p-4 rounded-2xl border border-white/10">
                <div className="text-[11px] text-slate-400 font-mono">Active Rooms</div>
                <div className="text-2xl font-bold text-white mt-1">{metrics.activeRooms}</div>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-white/10">
                <div className="text-[11px] text-slate-400 font-mono">Total Users</div>
                <div className="text-2xl font-bold text-accent-cyan mt-1">{metrics.totalUsers}</div>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-white/10">
                <div className="text-[11px] text-slate-400 font-mono">In-Room Users</div>
                <div className="text-2xl font-bold text-accent-purple mt-1">{metrics.membersInRooms}</div>
              </div>
              <div className="glass-card p-4 rounded-2xl border border-white/10">
                <div className="text-[11px] text-slate-400 font-mono">Pending Reports</div>
                <div className="text-2xl font-bold text-red-400 mt-1">{metrics.pendingReports}</div>
              </div>
            </div>
          )}

          {/* Moderation Queue */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Abuse & Safety Reports</span>
              </div>
              <span className="text-xs text-slate-400">{reports.length} total reports</span>
            </div>

            {reports.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No abuse reports in queue.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 bg-surface-200 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-400 uppercase font-mono">
                          [{report.reason}]
                        </span>
                        <span className="text-slate-300">
                          Target: <b className="text-white">{report.reportedPublicId}</b>
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Reported by: {report.reporterPublicId} • {new Date(report.createdAt).toLocaleTimeString()}
                      </div>
                      {report.details && (
                        <div className="text-[11px] text-slate-300 mt-1 italic">
                          "{report.details}"
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleBanUser(report.reportedPublicId)}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Ban Account
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
