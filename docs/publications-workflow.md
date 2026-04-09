# Publications Workflow

This project supports **two workflows** for publications using one shared model:

- **Manual/content-driven publishing** (code + public assets)
- **Admin publishing** (preferred day-to-day workflow)

Supported categories:

- `research_standard`
- `case_study`
- `research_note`

## Shared publication model

Every publication record uses the same shape (`src/lib/publications/model.ts`):

- `id`, `title`, `slug`, `category`, `summary`
- `status` (`draft | published | archived`)
- `published_at`, `updated_at`
- `cover_image_url`, `pdf_url`, `viewer_url`
- `featured`
- optional: `author_label`, `estimated_read_time`, `tags`, `sort_order`, `seo_title`, `seo_description`

`viewer_url` is auto-generated from slug (`/research/<slug>/viewer`) when omitted.

---

## 1) Manual/content-driven publishing

### Files and folders

1. Add/update metadata in:
   - `src/content/publications.ts`
2. Place assets under `public/`:
   - `public/publications/research-standards/<slug>.pdf`
   - `public/publications/case-studies/<slug>.pdf`
   - `public/publications/research-notes/<slug>.pdf`
   - `public/publications/covers/<slug>.png`

### Steps

1. Upload PDF + cover image into `public/publications/...`
2. Add a record in `manualPublications` with:
   - matching `slug`
   - `pdf_url` and `cover_image_url`
   - `status = "published"` when ready to go live
3. Set `featured: true` if it should appear in featured sections.

### Research Standards behavior

`research_standard` is treated as a special type. The page selects a single **active standard** by taking the newest published research standard.

---

## 2) Admin publishing (preferred)

### Routes

- List/manage: `/app/admin/publications`
- Create: `/app/admin/publications/new`
- Edit: `/app/admin/publications/<id>/edit`

### Capabilities

- Create/edit publication metadata
- Upload/replace PDF
- Upload/replace cover image
- Publish/unpublish/archive via quick actions or edit form

### Storage

- Metadata: SQLite table `publications`
- Uploaded files: `.data/publications/pdfs` and `.data/publications/covers`
- Served via: `/api/publications/assets/pdf/<file>` and `/api/publications/assets/cover/<file>`

---

## URL generation rules

- `pdf_url` is canonical download URL.
- `viewer_url` defaults to `/research/<slug>/viewer`.
- Public pages never hardcode links; links come from publication records.

---

## Public rendering

- `/research-standards` resolves the active published `research_standard` record.
- `/research` lists published `case_study` + `research_note` records and supports featured items.
- `/research/<slug>` is the publication detail summary page.
- `/research/<slug>/viewer` renders the PDF viewer.
