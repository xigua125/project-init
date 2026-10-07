#!/usr/bin/env node
// V1.1.4 read-only Validator. Node built-ins only; no local/runtime package imports.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const VALIDATOR_ID = "project-initialization-v1.1.4-validator";
export const VALIDATOR_VERSION = "1.1.0";
export const VALIDATOR_ALGORITHM_ID = "V114_VALIDATOR_ALGORITHM_2_PORTABLE_AUTHORITY";
export const RESULT_SCHEMA_VERSION = "v1.1.4-validator-result/1.1";
export const PROCEDURE_VERSION = "v1.1.4-validator-procedure/1.1";
export const EXISTING_LIB_SHA256 = "3ad76136ca51806630b2ba562d3e71a16d039208d8c4ac36e8abe3178769fd8a";
export const LF = "\n";

const RT_IDS = Array.from({ length: 38 }, (_, index) => `RT-${String(index + 1).padStart(2, "0")}`);
const STAGE0_FILES = [
  "PROJECT_CHARTER.json", "REQUIREMENTS_SCOPE.json", "FILESYSTEM_ARCHITECTURE.json",
  "PATH_CONTRACT.json", "DATA_ARTIFACT_FLOW.json", "AGENT_OWNERSHIP.json",
  "ENVIRONMENT_BASELINE.json", "ACCEPTANCE_GATES.json", "EVIDENCE_POLICY.json",
  "BACKUP_ROLLBACK_RECOVERY.json", "TASK_CONTRACT.json", "PROJECT_INIT_MANIFEST.json",
];
const DIRTY_CLASSIFICATION = {
  ".env.example": "DELETE_CANDIDATE", config: "ARCHIVE", "config/settings.yaml": "ARCHIVE",
  docker: "ARCHIVE", "docker/Dockerfile": "ARCHIVE", "old-notes": "ARCHIVE",
  "old-notes/notes.md": "ARCHIVE", scripts: "ARCHIVE", "scripts/deploy.sh": "ARCHIVE",
  src: "ARCHIVE", "src/old_module.py": "ARCHIVE", temp: "DELETE_CANDIDATE",
  "temp/cache.tmp": "DELETE_CANDIDATE",
};

export function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new Error("FINAL_PASS_INPUT_INVALID: non-finite or non-safe-integer JSON number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  throw new Error(`FINAL_PASS_INPUT_INVALID: unsupported JSON value ${typeof value}`);
}

export function canonicalBytes(value) {
  return Buffer.from(canonical(value) + LF, "utf8");
}

export function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

export function now6() {
  return new Date().toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}

export function parseJsonStrict(file) {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) throw new Error(`FINAL_PASS_INPUT_INVALID: BOM forbidden: ${file}`);
  return { bytes, parsed: JSON.parse(text), text };
}

export function verifyCanonicalJsonFile(file) {
  const loaded = parseJsonStrict(file);
  const expected = canonicalBytes(loaded.parsed);
  return { ...loaded, canonical: loaded.bytes.equals(expected), sha256: sha256Bytes(loaded.bytes) };
}

export function isInside(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export function fileIdentity(file) {
  const stat = fs.statSync(file);
  return { path: path.resolve(file), sha256: sha256File(file), size: stat.size };
}

function modeOf(stat) {
  return process.platform === "win32" ? "UNSUPPORTED" : String(stat.mode & 0o7777);
}

export function scanRoot(root, originForPath = () => "MANAGED_GENERATED") {
  const resolved = path.resolve(root);
  const entries = [];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, item.name);
      const relative_path = normalizeRelative(path.relative(resolved, absolute));
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        const symlink_target = fs.readlinkSync(absolute);
        entries.push({ file_type: "symlink", mode: modeOf(stat), origin_classification: originForPath(relative_path, "symlink"), relative_path, sha256: null, size: null, symlink_target, symlink_target_sha256: sha256Bytes(Buffer.from(symlink_target, "utf8")) });
      } else if (stat.isDirectory()) {
        entries.push({ file_type: "directory", mode: modeOf(stat), origin_classification: originForPath(relative_path, "directory"), relative_path, sha256: null, size: null, symlink_target: null, symlink_target_sha256: null });
        walk(absolute);
      } else if (stat.isFile()) {
        entries.push({ file_type: "file", mode: modeOf(stat), origin_classification: originForPath(relative_path, "file"), relative_path, sha256: sha256File(absolute), size: stat.size, symlink_target: null, symlink_target_sha256: null });
      } else {
        throw new Error(`FINAL_PASS_INPUT_INVALID: unsupported filesystem object ${absolute}`);
      }
    }
  }
  walk(resolved);
  return entries.sort((a, b) => a.relative_path.localeCompare(b.relative_path) || a.file_type.localeCompare(b.file_type));
}

export function diffEntries(expected, actual) {
  const left = new Map(expected.map((entry) => [entry.relative_path, entry]));
  const right = new Map(actual.map((entry) => [entry.relative_path, entry]));
  const differences = [];
  for (const key of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    if (canonical(left.get(key) ?? null) !== canonical(right.get(key) ?? null)) {
      differences.push({ relative_path: key, expected: left.get(key) ?? null, actual: right.get(key) ?? null });
    }
  }
  return differences;
}

function requiredKeys(object, keys) {
  return Boolean(object && typeof object === "object" && keys.every((key) => Object.hasOwn(object, key)));
}

function samePathSet(left, right) {
  return canonical([...left].sort()) === canonical([...right].sort());
}

function readJson(file) {
  return parseJsonStrict(file).parsed;
}

function branchPaths(lineageRoot, name) {
  return {
    auditedRoot: path.join(lineageRoot, "audited-roots", name),
    control: path.join(lineageRoot, "control-plane", "prebuild", name),
    verification: path.join(lineageRoot, "verification-workspace", name),
  };
}

function runVersion(executable) {
  try {
    return awaitableExecFileSync(executable, ["--version"]);
  } catch (error) {
    return `ERROR:${error.message}`;
  }
}

function awaitableExecFileSync(executable, args) {
  // Lazy load is deliberately avoided; environment replay is performed by spawnSync below.
  const result = process.getBuiltinModule("node:child_process").spawnSync(executable, args, { encoding: "utf8", windowsHide: true });
  return String(result.stdout || result.stderr || "").trim();
}

export function knownAnswerVectors() {
  return [
    { value: null, sha256: "38e0b9de817f645c4bec37c0d4a3e58baecccb040f5718dc069a72c7385a0bed" },
    { value: {}, sha256: "ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356" },
    { value: { b: 1, a: "x" }, sha256: "b9726bbcdf05823038cfdf7612b50329709a519a5da6f1ac21671f6b5dd31dc2" },
    { value: { z: "UTF-8", a: [true, false, null] }, sha256: "817e009ac64b1edad823dcdbdb94c1b4354adf745e42d333a2196abfc71dafae" },
  ];
}

export function verifyKnownAnswerVectors() {
  return knownAnswerVectors().every((vector) => sha256Bytes(canonicalBytes(vector.value)) === vector.sha256);
}

function legacyCanonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(legacyCanonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${legacyCanonical(value[key])}`).join(",")}}`;
}

export function verifyExistingLibCompatibility(libPath) {
  const hashValid = sha256File(libPath) === EXISTING_LIB_SHA256;
  const vectorsValid = knownAnswerVectors().every(({ value }) => `${legacyCanonical(value)}${LF}` === canonicalBytes(value).toString("utf8"));
  return { hashValid, vectorsValid, pass: hashValid && vectorsValid };
}

