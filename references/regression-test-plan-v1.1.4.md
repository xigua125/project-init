# V1.1.4 Regression Test Plan

Status: CANDIDATE

V1.1.4 preserves RT-01..RT-30 from V1.1.3 unchanged and adds RT-31..RT-38 for the control-plane clarification and integrated validation.

## V1.1.4 executable profile clarification

"Unchanged" preserves the identifiers, inputs, and PASS/FAIL semantics of RT-01..RT-30. It does not reuse the V1.1.3 project roots, evidence directories, authorization records, or candidate lineage named by the V1.1.3 runtime specification.

Every V1.1.4 regression execution MUST declare one new `candidate_lineage_id` and these distinct locations before pre-BUILD authorization:

- Clean audited root: a new empty directory dedicated to that lineage;
- Dirty audited root: a new directory dedicated to that lineage and populated from the specified seven-file fixture;
- Verification Workspace and evidence storage: outside both audited roots;
- independent anchor store: outside both audited roots, the Verification Workspace, evidence-log storage, and Builder write authority.

The concrete resolved paths are recorded in the lineage manifest and anchored Scope/Ignore records. No V1.1.3 path or failed V1.1.4 lineage may be used as a writable fixture or evidence destination.

`Builder write authority` is the logical role/authorized-write-set boundary defined by Execution Contract V1.4. The same OS identity may run distinct recorded logical role/agent instances. OS isolation is optional preferred high-assurance evidence; its absence alone does not block default PASS and is recorded as non-high-assurance.

The canonical environment provenance field is `RESOLVED_EXECUTABLE`. The historical `RESOLUTION_EXECUTABLE` spelling in the V1.1.3 runtime document is a non-normative typo and MUST NOT be emitted.

Negative tests RT-34, RT-35, and RT-37 execute in isolated negative-case branches with branch identifiers derived from `candidate_lineage_id`. Their deliberately invalid state is retained as external evidence but MUST NOT mutate or authorize the positive Clean/Dirty branches. In particular:

- RT-28 is evaluated on a positive branch with no post-Freeze audited-root drift.
- RT-35 first establishes a valid branch-local Freeze, performs and observes the prohibited write, requires `FROZEN_STATE_CHANGED`, and invalidates that branch-local Freeze. If that branch is reused, it MUST complete a new STOP WRITING / Snapshot A / Snapshot B / Freeze sequence before any later positive assertion.
- RT-38 is one orchestrated execution over the same candidate lineage, but its negative controls run in isolated branches. After the RT-35 negative observation, RT-38 must either discard that branch or prove a new valid branch-local Freeze before evaluating its final integrated positive state. Negative-case evidence cannot be substituted for a positive gate result.

| Test | PASS condition |
|---|---|
| RT-31 Control-Plane Placement | Canonical Origin/Materialized Registries and Freeze Manifest are outside audited root; project design docs are in-root only when Scope includes them. |
| RT-32 No Self-Reference | No canonical registry/Freeze Manifest must contain/hash itself; Snapshot B contains only audited-root objects. |
| RT-33 Anchor Role Separation | Pre-BUILD, registry approval, freeze-hash, and evidence-chain-head roles are distinguishable; a later anchor cannot substitute for earlier authorization. |
| RT-34 Independent Anchor Authority | Builder cannot create/approve an independent anchor; external path alone does not establish independence. |
| RT-35 Post-Freeze Write Barrier | Any write of status/hash/inventory/audit control state into audited root after Freeze produces FROZEN_STATE_CHANGED and requires a new freeze sequence. |
| RT-36 Pending Review State | INDEPENDENT_REVIEW != PASS implies PROJECT_INIT_STATUS=PENDING_INDEPENDENT_REVIEW and READY_FOR_IMPLEMENTATION=NO. |
| RT-37 Missing Pre-BUILD Approval | If BUILD starts without a verified pre-BUILD Human anchor, that execution remains unauthorized; a later anchor cannot retroactively legalize it. |
| RT-38 V1.1.4 Integrated Cross-Case | In one execution jointly validate placement, no self-reference, all four anchor roles, independent authority, missing-anchor negative case, Freeze barrier, and pending-review state. |

The portability regression bundle additionally and narrowly asserts: (a) same OS identity plus distinct logical roles/agent instances passes; (b) the same agent instance as Builder and Validator fails; (c) a Builder-authored external file fails; (d) a post-BUILD anchor fails RT-37; (e) missing OS isolation alone passes while recording `PORTABLE_DEFAULT` and `high_assurance_isolation=false`; (f) a protected-location write changes the snapshot hash and fails; and (g) evidence tamper and chain-head mismatch negatives continue to fail. These are coverage refinements of RT-33, RT-34, RT-37, and RT-38, not new RT identifiers.

## Integrated PASS

V1.1.4 functional validation requires RT-01..RT-38 PASS with zero blocking contradiction. `cross_case_runtime_test_pass` means RT-38 PASS. V1.1.4 remains Candidate until an independent reviewer validates the changed Skill/Contract and the regression suite passes. No prior failed project lineage may be retroactively upgraded.
