# Chess

Juego y plataforma de ajedrez en el navegador (HTML/CSS/JS puro, sin dependencias ni backend).

## Idea del proyecto

- **Jugar una partida completa** de a dos personas en la misma compu (hotseat), y a futuro **contra una IA con dificultad ajustable**.
- **Practicar aperturas**: cada apertura (y sus variantes/líneas) vive en su propio archivo dentro de `Openings/`. Se cargan en el tablero y se pueden practicar movida a movida, con pistas.
  - Tanto **aperturas jugando de blancas** como **defensas jugando de negras** (hoy solo está armado el modo "blancas": el rival automático responde con las jugadas de negras de la línea).
- **Barra de evaluación**: mostrar en todo momento quién está mejor según un motor de ajedrez. Motor todavía sin decidir (evaluar integrar uno existente, tipo Stockfish compilado a WASM, vs. escribir uno propio simple).

## Estado actual (que ya funciona)

- Motor de reglas completo en `chess.js`: movimientos legales de las 6 piezas, enroque, al paso, promoción, jaque/jaque mate/ahogado, notación SAN, historial de jugadas, deshacer jugada, captura de piezas.
- Tablero interactivo (click para mover), flip de tablero, modal de promoción.
- Selector de estilo: 4 sets de piezas (`Pieces/Classic`, `Normal`, `Neo`, `Techno`) y 6 temas de tablero.
- Modo repertorio: elegís una apertura y una línea, jugás las blancas y el rival (negras) responde automático según la línea cargada; avisa si te equivocás de jugada y te muestra pistas.
- Aperturas cargadas: King's Gambit, Queen's Gambit Accepted, Queen's Gambit Declined.

## Lo que falta

- **IA rival** (para jugar solo, no solo para repertorio) con niveles de dificultad ajustables. Hoy no existe ningún motor/heurística de juego, solo el reproductor de líneas guardadas.
- **Practicar de negras**: el modo repertorio solo soporta líneas donde el usuario juega blancas. Falta soportar líneas donde el usuario juega negras (defensas) y el motor responda con blancas.
- **Barra de evaluación**: no existe todavía ni la UI ni la lógica. Falta elegir el motor (propio o de terceros) e integrarlo.
- **Ruy Lopez** (`Openings/ruy_lopez.js`): el archivo existe pero está vacío, y tampoco está enchufado en el objeto `Openings` de `chess.js`.
- **Traxler Counterattack** (`Traxler_Counterattack_parsed.js`): datos ya parseados (53 KB) pero el archivo no se carga desde `Chessreps.html` ni está agregado a `Openings`.
- Formato de línea actual (`White Moves` / `Black Moves` / `Clues`) asume una sola secuencia lineal; si se quieren "columnas"/variantes que se ramifican dentro de una misma apertura, hay que pensar una estructura de árbol en vez de listas planas.
- `info/info.txt`: dump crudo scrapeado de chessreps.com (cursos de otros usuarios) para tomar de referencia; no es dato propio del proyecto todavía.