function verifySelfHashRecord(record, hashField = "anchor_hash") {
  if (!record || typeof record !== "object" || typeof record[hashField] !== "string") return false;
  const withoutHash = { ...record };
  delete withoutHash[hashField];
  return sha256Bytes(canonicalBytes(withoutHash)) === record[hashField];
}

const NON_BUILDER_CUSTODY_ROLES = new Set(["HUMAN_CUSTODIAN", "VALIDATOR", "INDEPENDENT_AUDITOR", "FINAL_AUDITOR", "PM_ORCHESTRATOR"]);
const HUMAN_CUSTODIAN_ANCHOR_ROLES = new Set(["PREBUILD_AUTHORIZATION_ANCHOR", "VALIDATOR_REGISTRY_ANCHOR", "FREEZE_HASH_ANCHOR"]);
const HIGH_ASSURANCE_MECHANISMS = new Set(["OS_ENFORCED", "ACL_ENFORCED", "READ_ONLY_MOUNT", "SANDBOX_ENFORCED", "SEPARATE_HOST"]);

export function anchorProducerRoleAllowed(anchorRole, producerRole) {
  return HUMAN_CUSTODIAN_ANCHOR_ROLES.has(anchorRole)
    ? producerRole === "HUMAN_CUSTODIAN"
    : NON_BUILDER_CUSTODY_ROLES.has(producerRole);
}

export function evaluatePortableAuthority(record, { governedBuildStartedAt = null, requirePrebuild = false, immutableHashBindingVerified = true } = {}) {
  const custody = record?.custody_evidence || {};
  const authorizedWriteSet = Array.isArray(custody.authorized_write_set) ? custody.authorized_write_set : [];
  const reasons = [];
  if (record?.approval_status !== "APPROVED" || typeof record?.approved_by !== "string" || !record.approved_by) reasons.push("RECORDED_APPROVAL_INVALID");
  if (!NON_BUILDER_CUSTODY_ROLES.has(record?.producer_role)) reasons.push("PRODUCER_ROLE_NOT_INDEPENDENT");
  if (typeof record?.producer_logical_identity !== "string" || !record.producer_logical_identity) reasons.push("PRODUCER_LOGICAL_IDENTITY_MISSING");
  if (typeof record?.producer_agent_instance_id !== "string" || !record.producer_agent_instance_id) reasons.push("PRODUCER_AGENT_INSTANCE_MISSING");
  if (typeof record?.builder_agent_instance_id !== "string" || !record.builder_agent_instance_id) reasons.push("BUILDER_AGENT_INSTANCE_MISSING");
  if (record?.producer_agent_instance_id && record.producer_agent_instance_id === record.builder_agent_instance_id) reasons.push("SAME_AGENT_INSTANCE");
  if (custody.authority_boundary !== "LOGICAL_ROLE_AUTHORIZED_WRITE_SET" || custody.builder_write_authority !== false || authorizedWriteSet.length === 0 || authorizedWriteSet.includes("BUILDER")) reasons.push("BUILDER_WRITE_AUTHORITY_NOT_EXCLUDED");
  if (!immutableHashBindingVerified || custody.immutable_hash_binding_verified !== true) reasons.push("IMMUTABLE_HASH_BINDING_INVALID");
  if (custody.evidence_chain_valid !== true || custody.chain_head_valid !== true) reasons.push("EVIDENCE_CHAIN_GUARD_INVALID");
  if (typeof custody.protected_location_before_sha256 !== "string" || custody.protected_location_before_sha256 !== custody.protected_location_after_sha256) reasons.push("PROTECTED_LOCATION_CHANGED");
  if (custody.final_auditor_reverification_required !== true) reasons.push("FINAL_AUDITOR_REVERIFICATION_MISSING");
  if (requirePrebuild) {
    const approvedAt = Date.parse(record?.approved_at || "");
    const buildStartedAt = Date.parse(governedBuildStartedAt || "");
    if (!Number.isFinite(approvedAt) || !Number.isFinite(buildStartedAt) || approvedAt >= buildStartedAt) reasons.push("AUTHORIZING_ANCHOR_NOT_PREBUILD");
  }
  const highAssurance = HIGH_ASSURANCE_MECHANISMS.has(custody.os_isolation_mechanism);
  return {
    assurance_profile: highAssurance ? "HIGH_ASSURANCE" : "PORTABLE_DEFAULT",
    high_assurance_isolation: highAssurance,
    os_identity_relationship: record?.os_identity_relationship || "UNKNOWN",
    reasons,
    valid: reasons.length === 0,
  };
}

function verifyRegistry(registryFile, registryAnchorFile, request) {
  const registryChecked = verifyCanonicalJsonFile(registryFile);
  const anchorChecked = verifyCanonicalJsonFile(registryAnchorFile);
  if (!registryChecked.canonical || !anchorChecked.canonical || !verifySelfHashRecord(anchorChecked.parsed)) {
    throw new Error("VALIDATOR_REGISTRY_INVALID");
  }
  const anchor = anchorChecked.parsed;
  const custodyReference = anchor.custody_evidence?.evidence_reference;
  const custodyValid = typeof custodyReference === "string" && path.isAbsolute(custodyReference) && fs.existsSync(custodyReference) && anchor.custody_evidence.evidence_sha256 === sha256File(custodyReference);
  const portableAuthority = evaluatePortableAuthority(anchor, { governedBuildStartedAt: request.governed_build_started_at, requirePrebuild: true, immutableHashBindingVerified: custodyValid });
  if (anchor.validator_registry_sha256 !== registryChecked.sha256 || anchor.approval_status !== "APPROVED" || !anchorProducerRoleAllowed("VALIDATOR_REGISTRY_ANCHOR", anchor.producer_role) || !portableAuthority.valid) {
    throw new Error("VALIDATOR_REGISTRY_INVALID");
  }
  const registry = registryChecked.parsed;
  const selfHash = sha256File(fileURLToPath(import.meta.url));
  const entry = registry.entries?.find((candidate) => candidate.validator_id === VALIDATOR_ID && candidate.validator_version === VALIDATOR_VERSION && candidate.approval_status === "ACTIVE");
  if (!entry || entry.validator_sha256 !== selfHash || entry.validator_algorithm_id !== VALIDATOR_ALGORITHM_ID) throw new Error("VALIDATOR_INTEGRITY_FAIL");
  if (entry.expiry_or_null && Date.now() >= Date.parse(entry.expiry_or_null)) throw new Error("VALIDATOR_INTEGRITY_FAIL");
  if (!String(entry.approval_scope).includes(request.evaluation_profile)) throw new Error("VALIDATOR_INTEGRITY_FAIL");
  return { registry, registryChecked, anchor, anchorChecked, entry, selfHash };
}

function verifyIndependentAnchorFile(file, expectedRole, request) {
  if (!path.isAbsolute(file) || !fs.existsSync(file)) return false;
  const checked = verifyCanonicalJsonFile(file);
  if (!checked.canonical || !verifySelfHashRecord(checked.parsed)) return false;
  const anchor = checked.parsed;
  const custodyReference = anchor.custody_evidence?.evidence_reference;
  const portableAuthority = evaluatePortableAuthority(anchor, { governedBuildStartedAt: request.governed_build_started_at, requirePrebuild: expectedRole === "PREBUILD_AUTHORIZATION_ANCHOR", immutableHashBindingVerified: typeof custodyReference === "string" && path.isAbsolute(custodyReference) && fs.existsSync(custodyReference) && anchor.custody_evidence.evidence_sha256 === sha256File(custodyReference) });
  return anchor.role === expectedRole
    && anchor.approval_status === "APPROVED"
    && anchorProducerRoleAllowed(expectedRole, anchor.producer_role)
    && portableAuthority.valid;
}

