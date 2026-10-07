# V1.1.4 Runtime Execution Addendum

Status: CANDIDATE

This addendum extends V1.1.3 Runtime Execution Specification. RT-01..RT-30 remain unchanged.

## V1.1.4 execution identity and locations

RT-01..RT-30 retain their V1.1.3 test semantics, not the literal V1.1.3 filesystem destinations. Before execution, create and record a new `candidate_lineage_id` and a lineage manifest with resolved absolute identities for:

```
clean_audited_root = <new lineage-specific empty root>
dirty_audited_root = <new lineage-specific dirty fixture root>
verification_workspace = <external lineage-specific verification workspace>
evidence_storage = <external lineage-specific append-only evidence storage>
independent_anchor_store = <external Human-controlled anchor store>
```

The independent anchor store MUST be outside both audited roots, the Verification Workspace, evidence-log storage, and Builder write authority. The failed `v1.1.4-FRESH` lineage and all V1.1.3 evidence are immutable inputs only and MUST NOT supply writable roots, current authorization, current anchors, or current regression evidence.

Here `Builder write authority` is a logical Builder-role/authorized-write-set boundary. It is not an OS permission domain. Portable exclusion/custody requires distinct recorded role and agent-instance identities, immutable/hash-bound bytes, pre-BUILD authorization timing, an append-only chain with matching protected-location before/after snapshots, and Final-Auditor replay. OS isolation is optional preferred high assurance; record its absence as non-high-assurance without failing solely for that absence.

Each evidence record and RT result identifies `candidate_lineage_id`, branch identity, audited-root identity where applicable, producer, source artifacts, and source hashes. The harness derives its verdict from the source artifacts and observations; a Builder-authored PASS/FAIL boolean is never an oracle input.

## Canonical environment field

For RT-20, RT-24, and RT-27 the canonical field name is `RESOLVED_EXECUTABLE`. Its value is the absolute resolved executable path observed for the command. `RESOLUTION_EXECUTABLE` in the V1.1.3 runtime document is a historical spelling error and is not a permitted output field.

## Positive and negative branches

The positive Clean and Dirty branches are distinct from the isolated negative branches used by RT-34, RT-35, and RT-37. Negative branches share the candidate lineage but have unique `branch_id` values and their own audited-root copy or branch-local state. They cannot grant authorization to, replace evidence for, or mutate a positive branch.

RT-28 runs only on positive branches and requires the post-Freeze rescan to have no audited-root drift.

RT-35 runs on an isolated branch. It MUST:

1. establish a valid branch-local Freeze;
2. record the pre-write identity;
3. perform the prohibited audited-root status/control write;
4. independently observe the resulting identity diff and `FROZEN_STATE_CHANGED`;
5. record that the Freeze is invalid and positive gate use is prohibited;
6. either retire the branch or run a complete new STOP WRITING / Snapshot A / Snapshot B / Freeze sequence before any later positive assertion.

RT-38 is a single orchestrated execution for one `candidate_lineage_id`, not a requirement that positive and destructive-negative observations share one mutable root state. It jointly consumes the positive-branch controls and isolated RT-34/35/37 negative observations. After the RT-35 write, RT-38 accepts only a retired negative branch or a newly re-frozen branch; it MUST NOT treat a restored file, a stale pre-write manifest, or a boolean claim as reset evidence.

## RT-31 Control-Plane Placement
Inspect canonical artifact paths before BUILD and at Freeze. PASS only when canonical Origin/Materialized Registries and Freeze Manifest are outside audited root and Verification Workspace is proven out of scope.

## RT-32 No Self-Reference
Compare Snapshot B path set with Freeze Manifest entries. PASS only when Freeze Manifest equals Snapshot B exactly and no external canonical control-plane artifact appears as a snapshot member or self-entry.

## RT-33 Anchor Role Separation
Inspect anchor schemas, creation time, approval scope, and referenced gate. PASS only when pre-BUILD approval, registry approval, freeze-hash, and evidence-chain-head semantics are unambiguous and no later-stage anchor is used to authorize an earlier stage.

## RT-34 Independent Anchor Authority
Attempt the negative case where Builder writes an anchor to an external directory. Expected: independent_anchor_valid=false and authorization blocked. Location alone must not confer independence.

Also exercise the positive portable case where Builder and custodian/Validator share one OS identity but have distinct authorized logical roles and agent-instance identifiers. Expected: the OS identity match does not block PASS. Reusing the Builder agent-instance identifier for Validator fails even if the role label, path, process, session, or OS identity changes.

## RT-35 Post-Freeze Write Barrier
After valid Freeze, attempt an audited-root status/manifest update. Expected: FROZEN_STATE_CHANGED, Freeze invalidated, PASS prohibited, new STOP WRITING/Snapshot A/B sequence required.

## RT-36 Pending Review State
Builder completes self-check while independent review is not PASS. Expected exact state: PROJECT_INIT_STATUS=PENDING_INDEPENDENT_REVIEW; INDEPENDENT_REVIEW=PENDING or BLOCKED as applicable; READY_FOR_IMPLEMENTATION=NO. Final PASS is forbidden.

## RT-37 Missing Pre-BUILD Approval Is Non-Retroactive
Execute the negative case with no verified pre-BUILD Human anchor before BUILD. Expected: BUILD authorization remains false for that execution. Creating any later-stage or later-time anchor must not legalize the earlier BUILD; remediation requires a new authorization lineage.

Protected anchor/control locations are snapshotted before and after validation/audit. Any membership, identity, or byte difference fails. Existing evidence-log tamper and chain-head rollback/mismatch negatives remain mandatory failures.

## RT-38 V1.1.4 Integrated Cross-Case
In one execution jointly validate RT-31..RT-37 controls: external canonical placement, no self-reference, four anchor roles and authority, missing-anchor negative case, Freeze/post-Freeze write barrier, and pending-review state. Expected: all controls pass together without substitution or stale evidence. This test supplies `cross_case_runtime_test_pass`.

## Evidence
All RT-31..RT-38 evidence must be external to the audited root and must not mutate historical V1.1.3 evidence.
