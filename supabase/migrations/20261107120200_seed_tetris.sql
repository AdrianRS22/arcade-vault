-- Seed: TETRIS (SPEC 08)
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'tetris',
  'TETRIS',
  'Stack falling blocks and clear lines.',
  'Rotate and drop the falling pieces to complete rows before the stack reaches the top. The game speeds up every 10 lines, and every 5 lines a power-up piece arrives: bomb, lightning, tint, gravity or freeze.',
  'PUZZLE',
  'cover-tetro',
  'cyan',
  0,
  1
);
