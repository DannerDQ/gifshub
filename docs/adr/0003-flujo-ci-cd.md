# ADR-0003: Flujo CI/CD y protección de `main`

**Status:** Accepted
**Date:** 2026-10-25
**Deciders:** Danner (owner)

## Context

`main` despliega automáticamente a producción en Vercel. Hoy cualquier push a `main` llega a producción sin ninguna verificación. Objetivo: que nada entre a `main` sin haber demostrado antes que no rompe nada.

Fuerzas:

- Un solo desarrollador: GitHub no permite aprobar los PRs propios, así que la aprobación humana no puede ser el control.
- Repo público: los rulesets de GitHub son gratuitos.
- Vercel ya genera un preview por rama/PR.

## Decision

### 1. Ruleset de `main`

- Todo cambio entra por PR. Sin pushes directos.
- El merge exige que pasen los checks obligatorios del CI.
- Sin force push y sin borrar la rama.
- Sin excepciones, tampoco para administradores.
- Sin aprobaciones obligatorias: los checks cumplen ese papel.

### 2. Merge

- Solo **squash merge**. Cada PR es un commit en `main`.
- El título del PR es el mensaje del commit y sigue Conventional Commits (`feat:`, `fix:`, `chore:`…).
- La rama se borra al mergear.

### 3. CI (GitHub Actions, en cada PR)

| Check | Obligatorio |
|---|---|
| `typecheck` | Desde el día 1 |
| `lint` | Desde el día 1 |
| `build` | Desde el día 1 |
| Vitest | Al existir el primer test |
| Playwright e2e contra el preview | Al existir la sesión sembrada y el bypass de Deployment Protection |

Los nombres de los jobs son estables: el ruleset los referencia por nombre.

### 4. CD (Vercel)

- Cada PR genera un preview automáticamente.
- Merge a `main` = deploy a producción automático. Es seguro porque a `main` solo llega código que pasó el CI.

### 5. Migraciones

- Un job de GitHub Actions aplica `db:migrate` a producción en cada push a `main`.
- Nunca se migra producción a mano ni desde el build de Vercel.
- El job y el deploy de Vercel corren en paralelo, sin orden garantizado. Por eso toda migración debe ser **compatible con el código anterior** (expand/contract): primero se agrega, luego se cambia el código y lo viejo se elimina en un PR posterior.

## Options Considered

- **Merge:** rebase conserva cada commit pero exige commits cuidados en cada rama; merge commit ensucia el historial. Squash da un historial de un commit por cambio.
- **Migraciones en el build de Vercel:** más simple, pero el build de un preview podría migrar la base de datos equivocada, y un fallo de migración quedaría mezclado con un fallo de build.
- **e2e obligatorio desde el día 1:** bloquearía todo el avance hasta tener la infraestructura de e2e.

## Consequences

- Ningún cambio llega a producción sin pasar por PR y CI, ni siquiera los del owner.
- Un arreglo urgente también pasa por PR: es más lento, pero evita romper producción con prisa.
- Las migraciones exigen disciplina expand/contract.
- El job de migraciones depende de separar las bases de datos por entorno (ramas de Neon), pendiente.

## Action Items

1. [ ] Configuración del repo: solo squash, borrar la rama al mergear, título del PR como mensaje.
2. [ ] Workflow de CI con `typecheck`, `lint` y `build`.
3. [ ] Primer PR (estrena el flujo y registra los nombres de los checks).
4. [ ] Ruleset de `main`.
5. [ ] Job de migraciones, tras separar las bases de datos por entorno.
