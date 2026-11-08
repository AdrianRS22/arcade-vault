-- Seed: SNAKE (SPEC 10)
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'snake',
  'SNAKE',
  'Eat the fruit, grow longer, never bite yourself.',
  'Steer a neon snake around the grid and eat the fruit to grow. Every five fruits the game speeds up, and a bonus fruit sometimes appears for a few seconds. Hit a wall or your own tail and the run is over.',
  'ARCADE',
  'cover-snake',
  'green',
  0,
  3
);
