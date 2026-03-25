# Brief del Proyecto: UNO Online

## Descripción
Juego de cartas UNO multijugador en tiempo real, construido como Progressive Web App (PWA).
Los jugadores pueden crear salas o unirse con códigos de 6 caracteres y jugar en tiempo real.

## Usuarios objetivo
- Grupos de amigos (2-8 jugadores) que quieren jugar UNO online
- Jugadores móviles (PWA instalable)
- Jugadores que pueden reconectarse si pierden conexión

## Tech Stack (definido — sobreescribe shared/stack.md)
- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Realtime) — NO backend propio Node.js
- **Estado**: React Hooks
- **Icons**: Lucide React
- **Deploy**: Netlify (frontend estático) + Supabase (hosted)

## Funcionalidades principales
1. Soporte para 2-8 jugadores con layouts adaptativos
2. Sincronización en tiempo real via Supabase Realtime
3. Reglas completas de UNO con stacking de +2/+4
4. Sistema de salas con código de 6 caracteres
5. Reconexión automática si se pierde conexión
6. PWA instalable en móvil

## Cartas especiales
- Número, Skip, Reverse, +2, Wild, Wild +4
- Stacking: +2 y +4 se pueden apilar entre sí

## Layouts adaptativos
- 2 jugadores: cara a cara
- 3+ jugadores: disposición circular
- 7-8 jugadores: vista compacta

## Schema de base de datos (Supabase)
| Tabla | Descripción | Seguridad |
|-------|-------------|-----------|
| `rooms` | Info de sala y estado del juego | RLS |
| `players` | Datos del jugador y estado de conexión | RLS |
| `hands` | Cartas privadas por jugador | RLS — solo el dueño |
| `game_state` | Estado actual con versioning | RLS |
| `events` | Log de acciones del juego | RLS |

## Game Engine (archivos de lógica pura)
- `deck.ts` — creación y barajado del mazo
- `rules.ts` — validación de jugadas
- `engine.ts` — gestión del estado del juego

## Variables de entorno necesarias
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Flujos de usuario críticos
1. **Crear sala**: jugador crea sala → recibe código de 6 chars → espera jugadores
2. **Unirse a sala**: jugador ingresa código → entra a sala → espera inicio
3. **Partida completa**: repartir 7 cartas → turnos en tiempo real → ganar/perder
4. **Reconexión**: jugador pierde conexión → reconecta → retoma su mano

## Seguridad
- RLS en todas las tablas
- Datos de mano privados por jugador (solo el dueño puede leer su hand)
- Optimistic locking con versionado de estado del juego
- Heartbeat para presencia de jugadores

## Futuras mejoras (fuera de scope)
Bots/IA, replays, leaderboard, chat, sonidos, modo torneo
