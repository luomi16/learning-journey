# Learning Journal

A quiet place to track daily reading, connect ideas, and keep useful notes. White cards, soft pink accents, four searchable views, and a light/dark theme. Built from Markdown with no third-party runtime dependencies.

## Start locally

Requires Node.js 18+ and Python 3. Open a terminal in the cloned project folder and run:

```sh
npm run dev
```

Open http://localhost:4173. After editing content, run `npm run build` and refresh. No dependency installation is needed.

The included day, papers, authors, links, and notes are instructional placeholders. The example date is not a real reading record; replace it with your own date.

## Find your way around

| View | What it contains | Where to write |
| --- | --- | --- |
| Timeline | One card per day: Paper / Takeaways pairs, then one Outputs section | `content/*.md` |
| Read papers | A reading-date timeline with titles, authors, publication dates, and links | Collected from each day's Paper sections |
| Notes | A dated timeline of standalone notes | `notes/*.md` |
| Knowledges | A dated timeline of reusable concept explanations | `knowledge/*.md` |

Switch views with the top buttons. Search applies to the current view. Files in `templates/` are blank starting points and are not published.

## Write your first day

1. Copy `templates/day.md` to `content/YYYY-MM-DD.md`.
2. Replace the example date with your reading date and set a title for the day.
3. Fill in a Paper link and its Takeaways for each paper you read.
4. Collect the day's notes, code, diagrams, or experiments in Outputs.
5. Run `npm run build` and refresh the preview.

Use `templates/paper.md` for a day with one paper. For more readings, repeat **Paper → Takeaways** before the single Outputs section. Same-date files also combine into one card, but one file per day is easiest to maintain.

Each Paper section can contain:

```markdown
#### Paper
[Full paper title](https://example.com/paper)
Authors: Replace with author names
Published: YYYY-MM-DD

#### Takeaways
- Explain the main idea in your own words.
- Link a keyword to an existing knowledge page.
```

Replace `Authors` and `Published` with real information. A publication year is also accepted. Remove unknown fields or leave them empty; they display as **Not recorded**. The reading date comes from the day's `date`, independently of the publication date.

Read papers groups papers by reading date, newest first, with one card per day. Reusing the same paper URL on another day shows it under each reading date; the total paper count counts unique URLs. Additional links such as `[PDF](https://example.com/paper.pdf)` can be added inside its Paper section.

## Connect notes and concepts

Copy `templates/note.md` into `notes/your-note-name.md` for a detailed note. Copy `templates/knowledge.md` into `knowledge/your-concept-name.md` for a reusable explanation. Replace each title, example date, and instructional text.

Notes and Knowledges group pages with the same `date` into one timeline card, newest first. Set `date: YYYY-MM-DD` in each file’s metadata to choose its timeline date. The date is optional: pages without a date appear together in an **Undated** group at the end. File creation and modification timestamps are not used.

| Link target | Markdown example |
| --- | --- |
| A knowledge page | `[keyword](knowledge/template-concept)` |
| A detailed note | `[Research notes](notes/2026-11-20-template-paper-b)` |
| An external source | `[Paper](https://example.com/paper)` |

Create the target file before linking to it. Internal links use `knowledge/` or `notes/` without `.html`, `../`, or a local preview address. They work from every view and detail page. External links open in a new tab.

Keep filenames stable and use letters, numbers, hyphens, or underscores. Missing internal targets stop the build with `Unknown internal link`; create the target or correct the link. Update references when renaming a file.

## Keep summaries short

Paper, Takeaways, and Outputs appear on the timeline. Extra sections, such as Detailed notes or Next steps, appear only on the daily detail page. Outputs receives a detail-page link automatically when it has no note link.

Supported Markdown includes `##` through `####` section headings, paragraphs, `- ` bullet lists, links, bold text, and inline code. It is a small Markdown subset; arbitrary HTML, images, tables, and fenced code blocks are not rendered inside content files. The README itself uses standard Markdown.

## Make the template yours

- Update the name, page title, navigation links, and footer in `index.html`.
- Adjust the color variables at the top of `style.css` if desired.
- Replace the instructional day in `content/2026-11-20-template.md`.
- Replace the two guide pages in `notes/` and the concept example in `knowledge/`.
- Remove or update links to examples before deleting them, then rebuild.

Keep `templates/` for future entries. `dist/` is generated output; edit the source folders rather than generated files.

## Publish with GitHub Pages

1. Copy this project into your own GitHub repository, keeping `.github/workflows/deploy.yml`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Push to `main`, or run **Deploy learning journal** from Actions.
4. Open `https://OWNER.github.io/REPOSITORY/`, replacing both placeholders with your account and repository names.

For a repository named `OWNER.github.io`, the site is served at the account's root URL instead. Later pushes to `main` rebuild and deploy the site automatically.

Builds give CSS, JavaScript, and journal data content-based filenames, so updates do not reuse a previous version from the browser cache. If an older tab still looks out of date after deployment, hard-refresh it once.

Google Fonts are optional: the page uses system fonts when they cannot load. Content is public when you publish the site; there is no login or database.
