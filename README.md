# Entropy AI Club

The website for Entropy AI Club — a Hugo site where every resource, post,
tool, prompt, project and meeting note is attributed to the member who
contributed it, and shows up automatically on that member's own page.

See [`docs/PLAN.md`](docs/PLAN.md) for how it's built. This file is about how
to run it and how to contribute to it.

## Running locally

Requires [Hugo](https://gohugo.io/installation/) (extended) and Node.js.

```bash
npm install        # installs the Pagefind CLI used for search indexing
npm run serve       # hugo server --buildDrafts, at http://localhost:1313

npm run build       # one-off production build: hugo --gc --minify + pagefind
```

`npm run serve` is fine for editing content and layouts, but the search page
won't work until you've run `npm run build` at least once (Pagefind indexes
the built `public/` folder, which `hugo server` doesn't write to disk).

## Contributing content

Everything under `content/` and `data/` is plain text — there are two ways to
edit it:

### Option A: Git

- **Post** → add a file to `content/posts/`, e.g. `hugo new posts/my-post.md`
- **Resource** → `content/resources/`
- **Tool** → `content/tools/`
- **Prompt** → `content/prompts/`
- **Project** → `content/projects/`
- **Meeting notes** → `content/meeting-notes/`
- **Yourself, as a member** → add an entry to `data/members.yaml`. That alone
  gives you a page at `/members/<your-slug>/` — no content file needed.

`hugo new <section>/<file>.md` fills in the front matter for you from
`archetypes/`. The one field every content type (except members) shares is
`authors: ["your-slug"]` — this is what links your contribution back to your
member page and into the homepage's activity feed. Use the `slug` you gave
yourself in `data/members.yaml`.

Open a pull request. `.github/workflows/ci.yml` builds it automatically so
you'll know before merging if something's broken.

### Option B: the CMS

Go to `/admin/` on the live site. It's the same repo underneath — but every
save opens a **pull request** (editorial workflow), not a direct commit to
`main`. An editor reviews and merges before the site redeploys.

Pick `authors` / `attendees` from the member roster dropdown (real slugs only).
**Member roster changes are not available in the CMS** — edit
`data/members.yaml` via Git/PR only.

The CMS needs a one-time OAuth setup before it'll work on the live site (see
below). Until then, use Git directly.

## One-time setup for this repo

A few placeholders need real values once this is deployed under an actual
GitHub org/repo:

1. **`hugo.yaml`**: set `baseURL` to the real GitHub Pages URL.
2. **`static/admin/config.yml`**: set `backend.repo` to `<owner>/<repo>`.
3. **GitHub Pages**: in the repo's Settings → Pages, set the source to
   "GitHub Actions" (the included workflow handles the rest).
4. **Protect `main` (PR gate)**: Settings → Branches → Branch protection rule
   for `main`:
   - Require a pull request before merging
   - Require approvals (at least 1)
   - Do not allow bypassing the rule (except maybe yourself as admin, if you want)
   Decap's `publish_mode: editorial_workflow` already opens a PR for every CMS
   save; branch protection makes the same rule apply to Git pushes too.
5. **Decap CMS's OAuth proxy** (only needed for the `/admin/` editing UI —
   Git-based contributions work without this):
   - Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps).
     Set its callback URL to `https://<your-worker>.workers.dev/callback`.
   - Deploy `infra/oauth-worker/` with [Wrangler](https://developers.cloudflare.com/workers/wrangler/):
     ```bash
     cd infra/oauth-worker
     npx wrangler deploy
     npx wrangler secret put GITHUB_CLIENT_ID
     npx wrangler secret put GITHUB_CLIENT_SECRET
     ```
   - Put the deployed worker's URL into `base_url` in
     `static/admin/config.yml`.

## Repo layout

```
content/        markdown content, one folder per section
data/            YAML: members.yaml (roster), roles.yaml, sections.yaml
layouts/         templates (no external theme)
assets/          CSS/JS processed by Hugo Pipes
static/          untouched files: uploaded images, admin/ (Decap CMS)
infra/oauth-worker/   Cloudflare Worker for Decap's GitHub OAuth
.github/workflows/    CI build check + GitHub Pages deploy
docs/PLAN.md     architecture notes
```
