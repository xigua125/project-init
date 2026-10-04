---
name: project-initialization
description: Prepare project architecture before implementation.
version: "1.1.3"
author: "wangdeli, Hermes Agent"
license: "MIT"
platforms: [windows, linux, macos]
created_by: "agent"
metadata:
  hermes:
    tags: [project, architecture, planning, stage-0]
    category: software-development
    related_skills: [plan, architectural-delivery-workflow]
---

# Project Initialization Skill

Prepare a project before implementation so structural decisions are cheap to change. This skill standardizes the initialization process, not a fixed directory count or layout.

## When to Use

Use for a new formal project, a major subsystem with its own lifecycle, a multi-agent project, or a major architecture/storage restructuring. Also use when the user asks to initialize, scaffold, architect, or prepare a project before coding.

Do not run the full workflow for a tiny one-file edit, routine bug fix, or documentation-only correction unless it changes project architecture.

## Prerequisites

The user must provide at least a project goal. Use Hermes native `read_file`, `search_files`, `terminal`, `delegate_task` only when the task actually requires them.

Do not invent requirements to fill a template. Apply the Clarification Decision Threshold below BEFORE asking the user anything.

## Quick Reference

`Clarification Threshold -> Goal -> Scope -> Existing-State Preflight -> Filesystem -> Paths -> Data Flow -> Ownership -> Environment -> Acceptance -> Evidence -> Recovery -> Task Contract -> Independent Review -> Final Verification -> Authorization`

Never copy HVMS's six-directory layout or any other prior layout unless this project's requirements independently justify it.

## Clarification Decision Threshold

Classify every missing decision BEFORE asking. Never turn Stage 0 into a mass questionnaire.

| Class | Definition | Required Action |
|-------|------------|-----------------|
| A. Architecture-critical | Would materially change Scope, Filesystem, Data/Artifact Flow, Technical Architecture, Acceptance criteria, or an Irreversible decision | ASK USER — batch all Class A items into ONE clarification round |
| B. Important but safely inferable | A reasonable default is derivable from the project goal | RECOMMEND DEFAULT + RECORD ASSUMPTION in the Assumption Register; do not block Stage 0 |
| C. Implementation detail | Resolvable during implementation without structural impact | DEFER TO IMPLEMENTATION |
| D. Cosmetic / preference | No structural impact | DO NOT BLOCK |

Rules:
- Only Class A may block on user input, and all Class A questions must be batched into a single clarification round.
- Class B assumptions must be recorded with rationale and owner.
- When the user instructs autonomous progression, ask only genuinely architecture-critical Class A items; record everything else as assumptions and proceed.
- Never re-ask what the user already answered or what is derivable from given inputs.

**Unanswered Class A Rule (V1.1.1).** Class A means architecture-critical: the missing answer would materially change Scope, Filesystem, Data/Artifact Flow, Technical Architecture, Acceptance criteria, or an irreversible/high-cost decision. If a genuinely Class A question is asked and the user does NOT answer:
- It is FORBIDDEN to auto-select a default answer or downgrade it into an ordinary assumption.
- The question MUST be recorded as `QUESTION_STATE = UNRESOLVED_ARCHITECTURE_DECISION`, and Stage 0 outputs:
```
SCOPE_FROZEN = NO
PROJECT_INIT_STATUS = BLOCKED
BLOCK_REASON = UNRESOLVED_ARCHITECTURE_DECISION
READY_FOR_IMPLEMENTATION = NO
```
- While blocked, the only permitted continuation is PROVISIONAL DESIGN, explicitly marked:
```
PROVISIONAL = YES
NOT_AUTHORIZED_FOR_IMPLEMENTATION = YES
```
- A blocked Class A must not be declared SCOPE_FROZEN = YES, must not receive a final FILESYSTEM_DESIGN = PASS, and must not enter Authorization or Implementation.
- If a question can safely adopt a recommended default, it should have been classified Class B from the start — not Class A. Reclassify honestly rather than inventing answers.

**Clarification Classification Algorithm (V1.1.3).** Severity is BLOCKING or DEFAULTABLE. Classification MUST follow this precedence order with no agent discretion to override:
1. If the decision can affect scope, filesystem design, path contract, ownership, required environment, acceptance/evidence gates, recovery, implementation authorization, protected-preexisting handling, security, destructive action, or overwrite behavior → BLOCKING.
2. If the decision is not safely reversible → BLOCKING.
3. Only if every prior predicate is false AND an exact proposed default exists with recorded delegation scope → DEFAULTABLE.
4. Missing or ambiguous classification input → BLOCKING.

State flow: ASKED → ANSWERED_PENDING_DECISION → CONFIRMED | ACCEPTED_DEFAULT | PENDING_USER_CONFIRMATION | UNRESOLVED.
- User silence is NEVER ACCEPTED_DEFAULT.
- A user answer is NOT automatically confirmation of a derived decision.
- `ACCEPTED_DEFAULT` requires evidence that the Human explicitly accepted that exact default or previously delegated the recorded scope, and the decision falls within it.
- Default delegation applies ONLY to DEFAULTABLE and never silently covers destructive, overwrite, security, architecture, scope, authorization, recovery, acceptance-gate, or protected-preexisting handling.
- A required clarification resolves only through CONFIRMED or legitimate ACCEPTED_DEFAULT.

