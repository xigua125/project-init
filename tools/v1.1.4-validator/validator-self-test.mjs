#!/usr/bin/env node
// NON-AUTHORITATIVE self-test. It cannot set any contract, RT, audit, PV, RC, or Stable state.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  RESULT_SCHEMA_VERSION,
  anchorProducerRoleAllowed,
  canonical,
  canonicalBytes,
  deriveEvaluationSummary,
  evaluatePortableAuthority,
  knownAnswerVectors,
  makeGateResults,
  sha256Bytes,
  validateResultShape,
  verifyExistingLibCompatibility,
  verifyEvidenceHeadBinding,
  verifyKnownAnswerVectors,
} from "./validator.mjs";

const declarations = {
  AUTHORITY: "NON_AUTHORITATIVE",
  MAY_SET_CONTRACT_GATE: "NO",
  MAY_SET_RT_RESULT: "NO",
  MAY_SET_FINAL_PASS: "NO",
  MAY_SET_PV: "NO",
  MAY_SET_RC: "NO",
  MAY_SET_STABLE: "NO",
  MAY_SET_HUMAN_APPROVAL: "NO",
};

const tests = [];
function test(name, fn) {
  try { fn(); tests.push({ name, status: "PASS" }); }
  catch (error) { tests.push({ name, status: "FAIL", error: String(error.message || error) }); }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const toolDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const projectRoot = path.resolve(toolDir, "..", "..");
const schemaPath = path.join(projectRoot, "references", "v1.1.4-validator-result.schema.json");
const libPath = path.join(projectRoot, "tools", "v1.1.4-regression", "lib.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v114-validator-self-test-"));

function portableAuthorityRecord(overrides = {}) {
  return {
    approval_status: "APPROVED",
    approved_at: "2026-10-07T00:00:00.000000Z",
    approved_by: "human-custodian-record",
    builder_agent_instance_id: "builder-instance-1",
    os_identity_relationship: "SAME",
    producer_agent_instance_id: "validator-instance-1",
    producer_logical_identity: "validator-logical-identity-sha256",
    producer_role: "VALIDATOR",
    custody_evidence: {
      authority_boundary: "LOGICAL_ROLE_AUTHORIZED_WRITE_SET",
      authorized_write_set: ["VALIDATOR", "FINAL_AUDITOR"],
      builder_write_authority: false,
      chain_head_valid: true,
      evidence_chain_valid: true,
      final_auditor_reverification_required: true,
      immutable_hash_binding_verified: true,
      os_isolation_mechanism: "NONE",
      protected_location_after_sha256: "a".repeat(64),
      protected_location_before_sha256: "a".repeat(64),
    },
    ...overrides,
  };
}

