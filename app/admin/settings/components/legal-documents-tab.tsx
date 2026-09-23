'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Upload, ExternalLink, Loader2, Mail, AlertCircle } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { useLegalDocuments, type LegalKind } from '../hooks/use-legal-documents';
import type { LegalDocumentRow } from '../services/settings.service';

const DOCUMENTOS: { kind: LegalKind; label: string; descripcion: string }[] = [
  {
    kind: 'terms',
    label: 'Términos y condiciones',
    descripcion: 'Las reglas de uso de la plataforma que acepta todo el mundo al registrarse.',
  },
  {
    kind: 'privacy',
    label: 'Política de tratamiento de datos',
    descripcion: 'Qué datos personales se recogen, para qué y con quién se comparten.',
  },
];

const MAX_BYTES = 10 * 1024 * 1024;

export function LegalDocumentsTab() {
  const { documents, activeUsers, loading, saving, error, publish, setError } =
    useLegalDocuments();

  const [abierto, setAbierto] = useState<LegalKind | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [notas, setNotas] = useState('');
  const [correccionMenor, setCorreccionMenor] = useState(false);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ title: string; message: string } | null>(null);

  // Las versiones llegan ordenadas de la más nueva a la más vieja por tipo; la
  // primera de cada una es la vigente.
  const porTipo = useMemo(() => {
    const mapa: Record<string, LegalDocumentRow[]> = { terms: [], privacy: [] };
    for (const d of documents) mapa[d.kind]?.push(d);
    return mapa;
  }, [documents]);

  const abrirFormulario = (kind: LegalKind) => {
    setAbierto(kind);
    setArchivo(null);
    setNotas('');
    setCorreccionMenor(false);
    setArchivoError(null);
    setError(null);
  };

  const elegirArchivo = (file: File | undefined) => {
    if (!file) return;
    setArchivoError(null);

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setArchivoError('El documento debe ser un PDF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setArchivoError('El PDF no puede pesar más de 10 MB.');
      return;
    }

    setArchivo(file);
  };

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abierto || !archivo) return;

    const { ok, notified } = await publish(abierto, archivo, notas.trim(), correccionMenor);
    if (!ok) return;

    setAbierto(null);

    setAviso({
      title: correccionMenor ? 'Corrección guardada' : 'Documento publicado',
      message: notified
        ? `Se le avisó a ${notified.enviados} usuario(s).` +
          (notified.fallidos > 0
            ? ` ${notified.fallidos} correo(s) no se pudieron enviar; el documento quedó publicado igual.`
            : '')
        : correccionMenor
          ? 'Se reemplazó el archivo de la versión vigente. Nadie tiene que volver a aceptarla.'
          : 'Es la primera versión de este documento, así que no se envió ningún aviso.',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {DOCUMENTOS.map(({ kind, label, descripcion }) => {
        const versiones = porTipo[kind] ?? [];
        const vigente = versiones[0] ?? null;
        const anteriores = versiones.slice(1);

        return (
          <section key={kind} className="rounded-3xl border border-mm-crd/50 p-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-mm-txw" />
                  <h3 className="font-bold text-mm-g">{label}</h3>
                </div>
                <p className="mt-1 text-xs text-mm-txw">{descripcion}</p>
              </div>

              <Button size="sm" onClick={() => abrirFormulario(kind)}>
                <Upload className="h-4 w-4" />
                {vigente ? 'Publicar versión nueva' : 'Publicar el primero'}
              </Button>
            </div>

            {!vigente ? (
              <p className="rounded-2xl bg-mm-gbg/30 px-4 py-6 text-center text-sm text-mm-txw">
                Todavía no se ha publicado este documento. Mientras tanto, no aparece en el pie de
                página ni se le pide a nadie que lo acepte.
              </p>
            ) : (
              <>
                <div className="rounded-2xl border border-mm-crd/40 bg-mm-gbg/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-mm-txw">
                        Versión vigente
                      </p>
                      <p className="mt-1 text-lg font-bold text-mm-g">Versión {vigente.version}</p>
                      <p className="text-xs text-mm-txs">{vigente.fileName}</p>
                    </div>

                    {vigente.url && (
                      <a
                        href={vigente.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-mm-crd bg-white px-3 py-1.5 text-xs font-bold text-mm-g transition-colors hover:bg-mm-gbg"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir PDF
                      </a>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-mm-txw">
                    Publicado por {vigente.publishedBy ?? 'sin registro'} ·{' '}
                    {fechaCompleta(vigente.publishedAt)}
                  </p>

                  {vigente.notes && (
                    <p className="mt-2 text-xs italic text-mm-txs">«{vigente.notes}»</p>
                  )}

                  {vigente.notifiedAt && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-mm-txw">
                      <Mail className="h-3.5 w-3.5" />
                      Se avisó a {vigente.notifiedCount ?? 0} usuario(s)
                      {(vigente.notifyFailed ?? 0) > 0 && (
                        <span className="font-bold text-r">
                          · {vigente.notifyFailed} sin entregar
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {anteriores.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-mm-txw">
                      Versiones anteriores
                    </p>
                    <ul className="space-y-1.5">
                      {anteriores.map((v) => (
                        <li
                          key={v.id}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mm-txs"
                        >
                          <span className="font-semibold text-mm-g">Versión {v.version}</span>
                          <span className="text-mm-txw">·</span>
                          <span className="text-mm-txw">{fechaCompleta(v.publishedAt)}</span>
                          <span className="text-mm-txw">·</span>
                          <span className="text-mm-txw">{v.publishedBy ?? 'sin registro'}</span>
                          {v.url && (
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-mm-g hover:underline"
                            >
                              Abrir PDF
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      {/* Formulario de publicación */}
      <AnimatePresence>
        {abierto && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !saving && setAbierto(null)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl"
            >
              <form onSubmit={publicar} className="space-y-5 p-8">
                <h3 className="font-fraunces text-2xl text-mm-g">
                  {DOCUMENTOS.find((d) => d.kind === abierto)?.label}
                </h3>

                {(archivoError || error) && (
                  <div className="rounded-2xl bg-red-100 p-4 text-sm text-red-600">
                    {archivoError || error}
                  </div>
                )}

                <div>
                  <label className="ml-1 text-sm font-medium text-mm-txs">Archivo PDF</label>
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-mm-crd bg-mm-gbg/20 px-4 py-4 text-sm text-mm-txs transition-colors hover:bg-mm-gbg/40">
                    <Upload className="h-4 w-4 text-mm-txw" />
                    <span className={archivo ? 'font-semibold text-mm-g' : 'text-mm-txw'}>
                      {archivo ? archivo.name : 'Elegir el PDF (máximo 10 MB)'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => elegirArchivo(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <div className="flex w-full flex-col gap-1.5">
                  <label className="ml-1 text-sm font-medium text-mm-txs">
                    Observación del cambio
                  </label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    rows={3}
                    required
                    placeholder="Qué cambió y por qué. Queda en el historial."
                    className="rounded-xl border border-mm-crd bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-mm-g"
                  />
                </div>

                {/* Solo tiene sentido si ya hay algo publicado que corregir. */}
                {(porTipo[abierto] ?? []).length > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-2xl bg-mm-gbg/30 p-4">
                    <input
                      type="checkbox"
                      checked={correccionMenor}
                      onChange={(e) => setCorreccionMenor(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-mm-crd text-mm-g focus:ring-mm-g"
                    />
                    <span className="text-xs text-mm-txs">
                      <span className="font-bold text-mm-g">Es una corrección menor.</span> Reemplaza
                      el archivo de la versión vigente sin avisar a nadie y sin que nadie tenga que
                      volver a aceptarla. Úsalo para erratas, no para cambios de fondo.
                    </span>
                  </label>
                )}

                <p className="flex items-center gap-1.5 rounded-2xl bg-mm-gbg/30 px-4 py-3 text-xs text-mm-txs">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-mm-txw" />
                  {correccionMenor
                    ? 'No se enviará ningún aviso.'
                    : (porTipo[abierto] ?? []).length === 0
                      ? 'Es la primera versión: no se enviará ningún aviso.'
                      : `Se le avisará por correo y por la campana a ${activeUsers} usuario(s) activo(s), y todos tendrán que aceptarla.`}
                </p>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={() => setAbierto(null)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:flex-1"
                    loading={saving}
                    disabled={!archivo || !notas.trim()}
                  >
                    {correccionMenor ? 'Guardar corrección' : 'Publicar'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!aviso}
        title={aviso?.title ?? ''}
        message={aviso?.message ?? ''}
        variant="warning"
        hideCancel
        confirmText="Entendido"
        onConfirm={() => setAviso(null)}
        onClose={() => setAviso(null)}
      />
    </div>
  );
}
