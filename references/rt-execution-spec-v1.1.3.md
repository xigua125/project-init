# V1.1.3 Runtime Execution Specification

Purpose: Define concrete test inputs, procedures, and expected outputs for RT-01..RT-30 runtime execution so that independent Validation Cycle 02 has reproducible Builder-owned evidence inputs.

This document is Builder-owned evidence input. It does not declare PASS/FAIL. The independent Validator judges all required tests per Contract Section 18.

---

## Test Project Roots

| Variant | Root Path | EXISTING_STATE | Fixture Contents |
|---------|-----------|---------------|------------------|
| Clean Root | `C:/Users/ASUS/erp-presales-demo-v113-clean/` | EMPTY_ROOT | None (truly empty, no .git, no dotfiles) |
| Dirty Root | `C:/Users/ASUS/erp-presales-demo-v113-dirty/` | NON_EMPTY_DIRTY_ROOT | `.env.example`, `src/old_module.py`, `docker/Dockerfile`, `config/settings.yaml`, `scripts/deploy.sh`, `old-notes/notes.md`, `temp/cache.tmp` (no .git) |

---

## Fixture Content Specifications

### Dirty Root Fixture Contents

**`.env.example`**
```
DATABASE_URL=postgresql://localhost:5432/app
API_KEY=replace_me
DEBUG=false
```

**`src/old_module.py`**
```python
# Legacy module — not part of new architecture
def old_function():
    pass
```

**`docker/Dockerfile`**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY . .
CMD ["python", "app.py"]
```

**`config/settings.yaml`**
```yaml
app:
  name: legacy-app
  version: 0.1.0
