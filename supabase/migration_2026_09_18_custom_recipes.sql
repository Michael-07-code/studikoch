-- StudiKoch – Migration (18.09.2026): eigene Rezepte mit Bild-Upload
--
-- Führe das im Supabase-Dashboard unter "SQL Editor" -> "Run" aus. Sicher
-- auf einer bereits bestehenden Datenbank ausführbar (alles mit
-- "if not exists"/"on conflict do nothing").
--
-- Eigene Rezepte selbst brauchen KEINE neue Tabelle – sie werden ganz
-- normal wie jedes andere Rezept in der bereits vorhandenen Tabelle
-- "saved_recipes" gespeichert (siehe useSavedRecipes.ts), nur mit einer
-- eigenen ID (Präfix "custom-" statt "sp-" oder einer TheMealDB-Zahl) und
-- einem Bild, das hier in Supabase Storage liegt statt bei Spoonacular/
-- TheMealDB.
--
-- Dieses Skript legt dafür einen neuen Storage-"Bucket" (Ordner für
-- Dateien) namens "recipe-images" an, öffentlich lesbar (damit die Bilder
-- direkt per <img src="..."> angezeigt werden können, ohne eigenen
-- Server), aber nur für den jeweils eigenen Account beschreibbar (jede/r
-- Nutzer:in lädt Bilder nur in einen Ordner mit der eigenen Nutzer-ID
-- hoch, siehe CustomRecipeForm.tsx).

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'recipe images: public read'
  ) then
    create policy "recipe images: public read" on storage.objects
      for select using (bucket_id = 'recipe-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'recipe images: own folder insert'
  ) then
    create policy "recipe images: own folder insert" on storage.objects
      for insert with check (
        bucket_id = 'recipe-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'recipe images: own folder update'
  ) then
    create policy "recipe images: own folder update" on storage.objects
      for update using (
        bucket_id = 'recipe-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'recipe images: own folder delete'
  ) then
    create policy "recipe images: own folder delete" on storage.objects
      for delete using (
        bucket_id = 'recipe-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
