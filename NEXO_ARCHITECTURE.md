# NEXO — Arquitectura actual y objetivo

Fecha: 21 de octubre de 2026. Fase 1 autorizada; implementación local en validación. Las secciones de auditoría siguientes conservan la línea base del 20 de octubre.

## Cambios implementados en Fase 1

- `functions/_shared/action.ts` verifica identidad, pertenencia, método y tamaño; las cinco funciones usan este acceso común.
- `_shared/rules.ts` y `_shared/gameTypes.ts` son compartidos con el frontend.
- Migración 012: permisos restringidos, creación/unión protegida y `room_snapshot`, que entrega estado y conteos coherentes con únicamente la mano propia.
- Migración 013: `nexo_private.piles` conserva mazo y descartes; inicio y jugadas transaccionales; comandos deduplicados; ventana NEXO de cinco segundos.
- Migración 014: presencia con avance explícito de ausentes, salida de lobby, y `room_messages` mediante RPC autenticada y Realtime. Reacciones/voz dejan de confiar en broadcast del cliente.
- `NexoButton` mantiene el control sobre la zona de cartas y solo muestra anuncio confirmado al recibir `has_called_uno` del juego.

Estas migraciones y funciones no se han desplegado. Falta validar transporte real, concurrencia multiconexión e historial CLI en Supabase aislado. El diagrama posterior es histórico; para el flujo actualizado, sustituir las consultas separadas por `room_snapshot` y broadcast por `room_messages`.

 Ver hallazgos y aceptación por tarea en [NEXO_ROADMAP.md](NEXO_ROADMAP.md).

## 1. Arquitectura comprobada

```text
Navegador — React / TypeScript / Vite / Tailwind / PWA
  App: navegación por estado, sesión anónima, restauración de sala
  Home → Lobby → Board → GameOver
  OfflineApp + Tutorial → useOfflineGame → reglas TypeScript
  Board → useOnlineGame → Supabase JS
    ├─ consultas: game_state, players, mano propia
    ├─ RPC: salas, matchmaking, reconexión, heartbeat
    ├─ Edge Functions: inicio, jugar, robar, anuncio, penalización
    └─ Realtime: rooms, players, game_state, events
  Room3D + personajes + efectos + sonido ← estado de presentación
  Reacciones/voz ↔ canales broadcast

Supabase
  Auth anónimo
  PostgreSQL: rooms / players / hands / game_state / events
  RLS y funciones SECURITY DEFINER
  commit_game_action: bloqueo + versión + mano + turno + evento
  trigger penalize_unannounced_turn: +4 al regreso del turno

Publicación prevista en código: frontend estático Netlify + Supabase
```

No hay Express, Socket.IO, Redis, microservicios ni un servidor de partidas Node que deba reemplazarse. `backend/package.json` contiene CLI y herramientas de pruebas; las funciones de aplicación se ejecutan en Deno/PostgreSQL.

### Responsabilidades actuales

| Ubicación | Responsabilidad | Limitación |
| --- | --- | --- |
| `frontend/src/types/index.ts` | Tipos del dominio | Manuales; `hand_count` es opcional pero nunca se calcula online. |
| `frontend/src/engine/rules.ts` | Validez/efectos puros para cliente y juego local | No lo consume el backend; reglas y transiciones repartidas entre hook, Edge Functions y SQL. |
| `frontend/src/hooks/useOfflineGame.ts` | Bots, mazo/descarte local, acciones | Tiene reglas de robo y ventana distintas al online. |
| `frontend/src/hooks/useGame.ts` | Recuperación y proyección online | Cuatro consultas por refresh; igualdad de versión no cubre mutaciones actuales que no incrementan versión. |
| `frontend/src/services/room.service.ts` | RPC de salas/sesión | Sesión de sala por pestaña; Auth compartida en almacenamiento persistente del mismo origen. |
| `backend/supabase/functions` | Validación y cálculos autoritativos parciales | Identidad no validada en dos rutas; validación de entrada dispersa; inicio/manual penalty no atómicos. |
| `backend/supabase/migrations` | Esquema, RLS, RPC, transacciones | Vías de escritura adicionales debilitan la autoridad; historial con versiones duplicadas. |
| `Room3D.tsx`, motores de personaje | Render, cámara, animación, gestión de recursos | Ya hay lazy loading, caché de modelos, DPR limitado a 1.5 y dispose; falta presupuesto medido y modo reducido 3D. |

