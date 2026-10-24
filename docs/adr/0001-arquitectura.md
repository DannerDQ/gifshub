# ADR-0001: Arquitectura base de gifshub (MVP v1)

**Status:** Accepted
**Date:** 2026-10-23
**Deciders:** Danner (owner)

## Context

gifshub = "Pinterest de gifs": buscar en Giphy, guardar en favoritos/colecciones privadas, copiar en 1 clic. Proyecto de portafolio: debe mostrar frontend pulido, full-stack, calidad (tests, CI, tipado estricto) y estar desplegado con usuarios reales.

Fuerzas:

- **Giphy beta key ~100 req/h.** Key nunca en cliente. Caché agresiva obligatoria. Atribución "Powered by GIPHY". Solo guardar IDs, no rehospedar. Rating `pg-13` forzado en servidor.
- **Un solo dev, coste ~0.** Free tiers. Mínimas piezas móviles.
- **Rendimiento en grid denso** (Lighthouse alto) y accesibilidad por teclado.
- **v2 = colecciones públicas por URL**: el diseño no debe bloquearlo, pero no se construye ahora.

## Decision

Monolito **Next.js 16 (App Router) + TypeScript strict** en **Vercel**, con **Neon Postgres** (Vercel Marketplace) vía **Drizzle ORM** y **Better Auth** (OAuth GitHub + Google).

| Capa | Elección |
|---|---|
| UI | React 19, Tailwind v4, shadcn/ui solo para Dialog/DropdownMenu/Toast (a11y de Radix) |
| Capa Giphy | Route handlers `GET /api/giphy/{trending,search,ids}` en servidor; key en env |
| Caché | `Cache-Control: s-maxage` en CDN de Vercel: trending 10 min, search 1 h, by-ids 24 h |
| Mutaciones | Server Actions + validación `zod`, `useOptimistic` para favoritos |
| Auth | Better Auth, sesiones en Postgres, adapter Drizzle |
| DB | Neon Postgres + Drizzle (migraciones con drizzle-kit) |
| Tests | Vitest + Testing Library (unit/componentes), Playwright (e2e flujo crítico) |
| CI | GitHub Actions: `tsc --noEmit`, lint, Vitest, build, Playwright contra preview de Vercel |

### Modelo de datos

```sql
-- tablas user/session/account: las genera Better Auth
collections (
  id          uuid pk,
  user_id     text fk -> user.id on delete cascade,
  name        text not null,
  kind        text not null default 'custom',  -- 'favorites' | 'custom'
  created_at  timestamptz default now(),
  unique (user_id, name)
)
-- un único 'favorites' por usuario
create unique index on collections(user_id) where kind = 'favorites';

collection_items (
  collection_id uuid fk -> collections.id on delete cascade,
  giphy_id      text not null,
  media_type    text not null,  -- 'gif' | 'sticker'
  added_at      timestamptz default now(),
  primary key (collection_id, giphy_id)
)
```

Favoritos = colección con `kind='favorites'`: una sola lógica de "añadir/quitar". Solo se guarda `giphy_id`; la vista de colección resuelve metadatos con `/api/giphy/ids` (Giphy acepta hasta 100 IDs por llamada, cacheado 24 h).

### Grid

- Renditions `fixed_width` en **mp4/webp** (`<video muted loop playsinline>`), no `.gif`: 5-10x menos bytes.
- Masonry por JS: Giphy da `width/height`, cada item nuevo va a la columna más corta. Estable al hacer append (CSS `columns` reordena con scroll infinito).
- Scroll infinito con `IntersectionObserver` nativo; pausa vídeos fuera de viewport.
- Navegación por teclado: items son `<button>`/`<a>` reales, detalle en Dialog con foco atrapado, ruta propia `/gif/[id]` (intercepting route como modal).
- Sin virtualización hasta medir que hace falta.

### Copiar

