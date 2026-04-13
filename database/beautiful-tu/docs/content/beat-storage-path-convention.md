# Beat Storage Path Convention

Canonical bucket: `beats`

Path layout:
- `catalog/audio/<producer-slug>/<beat-slug>/main.<ext>`
- `catalog/preview/<producer-slug>/<beat-slug>/preview.<ext>`
- `catalog/artwork/<producer-slug>/<beat-slug>/cover.<ext>`
- `artwork/generated/<beat-slug>.svg` for server-generated fallback art

Database mapping:
- `file_url` -> public audio URL
- `preview_url` -> public preview URL
- `artwork_url` -> public artwork URL
- `audio_storage_path` -> canonical storage-relative audio path
- `preview_storage_path` -> canonical storage-relative preview path
- `artwork_storage_path` -> canonical storage-relative artwork path

Legacy normalization fallback:
- if a historical beat row is missing bucket-backed artwork, `artwork_url` may temporarily point to `/api/beats/artwork/<slug>`
- that fallback is acceptable for launch-safe surfacing, but new imports should still write bucket-backed artwork when available

Launch-safe surface rules:
- `status = 'active'`
- `is_active = true`
- `is_verified = true`
- `duration_seconds > 0`
- `file_url`, `preview_url`, and `artwork_url` must all be present

Selectors:
- `is_featured = true` for primary merchandised beats
- `is_homepage_safe = true` for home/trending placement
- `is_tournament_safe = true` for tournament and battle selection surfaces
