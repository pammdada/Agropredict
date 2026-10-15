# AgroPredic — MVP (APF2)

Portal SaaS B2B multiempresa para simular escenarios de clima (rendimiento) y cadena de frío, leer el resultado como rango con nivel de confianza, recibir una acción recomendada y registrarla como decisión.

> Todos los resultados del motor v0 son **datos demo**: deterministas y parametrizados, no provienen de un modelo entrenado.

## Arranque rápido

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000. En el primer arranque se aplican las migraciones y se carga el seed demo de forma automática en una base **PGlite** (Postgres embebido) guardada en `./.data/pglite`.

| Script | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run typecheck` / `npm run lint` | TypeScript estricto y ESLint |
| `npm run db:reset` | Borra la base PGlite y vuelve a cargar el seed (detén antes el servidor) |
| `npm run db:generate` | Genera una migración SQL tras cambiar `src/db/schema.ts` |

PGlite admite un solo proceso a la vez: detén `npm run dev` antes de usar los scripts `db:*`.

## Cuentas demo

La contraseña de todas las cuentas es el valor de `SEED_PASSWORD` (en `.env.local`); si no se define, el seed usa la contraseña por defecto de `src/db/seed.ts`. Cámbiala antes de mostrar la demo fuera del equipo.

| Correo | Rol |
| --- | --- |
| superadmin@agropredic.pe | SUPERADMIN (área `/admin`) |
| admin@valleica.pe | ORG_ADMIN · Agroexportadora Valle de Ica (plan Pro) |
| analista@valleica.pe | ORG_ANALYST · Valle de Ica y Frutos del Norte (muestra el selector de organización) |
| admin@frutosdelnorte.pe | ORG_ADMIN · Frutos del Norte (plan Piloto en prueba; sirve para mostrar el aislamiento) |

Datos sintéticos de prueba:

- **SSO**: el dominio `@valleica.pe` tiene SSO OIDC configurado. En *Ingresar con SSO de mi empresa* usa cualquier correo de ese dominio; si no existe, se crea (JIT) con el rol por defecto.
- **Google / Microsoft**: proveedor de prueba con pantalla de autorización y retorno (`/auth/callback`).
- **Tarjetas**: `4111 1111 1111 1111` aprobada · `4000 0000 0000 0002` rechazada · `4000 0000 0000 0077` pendiente (se confirma con el webhook simulado en Facturación).
- **Yape**: celular de 9 dígitos y código `123456` (aprobado) o `000000` (rechazado).
- **Recuperar contraseña e invitaciones**: el enlace se muestra en pantalla (no hay proveedor de correo).

## Cambiar a Supabase / Postgres

Define `DATABASE_URL` con la cadena de conexión de Postgres (en Supabase, la conexión directa o la del pooler en modo sesión):

```bash
DATABASE_URL=postgres://postgres:<password>@<host>:5432/postgres
```

Al arrancar se aplican las migraciones de `./drizzle` y, si la base está vacía, el seed. No hay otros cambios de código: `src/db/index.ts` elige el driver (`postgres-js` o PGlite) según la URL.

## Arquitectura

Monolito modular en Next.js 15 (App Router, Server Components y Server Actions):

```
src/
  app/(auth)/          A3–A8: login, registro, recuperación, invitación, selector de organización
  app/auth/            A7: proveedor OAuth/OIDC simulado y pantalla de retorno
  app/app/             Área de empresa (E1–E18), protegida por requireOrgContext()
  app/admin/           Área Superadmin (S1, S2, S4, S5, S8), protegida por requireSuperadmin()
  app/api/webhooks/    Webhooks de pago con firma HMAC e idempotencia por event_id
  db/                  Esquema Drizzle, cliente PGlite/Postgres y seed
  lib/auth/            argon2id, sesiones en cookie httpOnly, matriz RBAC, contexto de organización
  lib/billing/         Entitlements, máquina de estados, PaymentProvider (Simulated + esqueleto Culqi)
  lib/simulation/      Contrato SimulationEngine, motor demo v0 y servicio (alertas y eventos)
```

- **Multi-tenancy**: `org_id` en toda tabla de negocio; cada consulta y acción filtra por la organización de la sesión. RLS en Postgres queda para una etapa posterior.
- **Autorización**: permisos `recurso:acción` verificados en el servidor (`authorize()` en cada Server Action); la interfaz solo oculta lo que el rol no puede hacer. Una organización suspendida o con la suscripción vencida queda en solo lectura.
- **Entitlements**: los límites del plan (fundos, hectáreas, usuarios, simulaciones por mes, cadena de frío, comparador) se aplican con independencia del rol.
- **Impersonación**: el Superadmin entra a una organización en solo lectura, con motivo obligatorio, auditoría y banner permanente.
- **Motor de simulación**: `SimulationEngine.run(input)` devuelve tres escenarios, confianza, factores, acciones, serie temporal y versión del modelo. Reemplazar el motor demo por el modelo de APF3 solo cambia `src/lib/simulation/service.ts`.
- **Pagos**: `PaymentProvider` con `SimulatedProvider`; IGV 18 % en cada factura.

## Fuera del alcance de este MVP

Docker, CI, Keycloak, RLS en Postgres, pruebas E2E, despliegue, correo transaccional, comprobantes SUNAT, ETL y modelos de ML reales.

## Guion corto de demo (≈ 5 min)

1. Landing → *Planes* → *Ingresar*.
2. `admin@valleica.pe`: dashboard con riesgo por fundo → *Nueva simulación* (Niño fuerte, Fundo La Esperanza) → resultado → *Registrar como decisión* → tablero de Decisiones.
3. *Cadena de frío*: envío con excursión térmica → *Simular merma* del corredor Ica – Callao → *Comparador*.
4. `admin@frutosdelnorte.pe`: solo ve sus datos; la cadena de frío está bloqueada en Piloto → *Cambiar plan* con la tarjeta pendiente → confirmar el webhook → el monitor se habilita.
5. `superadmin@agropredic.pe`: dashboard de plataforma → suspender una organización o verla en modo solo lectura → auditoría.