**Clarification Record Schema (V1.1.3).** Every material clarification MUST produce an immutable record containing:
```
question_id = <unique identifier>
classification_rule_version = <semver>
classification_inputs = <structured inputs used>
severity = BLOCKING | DEFAULTABLE
question = <exact question text>
proposed_default = <default or NULL>
user_answer = <exact user response or NULL>
delegation_scope = <scope of default delegation or NULL>
decision = <resolved decision or NULL>
status = CONFIRMED | ACCEPTED_DEFAULT | PENDING_USER_CONFIRMATION | UNRESOLVED
affected_artifacts = <list of affected artifacts or NULL>
blocking_gates = <list of gates blocked or NULL>
evidence_reference = <pointer to evidence or NULL>
classification_record_sha256 = <lowercase SHA256 over Section 9 canonical serialization of this record>
```
- A classification record is IMMUTABLE once first asked.
- Reclassification requires the Contract Change Procedure and a new question identifier; reclassification never retroactively legalizes a default.

## Clean-Root / Existing-State Preflight

Before designing ANY project structure, inspect the actual project root on disk.

MUST identify:
- existing files and directories
- hidden files (.git, .env, dotfiles)
- previous scaffold residue
- legacy template residue
- existing Git state (does .git exist?)

If the project root is EMPTY: record `EXISTING_STATE = EMPTY_ROOT` and proceed.

If the project root is NOT EMPTY:
- Do NOT inherit the existing structure by default.
- Classify EVERY existing project-level path as exactly one of:
  - `KEEP` — still valid under the new architecture
  - `MIGRATE` — content valid, location/structure wrong
  - `ARCHIVE` — historical value, no runtime role
  - `DELETE_CANDIDATE` — no value (actual deletion still requires user approval)
  - `BLOCKED` — cannot classify without user input
- Record the classification in PROJECT_INIT_MANIFEST (existing-state classification section).
- Filesystem freeze MUST NOT be declared until classification is complete.

## Procedure

### 1. Project Charter
Define problem, users, goals, deliverables, constraints, non-goals, and Definition of Done.

### 2. Scope Freeze
Record IN SCOPE, OUT OF SCOPE, assumptions, dependencies, open decisions, and backlog boundary. Apply the Clarification Decision Threshold to every open decision; classify each as A/B/C/D and act accordingly.

### 3. Existing-State Preflight
Run the Clean-Root / Existing-State Preflight above. Record results before any filesystem design.

### 4. Filesystem Design
Identify file classes and lifecycles from REQUIREMENTS, then derive the required directory tree. Do not begin from a fixed folder count.

Ask: what inputs are authoritative; what is code/config/runtime data; what is intermediate/candidate/final; where tests/logs/reports/evidence/audits/agent state live; what is disposable; whether models/databases/media/external stores exist; whether a separate control plane is needed; whether Legacy exists; and whether dev/prod need separate roots.

Hard rules (V1.0.0 strengths — preserved):
- Requirement-driven: every top-level path must trace to a requirement, deliverable, or data class in the Charter/Scope. No fixed directory count, no copied prior layout.
- Candidate is not Product; only an explicit promotion gate creates Product.
- Temp/cache/scratch must be safely disposable.
- Legacy may be retained but must not become a hidden runtime dependency.
- Reports/evidence/control state should not pollute a clean production area unless explicitly required.
- No agent may invent a new top-level directory after filesystem freeze without reviewed architecture change.
- Preserve historical evidence provenance.

V1.1.0 hard rules:

**No Generic Scaffold Leakage.** Do not create or retain generic scaffold paths without a requirement basis (e.g. `src/`, `docker/`, `migrations/`, `seeds/`, `config/`, `deliverables/`, `.env.example`, `.gitignore`). These NAMES are not forbidden — they are allowed ONLY when project requirements, the Path Contract, or the technical architecture explicitly need them. Never create them because of historical templates, personal habit, or generic project templates.

**Stage 0 Materialization Policy.** Distinguish:
- `DESIGNED_PATH` — appears in the approved architecture; may materialize in a later phase
- `MATERIALIZED_PATH` — actually created on disk now

Stage 0 materializes ONLY the minimum paths required to complete Stage 0 itself (typically the Stage 0 docs location). Do NOT pre-create empty implementation-phase directories to "look complete". Every materialized path must have an explicit justification in the manifest. Designed-but-not-yet-materialized paths must be declared as future artifacts.

**Path Terminology Rule (V1.1.1).** Use the terms precisely:
- `TOP_LEVEL_PATH` — a direct child of the project root
- `NESTED_PATH` — any path at depth ≥ 2 (e.g. `modules/sales/`)
- `DESIGNED_PATH` — appears in the approved architecture (top-level or nested)
- `MATERIALIZED_PATH` — actually exists on disk
- `DESIGNED_FUTURE_PATH` — designed, not yet created, registered as a future artifact
- `EXTERNAL_PATH` — outside the project root, declared in the Path Contract

Never count nested paths (e.g. `modules/*`) as top-level directories. Every count must state what it counts: `TOP_LEVEL_COUNT`, `NESTED_PATH_COUNT`, `TOTAL_DESIGNED_PATH_COUNT`.

**Disposable Workspace Traceability (V1.1.1).** If the filesystem contains temp/scratch/work-in-progress/candidate-workspace paths, each must trace to either the disposable temporary workspace rule of this skill (with the concrete lifecycle/disposal condition stated) or a specific project requirement. "Generic workspace" alone is not a valid justification.

**Filesystem Reality Gate (V1.1.2 — Clean/Dirty dual model).** Two reality models, selected by EXISTING_STATE:

**CLEAN ROOT model** (EXISTING_STATE = EMPTY_ROOT): the approved materialized state must equal the approved materialized registry:
```
APPROVED_MATERIALIZED_REGISTRY == ACTUAL_APPROVED_MATERIALIZED_STATE
```
No unregistered extra project paths may appear. Any on-disk project-level path not recorded in the approved architecture → FAIL.

