-- Database schema and sample data for Supabase Islamic Quiz

-- Table for questions
create table public.questions (
  id serial primary key,
  question text not null,
  options text[] not null,
  answer integer not null
);

-- Table for user scores
create table public.scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null default 0
);

-- Seed questions
insert into public.questions (question, options, answer) values
('What is the first month of the Islamic calendar?', ARRAY['Muharram', 'Ramadan', 'Rajab', 'Dhul-Hijjah'], 0),
('Who was the last prophet in Islam?', ARRAY['Prophet Musa', 'Prophet Isa', 'Prophet Muhammad', 'Prophet Yusuf'], 2),
('What is the name of the holy book revealed to Prophet Muhammad?', ARRAY['Torah', 'Zabur', 'Injeel', 'Quran'], 3),
('How many daily prayers are obligatory?', ARRAY['Three', 'Four', 'Five', 'Ten'], 2),
('In Ramadan, Muslims fast from?', ARRAY['Morning to Evening', 'Sunrise to Sunset', 'Fajr to Maghrib', 'Dhuhr to Isha'], 2);