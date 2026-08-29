---
name: starlog
description: >-
  Vet packages and discover existing open-source libraries before writing code from scratch.
  Use starlog search, starlog facts, starlog advise, and GitHub search to reuse proven,
  secure, and maintained packages instead of hand-rolling custom solutions.
---

# Starlog — Zero Scratch Code & Package Intelligence

## Core Directive: NEVER BUILD FROM SCRATCH
Always search for existing, vetted packages, libraries, or GitHub repositories before writing DIY logic.

## Workflow

### 1. Capability Discovery
Before writing custom utilities, authentication, workers, ratelimiters, parsers, or scrapers:
- Run `starlog search "<capability>"` or use `starlog_search` MCP tool.
- If needed, search GitHub repos for top-starred, production-tested implementations.

```bash
starlog search "rate limiting express"
starlog search "background job queue node"
starlog search "facebook group scraping playwright"
```

### 2. Package Vetting
Before recommending or installing any package:
- Run `starlog facts <package>` or use `starlog_facts` MCP tool.
- Verify:
  - Open CVEs and security advisories
  - Maintenance status (Active vs Abandoned / Deprecated)
  - License compatibility (MIT, Apache-2.0, BSD vs copyleft/restricted)

```bash
starlog facts axios
starlog facts bullmq
```

### 3. Advise & Migration
When existing code has repetitive DIY patterns:
- Run `starlog advise` or use `starlog_advise` MCP tool.
- If verdict is `MIGRATE`: adopt the recommended existing library.
- Only packageize if no safe existing alternative is available in the ecosystem.

## Efficiency & Credit Optimization
- Be concise and direct.
- Batch tool executions and avoid redundant discovery.
- Use surgical edits and verify with minimal steps.
