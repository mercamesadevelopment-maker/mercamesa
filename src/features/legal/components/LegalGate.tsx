'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/Shared';

type PendingDocument = {
  id: string;
  kind: 'terms' | 'privacy';
  version: number;
  url: string;
};

const ETIQUETAS: Record<string, string> = {
  terms: 'Términos y condiciones',
  privacy: 'Política de tratamiento de datos',
};

/**
 * Pide aceptar los documentos legales vigentes antes de dejar seguir.
 *
 * Vive en el shell y no en el proxy por dos razones: el proxy tendría que
 * consultar la base en **cada navegación** de cada usuario, y un redirect no
 * puede mostrar el documento que hay que leer.
 *
 * Esto es la forma de llegar a `/api/legal/accept`, **no** la protección: la
 * constancia la escribe el servidor, con los documentos que él considera
 * vigentes. Quien quite esta capa con las herramientas del navegador seguirá
 * figurando como no aceptado.
 */
export function LegalGate({ enabled }: { enabled: boolean }) {
  const [pendientes, setPendientes] = useState<PendingDocument[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    try {
      setCargando(true);
      const res = await fetch('/api/legal/pending');
      const json = await res.json();
      setPendientes(json.data ?? []);
    } catch {
      // Si no se puede consultar, no se bloquea: dejar a todo el mundo afuera
      // porque una consulta falló sería peor que el problema que resuelve.
      setPendientes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) consultar();
  }, [enabled, consultar]);

  const aceptar = async () => {
    try {
      setGuardando(true);
      setError(null);

      const res = await fetch('/api/legal/accept', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error ?? 'No pudimos registrar tu aceptación.');

      setPendientes([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No pudimos registrar tu aceptación.');
    } finally {
      setGuardando(false);
    }
  };

  if (!enabled || cargando || pendientes.length === 0) return null;

  const esPlural = pendientes.length > 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-mm-g/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="p-8 md:p-10">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mm-gbg text-mm-g">
              <FileText className="h-7 w-7" />
            </div>
            <h2 className="mb-2 font-fraunces text-3xl text-mm-g">
              {esPlural ? 'Actualizamos nuestros documentos' : 'Actualizamos un documento'}
            </h2>
            <p className="text-sm text-mm-txs">
              Para seguir usando MercaMesa necesitamos que {esPlural ? 'los' : 'lo'} leas y{' '}
              {esPlural ? 'los' : 'lo'} aceptes.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">{error}</div>
          )}

          <ul className="mb-8 space-y-2">
            {pendientes.map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-mm-crd bg-mm-gbg/30 px-4 py-3 transition-colors hover:bg-mm-gbg/60"
                >
                  <span className="text-sm font-bold text-mm-g">
                    {ETIQUETAS[doc.kind] ?? doc.kind}
                    <span className="ml-2 font-normal text-mm-txw">Versión {doc.version}</span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-mm-txw" />
                </a>
              </li>
            ))}
          </ul>

          <Button className="w-full py-4 text-lg" loading={guardando} onClick={aceptar}>
            {guardando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              `Acepto ${esPlural ? 'los documentos' : 'el documento'}`
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-mm-txw">
            Quedará registrado qué versión aceptaste y cuándo.
          </p>
        </div>
      </div>
    </div>
  );
}