**DIRTY ROOT model** (EXISTING_STATE = NON_EMPTY_DIRTY_ROOT): the ACTUAL ROOT may legally contain APPROVED_MATERIALIZED_PATH + PREEXISTING_CLASSIFIED_PATH. It is FORBIDDEN to use "entire physical root == approved architecture" as the Dirty Root PASS condition. FILESYSTEM_REALITY = PASS requires ALL of:
1. Every approved materialized path actually exists on disk;
2. Every preexisting retained path is registered in the Existing-State Register (classified KEEP/MIGRATE/ARCHIVE/DELETE_CANDIDATE/BLOCKED);
3. No UNKNOWN physical path (every physical path is either approved or preexisting-classified);
4. No unauthorized promotion of a PREEXISTING path into APPROVED (PREEXISTING_CLASSIFIED_PATH never becomes APPROVED merely by existing — only a KEEP decision with a current-requirement trace admits it into the approved architecture);
5. No unauthorized destructive cleanup (DELETE_CANDIDATE/ARCHIVE remain on disk pending user-approved PROPOSED_ACTION);
6. No DESIGNED_FUTURE_PATH prematurely materialized without explicit authorization.

**Path Classification Model (V1.1.2).** The complete legal classification vocabulary for referenced and physical paths:
- `MATERIALIZED_PATH` — approved, exists on disk, registered in FILESYSTEM_ARCHITECTURE + PROJECT_INIT_MANIFEST
- `DESIGNED_FUTURE_PATH` — approved, not yet created, registered as future in both registries
- `EXTERNAL_PATH` — outside the project root, declared in PATH_CONTRACT
- `PREEXISTING_CLASSIFIED_PATH` — existed before project initialization began, actually discovered by the Existing-State Preflight, and registered/classified in the Existing-State Register as KEEP / MIGRATE / ARCHIVE / DELETE_CANDIDATE / BLOCKED. It does NOT become APPROVED by existing.
- `ORPHAN_REFERENCED_PATH` — referenced but nonexistent, not registered future, not external, not preexisting-classified → CONTRACT_CONSISTENCY = FAIL
- `UNKNOWN_REFERENCED_PATH` — referenced with no classification at all → CONTRACT_CONSISTENCY = FAIL

**Origin Classification (V1.1.3).** Every in-scope filesystem object MUST be classified as exactly one of:
- `PREEXISTING` — existed before BUILD began, discovered by Existing-State Preflight
- `MANAGED_GENERATED` — produced by authorized BUILD activities
- `EPHEMERAL_IGNORED` — safely disposable working state outside audit scope

An in-scope object without a legal classification is UNEXPECTED_ARTIFACT and blocks PASS. Before BUILD, an Origin Registry MUST record every existing relevant object with its origin classification and identity fields.

**Scope Spec (V1.1.3).** Before BUILD, create a scope specification file containing:
```
schema_version = "1.0.0"
scope_root = <project root relative path>
included_patterns = <list of explicit project-relative paths to include>
protected_preexisting_paths = <list of paths forbidden for Builder modification>
verification_workspace = <absolute path outside audited root>
path_policy = {
  canonical_separator = "/"
  case_collision_policy = "WINDOWS_ORDINAL_IGNORE_CASE"
  encoding = "UTF-8"
  symlink_policy = "DO_NOT_FOLLOW"
}
```
Record `scope_spec_sha256` over the Section 9 canonical bytes. Store in an append-only external anchor location outside the audited root and Builder write authority. BUILD authorization is false until the scope spec anchor is verified.

**Ignore Spec (V1.1.3).** Before BUILD, create an ignore specification file containing:
```
schema_version = "1.0.0"
entries = [
  {
    pattern = <glob or regex pattern>
    reason = <justification>
    origin = <why this pattern exists>
    approved_stage = <phase authorized>
  }
]
```
Record `ignore_spec_sha256` over the Section 9 canonical bytes. Store in an append-only external anchor location outside the audited root. Ignore patterns equivalent to `**/*` are forbidden unless the contract explicitly permits an empty scope.

**Origin Registry (V1.1.3).** Before BUILD, scan the audited root and create an Origin Registry file containing:
```
schema_version = "1.0.0"
audited_root_identity = <absolute path>
existing_state = EMPTY_ROOT | NON_EMPTY_DIRTY_ROOT
entries = [
  {
    relative_path = <project-relative path using "/">
    file_type = file | directory | symlink
    size = <integer, null for directories/symlinks>
    mode = <POSIX mode or "UNSUPPORTED" on Windows>
    sha256 = <lowercase hex SHA256 of raw file bytes, null for directories/symlinks>
    origin_classification = PREEXISTING | MANAGED_GENERATED | EPHEMERAL_IGNORED
    existing_state_classification = KEEP | MIGRATE | ARCHIVE | DELETE_CANDIDATE | BLOCKED | NULL
    symlink_target = <target string if file_type=symlink, null otherwise>
  }
]
```
- Every in-scope object MUST have an entry.
- `size` and `sha256` MUST match actual disk bytes exactly — no estimates, no rounding.
- Record `origin_registry_sha256` over Section 9 canonical bytes.

**Materialized Registry (V1.1.3).** Before BUILD, create an Approved Materialized Registry file containing:
```
schema_version = "1.0.0"
entries = [
  {
    relative_path = <project-relative path>
    file_type = file | directory
    size = <integer or null>
    sha256_expectation = CAPTURE_AT_FREEZE | <exact sha256>
    status = MATERIALIZED_PATH | DESIGNED_FUTURE_PATH
    ownership = BUILDER_DURING_BUILD_ONLY | ...
    approved_design_reference = <PB-XX or NULL>
  }
]
```
Record `materialized_registry_sha256` over Section 9 canonical bytes. For Clean Root: ACTUAL state must equal this registry exactly. For Dirty Root: retained PREEXISTING objects remain separate from approved materialized objects.

