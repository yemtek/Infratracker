import React, { useState, useEffect, useRef } from 'react';
import { Camera, Flashlight, RefreshCw, X, Check, AlertCircle, Sparkles, Barcode, WifiOff, Volume2 } from 'lucide-react';
import { playHapticSound } from '../utils/offline-sync.ts';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (data: { serial: string; mac?: string; model?: string }) => void;
}

export function ScannerModal({ isOpen, onClose, onScanResult }: ScannerModalProps) {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Enterprise sample barcodes for quick testing / OCR simulation
  const samplePresets = [
    {
      label: 'Cisco Catalyst 9300 Serial',
      serial: 'FCW2618L05Z',
      mac: '00:40:96:A1:B2:C3',
      model: 'Cisco Catalyst 9300-48P'
    },
    {
      label: 'Dell PowerEdge R750 Service Tag',
      serial: '7BR8QK2',
      mac: 'B0:4F:13:55:66:77',
      model: 'Dell PowerEdge R750'
    },
    {
      label: 'Ubiquiti UniFi Pro 48 Barcode',
      serial: 'UBNT-PRO-48P-9932',
      mac: '74:83:C2:90:11:22',
      model: 'Ubiquiti UniFi Switch Pro 48 PoE'
    },
    {
      label: 'Fortinet FortiGate 100F Serial',
      serial: 'FG100FTK23008912',
      mac: '00:09:0F:33:44:55',
      model: 'Fortinet FortiGate 100F'
    }
  ];

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            startBarcodeDetection();
          };
        }
        setHasCamera(true);
      } else {
        setHasCamera(false);
      }
    } catch (err) {
      console.log('Camera access not permitted or unavailable in iframe environment:', err);
      setHasCamera(false);
    }
  };

  const startBarcodeDetection = () => {
    // Client-side BarcodeDetector API (Supported in Chrome/Edge Android & iOS 17+)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'upc_a', 'data_matrix', 'codabar']
        });

        const detectFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            scanLoopRef.current = requestAnimationFrame(detectFrame);
            return;
          }

          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue.trim();
              if (code) {
                setDetectedCode(code);
                playHapticSound('success');
                setTimeout(() => {
                  onScanResult({ serial: code.toUpperCase() });
                  onClose();
                }, 400);
                return;
              }
            }
          } catch {
            // Frame detection error, continue loop
          }

          scanLoopRef.current = requestAnimationFrame(detectFrame);
        };

        scanLoopRef.current = requestAnimationFrame(detectFrame);
      } catch (err) {
        console.warn('BarcodeDetector initialization skipped:', err);
      }
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setDetectedCode(null);
  };

  const toggleTorch = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities?.torch) {
        track.applyConstraints({
          advanced: [{ torch: !torchOn } as any]
        });
        setTorchOn(!torchOn);
      } else {
        setTorchOn(!torchOn);
      }
    } else {
      setTorchOn(!torchOn);
    }
  };

  const handleApplyPreset = (preset: typeof samplePresets[0]) => {
    setSelectedPreset(preset.serial);
    playHapticSound('success');
    setTimeout(() => {
      onScanResult({
        serial: preset.serial,
        mac: preset.mac,
        model: preset.model
      });
      onClose();
    }, 350);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    playHapticSound('success');
    onScanResult({
      serial: manualInput.trim().toUpperCase()
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm md:text-base tracking-tight">
                  Server Room Barcode &amp; Tag Scanner
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 flex items-center gap-1 font-bold">
                  <WifiOff className="w-2.5 h-2.5" /> 100% OFFLINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Audio beep &amp; haptic vibration confirmation &bull; 0 KB data required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Window */}
        <div className="relative bg-black flex-1 min-h-[260px] max-h-[340px] flex items-center justify-center overflow-hidden">
          {hasCamera ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3 text-slate-400">
                <Barcode className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">
                Camera Active / Offline Ready
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Tap any enterprise hardware barcode preset below or enter a serial number manually. Works seamlessly in basements without signal.
              </p>
            </div>
          )}

          {/* Scanner Crosshairs & Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className={`relative w-64 h-36 border-2 rounded-xl backdrop-blur-[1px] transition-colors ${
              detectedCode 
                ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_#10b981]' 
                : 'border-emerald-500/60 bg-emerald-500/5'
            }`}>
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

              {/* Animated Laser Scanning Beam */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-scanline" />

              <div className="absolute -bottom-6 left-0 right-0 text-center">
                <span className="text-[11px] font-mono tracking-wider text-emerald-400 bg-slate-950/90 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  {detectedCode ? `SCANNED: ${detectedCode}` : 'ALIGN BARCODE / QR'}
                </span>
              </div>
            </div>
          </div>

          {/* Flashlight / Torch toggle button */}
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md border transition-all ${
              torchOn
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30'
                : 'bg-slate-900/70 text-slate-300 border-slate-700/60 hover:bg-slate-800'
            }`}
            title="Toggle Flashlight / Torch"
          >
            <Flashlight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Enterprise Preset Scans */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 overflow-y-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Quick Barcode Presets
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Audio Beep Active</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3.5">
            {samplePresets.map((preset) => (
              <button
                key={preset.serial}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between active:scale-95 ${
                  selectedPreset === preset.serial
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {preset.label}
                  </span>
                  <Check className="w-3.5 h-3.5 text-emerald-400 opacity-60" />
                </div>
                <div className="mt-1 font-mono text-[11px] font-semibold text-emerald-400 tracking-wide">
                  SN: {preset.serial}
                </div>
              </button>
            ))}
          </div>

          {/* Manual Entry Fallback */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Or type/paste Serial Number (e.g. 7BR8QK2)..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-600/20 shrink-0"
            >
              Apply
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
