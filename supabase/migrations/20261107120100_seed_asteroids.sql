-- SPEC 07: the only real game in the catalog. No scores are seeded.
insert into public.games (id, title, short, long, category, cover, color, plays, sort_order)
values (
  'asteroids',
  'ASTEROIDS',
  'Split asteroids in zero gravity.',
  'Your triangular ship floats in absolute vacuum. Rotate, thrust and shoot to split big rocks into ever smaller fragments. Grab the triple shot, or save a Nova bomb to wipe the whole field.',
  'SHOOTER',
  'cover-rocas',
  'yellow',
  0,
  0
);
