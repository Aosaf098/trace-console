# Trace Console

A small React application built with Vite. This project includes a `TraceConsole` component and uses modern React tooling for local development, build, and preview.

## About the Project

**TRACE** is an AI-powered decision-support tool that helps analysts at child-safety nonprofits and platform trust-and-safety teams detect online grooming earlier. These analysts face more flagged conversations than they can review, and grooming is hard to spot because it is not a single message but a *pattern over time* — trust-building, flattery, fishing for a child's age, encouraging secrecy, and pushing the conversation onto a private platform.

TRACE reads each conversation already in an analyst's review queue, scores how strongly it matches that grooming pattern, ranks the queue so the most concerning cases rise to the top, and highlights the exact lines that drove each score so the analyst can judge it themselves. The defining principle is that **the system ranks and explains; it never decides, acts, or monitors people.** It operates only on cases an authorized analyst already holds, which keeps it firmly a decision-support tool rather than a surveillance system.

**How it works.** The risk score comes from a machine-learning classifier (logistic regression) trained on a synthetic dataset of grooming and safe conversations. The model *learned* how much each warning signal should count rather than having those weights hand-set. Five rule-based detectors (off-platform migration, secrecy and isolation, age-probing, emotional dependency, and gift or money offers) extract signals from the text; the trained model combines them into a risk probability; and an explainability layer surfaces the contributing lines and learned weights for every prediction. Because each signal is named and human-readable, the model stays fully auditable.

**AI capabilities used:** pattern detection and classification, multi-signal risk scoring, and Explainable AI (XAI), supported by lightweight rule-based NLP for feature extraction.

**Human-in-the-loop and guardrails.** The analyst makes every real decision — escalate, dismiss, or send for second review. Cases that are uncertain, or that indicate a minor, cannot be silently dismissed and are routed to a human. This design treats the false-positive/false-negative tradeoff as something to manage with human judgment, not resolve automatically.

**Data disclosure.** All conversations are synthetic and depict manipulation *tactics* only, never explicit content. No real persons or case data are used. The training corpus is generated procedurally (`generate.py`), and the model is trained and evaluated separately (`train.py`), exporting learned weights the console consumes.

> This is a hackathon prototype for USAII's Global AI Hackathon 2026 (Challenge Brief 5, Direction A). It is a demonstration of responsible, explainable AI in a high-stakes setting — not a production system.

## Prerequisites

- Node.js 18 or newer
- npm (included with Node.js)

## Install Dependencies

Open a terminal in the project root and run:

```bash
npm install
```

## Run Locally

Start the development server:

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
- `src/TraceConsole.jsx` - trace console component
- `vite.config.js` - Vite configuration
- `package.json` - dependencies and scripts
- `public/` - static files served by Vite

## Notes

- The app uses React 19 and Vite.
- If dependency installation fails, make sure your Node.js and npm versions are up to date.
- Run `npm run lint` to check for code style and linting issues.