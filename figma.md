# Referencias de Figma — UNO Online

## Archivo principal
- Nombre en Figma: Preguntas (archivo actual del usuario)
- Página activa: `UNO Online - UX/UI`

## Páginas
| Página | Descripción |
|--------|-------------|
| `UNO Online - UX/UI` | Wireframes de las 5 pantallas principales |

## Pantallas principales (nodeIds)
> Los nodeIds son específicos de la sesión. Re-verificar con figma_execute si cambian.

| Pantalla | NodeId | Descripción |
|----------|--------|-------------|
| 1. Home | `17:738` | Crear sala / unirse con código |
| 2. Sala de Espera | `17:762` | Jugadores conectados, botón de inicio |
| 3. Tablero de Juego | `17:790` | Mano del jugador, carta actual, oponentes |
| 4. Selector de Color | `17:835` | Overlay modal para Wild cards |
| 5. Fin de Partida | `17:853` | Ganador, stats, revancha |

## Design System usado en los wireframes
| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#0F1923` | Fondo principal |
| `surface` | `#1C2A38` | Paneles y tarjetas UI |
| `red` | `#DC2626` | Cartas rojas / botón crear sala |
| `blue` | `#2563EB` | Cartas azules |
| `green` | `#16A34A` | Cartas verdes / botón iniciar |
| `yellow` | `#EAB308` | Cartas amarillas / código de sala / ganador |
| `gray` | `#8CA1B3` | Textos secundarios |

## Design Tokens
- Archivo: `design-tokens/tokens.json`
- Última actualización: 2026-03-24

## Tableros por número de jugadores (nodeIds)

| Pantalla | NodeId | Jugadores |
|----------|--------|-----------|
| Tablero — 3 Jugadores | `17:898` | 1 arriba, 1 derecha |
| Tablero — 4 Jugadores | `17:935` | 1 arriba, 1 izq, 1 der |
| Tablero — 5 Jugadores | `17:979` | 2 arriba, 1 izq, 1 der |
| Tablero — 6 Jugadores | `17:1031` | 3 arriba, 1 izq, 1 der |
| Tablero — 7 Jugadores | `17:1090` | 3 arriba (compact), 2 izq, 2 der |
| Tablero — 8 Jugadores | `17:1160` | 3 arriba, 2 izq, 2 der, 1 abajo |

## Layouts a implementar en Frontend
- **2 jugadores**: cara a cara (arriba / abajo)
- **3-6 jugadores**: circular (pantalla 3 muestra versión de 4 jugadores)
- **7-8 jugadores**: vista compacta (manos reducidas)

## Notas para el agente Frontend
- Tablero usa fondo verde oscuro `#0D2E1E` para simular mesa de juego
- Las cartas del oponente siempre boca abajo (`surface2: #28384A`)
- El botón UNO va en la esquina inferior derecha, color amarillo
- El modal de selector de color usa overlay oscuro 75% opacidad
