# Garantías · Ingresos y egresos

Consolida mes a mes dos reportes de Excel y los cruza en un solo tablero:

- **Ingresos** — reclamos facturados (órdenes emitidas, importe, pendientes de facturar).
- **Egresos** — compras de repuestos de garantía facturadas, asociadas a documento y pedido.

El acceso es con usuario y contraseña: sin sesión iniciada no se llega a ninguna pantalla ni a
ningún endpoint.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL

---

## Secciones

| # | Sección | Qué hace |
|---|---|---|
| 1 | **Panel** | Tablero fijo del **año en curso**, sin filtros: KPIs, ingresos facturados por mes (azul), costos de garantía por mes (rojo, debajo de ingresos), estado de las órdenes, reparto por depósito y por sucursal. |
| 2 | **Reclamos** | Listado consolidado de reclamos. Edición en línea, baja individual y masiva, detalle por doble clic. |
| 3 | **Repuestos** | Seguimiento de compras de repuestos. Filtros de depósito, repuesto y fechas. Sin filtros trae todo. |
| 4 | **Informes** | Histórico sin recorte de año. Elegís ingresos, egresos o ambos; agrupás por mes, año, sucursal, depósito o proveedor; exportás a CSV. |

En las dos grillas: **un clic** sobre una celda la edita, **doble clic** sobre la fila abre el detalle
completo con los campos que no se muestran en la grilla.

---

## Acceso

Un `middleware.ts` intercepta todo lo que no sea `/login`, `/api/auth/*` y los estáticos. Sin cookie
de sesión válida, las páginas redirigen a la pantalla de ingreso y los endpoints devuelven 401.

- **Sesión:** cookie `httpOnly` + `sameSite=lax`, firmada con HMAC-SHA256 usando `AUTH_SECRET`,
  válida 12 horas. No hay tabla de sesiones: el token se valida con la firma.
- **Contraseñas:** `scrypt` de la librería estándar de Node, con sal por usuario. Sin dependencias
  nativas que compliquen el build en Vercel.
- **Primera cuenta:** mientras la tabla `Usuario` esté vacía, `/login` ofrece crearla y queda con rol
  `admin`. Después de eso el alta inicial se cierra sola.
- **Cuentas siguientes:**

  ```bash
  npm run usuario -- ana@empresa.com "Ana Pérez" claveSegura1 operador
  ```

  Si el correo ya existe, se actualizan la contraseña y el rol; sirve también para blanquear claves.

**`AUTH_SECRET` es obligatorio.** Generalo con `openssl rand -base64 32` y cargalo en Vercel. Si lo
cambiás, todas las sesiones abiertas caducan.

---

## Los dos archivos de entrada

### Reclamos (ingresos)

Columnas expuestas en la grilla: `Fecha.R`, `Reclamo`, `Orden`, `Cliente`, `Modelo`, `Patente`,
`Cargo`, `Fecha FC`, `Valor`, `Comprobante`, `Sucursal`. Cualquier otra columna del archivo se
guarda en `datosExtra` y solo aparece en el detalle.

- **Obligatorias:** `Reclamo` y `Orden`.
- **Identidad de la fila:** `Reclamo + Orden + Cargo`.
- **Pendiente de facturar** = fila sin `Comprobante`.

### Repuestos (egresos)

Probado contra `Importacion_Compras_garantias_062026.xlsx`: 746 líneas, 25 documentos, 3 depósitos,
$ 175.014.383,13 en 4.876 unidades. El parser reconoce las 15 columnas del reporte y guarda `M` y
`Año` como campos no expuestos.

Columnas expuestas: `Fecha`, `Repuesto`, `Descripción`, `Depósito`, `Documento`, `Pedido`, `Cant.`,
`Costo`, `Costo total`, `Proveedor`. En el detalle se agregan `Descuento`, `Costo neto`,
`Costo lista`, `C.L. total` y `Ahorro`.

