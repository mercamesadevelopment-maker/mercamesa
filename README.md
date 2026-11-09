<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1bbe7a09-3094-46c5-a54a-344e6e9be6d4

## Run Locally

**Prerequisites:** Node.js y pnpm (`corepack enable pnpm` instala la versión fijada en el campo `packageManager` de package.json).

1. Instalar dependencias:
   `pnpm install`
2. Copiar `.env.example` a `.env` y completar las variables.
3. Levantar la app:
   `pnpm dev`

Otros comandos:

| Comando | Descripción |
|---|---|
| `pnpm build` | Build de producción |
| `pnpm lint` | Linter de Next |
| `pnpm gen:types` | Regenera `types/database_generated.ts` desde Supabase |
| `pnpm backfill:images --dry-run` | Inventaria los derivados WebP faltantes |
| `pnpm pibox:hooks list` | Gestiona los webhooks de Pibox |

> Nota: con pnpm los argumentos van directo, **sin** `--` (`pnpm backfill:images --dry-run`). Si se usa `--`, pnpm lo pasa como un argumento literal más.

## Usuarios para probar cada rol (base local)

Solo existen en la base local de Docker (ver «Entornos y base de datos local» en
[CLAUDE.md](./CLAUDE.md)). Los crea [`supabase/seed/local.sql`](./supabase/seed/local.sql)
en cada `pnpm db:reset`; las contraseñas no sirven en staging ni en producción, donde
estas cuentas se invitan.

| Rol | Correo | Contraseña | Entra a | Notas |
|---|---|---|---|---|
| Auxiliar contable | `contable@mercamesa.local` | `contable-local` | `/admin/accounting` | Pide código al entrar: sale en la consola de `pnpm dev` |
| Patinador | `patinador@mercamesa.local` | `patinador-local` | `/runner` | Equipo de Placita de Flórez |
| Logística | `logistica@mercamesa.local` | `logistica-local` | `/admin/orders` | Bahía de Placita de Flórez |
| Comprador | `comprador@mercamesa.local` | `comprador-local` | `/` | Con una dirección en El Poblado |

En la base local, Placita de Flórez tiene encendidos patinador y logística (comisión del
patinador: 5 %) y sus dos tiendas de prueba despachan desde la bahía, así que un pedido
con productos de las dos recorre el camino completo: patinador → recepción en la bahía →
despacho.

Tendero y administrador **no tienen cuenta de prueba**: se usan las de la copia de
producción, que entran con la misma contraseña que allá (el administrador pide código al
entrar, igual que el contable).

Los correos de la base son reales, pero en local no sale ningún correo.

### Pedidos para mostrar logística

```
pnpm local:demo-logistica
```

Crea cinco pedidos pagados de las dos tiendas de prueba de Flórez, cada uno en un momento
distinto: las tiendas preparando, el patinador recogiendo, en la bahía sin recibir, con
una parte recibida y listo para despachar (con el mensajero simulado). Entrando como
logística a `/admin/orders` se recibe con foto y se despacha. Cada corrida crea pedidos
nuevos; `pnpm db:reset` los borra.

Pasa por las mismas funciones de `lib/` que la app, así que respeta sus reglas. Solo
corre contra la base local y con `PIBOX_DRY_RUN` y `EMAIL_DRY_RUN` encendidas.
