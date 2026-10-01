'use client';

import React, { useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { Button, Textarea, cn } from '@/src/components/Shared';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { MAX_DESCRIPTION } from '@/lib/pqrs/rules';
import type { PqrsMessage, PqrsViewer } from '@/lib/pqrs/types';
import { PqrsPhotoPicker } from './PqrsPhotoPicker';
import { PqrsPhotos } from './PqrsPhotos';

const AUTHOR_LABELS: Record<PqrsMessage['authorAs'], string> = {
  buyer: 'Comprador',
  seller: 'Tienda',
  admin: 'MercaMesa',
  system: 'Sistema',
};

interface PqrsThreadProps {
  messages: PqrsMessage[];
  viewer: PqrsViewer;
  canMessage: boolean;
  working: boolean;
  /** Devuelve si el mensaje se envió, para saber si limpiar el campo. */
  onSend: (body: string, photos: File[], isInternal: boolean) => Promise<boolean>;
}

/** La conversación de un caso y el campo para escribir en ella. */
export function PqrsThread({ messages, viewer, canMessage, working, onSend }: PqrsThreadProps) {
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [isInternal, setIsInternal] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) return;
    if (await onSend(body, photos, isInternal)) {
      setBody('');
      setPhotos([]);
      setIsInternal(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Conversación</p>

      {messages.length === 0 ? (
        <p className="text-sm text-mm-txw">Todavía no hay mensajes.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => {
            const propio = m.authorAs === viewer;
            return (
              <li
                key={m.id}
                className={cn(
                  'rounded-2xl p-3.5 text-sm',
                  m.authorAs === 'system'
                    ? 'bg-mm-gbg/40 text-mm-txs text-center text-xs'
                    : m.isInternal
                      ? 'bg-warnl/60 border border-warn/20'
                      : propio
                        ? 'bg-mm-gbg ml-6 sm:ml-12'
                        : 'bg-white border border-mm-crd mr-6 sm:mr-12'
                )}
              >
                {m.authorAs !== 'system' && (
                  <p className="text-[11px] text-mm-txw mb-1 flex flex-wrap items-center gap-x-1.5">
                    <span className="font-bold text-mm-g">{AUTHOR_LABELS[m.authorAs]}</span>
                    {m.authorName && <span>· {m.authorName}</span>}
                    <span>· {fechaCompleta(m.createdAt)}</span>
                    {m.isInternal && (
                      <span className="inline-flex items-center gap-1 text-warn font-bold">
                        <Lock className="w-3 h-3" /> Nota interna
                      </span>
                    )}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-mm-txs">{m.body}</p>
                {m.attachments.length > 0 && (
                  <div className="mt-2">
                    <PqrsPhotos attachments={m.attachments} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canMessage && (
        <div className="space-y-3 pt-2">
          <Textarea
            rows={3}
            maxLength={MAX_DESCRIPTION}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe un mensaje…"
          />
          <PqrsPhotoPicker files={photos} onChange={setPhotos} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {viewer === 'admin' ? (
              <label className="flex items-center gap-2 text-xs text-mm-txs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="w-4 h-4 accent-mm-g"
                />
                Nota interna (solo la ven los administradores)
              </label>
            ) : (
              <span />
            )}
            <Button size="sm" onClick={handleSend} loading={working} disabled={!body.trim()}>
              <Send className="w-3.5 h-3.5" /> Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