function verifyAnchorRoleSeparation(request) {
  const freezePaths = request.freeze_hash_anchor_paths;
  if (!Array.isArray(freezePaths) || freezePaths.length === 0) return false;
  const roleBindings = [
    [request.prebuild_authorization_anchor_path, "PREBUILD_AUTHORIZATION_ANCHOR"],
    ...freezePaths.map((file) => [file, "FREEZE_HASH_ANCHOR"]),
    [request.evidence_chain_head_anchor_path, "EVIDENCE_CHAIN_HEAD_ANCHOR"],
  ];
  const resolved = roleBindings.map(([file]) => path.resolve(file));
  if (new Set(resolved).size !== resolved.length) return false;
  return roleBindings.every(([file, role]) => verifyIndependentAnchorFile(file, role, request));
}

function verifyBoundFiles(request) {
  if (!Array.isArray(request.bound_files) || request.bound_files.length === 0) throw new Error("FINAL_PASS_INPUT_INVALID");
  return request.bound_files.map((binding) => {
    if (!path.isAbsolute(binding.path) || !fs.existsSync(binding.path)) throw new Error("FINAL_PASS_INPUT_INVALID");
    const identity = fileIdentity(binding.path);
    if (identity.sha256 !== binding.sha256 || identity.size !== binding.size) throw new Error("FINAL_PASS_INPUT_INVALID");
    if (binding.candidate_lineage_id !== request.candidate_lineage_id) throw new Error("FINAL_PASS_INPUT_INVALID");
    return { ...binding, resolved_path: identity.path };
  });
}

function verifyAuthorization(request, requestFile) {
  if (request.authorization?.status !== "AUTHORIZED" || request.authorization?.producer_role !== "HUMAN_CUSTODIAN" || request.authorization?.authoritative_validator_execution !== true) {
    throw new Error("PREBUILD_AUTHORIZATION_INVALID");
  }
  if (request.authorization?.builder_write_authority_excluded !== true || request.authorization?.validator_identity_separate !== true
    || typeof request.authorization?.validator_agent_instance_id !== "string" || typeof request.authorization?.builder_agent_instance_id !== "string"
    || request.authorization.validator_agent_instance_id === request.authorization.builder_agent_instance_id
    || typeof request.validator_logical_identity !== "string" || typeof request.builder_logical_identity !== "string"
    || request.validator_logical_identity === request.builder_logical_identity) throw new Error("VALIDATOR_INTEGRITY_FAIL");
  const checked = verifyCanonicalJsonFile(requestFile);
  if (!checked.canonical) throw new Error("FINAL_PASS_INPUT_INVALID");
  return checked;
}

function registryReality(lineageRoot, branchName) {
  const branch = branchPaths(lineageRoot, branchName);
  const approved = readJson(path.join(branch.control, "approved-materialized-registry.json"));
  const origin = readJson(path.join(branch.control, "origin-registry.json"));
  const originMap = new Map(origin.entries.map((entry) => [entry.relative_path, entry]));
  const approvedMap = new Map(approved.entries.map((entry) => [entry.relative_path, entry]));
  const actual = scanRoot(branch.auditedRoot, (relativePath) => originMap.has(relativePath) ? "PREEXISTING" : "MANAGED_GENERATED");
  const actualMap = new Map(actual.map((entry) => [entry.relative_path, entry]));
  // Contract v1.3:146 and rt-execution-spec-v1.1.3 RT-03 compare only the approved identity projection.
  const approvedChecks = [...approvedMap.entries()].map(([relativePath, expected]) => {
    const observed = actualMap.get(relativePath);
    return {
      relativePath,
      match: Boolean(observed
        && expected.relative_path === relativePath
        && observed.relative_path === relativePath
        && observed.file_type === expected.file_type
        && observed.size === expected.size
        && observed.sha256 === expected.sha256_expectation),
    };
  });
  const missingPreexisting = [...originMap.keys()].filter((relativePath) => !actualMap.has(relativePath));
  const known = new Set([...originMap.keys(), ...approvedMap.keys()]);
  const unknown = actual.filter((entry) => !known.has(entry.relative_path));
  return { actual, approvedChecks, missingPreexisting, unknown };
}

function verifyEvidenceLog(file) {
  const raw = fs.readFileSync(file);
  const lines = raw.toString("utf8").split("\n");
  if (lines.at(-1) !== "") return { valid: false, reason: "NO_TERMINAL_LF" };
  lines.pop();
  let previous = "0".repeat(64);
  for (let index = 0; index < lines.length; index += 1) {
    let record;
    try { record = JSON.parse(lines[index]); } catch { return { valid: false, reason: `JSON_${index + 1}` }; }
    if (`${canonical(record)}${LF}` !== `${lines[index]}${LF}`) return { valid: false, reason: `CANONICAL_${index + 1}` };
    const { record_hash, ...withoutHash } = record;
    if (record.sequence_number !== index + 1 || record.previous_evidence_hash !== previous) return { valid: false, reason: `CHAIN_${index + 1}` };
    if (sha256Bytes(canonicalBytes(withoutHash)) !== record_hash) return { valid: false, reason: `HASH_${index + 1}` };
    previous = record_hash;
  }
  return { valid: true, byte_length: raw.length, last_record_hash: previous, last_sequence_number: lines.length };
}

function requireAbsoluteExisting(file, code = "FINAL_PASS_INPUT_INVALID") {
  if (typeof file !== "string" || !path.isAbsolute(file) || !fs.existsSync(file)) throw new Error(code);
  return path.resolve(file);
}

function verifiedFileHash(file, declared, code = "FINAL_PASS_INPUT_INVALID") {
  const resolved = requireAbsoluteExisting(file, code);
  const actual = sha256File(resolved);
  if (actual !== declared) throw new Error(code);
  return actual;
}

export function verifyEvidenceHeadBinding(evidenceLogPath, anchorPath, anchorChainPaths) {
  const logPath = requireAbsoluteExisting(evidenceLogPath, "EVIDENCE_TAMPERED");
  const log = verifyEvidenceLog(logPath);
  if (!log.valid) throw new Error("EVIDENCE_TAMPERED");
  if (!Array.isArray(anchorChainPaths) || anchorChainPaths.length === 0) throw new Error("EVIDENCE_CHAIN_HEAD_INVALID");
  const resolvedHead = path.resolve(requireAbsoluteExisting(anchorPath, "EVIDENCE_CHAIN_HEAD_INVALID"));
  const resolvedChain = anchorChainPaths.map((file) => path.resolve(requireAbsoluteExisting(file, "EVIDENCE_CHAIN_HEAD_INVALID")));
  if (resolvedChain.at(-1) !== resolvedHead) throw new Error("EVIDENCE_CHAIN_HEAD_INVALID");
  let prior = "0".repeat(64);
  let checked;
  for (const file of resolvedChain) {
    checked = verifyCanonicalJsonFile(file);
    const item = checked.parsed;
    if (!checked.canonical || !verifySelfHashRecord(item) || item.role !== "EVIDENCE_CHAIN_HEAD_ANCHOR" || item.prior_anchor_hash !== prior) throw new Error("EVIDENCE_CHAIN_HEAD_INVALID");
    prior = item.anchor_hash;
  }
  const anchor = checked.parsed;
  if (anchor.last_sequence_number !== log.last_sequence_number || anchor.last_record_hash !== log.last_record_hash || anchor.log_byte_length !== log.byte_length) throw new Error("EVIDENCE_CHAIN_HEAD_INVALID");
  return { log, anchor_sha256: checked.sha256 };
}