```

**`scripts/deploy.sh`**
```bash
#!/bin/bash
echo "Legacy deploy script"
```

**`old-notes/notes.md`**
```
# Historical notes — not authoritative for new architecture
```

**`temp/cache.tmp`**
```
temporary cache data
```

---

## RT Execution Matrix

### RT-01 Clarification Decision Threshold
- Input: "Build a REST API for inventory management"
- Procedure: Run skill's Clarification Decision Threshold against the goal
- Expected: Class B/C/D decisions auto-resolved as assumptions; Class A batched into ONE round; no multi-round questioning
- Evidence: Assumption Register with rationale + owner per assumption

### RT-02 Clean-Root / Existing-State Preflight (Dirty variant)
- Input: Dirty Root
- Procedure: Run Existing-State Preflight scan against disk
- Expected: All 7 fixture paths classified KEEP/MIGRATE/ARCHIVE/DELETE_CANDIDATE/BLOCKED; no unclassified paths
- Evidence: Existing-State Classification table with one classification per path

### RT-03 Filesystem Reality Gate
- Variant A (Clean): APPROVED_MATERIALIZED_REGISTRY == ACTUAL state; no unregistered paths
- Variant B (Dirty): 6 conditions all met; physical root != approved architecture is legal
- Evidence: Reconciliation report per Clean/Dirty model

### RT-04 No Generic Scaffold Leakage
- Input: Dirty Root
- Procedure: Verify no generic scaffold paths enter approved architecture without requirement basis
- Expected: `src/`, `docker/`, `config/`, `scripts/`, `.env.example` classified DELETE_CANDIDATE/ARCHIVE, NOT KEEP
- Evidence: Classification rationale per path

### RT-05 Stage 0 Materialization Policy
- Input: Clean Root
- Procedure: Verify only Stage 0 docs location materialized
- Expected: No empty implementation-phase directories created; manifest distinguishes DESIGNED/MATERIALIZED
- Evidence: Filesystem inventory with MATERIALIZED/DESIGNED markers

### RT-06 Contract-to-Disk Consistency
- Input: Both variants
- Procedure: Cross-check all Stage 0 contracts against disk
- Expected: AUTHORITATIVE_ARTIFACT_INVENTORY covers all retained Stage 0 artifacts; no orphan/unknown referenced paths
- Evidence: Referenced-path classification matrix

### RT-07 Git Truth Rule
- Input: Both variants (no .git)
- Procedure: Verify REPOSITORY_STATE recorded truthfully
- Expected: REPOSITORY_STATE = NOT_INITIALIZED; recovery does not depend on fictional Git state
- Evidence: PROJECT_INIT_MANIFEST repository_state field

### RT-08 Authoritative Manifest
- Input: Both variants
- Procedure: Verify manifest contains all required sections
- Expected: project root + AUTHORITATIVE_ARTIFACT_INVENTORY + filesystem inventory + referenced-path coverage + existing-state + environment + repository + assumption ref + blockers + auditor + gate status + next action
- Evidence: Manifest section checklist

### RT-09 Builder Self-Approval Prevention
- Input: Both variants
- Procedure: Verify Builder self-check output
- Expected: PROJECT_INIT_STATUS = PENDING_INDEPENDENT_REVIEW; INDEPENDENT_REVIEW = PENDING; READY_FOR_IMPLEMENTATION = NO
- Evidence: Final machine-readable status block

### RT-10 Auditor Assignment
- Input: Both variants
- Procedure: Verify AUDITOR assigned before review gate
- Expected: AUDITOR = <role/agent>; if not assigned → INDEPENDENT_REVIEW = BLOCKED
- Evidence: AUDITOR field in manifest

### RT-11 Standalone Task Contract
- Input: Both variants
- Procedure: Verify TASK_CONTRACT artifact exists independently
- Expected: Task IDs + owners + completion criteria; not Manifest Next Steps substitute
- Evidence: TASK_CONTRACT artifact path

### RT-12 Final Verification Status Block
- Input: Both variants
- Procedure: Verify all machine-readable statuses use formal enum
- Expected: No ad-hoc statuses (e.g. PROVISIONAL_PASS); PROVISIONAL as separate field; unresolved Class A produces no PASS
- Evidence: Status block vocabulary audit

### RT-13 V1.0.0 Strengths Regression
- Input: Both variants
- Procedure: Verify all V1.0.0 strengths preserved
- Expected: requirement-driven, no fixed template, Candidate != Product, Temp disposable, Legacy non-runtime, Path/Ownership/Evidence/Recovery/independent review/Authorization Gate/multi-agent/autonomous handoff/assumption recording all present
- Evidence: Strength checklist

### RT-14 Referenced Path Reconciliation
- Input: Dirty Root
- Procedure: Classify all referenced paths
- Expected: ORPHAN_REFERENCED_PATH_COUNT = 0; UNKNOWN_REFERENCED_PATH_COUNT = 0; PREEXISTING_CLASSIFIED_PATH legal for Dirty
- Evidence: Referenced-path classification matrix

### RT-15 Unanswered Class A Blocking
- Input: Both variants, simulate Class A question with no user answer
- Procedure: Trigger Class A scenario (e.g. "multi-agent role separation model?" without answer)
- Expected: SCOPE_FROZEN = NO; PROJECT_INIT_STATUS = BLOCKED; BLOCK_REASON = UNRESOLVED_ARCHITECTURE_DECISION; READY_FOR_IMPLEMENTATION = NO; FILESYSTEM_DESIGN = BLOCKED (not PROVISIONAL_PASS)
- Evidence: Final status block + BLOCK_REASON

### RT-16 Absolute Path Semantics
- Input: Both variants
- Procedure: Verify documented-observed vs runtime-hardcoded distinction
- Expected: DOCUMENTED_ABSOLUTE_PATH allowed in manifest; RUNTIME_HARDCODED_MACHINE_PATH forbidden
- Evidence: Path Contract section

### RT-17 Verification Evidence Required
- Input: Both variants
- Procedure: Verify each blocking gate produces evidence
- Expected: FILESYSTEM_REALITY/MANIFEST_CONSISTENCY/CONTRACT_CONSISTENCY/GIT_TRUTH/GENERIC_SCAFFOLD_LEAKAGE each produce checkable evidence with validity four conditions met
- Evidence: Evidence artifacts per gate

### RT-18 Path Terminology
- Input: Both variants
- Procedure: Verify TOP_LEVEL/NESTED/DESIGNED/MATERIALIZED/DESIGNED_FUTURE/EXTERNAL/PREEXISTING_CLASSIFIED used precisely
- Expected: nested not counted as top-level; counts specify TOP_LEVEL_COUNT/NESTED_PATH_COUNT/TOTAL_DESIGNED_PATH_COUNT
- Evidence: Path inventory with explicit count types

### RT-19 Auditor Independence
- Input: Both variants
- Procedure: Verify Builder/Auditor role separation
- Expected: Builder produces implementation + self-test evidence; Auditor READ/VERIFY only; no same-owner chain
- Evidence: Role assignment record

### RT-20 Environment Consistency
- Input: Both variants, observe Python/Node
- Procedure: Verify provenance per observed runtime
- Expected: OBSERVATION_TIME/COMMAND/RESOLUTION_EXECUTABLE/VERSION_OUTPUT/VIRTUAL_ENV/CONDA_PREFIX/PATH_CONTEXT/STATUS for each observed runtime; PROJECT_REQUIREMENT vs MACHINE_OBSERVATION distinguished
- Evidence: Environment Baseline with full provenance

### RT-21 Disposable Workspace Traceability
- Input: Both variants
- Procedure: Verify temp/scratch paths trace to rule or requirement
- Expected: Each disposable path has explicit lifecycle/disposal condition
- Evidence: Disposable path register

### RT-22 Dirty Reality Model
- Input: Dirty Root
- Procedure: Verify Dirty Root 6 conditions
- Expected: All 6 V1.1.2 conditions met with evidence
- Evidence: Dirty Root reconciliation report

### RT-23 Authoritative Artifact Inventory
- Input: Both variants
- Procedure: Verify Final Inventory Ordering 9-step sequence
- Expected: FINAL DISK SCAN after all generation; SNAPSHOT_TYPE = FINAL_DISK_INVENTORY; inventory matches disk
- Evidence: Inventory + SNAPSHOT_TYPE field

### RT-24 Environment Observation Provenance
- Input: Both variants
- Procedure: Verify every observed claim has reproducible provenance
- Expected: All 8 provenance fields present; auditor can re-run COMMAND to confirm VERSION_OUTPUT
- Evidence: Provenance records

### RT-25 Clarification Evidence / Default Semantics
- Input: Both variants, produce one BLOCKING + one DEFAULTABLE clarification
- Procedure: Run Clarification Classification Algorithm
- Expected: classification_record_sha256 present; BLOCKING requires CONFIRMED/ACCEPTED_DEFAULT; user silence not ACCEPTED_DEFAULT; classification immutable once asked
- Evidence: Clarification records with all 13 fields

### RT-26 Evidence / Path Closure
- Input: Dirty Root with all 4 path classes
- Procedure: Run Origin Classification
- Expected: Every in-scope object classified PREEXISTING/MANAGED_GENERATED/EPHEMERAL_IGNORED; no UNEXPECTED_ARTIFACT; missing_path_count = 0
- Evidence: Origin Registry + reconciliation

### RT-27 Required Environment Provenance Completeness
- Input: Both variants, required runtime = Python
- Procedure: Verify required UNVERIFIED produces NOT_READY
- Expected: FOUND/NOT_FOUND/NOT_APPLICABLE/UNVERIFIED decisive; required + UNVERIFIED → NOT_READY
- Evidence: environment.required.json with statuses

### RT-28 Freeze / Final Verification Drift
- Input: Both variants, run STOP WRITING sequence
- Procedure: Snapshot A/B → Freeze → post-freeze rescan
- Expected: prefreeze_double_snapshot_match = true; freeze_manifest = Snapshot B; no post-freeze drift
- Evidence: snapshot-a.json, snapshot-b.json, freeze-manifest.json

### RT-29 Dirty Root + Protected PREEXISTING Drift
- Input: Dirty Root with classified-KEEP preexisting path
- Procedure: Verify PREEXISTING not promoted; KEEP requires requirement trace
- Expected: PREEXISTING_CLASSIFIED_PATH never becomes APPROVED by existing; sha256 unchanged after BUILD
- Evidence: Origin Registry classification + sha256 comparison

### RT-30 Cross-Case Runtime Behavior
- Input: Dirty Root, Class A unanswered + environment observation + freeze sequence
- Procedure: Full integrated run combining all subsystems
- Expected: Class A blocks correctly; freeze succeeds; evidence chain intact; no orphan/unknown paths
- Evidence: Full execution log + all evidence artifacts

---

## Builder Self-Test Procedure

1. Create Clean Root directory: `mkdir -p "C:/Users/ASUS/erp-presales-demo-v113-clean"`
2. Create Dirty Root directory with all fixtures
3. For each RT-01..RT-30, execute the Procedure above
4. Capture evidence artifacts in `C:/ProgramData/HermesProjectAnchors/project-initialization/v1.1.3-CCR001-L2/runtime-evidence/`
5. Produce Builder self-test log

---

## Evidence Artifact Paths (Builder-Owned)

All runtime evidence is stored under:
`C:/ProgramData/HermesProjectAnchors/project-initialization/v1.1.3-CCR001-L2/runtime-evidence/`

Structure:
```
runtime-evidence/
├── clean-root/
│   ├── rt-01-clarification/
│   ├── rt-03-filesystem-reality/
│   └── ...
├── dirty-root/
│   ├── rt-02-existing-state/
│   ├── rt-03-filesystem-reality/
│   └── ...
├── cross-case/
│   └── rt-30/
├── builder-self-test.log
└── evidence-chain-head.json
```

This document is Builder-owned evidence input for Validation Cycle 02.
