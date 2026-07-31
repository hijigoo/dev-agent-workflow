# Repository instructions

This repository demonstrates controlled GitHub Copilot cloud agent workflows.

## Architecture

- `apps/api`: FastAPI meeting-room API. SQLite access stays inside the repository class.
- `apps/work-intake`: FastAPI Jira/local WorkItem adapter and GitHub Issue publisher.
- `apps/web`: React/TypeScript UI. API DTOs are mapped explicitly in `src/api.ts`.
- `scripts`: deterministic release detection and privacy-safe aggregate quality reporting.

## Required behavior

- Keep cloud-agent automation ending at an Issue or pull request. Never add auto-merge.
- Preserve half-open reservation intervals `[start, end)` and timezone-aware inputs.
- Never fabricate API success in the UI. Surface operational errors to the user.
- Never log or commit tokens, raw prompts, transcripts, user IDs, emails, or phone numbers.
- Use minimum GitHub workflow permissions.
- Reuse existing models and helpers rather than duplicating contracts.
- Avoid unrelated refactoring and new runtime dependencies.

## Validation

Run the smallest relevant commands and then the full affected suite:

```bash
python -m pytest apps/api/tests apps/work-intake/tests tests
cd apps/web
npm ci
npm run lint
npm test
npm run build
```

For UI workflows also run `npm run test:e2e`.

## Pull request report

Include:

1. Issue or alert that triggered the work. Start the PR body with
   `Closes #<issue-number>` so delivery automation can notify the original Issue.
2. Scope and intentionally excluded changes.
3. Commands and test counts.
4. Security, compatibility, privacy, and rollback considerations.
5. Unresolved items requiring a human decision.