export function recomputeRequestBindings(request, requestFile, registry) {
  const s = request.binding_source_paths;
  if (!s || typeof s !== "object") throw new Error("FINAL_PASS_INPUT_INVALID");
  const authority = request.authority_bindings;
  const root = request.root_scope_binding;
  const hashes = {
    implementation_baseline_manifest_sha256: verifiedFileHash(s.implementation_baseline_manifest_path, authority.implementation_baseline_manifest_sha256),
    implementation_baseline_anchor_sha256: verifiedFileHash(s.implementation_baseline_anchor_path, authority.implementation_baseline_anchor_sha256),
    validator_registry_sha256: registry.registryChecked.sha256,
    validator_registry_anchor_sha256: registry.anchorChecked.sha256,
    validation_authorization_record_sha256: verifiedFileHash(s.validation_authorization_record_path, authority.validation_authorization_record_sha256, "PREBUILD_AUTHORIZATION_INVALID"),
    prebuild_authorization_anchor_sha256: verifiedFileHash(request.prebuild_authorization_anchor_path, authority.prebuild_authorization_anchor_sha256, "PREBUILD_AUTHORIZATION_INVALID"),
    evidence_chain_head_anchor_sha256: verifiedFileHash(request.evidence_chain_head_anchor_path, authority.evidence_chain_head_anchor_sha256, "EVIDENCE_CHAIN_HEAD_INVALID"),
  };
  if (hashes.validator_registry_sha256 !== authority.validator_registry_sha256 || hashes.validator_registry_anchor_sha256 !== authority.validator_registry_anchor_sha256) throw new Error("VALIDATOR_REGISTRY_INVALID");
  const resolvedRoot = path.resolve(root.audited_root_declared_absolute_path);
  const resolvedVerification = path.resolve(root.verification_workspace_absolute_path);
  const derivedRoot = {
    ...root,
    audited_root_resolved_absolute_path: resolvedRoot,
    scope_spec_sha256: verifiedFileHash(s.scope_spec_path, root.scope_spec_sha256, "SCOPE_SPEC_CHANGED"),
    ignore_spec_sha256: verifiedFileHash(s.ignore_spec_path, root.ignore_spec_sha256, "IGNORE_SPEC_CHANGED"),
    origin_registry_sha256: verifiedFileHash(s.origin_registry_path, root.origin_registry_sha256, "ORIGIN_REGISTRY_CHANGED"),
    materialized_registry_sha256: verifiedFileHash(s.materialized_registry_path, root.materialized_registry_sha256, "MATERIALIZED_REGISTRY_CHANGED"),
    freeze_manifest_sha256: verifiedFileHash(s.freeze_manifest_path, root.freeze_manifest_sha256, "FREEZE_MANIFEST_INVALID"),
    freeze_hash_anchor_sha256: verifiedFileHash(s.freeze_hash_anchor_path, root.freeze_hash_anchor_sha256, "FREEZE_MANIFEST_INVALID"),
    storage_identity_evidence_sha256: verifiedFileHash(s.storage_identity_evidence_path, root.storage_identity_evidence_sha256, "AUDIT_ROOT_NOT_OBSERVED"),
    verification_workspace_in_scope: isInside(resolvedVerification, resolvedRoot),
  };
  if (derivedRoot.audited_root_resolved_absolute_path !== path.resolve(root.audited_root_resolved_absolute_path)) throw new Error("AUDIT_ROOT_NOT_OBSERVED");
  if (derivedRoot.verification_workspace_in_scope) throw new Error("VERIFICATION_WORKSPACE_IN_SCOPE");
  const scopeSpec = readJson(s.scope_spec_path);
  if (scopeSpec.scope_root !== root.scope_root) throw new Error("SCOPE_SPEC_ANCHOR_INVALID");
  const freeze = readJson(s.freeze_manifest_path);
  if (freeze.scope_spec_sha256 !== derivedRoot.scope_spec_sha256 || freeze.ignore_spec_sha256 !== derivedRoot.ignore_spec_sha256 || freeze.origin_registry_sha256 !== derivedRoot.origin_registry_sha256 || freeze.materialized_registry_sha256 !== derivedRoot.materialized_registry_sha256) throw new Error("FREEZE_MANIFEST_INVALID");
  const prebuild = readJson(request.prebuild_authorization_anchor_path);
  const prebuildBranch = prebuild.branches?.[request.branch_id] ?? prebuild;
  if (prebuildBranch.scope_spec_sha256 !== derivedRoot.scope_spec_sha256 || prebuildBranch.ignore_spec_sha256 !== derivedRoot.ignore_spec_sha256) throw new Error("PREBUILD_AUTHORIZATION_INVALID");
  const baselineAnchor = readJson(s.implementation_baseline_anchor_path);
  if (baselineAnchor.implementation_baseline_manifest_sha256 !== hashes.implementation_baseline_manifest_sha256 && baselineAnchor.baseline_manifest_sha256 !== hashes.implementation_baseline_manifest_sha256) throw new Error("FINAL_PASS_INPUT_INVALID");
  const storageEvidence = readJson(s.storage_identity_evidence_path);
  if (storageEvidence.storage_identity_kind !== root.storage_identity_kind || storageEvidence.storage_identity_value !== root.storage_identity_value) throw new Error("AUDIT_ROOT_NOT_OBSERVED");
  const evidence = verifyEvidenceHeadBinding(s.evidence_log_path, request.evidence_chain_head_anchor_path, s.evidence_chain_anchor_paths);
  if (evidence.anchor_sha256 !== hashes.evidence_chain_head_anchor_sha256) throw new Error("EVIDENCE_CHAIN_HEAD_INVALID");
  return { authority: { ...authority, ...hashes }, root: derivedRoot, evidence };
}

function result(status, sourceArtifactIds, errorCodes = []) {
  return { status, assertion_algorithm_id: VALIDATOR_ALGORITHM_ID, source_artifact_ids: sourceArtifactIds, error_codes: errorCodes, builder_reported_status: null, builder_status_used_as_oracle: false };
}

function safeRead(file, fallback = null) {
  try { return readJson(file); } catch { return fallback; }
}

