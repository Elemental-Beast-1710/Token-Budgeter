# Contributing to TokenBudgeter

Thank you for your interest in contributing to **TokenBudgeter**!

## Core Working Principles

1. **Measure First, Explain Second, Recommend Third**: Never invent usage figures or claim speculative savings that have not been demonstrated.
2. **Deterministic Financial Arithmetic**: Never use an LLM or fuzzy heuristic to sum or calculate monetary costs. All arithmetic must run through deterministic TypeScript functions.
3. **Local-First & Privacy Preserving**: User data stays in the browser's local IndexedDB sandbox. Never introduce cloud sync or tracking telemetry without explicit opt-in.
4. **Anti-Slop Discipline**: Maintain high-density developer tool aesthetics with WCAG AA accessibility, tabular figures (`font-mono tabular-nums`), and single-line controls.

## Development Workflow

### Prerequisites
- Node.js >= 18
- npm or bun

### Setup
```bash
# Clone the repository
git clone https://github.com/your-org/tokenbudgeter.git
cd tokenbudgeter

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running Tests
We maintain an automated deterministic test suite covering cost calculations, deduplication, CSV sanitization, filters, and inefficiency detection:

```bash
npm test
```

### Linting & Type Checking
```bash
npm run lint
```

## Adding Provider Adapters
When adding rate cards or provider adapters:
- Add verified pricing entries in `src/services/pricing.ts` with effective dates and documentation citations.
- Add column alias mappings in `src/services/importer.ts`.
- Ensure tests in `tests/runTests.ts` are updated to cover new rate definitions.
