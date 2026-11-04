import { useEffect, useState } from 'react';

export interface IdentificationTypeOption {
  id: string;
  name: string;
  code: string;
  slug: string;
}

export interface PersonTypeOption {
  id: string;
  name: string;
  slug: string;
  requires_business_name: boolean;
  identification_types: IdentificationTypeOption[];
}

/**
 * Catálogo de tipos de persona con las identificaciones que admite cada uno.
 *
 * Sale de `/api/identification-types`, que es público a propósito: lo usan los
 * formularios de registro, donde todavía no hay sesión. Antes esta lista estaba
 * fija y duplicada en BuyerRegisterModal y en account-tab.
 */
export function useIdentificationTypes() {
  const [personTypes, setPersonTypes] = useState<PersonTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/identification-types')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
          return;
        }
        setPersonTypes(json.data ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error cargando los tipos de identificación');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Todas las identificaciones, sin repetir, para pantallas que no filtran por persona. */
  const allIdentificationTypes: IdentificationTypeOption[] = Array.from(
    new Map(
      personTypes.flatMap((person) =>
        person.identification_types.map((type) => [type.id, type] as const)
      )
    ).values()
  );

  return { personTypes, allIdentificationTypes, loading, error };
}
