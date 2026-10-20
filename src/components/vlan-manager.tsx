import React, { useState } from 'react';
import { Layers, Plus, Network, CheckCircle2, AlertCircle, Hash, RefreshCw, Trash2, Edit, X, Save } from 'lucide-react';
import { VLAN } from '../types/index.ts';

interface VlanManagerProps {
  vlans: VLAN[];
  onCreateVlan: (vlanData: { vlanNumber: number; name: string; description?: string; colorHex?: string; subnet?: string }) => Promise<void>;
  onUpdateVlan?: (vlanId: string, vlanData: { vlanNumber: number; name: string; description?: string; colorHex?: string; subnet?: string }) => Promise<void>;
  onDeleteVlan?: (vlanId: string) => Promise<void>;
  isAdminGranted?: boolean;
}

export function VlanManager({ vlans, onCreateVlan, onUpdateVlan, onDeleteVlan, isAdminGranted = false }: VlanManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVlan, setEditingVlan] = useState<VLAN | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [vlanNumber, setVlanNumber] = useState<number>(40);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subnet, setSubnet] = useState('10.100.40.0/24');
  const [colorHex, setColorHex] = useState('#10b981');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = [
    { label: 'Emerald', hex: '#10b981' },
    { label: 'Cyan', hex: '#06b6d4' },
    { label: 'Sky', hex: '#38bdf8' },
    { label: 'Indigo', hex: '#6366f1' },
    { label: 'Purple', hex: '#a855f7' },
    { label: 'Amber', hex: '#f59e0b' },
    { label: 'Rose', hex: '#f43f5e' }
  ];

  const openCreateModal = () => {
    setEditingVlan(null);
    const maxVlan = vlans.length > 0 ? Math.max(...vlans.map(v => v.vlan_number)) + 10 : 10;
    setVlanNumber(maxVlan);
    setName('');
    setDescription('');
    setSubnet(`10.100.${maxVlan}.0/24`);
    setColorHex('#10b981');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (v: VLAN) => {
    setEditingVlan(v);
    setVlanNumber(v.vlan_number);
    setName(v.name);
    setDescription(v.description || '');
    setSubnet(v.subnet || '');
    setColorHex(v.color_hex || '#10b981');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (editingVlan && onUpdateVlan) {
        await onUpdateVlan(editingVlan.id, {
          vlanNumber,
          name,
          description,
          colorHex,
          subnet
        });
      } else {
        await onCreateVlan({
          vlanNumber,
          name,
          description,
          colorHex,
          subnet
        });
      }
      setIsModalOpen(false);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to save VLAN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vlanId: string) => {
    if (!onDeleteVlan) return;
    try {
      await onDeleteVlan(vlanId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete VLAN');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 glow-cyan">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              802.1Q Virtual LAN (VLAN) Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Datacenter traffic segmentation, broadcast domains &amp; isolated subnets ({vlans.length} Active Segments)
            </p>
          </div>
        </div>

        {isAdminGranted ? (
          <button
            onClick={openCreateModal}
            className="min-h-[40px] px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New VLAN</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono">
            <span>Read-Only VLAN Matrix</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VLAN Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vlans.map((vlan) => (
          <div
            key={vlan.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border"
                  style={{
                    backgroundColor: `${vlan.color_hex}15`,
                    borderColor: `${vlan.color_hex}40`,
                    color: vlan.color_hex
                  }}
                >
                  VLAN ID {vlan.vlan_number}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-400 mr-1">
                    {vlan.port_count || 0} Ports Bound
                  </span>
                  {isAdminGranted && onUpdateVlan && (
                    <button
                      type="button"
                      onClick={() => openEditModal(vlan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Edit VLAN"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isAdminGranted && onDeleteVlan && (
                    confirmDeleteId === vlan.id ? (
                      <div className="flex items-center gap-1 animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => handleDelete(vlan.id)}
                          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(vlan.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete VLAN"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>

              <h3 className="font-bold text-white text-base">
                {vlan.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {vlan.description || 'No description provided'}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Subnet:</span>
              <span className="text-slate-300 font-semibold">{vlan.subnet || 'Bridged (No IP)'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* New / Edit VLAN Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base text-white">
                {editingVlan ? `Edit VLAN ${editingVlan.vlan_number}` : 'Create 802.1Q VLAN Segment'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Configure broadcast domain ID, CIDR subnet and tag color
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    VLAN ID (1-4094):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={4094}
                    required
                    value={vlanNumber}
                    onChange={(e) => setVlanNumber(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Subnet (CIDR):
                  </label>
                  <input
                    type="text"
                    placeholder="10.100.10.0/24"
                    value={subnet}
                    onChange={(e) => setSubnet(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  VLAN Segment Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g., OOB_Management_Prod"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Description:
                </label>
                <textarea
                  rows={2}
                  placeholder="Purpose, security zone, access policies..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Highlight Color Theme:
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colors.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColorHex(c.hex)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        colorHex === c.hex ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50 shadow-lg shadow-purple-600/30"
                >
                  {isSubmitting ? 'Saving...' : editingVlan ? 'Save VLAN' : 'Create VLAN Segment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