export function recomputeRtResults(request, inputArtifacts) {
  const lineageRoot = path.resolve(request.lineage_root);
  const clean = branchPaths(lineageRoot, "clean");
  const dirty = branchPaths(lineageRoot, "dirty");
  const artifactIds = inputArtifacts.map((entry) => entry.artifact_id);
  const results = Object.fromEntries(RT_IDS.map((id) => [id, result("UNVERIFIED", artifactIds, ["FINAL_PASS_INPUT_INVALID"])]));
  const set = (number, pass, codes = []) => { results[`RT-${String(number).padStart(2, "0")}`] = result(pass ? "PASS" : "FAIL", artifactIds, pass ? [] : codes); };
  try {
    const cleanManifest = readJson(path.join(clean.auditedRoot, "PROJECT_INIT_MANIFEST.json"));
    const dirtyManifest = readJson(path.join(dirty.auditedRoot, "PROJECT_INIT_MANIFEST.json"));
    const cleanArchitecture = readJson(path.join(clean.auditedRoot, "FILESYSTEM_ARCHITECTURE.json"));
    const cleanPathContract = readJson(path.join(clean.auditedRoot, "PATH_CONTRACT.json"));
    const ownership = readJson(path.join(clean.auditedRoot, "AGENT_OWNERSHIP.json"));
    const environment = readJson(path.join(clean.auditedRoot, "ENVIRONMENT_BASELINE.json"));
    const clarification = readJson(path.join(lineageRoot, "evidence", "payloads", "shared", "clarification-records.json"));
    const inventory = readJson(path.join(lineageRoot, "evidence", "AUTHORITATIVE_ARTIFACT_INVENTORY.json"));
    const evidenceLog = verifyEvidenceLog(path.join(lineageRoot, "evidence", "evidence.log"));
    const cleanApproved = readJson(path.join(clean.control, "approved-materialized-registry.json"));
    const dirtyOrigin = readJson(path.join(dirty.control, "origin-registry.json"));
    const cleanReality = registryReality(lineageRoot, "clean");
    const dirtyReality = registryReality(lineageRoot, "dirty");
    const allReality = [cleanReality, dirtyReality].every((entry) => entry.approvedChecks.every((check) => check.match) && entry.missingPreexisting.length === 0 && entry.unknown.length === 0);
    const stage0Exists = [clean, dirty].every((branch) => STAGE0_FILES.every((file) => fs.existsSync(path.join(branch.auditedRoot, file))));
    const classificationHashesValid = [clarification.blocking_record, clarification.defaultable_record].every((recordValue) => { const { classification_record_sha256, ...withoutHash } = recordValue; return classification_record_sha256 === sha256Bytes(canonicalBytes(withoutHash)); });
    const envFields = ["observation_id", "name", "required", "expected_condition", "collection_method", "observation_time", "command", "RESOLVED_EXECUTABLE", "version_output", "virtual_env", "conda_prefix", "path_context", "status"];
    const envComplete = environment.observations.every((observation) => requiredKeys(observation, envFields) && (!observation.RESOLVED_EXECUTABLE || path.isAbsolute(observation.RESOLVED_EXECUTABLE)));
    const envReplay = environment.observations.filter((observation) => observation.status === "FOUND").every((observation) => runVersion(observation.RESOLVED_EXECUTABLE) === observation.version_output);
    const requiredEnvironmentResolved = environment.observations.filter((observation) => observation.required).every((observation) => ["FOUND", "NOT_APPLICABLE"].includes(observation.status));
    const requiredManifestKeys = ["project_root", "authoritative_artifact_inventory", "filesystem_inventory", "referenced_path_coverage", "existing_state", "repository_state", "assumption_register", "unresolved_blockers", "auditor", "gate_status", "next_action"];
    const manifestValid = [cleanManifest, dirtyManifest].every((manifest) => requiredKeys(manifest, requiredManifestKeys) && samePathSet(manifest.authoritative_artifact_inventory.map((entry) => entry.path), STAGE0_FILES));
    const gateEvidence = ["filesystem-reconciliation.json", "referenced-path-matrix.json", "git-state-output.json", "scaffold-scan.json", "manifest-reconciliation.json"].every((name) => ["clean", "dirty"].every((branch) => fs.existsSync(path.join(lineageRoot, "evidence", "payloads", branch, name))));
    const inventoryPaths = new Set(inventory.entries.map((entry) => entry.path));
    const inventorySelf = inventory.entries.find((entry) => entry.path === "evidence/AUTHORITATIVE_ARTIFACT_INVENTORY.json");
    const inventoryHashesValid = inventory.entries.filter((entry) => entry.sha256 && !path.isAbsolute(entry.path)).every((entry) => { const file = path.join(lineageRoot, ...entry.path.split("/")); return fs.existsSync(file) && sha256File(file) === entry.sha256 && fs.statSync(file).size === entry.size; });
    const cleanMaterializedPaths = cleanApproved.entries.map((entry) => entry.relative_path);
    const dirtyPreexisting = new Map(dirtyReality.actual.filter((entry) => entry.origin_classification === "PREEXISTING").map((entry) => [entry.relative_path, entry]));
    // Contract v1.3:146 and rt-execution-spec-v1.1.3 RT-29 compare the required identity/classification projection only.
    const dirtyHashesUnchanged = dirtyOrigin.entries.every((expected) => {
      const observed = dirtyPreexisting.get(expected.relative_path);
      const expectedProjection = {
        relative_path: expected.relative_path,
        file_type: expected.file_type,
        size: expected.size,
        sha256: expected.sha256,
        origin_classification: expected.origin_classification,
        existing_state_classification: expected.existing_state_classification,
      };
      const observedProjection = observed ? {
        relative_path: observed.relative_path,
        file_type: observed.file_type,
        size: observed.size,
        sha256: observed.sha256,
        origin_classification: observed.origin_classification,
        existing_state_classification: expected.existing_state_classification,
      } : null;
      return canonical(expectedProjection) === canonical(observedProjection);
    });
    const cleanSnapshotB = path.join(clean.verification, "PRE_FREEZE_SNAPSHOT_B.json");
    const dirtySnapshotB = path.join(dirty.verification, "PRE_FREEZE_SNAPSHOT_B.json");
    const cleanFreeze = path.join(clean.verification, "freeze-manifest.json");
    const dirtyFreeze = path.join(dirty.verification, "freeze-manifest.json");
    const cleanPost = readJson(path.join(clean.verification, "POST_FREEZE_SCAN.json"));
    const dirtyPost = readJson(path.join(dirty.verification, "POST_FREEZE_SCAN.json"));
    const requestRecord = readJson(path.join(lineageRoot, "authorization-request", "prebuild-authorization-request.json"));
    const rt34 = readJson(path.join(lineageRoot, "negative-branches", "rt-34", "builder-created-anchor.json"));
    const rt35Root = path.join(lineageRoot, "negative-branches", "rt-35", "audited-root");
    const rt35Freeze = readJson(path.join(lineageRoot, "negative-branches", "rt-35", "freeze-manifest.json"));
    const rt35Diff = diffEntries(rt35Freeze.entries, scanRoot(rt35Root));
    const rt37Root = path.join(lineageRoot, "negative-branches", "rt-37", "audited-root");
    const rt37Anchor = readJson(path.join(lineageRoot, "negative-branches", "rt-37", "later-builder-anchor.json"));
    const rootPlacement = [clean.control, dirty.control, clean.verification, dirty.verification].every((candidate) => !isInside(candidate, clean.auditedRoot) && !isInside(candidate, dirty.auditedRoot));
    const freezeMatch = fs.readFileSync(cleanSnapshotB).equals(fs.readFileSync(cleanFreeze)) && fs.readFileSync(dirtySnapshotB).equals(fs.readFileSync(dirtyFreeze));

    set(1, clarification.defaultable_record.status === "CONFIRMED" && clarification.blocking_record.status === "UNRESOLVED", ["REQUIRED_CLARIFICATION_UNRESOLVED"]);
    set(2, dirtyOrigin.entries.length === 13 && dirtyOrigin.entries.every((entry) => DIRTY_CLASSIFICATION[entry.relative_path] === entry.existing_state_classification), ["FILESYSTEM_REALITY_GATE_FAIL"]);
    set(3, allReality && cleanReality.actual.length === STAGE0_FILES.length, ["FILESYSTEM_REALITY_GATE_FAIL"]);
    set(4, !cleanMaterializedPaths.some((candidate) => ["src", "docker", "config", "scripts", ".env.example"].includes(candidate.split("/")[0])), ["UNEXPECTED_ARTIFACT"]);
    set(5, samePathSet(cleanMaterializedPaths, STAGE0_FILES), ["FILESYSTEM_REALITY_GATE_FAIL"]);
    set(6, stage0Exists && manifestValid, ["FILESYSTEM_REALITY_GATE_FAIL"]);
    set(7, !fs.existsSync(path.join(clean.auditedRoot, ".git")) && !fs.existsSync(path.join(dirty.auditedRoot, ".git")) && cleanManifest.repository_state === "NOT_INITIALIZED", ["FINAL_PASS_INPUT_INVALID"]);
    set(8, manifestValid, ["FINAL_PASS_INPUT_INVALID"]);
    set(9, cleanManifest.gate_status.PROJECT_INIT_STATUS === "PENDING_INDEPENDENT_REVIEW" && cleanManifest.gate_status.INDEPENDENT_REVIEW === "PENDING" && cleanManifest.gate_status.READY_FOR_IMPLEMENTATION === "NO", ["FINAL_PASS_INPUT_INVALID"]);
    set(10, Boolean(cleanManifest.auditor && cleanManifest.auditor !== "NOT_ASSIGNED"), ["FINAL_PASS_INPUT_INVALID"]);
    set(11, fs.existsSync(path.join(clean.auditedRoot, "TASK_CONTRACT.json")) && readJson(path.join(clean.auditedRoot, "TASK_CONTRACT.json")).tasks.every((task) => task.task_id && task.owner && task.completion_criteria.length), ["FINAL_PASS_INPUT_INVALID"]);
    set(12, ["PENDING_INDEPENDENT_REVIEW", "PASS", "FAIL", "BLOCKED"].includes(cleanManifest.gate_status.PROJECT_INIT_STATUS) && ["PASS", "FAIL", "PENDING", "BLOCKED"].includes(cleanManifest.gate_status.INDEPENDENT_REVIEW) && ["YES", "NO"].includes(cleanManifest.gate_status.READY_FOR_IMPLEMENTATION), ["FINAL_PASS_INPUT_INVALID"]);
    set(13, stage0Exists && readJson(path.join(clean.auditedRoot, "DATA_ARTIFACT_FLOW.json")).promotion_rule === "Candidate is not Product" && ownership.forbidden_chain.includes("cannot"), ["FINAL_PASS_INPUT_INVALID"]);
    set(14, cleanManifest.referenced_path_coverage.orphan_referenced_path_count === 0 && cleanManifest.referenced_path_coverage.unknown_referenced_path_count === 0, ["ORPHAN_REFERENCED_PATH", "UNKNOWN_REFERENCED_PATH"]);
    set(15, clarification.blocking_record.status === "UNRESOLVED" && clarification.blocking_record.decision === null, ["REQUIRED_CLARIFICATION_UNRESOLVED"]);
    set(16, cleanPathContract.documented_absolute_path_allowed === true && cleanPathContract.runtime_hardcoded_machine_path_forbidden === true, ["FINAL_PASS_INPUT_INVALID"]);
    set(17, gateEvidence && inventoryPaths.has("evidence/payloads/clean/filesystem-reconciliation.json"), ["FINAL_PASS_INPUT_INVALID"]);
    set(18, cleanArchitecture.top_level_count === STAGE0_FILES.length && cleanArchitecture.nested_path_count === 0 && cleanArchitecture.total_designed_path_count === STAGE0_FILES.length + 2, ["FINAL_PASS_INPUT_INVALID"]);
    set(19, ownership.builder.role === "Builder" && ownership.forbidden_chain.includes("cannot independently validate"), ["VALIDATOR_INTEGRITY_FAIL"]);
    set(20, envComplete && envReplay, ["ENVIRONMENT_PROVENANCE_INCOMPLETE", "ENVIRONMENT_DRIFT"]);
    set(21, dirtyOrigin.entries.some((entry) => entry.relative_path === "temp/cache.tmp" && entry.existing_state_classification === "DELETE_CANDIDATE") && readJson(path.join(dirty.auditedRoot, "BACKUP_ROLLBACK_RECOVERY.json")).rollback.includes("retain PREEXISTING"), ["FINAL_PASS_INPUT_INVALID"]);
    set(22, dirtyReality.approvedChecks.every((check) => check.match) && dirtyReality.missingPreexisting.length === 0 && dirtyReality.unknown.length === 0, ["FILESYSTEM_REALITY_GATE_FAIL"]);
    set(23, inventorySelf?.sha256 === null && inventoryHashesValid && STAGE0_FILES.every((name) => inventoryPaths.has(`audited-roots/clean/${name}`) && inventoryPaths.has(`audited-roots/dirty/${name}`)), ["FINAL_PASS_INPUT_INVALID"]);
    set(24, envComplete && envReplay && environment.observations.every((observation) => Object.hasOwn(observation, "path_context")), ["ENVIRONMENT_PROVENANCE_INCOMPLETE"]);
    set(25, classificationHashesValid && clarification.defaultable_record.status !== "ACCEPTED_DEFAULT", ["REQUIRED_CLARIFICATION_UNRESOLVED"]);
    set(26, allReality && ["clean", "dirty"].every((name) => requestRecord.branches[name].scope_spec_sha256 === request.prebuild_anchor.branches[name].scope_spec_sha256), ["SCOPE_SPEC_ANCHOR_INVALID"]);
    set(27, envComplete && requiredEnvironmentResolved, ["REQUIRED_ENVIRONMENT_UNRESOLVED"]);
    set(28, freezeMatch && cleanPost.diff_count === 0 && dirtyPost.diff_count === 0 && evidenceLog.valid, ["FROZEN_STATE_CHANGED", "EVIDENCE_TAMPERED"]);
    set(29, dirtyHashesUnchanged, ["FROZEN_STATE_CHANGED"]);
    set(30, classificationHashesValid && allReality && envComplete && envReplay && cleanPost.diff_count === 0 && dirtyPost.diff_count === 0 && evidenceLog.valid, ["CROSS_CASE_RUNTIME_TEST_FAIL"]);
    set(31, rootPlacement && cleanApproved.entries.length > 0, ["CONTROL_PLANE_PLACEMENT_INVALID"]);
    set(32, freezeMatch && !readJson(cleanFreeze).entries.some((entry) => entry.relative_path.includes("freeze-manifest") || entry.relative_path.includes("registry")), ["CONTROL_PLANE_SELF_REFERENCE"]);
    set(33, verifyAnchorRoleSeparation(request), ["ANCHOR_ROLE_INVALID"]);
    set(34, rt34.producer_role === "BUILDER" && !requiredKeys(rt34, ["approved_by", "custody_evidence", "anchor_hash"]), ["ANCHOR_ROLE_INVALID"]);
    set(35, rt35Diff.some((entry) => entry.relative_path === "POST_FREEZE_STATUS.json"), ["POST_FREEZE_WRITE_BARRIER_FAIL"]);
    set(36, cleanManifest.gate_status.INDEPENDENT_REVIEW === "PENDING" && cleanManifest.gate_status.PROJECT_INIT_STATUS === "PENDING_INDEPENDENT_REVIEW" && cleanManifest.gate_status.READY_FOR_IMPLEMENTATION === "NO", ["FINAL_PASS_INPUT_INVALID"]);
    set(37, fs.readdirSync(rt37Root).length === 0 && rt37Anchor.producer_role === "BUILDER", ["PREBUILD_AUTHORIZATION_INVALID"]);
    set(38, [28, 31, 32, 33, 34, 35, 36, 37].every((number) => results[`RT-${String(number).padStart(2, "0")}`].status === "PASS"), ["CROSS_CASE_RUNTIME_TEST_FAIL"]);
  } catch {
    // Fail closed: unevaluated RTs remain UNVERIFIED rather than inheriting Builder booleans.
  }
  return results;
}

