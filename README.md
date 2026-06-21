# Trace Console

The frontend for **TRACE** — a React application built with Vite. It is a pure
client: it fetches already-scored, paginated conversations from the TRACE
backend API and presents them to an analyst for review. All data and AI live in
the backend; this app displays them and sends the analyst's decisions back.

> **Requires the backend.** This console talks to the TRACE backend API at
> ``. Start that server first (see the backend project),
> then run this app. Without it, the console will show a "can't reach the
> backend" message.

## About the Project

**TRACE** is an AI-powered decision-support tool that helps analysts at
child-safety nonprofits and platform trust-and-safety teams detect online
grooming earlier. These analysts face more flagged conversations than they can
review, and grooming is hard to spot because it is not a single message but a
*pattern over time* — trust-building, flattery, fishing for a child's age,
encouraging secrecy, and pushing the conversation onto a private platform.

TRACE reads each conversation already in an analyst's review queue, scores how
strongly it matches that grooming pattern, ranks the queue so the most
concerning cases rise to the top, and highlights the exact lines that drove each
score so the analyst can judge it themselves. The defining principle is that
**the system ranks and explains; it never decides, acts, or monitors people.**
It operates only on cases an authorized analyst already holds, which keeps it
firmly a decision-support tool rather than a surveillance system.

**How it works.** This frontend holds no conversations and does no scoring — it
is a thin client. The backend owns the data and the AI: it embeds each message
with a sentence-transformer and compares its *meaning* (not its keywords)
against reference examples of five grooming signals — off-platform migration,
secrecy and isolation, age-probing, emotional dependency, and gift or money
offers. Because it matches meaning, it handles slang, misspellings, and novel
phrasing the original keyword approach could not. A logistic-regression model
then combines those signals into a risk probability, and the response includes
the matched signal, its similarity, and the contributing line — so every
prediction the console displays is explainable and auditable.

**The console.** The interface presents the analyst's workflow across four tabs:

- **Queue** — open cases ranked by risk, with sub-filters for **High signal**,
  **Needs review**, and **Low signal**, and pagination.
- **Uncertain** — cases the analyst routed for a closer look.
- **Escalated** — cases sent to investigation.
- **Safe** — cleared cases, each with a discard button to return it to the queue.

Each case shows its **source** (where the flag came from), a risk probability and
band, the semantic evidence behind the score, and the transcript with the
relevant lines highlighted. The console serves only the model's **held-out test
cases** — conversations it never trained on — so the demo reflects performance
on genuinely unseen data.

**AI capabilities used:** semantic similarity matching (sentence embeddings),
pattern detection and classification, multi-signal risk scoring, and
Explainable AI (XAI).

**Human-in-the-loop and guardrails.** The analyst makes every real decision —
escalate, mark safe, or route to uncertain for review. Cases that are uncertain,
or that indicate a minor, cannot be cleared straight from the queue; they must be
escalated or reviewed first, and the backend enforces this. This design treats
the false-positive/false-negative tradeoff as something to manage with human
judgment, not resolve automatically.

**Data disclosure.** All conversations are synthetic and depict manipulation
*tactics* only, never explicit content. No real persons or case data are used.
The dataset, model training, and evaluation live in the backend project.

> This is a hackathon prototype for USAII's Global AI Hackathon 2026 (Challenge
> Brief 5, Direction A). It is a demonstration of responsible, explainable AI in
> a high-stakes setting — not a production system.

## Prerequisites

- Node.js 18 or newer
- npm (included with Node.js)
- The TRACE backend running at `http://localhost:8000`

## Install Dependencies

Open a terminal in the project root and run:

```bash
npm install
```

## Run Locally

First, make sure the backend API is running (see the backend project). Then start
the development server:

```bash
npm run dev
```

Open the URL shown in the terminal, typically:

```text
http://localhost:5173
```

## Build for Production

Create a production build with:

```bash
npm run build
```

The optimized output is generated in the `dist/` folder.

## Preview Production Build

Preview the built app locally with:

```bash
npm run preview
```

Then open the preview URL shown in the terminal.

## Project Scripts

- `npm run dev` - start Vite development server
- `npm run build` - build production assets
- `npm run preview` - preview the production build
- `npm run lint` - run ESLint checks

## Project Structure

- `src/` - main app source files
- `src/main.jsx` - React entry point
- `src/App.jsx` - root React component
- `src/TraceConsole.jsx` - the console; a pure API client (no data or scoring)
- `vite.config.js` - Vite configuration
- `package.json` - dependencies and scripts
- `public/` - static files served by Vite

## Notes

- The app uses React 19 and Vite.
- The console fetches from `http://localhost:8000`; if you see a connection error,
  confirm the backend is running.
- If dependency installation fails, make sure your Node.js and npm versions are up to date.
- Run `npm run lint` to check for code style and linting issues.