### Estado persistente y ciclo actual

- `rooms`: código, host, cupo, estado, privacidad y hash de contraseña.
- `players`: usuario anónimo, sala, asiento, nombre, presencia y anuncio.
- `hands`: instancias privadas de cartas; RLS de lectura del dueño.
- `game_state`: una fila por sala, versión, turno, dirección, color, carta superior, acumulación, cantidad de mazo y ganador.
- `events`: eventos operativos por sala, algunos con versión; no sustituye un historial de partidas separado.

Crear sala es RPC transaccional; la versión moderna de 008 agrega el estado vacío. Iniciar reparte en operaciones separadas. Jugar/robar calculan el próximo estado en Edge y lo envían a `commit_game_action`; este bloquea la fila, rechaza versión anterior y confirma cambios conjuntamente. Las reglas de legalidad permanecen en Edge; el RPC de commit está restringido a service_role. El trigger 010 puede agregar sanción durante ese commit.

Realtime avisa cambios y el cliente vuelve a consultar. La mano no se publica por Realtime; se obtiene mediante consulta privada. Esto se debe conservar. El conteo público debe provenir de una proyección segura, nunca de descargar manos ajenas.

## 2. Principios de evolución

1. Conservar React, TypeScript, Three.js, Supabase y las pantallas existentes.
2. Hacer al servidor la única autoridad; ocultar botones no constituye control de acceso.
3. Una acción de juego equivale a una transacción y una versión de estado.
4. Separar estado privado, proyección pública y estado visual; ningún efecto modifica reglas.
5. Compartir reglas puras entre local y servidor sin convertir el cliente en autoridad.
6. Implementar por migraciones pequeñas verificadas; no ejecutar reparación/despliegue remoto durante esta auditoría.
7. Mantener Clásico estable antes de introducir extensiones, comercio o competitivo.

## 3. Arquitectura objetivo propuesta

```text
UI React / Room3D
  ↓ comando tipado (partida, requestId, expectedVersion, acción)
Cliente de juego y recuperación
  ↓ JWT
Edge: autenticar → validar esquema → limitar → resolver actor
  ↓ lectura autoritativa + motor puro versionado
RPC interna de commit
  → bloqueo de partida y comprobación de versión/configuración
  → mazo/mano/turno/anuncio/resultado/eventos en una transacción
  → registro idempotente de requestId
  ↓ proyección autorizada y versión
Realtime notifica → cliente recupera snapshot público + mano propia
```

La implementación puede mantener validación de reglas en Edge y commit en SQL, siempre que todas las entradas autoritativas del cálculo estén cubiertas por la versión bajo bloqueo. Si cambian participantes, reglas, manos o ventanas, se invalida esa versión. SQL no debe aceptar estados propuestos por clientes: el RPC de commit sigue siendo exclusivamente interno.

### Motor de dominio compartido

Extraer gradualmente un módulo TypeScript puro, por ejemplo `shared/game-engine/`, compatible con Deno y Vite, sin React, red ni acceso a almacenamiento.

- Entradas: estado autoritativo, actor, acción, versión de reglas, participantes y tiempo del servidor.
- Salidas: rechazo tipado o transición declarativa con movimientos de cartas, siguiente turno y eventos.
- El servidor suministra aleatoriedad y tiempo; el navegador nunca decide reparto o expiraciones online.
- RNG inyectable para pruebas deterministas; aleatoriedad del reparto generada en servidor.
- Reutilizar `canPlay`, `canCounter`, `nextPlayerIndex` y casos existentes al migrar. Crear pruebas de paridad antes de borrar duplicaciones.
- Mantener la regla de victoria numérica; definir una política explícita para jugar después de robar y límite de acciones permitidas.
- El motor offline usa el mismo contrato con adaptador de almacenamiento local.

### Acciones e idempotencia

Contrato propuesto: `matchId`, `requestId`, `expectedVersion`, `type`, datos específicos (`cardId`, `chosenColor` o `targetPlayerId`). El actor se deriva de JWT y pertenencia, aunque la UI aporte su referencia.

- `requestId` único por actor/partida: repetir devuelve resultado confirmado, sin repetir efectos.
- Una versión antigua devuelve conflicto y snapshot/version actual recuperable.
- Inicio, ingreso, abandono, anuncio y sanción deben tener garantías equivalentes a jugar/robar.
- Validar método, JSON, tamaño, UUID, rangos y color real del comodín; errores públicos estables sin detalles internos.
- No reintentar automáticamente una acción ambigua con otro requestId tras timeout.

