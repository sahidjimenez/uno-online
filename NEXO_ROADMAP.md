# NEXO — Auditoría y roadmap

Fecha: 21 de octubre de 2026. Estado: Fase 1 autorizada e implementada localmente en gran parte; cierre pendiente de integración real en Supabase aislado.

## Avance de Fase 1 — actualización

El propietario autorizó la implementación con «vas con la fase 1». Los hallazgos y resultados de auditoría que siguen son la línea base histórica; no describen todos los cambios actuales.

- Implementado localmente: autorización uniforme de cinco funciones, validación y límites de solicitudes, permisos de tablas y RPC, contraseñas de sala y eliminación de firmas antiguas vulnerables.
- Implementado localmente: inicio transaccional, mazo persistente de 108 cartas con reciclaje, control de versión y deduplicación dentro del commit. Un reintento puede requerir refrescar la mesa; no se garantiza reproducción transparente de la respuesta en todos los endpoints.
- Implementado localmente: reglas TypeScript compartidas, snapshot coherente con mano propia y conteos públicos, ventana mínima de cinco segundos para anunciar NEXO, presencia y avance de ausentes, salida del lobby y transferencia de anfitrión, mensajes autenticados.
- Corregido el botón NEXO: prioridad visual sobre la mano, bloqueo de doble envío, reintento tras fallo y confirmación basada en el estado real. La inspección visual actual quedó bloqueada por la política del navegador; se comprobó el comportamiento mediante pruebas de componente.
- Validación: 123 pruebas frontend, 27 pruebas SQL/PGlite y una prueba Deno de autenticación con servicio simulado. Cinco funciones verificadas con Deno. Compilación frontend comprobada. No equivalen a E2E desplegado.
- Auditoría de dependencias: backend sin avisos y frontend de ejecución sin avisos en la comprobación realizada. Quedan 25 avisos en herramientas de desarrollo del frontend; su actualización y compatibilidad necesitan una tarea específica.

### Pendiente para cerrar la fase

1. Proporcionar/configurar un Supabase aislado y reconciliar el historial de migraciones (hay dos prefijos 006). PGlite ejecuta los archivos por nombre; no valida el historial del CLI remoto.
2. Aplicar 012, 013 y 014 en ese entorno, publicar las cinco funciones y el frontend compatible, y ejecutar `backend/tests/staging-smoke.mjs` con dos identidades independientes. No se ha modificado ningún servicio remoto.
3. Verificar pérdidas de red, concurrencia con conexiones PostgreSQL reales, Realtime y la interacción visual NEXO en escritorio y móvil. PGlite no reproduce todas esas condiciones.
4. Antes de una actualización real, terminar las partidas existentes: sus mazos antiguos no se pueden reconstruir de forma fiable. Preparar copia y ensayo de restauración.

La limpieza física de mensajes caducados ocurre al enviar otro mensaje; falta una tarea periódica de mantenimiento. Las fases 2–5 permanecen pendientes.

## Alcance y método

Se revisaron el árbol del repositorio, manifiestos y lockfiles, esquema, políticas RLS, migraciones, scripts SQL alternativos, las cinco Edge Functions, servicios, hooks online/offline, reglas, pantallas, componentes 3D/sociales, configuración de publicación, contratos y pruebas existentes. Se auditó el árbol de trabajo actual, incluidos cambios previos sin commit y el tutorial nuevo. No se reemplazaron esos cambios.

Esta auditoría comprueba código y pruebas locales, no el estado del servicio desplegado. No se conectó a la base remota, no se aplicaron migraciones, no se publicaron funciones y no se realizaron pagos. No se ejecutó una partida E2E con identidades independientes, pruebas de carga ni mediciones en móviles físicos. Una funcionalidad presente en código no implica que esté validada en producción.

Las referencias siguientes son rutas relativas a este repositorio. La arquitectura y las decisiones propuestas están en [NEXO_ARCHITECTURE.md](NEXO_ARCHITECTURE.md).

## Diagnóstico ejecutivo