**Builder STOP WRITING (V1.1.3).** The Builder MUST announce STOP WRITING before the Validator establishes Freeze. After STOP WRITING:
- Builder writes NO further changes to the audited project scope.
- Builder writes NO further changes to the Origin/Materialized Registries.
- Builder may ONLY generate evidence artifacts in external locations outside audited scope.
- Any Builder write to protected scope after STOP WRITING triggers BUILDER_WRITE_AFTER_STOP and invalidates Freeze.

**PRE_FREEZE Snapshot A/B (V1.1.3).** After STOP WRITING, the Validator MUST:
1. Scan the resolved audited root into PRE_FREEZE_SNAPSHOT_A
2. Generate all candidate manifest/evidence artifacts outside audited root
3. Independently rescan the same root into PRE_FREEZE_SNAPSHOT_B
4. Compute exhaustive A/B diff (sorted union of canonical paths, comparing type/size/mode/sha256/origin-classification/symlink-target)
5. ONLY if A/B diff is empty, establish FREEZE

Any A/B difference produces BUILDER_WRITE_AFTER_STOP and prevents Freeze.

**Freeze Manifest (V1.1.3).** The Freeze Manifest file MUST contain:
```
schema_version = "1.0.0"
audited_root_identity = <absolute path>
scope_spec_sha256 = <hex>
ignore_spec_sha256 = <hex>
origin_registry_sha256 = <hex>
materialized_registry_sha256 = <hex>
snapshot_id = <unique>
snapshot_time = <UTC RFC 3339>
entries = [
  {
    relative_path = <project-relative path>
    file_type = file | directory | symlink
    size = <integer or null>
    mode = <mode or "UNSUPPORTED">
    sha256 = <hex or null>
    origin_classification = PREEXISTING | MANAGED_GENERATED | EPHEMERAL_IGNORED
    symlink_target = <string or null>
  }
]
```
- The manifest is exactly the Section 9 canonical serialization of PRE_FREEZE_SNAPSHOT_B.
- Any deviation from Snapshot B produces FREEZE_MANIFEST_INVALID.

**Evidence Hash Chain (V1.1.3).** All evidence artifacts MUST be tracked in an append-only hash chain:
```
GENESIS_EVIDENCE_HASH = 64 ASCII zeroes
Each record: {
  schema_version, evidence_id, sequence_number, timestamp,
  evidence_type, payload_hash, previous_evidence_hash,
  producer, producer_identity_hash, record_hash
}
record_hash = lowercase_hex(SHA256(JCS_UTF8(record_without_record_hash) || 0x0A))
```
- Append-only: delete/modify/overwrite/reorder produces EVIDENCE_TAMPERED.
- Chain head is anchored in an independent external location.

**Environment Required Statuses (V1.1.3).** For each required environment observation:
- `FOUND` — runtime present and meets expected condition; record full provenance (OBSERVATION_TIME, COMMAND, RESOLVED_EXECUTABLE, VERSION_OUTPUT, VIRTUAL_ENV, CONDA_PREFIX, PATH_CONTEXT, STATUS)
- `NOT_FOUND` — required runtime absent; if required expected-present → FAIL
- `NOT_APPLICABLE` — optional runtime not needed; requires reason + evidence
- `UNVERIFIED` — observation attempted but inconclusive; required + UNVERIFIED → NOT_READY, never PASS

Distinguish PROJECT_REQUIREMENT from MACHINE_OBSERVATION: a runtime merely present on the machine must never be written as a project REQUIRED baseline.

**VERIFICATION_SIDE_EFFECT Handling (V1.1.3).** Verification must produce zero protected-project side effects. Any protected mutation produces VERIFICATION_SIDE_EFFECT and blocks PASS. Verification artifacts (logs, caches, temporary files) MUST be stored outside audited scope or in predeclared EPHEMERAL_IGNORED locations.

**UNVERIFIED Blocking (V1.1.3).** `required_UNVERIFIED` produces NOT_READY, never PASS. A verification gate that produces no checkable evidence is UNVERIFIED and must not be treated as PASS. This applies to all blocking gates: FILESYSTEM_REALITY, MANIFEST_CONSISTENCY, CONTRACT_CONSISTENCY, GIT_TRUTH, GENERIC_SCAFFOLD_LEAKAGE.

**Remediation Ticket Schema (V1.1.3).** Each remediation ticket MUST record:
```
finding_id = <unique identifier>
severity = BLOCKING | NON_BLOCKING
rule_violated = <contract rule reference>
affected_path = <path or NULL>
evidence_path = <path to evidence or NULL>
expected = <expected state>
actual = <actual state>
```

### 5. Path Contract
Define project-root resolution, configuration paths, environment variables, external resources, and portability rules.

**Absolute Path Semantics (V1.1.1).** Distinguish:
- `DOCUMENTED_ABSOLUTE_PATH` — an observed real path recorded as fact (e.g. the project root `C:\Users\ASUS\project-name`). Documenting it is ALLOWED in PROJECT_INIT_MANIFEST, EXISTING_STATE, PROJECT_CHARTER, audit evidence, diagnostics, and environment observation.
- `RUNTIME_HARDCODED_MACHINE_PATH` — code, scripts, config, or runtime logic depending on a machine-specific personal absolute path. This is FORBIDDEN unless the dependency is an explicit requirement, recorded in the Path Contract, and approved.

Rule: **Documenting an observed absolute path is allowed. Depending on a machine-specific absolute path at runtime is forbidden unless explicitly required and approved.** Never conflate the two.

