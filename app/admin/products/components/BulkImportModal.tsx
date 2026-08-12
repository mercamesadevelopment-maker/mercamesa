'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Badge, StepBar, cn } from '@/src/components/Shared';
import type { ImportReport, ImportRowResult } from '@/lib/catalog-import/types';
import { useBulkImport } from '../hooks/useBulkImport';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Se llama al cerrar después de crear productos, para refrescar el listado. */
  onImported: () => void;
}

const STEP_INDEX = { upload: 0, preview: 1, done: 2 } as const;

const BADGE: Record<
  ImportRowResult['status'],
  { label: string; variant: 'warning' | 'error' | 'default' | 'success' }
> = {
  created: { label: 'Creado', variant: 'success' },
  skipped: { label: 'Ya existe', variant: 'warning' },
  failed: { label: 'Error', variant: 'error' },
  not_processed: { label: 'Sin procesar', variant: 'default' },
};

export function BulkImportModal({ isOpen, onClose, onImported }: BulkImportModalProps) {
  const {
    step,
    file,
    report,
    error,
    isDownloading,
    isProcessing,
    selectFile,
    reset,
    backToUpload,
    downloadTemplate,
    validate,
    confirm,
  } = useBulkImport();

  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (isProcessing) return;
    if (step === 'done' && (report?.summary.created ?? 0) > 0) onImported();
    reset();
    onClose();
  };

  // El input conserva el valor anterior: sin limpiarlo, volver a elegir el mismo
  // archivo corregido no dispara ningún onChange.
  const openFilePicker = () => {
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Carga masiva al catálogo" maxWidth="max-w-3xl">
      <div className="p-8 space-y-6">
        <StepBar step={STEP_INDEX[step]} total={3} />

        {error && (
          <div className="flex items-start gap-3 bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="bg-mm-gbg/20 border border-mm-crd rounded-2xl p-5 space-y-3">
              <p className="text-sm text-mm-txs leading-relaxed">
                Descarga la plantilla y llena una fila por producto nuevo. Las columnas{' '}
                <strong>Categoría</strong> y <strong>Unidad de medida</strong> traen lista
                desplegable con los valores válidos: úsala para no crear productos mal
                clasificados.
              </p>
              <p className="text-xs text-mm-txw">
                Los productos se crean activos y sin imagen; la foto se agrega después editando cada
                uno. Si el nombre ya existe en el catálogo, esa fila se omite.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={isDownloading}
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4" /> Descargar plantilla
              </Button>
            </div>

            <div
              onClick={openFilePicker}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={cn(
                'border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-mm-g bg-mm-gbg/30'
                  : 'border-mm-crd hover:border-mm-g hover:bg-mm-gbg/10'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-10 h-10 text-mm-g" />
                  <p className="font-bold text-mm-g">{file.name}</p>
                  <p className="text-xs text-mm-txw">Haz clic para elegir otro archivo</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-mm-txw" />
                  <p className="font-bold text-mm-g">Arrastra el archivo o haz clic para buscarlo</p>
                  <p className="text-xs text-mm-txw">Excel (.xlsx) o CSV</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2 border-t border-mm-gbg">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                loading={isProcessing}
                disabled={!file}
                onClick={validate}
              >
                Validar archivo
              </Button>
            </div>
          </div>
        )}

        {step !== 'upload' && report && (
          <div className="space-y-6">
            <ReportSummary report={report} />
            <ProblemRows rows={report.rows} />

            {step === 'preview' ? (
              <div className="space-y-3 pt-2 border-t border-mm-gbg">
                {report.summary.created > 100 && (
                  <p className="text-xs text-mm-txw text-center">
                    Crear {report.summary.created} productos puede tardar unos segundos. No cierres
                    esta ventana.
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isProcessing}
                    onClick={backToUpload}
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    loading={isProcessing}
                    disabled={report.summary.created === 0}
                    onClick={confirm}
                  >
                    {report.summary.created === 0
                      ? 'No hay nada por crear'
                      : `Crear ${report.summary.created} producto${report.summary.created === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-mm-gbg">
                <Button type="button" className="w-full" onClick={handleClose}>
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ReportSummary({ report }: { report: ImportReport }) {
  const { created, skipped, failed, notProcessed } = report.summary;

  const cards = [
    {
      value: created,
      label: report.dryRun ? 'Listos para crear' : 'Creados',
      className: 'bg-okl text-ok',
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    {
      value: skipped,
      label: 'Ya existían',
      className: 'bg-warnl text-warn',
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    {
      value: failed,
      label: 'Con error',
      className: 'bg-rl text-r',
      icon: <XCircle className="w-5 h-5" />,
    },
    // Solo aparece si la carga se detuvo: en el camino normal es siempre cero.
    ...(notProcessed > 0
      ? [
          {
            value: notProcessed,
            label: 'Sin procesar',
            className: 'bg-mm-gbg text-mm-g',
            icon: <Clock className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  return (
    <div className={cn('grid gap-4', cards.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {cards.map((card) => (
        <div key={card.label} className={`${card.className} rounded-2xl p-4 text-center`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            {card.icon}
            <span className="text-3xl font-bold font-fraunces tabular-nums">{card.value}</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Solo las filas con problema: las correctas ya están en el resumen. */
function ProblemRows({ rows }: { rows: ImportRowResult[] }) {
  const problems = rows.filter((row) => row.status !== 'created');

  if (problems.length === 0) {
    return (
      <div className="text-center py-8 bg-okl/40 rounded-2xl">
        <CheckCircle2 className="w-10 h-10 text-ok mx-auto mb-2" />
        <p className="text-sm font-bold text-ok">Todas las filas están correctas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-mm-g">Filas por revisar ({problems.length})</h3>
      <div className="max-h-72 overflow-y-auto custom-scrollbar border border-mm-crd rounded-2xl divide-y divide-mm-gbg">
        {problems.map((row) => (
          <div key={`${row.row}-${row.name}`} className="p-4 flex gap-4 items-start">
            <span className="text-xs font-black text-mm-txw shrink-0 pt-0.5 tabular-nums">
              Fila {row.row}
            </span>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-mm-g text-sm truncate">
                  {row.name || 'Sin nombre'}
                </span>
                <Badge variant={BADGE[row.status].variant} className="text-[10px]">
                  {BADGE[row.status].label}
                </Badge>
              </div>
              <p className="text-xs text-mm-txs leading-relaxed">{row.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
