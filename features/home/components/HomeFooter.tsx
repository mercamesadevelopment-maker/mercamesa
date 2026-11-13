import { BrandLogo } from '@/components/ui/brand-logo';

interface LegalLink {
  url: string;
}

/**
 * El pie del diseño. Lo único agregado son los enlaces a los documentos legales,
 * que la ley de datos personales pide a la vista; salen del PDF publicado desde
 * Parametrización y no se muestran si todavía no hay uno.
 */
export function HomeFooter({ terms, privacy }: { terms: LegalLink | null; privacy: LegalLink | null }) {
  const legal = (
    <>
      {privacy && (
        <a href={privacy.url} target="_blank" rel="noopener noreferrer" className="text-tinta-suave hover:text-tinta-hover">
          Política de datos
        </a>
      )}
      {terms && (
        <a href={terms.url} target="_blank" rel="noopener noreferrer" className="text-tinta-suave hover:text-tinta-hover">
          Términos y condiciones
        </a>
      )}
    </>
  );

  return (
    <footer className="mt-10 border-t border-linea px-1 py-[22px] text-xs text-tinta-suave md:mt-20 md:px-0 md:pb-9 md:pt-7 md:text-sm">
      <div className="flex items-center justify-between md:flex-wrap md:gap-4">
        <BrandLogo className="text-[11px] md:text-[15px]" />
        <span className="hidden md:inline">Lo bueno de la plaza, ahora llega a tu mesa.</span>
        <span>© 2026 MercaMesa</span>
      </div>
      {(terms || privacy) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 md:mt-4">{legal}</div>}
    </footer>
  );
}
