import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, LogIn, LogOut, UserCheck, 
  X, Check, Lock, ChevronRight, User as UserIcon, Building2, 
  KeyRound, Copy, CheckCheck, Crown, Sparkles, AlertCircle, Info,
  Eye, EyeOff, Key, ArrowLeft, RefreshCw
} from 'lucide-react';
import { User } from '../types/index.ts';
import { isUserSuperAdmin, isUserAdminGranted } from '../utils/permissions.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string | null;
  users: User[];
  onSelectUser: (email: string) => void;
  onLogout: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  currentUserEmail,
  users,
  onSelectUser,
  onLogout
}: AuthModalProps) {
  const [customEmail, setCustomEmail] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Super Admin Password Gate state
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const SUPER_ADMIN_EMAIL = 'bossyemzee@gmail.com';
  const SUPER_ADMIN_NAME = 'EMZEE (Lead Admin)';

  useEffect(() => {
    if (isOpen) {
      setShowPasswordGate(false);
      setPasswordInput('');
      setPasswordError(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUser = users.find(u => u.email.toLowerCase() === (currentUserEmail || '').toLowerCase());
  const isSuper = isUserSuperAdmin(currentUser, currentUserEmail);
  const isAdmin = isUserAdminGranted(currentUser, currentUserEmail);

  const handleCopySuperAdmin = () => {
    navigator.clipboard.writeText(SUPER_ADMIN_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSelectUserTarget = (email: string) => {
    if (email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      // Trigger password gate for Super Admin!
      setShowPasswordGate(true);
      setPasswordError(null);
      return;
    }
    // Standard persona login
    onSelectUser(email.trim().toLowerCase());
    onClose();
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setErrorMessage('Please provide a valid email address');
      return;
    }
    setErrorMessage(null);
    handleSelectUserTarget(customEmail.trim().toLowerCase());
  };

  const handleVerifySuperAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Please enter the Super Admin secret password');
      return;
    }

    setIsVerifying(true);
    setPasswordError(null);

    try {
      const res = await fetch('/api/auth/verify-super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Incorrect Super Admin secret password');
      }

      // Successful verification! Log in as Super Admin
      onSelectUser(SUPER_ADMIN_EMAIL);
      setShowPasswordGate(false);
      onClose();
    } catch (err: any) {
      setPasswordError(err.message || 'Authentication failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const getRoleBadge = (u: User) => {
    const isSuperRole = isUserSuperAdmin(u);
    const isAdminRole = isUserAdminGranted(u);

    if (isSuperRole) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose">
          <ShieldAlert className="w-3 h-3" /> SUPER ADMIN
        </span>
      );
    }
    if (isAdminRole) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <ShieldCheck className="w-3 h-3" /> ADMIN GRANTED
        </span>
      );
    }
    if (u.role === 'NETWORK_ENGINEER') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 bg-cyan-950 border border-cyan-800">
          NETWORK ENG
        </span>
      );
    }
    if (u.role === 'DC_TECH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-300 bg-emerald-950 border border-emerald-800">
          DC TECH
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
        READ-ONLY
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-base glow-emerald">
              IT
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight flex items-center gap-2">
                InfraTrack Authentication &amp; RBAC
              </h3>
              <p className="text-xs text-slate-400">
                Protected Super Admin Access, Team Personas &amp; Guest Mode
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active Session Status Bar */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                currentUserEmail 
                  ? isSuper 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 glow-rose'
                    : isAdmin 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {currentUserEmail ? (currentUser?.name?.slice(0, 2).toUpperCase() || 'US') : <Lock className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white truncate">
                    {currentUserEmail ? (currentUser?.name || currentUserEmail) : 'Guest Mode (Read-Only)'}
                  </span>
                  {currentUser && getRoleBadge(currentUser)}
                  {!currentUserEmail && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      GUEST VIEWER
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                  {currentUserEmail 
                    ? currentUserEmail 
                    : 'Viewing infrastructure in safe read-only inspection mode'}
                </p>
              </div>
            </div>

            {currentUserEmail ? (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
                title="Log out and switch to Guest Mode"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            ) : (
              <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/80 shrink-0">
                Guest Active
              </span>
            )}
          </div>

          {/* SUPER ADMIN SECRET PASSWORD VERIFICATION GATE */}
          {showPasswordGate ? (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-rose-950/60 via-slate-900 to-slate-950 border-2 border-rose-500/50 shadow-2xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose">
                    <Crown className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                      Super Admin Master Password Gate
                    </h4>
                    <p className="text-xs text-rose-300/80">
                      Authenticating root identity: <span className="font-mono font-bold">{SUPER_ADMIN_EMAIL}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasswordGate(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              </div>

              {/* Password Secret Form */}
              <form onSubmit={handleVerifySuperAdminPassword} className="space-y-3.5 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Enter Secret Master Password:
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      autoFocus
                      required
                      placeholder="Enter Super Admin master password..."
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError(null);
                      }}
                      className="w-full bg-slate-950 border border-rose-500/40 focus:border-rose-500 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      title={showPasswordText ? 'Hide password' : 'Show password'}
                    >
                      {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {/* Security Policy Information */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Protected Root Identity</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Super Admin privileges grant unrestricted control over all datacenter facilities, server racks, cabling, and user roles. 
                    Authentication requires manual entry of the secret master password.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-500 font-mono">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Failed attempts are flagged &amp; recorded to the Security Audit Log</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordGate(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5 text-amber-300" />
                        <span>Verify &amp; Unlock Root Access</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* SUPER ADMIN LOGIN CARD WITH PASSWORD PROTECTION INDICATOR */}
              <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-amber-950/20 border-2 border-rose-500/40 shadow-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose">
                      <Crown className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-white tracking-tight">
                          Super Admin Login
                        </h4>
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-400/50 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> PASSWORD PROTECTED
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Requires secret master password to prevent unauthorized root privilege escalation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Credentials details breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Super Admin Email</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-rose-300 text-xs truncate">{SUPER_ADMIN_EMAIL}</span>
                      <button
                        type="button"
                        onClick={handleCopySuperAdmin}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Copy Super Admin Email"
                      >
                        {copiedEmail ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Protection Tier</span>
                    <span className="font-bold text-amber-300 text-xs mt-0.5 block flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Master Password Required
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">
                    Click to enter secret password and unlock root privileges.
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordGate(true);
                      setPasswordError(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                  >
                    <Key className="w-4 h-4 text-amber-300" />
                    <span>Enter Secret Password to Login</span>
                  </button>
                </div>
              </div>

              {/* Quick Sign-In Persona Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Provisioned Team Personas &amp; Admin-Granted Users
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Click any persona to log in
                  </span>
                </div>

                <div className="space-y-2">
                  {users.map(u => {
                    const isSelected = currentUserEmail?.toLowerCase() === u.email.toLowerCase();
                    const isSuperUser = isUserSuperAdmin(u);
                    const isAdminUser = isUserAdminGranted(u);

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUserTarget(u.email)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all active:scale-[0.99] ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                            : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSuperUser 
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isAdminUser 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-white truncate">{u.name}</span>
                              {getRoleBadge(u)}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 truncate">
                              {u.email} &bull; <span className="text-slate-500">{u.department || 'Operations'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                              <Check className="w-3.5 h-3.5" /> ACTIVE
                            </span>
                          ) : isSuperUser ? (
                            <span className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
                              <Lock className="w-3 h-3" /> Password Required
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 group-hover:text-white flex items-center gap-0.5">
                              Log In <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Email Login Form */}
              <form onSubmit={handleCustomLogin} className="pt-3 border-t border-slate-800 space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Or Sign In with Any Corporate Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="engineer@datacenter.internal"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="min-h-[38px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20 shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </div>
                {errorMessage && (
                  <p className="text-xs text-rose-400">{errorMessage}</p>
                )}
              </form>
            </>
          )}
        </div>

        {/* Modal Footer with Guest Mode option */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 text-xs">
          <button
            type="button"
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="text-amber-400 hover:text-amber-300 transition-colors font-semibold flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Continue in Guest Mode (Read-Only)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