- **Obligatoria:** `Repuesto`.
- **Pedido:** el archivo actual no trae una columna de pedido separada, así que `Pedido` se completa
  con `Documento`. Si tu reporte agrega una columna `Pedido`, `Nro Pedido`, `OC` u `Orden de compra`,
  el parser la toma automáticamente y deja de usar el fallback.
- **Identidad de la fila:** `Documento + Repuesto + Período + número de ocurrencia`. El reporte
  repite líneas idénticas (105 en el archivo de junio); numerar la ocurrencia hace que recargar el
  mismo archivo actualice en lugar de duplicar.
- **Códigos de repuesto:** los espacios internos múltiples se colapsan a uno
  (`MB3Z/   18124/CH/` → `MB3Z/ 18124/CH/`) para que el filtro y la búsqueda funcionen. Si necesitás
  el código con el padding original, sacá el `.replace(/\s+/g, ' ')` de `limpiar` en
  `src/lib/repuestos.ts`.

### Encabezados

Ambos parsers normalizan los encabezados (minúsculas, sin acentos, sin símbolos) y aceptan alias:
`Orden`/`OT`/`Nro Orden`, `Patente`/`Dominio`, `Valor`/`Importe`, `Depósito`/`Almacén`,
`CostoT.`/`Costo total`/`Importe`. Las listas están en `ALIAS` dentro de `src/lib/excel.ts` y
`src/lib/repuestos.ts`.

### Filas editadas a mano

Cualquier fila que edites queda marcada con `editadoManual` y **la carga mensual no la pisa**. El
resumen de la carga informa cuántas se conservaron por ese motivo.

---

## Importar y deshacer

Toda importación pasa por dos etapas.

**1. Revisión.** Al elegir el archivo, la app lo lee y lo compara contra lo ya guardado sin escribir
nada. Muestra cuántas filas son nuevas, cuántas ya están cargadas idénticas, cuántas vienen con
datos distintos y cuántas están protegidas por edición manual. Si hay diferencias, lista ejemplos
concretos con el valor anterior y el nuevo.

**2. Decisión.** Desde ahí elegís: importar todo (agrega las nuevas y actualiza las que cambiaron),
importar solo las nuevas, o cancelar. Las filas idénticas nunca se reimportan, así que volver a
subir el mismo archivo no duplica ni pisa nada.

La comparación redondea los importes a los decimales que usa cada columna en la base. Sin eso el
archivo traería `920.6139999`, la base tendría `920.61` y todas las filas parecerían distintas.

### Deshacer

Cada importación guarda el estado anterior de las filas que tocó. Se revierte desde el botón que
aparece al terminar la carga, o desde **Historial de cargas**, disponible en Panel, Reclamos y
Repuestos.

Deshacer borra las filas que la carga agregó y devuelve las modificadas a su valor previo. Las filas
que alguien editó a mano después de esa importación no se tocan, y el resultado informa cuántas
quedaron así.

Dos límites: una carga de más de 20.000 filas no guarda respaldo y queda marcada como no reversible
(`TOPE_RESPALDO` en `src/lib/consolidar.ts`), y una carga ya deshecha no se puede volver a aplicar
—hay que subir el archivo de nuevo.

---

## Marca

El isotipo vive en `public/logo-ford.png` y se muestra en tres lugares a través de
`src/components/Logo.tsx`: la cabecera de la barra lateral (sobre una placa blanca, porque el
isotipo es azul y no contrasta contra el fondo), el extremo derecho del encabezado y la pantalla de
ingreso. El azul de la barra lateral es el institucional `#00095B`.

Para cambiar la marca alcanza con reemplazar el PNG conservando el nombre; no hay que tocar código.
Si el archivo nuevo tiene otra proporción, ajustá la relación de alto en `Logo.tsx` (hoy 392×154) y
el ancho de cada uso.

El logo es marca registrada de Ford Motor Company. Úsalo dentro de lo que permita tu acuerdo de
concesionario o de identidad de marca; si esta app llega a usarse fuera de ese marco, reemplazá el
PNG por la marca propia y listo.

