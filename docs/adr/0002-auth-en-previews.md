# ADR-0002: Login OAuth en deploys de preview

**Status:** Accepted
**Date:** 2026-10-25
**Deciders:** Danner (owner)

## Context

Cada deploy de preview en Vercel tiene una URL distinta (`gifshub-<hash>-…` y `gifshub-git-<rama>-…`). Una OAuth App de GitHub acepta una sola callback URL, así que el login no puede funcionar directamente en los previews.

Ya existen dos OAuth Apps: una de desarrollo (`localhost`) y otra de producción.

## Decision

Plugin `oAuthProxy` de Better Auth: el preview delega el OAuth en producción, que cifra el resultado y redirige de vuelta al preview.

### Variables por entorno

| Variable | Local | Preview | Production |
|---|---|---|---|
| `PRODUCTION_URL` | — | dominio prod | dominio prod |
| `BETTER_AUTH_URL` | `localhost` | — (se infiere) | dominio prod |
| `BETTER_AUTH_PROXY_SECRET` | — | X | X (mismo valor) |
| `BETTER_AUTH_SECRET` | propio | propio | propio |
| `GITHUB_CLIENT_*` | OAuth App dev | OAuth App prod | OAuth App prod |

- `BETTER_AUTH_URL` no se define en Preview: es la URL base de la propia instancia y el preview no vive en producción.
- El secreto del proxy es dedicado y compartido solo entre Production y Preview. `BETTER_AUTH_SECRET` (firma de sesiones) es distinto en cada entorno, para que el código de una rama cualquiera no pueda firmar sesiones válidas en producción.
- En local, `productionURL` cae a `BETTER_AUTH_URL` (`localhost`), así que el proxy no actúa.

### `trustedOrigins`

- **Preview:** solo sus URLs exactas (`VERCEL_URL`, `VERCEL_BRANCH_URL`). Sin wildcard.
- **Production:** patrón de las URLs de preview del proyecto.
- La URL base de cada instancia ya es confiable por defecto en Better Auth.

## Riesgo aceptado: patrón en producción

En Vercel, cualquiera puede crear un proyecto llamado `gifshub-algo-2023101351-7856s-projects` y recibir un dominio que coincide con el patrón. Ningún patrón lo evita, porque el atacante elige el nombre del proyecto.

Se acepta porque lo que producción redirige a ese origen es un payload (perfil + tokens OAuth) cifrado con `BETTER_AUTH_PROXY_SECRET`, y caduca a los 60 s (`maxAge`). Sin el secreto, descifrarlo es inviable.

**Depende de:** que `BETTER_AUTH_PROXY_SECRET` sea aleatorio (32 bytes), exista solo en Production y Preview, y no se filtre.

**Alternativa descartada:** un dominio propio para los previews (`*.preview.<dominio>`). Elimina el riesgo, pero cuesta un dominio y puede requerir un plan de pago de Vercel. Se revisa si el proyecto pasa a tener usuarios con datos sensibles.

## Consequences

- El login se puede probar a mano en cualquier preview usando la OAuth App de producción.
- Producción participa en el login de los previews: si producción cae, el login en los previews también falla.
- Los tests e2e no usan este flujo: crean la sesión directamente en la base de datos del preview (ver tarea 7 de ADR-0001).
