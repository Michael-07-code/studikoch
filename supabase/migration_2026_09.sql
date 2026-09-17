-- StudiKoch – Migration (September 2026)
--
-- Führe das hier im Supabase-Dashboard unter "SQL Editor" -> "Run" aus.
-- Im Unterschied zu schema.sql ist das hier sicher auf einer bereits
-- bestehenden Datenbank ausführbar (alles mit "if not exists").
--
-- Enthält:
-- 1. Dauerhafter, geräteübergreifender Rezept-Cache (spart Spoonacular-
--    Kontingent: jedes abgefragte Rezept wird nur noch einmal für immer
--    geladen, nicht pro Gerät/Browser neu).
-- 2. Eine Spalte "app_settings" für kleine Verhaltens-Einstellungen (z. B.
--    "beim Speichern nach Mahlzeit fragen?", bevorzugter Supermarkt).

-- ---------------------------------------------------------------------
-- Dauerhafter Rezept-Cache. Keine user_id: Rezeptinhalte von Spoonacular
-- sind öffentliche, nicht-persönliche Daten – ein einziger geteilter
-- Cache für den ganzen Account (und alle Geräte) ist hier sinnvoller als
-- eine Kopie pro Nutzer.
-- ---------------------------------------------------------------------
create table if not exists recipe_cache (
  recipe_id text primary key,
  recipe jsonb not null,
  cached_at timestamptz not null default now()
);

-- Cache für "Was kann ich kochen?"/"Was muss weg?"-Suchergebnisse
-- (findByIngredients), Schlüssel = normalisierte Zutatenliste + Parameter.
create table if not exists ingredient_query_cache (
  query_key text primary key,
  results jsonb not null,
  cached_at timestamptz not null default now()
);

alter table recipe_cache enable row level security;
alter table ingredient_query_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'recipe_cache' and policyname = 'authenticated read/write'
  ) then
    create policy "authenticated read/write" on recipe_cache
      for select using (auth.uid() is not null);
    create policy "authenticated insert" on recipe_cache
      for insert with check (auth.uid() is not null);
    create policy "authenticated update" on recipe_cache
      for update using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'ingredient_query_cache' and policyname = 'authenticated read/write'
  ) then
    create policy "authenticated read/write" on ingredient_query_cache
      for select using (auth.uid() is not null);
    create policy "authenticated insert" on ingredient_query_cache
      for insert with check (auth.uid() is not null);
    create policy "authenticated update" on ingredient_query_cache
      for update using (auth.uid() is not null) with check (auth.uid() is not null);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Neue Einstellungs-Spalte: ob beim Speichern eines Rezepts gleich nach
-- der Mahlzeit gefragt wird, und der bevorzugte Supermarkt für die
-- Einkaufsliste. Freies JSON, damit künftige kleine Einstellungen ohne
-- weitere Migration dazukommen können.
-- ---------------------------------------------------------------------
alter table user_settings add column if not exists app_settings jsonb;