### Datos objetivo e introducción por fases

Los nombres siguientes son propuestas, no tablas existentes.

| Fase | Datos | Propósito |
| --- | --- | --- |
| 1 | Estado privado del mazo y descarte ordenado | Conservar identidad/multiplicidad; reciclar descarte excluyendo carta superior. No exponer a clientes. |
| 1 | Registro de comandos procesados | Deducción de acciones repetidas y respuesta recuperable. Retención acotada por partida. |
| 1 | Ventana de anuncio: jugador, versión de apertura, vencimiento, resolución | Decisión autoritativa y una única sanción, sin depender del reloj del navegador. |
| 1 | Snapshot autorizado | Estado público, conteos y mano propia leídos coherentemente. |
| 2 | `matches` y participantes por ronda | Separar sala social de partida; fechas, resultado y revisión de reglas. Revancha crea una ronda nueva. |
| 2 | Configuración de sala versionada y copia inmutable por partida | Acumulaciones, reversas, NEXO, turnos, cupo y futuras extensiones. |
| 2 | Eventos de producto separados del log operativo | Embudo/abandono/retención sin mezclar transporte y analítica. |
| 3 | Perfiles mínimos y progreso | Cuenta opcional; vinculación segura desde invitado, acceso del dueño. |
| 4 | Catálogo, órdenes, pagos, inventario y entregas | Precios/propiedad autoritativos, separación de compras y cosméticos. |
| 5 | Estadísticas derivadas y momentos | Agregaciones reproducibles y exportación segura. |

No guardar el orden del mazo en `game_state` si esa fila se sirve completa a clientes. Usar tablas/esquema privado sin grants de lectura pública.

### Configuración de reglas

Definir `rulesVersion`, `mode`, `stackingEnabled`, `reverseCounterEnabled`, `nexoPenaltyEnabled`, `turnDurationSeconds` y `maxPlayers`, con validación de servidor. En Fase 1 documentar la configuración fija actual; en Fase 2 hacerla seleccionable y visible antes de entrar.

Animaciones reducidas son preferencia por dispositivo; no deben cambiar legalidad, ventanas de juego o resultados. Reglas especiales deben ser extensiones identificadas/versionadas, nunca condiciones arbitrarias inyectadas por cliente.

### NEXO y latencia

Abrir ventana al confirmar que la mano queda en una carta. La transacción guarda apertura y plazo mínimo; el cliente muestra el vencimiento calculado con referencia de servidor. El anuncio se serializa con sanción y avance de turno. Una acusación válida solo resuelve una ventana vencida, una vez.

La política exacta de cierre cuando vuelve el turno antes de expirar el mínimo debe acordarse y probarse: no basta copiar el temporizador de bots. Propuesta de producto: conservar la oportunidad de anunciar hasta el plazo servidor, sin permitir victoria que evada una infracción pendiente. No confiar en timestamps aportados por el navegador ni prometer compensación ilimitada a red arbitrariamente lenta.

### Salas, presencia y recuperación

- Bloquear sala al reservar asiento o comenzar; reingreso del mismo usuario devuelve su participación.
- Heartbeat con identidad validada en lobby y tablero. Un proceso interno marca ausentes con tolerancia acordada; no dar esa función al público.
- Separar desconexión temporal de abandono explícito. Definir espera, transferencia del anfitrión y finalización por insuficientes jugadores.
- Reconexión entrega último snapshot y cursor de eventos, conserva identidad y no reparte otra vez.
- Pruebas con contextos de navegador independientes: dos pestañas de un mismo perfil pueden compartir el mismo usuario anónimo y no representan dos invitados.
- Realtime es notificación de cambios; snapshot y versión son la fuente de recuperación.
- Canales sociales privados autorizados por membresía; emisor comprobado y límites de tamaño/frecuencia de servidor. No basta validar `playerId` en UI.

### Presentación 3D y experiencia

Conservar `Room3D`, personajes, caché, geometrías compartidas y fallback procedural. Alimentarlos con una proyección inmutable y eventos identificados para no repetir animaciones por polling.

Separar contraataque de reversa común mediante evento explícito con acumulación, emisor, destinatario y dirección. Renderizar «¡CONTRAATAQUE!» y conservar el indicador de turno.

