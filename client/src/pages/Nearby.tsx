import React, { useState, useEffect } from 'react';
import { NearbyService, BluetoothSupportStatus, NearbyDevice, BluetoothState } from '../services/bluetooth';
import { AnonymousUser } from '../../../shared/types';
import { Radio, AlertTriangle, Wifi, Bluetooth, Search, ArrowLeft, X, RefreshCw } from 'lucide-react';

interface NearbyProps {
  user: AnonymousUser;
  onBack: () => void;
  onJoinNearbyRoom: (roomCode?: string) => void;
}

export const Nearby: React.FC<NearbyProps> = ({
  user,
  onBack,
  onJoinNearbyRoom,
}) => {
  const [btStatus, setBtStatus] = useState<BluetoothSupportStatus>({ isSupported: false, isSecureContext: true });
  const [currentState, setCurrentState] = useState<BluetoothState>(NearbyService.getState());
  const [scanError, setScanError] = useState<string | null>(null);
  const [foundDevices, setFoundDevices] = useState<NearbyDevice[]>([]);

  useEffect(() => {
    const status = NearbyService.checkBluetoothSupport();
    setBtStatus(status);

    const unsubscribe = NearbyService.onStateChange((state, error) => {
      setCurrentState(state);
      if (error) {
        setScanError(error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBluetoothScan = async () => {
    setScanError(null);
    const result = await NearbyService.scanBluetoothDevices();

    if (!result.success) {
      if (result.error !== 'User cancelled the Bluetooth device picker.') {
        setScanError(result.error || 'Scan unsuccessful.');
      }
    } else if (result.device) {
      setFoundDevices((prev) => {
        if (prev.some((d) => d.id === result.device!.id)) return prev;
        return [...prev, result.device!];
      });
    }
  };

  const handleCancelScan = () => {
    NearbyService.cancelScan();
    setScanError(null);
  };

  const handleInternetNearbyConnect = () => {
    onJoinNearbyRoom();
  };

  const getStateBadgeColor = (state: BluetoothState) => {
    switch (state) {
      case 'ACTIVE':
      case 'JOINED':
      case 'CONNECTED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'SCANNING':
      case 'CONNECTING':
      case 'SESSION_CREATING':
        return 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30 animate-pulse';
      case 'ERROR':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'DEVICE_FOUND':
      case 'DEVICE_SELECTED':
        return 'bg-accent-purple/20 text-accent-purple border-accent-purple/30';
      default:
        return 'bg-slate-800 text-slate-400 border-white/10';
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6 relative">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Nearby Mode</h2>
          <p className="text-xs text-slate-400">Broadcasting node: <b className="text-accent-cyan font-mono">{user.characterName}</b></p>
        </div>
      </div>

      {/* Bluetooth Capability Status Box (Truthful reporting, Section 18 & 81) */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-xl space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${btStatus.isSupported ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-amber-500/20 text-amber-400'}`}>
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Hardware Bluetooth Status</div>
              <div className="text-[11px] text-slate-400">
                {btStatus.isSupported ? 'Supported on this device' : 'Unsupported on this device/browser'}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              btStatus.isSupported ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {btStatus.isSupported ? 'Hardware Available' : 'Unavailable'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${getStateBadgeColor(currentState)}`}>
              State: {currentState}
            </span>
          </div>
        </div>

        {/* Unsupported Notice & Explanation */}
        {!btStatus.isSupported ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Bluetooth communication isn't supported on this device/browser.</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {btStatus.reason || 'Web Bluetooth requires specific browser flags and native Bluetooth hardware access.'}
            </p>
            <div className="pt-2">
              <button
                onClick={handleInternetNearbyConnect}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-accent-purple to-accent-blue hover:brightness-110 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-accent-purple/20 flex items-center justify-center gap-2"
              >
                <Wifi className="w-4 h-4" />
                <span>USE INTERNET NEARBY MODE</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <button
                onClick={handleBluetoothScan}
                disabled={currentState === 'SCANNING'}
                className="flex-1 py-3 px-4 bg-accent-cyan hover:bg-accent-blue text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-accent-cyan/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Search className={`w-4 h-4 ${currentState === 'SCANNING' ? 'animate-spin' : ''}`} />
                <span>{currentState === 'SCANNING' ? 'SCANNING FOR BLUETOOTH PEERS...' : 'SCAN FOR NEARBY BLUETOOTH'}</span>
              </button>

              {currentState === 'SCANNING' && (
                <button
                  onClick={handleCancelScan}
                  className="px-4 py-3 bg-surface-100 hover:bg-surface-50 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 flex items-center gap-1"
                  title="Cancel active scan"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            {scanError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{scanError}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleBluetoothScan}
                    className="flex-1 py-1.5 px-3 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg text-xs font-semibold border border-red-500/30 flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>TRY AGAIN</span>
                  </button>
                  <button
                    onClick={handleInternetNearbyConnect}
                    className="flex-1 py-1.5 px-3 bg-surface-100 hover:bg-surface-50 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>USE INTERNET MODE</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discovered Devices / Vicinity Lounge */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-xl flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            Local Anonymous Vicinity
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {foundDevices.length} discovered
          </span>
        </div>

        {foundDevices.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Radio className="w-10 h-10 text-slate-600 animate-pulse" />
            <p className="text-xs font-medium text-slate-400">No nearby devices connected yet.</p>
            <p className="text-[11px] text-slate-500 max-w-xs">
              Use "Internet Nearby Mode" to bridge local peers on the same network or create a local nearby room.
            </p>
            <button
              onClick={handleInternetNearbyConnect}
              className="mt-3 px-4 py-2 bg-surface-100 hover:bg-surface-50 text-accent-cyan border border-accent-cyan/30 text-xs font-semibold rounded-xl"
            >
              Connect to Internet Nearby Lounge
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {foundDevices.map((dev) => (
              <div
                key={dev.id}
                className="p-3 bg-surface-200 rounded-2xl border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-cyan/20 text-accent-cyan flex items-center justify-center">
                    <Bluetooth className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{dev.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">ID: {dev.id.slice(0, 8)}</div>
                  </div>
                </div>
                <button
                  onClick={() => onJoinNearbyRoom(dev.id)}
                  className="px-3 py-1.5 bg-accent-cyan hover:bg-accent-blue text-slate-950 font-bold text-xs rounded-xl"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

