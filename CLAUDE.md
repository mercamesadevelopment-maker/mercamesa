# CLAUDE.md

Guía para trabajar en este repo (MercaMesa: Next.js App Router + Supabase).
La arquitectura modular por feature y sus convenciones de nombres están en
[AGENTS.md](./AGENTS.md) — léelo también, esto lo complementa.

---

## Stack

- Next.js App Router (React 19, Server Components + Server Actions)
- TypeScript, TailwindCSS
- Supabase (Postgres + Auth + Storage) vía `@supabase/ssr` y `@supabase/supabase-js`
- Gestor de paquetes: **pnpm** (no usar npm/yarn)

---

## Integración con Supabase

Todo el acceso a Supabase pasa por `lib/supabase/`. **No instanciar `createClient` de
`@supabase/supabase-js` o `@supabase/ssr` directamente en una página, componente o ruta** —
usar siempre uno de estos helpers, según el contexto:

| Helper | Archivo | Cuándo usarlo |
|---|---|---|
| `createSupabaseBrowserClient()` | `lib/supabase/client.ts` | Componentes cliente (`"use client"`). Usa la anon key, respeta RLS. |
| `createClient()` | `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers con sesión de cookies. Respeta RLS del usuario logueado. |
| `createSupabaseServiceClient()` | `lib/supabase/service.ts` | **Solo** en Server Actions/Route Handlers de confianza que deban saltarse RLS (service role key). Nunca exponer al cliente ni importar desde código que corra en el browser. |
| `getAuthenticatedClient(request)` / `createClientWithToken(token)` | `lib/supabase/auth-helpers.ts` | Route Handlers de `app/api/**` que reciben tanto `Authorization: Bearer` como cookies. Devuelve `{ supabase, user, error }` ya autenticado. |
| `verifyPermission(supabase, userId, moduleKey, actionName)` | `lib/supabase/auth-helpers.ts` | Chequeo de RBAC (roles/permisos) contra las tablas `profiles`/`roles`/`role_permissions` antes de una acción sensible. |
| `fetchAllRows(buildQuery)` | `lib/supabase/fetch-all.ts` | Cualquier `select` que pueda superar 1000 filas (tope silencioso de PostgREST). **Obligatorio** para catálogos/listados grandes — no reinventar paginación con `.range()` a mano. |
| `getStoragePublicUrl(bucket, path)` | `lib/supabase/utils.ts` | Construir la URL pública de un archivo en Storage. |
| `getSupabaseImageUrl(bucket, path, variant)` | `lib/supabase/supabase-image.ts` | URL de imágenes con variantes WebP pre-generadas (`thumb`/`card`/`logo`/`cover`). No usar Storage Image Transformations (`/render/image/public/`, se factura por imagen origen). |
| `uploadImageDirect(bucket, path, file)` | `lib/supabase/client-upload.ts` | Subida directa desde el browser. |

Notas importantes:

- Las URLs/keys nunca se leen de `process.env` sueltas fuera de `lib/env.ts` — usar
  `getPublicSupabaseUrl()`, `getPublicSupabaseAnonKey()`, `getServiceRoleKey()`, etc. Si
  falta una env var, esas funciones lanzan un error explícito en vez de fallar en silencio.
- `server.ts` y `service.ts` desactivan la Data Cache de `fetch` (`cache: 'no-store'`)
  porque el `fetch` parcheado de Next.js corrompe descargas binarias de Storage
  (re-serialización con pérdida). Si agregas un nuevo cliente Supabase server-side,
  replica ese `global.fetch`.
- `proxy.ts` (equivalente al middleware) refresca la sesión con cookies y protege rutas
  por prefijo (`/admin`, `/seller`, `/delivery`) contra `role_family`. Las rutas de
  `app/api/**` no redirigen ahí — cada `route.ts` maneja su propio 401.
- Tipos de la base de datos: `types/database_generated.ts` (**no editar a mano**). Tras
  cada migración se regeneran desde la base local con `pnpm gen:types:local`;
  `pnpm gen:types` los saca de producción.
- Migraciones y funciones SQL viven en `supabase/migrations` y `supabase/functions`.
  `supabase/migrations_legacy` es solo historia y no se ejecuta (ver "Entornos y base de
  datos local").

---

## Entornos y base de datos local

Hay tres entornos, y **se desarrolla contra el local**:

| Entorno | Base de datos | Cómo la usa la app |
|---|---|---|
| Local | Supabase en Docker (`supabase start`) | `.env.local`, que Next.js lee por encima de `.env` |
| Staging | Proyecto de Supabase aparte (pendiente de crear) | Variables del despliegue de staging |
| Producción | Proyecto `zaqvcpehhmkiyjdbcufj` | `.env` y las variables de Vercel |

Para trabajar contra producción desde la máquina local hay que renombrar `.env.local`. No
es el modo normal: una migración o un dato de prueba ahí lo ve el sitio publicado.

### Levantar la base local

```
pnpm db:start          # levanta Supabase en Docker
pnpm db:reset          # borra la base local y la reconstruye: migraciones + datos
pnpm db:sync-storage   # copia las imágenes públicas de producción al Storage local
pnpm db:stop
```

Puertos (los 54xxx, 55xxx y 56xxx son de otros proyectos): API `57321`, Postgres `57322`,
Studio `57323`, correo de pruebas `57324`. Configuración en `supabase/config.toml`.

`pnpm db:reset` carga, en orden, los archivos de `supabase/seed/`:

1. `pre.sql`: quita validaciones que los datos viejos de producción no cumplen.
2. `prod_data.sql`: copia de los datos de producción. **No está en git** (datos
   personales y contraseñas cifradas). Se trae o se actualiza con `pnpm db:pull-data`;
   las cuentas entran con las mismas contraseñas que en producción. No trae roles,
   módulos ni permisos: esos salen de las migraciones.
3. `local.sql`: secretos de Vault de mentira, vuelve a poner las validaciones, apaga
   las tareas programadas que llaman hacia afuera y activa todos los módulos.

Un `db:reset` también vacía el Storage local; `pnpm db:sync-storage` lo vuelve a llenar
desde `supabase/.storage-cache` sin bajar nada de nuevo.

### Migraciones

El ciclo de un cambio de esquema:

1. `supabase migration new <nombre>`: crea el archivo en `supabase/migrations`.
2. `pnpm db:reset`: lo prueba sobre una base limpia con datos reales.
3. `pnpm gen:types:local`: regenera `types/database_generated.ts`.
4. PR con la migración, los tipos y el código que la usa.
5. `supabase db push` a staging y después a producción.

Reglas:

- **Ninguna migración llega a staging o producción sin haber pasado por `pnpm db:reset`
  en local.**
- El esquema no se cambia desde el panel de Supabase ni con SQL suelto: todo cambio es
  un archivo en `supabase/migrations`.
- `20261001190000_base.sql` es el esquema completo de producción a esa fecha y
  reemplaza a todas las migraciones anteriores; `20261001190001_datos_de_referencia.sql`
  trae los roles, acciones, módulos y permisos de ese momento. No se editan: lo nuevo va
  en archivos nuevos.
- **Las migraciones corren antes de cargar los datos.** En una base recién creada solo
  existen los roles, acciones, módulos y permisos; el resto de tablas está vacío. Una
  migración puede apoyarse en esos cuatro (repartir permisos a un rol, por ejemplo), pero
  no en que haya tiendas, usuarios o parámetros.
- Los secretos (Vault, llaves) nunca van en una migración. Cada entorno crea los suyos.
- Los módulos nuevos se crean con `is_active = false` y se activan desde
  Parametrización cuando el código ya está desplegado.

### Integración continua y despliegue de migraciones

- **CI (`.github/workflows/ci.yml`)**, en cada PR hacia `main`: levanta una base vacía,
  aplica todas las migraciones, regenera los tipos y falla si
  `types/database_generated.ts` no coincide o si `tsc` no compila. Si falla por los tipos:
  `pnpm db:reset`, `pnpm gen:types:local` y subir el archivo.
- **Supabase está conectado al repositorio** (directorio de trabajo `.`, ramas de vista
  previa apagadas). Con «Deploy to production» encendido, al fusionar a `main` Supabase
  aplica en producción las migraciones de `supabase/migrations` que no estén en su
  registro. Por eso una migración solo se fusiona cuando ya pasó por local y por el CI.

### Qué está simulado en local

Local no debe tocar servicios reales. `.env.local` lo deja así:

| Servicio | En local | Cómo |
|---|---|---|
| Pibox | La cotización es real; la reserva se simula y no sale ningún mensajero | `PIBOX_DRY_RUN=true`. Las reservas simuladas tienen id `SIMULADO-…` |
| Correo | No sale: queda en la consola del servidor, incluido el código de ingreso de un administrador | `EMAIL_DRY_RUN=true` |
| Siigo | No se envía nada; las colas de facturas y notas crédito se llenan y esperan | Sin credenciales |
| ZonaPagos | No hay pasarela: un pedido se paga con saldo a favor o con `pnpm local:pay <código del pedido>` | `scripts/local-pay.ts`, que se niega a correr contra otra base que no sea la local |
| Tareas programadas | Solo corren las que son SQL puro (vencer pedidos, escalar PQRS). Las demás se llaman a mano con `CRON_SECRET` | `supabase/seed/local.sql` |

`PIBOX_DRY_RUN` y `EMAIL_DRY_RUN` nunca se encienden en producción.

Los scripts `pnpm siigo`, `pnpm pibox:hooks` y `pnpm backfill:images` leen `.env`: operan
sobre **producción**, no sobre local.

### No va a git

`.env.local`, `supabase/seed/prod_data.sql` y `supabase/.storage-cache`.

---

## Componentes compartidos (`components/ui`)

`components/ui/` es la librería de UI compartida entre features. Antes de crear un
componente nuevo, **revisa si ya existe algo reutilizable ahí** (o en `src/components/Shared.tsx`,
que expone `cn()` para mezclar clases de Tailwind — úsalo en vez de concatenar strings).

Inventario actual:

- `modal/` — `Modal` genérico (portal + animación + bloqueo de scroll).
- `confirm-modal/` — `ConfirmModal`, diálogo de confirmación sobre `Modal`.
- `table/` — tabla reutilizable, ya dividida en `components/Table.tsx`, `hooks/useTable.ts`
  y `types/index.ts`. Es la referencia a seguir para cualquier componente de UI con algo
  de lógica propia.
- `shell/` — layout de shell (sidebar, permisos), dividido igual en `components/` y
  `hooks/usePermissions.ts`. El `Sidebar` es responsive: a partir de `lg` (1024px) es el
  riel colapsable de siempre (`collapsed`/`w-20`/`w-64`); por debajo de `lg` se ignora
  `collapsed` y pasa a ser un drawer a todo el ancho que se despliega desde abajo del
  Topbar (`mobileOpen`/`onMobileClose`), con backdrop y cierre automático al navegar.
- `business-hours/` — editor de horarios de tienda.
- `map-picker/` — selector de ubicación en mapa (Leaflet).
- `quantity-stepper/` — stepper de cantidad.
- `category-scroller.tsx`, `searchable-select.tsx` — componentes de un solo archivo,
  sin estado/lógica compleja propia.

Convención para agregar uno nuevo:

- Componente simple y autocontenido (sin hook propio) → un solo archivo
  `components/ui/mi-componente.tsx`.
- Componente con lógica, tipos o subcomponentes propios → carpeta
  `components/ui/mi-componente/` con `components/`, `hooks/`, `types/` según haga falta
  (sigue el patrón de `table/` y `shell/`, no el de un archivo gigante).
- Si el componente es específico de una sola feature (no se reutiliza en otra parte de
  la app), **no va en `components/ui`** — va en `app/<feature>/components/`.

### Responsividad

- `useMediaQuery(query)` (`src/features/layout/hooks/use-media-query.ts`) — hook
  compartido para condicionar lógica en **JS** al viewport (SSR-safe: devuelve `false`
  hasta hidratar). Úsalo en vez de escribir `window.innerWidth`/`matchMedia` a mano o
  crear otro hook de breakpoint. Para estilos puros, usa las utilidades responsive de
  Tailwind (`sm:`/`md:`/`lg:`) directamente en el JSX — el hook es solo para decisiones
  que no se pueden expresar en CSS (p. ej. qué handler dispara un botón según el tamaño
  de pantalla).
- Breakpoint oficial desktop/móvil para el shell de navegación: **`lg` (1024px)**
  (`useMediaQuery('(min-width: 1024px)')`), igual al que ya usa `Topbar` para ocultar
  texto secundario.
- Patrón de panel off-canvas (drawer): overlay `fixed inset-0 z-40 bg-black/40` +
  panel con `translate-y`/`translate-x` + `transition-all duration-300`, que se cierra
  al tocar el backdrop o al navegar. Es el patrón de `Sidebar` (ver arriba) — replícalo
  para cualquier otro menú/panel off-canvas en vez de inventar una variante nueva.

---

## Reglas obligatorias

### 1. No boilerplate

Antes de escribir código nuevo, busca si ya existe un helper/componente/hook que resuelva
lo mismo y reúsalo. En particular:

- Paginación de más de 1000 filas → `fetchAllRows`, no `.range()` manual repetido.
- Cliente Supabase → los helpers de `lib/supabase/`, no `createClient(...)` inline.
- Clases condicionales → `cn()` de `src/components/Shared.tsx`, no template strings a mano.
- Modales/confirmaciones/tablas/selects → los componentes de `components/ui/`, no
  reimplementar un `<div>` con `position: fixed` de cero.
- URLs de imágenes/storage → `getStoragePublicUrl` / `getSupabaseImageUrl`, no construir
  la ruta `/storage/v1/object/public/...` a mano.
- Detección de viewport en JS → `useMediaQuery` (ver "Responsividad" arriba), no un hook
  nuevo ni `window.innerWidth` inline.

Si dos features necesitan la misma lógica, esa lógica sube a `lib/`, `components/ui/`,
`hooks/` o `types/` (ver "Shared global" en AGENTS.md) — no se copia y pega.

### 2. Single responsibility

Cada archivo/función/componente hace una sola cosa:

- `page.tsx` orquesta, no contiene fetch directo ni lógica de negocio (eso va en
  `services/`) ni estado complejo (eso va en `hooks/`).
- Un componente de UI no hace fetch de datos ni conoce reglas de negocio; recibe props
  y emite eventos.
- Un `service` no renderiza JSX ni maneja estado de React.
- Un hook no hace queries HTTP directas si ya hay un `service` para eso — las compone.

### 3. No monolitos

Ningún archivo debe crecer indefinidamente mezclando responsabilidades. Si un archivo
supera unos pocos cientos de líneas o junta varias vistas/entidades, se divide siguiendo
la estructura de feature de AGENTS.md (`components/`, `hooks/`, `services/`, `types/`).

`src/components/AdminViews.tsx` (~3700 líneas) y `src/components/Marketplace.tsx`
(~2000 líneas) son **deuda técnica heredada, no un ejemplo a seguir**. No agregues código
nuevo ahí: si tocas algo dentro de esos archivos, extrae esa pieza a su feature
correspondiente bajo `app/` (o a `components/ui/` si es genérica) en vez de sumarle más
líneas al monolito.

---

## Prohibido (resumen de AGENTS.md)

- Lógica pesada en `page.tsx`.
- Componentes gigantes o "de todo un poco".
- Fetch repetido/duplicado en vez de reutilizar `services/`.
- Instanciar Supabase fuera de `lib/supabase/`.
- Mezclar lógica de `admin` con `seller` (o de cualquier feature con otra).
- Exponer `SUPABASE_SERVICE_ROLE_KEY` o el cliente creado con ella al lado del cliente.
