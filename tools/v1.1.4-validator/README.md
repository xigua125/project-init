# V1.1.4 Validator

This directory contains the dependency-free, single-file read-only Validator and its explicitly non-authoritative self-test.

Authority is the unchanged V1.3 base plus `references/v1.1.4-execution-contract-v1.4.md`. The operational procedure is V1.0 plus `references/v1.1.4-validator-procedure-v1.1.md`; the result schema is `references/v1.1.4-validator-result.schema.json`.

## Files

- `validator.mjs` — proposed Validator executable. Its final raw-byte SHA-256 is the future `validator_sha256` in a Human-approved ACTIVE Validator Registry.
- `validator-self-test.mjs` — synthetic NON-AUTHORITATIVE checks only.

## Self-test

```text
node validator-self-test.mjs
```

The self-test may not set a contract gate, RT result, `FINAL_PASS`, PV, RC, Stable, or Human approval. It does not run the existing regression harness.

## Future authoritative invocation

Not currently authorized. After Human Registry approval, independent anchoring, RT bundle binding, and execution authorization:

```text
node validator.mjs --request <absolute-canonical-request.json> --output <absolute-new-result.json>
```

The request and output must be external to audited roots. The output path must not already exist. The Validator does not edit the evidence log or create independent anchors; the independently controlled evidence workflow performs those Section 13 operations after result creation.

Current status:

```text
REGISTRY_STATUS = NOT_CREATED
FIRST_VALIDATOR_EXECUTION_STATUS = NOT_AUTHORIZED
```
