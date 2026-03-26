# Estado del Proyecto — UNO Online

Última actualización: 2026-03-26 (sesión 3)

## Estado general
🟢 En producción — https://unoreglaseuropeas.com/

## Por agente

| Agente | Estado | Tarea actual | Bloqueadores |
|--------|--------|--------------|--------------|
| UX/UI | 🟢 | Wireframes + estados de efectos completos | — |
| Backend | 🟢 | Schema + RLS + Edge Functions + matchmaking SQL | — |
| Frontend | 🟢 | Home completo: reglas, matchmaking, salas públicas/privadas | — |
| Fullstack | 🟢 | Reglas europeas integradas: penalización 4c, victoria solo números | — |
| Tester | 🟡 | Validar nuevas reglas E2E en producción | — |
| Deploy | 🟢 | Netlify + dominio unoreglaseuropeas.com activo | — |

## Hitos

- [x] Brief aprobado
- [x] Wireframes completados (UX/UI) — 11 pantallas + 5 estados de efectos
- [x] Schema Supabase creado con RLS (Backend)
- [x] Edge Functions: start-game, play-card, draw-card, call-uno, penalize-uno
- [x] Lógica de juego pura: deck.ts, rules.ts (Frontend)
- [x] Sistema de salas con código de 6 chars (Frontend + Supabase)
- [x] Turnos en tiempo real via Supabase Realtime (Frontend + Supabase)
- [x] Layouts adaptativos: 2p / 3-6p / 7-8p (Frontend)
- [x] Flujo de ganador: winner_id → navega a GameOver con datos correctos
- [x] Penalización UNO: **4 cartas** (regla europea) — actualizado desde 2
- [x] Regla victoria solo número: cartas especiales bloqueadas como jugada final
- [x] Validación call-uno: solo cuando tienes exactamente 1 carta
- [x] PWA icons (icon-192.svg, icon-512.svg) — manifest actualizado
- [x] Reconexión de jugadores — App.tsx detecta estado y navega a board/lobby/home
- [x] Error boundary en Board — crashes de Realtime atrapados, vuelve a Home
- [x] Deploy Edge Functions a Supabase cloud (5 funciones desplegadas)
- [x] Deploy frontend a Netlify — dominio unoreglaseuropeas.com activo
- [x] **Matchmaking**: botón "Buscar Partida" — une a sala pública o crea una nueva
- [x] **Salas públicas/privadas**: toggle al crear + contraseña opcional para privadas
- [x] **Modal de reglas**: botón "? Reglas" en Home con todas las reglas del juego
- [x] **Migration 007**: `is_private`, `password_hash`, `find_public_room()`, `join_room()` con password
- [ ] Animaciones: carta jugada + penalidad apilada (pulir)
- [ ] Tests E2E en producción (Tester)

## Próximos pasos inmediatos

1. **Ejecutar migration 007** en Supabase Dashboard o via CLI:
   ```bash
   supabase db push  # o pegar 007_matchmaking.sql en el SQL Editor
   ```
2. **Redesplegar Edge Function penalize-uno** (penalidad cambiada a 4 cartas):
   ```bash
   supabase functions deploy penalize-uno
   ```
3. **Test E2E**: verificar flujo completo en https://unoreglaseuropeas.com/
   - Buscar partida → entrar a sala pública
   - Crear sala privada con contraseña → unirse con contraseña
   - Intentar ganar con carta especial → debe bloquearse
   - Penalización UNO → verificar que da 4 cartas

## Reglas europeas implementadas

| Regla | Estado |
|-------|--------|
| Penalización UNO: 4 cartas | ✅ |
| Solo ganar con carta número (0–9) | ✅ |
| Stacking +2/+4 | ✅ |
| Reversa como contraataque de stack | ✅ |

## Pantallas implementadas

1. ✅ Home — buscar partida / crear sala (pública o privada) / unirse con código
2. ✅ Sala de espera — jugadores conectados, botón de inicio (solo host)
3. ✅ Tablero de juego — mano, carta actual, mazo, oponentes, efecto overlays
4. ✅ Selector de color — overlay para Wild cards
5. ✅ Fin de partida — ganador, puntuaciones, revancha

## URLs de producción

- **Frontend**: https://unoreglaseuropeas.com/
- **Deploy**: Netlify (desde GitHub)
