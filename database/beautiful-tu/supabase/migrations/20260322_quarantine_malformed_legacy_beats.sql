begin;

update public.beats
set
  status = 'inactive',
  is_active = false,
  is_verified = false,
  is_featured = false,
  is_homepage_safe = false,
  is_tournament_safe = false,
  updated_at = now()
where
  coalesce(file_url, '') like 'https://example.com/%'
  or coalesce(preview_url, '') like 'https://example.com/%'
  or (
    coalesce(is_active, false) = true
    and (
      coalesce(status, '') <> 'active'
      or coalesce(duration_seconds, 0) <= 0
      or coalesce(file_url, '') = ''
      or coalesce(preview_url, '') = ''
      or coalesce(artwork_url, '') = ''
    )
  );

commit;
