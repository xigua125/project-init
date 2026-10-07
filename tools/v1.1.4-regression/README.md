# V1.1.4 regression harness

This dependency-free Node.js harness implements the RC-01..RC-04 remediation profile.

It has three explicit phases:

1. `prepare` creates a new lineage's audited-root fixtures and canonical pre-BUILD specifications/registries, then emits a Human-custodian authorization request. It does not create or approve the independent anchor.
2. `build` refuses to run until an independently stored Human approval anchor matches every requested hash and predates BUILD. It then materializes the Stage-0 corpus, establishes positive freezes, and creates isolated negative branches.
3. `verify` recomputes RT-01..RT-38 from source files and observations. It ignores all Builder-authored verdict booleans and aggregates fail-closed.

Usage:

```text
node harness.mjs prepare --lineage-root <absolute-new-path> --anchor-store <absolute-independent-path>
node harness.mjs build --lineage-root <path> --anchor <human-created-anchor.json>
node harness.mjs verify --lineage-root <path> --anchor <prebuild-anchor.json> --clean-freeze-anchor <anchor.json> --dirty-freeze-anchor <anchor.json> --chain-anchor <anchor.json>
```

The anchor store must be outside the lineage directory and outside Builder logical role authority/authorized write set. Every anchor must be canonical, hash-bound to its request, accompanied by hash-bound non-Builder custody evidence, predate the governed BUILD, participate in the append-only chain, and be covered by matching protected-location before/after snapshots plus Final-Auditor replay. OS-enforced isolation is optional preferred high-assurance evidence; absence alone records `PORTABLE_DEFAULT` and does not block default PASS. The implementation owner must not run `build` by manufacturing an approval anchor.
