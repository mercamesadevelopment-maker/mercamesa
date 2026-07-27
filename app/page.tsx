'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Button, cn } from '@/src/components/Shared';
import { ShoppingBag, Package, Leaf, User } from 'lucide-react';
import { LoginModal } from './auth/LoginModal';
import { RegisterModal } from './auth/RegisterModal';
import { BuyerRegisterModal } from './auth/BuyerRegisterModal';
import { ForgotPasswordModal } from './auth/ForgotPasswordModal';
import { useApp } from '@/src/store';
import Image from 'next/image';

const roleRoutes: Record<string, string> = {
  retail: '/marketplaces',
  wholesale: '/marketplaces',
  provider: '/seller/dashboard',
  delivery: '/delivery',
  admin: '/admin/marketplaces',
};

export default function Page() {
  const { state } = useApp();
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBuyerRegisterOpen, setIsBuyerRegisterOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  useEffect(() => {
    if (state.isLoggedIn) {
      const route = roleRoutes[state.userRole] || '/marketplaces';
      router.replace(route);
    }
  }, [state.isLoggedIn, state.userRole, router]);

  // Show landing page (not logged in)
  return (
    <div className="min-h-screen bg-[#FAFAF5] overflow-x-hidden font-dm-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full h-20 bg-white/90 backdrop-blur-md z-50 border-b border-mm-gbg flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <Image
            src="/logo_MercaMesa_Ful.jpg"
            alt="Mercamesa"
            className="h-12 w-auto"
            width={192}
            height={192}
          />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLoginOpen(true)}
            className="text-mm-g font-bold hover:text-mm-gm transition-colors px-4 py-2"
          >
            Iniciar sesión
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative pt-40 pb-28 px-6 lg:px-12 flex items-center min-h-[700px] overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.65)), url("https://plus.unsplash.com/premium_photo-1661941056969-64b7b4f6adda?q=80&w=2801&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-7xl font-fraunces font-black text-white leading-tight mb-6 drop-shadow-2xl"
          >
            MercaMesa: Plataforma de Integración Agroalimentaria. <br />
            <span className="text-mm-gll drop-shadow-md">Del campo a tu mesa, con dignidad.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg lg:text-3xl text-white max-w-4xl mx-auto mb-10 font-medium drop-shadow-xl"
          >
            MercaMesa transforma el mercado en comunidad. Es una solución digital que conecta a todos los actores del sistema agroalimentario—campesinos, comerciantes, transportadores, consumidores y administradores—en una red viva, justa y trazable.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4 relative z-20"
          >
            <Button
              onClick={() => setIsLoginOpen(true)}
              size="lg"
              className="px-8 bg-mm-oro hover:bg-mm-oro/90 text-white border-none shadow-xl"
            >
              Iniciar sesión
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8 border-white text-white hover:bg-white/10 backdrop-blur-sm"
              onClick={() => document.getElementById('descubre')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Conocer más
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-12 bg-mm-gbg">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8">
          <div className="flex items-center gap-6 bg-white p-6 rounded-3xl shadow-sm">
            <Image
              src="/icon-reconocimiento-shape.png"
              alt="Reconocimiento"
              width={192}
              height={192}
            />
            <p className="text-xl font-fraunces text-mm-g font-bold">Aquí, cada transacción es un acto de reconocimiento.</p>
          </div>
          <div className="flex items-center gap-6 bg-white p-6 rounded-3xl shadow-sm">
            <Image
              src="/icon-comunicacion-shape.png"
              alt="Comunicación"
              width={192}
              height={192}
            />
            <p className="text-xl font-fraunces text-mm-g font-bold">Cada producto, una historia que merece ser contada.</p>
          </div>
        </div>
      </section>

      {/* Why Mercamesa */}
      <section id="descubre" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-fraunces text-mm-g mb-6">¿Por qué Mercamesa?</h2>
          <p className="text-lg text-mm-txs max-w-2xl mx-auto">
            Porque digitaliza sin deshumanizar. Organiza sin apagar la emoción. Y revela lo que siempre fue valioso: el trabajo digno, la trazabilidad consciente y el comercio justo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
          {[
            { title: "Para productores", desc: "Venta directa, precios justos, visibilidad real.", img: "https://mercamesa.com/wp-content/uploads/2025/09/banner-4-1024x578.jpg" },
            { title: "Para comerciantes", desc: "Eficiencia logística, trazabilidad, conexión con origen.", img: "https://mercamesa.com/wp-content/uploads/2025/09/banner-1-1024x578.jpg" },
            { title: "Para consumidores", desc: "Alimentos locales, saludables y con sentido.", img: "https://mercamesa.com/wp-content/uploads/2025/09/banner-5-pescados-1024x578.jpg" },
            { title: "Para transportadores", desc: "Rutas visibles, propósito claro, reconocimiento.", img: "https://mercamesa.com/wp-content/uploads/2025/09/banner-2-1024x578.jpg" },
            { title: "Para administradores", desc: "Control operativo, armonía en la plaza, impacto social.", img: "https://mercamesa.com/wp-content/uploads/2025/09/banner-3-1024x578.jpg" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-mm-gbg hover:shadow-md transition-shadow"
            >
              <Image
                src={item.img}
                alt={item.title}
                width={192}
                height={192}
              />
              <div className="p-6">
                <h3 className="text-lg font-bold text-mm-g mb-2">{item.title}</h3>
                <p className="text-sm text-mm-txs">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-24 bg-white px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-fraunces text-mm-g text-center mb-16">¿Qué puedes hacer hoy?</h2>
          <div className="grid md:grid-cols-4 gap-12 relative">
            {[
              { icon: <User className="w-10 h-10" />, title: "Registro", desc: "Registrarte como productor, comerciante, transportador, administrador o consumidor", onClick: () => setIsRegisterOpen(true) },
              { icon: <ShoppingBag className="w-10 h-10" />, title: "Exploración", desc: "Explorar productos con trazabilidad y propósito" },
              { icon: <Package className="w-10 h-10" />, title: "Descarga", desc: "Descargar la app y empezar a comprar con conciencia" },
              { icon: <Leaf className="w-10 h-10" />, title: "Conexión", desc: "Conectarte con quienes sostienen el sistema agroalimentario" }
            ].map((step, i) => (
              <div
                key={i}
                className={cn("flex flex-col items-center text-center group", step.onClick && "cursor-pointer")}
                onClick={step.onClick}
              >
                <div className="w-24 h-24 rounded-full bg-mm-gbg flex items-center justify-center text-mm-g mb-6 relative group-hover:bg-mm-g group-hover:text-white transition-colors duration-300">
                  {step.icon}
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-mm-oro text-white rounded-full flex items-center justify-center font-bold shadow-sm">
                    {i + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-mm-g mb-2">{step.title}</h3>
                <p className="text-sm text-mm-txs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MKM Section */}
      <section className="py-24 bg-mm-gbg px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl lg:text-5xl font-fraunces text-mm-g">MKM: El altar de la memoria campesina</h2>
            <p className="text-lg text-mm-txs">
              Dentro de MercaMesa vive MKM, un espacio simbólico donde cada producto lleva consigo la historia de quienes lo cultivan.
            </p>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm flex items-center gap-4">
                <img src="https://mercamesa.com/wp-content/uploads/2025/12/icon-tradicion-shape.png" alt="" className="w-12 h-12" referrerPolicy="no-referrer" />
                <span className="font-bold text-mm-g">La tradición se exhibe con orgullo.</span>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm flex items-center gap-4">
                <img src="https://mercamesa.com/wp-content/uploads/2025/12/icon-innovacion-shape.png" alt="" className="w-12 h-12" referrerPolicy="no-referrer" />
                <span className="font-bold text-mm-g">La innovación amplifica lo humano.</span>
              </div>
            </div>
            <Button onClick={() => setIsLoginOpen(true)} size="lg" className="px-10">Iniciar sesión</Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src="https://mercamesa.com/wp-content/uploads/2025/09/image-3-1024x495.jpg" alt="" className="rounded-3xl h-full object-cover" referrerPolicy="no-referrer" />
            <img src="https://mercamesa.com/wp-content/uploads/2025/09/image-2-1024x495.jpg" alt="" className="rounded-3xl h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 lg:px-12 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-4xl lg:text-5xl font-fraunces text-mm-g mb-8">Mercamesa es más que una herramienta</h2>
          <div className="space-y-6 text-lg text-mm-txs mb-10">
            <p>Es el conjuro digital que convierte la logística en poesía, la plaza en ritual, y la compra en acto de reconocimiento.</p>
            <p>Úsalo. Habítalo. Hazlo tuyo. Porque aquí, la dignidad se practica. Y el futuro, se cultiva.</p>
          </div>
          <Button onClick={() => setIsLoginOpen(true)} size="lg" className="px-10">Iniciar sesión</Button>
        </div>
        <div className="relative">
          <img
            src="https://mercamesa.com/wp-content/uploads/2025/09/image-mercado-local.jpg"
            alt="Mercado local"
            className="rounded-[40px] shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-mm-g text-white py-16 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo_MercaMesa_Ful.jpg"
              alt="Mercamesa"
              width={192}
              height={192}
              className="h-10 w-auto brightness-0 invert"
            />
          </div>
          <div className="flex gap-8 text-sm">
            <a href="#" className="hover:text-mm-gll transition-colors">Política de tratamiento de datos personales</a>
          </div>
          <div className="text-sm text-white/60">
            © 2024 Mercamesa. Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {isLoginOpen && (
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
            onRegisterClick={() => {
              setIsLoginOpen(false);
              setIsBuyerRegisterOpen(true);
            }}
            onForgotPasswordClick={() => {
              setIsLoginOpen(false);
              setIsForgotPasswordOpen(true);
            }}
          />
        )}
        {isRegisterOpen && <RegisterModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />}
        {isBuyerRegisterOpen && (
          <BuyerRegisterModal isOpen={isBuyerRegisterOpen} onClose={() => setIsBuyerRegisterOpen(false)} />
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
