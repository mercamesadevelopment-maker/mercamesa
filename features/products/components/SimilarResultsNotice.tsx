/**
 * Lo buscado no está escrito así en ningún producto, ni suena igual: la vitrina
 * muestra los que más se parecen (`findSimilarProductIds`) y lo dice, para que
 * nadie crea que «aguacte» existe tal cual.
 */
export function SimilarResultsNotice({ search }: { search: string }) {
  return (
    <p className="rounded-2xl bg-lima-clara px-4 py-3 text-sm text-tinta">
      No encontramos «<span className="font-semibold">{search.trim()}</span>». Te mostramos los productos que más se
      parecen.
    </p>
  );
}
