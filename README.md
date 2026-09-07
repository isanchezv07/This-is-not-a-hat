# This Is Not a Hat — Memory & Bluff (original implementation)

Un juego multijugador en tiempo real de **memoria y engaño** inspirado en la idea
general de "pasa un objeto, recuerda qué es, y descubre si alguien te está mintiendo".
Implementación 100% original: sin assets, nombres, textos ni arte del juego original.

> 🎩 Los jugadores se pasan cartas que muestran una **afirmación**. El receptor
> decide si acepta la carta o si **acusa al otro de mentir** ("CALL BLUFF").
> Recuerda qué recibiste… porque el que entrega puede mentir.

---

## Demo rápida

1. Un jugador abre la app → **Create room** → obtiene un código de 5 letras (p. ej. `X7K92`).
2. Comparte el código con amigos.
3. Cada amigo abre la app → **Join room** → introduce el código → entran al lobby.
4. El creador (HOST) presiona **Start game**.
5. Turnos rotativos: pasar → aceptar/llamar bluff → revelar → penalización.
6. Último jugador en pie = **ganador**.

---

## Reglas exactas

### Preparación
- **2–8 jugadores**, cada uno con su propio dispositivo.
- Cada jugador empieza con **3 vidas** y **una sola carta boca arriba** frente a él
  (todos la ven y la recuerdan).
- El resto de la baraja central (40 cartas con duplicados de 15 objetos, más las
  que se añadan) va **boca abajo en el centro de la mesa**: el mazo.
- Cada carta tiene una **flecha** (8 direcciones) que indica hacia qué jugador se pasa.

### Inicio del juego
- El jugador que empieza **roba 1 carta del mazo sin verla** y la **revela boca
  arriba** a todos. Ahora tiene 2 cartas visibles frente a él y debe pasar una.

### Turnos (pasar una carta)
- Orden rotativo: host → siguiente → …
- El jugador activo elige una de sus cartas y **gira su flecha** (↺/↻ o toca al
  jugador) hasta apuntar al destinatario — cualquier jugador vivo menos él.
- **Lo dice en voz alta**: "this is a `X`" (puede decir la verdad… o mentir).
- **Entrega la carta boca abajo**: el receptor **no la mira**, solo oye la afirmación.

### Recepción y desafío
- **ACCEPT** → la carta entra a su área **boca abajo** (no la ve). Avanza el turno.
- **CALL BLUFF** → se revela la carta a todos:
  - Si el remitente **mintió** → el **remitente** pierde 1 vida.
  - Si el remitente **dijo la verdad** → el **receptor** pierde 1 vida.
- Una carta revelada queda **boca arriba** en el área del receptor.

### Memoria (lo esencial)
- Las cartas **boca arriba** las ven y recuerdan todos.
- Las cartas **boca abajo** no se miran: ni siquiera su dueño sabe qué son. Solo
  se recuerda **qué te afirmaron** al pasártela (etiqueta "known claim") y lo que
  has visto en la mesa.
- Si un jugador se queda sin cartas, roba 1 del mazo **boca abajo** para seguir.

### Vidas y victoria
- ❤️❤️❤️ → 3 vidas. Al llegar a 0 el jugador queda **eliminado** (☠).
- La partida continúa hasta que queda **un solo jugador** → **gana**.
- Pantalla final con **Play again** (nueva partida en la misma sala) o **Return to lobby**.

### Desconexión y reconexión
- En el lobby, un desconectado se elimina de la sala.
- En partida, el puesto se conserva y se **salta su turno** si le toca (no bloquea).
- Si el host se va, el host se **transfiere** automáticamente.
- El servidor guarda un id persistente del jugador: si vuelve a conectar (misma
  pestaña), se **re-vincula automáticamente** a su asiento en la partida.

---

## Arquitectura

Monorepo npm con workspaces:

```
this-is-not-a-hat/
├── package.json          # workspaces: client + server, scripts raíz
├── client/               # Vite + React 18 + TS + Tailwind (frontend)
│   └── src/
│       ├── components/   # Menu, CreateRoom, JoinRoom, Lobby, GameBoard, VictoryScreen
│       ├── game/         # catálogo de cartas (render)
│       ├── socket/       # hook useSocket (Socket.IO client)
│       └── types.ts      # tipos públicos compartidos
└── server/               # Node + Express + Socket.IO + TS (backend)
    └── src/
        ├── game/         # motor de juego PURO (sin Socket.IO, testeable)
        │   ├── game.ts   # crear sala, turnos, pasar/aceptar/bluff, vidas, ganador
        │   ├── cards.ts  # catálogo + constantes
        │   └── utils.ts  # barajado, códigos, ids
        ├── rooms/        # Rooms: almacén en memoria + sockets
        ├── socket/       # present.ts: proyección filtrada del estado
        └── index.ts      # Express + Socket.IO, puntos de entrada
```

### Autoridad del servidor
El cliente **nunca** recibe datos que no debe ver:
- Las cartas **boca arriba** (públicas) se envían a todos; las **boca abajo** se
  envían ocultas a **todos**, incluso a su dueño (solo con la última afirmación).
- La oferta pendiente muestra solo la **afirmación** y datos públicos, nunca la carta real.
- El servidor valida turnos, propiedad de cartas, destinatarios, estados y acciones
  ANTES de mutar el estado. No se confía en el cliente.

### Eventos Socket.IO