**Referenced Path Declaration Rule (V1.1.2).** Every project path referenced by any Stage 0 Contract must be exactly one of:
- `MATERIALIZED_PATH` — exists on disk AND registered in FILESYSTEM_ARCHITECTURE + PROJECT_INIT_MANIFEST
- `DESIGNED_FUTURE_PATH` — not yet created but explicitly registered as a future artifact in FILESYSTEM_ARCHITECTURE + PROJECT_INIT_MANIFEST
- `EXTERNAL_PATH` — outside the project root AND explicitly declared in PATH_CONTRACT
- `PREEXISTING_CLASSIFIED_PATH` — registered and classified in the Existing-State Register (in a Dirty Root, referencing a classified legacy path is legal and must NOT be misjudged as an orphan)

Forbidden: an `ORPHAN_REFERENCED_PATH` — a contract references a path that does not exist, is not registered as future, is not external, and is not preexisting-classified. One orphan referenced path → `CONTRACT_CONSISTENCY = FAIL`. Also forbidden: `UNKNOWN_REFERENCED_PATH` (referenced with no classification). Contract-to-disk consistency: the Path Contract (and all other Stage 0 contracts) must not reference a directory, environment variable, dependency file, repository, database, runtime, or backup location that does not exist AND is not explicitly declared as a future artifact.

### 6. Data / Artifact Flow
Map authoritative inputs through intermediate/candidate outputs to accepted products.

### 7. Ownership Contract
Define OWNER, READERS, WRITERS, promotion authority, retention, backup, and delete policy for critical areas.

### 8. Environment Baseline
Record OS/runtime/tool/model/database/API versions and reproducible checks. Record repository state truthfully (see Git Truth Rule).

**Environment-Filesystem Consistency (V1.1.1).** The Environment Baseline must agree with the Filesystem Architecture. It is a contradiction for one contract to declare "no script requirement" while another declares "Python required for data processing scripts". If a runtime/tool is only possibly needed later, declare `RUNTIME_STATUS = OPTIONAL` or `RUNTIME_STATUS = FUTURE` with the trigger condition, aligned with the filesystem design. Git state must be stated consistently across ALL contracts: if `REPOSITORY_STATE = NOT_INITIALIZED` in one, no other contract may write Git = UNKNOWN / assumed / local repository.

**Environment Observation Provenance (V1.1.2).** Every observed environment/runtime claim MUST carry provenance. For a runtime like Python, record at least:
```
OBSERVATION_TIME = <timestamp>
COMMAND = <e.g. python --version>
RESOLVED_EXECUTABLE = <absolute path of the executable actually invoked>
VERSION_OUTPUT = <raw command output>
VIRTUAL_ENV = <value or NONE>
CONDA_PREFIX = <value or NONE>
PATH_CONTEXT = <relevant resolver context, where practical>
STATUS = OBSERVED
```
An unprovenanced version claim ("Python 3.11.15" with no command/executable/output) is an environment-baseline violation. Distinguish PROJECT_REQUIREMENT from MACHINE_OBSERVATION: a runtime that merely happens to exist on the machine must never be written as a project REQUIRED baseline. If a runtime is not actually needed, record `RUNTIME_STATUS = OPTIONAL | FUTURE | NOT_REQUIRED` instead of a version claim.

**Environment Drift Rule (V1.1.2).** Machine observations can change between baseline time and Final Verification. If a Final-Verification observation differs from the earlier baseline, it is FORBIDDEN to silently keep the old value and PASS. The agent MUST either re-observe and update with explainable provenance, or mark the field DRIFT / UNVERIFIED and record the discrepancy. Unexplained drift at Final Verification → ENVIRONMENT_BASELINE = UNVERIFIED (not PASS).

### 9. Acceptance & Evidence Gates
Define tests, QA, independent audit evidence, PASS/FAIL criteria, and promotion rules before implementation.

### 10. Recovery Design
Define backup, rollback, migration, crash recovery, and Legacy isolation.

**Git Truth Rule.** Never assume the project uses Git.
- If `.git` does not exist, repository state MUST be recorded as `NOT_INITIALIZED` (or an explicit equivalent).
- Any recovery operation that depends on Git commit/tag must either:
  - have Git initialization already authorized, OR
  - be listed as a future action, OR
  - be replaced by a non-Git rollback strategy.
- Writing non-existent Git state as fact is a contract-consistency violation.

### 11. Task Contract
Stage 0 MUST produce a standalone TASK_CONTRACT artifact. Manifest "Next Steps" cannot implicitly substitute for it. The Task Contract defines how implementation work is dispatched, reported, audited, remediated, and resumed — including task IDs, owners, and completion criteria.

### 12. Independent Review

**Auditor Assignment.** Before entering the Independent Review gate, an auditor must exist:
```
AUDITOR = <assigned role/agent>
```
If no independent auditor is assigned:
```
INDEPENDENT_REVIEW = BLOCKED
BLOCK_REASON = AUDITOR_NOT_ASSIGNED
READY_FOR_IMPLEMENTATION = NO
```

**Builder Self-Approval Prevention.** When the Builder completes the Stage 0 self-check:
- If INDEPENDENT_REVIEW != PASS, then PROJECT_INIT_STATUS MUST NOT be final PASS. Use:
```
PROJECT_INIT_STATUS = PENDING_INDEPENDENT_REVIEW
INDEPENDENT_REVIEW = PENDING
READY_FOR_IMPLEMENTATION = NO
```
- Only the Independent Reviewer can set INDEPENDENT_REVIEW = PASS.
- Only after that can the PM/Orchestrator declare final Stage 0 PASS.

