# Islamic Quiz Web App

A ready-to-use, fast, accessible, and mobile-first Islamic Quiz web app, leveraging vanilla HTML/CSS/JavaScript (ES modules) with Supabase as the backend (auth + database + realtime).

## Features

- User registration/login, secure email/password with Supabase Auth
- Quiz questions stored in Supabase DB (realtime updates)
- User scores tracked per user
- Responsive, modern, and accessible UI
- Fast loading with pure CSS and ES modules
- Easily extensible for more questions/types

## Setup Instructions

### 1. Supabase Project

- [Create a Supabase project](https://app.supabase.com/)
- Go to **Project Settings > API** — copy your API URL and anon key

### 2. Database schema

- Go to **SQL Editor** and run the seed SQL below

```
-- Questions Table
create table public.questions (
  id serial primary key,
  question text not null,
  options text[] not null,
  answer integer not null        -- index in options array, starting at 0
);

-- Scores Table
create table public.scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null default 0
);
```

### 3. Seed Questions

You can run the following SQL or enter manually:

```
insert into public.questions (question, options, answer) values
('What is the first month of the Islamic calendar?', ARRAY['Muharram', 'Ramadan', 'Rajab', 'Dhul-Hijjah'], 0),
('Who was the last prophet in Islam?', ARRAY['Prophet Musa', 'Prophet Isa', 'Prophet Muhammad', 'Prophet Yusuf'], 2),
('What is the name of the holy book revealed to Prophet Muhammad?', ARRAY['Torah', 'Zabur', 'Injeel', 'Quran'], 3),
('How many daily prayers are obligatory?', ARRAY['Three', 'Four', 'Five', 'Ten'], 2),
('In Ramadan, Muslims fast from?', ARRAY['Morning to Evening', 'Sunrise to Sunset', 'Fajr to Maghrib', 'Dhuhr to Isha'], 2);
```

### 4. Configure Client

- In `supabase.js`, **replace** these lines with your project details:
  ```js
  export const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
  export const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
  ```
- Host all files in the same directory (or use a local server)

### 5. Run Locally

- Just open `index.html` in your browser, or use a simple server (`npx serve .`, Python SimpleHTTPServer, etc.)

### 6. Add more questions

- Use Supabase dashboard or add to the questions table via the SQL editor.

## Customization & Production

- Easily reskin via `style.css`.
- You can deploy this as a static site (Netlify, Vercel, Cloudflare Pages) if you provide your domain in Supabase dashboard Auth settings.

## Accessibility & Responsive Design

- WCAG-compliant color, contrast, and focus management.
- Buttons large/tappable, aria-roles, semantic elements.

## License

MIT. Use freely and modify for your needs.
