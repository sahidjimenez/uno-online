# Backend — UNO Online

## Stack
Supabase (PostgreSQL + Realtime + Auth anónimo). No hay servidor Node.js propio.

## Estructura

```
backend/
└── supabase/
    ├── migrations/
    │   ├── 001_schema.sql     ← Tablas y tipos
    │   ├── 002_rls.sql        ← Row Level Security
    │   ├── 003_functions.sql  ← RPC helpers (create_room, join_room, etc.)
    │   └── 004_realtime.sql   ← Publicaciones de Realtime
    └── seed.sql               ← Datos de prueba para desarrollo local
```

## Setup y Testing E2E

El proyecto apunta a un proyecto Supabase cloud (ver `frontend/.env`).

### Primera vez (deploy completo)

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Vincular al proyecto cloud
cd backend
supabase login
supabase link --project-ref qldsodvsbyqnraqurawp

# 3. Aplicar migraciones al proyecto cloud
supabase db push

# 4. Desplegar todas las Edge Functions
supabase functions deploy start-game
supabase functions deploy play-card
supabase functions deploy draw-card
supabase functions deploy call-uno
supabase functions deploy penalize-uno
```

### Correr el frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Prueba E2E manual (2 jugadores mínimo)

1. Abrir 2 pestañas (o 2 navegadores distintos)
2. Pestaña 1: crear sala → anotar el código de 6 letras
3. Pestaña 2: unirse con ese código
4. Pestaña 1 (host): click "Iniciar partida"
5. Verificar que ambas pestañas muestran el tablero
6. Jugar turnos alternados, verificar:
   - Solo el jugador activo puede jugar cartas
   - Skip/Reverse/+2/+4 tienen efecto correcto
   - Stacking de +2/+4 funciona
   - Botón "¡UNO!" aparece al llegar a 1 carta
   - Al vaciar la mano → navega a GameOver con el ganador correcto
   - Si un jugador tiene 1 carta sin cantar UNO → el otro puede penalizarlo

### Setup local (alternativo)

```bash
# Requiere Docker
supabase start
# Usar URL local: http://localhost:54321
# Actualizar frontend/.env con la anon key que muestra `supabase status`
supabase db reset   # aplica migraciones + seed
supabase functions serve  # sirve Edge Functions localmente
```

## Variables de entorno
Copiar en `frontend/.env`:
```
VITE_SUPABASE_URL=https://qldsodvsbyqnraqurawp.supabase.co   # cloud
VITE_SUPABASE_ANON_KEY=<anon key del dashboard>
```

## Schema de tablas

### `rooms`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `code` | CHAR(6) | Código único de sala (ej: A7F3K2) |
| `status` | ENUM | `waiting` / `playing` / `finished` |
| `host_id` | UUID → players | FK al jugador host |
| `max_players` | SMALLINT | 2–8 |

### `players`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `room_id` | UUID → rooms | FK a la sala |
| `user_id` | UUID | `auth.uid()` — sesión anónima de Supabase |
| `name` | VARCHAR(30) | Nombre de pantalla |
| `seat_order` | SMALLINT | Posición en la mesa (0-7) |
| `is_connected` | BOOLEAN | Estado de conexión |
| `last_heartbeat` | TIMESTAMPTZ | Último ping (cada 10s) |
| `has_called_uno` | BOOLEAN | Si el jugador cantó UNO |

### `hands` ⚠️ privada
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `player_id` | UUID → players | FK al jugador dueño |
| `card_color` | ENUM | `red/blue/green/yellow/wild` |
| `card_type` | ENUM | `0-9/skip/reverse/draw2/wild/wild4` |

> RLS garantiza que cada jugador solo lea sus propias cartas.
> Las cartas se insertan/eliminan solo via `service_role` (Edge Functions).

### `game_state`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `room_id` | UUID | UK → rooms |
| `version` | INTEGER | Versión para optimistic locking |
| `current_player_id` | UUID → players | De quién es el turno |
| `direction` | SMALLINT | `1` horario / `-1` antihorario |
| `current_color` | ENUM | Color activo (distinto al top_card en Wild) |
| `top_card_color` | ENUM | Color de la carta visible en descarte |
| `top_card_type` | ENUM | Tipo de la carta visible |
| `draw_stack` | SMALLINT | Penalidad acumulada (+2/+4 apilados) |
| `draw_pile_count` | SMALLINT | Cartas restantes en el mazo |

### `events`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `type` | ENUM | Tipo de evento |
| `payload` | JSONB | Datos del evento |
| `version` | INTEGER | Versión del game_state al momento del evento |

## Funciones RPC

| Función | Descripción |
|---------|-------------|
| `create_room(name)` | Crea sala + jugador host atómicamente. Retorna `room_id, room_code, player_id` |
| `join_room(code, name)` | Unirse a sala por código. Retorna `room_id, player_id, seat_order` |
| `heartbeat(player_id)` | Actualiza `last_heartbeat`. Llamar cada 10s |
| `reconnect_player(code)` | Reconectar al mismo `auth.uid()` a su sala |
| `mark_disconnected()` | Marca players sin heartbeat >15s como desconectados |

## Flujo Realtime (Frontend)

```
1. Frontend suscribe a:
   - rooms         → cambios de status (waiting → playing → finished)
   - players       → conexiones/desconexiones, has_called_uno
   - game_state    → versión, turno, color activo, draw_stack
   - events        → feed de acciones para animaciones

2. Cuando llega event 'card_played' o 'card_drawn':
   → Frontend hace SELECT en hands WHERE player_id = yo
   → Nunca recibe cartas de otros jugadores por RLS

3. Optimistic locking:
   → Frontend siempre envía el `version` actual
   → Si el server tiene version > version enviada → rechaza y resincroniza
```

## Seguridad RLS — resumen

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| rooms | todos | auth | solo host | — |
| players | misma sala | solo yo | solo yo | — |
| hands | solo yo | ❌ clientes | — | ❌ clientes |
| game_state | misma sala | ❌ clientes | ❌ clientes | — |
| events | misma sala | ❌ clientes | — | — |

`hands`, `game_state` y `events` solo se escriben via Edge Functions con `service_role`.