An auditor reviews Stage 0 without silently repairing it.

**Auditor Independence (V1.1.1).** Role production boundaries:
- Builder: produces implementation artifacts, self-tests, and builder QA evidence.
- Independent Auditor: READ, VERIFY, produce independent audit evidence, produce independent audit report. The Auditor must NOT be the production OWNER of any implementation artifact or builder QA artifact under audit.

Forbidden chain: Auditor produces artifact → Auditor audits the same artifact → Auditor approves the same artifact. Independent audit evidence/report itself MAY be created by the Auditor — that is the Auditor's own deliverable, not an artifact under audit.

For multi-agent projects use role separation:
- PM/Orchestrator owns authoritative state, routing, and transitions.
- Builder implements and self-tests; cannot grant final acceptance.
- Independent Auditor verifies evidence and PASS/FAIL; cannot silently fix and self-approve.
- Specialist performs bounded expert tasks only when dispatched.

Preferred flow:
`PM -> Task Contract -> Builder -> Independent Audit -> PASS/CLOSED`

Failure flow:
`Audit -> Remediation -> Re-audit`

Do not make the user manually relay routine handoffs when orchestration can safely perform them.

### 13. Final Verification

**Final Inventory Ordering (V1.1.2).** Final Verification MUST execute in this order:
1. Generate Stage 0 Contracts
2. Generate Verification Evidence
3. Freeze / finalize the evidence set
4. Perform the FINAL DISK SCAN (after all artifact generation has stopped)
5. Build/update the AUTHORITATIVE_ARTIFACT_INVENTORY from the final scan
6. Reconcile the Manifest against the FINAL disk state
7. Reconcile referenced paths/artifacts
8. Evaluate blocking gates
9. Write the final machine-readable status

It is FORBIDDEN to take an "final" file inventory, then keep generating evidence, and still declare PASS against the stale inventory. Any mid-run snapshot MUST be explicitly marked `SNAPSHOT_TYPE = INTERMEDIATE` and must never be presented as FINAL_DISK_INVENTORY.

**AUTHORITATIVE_ARTIFACT_INVENTORY (V1.1.2).** The Manifest's artifact inventory MUST cover ALL Stage 0 authoritative outputs, not only the Markdown contracts:
- Stage 0 Contracts
- Final Verification Evidence (every evidence artifact produced by the Final Verification)
- Any other artifacts formally generated and retained by Stage 0

Every evidence artifact entry MUST record: path, artifact type, ownership (producer), purpose, and status — and be reconcilable against the actual disk. An evidence file that exists on disk but is missing from the inventory, or is inventoried but absent on disk, is a MANIFEST_CONSISTENCY failure.

Immediately before the Authorization Gate, execute ALL of:
1. Actual filesystem reconciliation (Filesystem Reality Gate — Clean/Dirty model per EXISTING_STATE)
2. Manifest reconciliation (every manifest field matches FINAL disk facts)
3. Contract consistency check (PROJECT_CHARTER ↔ FILESYSTEM_ARCHITECTURE ↔ PATH_CONTRACT ↔ DATA_ARTIFACT_FLOW ↔ OWNERSHIP_CONTRACT ↔ ENVIRONMENT_BASELINE ↔ BACKUP_ROLLBACK_RECOVERY ↔ PROJECT_INIT_MANIFEST ↔ ACTUAL FILESYSTEM)
4. Generic scaffold leakage check
5. Git truth check
6. Unresolved blocker check

**Verification Evidence Rule (V1.1.1, tightened V1.1.2).** A blocking verification gate must NEVER be declared PASS on assertion alone. Each must produce checkable evidence:
- `FILESYSTEM_REALITY` → actual paths vs approved/preexisting registries reconciliation (per Clean/Dirty model)
- `MANIFEST_CONSISTENCY` → manifest fields + AUTHORITATIVE_ARTIFACT_INVENTORY vs actual disk reconciliation
- `CONTRACT_CONSISTENCY` → referenced-path reconciliation + environment-variable reconciliation + dependency/runtime reconciliation
- `GIT_TRUTH` → observed repository state (command output)
- `GENERIC_SCAFFOLD_LEAKAGE` → unexpected-path scan result

Evidence validity (V1.1.2): an evidence artifact is valid ONLY if it (a) actually exists on disk, (b) its content supports the gate decision, (c) it is registered in the AUTHORITATIVE_ARTIFACT_INVENTORY, and (d) it belongs to the FINAL disk reconciliation (not an INTERMEDIATE snapshot). Missing any of these → the gate must NOT be PASS.

For CONTRACT_CONSISTENCY, the referenced-path reconciliation MUST scan all project paths referenced across Stage 0 Contracts and classify each as `MATERIALIZED_PATH` / `DESIGNED_FUTURE_PATH` / `EXTERNAL_PATH` / `PREEXISTING_CLASSIFIED_PATH` / `ORPHAN_REFERENCED_PATH` / `UNKNOWN_REFERENCED_PATH`. If `ORPHAN_REFERENCED_PATH_COUNT > 0` or `UNKNOWN_REFERENCED_PATH_COUNT > 0` → `CONTRACT_CONSISTENCY = FAIL`.

If a verification gate produces no evidence, its status is `UNVERIFIED` — PASS must not be written. A PASS without evidence is an overclaim and a contract-consistency violation.

### 14. Authorization Gate
Implementation starts only when all applicable blocking Stage 0 items pass.

## Required Stage 0 Artifacts