Existe una base sustancial reutilizable: juego local con bots y tutorial, interfaz NEXO, mesa Three.js, salas y sesiones anónimas Supabase, eventos Realtime, reconexión y confirmación transaccional de jugadas/robos. No hace falta reconstruir el producto ni cambiar el stack.

El multijugador todavía no cumple los criterios de un lanzamiento público. Hay rutas privilegiadas sin validación de identidad, permisos demasiado amplios, reparto inicial no atómico, mazo online sin persistencia real, divergencias entre reglas locales/online y flujos incompletos de presencia, conteos y revancha. Son problemas anteriores a monetización o nuevos modos.

## Estado real de funcionalidades

| Área | Evidencia | Estado comprobado |
| --- | --- | --- |
| Stack | `frontend/package.json`, `backend/package.json` | React 18, TypeScript, Vite 5, Tailwind, Three.js, Supabase JS; backend PostgreSQL/RPC y Edge Functions Deno, sin servidor Node propio. |
| Inicio, crear/unirse/buscar | `pages/Home.tsx`, `services/room.service.ts`, migraciones 007/008 | Formularios, búsqueda de mesas públicas, código, contraseña opcional y nombre. No hay flujo de enlace de invitación. |
| Invitados | `lib/supabase.ts`, `App.tsx` | Auth anónimo persistente; referencia de sala en sessionStorage. No requiere cuenta convencional. Objetivo de entrada en 30 s no medido. |
| Lobby | `pages/Lobby.tsx` | Participantes, copiar código, iniciar con dos conectados. UI infiere anfitrión por primer asiento, no por `rooms.host_id`; capacidad mostrada fija en ocho. |
| Reglas principales | `engine/rules.ts`, `functions/play-card/index.ts` | +2/+4 mixtos, reversa del color activo y victoria únicamente con número. Reglas duplicadas entre local y servidor. |
| Última carta | `pages/Board.tsx`, migraciones 009/010 | Botón «¡ÚLTIMA!», anuncio autenticado y penalización automática de cuatro al volver el turno. No se llama NEXO; ventana online sin mínimo de gracia. También persiste una ruta manual de penalización insegura. |
| Atomicidad | migración 011, `play-card`, `draw-card` | Transacción con bloqueo de fila y versión para jugar/robar. No cubre inicio, ingreso ni penalización manual. |
| Sincronización | `hooks/useGame.ts`, migración 004 | Realtime, recuperación por foco/conexión, polling cada 8 s, heartbeat cada 10 s y lecturas con comprobación de versión. No hay snapshot único transaccional. |
| Reconexión | `reconnect_player`, `App.tsx` | Reconecta al mismo usuario anónimo con sala guardada. No hay pruebas reales de dos pestañas/varios dispositivos; un RPC fallido deriva a pantalla de error. |
| Desconexión/abandono | `003_functions.sql`, `Lobby.tsx`, `App.tsx` | Función para marcar desconexión tras 15 s; no se encontró programación de su ejecución. Lobby sin heartbeat. Salir borra sesión local, no abandona en servidor. No hay política de relevo/expulsión/timeout del turno. |
| Mazo | `_shared/deck.ts`, `draw-card`, `useOfflineGame.ts` | Reparto inicial de mazo de 108; local conserva mazo/descarte. Online guarda solo cantidad, regenera un mazo por robo. |
| Mesa y efectos | `components/Room3D.tsx`, `EffectOverlay.tsx` | Sala/mesa 3D, personajes, movimientos de cartas, robos, dirección, contador, sonidos, vistas de mesa/recorrido/clásica. Reversa usa efecto genérico; falta «¡CONTRAATAQUE!» específico. |
| Responsive/accesibilidad | CSS, `Board.tsx`, `index.html` | Adaptaciones móviles y movimiento reducido CSS. No se validó usabilidad táctil completa. El viewport deshabilita zoom; reducción de movimiento no cubre el bucle 3D. |
| Personalización | `lib/character.ts`, `useCharacter.ts`, `CharacterCustomizer.tsx` | Apariencia local guardada en navegador; modelos con licencia CC0 documentada y fallback procedural. No es perfil persistente de servidor ni inventario. |
| Juego local/tutorial | `OfflineApp.tsx`, `useOfflineGame.ts`, `engine/tutorial.ts`, `pages/Tutorial.tsx` | Bots, velocidades, tutorial guiado y pruebas. Parte del trabajo ya estaba sin commit antes de la auditoría. |
| Resultados/revancha | `GameOver.tsx`, `App.tsx` | Ganador y tabla de cartas en UI; conteos online ausentes. Revancha online solo cambia de pantalla, no prepara otra partida. Faltan duración y estadísticas. |
| Social | `ReactionBar.tsx`, `VoiceNotes.tsx` | Reacciones y notas de voz con límites cliente y validación de formato; falta autorización de canal vinculada al emisor. No hay tarjeta compartible ni enlace/WhatsApp. |
| Configuración de reglas | esquema, servicios, lobby | No hay reglas versionadas/configurables ni tiempo por turno. Ajustes visuales y velocidad de bots no equivalen a reglas de sala. |
| Persistencia | esquema 001 | Salas, jugadores, manos, estado y eventos. No hay historial separado de partidas, perfiles de progreso o estadísticas persistentes. |
| Comercio | búsqueda de código y esquema | Sin catálogo, inventario, checkout, compras, webhooks ni tienda demostrativa. |
| Analítica | `frontend/index.html`, tabla `events` | Google tag cargado directamente; eventos de juego operativos en DB. No hay instrumentación completa del embudo solicitado, consentimiento implementado ni dashboard autorizado. |
| Producción | `netlify.toml`, `vite.config.ts`, `.env.example` | Build estático Netlify y PWA. No se encontraron CI, monitoreo centralizado, documentos de privacidad/términos/contacto/soporte ni Open Graph. Hay título, idioma y theme-color. |
| Contrato | `api-contracts/openapi.yaml` | Plantilla con placeholders y `/health`, no representa los RPC/Edge Functions reales. |