export function deriveEvaluationSummary(rtResults, gateResults = [], counters = {}) {
  const values = Object.values(rtResults);
  const failedRtCount = values.filter((entry) => entry.status === "FAIL").length;
  const notPassedRtCount = values.filter((entry) => entry.status !== "PASS").length;
  const blockingFindings = gateResults.filter((entry) => entry.gate_status === "FAIL").length + failedRtCount;
  const unverifiedGateCount = gateResults.filter((entry) => entry.gate_status === "UNVERIFIED").length;
  const blockedGateCount = gateResults.filter((entry) => entry.gate_status === "BLOCKED").length;
  const capReached = counters.remediation_loops >= 3 || counters.validation_cycles >= 3 || counters.production_validation_cycles >= 3;
  const allPass = values.length === 38 && notPassedRtCount === 0 && blockingFindings === 0 && unverifiedGateCount === 0 && blockedGateCount === 0;
  const validatorVerdict = blockingFindings > 0 ? "FAIL" : allPass ? "PASS" : "NOT_READY";
  const contractState = capReached ? "ESCALATION_TO_HUMAN" : validatorVerdict;
  const errorCodes = [...new Set([...values.flatMap((entry) => entry.error_codes), ...gateResults.flatMap((entry) => entry.error_codes || [])])];
  return { validator_verdict: capReached ? "NOT_READY" : validatorVerdict, contract_state: contractState, all_required_regression_tests_pass: allPass, cross_case_runtime_test_pass: rtResults["RT-38"]?.status === "PASS", blocking_finding_count: blockingFindings, unverified_gate_count: unverifiedGateCount, blocked_gate_count: blockedGateCount, failed_rt_count: failedRtCount, not_passed_rt_count: notPassedRtCount, error_codes: errorCodes };
}

