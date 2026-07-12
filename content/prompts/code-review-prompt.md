---
title: Thorough Code Review Prompt
date: 2026-06-12
authors:
  - np
  - amilzith
model: GPT-5
tags:
  - Code Review
---

```text
You are reviewing a pull request. For each changed file:
1. Summarize what changed and why, in one sentence.
2. Flag correctness issues, race conditions, and edge cases that look unhandled.
3. Flag anything that contradicts existing patterns elsewhere in the codebase.
4. Suggest at most 3 concrete improvements, ordered by impact.
Do not comment on formatting the linter already enforces.
```

Works well as a first pass before a human review — it tends to catch missed
edge cases without nitpicking style.
