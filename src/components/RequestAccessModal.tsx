/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, X, Check, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function RequestAccessModal({ onClose }: Props) {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState('operador');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) { setError('Nome e email são obrigatórios.'); return; }
    setLoading(true); setError('');
    try {
      const { error: err } = await supabase.from('user_requests').insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role_requested: role,
        message: message.trim() || null,
      });
      if (err) throw err;
      setSuccess(true);
    } catch (e: any) {
      setError(e.message?.includes('unique') ? 'Este email já possui uma solicitação.' : 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-white font-bold text-xl">Solicitação Enviada!</h3>
        <p className="text-slate-400 text-sm">O administrador receberá sua solicitação e entrará em contato com suas credenciais de acesso.</p>
        <button onClick={onClose} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer">
          Fechar
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4">

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="text-white font-bold text-lg">Solicitar Acesso</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <p className="text-slate-400 text-xs">Preencha os dados abaixo. O administrador irá liberar seu acesso e enviar suas credenciais.</p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">Tipo de acesso desejado</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500">
              <option value="operador">Operador — gerencia eventos e totem</option>
              <option value="administrador">Administrador — acesso total</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">Mensagem (opcional)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Por que você precisa de acesso?"
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs font-mono bg-red-950/30 border border-red-900/30 rounded-xl px-3 py-2">⚠ {error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          {loading ? 'Enviando...' : 'Enviar Solicitação'}
        </button>
      </div>
    </div>
  );
}