- Copiar enlace: `navigator.clipboard.writeText`.
- Copiar gif: Clipboard API no acepta `image/gif` en la mayoría de navegadores. Se copia como `text/html` + URL; en móvil, `navigator.share` con archivo. Documentar la limitación en el README.

## Options Considered

### Option A: Next.js monolito en Vercel + Neon + Better Auth (elegida)

| Dimension | Assessment |
|---|---|
| Complexity | Baja: 1 repo, 1 deploy, 1 lenguaje |
| Cost | $0 (Vercel Hobby, Neon free) |
| Scalability | Sobra para portafolio; CDN absorbe lecturas a Giphy |
| Team familiarity | Stack más demandado en ofertas frontend/full-stack |

**Pros:** proxy + caché de Giphy gratis en el mismo deploy; Server Actions eliminan capa API para mutaciones; previews por PR para e2e; auth y DB propias demuestran full-stack real.
**Cons:** acoplado a Vercel para la caché CDN; Server Actions menos "visibles" que una API REST en un portafolio.

### Option B: SPA Vite + API separada (Hono) + Postgres

| Dimension | Assessment |
|---|---|
| Complexity | Media: 2 deploys, CORS, cookies cross-site |
| Cost | $0-5 |
| Scalability | Igual |
| Team familiarity | Alta |

**Pros:** separación front/back explícita; API reutilizable.
**Cons:** SEO/OG nulo sin SSR (malo para v2 colecciones compartibles por URL); el doble de infra para el mismo resultado.

### Option C: Next.js + Supabase (auth + DB como BaaS)

| Dimension | Assessment |
|---|---|
| Complexity | Baja |
| Cost | $0 (free tier pausa proyectos inactivos) |
| Scalability | Igual |
| Team familiarity | Media |

**Pros:** auth lista en minutos, RLS.
**Cons:** demuestra menos ingeniería propia; lógica repartida entre RLS y app; pausa por inactividad mata la "URL pública con usuarios reales".

## Trade-off Analysis

A y C empatan en velocidad; A gana en señal de portafolio (auth, schema, migraciones propias) sin pagar el coste de B. B solo compensa si hiciera falta un cliente no-web, explícitamente fuera de alcance. SSR de A es requisito implícito de v2: una colección compartida necesita OG tags renderizados en servidor.

Better Auth sobre Auth.js: Auth.js pasó a mantenimiento bajo el equipo de Better Auth (2025); Better Auth es TS-first y tiene adapter Drizzle oficial. Sobre Clerk: Clerk es más rápido de integrar, pero externaliza justo lo que el portafolio quiere demostrar.

## Consequences

- **Más fácil:** proteger la key, cachear Giphy, previews por PR, añadir colecciones públicas (columna `visibility` + `slug` y una ruta SSR).
- **Más difícil:** salir de Vercel (habría que recrear la caché CDN con otro proxy).
- **Revisar:**
  - Si la caché no basta para 100 req/h antes de tener production key: añadir Upstash Redis o Vercel Runtime Cache.
  - Virtualización del grid si Lighthouse/INP cae con >500 items.
  - Rate limit propio en `/api/giphy/*` si aparece abuso.

## Action Items

1. [ ] Scaffold `create-next-app` (TS strict, Tailwind, App Router), repo GitHub, link a Vercel.
2. [ ] Provisionar Neon desde Vercel Marketplace; `GIPHY_API_KEY`, `DATABASE_URL`, secrets OAuth en `vercel env`.
3. [ ] Route handlers Giphy con `rating=pg-13`, cabeceras de caché y atribución en footer.
4. [ ] Schema Drizzle + Better Auth + migración inicial.
5. [ ] Grid masonry + scroll infinito + detalle modal + copiar.
6. [ ] Server Actions de colecciones/favoritos con zod y tests.
7. [ ] CI GitHub Actions (typecheck, lint, Vitest, Playwright contra preview).
8. [ ] Solicitar production key de Giphy al desplegar con atribución.
9. [ ] README: decisiones de producto + enlace a este ADR.
