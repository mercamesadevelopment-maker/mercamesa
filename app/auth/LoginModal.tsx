'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, ArrowRight } from 'lucide-react';

import { Button, Input, StepBar } from '@/src/components/Shared';
import { ROLE_ROUTES } from '@/src/constants';
import { useAuthHooks } from '../hooks/useAuth';

export function LoginModal({
  isOpen,
  onClose,
  onRegisterClick,
  onForgotPasswordClick,
  defaultEmail,
  redirectTo,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRegisterClick?: () => void;
  onForgotPasswordClick?: () => void;
  /** Correo con el que llega la persona; p. ej. desde el registro, cuando ya tenía cuenta. */
  defaultEmail?: string;
  /**
   * A dónde ir tras iniciar sesión en vez del panel del rol: el producto o
   * tienda que le compartieron a la persona antes de que el proxy la mandara
   * acá por no tener sesión.
   */
  redirectTo?: string | null;
}) {
  const { login, verifyLoginCode, loading, error, cooldownSeconds } = useAuthHooks();

  const [showPass, setShowPass] = useState(false);
  // Admin y superadmin verifican además con un código al correo. Para el resto
  // de roles este paso no existe y el modal se ve igual que siempre.
  const [pasoCodigo, setPasoCodigo] = useState(false);
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  // Se conserva para poder reenviar el código sin hacer escribirlo todo de
  // nuevo. Vive solo en memoria y mientras el modal esté abierto, igual que
  // mientras estaba escrito en el campo.
  const [clave, setClave] = useState('');

  const entrar = (roleKey: string) => {
    onClose();
    // Navegación completa (no router.push): el login corre en el servidor y deja
    // la sesión en cookies httpOnly. El cliente Supabase del navegador que usa
    // AppProvider ya está montado desde antes del login y no se entera de esas
    // cookies nuevas sin recrearse — por eso hace falta recargar la página al
    // llegar a la ruta destino. Va acá, y no en cada llamada, para que valga
    // también para quien entra con código de verificación.
    window.location.href =
      redirectTo || ROLE_ROUTES[roleKey as keyof typeof ROLE_ROUTES] || '/marketplaces';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await login(email, password);

      if ('requiresCode' in result && result.requiresCode) {
        setCorreo(result.email);
        setClave(password);
        setCodigo('');
        setPasoCodigo(true);
        return;
      }

      entrar(result.roleKey);
    } catch (err) {
      // El error ya se maneja en el hook
      console.error(err);
    }
  };

  const handleVerificar = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await verifyLoginCode(correo, codigo);
      entrar(result.roleKey);
    } catch (err) {
      console.error(err);
    }
  };

  // Reenviar es volver a pedir el ingreso: el servidor invalida el código
  // anterior y manda uno nuevo. La espera la impone él y la refleja el contador.
  const handleReenviar = async () => {
    if (cooldownSeconds > 0 || loading) return;
    try {
      await login(correo, clave);
      setCodigo('');
    } catch (err) {
      console.error(err);
    }
  };

  const volverAlInicio = () => {
    setPasoCodigo(false);
    setCodigo('');
    setClave('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full p-2 transition-colors hover:bg-mm-gbg"
        >
          <X className="h-6 w-6 text-mm-txs" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-10">
          {/* Logo */}
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mm-oro text-2xl">
              🌿
            </div>

            <div>
              <h1 className="font-fraunces text-2xl font-bold text-mm-g">
                MercaMesa
              </h1>

              <p className="text-sm text-mm-txs">
                Plataforma agroalimentaria
              </p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h2 className="mb-2 font-fraunces text-3xl text-mm-g">
              {pasoCodigo ? 'Verifica que eres tú' : 'Bienvenido de vuelta'}
            </h2>

            <p className="text-mm-txs">
              {pasoCodigo ? (
                <>
                  Enviamos un código de 6 dígitos a{' '}
                  <span className="font-medium text-mm-g">{correo}</span>.
                </>
              ) : (
                'Ingresa tus credenciales para continuar.'
              )}
            </p>
          </div>

          {pasoCodigo && <StepBar step={1} total={2} />}

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-2xl bg-red-100 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Paso 2: el código, solo para admin y superadmin */}
          {pasoCodigo ? (
            <form onSubmit={handleVerificar} className="space-y-5">
              <Input
                label="Código de 6 dígitos"
                name="code"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em]"
                autoFocus
                required
              />

              <Button
                type="submit"
                className="w-full py-4 text-lg"
                loading={loading}
                disabled={codigo.length !== 6}
              >
                Entrar
                <ArrowRight className="h-5 w-5" />
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={volverAlInicio}
                  className="font-medium text-mm-txs hover:underline"
                >
                  Volver
                </button>

                <button
                  type="button"
                  onClick={handleReenviar}
                  disabled={cooldownSeconds > 0 || loading}
                  className="font-medium text-mm-g hover:underline disabled:cursor-not-allowed disabled:text-mm-txw disabled:no-underline"
                >
                  {cooldownSeconds > 0 ? `Reenviar en ${cooldownSeconds}s` : 'Reenviar código'}
                </button>
              </div>
            </form>
          ) : (

          /* Form */
          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              placeholder="ejemplo@correo.com"
              defaultValue={defaultEmail}
              required
            />

            <div className="relative">
              <Input
                label="Contraseña"
                name="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                required
              />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-10 text-mm-txw transition-colors hover:text-mm-g"
              >
                {showPass ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {onForgotPasswordClick && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={onForgotPasswordClick}
                  className="text-sm font-medium text-mm-g hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full py-4 text-lg"
              loading={loading}
            >
              Ingresar
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>
          )}

          {/* El registro no tiene sentido mientras se verifica un ingreso. */}
          {!pasoCodigo && onRegisterClick && (
            <p className="mt-6 text-center text-sm text-mm-txs">
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={onRegisterClick}
                className="font-medium text-mm-g hover:underline"
              >
                Regístrate como comprador
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}