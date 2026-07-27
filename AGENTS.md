# Arquitectura del Proyecto

Este proyecto usa Next.js App Router con arquitectura modular feature-based.

## Estructura principal

```txt
app/
├── api/
├── admin/
├── seller/
├── profile/
├── orders/
├── marketplaces/
├── auth/
```

`app/{admin,seller,customer}` son ejemplos, no una lista cerrada: **cualquier ruta de primer nivel bajo `app/` es una feature** y debe seguir la misma estructura modular. `app/profile` es hoy el ejemplo más completo del patrón: una sola feature (el perfil del comprador) con varias secciones (`components/addresses-tab.tsx`, `components/payments-tab.tsx`, etc.), cada sección con su propio archivo en `hooks/`, `services/` y `types/` (ej. `hooks/use-payments.ts` + `services/payments.service.ts` + `types/payment.types.ts` para medios de pago).

Cada módulo debe contener:

```txt
feature/
├── components/
├── hooks/
├── services/
├── types/
├── validations/
├── page.tsx
└── layout.tsx
```

---

# Reglas

## page.tsx

- Debe actuar como orquestador.
- NO contener lógica compleja.
- NO contener fetch directo si puede abstraerse.

## components/

- Solo UI y composición.
- Componentes pequeños y reutilizables.

## hooks/

- Estado cliente.
- Manejo de formularios.
- Lógica reactiva.

## services/

- Comunicación con APIs.
- Fetch.
- Server actions.
- Adaptadores externos.

## app/api/

- Endpoints backend.
- Lógica server-side.
- Auth.
- Acceso a DB.

---

# Convenciones

## Naming

- kebab-case para archivos.
- PascalCase para componentes.
- hooks empiezan con use.

Ejemplos:

```txt
user-table.tsx
use-users.ts
admin.service.ts
```

---

# Shared global

Código reutilizable global va en:

```txt
components/ui/
lib/
hooks/
types/
```

---

# Prohibido

- lógica pesada en page.tsx
- componentes gigantes
- fetch repetidos
- estilos inline masivos
- mezclar lógica de admin con seller

---

# Stack

- Next.js App Router
- React 19
- TypeScript
- TailwindCSS
- Server Components
- Server Actions