function buildInputArtifacts(boundFiles, request) {
  return boundFiles.map((binding) => ({ artifact_id: binding.artifact_id, artifact_role: binding.artifact_role, resolved_path: binding.resolved_path, plane: binding.plane, producer_role: binding.producer_role, candidate_lineage_id: binding.candidate_lineage_id, branch_id: binding.branch_id ?? null, size: binding.size, sha256: binding.sha256, custody_record_sha256: binding.custody_record_sha256 ?? null, immutable_input: binding.immutable_input === true }));
}

export function makeGateResults(rtResults) {
  const statuses = Object.values(rtResults).map((entry) => entry.status);
  const allPass = statuses.length === 38 && statuses.every((status) => status === "PASS");
  const aggregateStatus = allPass ? "PASS" : statuses.includes("FAIL") ? "FAIL" : statuses.includes("BLOCKED") ? "BLOCKED" : "UNVERIFIED";
  const crossStatus = rtResults["RT-38"]?.status ?? "UNVERIFIED";
  return [
    { gate_id: "all_required_regression_tests_pass", gate_status: aggregateStatus, expected_value: true, actual_value: allPass, error_codes: aggregateStatus === "FAIL" ? ["REQUIRED_REGRESSION_TEST_FAIL"] : [], evidence_artifact_ids: [] },
    { gate_id: "cross_case_runtime_test_pass", gate_status: crossStatus, expected_value: true, actual_value: crossStatus === "PASS", error_codes: crossStatus === "FAIL" ? ["CROSS_CASE_RUNTIME_TEST_FAIL"] : [], evidence_artifact_ids: [] },
  ];
}

export function validateResultShape(resultObject) {
  const topKeys = ["schema_version", "artifact_class", "procedure_version", "result_id", "candidate_version", "candidate_lineage_id", "branch_id", "evaluation_profile", "validation_cycle", "started_at", "completed_at", "validator_identity", "authority_bindings", "root_scope_binding", "input_artifacts", "contract_gate_results", "rt_results", "findings", "evaluation_summary", "canonicalization_profile", "result_sha256"];
  if (!requiredKeys(resultObject, topKeys) || !samePathSet(Object.keys(resultObject), topKeys)) return false;
  if (resultObject.schema_version !== RESULT_SCHEMA_VERSION || resultObject.artifact_class !== "AUDIT_RESULT" || resultObject.procedure_version !== PROCEDURE_VERSION) return false;
  if (canonical(Object.keys(resultObject.rt_results).sort()) !== canonical(RT_IDS)) return false;
  const rtKeys = ["status", "assertion_algorithm_id", "source_artifact_ids", "error_codes", "builder_reported_status", "builder_status_used_as_oracle"];
  if (!Object.values(resultObject.rt_results).every((entry) => entry.builder_status_used_as_oracle === false && samePathSet(Object.keys(entry), rtKeys) && ["PASS", "FAIL", "BLOCKED", "UNVERIFIED"].includes(entry.status))) return false;
  if (!["PASS", "FAIL", "NOT_READY"].includes(resultObject.evaluation_summary?.validator_verdict)) return false;
  if (!["PASS", "FAIL", "NOT_READY", "ESCALATION_TO_HUMAN"].includes(resultObject.evaluation_summary?.contract_state)) return false;
  const withoutHash = { ...resultObject };
  delete withoutHash.result_sha256;
  return sha256Bytes(canonicalBytes(withoutHash)) === resultObject.result_sha256;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Usage: validator.mjs --request <absolute-canonical-json> --output <absolute-new-result-json>");
    values[argv[index].slice(2)] = argv[index + 1];
  }
  return values;
}