Adapt names and combine documents when appropriate, but cover:
- PROJECT_CHARTER
- REQUIREMENTS_SCOPE (with Assumption Register)
- EXISTING_STATE_CLASSIFICATION (when root is non-empty)
- FILESYSTEM_ARCHITECTURE (with DESIGNED_PATH / MATERIALIZED_PATH marking)
- PATH_CONTRACT
- DATA_ARTIFACT_FLOW
- AGENT_OWNERSHIP when multi-agent
- ENVIRONMENT_BASELINE
- ACCEPTANCE_GATES
- EVIDENCE_POLICY
- BACKUP_ROLLBACK_RECOVERY
- TASK_CONTRACT (standalone, mandatory)
- PROJECT_INIT_MANIFEST (authoritative)

A compact project may combine sections into one Stage 0 document if every applicable gate remains explicit.

## Authoritative Manifest

PROJECT_INIT_MANIFEST is the single source of truth and MUST contain at least:
- project root
- AUTHORITATIVE_ARTIFACT_INVENTORY — covering Stage 0 Contracts AND Final Verification Evidence AND every other formally retained Stage 0 artifact (each entry: path, artifact type, ownership/producer, purpose, status), reconcilable against the FINAL disk
- approved filesystem inventory (designed vs materialized), with top-level and nested paths counted separately (TOP_LEVEL_COUNT / NESTED_PATH_COUNT / TOTAL_DESIGNED_PATH_COUNT)
- referenced-path classification coverage: every project path referenced by any Stage 0 contract appears as MATERIALIZED_PATH, DESIGNED_FUTURE_PATH, EXTERNAL_PATH, or PREEXISTING_CLASSIFIED_PATH (zero orphans, zero unknowns)
- existing-state classification (or EMPTY_ROOT)
- environment state (with observation provenance for observed claims)
- repository state (truthful Git state)
- assumption register reference
- unresolved blockers
- independent reviewer (AUDITOR, or NOT_ASSIGNED)
- gate status
- next action

The manifest MUST match disk facts. A manifest asserting states that are false on disk is a MANIFEST_CONSISTENCY failure.

## Verification

**Status Vocabulary Rule (V1.1.2).** All machine-readable statuses MUST come from the formal enums defined here. Agents MUST NOT invent ad-hoc status values (e.g. `PROVISIONAL_PASS` is FORBIDDEN). GATE_STATUS vocabulary:
```
GATE_STATUS = PASS | FAIL | BLOCKED | UNVERIFIED | N/A
```
`PROVISIONAL` is NOT a gate status. It is an independent orthogonal field:
```
PROVISIONAL = YES | NO
```
Example of correct usage: `FILESYSTEM_DESIGN = BLOCKED` + `PROVISIONAL = YES`. Example of FORBIDDEN usage: `FILESYSTEM_DESIGN = PROVISIONAL_PASS`. An unresolved Class A question must never produce any form of PASS (no PASS, no provisional-PASS, no qualified PASS).

End initialization with a machine-readable gate:

```text
PROJECT_INIT_STATUS =
  PENDING_INDEPENDENT_REVIEW | PASS | FAIL | BLOCKED
SCOPE_FROZEN = YES | NO
PROVISIONAL = YES | NO
FILESYSTEM_DESIGN = PASS | FAIL | BLOCKED | UNVERIFIED | N/A
FILESYSTEM_REALITY = PASS | FAIL | BLOCKED | UNVERIFIED
MANIFEST_CONSISTENCY = PASS | FAIL | UNVERIFIED
CONTRACT_CONSISTENCY = PASS | FAIL | UNVERIFIED
GENERIC_SCAFFOLD_LEAKAGE = YES | NO
PATH_CONTRACT = PASS | FAIL | N/A
OWNERSHIP = PASS | FAIL | N/A
ENVIRONMENT_BASELINE = PASS | FAIL | UNVERIFIED
ACCEPTANCE_GATES = PASS | FAIL
ROLLBACK_RECOVERY = PASS | FAIL
RECOVERY_READINESS = READY | NO_BACKUP_YET | UNVERIFIED
REPOSITORY_STATE = INITIALIZED | NOT_INITIALIZED | N/A
ORPHAN_REFERENCED_PATH_COUNT = <integer>
UNKNOWN_REFERENCED_PATH_COUNT = <integer>
SNAPSHOT_TYPE = INTERMEDIATE | FINAL_DISK_INVENTORY
AUDITOR_ASSIGNED = YES | NO
INDEPENDENT_REVIEW = PASS | FAIL | PENDING | BLOCKED
READY_FOR_IMPLEMENTATION = YES | NO
```

`UNVERIFIED` means the gate produced no checkable evidence (or evidence failed validity checks under the Verification Evidence Rule); it must not be treated as PASS. `BLOCKED` means an unresolved prerequisite (e.g. unresolved Class A decision) prevents the gate from being evaluated. Evidence-producing rules per gate: see Verification Evidence Rule under Final Verification.

READY_FOR_IMPLEMENTATION = YES only when ALL of:
- FILESYSTEM_REALITY = PASS
- MANIFEST_CONSISTENCY = PASS
- CONTRACT_CONSISTENCY = PASS
- GENERIC_SCAFFOLD_LEAKAGE = NO
- AUDITOR_ASSIGNED = YES
- INDEPENDENT_REVIEW = PASS
- and every other applicable blocking gate passes.

If information is incomplete but safely deferrable, record the assumption and owner. Prefer the smallest architecture satisfying current requirements with clear extension points.

## Pitfalls