---

## Puesta en marcha

### 1. Repositorio en GitHub

```bash
git init && git add . && git commit -m "App de garantías: ingresos y egresos"
gh repo create garantias-app --private --source=. --push
```

### 2. Base de datos en Railway

1. [railway.app](https://railway.app) → **New Project** → **Provision PostgreSQL**.
2. Servicio Postgres → pestaña **Variables** → copiá `DATABASE_URL` (la variante pública
   `containers-xxx.railway.app`, no la interna: Vercel se conecta desde afuera).
3. Creá el esquema desde tu máquina:

```bash
cp .env.example .env      # pegá el DATABASE_URL de Railway
npm install
npx prisma migrate dev --name init
```

Commiteá `prisma/migrations/`: el build de Vercel corre `prisma migrate deploy` y necesita las
migraciones versionadas.

### 3. Despliegue en Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → importá el repo.
2. Framework Next.js (se detecta solo); no toques el build command, ya está en `package.json`.
3. **Environment Variables:** `DATABASE_URL` (el de Railway), `AUTH_SECRET` (obligatorio) y,
   opcionalmente, `UPLOAD_TOKEN`.
4. **Deploy.**

Con `UPLOAD_TOKEN` definido, los endpoints de carga exigen la cabecera `x-upload-token`. Dejalo
vacío mientras probás.

### Desarrollo local

```bash
npm install && npx prisma migrate dev && npm run dev   # http://localhost:3000
```

---

## Estructura

```
middleware.ts                   Corta el paso a todo lo que no tenga sesión
prisma/schema.prisma            Reclamo, Repuesto, Carga y Usuario
src/lib/sesion.ts               Firma y verificación de la cookie (Web Crypto, sirve en Edge)
src/lib/password.ts             Hash y verificación con scrypt
scripts/crear-usuario.mjs       Alta y blanqueo de cuentas por CLI
src/lib/excel.ts                Parser de reclamos: alias, fechas, importes, clave única
src/lib/repuestos.ts            Parser de compras de repuestos
src/lib/filtros.ts              Filtros de la UI traducidos a WHERE de Prisma
src/app/api/cargas              POST sube y consolida el Excel de reclamos
src/app/api/cargas-repuestos    POST sube y consolida el Excel de repuestos
src/app/api/reclamos[/id]       Listado, alta, edición y baja
src/app/api/repuestos[/id]      Listado, edición y baja
src/app/api/metricas            KPIs y series del panel, acotado al año en curso
src/app/api/informes            Histórico configurable (alcance, agrupación, filtros)
src/app/api/dimensiones         Valores disponibles para los filtros
src/app/login/page.tsx          Pantalla de ingreso
src/app/api/auth/*              login, logout, sesión y alta de la primera cuenta
src/app/page.tsx                1 · Panel
src/app/detalle/page.tsx        2 · Reclamos
src/app/repuestos/page.tsx      3 · Repuestos
src/app/informes/page.tsx       4 · Informes
```

---

## Notas de operación

- **Fechas de corte.** Ingresos se agrupan por `Fecha.R`; egresos por `Fecha`. Para usar la fecha de
  facturación en ingresos, cambiá `fechaR` por `fechaFc` en `src/lib/filtros.ts`.
- **Año en curso.** El panel no tiene filtros: muestra siempre el ejercicio actual completo. Los
  cortes por fecha, sucursal y depósito viven en Reclamos, Repuestos e Informes. Para mirar otro año
  desde el panel, pasale `?anio=2025` al endpoint de métricas.
- **Archivos grandes.** El plan gratuito de Vercel corta el body de una request en 4,5 MB. El archivo
  de junio pesa 98 KB, así que hay margen amplio; si un mes se dispara, subilo a Vercel Blob o S3 y
  pasale la URL al endpoint.
- **Moneda.** Fijada en ARS en `src/lib/format.ts`.