Medir tiempo de frame, draw calls, memoria, tamaño de assets y carga en 2/4/8 participantes. Aplicar nivel de sombras, DPR y animaciones según preferencia/capacidad; pausar trabajo innecesario en segundo plano. Mantener vista clásica utilizable. No agregar otra biblioteca 3D.

### Seguridad y operación

- Denegar acceso cliente a mutaciones del juego; RPC públicas solo cuando verifican identidad, pertenencia y fase.
- RPC internas restringidas a service_role; `search_path` fijo e inventario de firmas legacy.
- Vista/listado público sin hashes, sin códigos de salas privadas; validar contraseña al ingresar y prevenir bypass por INSERT directo.
- Límites por usuario/sala y origen de abuso para crear, unirse, jugar y emitir mensajes.
- Logs estructurados con correlation/request ID y errores categorizados, nunca tokens, manos privadas ni audio.
- Entornos separados y migraciones ensayadas; CI ejecuta tipos, build, pruebas, restauración y permisos.
- Documentar soporte, monitoreo y recuperación antes de lanzar. Despliegue real requiere autorización.

### Monetización futura

Empezar con catálogo demostrativo claramente identificado. Precios almacenados en unidades menores y moneda: cartas 2900, mesas 5900, fundador 9900 MXN como referencias configurables.

Checkout obtiene precio/propiedad en servidor, usa idempotencia y verifica webhooks. El estado pagado y la entrega se confirman transaccionalmente con unicidad del evento del proveedor y de la entrega. El regreso al navegador no entrega artículos. Probar pendientes, fallidos, duplicados y compras de otro usuario.

No activar pagos reales antes de revisar credenciales/configuración comercial y aprobación del propietario. Cosméticos nunca participan en la evaluación de jugadas.

### Analítica y crecimiento futuros

Mapear `game_started`/`game_finished` operativos a `match_started`/`match_completed` de producto; no asumir equivalencia de todos los eventos ni doble contarlos en cada navegador.

Eventos solicitados: `game_opened`, `room_created`, `room_joined`, `match_started`, `match_completed`, `match_abandoned`, `rematch_started`, `nexo_announced`, `counterattack_used`, `purchase_started`, `purchase_completed`. Los dos últimos solo al existir el flujo comercial real o un sandbox identificado.

Usar identificadores seudónimos, política de retención/preferencias y panel con autorización servidor. Definir DAU/MAU, cohortes D1/D7, duración, abandono, invitaciones y conversión antes de mostrar números. Ingresos derivan de pagos confirmados; costo de infraestructura exige datos del proveedor.

Preparar eventos ordenados y versión del motor para momentos/repeticiones, separando información pública y privada. No implica grabación de video ni competitivo avanzado.

## 4. Estrategia de validación

1. Mantener suites existentes (116 frontend y 9 backend aprobadas en auditoría).
2. Agregar casos de dominio de acumulación mixta, color tras +4, reversa en 2/3/8 jugadores, agotamiento/reciclado, anuncio/victoria y paridad local-online.
3. Base aislada con todas las migraciones, roles reales y funciones de Auth simuladas o Supabase local; probar lecturas/escrituras permitidas y denegadas.
4. Integración HTTP de cada Edge Function con tokens válidos, inválidos y ajenos; conflictos concurrentes en conexiones reales, no solo PGlite.
5. E2E con contextos independientes, reconexión, acciones repetidas, pérdida de eventos y latencia controlada. Pruebas de revancha al implementar Fase 2.
6. Navegadores y dispositivos identificados, medición de FPS/carga/memoria y revisión táctil/accesible.
7. En Fase 4, sandbox comercial con firmas inválidas, webhooks duplicados y entrega autorizada.

## 5. Decisiones y límites

**Decidido por esta propuesta:** conservar stack y experiencia 3D; cerrar autoridad antes de crecimiento; reutilizar reglas y pruebas; separar sala/ronda; no introducir pagos, nuevos modos ni infraestructura innecesaria.

**Pendiente de aprobación de producto:** semántica única de robo, ventana NEXO y detección de infracciones, manejo de ausencias/host y opciones iniciales de sala.

**Pendiente de evidencia técnica:** versión remota, grants efectivos, migraciones aplicadas, disponibilidad de entorno aislado Supabase, rendimiento real y escala esperada.

Este documento no certifica producción ni autoriza despliegues. El siguiente paso es aprobar el diagnóstico y ejecutar únicamente Fase 1, empezando por permisos, autenticación y reproducibilidad.