export function executeValidation(requestFile, outputFile) {
  if (!path.isAbsolute(requestFile) || !path.isAbsolute(outputFile)) throw new Error("FINAL_PASS_INPUT_INVALID");
  const request = readJson(requestFile);
  const authorizationCheck = verifyAuthorization(request, requestFile);
  if (request.candidate_version !== "V1.1.4" || !["REGRESSION_VALIDATION", "FINAL_PASS_VALIDATION", "PV_SCENARIO_VALIDATION"].includes(request.evaluation_profile)) throw new Error("FINAL_PASS_INPUT_INVALID");
  const libCompatibility = verifyExistingLibCompatibility(request.regression_library_path);
  if (!verifyKnownAnswerVectors() || !libCompatibility.pass) throw new Error("FINAL_PASS_INPUT_INVALID");
  const registry = verifyRegistry(request.validator_registry_path, request.validator_registry_anchor_path, request);
  const recomputedBindings = recomputeRequestBindings(request, requestFile, registry);
  const boundFiles = verifyBoundFiles(request);
  const inputArtifacts = buildInputArtifacts(boundFiles, request);
  const auditedRoots = request.audited_roots.map((root) => path.resolve(root));
  if (auditedRoots.some((root) => isInside(outputFile, root))) throw new Error("VERIFICATION_SIDE_EFFECT");
  const externalPaths = [request.validator_registry_path, request.validator_registry_anchor_path, request.evidence_chain_head_anchor_path, ...request.freeze_hash_anchor_paths];
  if (externalPaths.some((candidate) => auditedRoots.some((root) => isInside(candidate, root)))) throw new Error("CONTROL_PLANE_PLACEMENT_INVALID");
  const protectedBefore = externalPaths.map(fileIdentity);
  const before = Object.fromEntries(auditedRoots.map((root) => [root, scanRoot(root)]));
  request.prebuild_anchor = readJson(request.prebuild_authorization_anchor_path);
  const prebuildCustodyReference = request.prebuild_anchor.custody_evidence?.evidence_reference;
  const prebuildCustodyHashValid = typeof prebuildCustodyReference === "string" && path.isAbsolute(prebuildCustodyReference) && fs.existsSync(prebuildCustodyReference) && request.prebuild_anchor.custody_evidence.evidence_sha256 === sha256File(prebuildCustodyReference);
  const prebuildAuthority = evaluatePortableAuthority(request.prebuild_anchor, { governedBuildStartedAt: request.governed_build_started_at, requirePrebuild: true, immutableHashBindingVerified: prebuildCustodyHashValid });
  const rtResults = recomputeRtResults(request, inputArtifacts);
  const gateResults = makeGateResults(rtResults);
  const after = Object.fromEntries(auditedRoots.map((root) => [root, scanRoot(root)]));
  const protectedAfter = externalPaths.map(fileIdentity);
  const protectedLocationsUnchanged = canonical(protectedBefore) === canonical(protectedAfter);
  const rootUnchanged = auditedRoots.every((root) => diffEntries(before[root], after[root]).length === 0);
  if (!rootUnchanged) {
    for (const entry of Object.values(rtResults)) if (entry.status === "PASS") entry.error_codes = [...new Set([...entry.error_codes, "FROZEN_STATE_CHANGED"])];
  }
  let finalGateResults = rootUnchanged ? gateResults : [...gateResults, { gate_id: "freeze_diff_empty", gate_status: "FAIL", expected_value: true, actual_value: false, error_codes: ["FROZEN_STATE_CHANGED"], evidence_artifact_ids: [] }];
  if (!protectedLocationsUnchanged) finalGateResults = [...finalGateResults, { gate_id: "protected_location_write_guard", gate_status: "FAIL", expected_value: true, actual_value: false, error_codes: ["AUDITOR_WRITE_VIOLATION"], evidence_artifact_ids: [] }];
  const summary = deriveEvaluationSummary(rtResults, finalGateResults, request.counters || {});
  const completedAt = now6();
  const resultWithoutHash = {
    schema_version: RESULT_SCHEMA_VERSION, artifact_class: "AUDIT_RESULT", procedure_version: PROCEDURE_VERSION,
    result_id: request.result_id, candidate_version: "V1.1.4", candidate_lineage_id: request.candidate_lineage_id,
    branch_id: request.branch_id, evaluation_profile: request.evaluation_profile, validation_cycle: request.validation_cycle,
    started_at: request.execution_started_at, completed_at: completedAt,
    validator_identity: {
      validator_id: VALIDATOR_ID, validator_version: VALIDATOR_VERSION, validator_sha256: registry.selfHash,
      validator_algorithm_id: VALIDATOR_ALGORITHM_ID, validator_runtime_name: "node", validator_runtime_version: process.version,
      validator_runtime_executable: path.resolve(process.execPath), validator_runtime_executable_sha256: sha256File(process.execPath),
      validator_registry_sha256: registry.registryChecked.sha256, validator_registry_anchor_sha256: registry.anchorChecked.sha256,
      approval_status: registry.entry.approval_status, approval_scope: registry.entry.approval_scope, approved_by: registry.entry.approved_by,
      approved_at: registry.entry.approved_at, expiry_or_null: registry.entry.expiry_or_null,
      execution_security_identity: request.validator_logical_identity, builder_security_identity: request.builder_logical_identity,
      validator_logical_identity: request.validator_logical_identity, builder_logical_identity: request.builder_logical_identity,
      validator_agent_instance_id: request.authorization.validator_agent_instance_id, builder_agent_instance_id: request.authorization.builder_agent_instance_id,
      os_identity_relationship: request.os_identity_relationship || "UNKNOWN",
      identity_separation_verified: request.authorization.validator_agent_instance_id !== request.authorization.builder_agent_instance_id,
    },
    authority_bindings: { ...recomputedBindings.authority, logical_authorized_write_set_sha256: sha256Bytes(canonicalBytes(request.prebuild_anchor.custody_evidence.authorized_write_set)), portable_builder_write_exclusion_verified: prebuildAuthority.valid, append_only_chain_guard_verified: request.prebuild_anchor.custody_evidence.evidence_chain_valid === true && request.prebuild_anchor.custody_evidence.chain_head_valid === true, final_auditor_reverification_required: request.prebuild_anchor.custody_evidence.final_auditor_reverification_required === true },
    root_scope_binding: { ...recomputedBindings.root, before_snapshot_sha256: sha256Bytes(canonicalBytes(before)), after_snapshot_sha256: sha256Bytes(canonicalBytes(after)), protected_location_before_sha256: sha256Bytes(canonicalBytes(protectedBefore)), protected_location_after_sha256: sha256Bytes(canonicalBytes(protectedAfter)), protected_locations_unchanged: protectedLocationsUnchanged, root_unchanged_during_validation: rootUnchanged, read_only_mechanism: prebuildAuthority.high_assurance_isolation ? "OS_ENFORCED" : "BEFORE_AFTER_FULL_GUARD", assurance_profile: prebuildAuthority.assurance_profile, high_assurance_isolation: prebuildAuthority.high_assurance_isolation, write_attempted: false },
    input_artifacts: inputArtifacts, contract_gate_results: finalGateResults, rt_results: rtResults, findings: [], evaluation_summary: summary,
    canonicalization_profile: { algorithm: "RFC8785_JCS_UTF8_PLUS_LF", known_answer_vector_set: "V114-JCS-KAT-1", known_answer_vectors_pass: true, existing_lib_compatibility_pass: libCompatibility.pass },
  };
  const finalResult = { ...resultWithoutHash, result_sha256: sha256Bytes(canonicalBytes(resultWithoutHash)) };
  if (!validateResultShape(finalResult)) throw new Error("FINAL_PASS_INPUT_INVALID");
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, canonicalBytes(finalResult), { flag: "wx" });
  return { authorization_request_sha256: authorizationCheck.sha256, output: fileIdentity(outputFile), result: finalResult };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const execution = executeValidation(path.resolve(args.request), path.resolve(args.output));
  process.stdout.write(`${canonical({ payload_sha256: execution.output.sha256, result_path: execution.output.path, result_sha256: execution.result.result_sha256, validator_verdict: execution.result.evaluation_summary.validator_verdict })}${LF}`);
  process.exitCode = execution.result.evaluation_summary.validator_verdict === "PASS" ? 0 : execution.result.evaluation_summary.validator_verdict === "FAIL" ? 1 : 2;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  try { main(); }
  catch (error) {
    const code = String(error.message || error);
    const failCodes = new Set(["VALIDATOR_REGISTRY_INVALID", "VALIDATOR_INTEGRITY_FAIL", "EVIDENCE_TAMPERED", "EVIDENCE_CHAIN_HEAD_INVALID", "CONTROL_PLANE_PLACEMENT_INVALID", "VERIFICATION_SIDE_EFFECT", "FROZEN_STATE_CHANGED", "FREEZE_MANIFEST_INVALID"]);
    const failed = failCodes.has(code);
    process.stderr.write(`${canonical({ contract_state: failed ? "FAIL" : "NOT_READY", error: code, validator_verdict: failed ? "FAIL" : "NOT_READY" })}${LF}`);
    process.exitCode = failed ? 1 : 2;
  }
}
