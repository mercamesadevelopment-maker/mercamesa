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