| Cliente → Servidor        | Servidor → Cliente      |
|---------------------------|-------------------------|
| `createRoom`, `joinRoom`  | `room:created`, `room:joined`, `room:reconnected` |
| `identify` (reconexión)   | `room:state`, `game:state` (estado filtrado por jugador) |
| `leaveRoom`               | `error`                 |
| `startGame`               | `game:state`            |
| `drawCard` (primer robo)  | `game:state`            |
| `passCard` (con `rotation`) | `game:state`          |
| `acceptCard`              | `game:state`            |
| `callBluff`               | `game:state` + `bluff:resolved` |
| `playAgain`, `returnToLobby` | `game:state`        |

---

## Tecnologías

- **Frontend:** React 18, TypeScript, Vite 6, Tailwind CSS 3
- **Backend:** Node.js ≥ 22, TypeScript, Express, Socket.IO
- **Tests:** Vitest (motor puro + integración Socket.IO)
- Sin polling: todo es en tiempo real mediante WebSockets.

---

## Instalación

Requisitos: **Node.js ≥ 22** y npm.

```bash
npm install        # instala client + server (workspaces)
```

## Ejecutar en local

```bash
npm run dev        # arranca server (:4000) y client (:5173) a la vez
```

Abre `http://localhost:5173`, crea una sala y únete desde varias pestañas/dispositivos
para probar.

Scripts útiles:

| Comando            | Descripción                                   |
|--------------------|-----------------------------------------------|
| `npm run dev`      | Server + client en paralelo (concurrently)    |
| `npm run dev:server` | Solo el backend                             |
| `npm run dev:client` | Solo el frontend                            |
| `npm run build`    | Compila client (Vite) y server (tsc)          |
| `npm run start`    | Arranca el server compilado (`dist/`)         |
| `npm test`         | Tests del motor + integración (Vitest)        |

## Variables de entorno

| Variable              | Dónde      | Descripción                                          |
|-----------------------|------------|------------------------------------------------------|
| `VITE_SERVER_URL`     | `client/.env` | URL del servidor Socket.IO. Local: `http://localhost:4000` |
| `PORT`                | `server/.env` | Puerto del server. Por defecto `4000`              |
| `CLIENT_ORIGIN`       | `server/.env` | Origen CORS permitido (`*` en dev, tu dominio en prod) |

Copiar `client/.env.example` → `client/.env` y `server/.env.example` → `server/.env`.

> ⚠️ `VITE_SERVER_URL` se incluye en el bundle del cliente; úsala solo con URLs
> públicas de tu servidor.

---

## Deployment

El frontend es **estático** (fácil en Vercel gratis). El backend necesita un
**proceso Node persistente con WebSockets** — un detalle importante:

> **¿Vercel gratis (Hobby)?** Vercel ahora admite WebSockets/Socket.IO, pero en el
> plan gratuito cada conexión muere a los **300 s (5 min)**, cada socket queda
> anclado a una sola instancia (dos jugadores en instancias distintas no se ven sin
> una capa Redis), y el estado en memoria se pierde entre invocaciones. Por eso **el
> servidor de juego no debe desplegarse en Vercel Hobby**: los códigos de sala no
> funcionarían de forma fiable. Recomendación: **cliente en Vercel, servidor en
> Render free tier** (WebSockets + proceso persistente, gratis).

### 1) Servidor → Render (gratis)

1. Sube el repo a GitHub.
2. En [render.com](https://render.com) → **New → Web Service** → conecta el repo.
3. Configura:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** Free
4. Añade las variables de entorno:
   - `PORT=10000` (Render la inyecta así)
   - `CLIENT_ORIGIN=https://tu-app.vercel.app` (tu dominio final del cliente)
5. Obtienes una URL tipo `https://tu-juego.onrender.com` (**B**).
   - En el plan free, la instancia **duerme a los 15 min** de inactividad. Al volver,
     el primer jugador verá "Reconnecting… server may be waking up" (~1 min de cold
     start); el resto entra normal. Es el estándar para demos/personales.

### 2) Cliente → Vercel (gratis)

1. Importa el repo en [vercel.com](https://vercel.com) (detecta Vite automáticamente).
2. Configura framework **Vite** con:
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Añade la variable de entorno:
   - `VITE_SERVER_URL=https://tu-juego.onrender.com` (la URL **B** del servidor)
   - ⚠️ Vercel no deja previsualizar `.env` de raíz; añade la variable en
     *Project → Settings → Environment Variables*, o crea `client/.env` antes del
     deploy temporalmente.
4. Deploy → obtienes `https://tu-app.vercel.app` (**A**).
5. Vuelve a Render y actualiza `CLIENT_ORIGIN` con **A**. Redeploy si hace falta.

### Resultado

- Persona 1 abre **A** → crea sala → comparte el código.
- Personas 2–8 abren **A** en sus móviles → introducen el código → juegan en tiempo real.
- El servidor vive en **B** y no se cae por los límites de Vercel Hobby.

---

## Tests

```bash
npm test
```

Cubren: crear/unirse a sala, mínimo y máximo de jugadores, inicio de partida
(1 carta pública a cada uno), primer robo con revelación, turnos, giro de flecha,
pasar cartas, aceptar (queda boca abajo), detectar mentira/verdad, pérdida de
vidas, eliminación, victoria, robo de emergencia, desconexión, cambio de host y un
flujo E2E completo por Socket.IO (dos clientes reales conectados al servidor).

---

## Verificación de seguridad antichatarra

- El servidor nunca envía la identidad real de las cartas **boca abajo** (ni a su
  dueño), ni la carta real en tránsito.
- Todas las acciones se validan en el motor: turno, propiedad, existencias, estado.
- El cliente solo recibe el estado proyectado para él (`presentForPlayer`).