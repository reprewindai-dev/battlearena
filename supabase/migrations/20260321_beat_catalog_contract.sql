begin;

alter table public.beats
  add column if not exists slug text,
  add column if not exists producer_name text,
  add column if not exists bpm integer,
  add column if not exists musical_key text,
  add column if not exists mood_tags text[] default '{}'::text[],
  add column if not exists artwork_url text,
  add column if not exists artwork_storage_path text,
  add column if not exists audio_storage_path text,
  add column if not exists preview_storage_path text,
  add column if not exists waveform_status text default 'pending',
  add column if not exists is_featured boolean default false,
  add column if not exists is_tournament_safe boolean default false,
  add column if not exists is_homepage_safe boolean default false;

update public.beats
set
  producer_name = coalesce(nullif(producer_name, ''), nullif(artist, ''), 'Unknown Producer'),
  bpm = coalesce(bpm, tempo, 90),
  musical_key = coalesce(nullif(musical_key, ''), nullif(key_signature, '')),
  mood_tags = case
    when mood_tags is null or cardinality(mood_tags) = 0 then
      case
        when genre is not null and length(trim(genre)) > 0 then array[lower(genre)]::text[]
        else array['battle']::text[]
      end
    else mood_tags
  end,
  slug = coalesce(
    nullif(slug, ''),
    trim(both '-' from regexp_replace(lower(coalesce(title, 'beat') || '-' || substr(id::text, 1, 8)), '[^a-z0-9]+', '-', 'g'))
  ),
  audio_storage_path = coalesce(
    nullif(audio_storage_path, ''),
    nullif(regexp_replace(coalesce(file_url, ''), '^.*?/object/public/[^/]+/', ''), coalesce(file_url, ''))
  ),
  preview_storage_path = coalesce(
    nullif(preview_storage_path, ''),
    nullif(regexp_replace(coalesce(preview_url, ''), '^.*?/object/public/[^/]+/', ''), coalesce(preview_url, ''))
  ),
  waveform_status = coalesce(nullif(waveform_status, ''), 'pending')
where true;

create unique index if not exists beats_slug_unique_idx on public.beats(slug);
create index if not exists beats_catalog_surface_idx on public.beats(is_active, is_verified, status, is_featured, is_homepage_safe, is_tournament_safe);
create index if not exists beats_producer_name_idx on public.beats(producer_name);
create index if not exists beats_bpm_idx on public.beats(bpm);

commit;
