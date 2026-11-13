'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/features/auth/components/LoginModal';
import { BuyerRegisterModal } from '@/features/auth/components/BuyerRegisterModal';
import { ForgotPasswordModal } from '@/features/auth/components/ForgotPasswordModal';
import { useSession } from '@/features/auth/session-context';
import { useLegalLinks } from '@/features/auth/hooks/use-legal-links';
import { ROLE_ROUTES } from '@/lib/auth/roles';
import { useHomeVideo } from '../hooks/useHomeVideo';
import { HomeHeader } from './HomeHeader';
import { HomeNotices } from './HomeNotices';
import { HomeHero } from './HomeHero';
import { HomeIntro } from './HomeIntro';
import { CarolinaCard } from './CarolinaCard';
import { HomeSteps } from './HomeSteps';
import { HomeMission } from './HomeMission';
import { HowItWorks } from './HowItWorks';
import { HomeFooter } from './HomeFooter';

/**
 * La página de inicio (diseño del cliente: docs/design/MercaMesa · Home.html).
 *
 * Además de mostrarla, decide a dónde va quien llega: con sesión, a la ruta de su
 * rol o a lo que le compartieron (`?redirect=`); sin sesión y con un enlace
 * compartido, se le abre el login de una vez.
 */
export function HomePage({ whatsappUrl }: { whatsappUrl: string | null }) {
  const session = useSession();
  const router = useRouter();
  const { terms, privacy } = useLegalLinks();
  const video = useHomeVideo();

  // El proxy marca así el rebote por falta de permisos. Sin esta marca, la
  // redirección de abajo lo devolvería a la misma ruta que el proxy acaba de
  // rechazar, y el ida y vuelta se ve como una página que no hace nada.
  const [sinAcceso, setSinAcceso] = useState<string | null>(null);
  const [cuentaInactiva, setCuentaInactiva] = useState(false);
  // A dónde volver tras iniciar sesión o registrarse: lo que el proxy marcó al
  // rebotar un link compartido (producto o tienda) sin sesión.
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isBuyerRegisterOpen, setIsBuyerRegisterOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  // Correo que viaja del registro al inicio de sesión cuando resulta que ya
  // tenía cuenta, para no obligar a escribirlo de nuevo.
  const [loginEmail, setLoginEmail] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');

  useEffect(() => {
    // Se lee acá dentro, y no en un efecto aparte, porque el aviso y la
    // redirección tienen que decidirse con el mismo dato: si el valor llegara un
    // ciclo después, este efecto ya habría reenviado a la ruta rechazada.
    const params = new URLSearchParams(window.location.search);
    const rebotado = params.get('sin_acceso');
    const inactiva = params.get('cuenta_inactiva') === '1';
    const redirectParam = params.get('redirect');
    // Solo una ruta relativa propia: `//host` o `/\host` son formas de colar un
    // dominio externo en lo que parece una ruta absoluta.
    const redirect =
      redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//') && !redirectParam.startsWith('/\\')
        ? redirectParam
        : null;
    setSinAcceso(rebotado);
    setCuentaInactiva(inactiva);
    setRedirectTo(redirect);

    if (session.isLoggedIn && !rebotado && !inactiva) {
      // Sesión ya abierta en otra pestaña, por ejemplo: no hace falta pasar por
      // el login, se va directo a lo que se compartió.
      router.replace(redirect || ROLE_ROUTES[session.role] || '/marketplaces');
      return;
    }

    // Sin sesión y con un link compartido de por medio: se abre el login de una
    // vez, en vez de dejar que la persona tenga que encontrar el botón.
    if (!session.isLoggedIn && redirect) {
      setIsLoginOpen(true);
    }
  }, [session.isLoggedIn, session.role, router]);

  const openLogin = () => setIsLoginOpen(true);
  const openRegister = () => setIsBuyerRegisterOpen(true);
  // Carolina está en WhatsApp. Sin el número configurado en el entorno, el
  // botón lleva al registro en vez de a un enlace roto.
  const chatWithCarolina = () => {
    if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    else openRegister();
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white font-sans text-tinta">
      <div className="mx-auto max-w-[1360px] px-[14px] md:px-8">
        <HomeHeader onLogin={openLogin} onRegister={openRegister} onNavigate={video.scrollTo} />
        <HomeNotices sinAcceso={sinAcceso} cuentaInactiva={cuentaInactiva} />
        <HomeHero onStart={openRegister} />
        <HomeIntro />
        <CarolinaCard onChat={chatWithCarolina} />
        <HomeSteps onChat={chatWithCarolina} onPlayVideo={video.play} />
        <HomeMission onLogin={openLogin} onRegister={openRegister} onPlayVideo={video.play} />
        <HowItWorks videoRef={video.videoRef} autoPlay={video.autoPlay} />
        <HomeFooter terms={terms} privacy={privacy} />
      </div>

      <AnimatePresence>
        {isLoginOpen && (
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
            defaultEmail={loginEmail}
            redirectTo={redirectTo}
            onRegisterClick={(email) => {
              setRegisterEmail(email ?? '');
              setIsLoginOpen(false);
              setIsBuyerRegisterOpen(true);
            }}
            onForgotPasswordClick={() => {
              setIsLoginOpen(false);
              setIsForgotPasswordOpen(true);
            }}
          />
        )}
        {isBuyerRegisterOpen && (
          <BuyerRegisterModal
            isOpen={isBuyerRegisterOpen}
            onClose={() => setIsBuyerRegisterOpen(false)}
            redirectTo={redirectTo}
            defaultEmail={registerEmail}
            onLoginClick={(email) => {
              setLoginEmail(email);
              setIsBuyerRegisterOpen(false);
              setIsLoginOpen(true);
            }}
          />
        )}
        {isForgotPasswordOpen && (
          <ForgotPasswordModal
            isOpen={isForgotPasswordOpen}
            onClose={() => setIsForgotPasswordOpen(false)}
            onBackToLogin={() => setIsLoginOpen(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
