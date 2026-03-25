# Estado del Proyecto — UNO Online

Última actualización: 2026-03-25 (sesión 2)

## Estado general
🟡 Listo para deploy y testing E2E

## Por agente

| Agente | Estado | Tarea actual | Bloqueadores |
|--------|--------|--------------|--------------|
| UX/UI | 🟢 | Wireframes + estados de efectos completos | — |
| Backend | 🟢 | Schema + RLS + Edge Functions (start-game, play-card, draw-card, call-uno, penalize-uno) | — |
| Frontend | 🟢 | Estructura completa — componentes, páginas, engine, hooks | — |
| Fullstack | 🟡 | Integración ganador + penalización UNO | Pendiente deploy E2E |
| Tester | 🔴 | — | Necesita deploy E2E |
| Deploy | 🔴 | — | Pendiente testing |

## Hitos

- [x] Brief aprobado
- [x] Wireframes completados (UX/UI) — 11 pantallas + 5 estados de efectos
- [ ] Design tokens exportados (UX/UI)
- [x] Schema Supabase creado con RLS (Backend)
- [x] Edge Functions: start-game, play-card, draw-card, call-uno, penalize-uno
- [x] Lógica de juego pura: deck.ts, rules.ts (Frontend)
- [x] Sistema de salas con código de 6 chars (Frontend + Supabase)
- [x] Turnos en tiempo real via Supabase Realtime (Frontend + Supabase)
- [x] Layouts adaptativos: 2p / 3-6p / 7-8p (Frontend)
- [x] Flujo de ganador: winner_id → navega a GameOver con datos correctos
- [x] Penalización UNO: catch de jugadores sin UNO cantado (2 cartas de penalidad)
- [x] Validación call-uno: solo cuando tienes exactamente 1 carta
- [ ] Animaciones: carta jugada + penalidad apilada (pulir)
- [x] PWA icons (icon-192.svg, icon-512.svg) — manifest actualizado
- [x] Reconexión de jugadores — App.tsx detecta estado y navega a board/lobby/home
- [x] Error boundary en Board — crashes de Realtime atrapados, vuelve a Home
- [ ] Deploy Edge Functions a Supabase cloud (`supabase functions deploy`)
- [ ] Tests E2E aprobados (Tester)
- [ ] Deploy frontend a Netlify (Deploy)

## Próximos pasos inmediatos

1. **Deploy Edge Functions**: `supabase functions deploy` para cada función (ver backend/README.md)
2. **Test E2E**: Abrir 2 pestañas, crear sala, jugar hasta el fin — verificar flujo completo
3. **Animaciones** (opcional): pulir timing de EffectOverlay con CSS transitions

## Pantallas implementadas

1. ✅ Home — crear sala / unirse con código
2. ✅ Sala de espera — jugadores conectados, botón de inicio (solo host)
3. ✅ Tablero de juego — mano, carta actual, mazo, oponentes, efecto overlays
4. ✅ Selector de color — overlay para Wild cards
5. ✅ Fin de partida — ganador, puntuaciones, revancha