try {
  test("authority-declarations", () => assert(Object.values(declarations).every((value) => value === "NO" || value === "NON_AUTHORITATIVE"), "authority declaration invalid"));
  test("known-answer-vectors", () => assert(verifyKnownAnswerVectors(), "canonical known-answer vector mismatch"));
  test("known-answer-vector-cardinality", () => assert(knownAnswerVectors().length === 4, "expected four fixed vectors"));
  test("existing-lib-compatibility", () => assert(verifyExistingLibCompatibility(libPath).pass, "existing lib hash or permitted-domain semantics changed"));
  test("schema-json-and-closed-root", () => { const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); assert(schema.additionalProperties === false && schema.properties?.rt_results, "schema root is not closed"); });
  test("schema-rt-01-through-38-exact", () => { const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); const required = schema.$defs.rt_results.required; assert(required.length === 38 && required[0] === "RT-01" && required[37] === "RT-38" && schema.$defs.rt_results.additionalProperties === false, "RT set mismatch"); });
  test("builder-booleans-not-oracle", () => { const rts = Object.fromEntries(Array.from({ length: 38 }, (_, index) => [`RT-${String(index + 1).padStart(2, "0")}`, { status: "UNVERIFIED", error_codes: ["FINAL_PASS_INPUT_INVALID"], builder_reported_status: "PASS", builder_status_used_as_oracle: false }])); const summary = deriveEvaluationSummary(rts); assert(summary.validator_verdict === "NOT_READY" && summary.all_required_regression_tests_pass === false, "Builder PASS influenced verdict"); });
  const syntheticRts = (statusFor) => Object.fromEntries(Array.from({ length: 38 }, (_, index) => { const status = statusFor(index); return [`RT-${String(index + 1).padStart(2, "0")}`, { status, error_codes: status === "FAIL" ? ["REQUIRED_REGRESSION_TEST_FAIL"] : [], builder_reported_status: null, builder_status_used_as_oracle: false }]; }));
  test("real-summary-unverified-not-ready", () => { const rts = syntheticRts(() => "UNVERIFIED"); const gates = makeGateResults(rts); const summary = deriveEvaluationSummary(rts, gates); assert(gates[0].gate_status === "UNVERIFIED" && summary.validator_verdict === "NOT_READY", "UNVERIFIED collapsed into FAIL"); });
  test("real-summary-blocked-not-ready", () => { const rts = syntheticRts((i) => i === 0 ? "BLOCKED" : "PASS"); const gates = makeGateResults(rts); const summary = deriveEvaluationSummary(rts, gates); assert(gates[0].gate_status === "BLOCKED" && summary.validator_verdict === "NOT_READY", "BLOCKED collapsed into FAIL"); });
  test("real-summary-fail", () => { const rts = syntheticRts((i) => i === 0 ? "FAIL" : "PASS"); const gates = makeGateResults(rts); assert(deriveEvaluationSummary(rts, gates).validator_verdict === "FAIL", "real FAIL did not propagate"); });
  test("real-summary-pass", () => { const rts = syntheticRts(() => "PASS"); const gates = makeGateResults(rts); assert(deriveEvaluationSummary(rts, gates).validator_verdict === "PASS", "all PASS did not produce PASS"); });
  test("real-summary-cycle-cap", () => { const rts = syntheticRts(() => "PASS"); const gates = makeGateResults(rts); const summary = deriveEvaluationSummary(rts, gates, { validation_cycles: 3 }); assert(summary.validator_verdict === "NOT_READY" && summary.contract_state === "ESCALATION_TO_HUMAN", "real cycle-cap path did not escalate"); });
  test("schema-contract-error-vocabulary", () => { const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); const codes = schema.$defs.error_code.enum; assert(codes.includes("CLEAN_ROOT_MATERIALIZED_MISMATCH") && codes.includes("VERIFICATION_WORKSPACE_IN_SCOPE"), "contract-supported error vocabulary missing"); });
  test("evidence-head-value-and-chain-binding", () => { const logFile = path.join(tempRoot, "evidence.log"); const recordBase = { schema_version: "TEST", evidence_id: "E1", sequence_number: 1, timestamp: "2026-10-07T00:00:00.000000Z", evidence_type: "TEST", payload_hash: "0".repeat(64), previous_evidence_hash: "0".repeat(64), producer: "TEST", producer_identity_hash: "0".repeat(64) }; const record = { ...recordBase, record_hash: sha256Bytes(canonicalBytes(recordBase)) }; fs.writeFileSync(logFile, canonicalBytes(record)); const bytes = fs.readFileSync(logFile).length; const anchorBase = { role: "EVIDENCE_CHAIN_HEAD_ANCHOR", log_id: "TEST", last_sequence_number: 1, last_record_hash: record.record_hash, log_byte_length: bytes, anchor_time: "2026-10-07T00:00:01.000000Z", producer: "HUMAN_CUSTODIAN", prior_anchor_hash: "0".repeat(64) }; const anchor = { ...anchorBase, anchor_hash: sha256Bytes(canonicalBytes(anchorBase)) }; const anchorFile = path.join(tempRoot, "head.json"); fs.writeFileSync(anchorFile, canonicalBytes(anchor)); const verified = verifyEvidenceHeadBinding(logFile, anchorFile, [anchorFile]); assert(verified.log.last_record_hash === record.record_hash, "evidence head not value-bound"); });
  test("portable-same-os-distinct-logical-roles-pass", () => { const result = evaluatePortableAuthority(portableAuthorityRecord(), { governedBuildStartedAt: "2026-10-07T00:00:01.000000Z", requirePrebuild: true }); assert(result.valid && result.os_identity_relationship === "SAME", "same OS identity incorrectly blocked portable authority"); });
  test("human-custodian-anchor-roles-reject-non-human", () => { for (const role of ["PREBUILD_AUTHORIZATION_ANCHOR", "VALIDATOR_REGISTRY_ANCHOR", "FREEZE_HASH_ANCHOR"]) assert(!anchorProducerRoleAllowed(role, "VALIDATOR") && anchorProducerRoleAllowed(role, "HUMAN_CUSTODIAN"), `${role} custody-role rule mismatch`); });
  test("contract-permitted-non-human-custody-role-remains-valid", () => { const record = portableAuthorityRecord({ producer_role: "INDEPENDENT_AUDITOR" }); const portable = evaluatePortableAuthority(record, { immutableHashBindingVerified: true }); assert(anchorProducerRoleAllowed("EVIDENCE_CHAIN_HEAD_ANCHOR", record.producer_role) && portable.valid, "permitted independent non-Human evidence-chain custody was rejected"); });
  test("same-agent-instance-builder-validator-fails", () => { const result = evaluatePortableAuthority(portableAuthorityRecord({ producer_agent_instance_id: "builder-instance-1" }), { governedBuildStartedAt: "2026-10-07T00:00:01.000000Z", requirePrebuild: true }); assert(!result.valid && result.reasons.includes("SAME_AGENT_INSTANCE"), "same agent instance was accepted"); });
  test("builder-authored-external-file-fails", () => { const result = evaluatePortableAuthority(portableAuthorityRecord({ producer_role: "BUILDER", producer_logical_identity: "builder-logical-identity" }), { governedBuildStartedAt: "2026-10-07T00:00:01.000000Z", requirePrebuild: true }); assert(!result.valid && result.reasons.includes("PRODUCER_ROLE_NOT_INDEPENDENT"), "Builder-authored external artifact was accepted"); });
  test("post-build-anchor-fails-rt37", () => { const result = evaluatePortableAuthority(portableAuthorityRecord({ approved_at: "2026-10-07T00:00:02.000000Z" }), { governedBuildStartedAt: "2026-10-07T00:00:01.000000Z", requirePrebuild: true }); assert(!result.valid && result.reasons.includes("AUTHORIZING_ANCHOR_NOT_PREBUILD"), "post-BUILD anchor retroactively authorized BUILD"); });
  test("os-isolation-absent-records-portable-default", () => { const result = evaluatePortableAuthority(portableAuthorityRecord(), { governedBuildStartedAt: "2026-10-07T00:00:01.000000Z", requirePrebuild: true }); assert(result.valid && result.assurance_profile === "PORTABLE_DEFAULT" && result.high_assurance_isolation === false, "missing OS isolation blocked or claimed high assurance"); });
  test("protected-location-write-detected", () => { const base = portableAuthorityRecord(); const result = evaluatePortableAuthority({ ...base, custody_evidence: { ...base.custody_evidence, protected_location_after_sha256: "b".repeat(64) } }, { governedBuildStartedAt: "2026-10-07T00:00:01.000000Z", requirePrebuild: true }); assert(!result.valid && result.reasons.includes("PROTECTED_LOCATION_CHANGED"), "protected-location write was not detected"); });
  test("evidence-tamper-negative-still-fails", () => { const logFile = path.join(tempRoot, "tampered-evidence.log"); const recordBase = { schema_version: "TEST", evidence_id: "E2", sequence_number: 1, timestamp: "2026-10-07T00:00:00.000000Z", evidence_type: "TEST", payload_hash: "0".repeat(64), previous_evidence_hash: "0".repeat(64), producer: "TEST", producer_identity_hash: "0".repeat(64) }; const record = { ...recordBase, record_hash: sha256Bytes(canonicalBytes(recordBase)) }; fs.writeFileSync(logFile, canonicalBytes({ ...record, payload_hash: "1".repeat(64) })); let failed = false; try { verifyEvidenceHeadBinding(logFile, path.join(tempRoot, "missing-head.json"), []); } catch { failed = true; } assert(failed, "tampered evidence was accepted"); });
  test("chain-head-negative-still-fails", () => { const logFile = path.join(tempRoot, "chain-evidence.log"); const recordBase = { schema_version: "TEST", evidence_id: "E3", sequence_number: 1, timestamp: "2026-10-07T00:00:00.000000Z", evidence_type: "TEST", payload_hash: "0".repeat(64), previous_evidence_hash: "0".repeat(64), producer: "TEST", producer_identity_hash: "0".repeat(64) }; const record = { ...recordBase, record_hash: sha256Bytes(canonicalBytes(recordBase)) }; fs.writeFileSync(logFile, canonicalBytes(record)); const badBase = { role: "EVIDENCE_CHAIN_HEAD_ANCHOR", log_id: "TEST", last_sequence_number: 1, last_record_hash: "f".repeat(64), log_byte_length: fs.readFileSync(logFile).length, anchor_time: "2026-10-07T00:00:01.000000Z", producer: "HUMAN_CUSTODIAN", prior_anchor_hash: "0".repeat(64) }; const bad = { ...badBase, anchor_hash: sha256Bytes(canonicalBytes(badBase)) }; const badFile = path.join(tempRoot, "bad-head.json"); fs.writeFileSync(badFile, canonicalBytes(bad)); let failed = false; try { verifyEvidenceHeadBinding(logFile, badFile, [badFile]); } catch { failed = true; } assert(failed, "mismatched chain head was accepted"); });
  test("fail-precedence", () => { const rts = Object.fromEntries(Array.from({ length: 38 }, (_, index) => [`RT-${String(index + 1).padStart(2, "0")}`, { status: index === 0 ? "FAIL" : "PASS", error_codes: index === 0 ? ["REQUIRED_REGRESSION_TEST_FAIL"] : [], builder_status_used_as_oracle: false }])); assert(deriveEvaluationSummary(rts).validator_verdict === "FAIL", "FAIL did not propagate"); });
  test("cycle-cap-escalation", () => { const rts = Object.fromEntries(Array.from({ length: 38 }, (_, index) => [`RT-${String(index + 1).padStart(2, "0")}`, { status: "PASS", error_codes: [], builder_status_used_as_oracle: false }])); const summary = deriveEvaluationSummary(rts, [], { validation_cycles: 3 }); assert(summary.validator_verdict === "NOT_READY" && summary.contract_state === "ESCALATION_TO_HUMAN", "cycle cap did not escalate"); });
  test("canonical-temp-fixture", () => { const file = path.join(tempRoot, "fixture.json"); fs.writeFileSync(file, canonicalBytes({ b: 1, a: "x" }), { flag: "wx" }); assert(sha256Bytes(fs.readFileSync(file)) === "b9726bbcdf05823038cfdf7612b50329709a519a5da6f1ac21671f6b5dd31dc2", "temp fixture hash mismatch"); });
  test("self-hash-shape-check", () => { const rt = Object.fromEntries(Array.from({ length: 38 }, (_, index) => [`RT-${String(index + 1).padStart(2, "0")}`, { status: "PASS", assertion_algorithm_id: "TEST", source_artifact_ids: [], error_codes: [], builder_reported_status: null, builder_status_used_as_oracle: false }])); const base = { schema_version: RESULT_SCHEMA_VERSION, artifact_class: "AUDIT_RESULT", procedure_version: "v1.1.4-validator-procedure/1.1", result_id: "SYNTHETIC", candidate_version: "V1.1.4", candidate_lineage_id: "SYNTHETIC", branch_id: "synthetic", evaluation_profile: "REGRESSION_VALIDATION", validation_cycle: 0, started_at: "2026-10-07T00:00:00.000000Z", completed_at: "2026-10-07T00:00:01.000000Z", validator_identity: {}, authority_bindings: {}, root_scope_binding: {}, input_artifacts: [], contract_gate_results: [], rt_results: rt, findings: [], evaluation_summary: deriveEvaluationSummary(rt), canonicalization_profile: {} }; const candidate = { ...base, result_sha256: sha256Bytes(canonicalBytes(base)) }; assert(validateResultShape(candidate), "self hash or RT shape rejected"); });
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const failed = tests.filter((entry) => entry.status === "FAIL");
const output = { ...declarations, REGISTRY_STATUS: "NOT_CREATED", AUTHORITATIVE_VALIDATOR_EXECUTED: "NO", RESULT: failed.length ? "FAIL" : "PASS", TESTS: tests };
process.stdout.write(`${canonical(output)}\n`);
process.exitCode = failed.length ? 1 : 0;
