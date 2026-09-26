-- SHERE MUSIC — starter genres. Safe to re-run.
-- Genres are regular data: admins can rename or delete them from the dashboard.
insert into public.genres (name, slug, description) values
  ('Afrobeats',    'afrobeats',    'Contemporary West African pop, dancehall and hip-hop fusion.'),
  ('Afropop',      'afropop',      'Melodic African pop music.'),
  ('Hip-Hop',      'hip-hop',      'Rap, trap and hip-hop culture.'),
  ('R&B',          'r-and-b',      'Rhythm and blues, soul and neo-soul.'),
  ('Gospel',       'gospel',       'Praise, worship and inspirational music.'),
  ('Pop',          'pop',          'Mainstream pop from around the world.'),
  ('Dance',        'dance',        'Electronic, house and club music.'),
  ('Highlife',     'highlife',     'Classic and modern highlife.'),
  ('Amapiano',     'amapiano',     'South African log-drum house.'),
  ('Reggae',       'reggae',       'Reggae, dancehall and roots.'),
  ('Instrumental', 'instrumental', 'Beats and music without vocals.'),
  ('Other',        'other',        'Everything else.')
on conflict do nothing;
