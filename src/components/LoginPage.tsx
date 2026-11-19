import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useErp } from '../store';
import { Input, Field, Btn } from './ui';

export const LoginPage: React.FC = () => {
  const { login, users, settings } = useErp();
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(username, pin)) { setErr('Identifiant ou code PIN invalide.'); setPin(''); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#102016]">
      <div className="w-full max-w-md">
        <div className="text-center text-[#f5f0e6] mb-6">
          <div className="mx-auto w-14 h-14 rounded-[4px] border border-[#a68038] bg-[#162b1e] text-[#dfc07f] font-serif-brand font-bold text-2xl tracking-wider flex items-center justify-center">
            MN
          </div>
          <h1 className="mt-3 font-serif-brand text-3xl font-bold tracking-wide text-[#f5f0e6]">{settings.name}</h1>
          <p className="text-[#a5b5aa] text-xs uppercase tracking-widest mt-1">Système de Gestion Commerciale & Atelier</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-md border border-[#c8bfa8] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#ece7dc]">
            <div className="flex items-center gap-2 text-[#12241a] text-xs font-bold uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-[#a68038]" /> Authentification Opérateur
            </div>
            <span className="font-mono-num text-[11px] text-[#7a7265]">Tél : {settings.phones[0]}</span>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6e6659] mb-1.5">Accès direct par profil</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => login('admin', '1234')}
                className="text-left p-2 rounded-[4px] bg-[#faf8f4] hover:bg-[#eef5f0] border border-[#dcd5c7] hover:border-[#143020] cursor-pointer transition"
              >
                <div className="text-xs font-bold text-[#12241a]">Direction</div>
                <div className="font-mono-num text-[10px] text-[#7a7265]">PIN 1234</div>
              </button>
              <button
                type="button"
                onClick={() => login('gerant', '2345')}
                className="text-left p-2 rounded-[4px] bg-[#faf8f4] hover:bg-[#eef5f0] border border-[#dcd5c7] hover:border-[#143020] cursor-pointer transition"
              >
                <div className="text-xs font-bold text-[#12241a]">Gérance</div>
                <div className="font-mono-num text-[10px] text-[#7a7265]">PIN 2345</div>
              </button>
              <button
                type="button"
                onClick={() => login('caisse', '0000')}
                className="text-left p-2 rounded-[4px] bg-[#faf8f4] hover:bg-[#eef5f0] border border-[#dcd5c7] hover:border-[#143020] cursor-pointer transition"
              >
                <div className="text-xs font-bold text-[#12241a]">Caisse POS</div>
                <div className="font-mono-num text-[10px] text-[#7a7265]">PIN 0000</div>
              </button>
            </div>
          </div>

          <Field label="Identifiant utilisateur">
            <Input autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" list="users-list" />
            <datalist id="users-list">{users.filter(u => u.active).map(u => <option key={u.id} value={u.username}>{u.name}</option>)}</datalist>
          </Field>
          <Field label="Code PIN"><Input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></Field>
          {err && <div className="text-xs text-[#8a2626] bg-[#fbeeee] border border-[#e8c3c3] rounded-[4px] px-3 py-2">{err}</div>}
          <Btn variant="primary" size="lg" className="w-full"><LogIn className="w-4 h-4" /> Ouvrir la session</Btn>
        </form>
      </div>
    </div>
  );
};
