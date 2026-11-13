/** El párrafo debajo del hero. El del celular es más corto, como en el diseño. */
export function HomeIntro() {
  return (
    <>
      <p className="mx-[6px] mt-[18px] text-[15px] leading-[1.55] text-tinta-texto md:hidden">
        <b className="text-tinta">MercaMesa conecta las principales centrales de abastos de tu ciudad con la mesa de tu casa.</b>{' '}
        Carolina, nuestra tendera digital con IA, te arma el mercado con lo más fresco y al mejor precio.
      </p>
      <p className="mx-auto mt-7 hidden max-w-[820px] text-center text-lg leading-[1.6] text-tinta-texto md:block">
        <b className="text-tinta">
          MercaMesa es la plataforma que conecta las principales centrales de abastos de tu ciudad con la mesa de tu casa.
        </b>{' '}
        Carolina, nuestra tendera digital con IA, te arma el mercado con los productos más frescos y al mejor precio:
        ahorras, apoyas a tenderos y campesinos, y mercas en menos de cinco minutos.
      </p>
    </>
  );
}
