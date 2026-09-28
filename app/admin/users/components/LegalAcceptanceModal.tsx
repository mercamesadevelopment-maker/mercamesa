'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, FileClock, Info, Loader2, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { fechaCompleta, timeAgo } from '@/lib/dates/relative-time';
import type { AdminUser } from '../hooks/use-admin-users';

/**
 * La constancia legal de un usuario: qué documentos aceptó, cuándo y desde qué
 * IP, y cuáles de los vigentes todavía le faltan.
 *
 * Se pide al abrir y no con el listado porque trae la IP de cada aceptación: no
 * tiene por qué viajar en cada carga de la tabla.
 */

interface Aceptado {
  documentId: string;
  label: string;
  version: number | null;
  fileName: string | null;
  url: string | null;
  acceptedAt: string;
  acceptedIp: string | null;
}

interface Pendiente {
  documentId: string;
  label: string;
  version: number;
  url: string;
  publishedAt: string;
}

interface Constancia {
  userName: string | null;
  userEmail: string | null;
  accepted: Aceptado[];
  pending: Pendiente[];
  signupAcceptedAt: string | null;
  publishedLegalDocuments: number;
  isSuperadmin: boolean;
}

export function LegalAcceptanceModal({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Constancia | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);

    fetch(`/api/admin/users/${user.id}/legal`)
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? 'No se pudo cargar la constancia.');
        setData(json.data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error inesperado');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Modal
      isOpen={!!user}
      onClose={onClose}
      title={`Términos aceptados — ${user?.fullName || user?.email || ''}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 p-4 sm:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>
        ) : data ? (
          <>
            {/* Sin documentos publicados no hay nada que aceptar, y decir
                "no ha aceptado" sería acusar a la persona de algo que no
                depende de ella. */}
            {data.publishedLegalDocuments === 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-mm-crd bg-mm-gbg/30 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-mm-g" />
                <p className="text-xs leading-relaxed text-mm-txs">
                  Todavía no has publicado ningún documento legal, así que no hay nada
                  que nadie pueda aceptar. Se publican desde{' '}
                  <span className="font-bold text-mm-g">Parametrización → Documentos legales</span>.
                </p>
              </div>
            )}

            {data.accepted.length > 0 && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-mm-g">
                  <FileCheck2 className="h-4 w-4" />
                  Aceptados ({data.accepted.length})
                </h3>
                <ul className="divide-y divide-mm-crd/40 rounded-2xl border border-mm-crd">
                  {data.accepted.map((a) => (
                    <li key={a.documentId} className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-mm-g">
                          {a.label}
                          {a.version !== null && (
                            <span className="ml-1.5 text-xs font-medium text-mm-txw">
                              versión {a.version}
                            </span>
                          )}
                        </p>
                        <span className="text-xs text-mm-txs" title={fechaCompleta(a.acceptedAt)}>
                          {timeAgo(a.acceptedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-mm-txw">
                        {fechaCompleta(a.acceptedAt)}
                        {a.acceptedIp && ` · desde ${a.acceptedIp}`}
                      </p>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-mm-g hover:underline"
                        >
                          {a.fileName || 'Ver documento'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.pending.length > 0 && (
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-amber-700">
                  <FileClock className="h-4 w-4" />
                  Le faltan por aceptar ({data.pending.length})
                </h3>
                <ul className="divide-y divide-amber-200 rounded-2xl border border-amber-200 bg-amber-50">
                  {data.pending.map((d) => (
                    <li key={d.documentId} className="px-4 py-3">
                      <p className="text-sm font-bold text-amber-900">
                        {d.label}
                        <span className="ml-1.5 text-xs font-medium text-amber-700">
                          versión {d.version}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Publicado {timeAgo(d.publishedAt).toLowerCase()} · se le pedirá al entrar
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Separado y explicado: es anterior al sistema de documentos y no
                apunta a ningún PDF. Para quienes se registraron antes es la
                única evidencia que existe, así que omitirla sería peor. */}
            {data.signupAcceptedAt && (
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-mm-g">Aceptación al registrarse</h3>
                <div className="rounded-2xl border border-mm-crd bg-white p-4">
                  <p className="text-sm text-mm-txs" title={fechaCompleta(data.signupAcceptedAt)}>
                    Marcó la casilla de términos al crear su cuenta,{' '}
                    <span className="font-bold text-mm-g">{timeAgo(data.signupAcceptedAt).toLowerCase()}</span>.
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-mm-txw">
                    Es anterior al sistema de documentos legales, así que no apunta a un PDF
                    concreto: queda la fecha, no la versión que leyó.
                  </p>
                </div>
              </section>
            )}

            {data.isSuperadmin && (
              <p className="text-[11px] leading-relaxed text-mm-txw">
                Al superadministrador no se le exige aceptar: si un documento se publica mal,
                alguien tiene que poder entrar a corregirlo.
              </p>
            )}

            {data.accepted.length === 0 && !data.signupAcceptedAt && (
              <p className="py-6 text-center text-sm text-mm-txw">
                No hay ninguna constancia registrada para este usuario.
              </p>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
