# Testing

## Test stack

- **Framework**: Vitest
- **Mocking strategy**: Obsidian API is mocked via `tests/__mocks__/obsidian.ts` and aliasing from `vitest.config.ts`
- **Focus**: Business logic (stemming, tokenization, search, query parsing, link building) should stay independently testable from Obsidian runtime

## Test organization

```text
tests/
  __mocks__/
    obsidian.ts
  stemming/
    russian-stemmer.test.ts
    english-stemmer.test.ts
    multi-stemmer.test.ts
  search/
    tokenizer.test.ts
    notes-index.test.ts
    recent-notes.test.ts
  i18n/
    i18n.test.ts
  ui/
    query-parser.test.ts
    link-suggest-core.test.ts
```

## Commands

```bash
npm test             # Run tests once (vitest run)
npm run test:watch   # Watch mode tests
npx tsc --noEmit     # Explicit type check
npm run lint         # Run lint checks
npm run build        # Build plugin bundle
```

## TDD and change expectations

- Preferred approach: write or update tests before implementation, then make code pass.
- For behavior changes, update existing tests where appropriate and add targeted regression tests.
- Validate both normal and edge cases:
  - Incomplete last token behavior
  - `|`, `#`, `^` parsing and resolution
  - Block ID generation/write flow
  - Recent note boosting and ordering
- Keep tests close to feature area and avoid broad integration tests when a narrow unit test is enough.

## Done criteria for test quality

- Changed logic is covered by automated tests in corresponding `tests/**`.
- Existing related tests still pass.
- No duplicate assertions that restate implementation details without behavior value.
- Before marking work complete, run post-change verification with the same commands as CI/release pipeline:
  - `npx tsc --noEmit`
  - `npm run build`
  - `npm test`
  - `npm run lint`
