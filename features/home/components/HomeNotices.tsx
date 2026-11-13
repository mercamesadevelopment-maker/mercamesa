/**
 * Los rebotes del proxy: la cuenta no tiene acceso a la sección (`sin_acceso`) o
 * la inactivaron con la sesión abierta (`cuenta_inactiva`). Se dice cuál sección
 * era, porque si no la persona solo ve que «no pasó nada».
 */
export function HomeNotices({ sinAcceso, cuentaInactiva }: { sinAcceso: string | null; cuentaInactiva: boolean }) {
  if (cuentaInactiva) {
    // Mismo texto que el del login, para que no parezcan dos problemas distintos.
    return (
      <p role="status" className="mb-4 rounded-2xl bg-arcilla-clara px-5 py-3 text-center text-sm text-tinta">
        Tu cuenta está inactiva. Si crees que es un error, escríbenos a{' '}
        <span className="font-bold">soporte@mercamesa.com</span>.
      </p>
    );
  }
  if (sinAcceso) {
    return (
      <p role="status" className="mb-4 rounded-2xl bg-arcilla-clara px-5 py-3 text-center text-sm text-tinta">
        Tu cuenta no tiene acceso a <span className="font-bold">{sinAcceso}</span>. Si crees que debería tenerlo,
        pídeselo a un administrador.
      </p>
    );
  }
  return null;
}
