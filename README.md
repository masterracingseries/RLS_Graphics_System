# RLS Graphics System

Generador de gráficas de resultados para equipos de simracing. Un piloto entra, llena sus datos de carrera, sube una foto (a la que se le quita el fondo automáticamente con IA) y obtiene una imagen lista para Instagram. Un administrador la revisa y aprueba, y desde ahí se publica.

Hecho para **RLS (Racing Latam Sport)**, pero es adaptable a cualquier equipo o liga.

---

## Índice

- [Qué hace](#qué-hace)
- [Cómo funciona el flujo completo](#cómo-funciona-el-flujo-completo)
- [Stack](#stack)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación desde cero](#instalación-desde-cero)
  - [1. Clonar e instalar](#1-clonar-e-instalar)
  - [2. Google Cloud](#2-google-cloud-service-account-sheets-y-storage)
  - [3. Google Sheet](#3-google-sheet)
  - [4. API key de Gemini](#4-api-key-de-gemini)
  - [5. Variables de entorno](#5-variables-de-entorno)
  - [6. Correr en local](#6-correr-en-local)
- [Deploy en Vercel](#deploy-en-vercel)
- [Publicación automática en Instagram (opcional)](#publicación-automática-en-instagram-opcional)
- [Referencia](#referencia)
  - [Variables de entorno](#variables-de-entorno)
  - [Endpoints de la API](#endpoints-de-la-api)
  - [Estructura de la planilla](#estructura-de-la-planilla)
  - [Plantillas de gráfica](#plantillas-de-gráfica)
  - [Assets externos](#assets-externos)
- [Cosas que conviene saber](#cosas-que-conviene-saber)

---

## Qué hace

- **Tres plantillas** de gráfica seleccionables: *Protagonista*, *Broadcast* y *Card*
- **Quita el fondo de la foto del piloto** en el navegador, con IA y sin servicios de pago
- **Genera el texto del post con IA** (Gemini), editable por el piloto antes de enviar
- **Login con dos roles**: piloto y administrador
- **Panel de administración** para aprobar o rechazar, con el caption editable
- Las gráficas salen en **4:5**, el formato vertical que Instagram no recorta

---

## Cómo funciona el flujo completo

```
PILOTO                          ADMIN                      PUBLICACIÓN
──────                          ─────                      ───────────
1. Inicia sesión
2. Llena sus datos
3. Sube su foto
   └─ se le quita el fondo (IA, en el navegador)
4. "Generar gráfica"
   ├─ se arma la imagen
   └─ Gemini escribe el caption
5. Revisa, edita el caption
6. Envía para aprobación
        │
        ├──> imagen a Google Cloud Storage
        └──> fila en Google Sheets (estado: PENDIENTE)
                          │
                          ├─ 7. El admin revisa en /admin
                          ├─ 8. Ajusta el caption si quiere
                          └─ 9. Aprueba  ──>  estado: APROBADO
                                                    │
                                                    └──> 10. Make.com detecta
                                                         la fila aprobada y
                                                         publica en Instagram
                                                              │
                                                              └─> PUBLICADO
```

La planilla de Google es la base de datos y a la vez la cola de revisión. No hay base de datos propia.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 |
| Backend (producción) | Vercel Serverless Functions (`api/`) |
| Backend (desarrollo) | Express (`server.ts`) |
| Base de datos | Google Sheets |
| Almacenamiento de imágenes | Google Cloud Storage |
| Captura de la gráfica | `html-to-image` |
| Quitar fondo | `@imgly/background-removal` (corre en el navegador) |
| Texto del post | Gemini 2.5 Flash Lite |
| Publicación | Make.com → Instagram Graph API |

---

## Estructura del proyecto

```
.
├── api/                      Funciones serverless (solo producción)
│   ├── auth.ts               Login y verificación de tokens
│   ├── gemini.ts             Prompt y llamada a Gemini (compartido)
│   ├── generate-caption.ts   Genera el caption para la vista previa
│   ├── submit-graphic.ts     Sube la imagen y agrega la fila a la planilla
│   ├── get-submissions.ts    Lista las gráficas (solo admin)
│   ├── update-status.ts      Aprueba o rechaza (solo admin)
│   └── proxy-image.ts        Proxy de imágenes para evitar problemas de CORS
├── src/
│   ├── App.tsx               La app del piloto y las 3 plantillas
│   ├── AdminPanel.tsx        Panel de revisión
│   ├── Login.tsx             Pantalla de acceso
│   ├── main.tsx              Ruteo y manejo de sesión
│   └── lib/utils.ts
├── server.ts                 Servidor Express para desarrollo local
├── vercel.json               Build y reescritura de rutas (SPA)
└── templates/                Demos HTML antiguos — NO los usa la app
```

---

## Instalación desde cero

Necesitas: **Node.js 18 o superior**, una cuenta de **Google Cloud**, y una cuenta de **Vercel** si vas a publicarlo.

### 1. Clonar e instalar

```bash
git clone https://github.com/masterracingseries/RLS_Graphics_System.git
cd RLS_Graphics_System
npm install
```

### 2. Google Cloud: service account, Sheets y Storage

El proyecto usa una *service account* (una cuenta de robot) para escribir en la planilla y subir imágenes.

**a. Crear el proyecto y la service account**

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto
2. Activa dos APIs: **Google Sheets API** y **Cloud Storage API**
3. Ve a *IAM y administración* → *Cuentas de servicio* → **Crear cuenta de servicio**
4. Una vez creada, ábrela → pestaña *Claves* → **Agregar clave** → *Crear clave nueva* → **JSON**
5. Se descarga un archivo `.json`. Guárdalo en la raíz del proyecto como **`google-credentials.json`**

> Ese archivo es una credencial: **nunca lo subas a Git**. Ya está en el `.gitignore`.

6. Anota el email de la cuenta de servicio, algo como `nombre@tu-proyecto.iam.gserviceaccount.com`. Lo vas a necesitar en el paso 3.

**b. Crear el bucket de Cloud Storage**

1. Ve a *Cloud Storage* → **Crear bucket**, ponle el nombre que quieras
2. Dale permiso de **lectura pública**: en la pestaña *Permisos*, agrega el principal `allUsers` con el rol **Storage Object Viewer**

   Esto es obligatorio: Instagram tiene que poder descargar la imagen desde una URL pública. Solo se exponen las gráficas generadas, nada más.

3. Dale a la service account el rol **Storage Object Admin** sobre el bucket, para que pueda subir archivos
4. *(Opcional pero recomendado)* En *Ciclo de vida*, agrega una regla que borre los objetos después de **30 días**. Las gráficas ya publicadas viven en Instagram, no hace falta acumularlas.

### 3. Google Sheet

1. Crea una planilla nueva en Google Sheets
2. **La primera hoja tiene que llamarse exactamente `Hoja 1`** — está fijo en el código
3. Comparte la planilla con el **email de la service account** (del paso 2a), con permiso de **Editor**
4. Copia el ID de la planilla desde la URL:

   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   ```

Los encabezados se crean solos la primera vez que corras el servidor local, si la planilla está vacía. Si prefieres ponerlos a mano, están en [Estructura de la planilla](#estructura-de-la-planilla).

### 4. API key de Gemini

1. Entra a [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Crea una API key y cópiala

El plan gratuito alcanza de sobra: el modelo es `gemini-2.5-flash-lite` y se usa una vez por gráfica.

### 5. Variables de entorno

Copia la plantilla y llénala:

```bash
cp .env.example .env
```

```bash
# Planilla y almacenamiento
GOOGLE_SHEET_ID="el-id-de-tu-planilla"
GCS_BUCKET="el-nombre-de-tu-bucket"

# Credenciales de Google
#  - En local: basta con tener google-credentials.json en la raíz
#  - En producción: pega el JSON completo en GOOGLE_CREDENTIALS_JSON
GOOGLE_CREDENTIALS_PATH="./google-credentials.json"

# IA
GEMINI_API_KEY="tu-api-key-de-gemini"

# Acceso
PILOT_PASSWORD="la-clave-que-compartes-con-los-pilotos"
ADMIN_PASSWORD="tu-clave-de-admin"
AUTH_SECRET="una-cadena-larga-y-aleatoria"
```

Para generar un `AUTH_SECRET` decente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Correr en local

```bash
npm run dev
```

Abre **http://localhost:3000**

> **Dos cosas del modo local:**
> - El puerto es **3000**, no el 5173 de Vite. `npm run dev` levanta el servidor Express (`server.ts`), no `vite dev`.
> - **El login se salta en localhost.** Las funciones de `api/` solo existen en Vercel, así que en `localhost` y `127.0.0.1` entras directo a la app. Esto es a propósito, para poder probar los diseños sin montar todo el backend.

---

## Deploy en Vercel

1. Sube tu fork a GitHub
2. En [vercel.com](https://vercel.com), **New Project** → importa el repositorio
3. **Root Directory**: déjalo en la raíz (el proyecto está en la raíz, no en una subcarpeta)
4. En *Settings* → *Environment Variables*, carga estas:

   | Variable | Valor |
   |---|---|
   | `GOOGLE_SHEET_ID` | el ID de tu planilla |
   | `GCS_BUCKET` | el nombre de tu bucket |
   | `GOOGLE_CREDENTIALS_JSON` | **el contenido completo** del `google-credentials.json`, pegado tal cual |
   | `GEMINI_API_KEY` | tu API key |
   | `PILOT_PASSWORD` | clave de pilotos |
   | `ADMIN_PASSWORD` | clave de admin |
   | `AUTH_SECRET` | tu cadena aleatoria |

   Ojo con `GOOGLE_CREDENTIALS_JSON`: en producción va el **JSON entero** como valor, no la ruta al archivo.

5. Deploy

Con el repositorio conectado, **cada push a `main` publica automáticamente**. Si necesitas volver atrás: *Deployments* → el anterior → **Promote to Production**.

---

## Publicación automática en Instagram (opcional)

Sin esto el sistema funciona igual; simplemente descargas la gráfica aprobada y la subes a mano.

**Requisitos:** una cuenta de Instagram **Profesional** vinculada a una **página de Facebook** (la API de Instagram no permite publicar en cuentas personales).

En [Make.com](https://make.com), un escenario con tres módulos:

1. **Google Sheets → Search Rows**
   - Filtro: columna `M` (Estado) **igual a** `APROBADO`
   - Límite: 1 fila por ejecución, para espaciar las publicaciones

2. **Filtro** *(entre el módulo 1 y el 2)*
   - Condición: la columna `K` (Imagen) → **Exists**
   - Sin esto, cuando no hay filas aprobadas el escenario falla y manda un mail de error

3. **Instagram for Business → Create a photo post**
   - Image URL: columna `K`
   - Caption: columna `L`

4. **Google Sheets → Update a Row**
   - Columna `M` → `PUBLICADO`

Con una frecuencia de 3 veces al día consume unas 270 operaciones al mes, dentro del plan gratuito (1000).

---

## Referencia

### Variables de entorno

| Variable | Dónde | Para qué |
|---|---|---|
| `GOOGLE_SHEET_ID` | ambos | ID de la planilla que hace de base de datos |
| `GCS_BUCKET` | ambos | Bucket donde se guardan las gráficas |
| `GOOGLE_CREDENTIALS_JSON` | producción | Credencial de la service account, el JSON completo |
| `GOOGLE_CREDENTIALS_PATH` | local | Ruta al archivo de credenciales (por defecto `./google-credentials.json`) |
| `GEMINI_API_KEY` | ambos | Genera el caption. Si falta, el caption sale vacío y se escribe a mano |
| `PILOT_PASSWORD` | producción | Clave compartida entre los pilotos. Si falta, el login de pilotos queda deshabilitado |
| `ADMIN_PASSWORD` | producción | Clave del administrador. Si falta, el login de admin queda deshabilitado |
| `AUTH_SECRET` | producción | Firma los tokens de sesión. **Obligatoria**: sin ella los endpoints fallan a propósito, para no firmar con un secreto por defecto. Cambiarla cierra todas las sesiones |

### Endpoints de la API

Todos viven en `api/` y solo existen en producción.

| Endpoint | Método | Acceso | Qué hace |
|---|---|---|---|
| `/api/auth` | POST | público | Valida la clave y devuelve un token |
| `/api/generate-caption` | POST | piloto o admin | Pide el caption a Gemini (2 intentos) |
| `/api/submit-graphic` | POST | piloto o admin | Sube la imagen y agrega la fila |
| `/api/get-submissions` | GET | **solo admin** | Lista las gráficas, con filtro `?status=` |
| `/api/update-status` | POST | **solo admin** | Cambia el estado y el caption |
| `/api/proxy-image` | GET | público | Proxy de imágenes externas (CORS) |

**Autenticación:** el token es HMAC-SHA256 firmado con `AUTH_SECRET`, dura **7 días** y se guarda en `sessionStorage`. Va en la cabecera `Authorization: Bearer <token>`.

### Estructura de la planilla

Hoja **`Hoja 1`**, rango `A:N`:

| Col | Encabezado | Contenido |
|---|---|---|
| A | Fecha | Fecha y hora del envío |
| B | Nombre Piloto | Nombre real |
| C | ID Piloto | Nick o apodo |
| D | Instagram | Usuario del piloto |
| E | Liga | Liga o torneo |
| F | División | División |
| G | Escudería | Equipo |
| H | Circuito | Circuito y país |
| I | Clasificación | Posición en clasificación |
| J | Carrera | Posición final |
| K | Imagen | URL pública en Cloud Storage |
| L | Caption | Texto del post, editable |
| M | **Estado** | `PENDIENTE`, `APROBADO`, `RECHAZADO`, `PUBLICADO` |
| N | Template | Plantilla usada |

> **El estado tiene que quedar en la columna M.** Si insertas columnas antes, se rompe la automatización de Make.

### Plantillas de gráfica

Las tres están definidas en `src/App.tsx` y miden **360×450 px (4:5)**:

| Plantilla | Estilo |
|---|---|
| `protagonista` | La foto del piloto como protagonista, sobre el fondo del circuito |
| `broadcast` | Estética de transmisión de TV: barra del equipo y torre de tiempos |
| `card` | Carta coleccionable tipo FUT, con atributos y marco del color del equipo |

Para agregar una, crea el componente en `App.tsx`, súmalo al tipo `TemplateId` y agrégalo al selector.

### Assets externos

Los logos, autos y fondos de circuitos **no están en este repositorio**. Se cargan desde otro repo público:

```
https://raw.githubusercontent.com/masterracingseries/paginaweb-mrs/main/
├── logos_f1/     logo_<equipo>.png
├── autos_f1/     auto_<equipo>.avif
└── fondos_f1/    <circuito>.jpg
```

Si vas a usar tus propios equipos o circuitos, cambia la constante `GITHUB_BASE` al principio de `src/App.tsx` y apunta a tu repositorio con la misma estructura de carpetas.

---

## Cosas que conviene saber

**La generación es pesada para el celular.** Quitar el fondo carga un modelo de IA completo en el navegador, y además se hacen 3 renders de calentamiento (iOS falla los primeros intentos porque las imágenes todavía no cargaron dentro del SVG). En un teléfono con poca memoria libre y muchas pestañas abiertas, el navegador puede cerrar la pestaña y dejarla en blanco. No es un error del código: conviene cerrar pestañas antes de generar.

**Las imágenes externas pasan por un proxy.** Los assets de GitHub se piden a través de `/api/proxy-image` porque, si no, la captura falla por CORS en los celulares.

Ese proxy solo acepta una lista de dominios permitidos (`ALLOWED_HOSTS` en `api/proxy-image.ts`). Sin esa restricción sería un proxy abierto y cualquiera podría usar tu deploy para descargar contenido ajeno. **Si agregas otro origen de imágenes, tienes que sumarlo a esa lista** o las peticiones devolverán `403`.

**Si el caption sale vacío**, casi siempre es Gemini fallando (límite de uso o timeout). Hay reintentos y el piloto puede volver a generarlo o escribirlo a mano, y el admin puede corregirlo antes de aprobar. Los errores quedan en los logs de Vercel con el prefijo `[Gemini]`.

**Vercel limita el cuerpo de las peticiones a 4,5 MB.** La imagen viaja en base64 dentro del JSON, lo que funciona bien para un JPEG, pero es la razón por la que hoy no se puede subir video por esta vía.

**La carpeta `templates/`** tiene demos HTML viejos que la app no usa. Las plantillas reales están en `src/App.tsx`.

**Problema conocido:** `npx tsc --noEmit` marca un error de tipos en `src/Login.tsx` (`Cannot find namespace 'React'`). No afecta el build ni la app, porque Vite no hace chequeo de tipos.
