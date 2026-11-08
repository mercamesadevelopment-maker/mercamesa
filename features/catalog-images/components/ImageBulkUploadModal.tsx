'use client';

import React from 'react';
import { CheckCircle2, Download, ImagePlus, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useImageBulkUpload } from '../hooks/use-image-bulk-upload';
import { ImageMatchList } from './ImageMatchList';

interface ImageBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se llama al cerrar si se subió al menos una foto, para refrescar el listado. */
  onUploaded: () => void;
  /** Sin tienda, como admin del catálogo maestro. */
  storeId?: string;
}

/**
 * Carga de fotos en lote: cada archivo va al producto cuyo código del catálogo
 * (o nombre) coincide con el nombre del archivo.
 */
export function ImageBulkUploadModal({ isOpen, onClose, onUploaded, storeId }: ImageBulkUploadModalProps) {
  const u = useImageBulkUpload(storeId);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { loadTargets } = u;

  React.useEffect(() => {
    if (isOpen) loadTargets();
  }, [isOpen, loadTargets]);

  const handleClose = () => {
    if (u.step === 'uploading') return;
    if (u.uploaded > 0) onUploaded();
    u.reset();
    onClose();
  };

  const listas = u.matches.filter((m) => m.status === 'ok').length;
  const reemplazan = u.matches.filter((m) => m.status === 'replaces').length;
  const conProblema = u.matches.length - listas - reemplazan;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cargar imágenes" maxWidth="max-w-2xl">
      <div className="space-y-6 p-8">
        {u.error && (
          <div className="flex items-start gap-3 rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{u.error}</span>
          </div>
        )}

        {u.step === 'pick' && (
          <div className="space-y-6">
            <div className="space-y-3 rounded-2xl border border-mm-crd bg-mm-gbg/20 p-5">
              <p className="text-sm leading-relaxed text-mm-txs">
                Nombra cada foto con el <strong>código del catálogo</strong> del producto, por ejemplo{' '}
                <span className="font-mono text-mm-g">tomate-chonto.jpg</span>. También sirve el nombre del
                producto, si no se repite.
              </p>
              <p className="text-xs text-mm-txw">
                {storeId
                  ? 'Puedes cambiar las fotos de los productos de tu grupo de tiendas y de los que propusiste. Las del catálogo general las pone MercaMesa.'
                  : 'JPG, PNG o WEBP, hasta 8 MB cada una.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={u.loading}
                disabled={!u.targets}
                onClick={u.downloadCodes}
              >
                <Download className="h-4 w-4" /> Descargar lista de códigos
              </Button>
            </div>

            {u.targets && u.targets.length === 0 ? (
              <p className="rounded-2xl bg-mm-gbg/30 p-6 text-center text-sm text-mm-txs">
                No tienes productos a los que puedas cambiarles la foto.
              </p>
            ) : (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  u.pickFiles(e.dataTransfer.files);
                }}
                className={cn(
                  'cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition-all',
                  isDragging ? 'border-mm-g bg-mm-gbg/30' : 'border-mm-crd hover:border-mm-g hover:bg-mm-gbg/10',
                  !u.targets && 'pointer-events-none opacity-50'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    u.pickFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <ImagePlus className="h-10 w-10 text-mm-txw" />
                  <p className="font-bold text-mm-g">Arrastra las fotos o haz clic para elegirlas</p>
                  <p className="text-xs text-mm-txw">Puedes elegir muchas a la vez</p>
                </div>
              </div>
            )}
          </div>
        )}

        {u.step === 'preview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Resumen valor={listas} etiqueta="Listas" clase="bg-okl text-ok" />
              <Resumen valor={reemplazan} etiqueta="Ya tienen foto" clase="bg-warnl text-warn" />
              <Resumen valor={conProblema} etiqueta="Con problema" clase="bg-rl text-r" />
            </div>

            {reemplazan > 0 && (
              <label className="flex items-center gap-2 text-sm font-medium text-mm-g">
                <input
                  type="checkbox"
                  checked={u.replace}
                  onChange={(e) => u.setReplace(e.target.checked)}
                  className="h-4 w-4 rounded border-mm-crd"
                />
                {reemplazan === 1 ? 'Reemplazar la foto que ya existe' : `Reemplazar las ${reemplazan} fotos que ya existen`}
              </label>
            )}

            <ImageMatchList matches={u.matches} />

            <div className="flex gap-3 border-t border-mm-gbg pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={u.reset}>
                Elegir otras
              </Button>
              <Button type="button" className="flex-1" disabled={u.toUpload.length === 0} onClick={u.upload}>
                {u.toUpload.length === 0
                  ? 'No hay fotos para subir'
                  : `Subir ${u.toUpload.length} foto${u.toUpload.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}

        {u.step === 'uploading' && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm font-bold text-mm-g">
              Subiendo {u.progress.done} de {u.progress.total}…
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-mm-gbg">
              <div
                className="h-full bg-mm-g transition-all"
                style={{ width: `${u.progress.total ? (u.progress.done / u.progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-mm-txw">No cierres esta ventana.</p>
          </div>
        )}

        {u.step === 'done' && (
          <div className="space-y-5">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-okl/40 py-6 text-ok">
              <CheckCircle2 className="h-6 w-6" />
              <p className="text-sm font-bold">
                {u.uploaded} foto{u.uploaded === 1 ? '' : 's'} puesta{u.uploaded === 1 ? '' : 's'}
              </p>
            </div>
            {u.failures.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-r">No se pudieron subir ({u.failures.length})</h3>
                <div className="max-h-48 divide-y divide-mm-gbg overflow-y-auto rounded-2xl border border-mm-crd">
                  {u.failures.map((f) => (
                    <p key={f.fileName} className="p-3 text-xs text-mm-txs">
                      <span className="font-mono font-bold text-mm-g">{f.fileName}</span>: {f.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <Button type="button" className="w-full" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Resumen({ valor, etiqueta, clase }: { valor: number; etiqueta: string; clase: string }) {
  return (
    <div className={cn('rounded-2xl p-4 text-center', clase)}>
      <p className="font-display text-3xl font-bold tabular-nums">{valor}</p>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{etiqueta}</p>
    </div>
  );
}
