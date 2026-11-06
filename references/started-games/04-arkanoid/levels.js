// Niveles: cada string es una fila de 10 columnas (máx. 10 caracteres).
// R red, Y yellow, C cyan, M magenta, P hotpink, G green; '.' = hueco.
const BRICK_COLORS = { R: 'red', Y: 'yellow', C: 'cyan', M: 'magenta', P: 'hotpink', G: 'green' };

const LEVELS = [
  [ // Nivel 1: filas completas
    'RRRRRRRRRR',
    'YYYYYYYYYY',
    'CCCCCCCCCC',
    'MMMMMMMMMM',
    'PPPPPPPPPP',
    'GGGGGGGGGG',
  ],
  [ // Nivel 2: ajedrez
    'R.R.R.R.R.',
    '.Y.Y.Y.Y.Y',
    'C.C.C.C.C.',
    '.M.M.M.M.M',
    'P.P.P.P.P.',
    '.G.G.G.G.G',
  ],
  [ // Nivel 3: marco con bloque central
    'RRRRRRRRRR',
    'Y........Y',
    'C..CCCC..C',
    'M..MMMM..M',
    'P........P',
    'GGGGGGGGGG',
  ],
];
