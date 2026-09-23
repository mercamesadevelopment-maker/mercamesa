'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Info } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { useBanks } from '../hooks/use-bank-accounts';

/**
 * El catálogo de bancos.
 *
 * Viene con BBVA y nada más, a propósito: la norma remite a un "anexo 1" con los
 * códigos de los demás bancos que no está entre los documentos que tenemos.
 * Inventarlos sería mandarle la plata de un tendero al banco equivocado, y el
 * archivo se procesaría sin quejarse.
 */
export function BanksTab() {
  const { banks, loading, fetchBanks, crearBanco } = useBanks();
  const [abierto, setAbierto] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  const enviar = async () => {
    setTrabajando(true);
    setFallo(null);
    try {
      await crearBanco(code.trim(), name.trim());
      setAbierto(false);
      setCode('');
      setName('');
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo registrar el banco.');
    } finally {
      setTrabajando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-2xl border border-mm-crd/40 bg-mm-gbg/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
        <p className="text-xs leading-relaxed text-mm-txs">
          Los códigos salen del <span className="font-bold">anexo 1</span> que entrega BBVA con la
          documentación de Global C@sh. Solo viene cargado BBVA (0013), que es el único que
          confirma la norma: cargar un código equivocado manda el dinero a otro banco y el archivo
          se procesa igual, sin avisar.
        </p>
      </div>

      <Button onClick={() => { setAbierto(true); setFallo(null); }}>
        <Plus className="mr-1.5 h-4 w-4" />
        Agregar banco
      </Button>

      <div className="divide-y divide-mm-crd/40 rounded-2xl border border-mm-crd">
        {banks.map((b) => (
          <div key={b.code} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-bold text-mm-g">{b.name}</span>
            <span className="font-mono text-sm text-mm-txw">{b.code}</span>
          </div>
        ))}
      </div>

      <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="Agregar un banco" maxWidth="max-w-md">
        <div className="space-y-5 p-6">
          <Input
            label="Código (4 dígitos)"
            value={code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="Como aparece en el anexo, ej. 0013"
            autoFocus
          />
          <Input
            label="Nombre"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="Ej: Bancolombia"
          />

          <p className="text-xs text-mm-txw">
            Cópialo tal cual del anexo, con sus ceros a la izquierda.
          </p>

          {fallo && <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{fallo}</div>}

          <div className="flex justify-end gap-3 border-t border-mm-crd/40 pt-4">
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={trabajando}>
              Cancelar
            </Button>
            <Button onClick={enviar} loading={trabajando} disabled={code.length !== 4 || !name.trim()}>
              Agregar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