## Hallazgos priorizados

P0 bloquea exposición pública por seguridad/integridad; P1 bloquea estabilidad funcional; P2 mejora experiencia/operación. Los hallazgos son de código salvo donde se indica prueba ejecutada. La exposición remota depende de qué versión esté desplegada y de permisos efectivos todavía no inspeccionados.

| ID | Prioridad | Hallazgo, evidencia e impacto | Corrección propuesta |
| --- | --- | --- | --- |
| A01 | P0 | `config.toml` desactiva verificación JWT en todas las funciones. `start-game` y `penalize-uno` usan service_role sin `getUser` ni vincular solicitante con jugador. Con identificadores conocidos permiten iniciar como host o acusar como otro jugador. Las otras tres funciones sí validan usuario. | Autenticación y autorización comunes en cada entrada privilegiada; pruebas de actor ajeno, token ausente/inválido y jugador de otra sala. |
| A02 | P0 | `002_rls.sql`: insertar jugador solo exige `user_id=auth.uid()`, sin contraseña, cupo o estado; actualizar jugador permite modificar columnas como `has_called_uno`, asiento o sala. Host puede cambiar estado/cupo de `rooms`. `005` no restringe esas escrituras. | Revocar escritura directa de campos de juego; RPC específicas, privilegios mínimos y pruebas reales con roles cliente. |
| A03 | P0 | `rooms_select_all` permite leer todas las salas; tras 007 incluye códigos privados y `password_hash`. La privacidad no está representada en esa política. | Proyección pública mínima y acceso de miembros separado; hash en almacenamiento privado inaccesible a clientes. |
| A04 | P0 | Funciones legacy `join_room(char,varchar)` y moderna `join_room(text,text,text)` coexisten por distinta firma; la antigua no verifica contraseña. Funciones SECURITY DEFINER antiguas sin `search_path` fijo ni revocaciones explícitas; mantenimiento expuesto según grants efectivos. | Inventariar y restringir firmas/grants, retirar rutas antiguas de forma compatible; limitar cleanup/desconexión a rol interno. Probar restauración en entorno aislado. |
| A05 | P1 | `start-game` inserta manos y actualiza estado/sala/evento en peticiones separadas. Dos inicios pueden repartir dos veces; un fallo intermedio deja estado parcial. | Inicio transaccional, bloqueo de sala y deduplicación; solo host real y participantes elegibles. |
| A06 | P1 | `draw-card` baraja un mazo nuevo en cada robo sin descontar manos/descarte. Puede duplicar cartas por encima de multiplicidades. Penalización manual también. El trigger 010 reconstruye disponibilidad con otra estrategia. | Mazo/descarte privado persistente; una sola operación de extracción/reciclado para robos y sanciones. |
| A07 | P1 | `penalize-uno` comprueba mano y luego inserta cuatro cartas sin bloqueo ni versión. Puede competir con anuncio, robo y otra acusación; actualiza estado sin incrementar versión. | Unificar ventana, sanción y anuncio en transacción versionada, con idempotencia. |
| A08 | P1 | `play-card` exige color a comodines solo si no hay acumulación. Con acumulación, +4 sin color conserva el anterior por `coalesce` de 011; acepta `wild` como color si se envía. Local rechaza esos casos. | Exigir uno de red/blue/green/yellow para todo comodín antes de cualquier mutación. |
| A09 | P1 | `useGame.ts` consulta `players.*`; SQL no produce `hand_count`. Board, 3D y resultados usan `?? 0`. Se muestran rivales con cero cartas y no se activan correctamente sus animaciones/acusaciones. | Conteos públicos calculados desde servidor sin revelar cartas, en snapshot coherente. |
| A10 | P1 | Online robar siempre pasa turno; local permite continuar si la carta robada es jugable. Bots esperan al menos 5 s para anuncio humano; online penaliza al volver turno sin gracia mínima. | Unificar reglas explícitas; persistir ventana de anuncio y resolver latencia desde servidor. |
| A11 | P1 | Join/matchmaking calculan cupo/asiento sin bloquear sala; restricciones UNIQUE pueden provocar fallos concurrentes y no coordinan ingreso con inicio. | Serializar ingreso/inicio; respuesta idempotente al mismo usuario; colisiones de código reintentables. |
| A12 | P1 | Heartbeat solo en tablero; sin scheduler comprobado para desconexión. Salida local no libera participación; selección de turno incluye desconectados. | Presencia y abandono autoritativos, reconexión y política explícita de turnos ausentes/anfitrión. |
| A13 | P1 | `App.tsx` envía revancha a lobby con sala `finished`; `start-game` solo acepta `waiting`. | Nueva ronda identificada y creada transaccionalmente; conservar historial y participantes. |
| A14 | P1 | Canales de voz/reacciones sin `private: true`; `playerId` lo suministra el emisor. No aparecen políticas de autorización Realtime para estos canales. Cooldowns solo cliente. | Canales privados con pertenencia comprobada y emisor verificado; límites servidor. |
| A15 | P1 | Dos migraciones usan prefijo `006`; SETUP_ALL solo contiene setup antiguo y repair redefine funciones por separado. Pruebas backend cargan únicamente 001/009/010/011. | Verificar historial aplicado y reconstrucción limpia con CLI en entorno aislado; nueva migración correctiva, sin renumerar a ciegas lo ya aplicado. |
| A16 | P2 | Cada refresh online hace cuatro lecturas; objetos nuevos disparan actualización 3D. Bucle de render, sombras y esqueletos siguen siendo coste relevante. Build avisa chunk de 664.70 kB. | Snapshot único, evitar reconstrucciones sin cambios, medir antes de optimizar; calidad adaptable y modo reducido 3D. |
| A17 | P1/P2 | No se encontró rate limiting servidor ni validación uniforme de cuerpos/métodos/errores. Google tag inicia sin flujo de preferencias; no hay operación documentada completa. | Límites y validación en Fase 1; privacidad, instrumentación y operación de lanzamiento en Fase 2. |

