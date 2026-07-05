# SGO Frontend

Aplicacion React + TypeScript + Vite, preparada para despliegue en Vercel.

## Requisitos

- Node.js 20+
- npm 10+

## Variables de entorno

Crear un archivo `.env` en local usando `.env.example` como base:

```bash
cp .env.example .env
```

Variables disponibles:

- `VITE_API_BASE_URL`: URL base del backend (ejemplo: `https://api.tu-dominio.com/api/v1`)
- `VITE_API_DOCUMENTO`: token para consultas de documento
- `VITE_PASSWORD_EXPIRATION_LOCK_ENABLED`: feature flag (`true` o `false`)

## Desarrollo local

```bash
npm install
npm run dev
```

## Build de produccion

```bash
npm run build
```

Para el entorno de Vercel se usa:

```bash
npm run build:vercel
```

## Despliegue en Vercel

1. Importar el repositorio en Vercel.
2. Framework preset: `Vite` (opcional, ya existe `vercel.json`).
3. Configurar variables de entorno en Vercel:
   - `VITE_API_BASE_URL`
   - `VITE_API_DOCUMENTO`
   - `VITE_PASSWORD_EXPIRATION_LOCK_ENABLED` (opcional)
4. Deploy.

`vercel.json` ya incluye:

- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- fallback de rutas SPA hacia `index.html`

## Notas de arquitectura

- El endpoint de backend se centraliza en `src/config.ts`.
- Para construir endpoints se usa `buildApiUrl(path)`.
- Evita hardcodes de host en componentes/stores para mantener escalabilidad por entorno.
