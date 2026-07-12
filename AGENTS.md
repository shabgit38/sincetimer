# Repository instructions

- Do not make code changes before confirming with the user first.
- When deletion of a built-in Area or Category is proposed, account for both sources: remove it from the hardcoded defaults in `src/lib/db.ts` and remove the corresponding database rows. Before deletion, verify whether any entries reference it and migrate or delete those entries only with the user's approval.
