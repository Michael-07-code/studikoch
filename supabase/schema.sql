-- StudiKoch – Supabase-Datenbankschema
--
-- So richtest du es ein:
-- 1. Erstelle ein kostenloses Projekt auf https://supabase.com.
-- 2. Öffne im Supabase-Dashboard den "SQL Editor" und füge den kompletten
--    Inhalt dieser Datei ein, dann "Run" klicken.
-- 3. Unter Project Settings -> API findest du "Project URL" und den
--    "anon public"-Key – die trägst du in deine .env.local ein (siehe
--    .env.example).
-- 4. Unter Authentication -> Providers ist "Email" standardmäßig aktiv –
--    das reicht für den E-Mail+Passwort-Login dieser App. Unter
--    Authentication -> Settings kannst du "Confirm email" ausschalten,
--    wenn du ohne Bestätigungs-Mail sofort loslegen willst (für den
--    privaten Gebrauch unproblematisch).
--
-- Jede Tabelle gehört über "user_id" einem einzelnen Nutzer-Account
-- (auth.users). Row Level Security (RLS) sorgt dafür, dass jeder Account
-- ausschließlich seine eigenen Zeilen sehen/ändern kann – selbst wenn
-- später mehrere Personen dieselbe Supabase-Instanz nutzen.
--
-- Hinweis: Dieses Skript ist für ein einmaliges Ausführen auf einem
-- FRISCHEN Projekt gedacht ("create table if not exists" verträgt ein
-- erneutes Ausführen, die "create policy"-Befehle am Ende aber nicht –
-- die würden beim zweiten Mal mit "already exists" fehlschlagen).

-- ---------------------------------------------------------------------
-- Utensilien, Öfen & Herde, Zutaten (siehe src/features/inventory)
-- ---------------------------------------------------------------------
create table if not exists utensils (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists appliances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  unit text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Einkaufsliste & Supermärkte (siehe src/features/shopping-list)
-- ---------------------------------------------------------------------
create table if not exists supermarkets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric,
  unit text,
  price numeric,
  supermarket_id uuid references supermarkets(id) on delete set null,
  checked boolean not null default false,
  category text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Gespeicherte Rezepte & eigene Listen (siehe src/features/recipes)
-- ---------------------------------------------------------------------
create table if not exists recipe_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Ursprüngliche TheMealDB-/Spoonacular-ID (z. B. "52772" oder "sp-632660").
  recipe_id text not null,
  -- Vollständiges, bereits übersetztes Rezept-Objekt (Recipe-Typ als JSON).
  recipe jsonb not null,
  saved_at timestamptz not null default now(),
  list_ids uuid[] not null default '{}',
  meal_type text not null default 'sonstiges',
  prep_time_minutes numeric,
  estimated_cost_euro numeric,
  unique (user_id, recipe_id)
);

-- ---------------------------------------------------------------------
-- Ein Sammel-Datensatz pro Nutzer für die restlichen, kleinen
-- Einstellungs-"Blobs" (bisher je ein eigener localStorage-Key):
-- Preisbuch, Rezept-Einstellungen, Budget-Einstellungen, Wochenplan.
-- ---------------------------------------------------------------------
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  price_book jsonb not null default '{}'::jsonb,
  recipe_preferences jsonb,
  budget_settings jsonb,
  weekly_plan jsonb,
  -- Kleine Verhaltens-Einstellungen (z. B. "beim Speichern nach Mahlzeit
  -- fragen?", bevorzugter Supermarkt) – freies JSON für künftige Erweiterung.
  app_settings jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Dauerhafter, geräteübergreifender Rezept-Cache (siehe
-- src/features/recipes/spoonacular.ts). Keine user_id: Rezeptinhalte von
-- Spoonacular sind öffentliche, nicht-persönliche Daten – ein einziger
-- geteilter Cache für den ganzen Account (und alle Geräte) ist hier
-- sinnvoller als eine Kopie pro Nutzer.
-- ---------------------------------------------------------------------
create table if not exists recipe_cache (
  recipe_id text primary key,
  recipe jsonb not null,
  cached_at timestamptz not null default now()
);

create table if not exists ingredient_query_cache (
  query_key text primary key,
  results jsonb not null,
  cached_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security: jeder Account sieht/ändert nur seine eigenen Zeilen.
-- ---------------------------------------------------------------------
alter table utensils enable row level security;
alter table appliances enable row level security;
alter table ingredients enable row level security;
alter table supermarkets enable row level security;
alter table shopping_list_items enable row level security;
alter table recipe_lists enable row level security;
alter table saved_recipes enable row level security;
alter table user_settings enable row level security;
alter table recipe_cache enable row level security;
alter table ingredient_query_cache enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'utensils', 'appliances', 'ingredients', 'supermarkets',
    'shopping_list_items', 'recipe_lists', 'saved_recipes'
  ])
  loop
    execute format(
      'create policy "select own" on %I for select using (auth.uid() = user_id);',
      t
    );
    execute format(
      'create policy "insert own" on %I for insert with check (auth.uid() = user_id);',
      t
    );
    execute format(
      'create policy "update own" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
    execute format(
      'create policy "delete own" on %I for delete using (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;

-- user_settings hat keine insert-Policy über den Client nötig, da wir
-- ausschließlich per "upsert" (insert ... on conflict update) schreiben.
create policy "select own settings" on user_settings
  for select using (auth.uid() = user_id);
create policy "upsert own settings" on user_settings
  for insert with check (auth.uid() = user_id);
create policy "update own settings" on user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Geteilter Rezept-Cache: jeder eingeloggte Account darf lesen/schreiben
-- (keine persönlichen Daten, siehe Kommentar bei der Tabellendefinition).
create policy "authenticated read/write" on recipe_cache
  for select using (auth.uid() is not null);
create policy "authenticated insert" on recipe_cache
  for insert with check (auth.uid() is not null);
create policy "authenticated update" on recipe_cache
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated read/write" on ingredient_query_cache
  for select using (auth.uid() is not null);
create policy "authenticated insert" on ingredient_query_cache
  for insert with check (auth.uid() is not null);
create policy "authenticated update" on ingredient_query_cache
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
