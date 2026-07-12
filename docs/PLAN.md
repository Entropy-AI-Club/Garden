# Entropy AI Club — Site Architecture

This documents how the site is actually built, for anyone picking this project
up later. (The original planning doc, written before implementation, lives in
the chat history that produced this project — a couple of implementation
details below differ slightly from that first draft, where Hugo's real
behaviour turned out to be more specific than the sketch.)

## Stack

- **Generator**: [Hugo](https://gohugo.io) (extended), no separate theme module — the
  theme lives directly in this repo's `layouts/` and `assets/`.
- **Content**: Markdown files under `content/`, plus a handful of YAML files
  under `data/` for structured, non-prose data (the member roster, section
  labels, role descriptions).
- **Search**: [Pagefind](https://pagefind.app), indexed as a build step after Hugo runs.
- **Editing UI**: [Decap CMS](https://decapcms.org) at `/admin/`, backed by GitHub, via a
  small Cloudflare Worker OAuth proxy (`infra/oauth-worker/`).
- **Hosting**: GitHub Pages, built and deployed by `.github/workflows/deploy.yml`.

## Content model

| Section | Path | Notes |
|---|---|---|
| Posts | `content/posts/` | Knowledge posts. Supports Chroma code highlighting, KaTeX, Mermaid. |
| Resources | `content/resources/` | External links (articles, videos, threads) with a `link` field. |
| Tools | `content/tools/` | Tools members use, with a `homepage_url`. |
| Prompts | `content/prompts/` | Prompt library; the prompt itself goes in the markdown body. |
| Projects | `content/projects/` | Ideas/projects, with a `status` and optional `links`. |
| Meeting notes | `content/meeting-notes/` | `authors` (who logged it) + `attendees`. |
| Members | `content/members/` | **Generated** — see below. |

Every content type above (except members) carries an `authors: [slug, ...]`
front-matter field, where each slug matches an entry in `data/members.yaml`.

## Members: generated from one YAML file

`data/members.yaml` is the single source of truth for the roster:

```yaml
roster:
  - slug: hemath
    name: "Hemath D J"
    role: "Founder"
    membership_id: "EAC-0001"
    joined: 2024-01-15
    photo: ""
    interests: ["Large Language Models"]
    bio: |
      Founder of Entropy AI Club.
```

It's a list (not a map) specifically so Decap CMS's `list` widget and
`relation` widget can address entries by their `slug` field — a bare YAML map
keyed by dynamic strings isn't something Decap's editor UI can represent.

`content/members/_content.gotmpl` is a Hugo
[content adapter](https://gohugo.io/content-management/content-adapters/): at build
time it loops over `hugo.Data.members.roster` and calls `.AddPage` once per
entry, so **every roster entry gets a real page at `/members/<slug>/` without
anyone creating a content file.** Add a member to the YAML file, rebuild, and
their page exists.

## Attribution and timelines are automatic

`hugo.yaml` declares:

```yaml
taxonomies:
  author: authors
  tag: tags
```

Every piece of content's `authors: [...]` front matter is therefore indexed
by Hugo as the `authors` taxonomy (Hugo's taxonomy config maps a singular
template-access key to the plural front-matter field/URL name — the plural
form, `authors`, is what you address in templates: `site.Taxonomies.authors`).

This means:

- A member's **contribution timeline** (`layouts/members/single.html`) is just
  `index site.Taxonomies.authors <slug>` — every post, resource, tool, prompt,
  project and meeting note that named them as an author, sorted by date. No
  separate activity log to maintain.
- The **homepage's global activity feed** (`layouts/index.html`) is the same
  idea at site scale: every page from the six content sections
  (`site.Params.activitySections`), sorted by date, rendered through
  `partials/activity-item.html` as "X did Y: Title".

`data/sections.yaml` supplies the small amount of copy this needs (the verb
per section, e.g. "published a new post" vs "added a tool", plus the homepage
category-card descriptions) — one more example of using a data file instead
of hardcoding strings in templates.

## Blog features

- **Code highlighting**: Hugo's built-in Chroma. `assets/css/chroma.css` is
  pre-generated (`hugo gen chromastyles --style=monokai`) and linked in
  `layouts/partials/head.html`.
- **KaTeX**: `hugo.yaml` enables Goldmark's `passthrough` extension so
  `\( ... \)`, `\[ ... \]` and `$$ ... $$` survive markdown rendering
  untouched, instead of Goldmark/CommonMark eating the backslashes. KaTeX and
  its auto-render script are pulled in client-side, but only on pages whose
  rendered HTML actually contains those delimiters
  (`layouts/partials/scripts.html` checks with a simple substring test) —
  most pages never pay for it.
- **Mermaid**: a markdown render hook,
  `layouts/_default/_markup/render-codeblock-mermaid.html`, turns
  ` ```mermaid ` fences into `<pre class="mermaid">`; Mermaid's JS is loaded
  the same conditional way as KaTeX.

## Search

`package.json`'s `build` script runs `hugo --gc --minify` and then
`pagefind --site public`. Pagefind crawls the built HTML: `data-pagefind-body`
on `<main>` scopes indexing to real content, `data-pagefind-ignore` on
header/footer excludes navigation, and `data-pagefind-filter="type:X"` on each
section's single template (plus the member page) gives the search UI its
"Type" filter facet for free. `/search/` mounts Pagefind's default UI widget.

## Editing workflow

Two ways to contribute, both writing to the same GitHub repo:

1. **Git directly** — add/edit a markdown file under `content/`, or add an
   entry to `data/members.yaml`, and open a PR. `.github/workflows/ci.yml`
   builds every PR so a broken build is caught before merge.
2. **Decap CMS** at `/admin/` — a form-based editor for the same files
   (except the member roster, which stays Git-only). Collections in
   `static/admin/config.yml` mirror posts/resources/tools/prompts/projects/
   meeting-notes; `authors`/`attendees` use a relation widget against a
   **hidden** members collection so only real slugs can be picked.
   `publish_mode: editorial_workflow` means every CMS save opens a PR —
   pair with GitHub branch protection on `main` so merges require review.

Decap's GitHub backend needs an OAuth token exchange, which GitHub Pages
can't run itself — `infra/oauth-worker/` is a small Cloudflare Worker that
does just that handshake. See the repo README for the one-time setup
(GitHub OAuth App + Worker deploy + secrets).

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: installs Hugo
and Node, runs the same `npm run build` used locally, and publishes `public/`
to GitHub Pages via `actions/upload-pages-artifact` +
`actions/deploy-pages`.
