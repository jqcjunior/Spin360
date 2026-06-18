/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Smartphone, Mail, FileText, ArrowLeft, ArrowRight } from 'lucide-react';
import { Event, VideoLead } from '../types';
import { SpinDb } from '../db';

interface LeadCaptureModalProps {
  event: Event;
  onLeadCaptured: (lead: VideoLead) => void;
  onCancel: () => void;
}

export default function LeadCaptureModal({ event, onLeadCaptured, onCancel }: LeadCaptureModalProps) {
  const fields = event.requiredLeadFields;

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [company, setCompany] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const themeHex = event.themeColor || '#6366f1';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field Validation
    if (fields.name && !name.trim()) return setErrorMsg('Por favor, preencha o seu Nome Completo.');
    if (fields.phone && !phone.trim()) return setErrorMsg('Por favor, informe seu WhatsApp de envio.');
    if (fields.city && !city.trim()) return setErrorMsg('Por favor, informe sua Cidade.');
    if (fields.email && !email.trim()) return setErrorMsg('Por favor, informe seu E-mail.');
    if (fields.instagram && !instagram.trim()) return setErrorMsg('Por favor, informe o seu perfil do @Instagram.');
    if (fields.company && !company.trim()) return setErrorMsg('Por favor, informe no Nome da sua Empresa.');

    if (!lgpdConsent) {
      return setErrorMsg('Você precisa aceitar os termos de consentimento LGPD para prosseguir.');
    }

    // Capture Lead
    const newLead: VideoLead = {
      id: 'lead_' + Math.floor(Math.random() * 1000000),
      eventId: event.id,
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      city: city.trim() || undefined,
      email: email.trim() || undefined,
      instagram: instagram.trim() || undefined,
      company: company.trim() || undefined,
      lgpdConsent: true,
      consentTimestamp: new Date().toISOString()
    };

    // Save mock lead register
    SpinDb.saveLead(newLead);
    
    // Log Audit
    SpinDb.logAudit(name.trim() || 'anonymous', 'lead_captured', 'lead', newLead.id, { name: newLead.name });

    onLeadCaptured(newLead);
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-1 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Banner with Event theme header */}
        <div 
          style={{ backgroundImage: `linear-gradient(to bottom, ${themeHex}20, #0f172a)` }}
          className="p-6 text-center border-b border-slate-800">
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-white/10 border border-white/20">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">Identificação do Participante</span>
          <h2 className="text-xl font-display font-extrabold text-white mt-1">{event.name}</h2>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
            Por favor, preencha os dados abaixo para desbloquear o totem de gravação e receber o vídeo final em seu celular.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-none" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Input Name */}
            {fields.name && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  value={name} 
                  required
                  placeholder="Seu nome"
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Input Phone */}
            {fields.phone && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  WhatsApp com DDD <span className="text-red-500">*</span>
                </label>
                <input 
                  type="tel"
                  value={phone} 
                  required
                  placeholder="(00) 90000-0000"
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Input City */}
            {fields.city && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  Cidade <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  value={city} 
                  required
                  placeholder="Sua cidade - UF"
                  onChange={e => setCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Input Email */}
            {fields.email && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input 
                  type="email"
                  value={email} 
                  required
                  placeholder="seu.email@exemplo.com"
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Input Instagram */}
            {fields.instagram && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  @Instagram <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  value={instagram} 
                  required
                  placeholder="@seu_perfil"
                  onChange={e => setInstagram(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Input Company */}
            {fields.company && (
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  value={company} 
                  required
                  placeholder="Sua empresa"
                  onChange={e => setCompany(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Consent Text section with beautiful check-in layout */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-3">
            <h4 className="text-[11px] font-mono font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Declaração de Consentimento Lgpd
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed max-h-24 overflow-y-auto pr-1">
              {event.lgpdConsentText || 'Autorizo que a plataforma Spin 360 processe meus dados cadastrais e o conteúdo de vídeo capturado neste dispositivo, em conformidade com as diretrizes da LGPD (Lei Geral de Proteção de Dados), unicamente para a entrega do download e divulgação do evento patrocinado.'}
            </p>
            <label className="flex items-start gap-2.5 pt-1.5 cursor-pointer group">
              <input 
                type="checkbox"
                checked={lgpdConsent}
                onChange={e => setLgpdConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-300 font-medium select-none group-hover:text-white transition-colors">
                Estou ciente e aceito os termos de captação de imagem. <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          {/* Navigation Controls */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 text-center bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-2xl text-xs font-bold font-mono tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="submit"
              style={{ backgroundColor: lgpdConsent ? themeHex : '#334155' }}
              className="flex-1 py-3 text-center text-white disabled:opacity-55 disabled:cursor-not-allowed rounded-2xl text-xs font-bold font-mono tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 shadow-lg shadow-indigo-950/25">
              <span>Continuar</span> <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