Do not impose a fixed directory template. Do not create scaffold paths without a requirement basis. Do not pre-materialize implementation-phase directories during Stage 0. Do not let the documented design and the disk disagree. Do not write non-existent Git state as fact. Do not let a Builder self-approve. Do not treat Candidate as Product. Do not let temporary files become authoritative. Do not let Legacy become a runtime dependency. Do not begin coding merely because a plan exists. Do not turn Stage 0 into a mass questionnaire when safe defaults exist. Do not substitute Manifest Next Steps for a real Task Contract. Do not downgrade an unanswered Class A question into an ordinary assumption. Do not reference a project path that is neither materialized, registered future, external, nor preexisting-classified (orphan/unknown referenced path). Do not conflate documenting an observed absolute path with runtime machine-specific hardcoding. Do not declare a blocking gate PASS without checkable evidence (UNVERIFIED instead). Do not count nested paths as top-level directories. Do not let Environment Baseline contradict Filesystem Architecture. Do not let the Independent Auditor own production of the artifacts it audits. Do not apply the Clean-Root equality rule to a Dirty Root (use the Dirty Reality model). Do not promote a PREEXISTING path into APPROVED merely because it exists. Do not inventory only Markdown contracts while omitting verification evidence. Do not declare PASS against a stale pre-final disk snapshot. Do not invent ad-hoc status values (PROVISIONAL_PASS forbidden; PROVISIONAL is a separate field). Do not record environment versions without observation provenance, and do not silently PASS over environment drift. Do not skip the clarification classification algorithm or omit required clarification record fields. Do not treat required UNVERIFIED as PASS. Do not fail to classify every in-scope object as PREEXISTING, MANAGED_GENERATED, or EPHEMERAL_IGNORED. Do not write to protected scope after STOP WRITING. Do not establish Freeze without empty A/B diff. Do not omit sha256/size from Origin Registry entries. Do not store verification artifacts inside audited scope.

After Stage 0 approval, material architecture changes require the reason, affected contracts, path/data/agent/test/product impact, migration and rollback when applicable, independent review, and an updated authoritative manifest.

## Regression Evidence

V1.0.0 functional test (project `C:/Users/ASUS/erp-presales-demo/`, 2026-09-21) failed on: FILESYSTEM_REQUIREMENT_DRIVEN, FIXED_DIRECTORY_TEMPLATE, OVER_ENGINEERING, MANIFEST_CONSISTENCY (fictitious Git state, premature PASS statuses, references to non-existent scripts). That failed test project MUST be preserved as-is as regression evidence; when remediating the skill, do not repair the failed test project in place.

V1.1.0 Round A regression test (project `C:/Users/ASUS/erp-presales-demo-v110-clean/`, 2026-09-21, OpenCode + DeepSeek independent audit) failed on: CONTRACT_CONSISTENCY (EVIDENCE_POLICY referenced `stage-0/evidence/*` subdirectories that were neither materialized, registered as DESIGNED_FUTURE, nor external → ORPHAN_REFERENCED_PATH; unanswered Class A questions were downgraded to ordinary assumptions and Scope declared frozen; Final Verification declared CONTRACT_CONSISTENCY = PASS without reconciliation evidence). That failed test project MUST likewise be preserved as-is as regression evidence; do not repair it in place. V1.1.1 patches (referenced-path declaration, unanswered Class A blocking, absolute path semantics, verification evidence, terminology, environment consistency, auditor independence) remediate these findings.

V1.1.1 final regression (Clean Root `erp-presales-demo-v111-clean/` + Dirty Root `erp-presales-demo-v111-dirty/`, 2026-09-21, independent Codex audit) passed all functional rounds but the audit found 4 P1 defects in the skill text itself: (P1-1) Filesystem Reality Gate used unconditional Clean-Root equality semantics with no formal PREEXISTING_CLASSIFIED_PATH class or Dirty Reality model; (P1-2) the Manifest artifact inventory covered only Markdown contracts, omitting Final Verification evidence, with no final-inventory ordering or INTERMEDIATE snapshot semantics; (P1-3) agents produced ad-hoc status values (e.g. `FILESYSTEM_DESIGN = PROVISIONAL_PASS`) outside the defined enum; (P1-4) environment observations lacked provenance (no command/executable/output recorded), enabling unexplained version drift. All four test projects are immutable regression evidence. V1.1.2 patches: Clean/Dirty dual reality model + PREEXISTING_CLASSIFIED_PATH, AUTHORITATIVE_ARTIFACT_INVENTORY + Final Inventory Ordering + SNAPSHOT_TYPE, formal GATE_STATUS enum with PROVISIONAL as an orthogonal field, Environment Observation Provenance + Drift Rule.

P2 backlog (recorded, non-blocking): P2-A — historical aggregate MD5 baselines should additionally record an ordered file list, hash composition algorithm, and baseline artifact for provenance; P2-B — recovery status should expose `CURRENT_RECOVERY_READINESS = READY | NO_BACKUP_YET | UNVERIFIED` (enum value already added to the status block in V1.1.2; full rollout is backlog).

V1.1.3 targeted hardening (lineage V1.1.3-CCR001-L2, 2026-10-02) closes four P1 classes identified in Production Validation #01: (P1-1) Clarification evidence/default semantics not formally linked to user answer/delegation/decision/status; (P1-2) Evidence/path closure not deterministic (origin classification, UNVERIFIED blocking, unexpected artifact detection); (P1-3) Required environment provenance completeness; (P1-4) Remediation ticket structure. V1.1.3 patches: clarification classification algorithm (BLOCKING/DEFAULTABLE) + immutable clarification record schema, origin classification (PREEXISTING/MANAGED_GENERATED/EPHEMERAL_IGNORED), UNVERIFIED blocking propagation, remediation ticket schema. All four V1.1.2 test projects remain immutable regression evidence. RT-01..RT-24 unchanged; RT-25..RT-30 new. V1.1.2 remains Historical Baseline. Validation Cycle 01 was FAIL (historical immutable); remediation targets VAL-02 and VAL-03 only.