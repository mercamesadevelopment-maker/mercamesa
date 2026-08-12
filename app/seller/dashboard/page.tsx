'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardView } from './components/dashboard-view';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export default function SellerDashboardPage() {
  const { stores, loading: storeLoading } = useSellerStore();
  const router = useRouter();

  useEffect(() => {
    if (storeLoading) return;
    if (stores.length === 0) return;

    const checkVerification = async () => {
      try {
        const res = await fetch('/api/stores?member_only=true');
        const data = await res.json();
        
        if (data.data) {
          const sellerStores = data.data;
          const requiredDocumentTypes = data.requiredDocumentTypes || [];
          const requiredIds = requiredDocumentTypes.map((t: any) => t.id);

          if (requiredIds.length > 0) {
            const hasPendingStore = sellerStores.some((store: any) => {
              const storeDocs = store.store_documents || [];
              const approvedTypeIds = storeDocs
                .filter((d: any) => d.status === 'approved')
                .map((d: any) => d.document_type_id);
              
              const isVerified = requiredIds.every((id: any) => approvedTypeIds.includes(id));
              return !isVerified;
            });

            if (hasPendingStore) {
              router.push('/seller/onboarding');
            }
          }
        }
      } catch (err) {
        console.error('Error verifying stores onboarding status:', err);
      }
    };

    checkVerification();
  }, [stores, storeLoading, router]);

  return <DashboardView />;
}