# Beat Import Verification Checklist

Run after each import or backfill:

1. Storage
- confirm audio objects exist in `beats/catalog/audio/...`
- confirm preview objects exist in `beats/catalog/preview/...`
- confirm artwork objects exist in `beats/catalog/artwork/...` or `beats/artwork/generated/...`

2. Database
- verify imported rows have non-null:
  - `slug`
  - `producer_name`
  - `bpm`
  - `genre`
  - `duration_seconds`
  - `artwork_url`
  - `file_url`
  - `audio_storage_path`
  - `waveform_status`
- verify `status = 'active'`, `is_active = true`, `is_verified = true`

3. Product surfaces
- `/app/beats` lists only canonical active verified beats
- homepage beat rail pulls `featured=true&homepage_safe=true`
- battle room beat picker loads real records only
- tournament-safe selector returns only `is_tournament_safe = true`

4. Playback
- preview playback works in beat library
- full audio URL returns `200`
- artwork URL returns `200`

5. Data quality
- no duplicate `slug`
- no active beats with `duration_seconds <= 0`
- no active beats with missing artwork
- no inactive or malformed beats surfacing in public routes
