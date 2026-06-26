# ArchitectAI — Software Blueprint Generator

An AI-powered product architect that converts a software idea into a complete technical blueprint using a **7-stage AI pipeline**.

## What It Does

Input: `"Build an AI-powered internship platform for students"`

Output: A full software blueprint including:
- Business analysis, target users, market fit
- Functional & non-functional requirements + user stories
- Core / Admin / AI / Premium feature sets
- Database schema with collections, fields, indexes, relationships
- Complete REST API specification with request/response bodies
- System architecture (frontend, backend, AI services, deployment)
- Phased development roadmap with milestones and launch checklist

---

## Setup

### 1. Clone and install

```bash
cd backend
npm install
```

### 2. Configure API Key

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
```

### 3. Start

```bash
node server.js
```

Open `http://localhost:3000` in your browser.

---

## Architecture

```
project/
├── frontend/
│   ├── index.html        # Single-page app
│   ├── style.css         # Dark terminal UI
│   └── script.js         # All frontend logic
│
└── backend/
    ├── server.js          # Express entry point
    ├── routes/
    │   └── blueprints.js  # Blueprint API routes (SSE streaming)
    ├── services/
    │   ├── aiBase.js               # Anthropic API caller
    │   ├── blueprintOrchestrator.js # 7-stage pipeline runner
    │   ├── ideaAnalyzer.js
    │   ├── requirementsGenerator.js
    │   ├── featureGenerator.js
    │   ├── databaseGenerator.js
    │   ├── apiGenerator.js
    │   ├── architectureGenerator.js
    │   └── roadmapGenerator.js
    ├── prompts/
    │   ├── ideaAnalyzer.js          # Stage 1 prompt
    │   ├── requirementsGenerator.js # Stage 2 prompt
    │   ├── featureGenerator.js      # Stage 3 prompt
    │   ├── databaseGenerator.js     # Stage 4 prompt
    │   ├── apiGenerator.js          # Stage 5 prompt
    │   ├── architectureGenerator.js # Stage 6 prompt
    │   └── roadmapGenerator.js      # Stage 7 prompt
    ├── utils/
    │   ├── jsonValidator.js  # JSON parsing + validation
    │   ├── logger.js         # In-memory logging
    │   └── storage.js        # Local JSON file storage
    └── exports/              # Saved blueprints (auto-created)
```

---

## AI Pipeline

Each stage is a separate, focused AI call with its own prompt:

| Stage | Service | Output |
|-------|---------|--------|
| 1 | Idea Analyzer | Industry, users, business model, risks |
| 2 | Requirements Generator | Functional/NFR, user stories |
| 3 | Feature Generator | Core, admin, AI, premium features |
| 4 | Database Architect | Collections, schemas, indexes |
| 5 | API Architect | REST endpoints, auth, schemas |
| 6 | System Architect | Full system + deployment architecture |
| 7 | Roadmap Generator | Phased plan, testing, launch checklist |

**Each stage feeds context into the next** — the database schema uses the feature list, the API uses the database schema, etc.

Progress streams to the frontend in real time via **Server-Sent Events (SSE)**.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/blueprints/generate | Start generation (SSE stream) |
| GET | /api/blueprints | List all blueprints |
| GET | /api/blueprints/:id | Get full blueprint |
| GET | /api/blueprints/:id/export | Download as JSON |
| DELETE | /api/blueprints/:id | Delete blueprint |
| GET | /api/health | Server status |

---

## Features

- **Multi-stage AI pipeline** — 7 separate AI calls, each with a focused prompt
- **Real-time streaming** — SSE progress updates as each stage completes
- **Structured JSON output** — every stage returns validated JSON
- **Persistent storage** — blueprints saved as local JSON files
- **Load & export** — reload past blueprints, export as JSON
- **Generation logs** — full timestamped log of every pipeline event
- **Error handling** — JSON repair, retry logic, graceful failures
