'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Building2, MapPin, Store as StoreIcon } from 'lucide-react';

import { Modal } from '@/components/ui/modal/modal';
import { Badge } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';

type MarketplaceDetail =
  Database['public']['Views']['marketplaces_detail']['Row'] & {
    coverImageUrl?: string | null;
    logoUrl?: string | null;
    stores?: any[];
  };

interface MarketplaceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
}

export function MarketplaceDetailModal({
  isOpen,
  onClose,
  slug,
}: MarketplaceDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MarketplaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !slug) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/marketplaces/detail/${slug}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error);
        }

        setData(result.data);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error cargando detalles'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, slug]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de la Plaza"
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="p-12 text-center text-mm-txs">
          Cargando información...
        </div>
      ) : error || !data ? (
        <div className="p-12 text-center text-r">
          {error || 'No se encontró información.'}
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Header / Cover */}
          <div className="relative h-48 sm:h-64 bg-mm-gbg w-full shrink-0 overflow-hidden">
            {data.coverImageUrl ? (
              <Image
                src={data.coverImageUrl}
                alt={`Cover de ${data.name || 'Marketplace'}`}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-mm-gbg/50">
                <Building2 className="w-12 h-12 text-mm-crd" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Floating Logo and Info */}
            <div className="absolute bottom-0 left-0 w-full p-6 flex items-end gap-6 translate-y-1/4">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-3xl p-2 shadow-xl shrink-0">
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-mm-gbg flex items-center justify-center border border-mm-crd/20">
                  {data.logoUrl ? (
                    <Image
                      src={data.logoUrl}
                      alt={data.name || ''}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  ) : (
                    <Building2 className="w-8 h-8 text-mm-txw" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pt-16 pb-8 space-y-8">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-3xl font-fraunces text-mm-g mb-2">
                  {data.name}
                </h2>

                <div className="flex flex-wrap items-center gap-2 text-sm text-mm-txs">
                  <MapPin className="w-4 h-4 text-mm-oro shrink-0" />

                  <span>
                    {data.city}, {data.department}
                  </span>

                  {data.address && <span>• {data.address}</span>}
                </div>
              </div>

              <Badge variant={data.is_active ? 'success' : 'warning'}>
                {data.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>

            {data.description && (
              <div>
                <h3 className="text-sm font-bold text-mm-g uppercase tracking-widest mb-3">
                  Descripción
                </h3>

                <p className="text-mm-txs bg-mm-gbg/30 p-4 rounded-2xl border border-mm-crd/50">
                  {data.description}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-mm-g uppercase tracking-widest">
                  Tiendas Asociadas ({data.stores_count || 0})
                </h3>
              </div>

              {data.stores && data.stores.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.stores.map((store: any) => (
                    <div
                      key={store.id}
                      className="bg-white p-4 rounded-2xl border border-mm-crd/60 flex items-center gap-3 hover:border-mm-g/40 transition-all shadow-sm"
                    >
                      <div className="relative w-12 h-12 bg-mm-gbg rounded-xl flex items-center justify-center shrink-0 border border-mm-crd/30 overflow-hidden">
                        {store.logoSignedUrl ? (
                          <Image
                            src={store.logoSignedUrl}
                            alt={store.name}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <StoreIcon className="w-5 h-5 text-mm-txw" />
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-mm-g truncate">
                          {store.name}
                        </p>

                        <p className="text-[10px] text-mm-txw font-bold uppercase truncate">
                          {store.contact_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-mm-gbg/30 rounded-2xl border border-mm-crd/50 text-mm-txw text-sm">
                  Esta plaza aún no tiene tiendas registradas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}