No se ejecutaron ataques contra servicios remotos. Las políticas SQL son evidencia de defectos en el repositorio, no prueba de explotación remota.

## Reglas actuales que deben conservarse o decidirse explícitamente

- Se pueden apilar +2/+4 sin igualar color. Un +2 pasa el color activo a su propio color; un +4 debe usar el color elegido.
- La reversa válida compara con `current_color`, incluido un ataque mixto o posterior a +4; no con el color `wild` impreso. Conserva acumulación, invierte dirección y pasa al siguiente asiento en la nueva dirección. Dos jugadores: reversa normal conserva turno; contraataque devuelve el ataque.
- Solo se gana con carta numérica, regla personalizada existente validada en local y en commit SQL. No eliminarla sin decisión explícita.
- Robo online termina turno; local puede conservarlo. Propuesta a aprobar en Fase 1: una sola política documentada, tomando la experiencia local como referencia y limitando claramente las acciones después de robar.
- Aviso actual: «ÚLTIMA», sanción +4 automática al regreso del turno; acusación manual sin gracia. Propuesta: NEXO con ventana de gracia de servidor y reglas claras de detección, conservando +4; el umbral debe validarse con simulación de latencia antes de fijarlo.

## Verificación ejecutada

| Comprobación | Resultado | Límites |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run` en frontend | 13 archivos, 116 pruebas aprobadas | Reglas/local/tutorial/recuperación simulada, assets y helpers. No navegador real ni transporte online real. |
| `npm test` en backend | 9 pruebas aprobadas en PGlite | Penalización automática, anuncio, rollback y commit por versión. No prueba de todas las migraciones, RLS, Auth, Edge Functions o Realtime. |
| `npm run build` en frontend | TypeScript, Vite y generación PWA completados, salida 0 | Aviso Browserslist desactualizado; chunk characterModel 664.70 kB minificado / 170.99 kB gzip. Precache 15 entradas / 1172.28 KiB. No equivale a medir FPS o carga móvil. |

La primera invocación de npm test del frontend quedó en watch por transmisión de argumentos en este entorno; se ejecutó luego Vitest directamente en modo run y se detuvo solo el watcher iniciado durante esta auditoría.

No se efectuó auditoría de vulnerabilidades de dependencias contra un registro, revisión legal de marca ni certificación de licencias completa. La documentación local de modelos contiene atribución y licencias CC0; eso no cubre por sí solo todos los assets.

## Plan de trabajo

### Plan de ejecución resumido

Este plan responde a la solicitud de organizar todo el trabajo. La auditoría ya terminó; las entregas siguientes son implementación pendiente. Se conserva el proyecto actual y se ejecutan las cinco fases en orden, con revisiones al cerrar cada una. Las entregas son unidades de trabajo, no semanas prometidas.

| Orden | Entrega | Trabajo concreto | Prueba para cerrar |
| --- | --- | --- | --- |
| 1 | Entorno reproducible | Preparar base aislada, verificar migraciones y permisos; conservar cambios locales y establecer regresiones. | Instalación limpia y pruebas ejecutables sin usar producción. |
| 2 | Seguridad del multijugador | Autenticar todas las acciones, restringir escrituras, ocultar datos privados y cerrar accesos antiguos; añadir límites. | Usuario ajeno no puede iniciar, penalizar, acceder a manos ni eludir contraseña/cupo. |
| 3 | Partidas y cartas consistentes | Hacer ingreso/inicio indivisibles, persistir mazo/descarte y compartir reglas entre bots y online. | Sin reparto duplicado; conservación de 108 cartas; acumulaciones, reversas y victoria con iguales resultados en ambos modos. |
| 4 | NEXO y recuperación | Resolver ventana de anuncio, sanción única, conteos rivales, reconexión/presencia y autorización social. | Partida completa con latencia, desconexión, acciones repetidas y dos identidades reales independientes. Cierra Fase 1. |
| 5 | Flujo completo con amigos | Enlaces/código/WhatsApp, reglas del anfitrión, abandono, resultados con métricas y revancha real. | Crear → invitar → jugar → terminar → revancha sin perder participantes o mezclar rondas. |
| 6 | Candidato a lanzamiento | Ajustar móvil/accesibilidad/tutorial; instrumentar analítica y panel protegido; monitoreo, metadatos, documentos y soporte. | Flujos probados en navegadores y móvil, preferencias respetadas y ensayo de publicación/recuperación. Cierra Fase 2. |
| 7 | Experiencia premium | Mejorar contraataques, animaciones/sonido, calidad adaptable; perfiles opcionales y personalización persistente. | Rendimiento medido, movimiento reducido completo y progreso conservado al vincular cuenta. Cierra Fase 3. |
| 8 | Tienda demostrativa | Catálogo configurable, diseños, mesas y Pack Fundador, inventario protegido y selección de cosméticos. | Demostración identificada; el usuario solo equipa artículos que le pertenecen, sin alterar reglas. |
| 9 | Comercio verificable | Checkout de pruebas, pagos pendientes/fallidos, webhooks verificados, deduplicación y entrega confirmada. | Pruebas comerciales completas sin cargos reales; preparación comercial revisada. Cierra Fase 4. |
| 10 | Crecimiento medible | Tarjetas de resultados, invitaciones medibles, estadísticas, recompensas y momentos reproducibles. | Resultados derivados del servidor y métricas comprobables. Caos y competitivo quedan sujetos a actividad y decisión de producto. Cierra Fase 5. |

**Primer hito útil:** al cerrar la entrega 4, partidas básicas estables y verificadas. **Primer candidato público:** entrega 6. **Monetización preparada:** entrega 9. No es necesario esperar a la tienda para validar si la gente disfruta jugar.

#### Forma de trabajar en cada entrega

1. Reproducir el problema y definir escenarios antes de modificarlo.
2. Implementar un cambio acotado reutilizando componentes y servicios.
3. Ejecutar pruebas pertinentes; para reglas/permisos, incluir casos inválidos y concurrentes.
4. Verificar la experiencia completa afectada y registrar resultados, limitaciones y pendientes.
5. Actualizar este roadmap y entregar un resumen breve: qué cambió, qué se comprobó y qué sigue.

No cerrar una entrega porque solo compila: deben pasar sus criterios y las regresiones relevantes. Si un bloqueo afecta una tarea, continuar únicamente con trabajo independiente de esa misma fase y registrar qué evidencia falta.

#### Decisiones y recursos necesarios, en su momento

| Cuándo | Necesidad | Tratamiento |
| --- | --- | --- |
| Antes de implementar Fase 1 | Entrada autorizada a implementación, entorno de pruebas y acceso necesario | La solicitud actual entrega el plan; no ejecuta migraciones remotas ni implica publicar. Validar disponibilidad local antes de solicitar recursos externos. |
| Entregas 3–4 | Regla tras robar, ventana NEXO, acusación y manejo de ausentes | Presentar escenarios y recomendación concreta; no cambiar reglas existentes silenciosamente. |
| Entrega 6 | Dominio/contacto, identidad comercial, textos y preferencias de privacidad | Preparar configuración y borradores; obtener datos reales sin inventarlos. Publicación requiere autorización del propietario. |
| Entrega 7 | Forma de vincular cuenta y apariencia de cosméticos | Mantener acceso gratuito por invitado y definir recuperación de progreso. |
| Entrega 9 | Proveedor/cuenta de pagos, configuración comercial y precios finales | Usar pruebas hasta revisión y autorización explícita de cobros reales. |
| Entrega 10 | Evidencia de retención y concurrencia | Decidir si conviene Caos o competitivo; no construir sistemas complejos solo por estar enumerados. |

**Planificación de tiempo:** estimar la primera entrega después de comprobar el entorno y recalibrar con trabajo terminado. El estado remoto y las decisiones de reglas aún desconocidos impiden prometer una fecha responsable para todo el producto. El tamaño técnico de cada tarea aparece en las tablas siguientes.

Dificultad: S = acotada, M = varios módulos, L = transversal y pruebas de integración. No son estimaciones de calendario. Cada tarea debe cerrar con evidencia y actualizar este documento. El cuadro siguiente conserva los criterios de aceptación originales; consultar el avance actualizado al inicio para conocer el estado.

### Fase 1 — Auditoría y estabilización

**Puerta de entrada: aprobación explícita del diagnóstico por el propietario.**

| Tarea | Prioridad | Dependencias | Dificultad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| F1-01 Reproducir entorno y migraciones | P0 | Aprobación | M | Base aislada creada desde cero; inventario de firmas/grants; diferencias con scripts alternativos documentadas; sin tocar datos remotos. |
| F1-02 Cerrar autorizaciones y escrituras | P0 | F1-01 | L | Actor ajeno/no autenticado no inicia, anuncia ni penaliza; inserción directa no evita cupo/contraseña; campos de juego y hashes no accesibles indebidamente. Tests por rol. |
| F1-03 Inicio e ingreso atómicos | P1 | F1-02 | L | Dos inicios simultáneos reparten exactamente siete por jugador una vez; ingreso concurrente no sobrepasa cupo ni crea asientos duplicados; fallos revierten todo. |
| F1-04 Mazo y motor común | P1 | F1-03 | L | Mazo+manos+descarte conservan 108 cartas y multiplicidades durante partidas largas; local/online coinciden para +2/+4, reversas, robo, dos jugadores y victoria numérica. |
| F1-05 Anuncio NEXO y sanción | P1 | F1-04 | L | Una carta permite anunciar; mano de otro tamaño no; duplicados no sancionan dos veces; anuncio/acuse concurrentes se resuelven sin estado parcial; casos de latencia 0/250/1000 ms y retorno inmediato de turno documentados. |
| F1-06 Snapshot y conteos | P1 | F1-04, F1-05 | M | Todos ven turno, contador, dirección y conteos de la misma versión; solo dueño recibe cartas. Reconectar no revierte versión ni duplica acción. |
| F1-07 Presencia y superficie social | P1 | F1-02, F1-06 | L | Heartbeat en lobby/tablero, desconexión/reingreso sin nuevo jugador; emisor social no suplantable; política explícita ante jugador ausente; límites servidor probados. |
| F1-08 Integración y regresión | P1 | F1-03 a F1-07 | L | Suites existentes y nuevas pasan; dos contextos Auth independientes completan partida en entorno aislado con pérdida de red, acción repetida y anuncio; sin bloqueadores P0/P1 de integridad abiertos. |

**Salida Fase 1:** motor documentado y estable, permisos probados, reglas alineadas, mazo consistente y flujo multijugador básico verificado. La revancha completa, los enlaces y la medición del embudo pertenecen a Fase 2; no declarar listo el lanzamiento al terminar únicamente Fase 1.

### Fase 2 — MVP público

| Tarea | Prioridad | Dependencias | Dificultad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| F2-01 Invitaciones y acceso rápido | P1 | F1-08 | M | Enlace/código/WhatsApp llevan a sala correcta, solicitan nombre y respetan privacidad; recorrido de usuario nuevo menor de 30 s en condiciones de prueba documentadas. |
| F2-02 Resultados, abandono y revancha | P1 | F1-08 | L | Duración, ganador, participantes y métricas reales; nueva ronda sin cartas/eventos mezclados; política de anfitrión y abandono probada. |
| F2-03 Opciones de sala | P1 | F1-04 | M | Configuración validada, visible para todos e inmutable tras iniciar; cliente no altera reglas en curso. |
| F2-04 Responsive, tutorial y accesibilidad | P1 | F1-08 | M | Flujo entero en Chromium/Firefox/WebKit y móvil físico; mano seleccionable, zoom/teclado/foco utilizables; tutorial coincide con reglas online. |
| F2-05 Analítica y operación | P1 | F2-02 | L | Eventos mínimos de juego sin duplicados, preferencias respetadas, panel protegido, logs sin secretos y errores observables; términos/privacidad/contacto aprobados, metadatos completos y checklist de despliegue ensayado. |

**Salida Fase 2:** crear → invitar → jugar → reconectar → terminar → revancha funciona entre usuarios independientes; no quedan bloqueadores públicos. Se entrega candidato de lanzamiento. Publicar producción requiere autorización adicional.

### Fase 3 — Experiencia premium

| Tarea | Prioridad | Dependencias | Dificultad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| F3-01 Mesa, efectos y sonido | P2 | Fase 2 | M | Contraataque distinguible con texto/dirección/contador, reparto y robos sincronizados; sonido opcional y movimiento reducido también en 3D. |
| F3-02 Rendimiento | P2 | F3-01 | M | Perfilar 2/4/8 jugadores; objetivo 60 FPS en equipo capaz identificado; fallback fluido en móvil definido; ciclos de entrada/salida sin crecimiento sostenido de recursos. |
| F3-03 Perfil y personalización persistente | P2 | Fase 2 | L | Invitado puede jugar sin cuenta; vinculación conserva progreso verificado; perfil mínimo e inventario solo del propietario. |

**Salida Fase 3:** calidad visual medida, controles de efectos y personalización persistente, sin alterar balance.

### Fase 4 — Monetización

| Tarea | Prioridad | Dependencias | Dificultad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| F4-01 Catálogo y demostración | P2 | F3-03 | M | Precios MXN configurables 29/59/99 como referencia; tienda rotulada demostración; no simula pagos confirmados. Solo cosméticos. |
| F4-02 Checkout/inventario en sandbox | P2 | F4-01 | L | Webhooks verificados, evento duplicado entrega una vez, fallo no concede artículo, cliente no modifica propiedad; pruebas de compra ajena y estados pendientes/fallidos. |
| F4-03 Preparación comercial | P2 | F4-02 | M | Configuración/credenciales revisadas, soporte y conciliación definidos; activar pagos reales requiere aprobación explícita. |

**Salida Fase 4:** comercio verificable en pruebas; ningún cobro real ni entrega basada solo en redirección del navegador.

### Fase 5 — Crecimiento

| Tarea | Prioridad | Dependencias | Dificultad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| F5-01 Resultados compartibles y estadísticas | P2 | F2-05, F3-03 | M | Tarjeta usa resultados de servidor; enlace vuelve al acceso al juego; métricas D1/D7/abandono calculadas desde eventos definidos. |
| F5-02 Momentos y recompensas | P2 | F5-01 | L | Eventos ordenados reconstruyen jugada con versión de reglas; recompensas cosméticas idempotentes; nunca exportar manos privadas sin política explícita. |
| F5-03 Modos sujetos a demanda | P2 | Evidencia de actividad y aprobación de producto | L | Caos aislado y probado por extensión; Clásico conserva comportamiento. Competitivo avanzado no se implementa antes de justificar actividad y operación. |

**Salida Fase 5:** adquisición/retención medibles y herramientas sociales verificadas; video complejo fuera del MVP.

## Riesgos y decisiones pendientes

1. **Estado remoto desconocido:** confirmar en entorno autorizado versiones desplegadas antes de planear una migración real; no asumir que SETUP_ALL describe producción.
2. **Reglas/latencia:** acordar robo posterior, ventana NEXO, acusación frente a sanción automática y abandono. Documentar escenarios, no cambiar mecánicas por accidente.
3. **Persistencia y concurrencia:** evitar escrituras parciales y mezcla de rondas; introducir nuevas tablas/columnas con compatibilidad y ensayo de recuperación.
4. **Escala/costo:** medir conexiones y consultas por partida antes de proyectar capacidad o costos. No hay mediciones para prometer escala.
5. **Marca y assets:** la UI ya usa NEXO, quedan nombres técnicos UNO y terminología «ÚLTIMA». Revisar identidad y procedencia de assets antes del lanzamiento, sin declarar conformidad legal desde esta auditoría.
6. **Privacidad/voz:** definir retención y autorización de mensajes, preferencias de analítica y eliminación de datos antes de publicar.
7. **Cambios locales previos:** integrar y validar tutorial/campaña sin sobrescribir trabajo del propietario.

## Registro de progreso

- [x] Auditoría del árbol actual y diagnóstico con evidencia.
- [x] Roadmap y arquitectura objetivo que conservan el stack.
- [x] Pruebas locales y build, con límites documentados.
- [x] Aprobación del diagnóstico y entrada a Fase 1.
- [ ] Cierre de Fase 1: implementación local avanzada; integración real y validación visual pendientes.
- [ ] Fases 2–5 según dependencias y validación.
