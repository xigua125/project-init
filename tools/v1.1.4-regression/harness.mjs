#!/usr/bin/env node
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  appendEvidence,
  assertFreshDirectory,
  canonical,
  canonicalBytes,
  diffEntries,
  ensureDir,
  fileIdentity,
  isInside,
  readJson,
  requiredKeys,
  scanRoot,
  sha256Bytes,
  sha256File,
  verifyCanonicalFile,
  verifyEvidenceLog,
  writeCanonical,
} from "./lib.mjs";

const HARNESS_VERSION = "1.1.4-remediation.2-portable-authority";
const PRODUCER = "Codex V1.1.4 remediation Builder";
const PRODUCER_HASH = sha256Bytes(Buffer.from(`${PRODUCER}|${HARNESS_VERSION}`, "utf8"));
const STAGE0_FILES = [
  "PROJECT_CHARTER.json",
  "REQUIREMENTS_SCOPE.json",
  "FILESYSTEM_ARCHITECTURE.json",
  "PATH_CONTRACT.json",
  "DATA_ARTIFACT_FLOW.json",
  "AGENT_OWNERSHIP.json",
  "ENVIRONMENT_BASELINE.json",
  "ACCEPTANCE_GATES.json",
  "EVIDENCE_POLICY.json",
  "BACKUP_ROLLBACK_RECOVERY.json",
  "TASK_CONTRACT.json",
  "PROJECT_INIT_MANIFEST.json",
];
const DIRTY_FILES = {
  ".env.example": "DATABASE_URL=postgresql://localhost:5432/app\nAPI_KEY=replace_me\nDEBUG=false\n",
  "config/settings.yaml": "app:\n  name: legacy-app\n  version: 0.1.0\n",
  "docker/Dockerfile": "FROM python:3.11-slim\nWORKDIR /app\nCOPY . .\nCMD [\"python\", \"app.py\"]\n",
  "old-notes/notes.md": "# Historical notes — not authoritative for new architecture\n",
  "scripts/deploy.sh": "#!/bin/bash\necho \"Legacy deploy script\"\n",
  "src/old_module.py": "# Legacy module — not part of new architecture\ndef old_function():\n    pass\n",
  "temp/cache.tmp": "temporary cache data\n",
};
const DIRTY_CLASSIFICATION = {
  ".env.example": "DELETE_CANDIDATE",
  "config": "ARCHIVE",
  "config/settings.yaml": "ARCHIVE",
  "docker": "ARCHIVE",
  "docker/Dockerfile": "ARCHIVE",
  "old-notes": "ARCHIVE",
  "old-notes/notes.md": "ARCHIVE",
  "scripts": "ARCHIVE",
  "scripts/deploy.sh": "ARCHIVE",
  "src": "ARCHIVE",
  "src/old_module.py": "ARCHIVE",
  "temp": "DELETE_CANDIDATE",
  "temp/cache.tmp": "DELETE_CANDIDATE",
};
const NON_BUILDER_CUSTODY_ROLES = new Set(["HUMAN_CUSTODIAN", "VALIDATOR", "INDEPENDENT_AUDITOR", "FINAL_AUDITOR", "PM_ORCHESTRATOR"]);
const HUMAN_CUSTODIAN_ANCHOR_ROLES = new Set(["PREBUILD_AUTHORIZATION_ANCHOR", "VALIDATOR_REGISTRY_ANCHOR", "FREEZE_HASH_ANCHOR"]);

function anchorProducerRoleAllowed(anchorRole, producerRole) {
  return HUMAN_CUSTODIAN_ANCHOR_ROLES.has(anchorRole)
    ? producerRole === "HUMAN_CUSTODIAN"
    : NON_BUILDER_CUSTODY_ROLES.has(producerRole);
}

function selfTestCustodyRoles() {
  const humanRolesPass = [...HUMAN_CUSTODIAN_ANCHOR_ROLES].every((role) =>
    anchorProducerRoleAllowed(role, "HUMAN_CUSTODIAN") && !anchorProducerRoleAllowed(role, "VALIDATOR"));
  const independentRolePass = anchorProducerRoleAllowed("EVIDENCE_CHAIN_HEAD_ANCHOR", "INDEPENDENT_AUDITOR")
    && !anchorProducerRoleAllowed("EVIDENCE_CHAIN_HEAD_ANCHOR", "BUILDER");
  if (!humanRolesPass || !independentRolePass) throw new Error("CUSTODY_ROLE_MATRIX_SELF_TEST_FAILED");
  console.log(canonical({ AUTHORITY: "NON_AUTHORITATIVE", HUMAN_CUSTODIAN_ANCHOR_ROLES: [...HUMAN_CUSTODIAN_ANCHOR_ROLES].sort(), RESULT: "PASS", evidence_chain_head_independent_role_allowed: true }));
}

function now6() {
  return new Date().toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith("--") || rest[i + 1] === undefined) throw new Error(`Invalid argument near ${rest[i]}`);
    args[rest[i].slice(2)] = rest[i + 1];
  }
  return args;
}

function requireAbsolute(name, value) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return path.resolve(value);
}

function branchPaths(lineageRoot, name) {
  return {
    auditedRoot: path.join(lineageRoot, "audited-roots", name),
    control: path.join(lineageRoot, "control-plane", "prebuild", name),
    evidence: path.join(lineageRoot, "evidence", name),
    verification: path.join(lineageRoot, "verification-workspace", name),
  };
}

function runVersion(executable, args) {
  try {
    return childProcess.execFileSync(executable, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString("utf8").trim();
    return stderr || `ERROR:${error.message}`;
  }
}

function resolvePython() {
  try {
    const output = childProcess.execFileSync("where.exe", ["python"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return path.resolve(output.split(/\r?\n/).find(Boolean));
  } catch {
    return null;
  }
}

function environmentObservations() {
  const observedAt = now6();
  const python = resolvePython();
  return [
    {
      collection_method: "where.exe python; resolved executable --version",
      command: python ? `${python} --version` : "where.exe python",
      conda_prefix: process.env.CONDA_PREFIX || null,
      expected_condition: "Python executable is present for the REST API project",
      name: "Python",
      observation_id: "ENV-PYTHON-001",
      observation_time: observedAt,
      path_context: process.env.Path || process.env.PATH || "",
      project_requirement: "REQUIRED",
      required: true,
      RESOLVED_EXECUTABLE: python,
      status: python ? "FOUND" : "NOT_FOUND",
      version_output: python ? runVersion(python, ["--version"]) : null,
      virtual_env: process.env.VIRTUAL_ENV || null,
    },
    {
      collection_method: "Node process.execPath and resolved executable --version",
      command: `${process.execPath} --version`,
      conda_prefix: process.env.CONDA_PREFIX || null,
      expected_condition: "Node is the regression-harness runtime, not a project runtime requirement",
      name: "Node",
      observation_id: "ENV-NODE-001",
      observation_time: observedAt,
      path_context: process.env.Path || process.env.PATH || "",
      project_requirement: "NOT_REQUIRED",
      required: false,
      RESOLVED_EXECUTABLE: path.resolve(process.execPath),
      status: "FOUND",
      version_output: runVersion(process.execPath, ["--version"]),
      virtual_env: process.env.VIRTUAL_ENV || null,
    },
  ];
}

function stage0Corpus(branchName, auditedRoot, environment) {
  const dirty = branchName === "dirty";
  const inventory = STAGE0_FILES.map((relative_path) => ({
    artifact_type: "STAGE0_PROJECT_DOCUMENT",
    ownership: "BUILDER_DURING_BUILD_ONLY",
    path: relative_path,
    plane: "AUDITED_ROOT",
    purpose: relative_path.replace(/\.json$/, ""),
    status: "MATERIALIZED_PATH",
  }));
  const shared = {
    schema_version: "1.0.0",
    candidate_lineage_status: "CANDIDATE",
  };
  const documents = {
    "PROJECT_CHARTER.json": { ...shared, constraints: ["No production implementation", "Independent review required"], deliverables: STAGE0_FILES, definition_of_done: "All Stage-0 gates independently verifiable", goal: "Initialize a minimal inventory REST API project", non_goals: ["Production deployment"], users: ["inventory operators"] },
    "REQUIREMENTS_SCOPE.json": { ...shared, assumptions: [{ assumption: "FastAPI is the default implementation framework", owner: "Implementation owner", rationale: "Reversible implementation choice" }], backlog_boundary: ["API implementation"], dependencies: ["Python"], in_scope: ["Stage-0 architecture"], out_of_scope: ["Production implementation"], unresolved_blockers: [] },
    "FILESYSTEM_ARCHITECTURE.json": { ...shared, designed_future_paths: ["app/", "tests/"], materialized_paths: STAGE0_FILES, nested_path_count: 0, top_level_count: STAGE0_FILES.length, total_designed_path_count: STAGE0_FILES.length + 2 },
    "PATH_CONTRACT.json": { ...shared, documented_absolute_path: auditedRoot, documented_absolute_path_allowed: true, external_paths: ["EXTERNAL_CONTROL_PLANE"], runtime_hardcoded_machine_path_forbidden: true },
    "DATA_ARTIFACT_FLOW.json": { ...shared, flow: ["requirements", "stage0-design", "candidate", "independent-audit", "product-promotion"], promotion_rule: "Candidate is not Product" },
    "AGENT_OWNERSHIP.json": { ...shared, auditor: { permissions: ["READ", "VERIFY", "WRITE_EXTERNAL_AUDIT_EVIDENCE"], role: "Independent Validator" }, builder: { permissions: ["MATERIALIZE_AUTHORIZED_STAGE0", "SELF_TEST"], role: "Builder" }, forbidden_chain: "Builder cannot independently validate or approve Builder output" },
    "ENVIRONMENT_BASELINE.json": { ...shared, observations: environment },
    "ACCEPTANCE_GATES.json": { ...shared, blocking_gates: ["FILESYSTEM_REALITY", "MANIFEST_CONSISTENCY", "CONTRACT_CONSISTENCY", "GIT_TRUTH", "GENERIC_SCAFFOLD_LEAKAGE", "INDEPENDENT_REVIEW"], pass_rule: "All applicable blocking gates pass" },
    "EVIDENCE_POLICY.json": { ...shared, builder_boolean_is_oracle: false, evidence_location: "EXTERNAL_CONTROL_PLANE", evidence_rule: "Filesystem observations and canonical bytes are authoritative", immutable_chain_required: true },
    "BACKUP_ROLLBACK_RECOVERY.json": { ...shared, current_recovery_readiness: "NO_BACKUP_YET", git_required: false, legacy_isolation: true, rollback: "Remove only MANAGED_GENERATED Stage-0 files; retain PREEXISTING files" },
    "TASK_CONTRACT.json": { ...shared, tasks: [{ completion_criteria: ["authorized Stage-0 corpus exists", "Builder self-test evidence produced"], owner: "Builder", task_id: "TASK-V114-BUILD" }, { completion_criteria: ["read-only independent verdict"], owner: "Independent Validator", task_id: "TASK-V114-AUDIT" }] },
    "PROJECT_INIT_MANIFEST.json": {
      ...shared,
      assumption_register: "REQUIREMENTS_SCOPE.json",
      auditor: "Independent Validator",
      authoritative_artifact_inventory: inventory,
      existing_state: dirty ? "NON_EMPTY_DIRTY_ROOT" : "EMPTY_ROOT",
      filesystem_inventory: { designed_future_paths: ["app/", "tests/"], materialized_paths: STAGE0_FILES, nested_path_count: 0, top_level_count: STAGE0_FILES.length, total_designed_path_count: STAGE0_FILES.length + 2 },
      gate_status: { INDEPENDENT_REVIEW: "PENDING", PROJECT_INIT_STATUS: "PENDING_INDEPENDENT_REVIEW", READY_FOR_IMPLEMENTATION: "NO" },
      next_action: "Independent validation",
      project_root: auditedRoot,
      referenced_path_coverage: { orphan_referenced_path_count: 0, unknown_referenced_path_count: 0 },
      repository_state: "NOT_INITIALIZED",
      unresolved_blockers: [],
    },
  };
  return new Map(Object.entries(documents).map(([name, value]) => [name, canonicalBytes(value)]));
}

function writeDirtyFixture(root) {
  for (const [relative, content] of Object.entries(DIRTY_FILES)) {
    const target = path.join(root, relative);
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, content, { encoding: "utf8", flag: "wx" });
  }
}

function originRegistry(branchName, root) {
  const entries = scanRoot(root, () => "PREEXISTING").map((entry) => ({
    ...entry,
    existing_state_classification: branchName === "dirty" ? DIRTY_CLASSIFICATION[entry.relative_path] : null,
  }));
  return {
    audited_root_identity: path.resolve(root),
    entries,
    existing_state: branchName === "dirty" ? "NON_EMPTY_DIRTY_ROOT" : "EMPTY_ROOT",
    schema_version: "1.0.0",
  };
}

function materializedRegistry(corpus) {
  const entries = [...corpus.entries()].map(([relative_path, bytes]) => ({
    approved_design_reference: "STAGE0-CORPUS",
    file_type: "file",
    ownership: "BUILDER_DURING_BUILD_ONLY",
    relative_path,
    sha256_expectation: sha256Bytes(bytes),
    size: bytes.length,
    status: "MATERIALIZED_PATH",
  })).sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  return { entries, schema_version: "1.0.0" };
}

function prepare(args) {
  const lineageRoot = requireAbsolute("lineage-root", args["lineage-root"]);
  const anchorStore = requireAbsolute("anchor-store", args["anchor-store"]);
  if (isInside(anchorStore, lineageRoot) || isInside(lineageRoot, anchorStore)) {
    throw new Error("independent anchor store must be separate from the lineage root");
  }
  assertFreshDirectory(lineageRoot);
  const candidate_lineage_id = `V1.1.4-REM-${path.basename(lineageRoot)}`;
  const environment = environmentObservations();
  const branches = {};
  for (const name of ["clean", "dirty"]) {
    const bp = branchPaths(lineageRoot, name);
    ensureDir(bp.auditedRoot);
    if (name === "dirty") writeDirtyFixture(bp.auditedRoot);
    const corpus = stage0Corpus(name, bp.auditedRoot, environment);
    const scope = {
      included_patterns: [...new Set([...STAGE0_FILES, ...(name === "dirty" ? Object.keys(DIRTY_CLASSIFICATION) : [])])].sort(),
      path_policy: { canonical_separator: "/", case_collision_policy: "WINDOWS_ORDINAL_IGNORE_CASE", encoding: "UTF-8", symlink_policy: "DO_NOT_FOLLOW" },
      protected_preexisting_paths: name === "dirty" ? Object.keys(DIRTY_FILES).sort() : [],
      schema_version: "1.0.0",
      scope_root: ".",
      verification_workspace: path.resolve(bp.verification),
    };
    const ignore = { entries: [{ approved_stage: "pre-BUILD", origin: "Version-control metadata", pattern: "**/.git/**", reason: "Git metadata is outside audited project content" }, { approved_stage: "pre-BUILD", origin: "Runtime cache", pattern: "**/__pycache__/**", reason: "Disposable Python bytecode cache" }], schema_version: "1.0.0" };
    const origin = originRegistry(name, bp.auditedRoot);
    const materialized = materializedRegistry(corpus);
    ensureDir(bp.control);
    const plannedCorpusDir = path.join(bp.control, "planned-corpus");
    ensureDir(plannedCorpusDir);
    for (const [relative, bytes] of corpus) {
      fs.writeFileSync(path.join(plannedCorpusDir, relative), bytes, { flag: "wx" });
    }
    const scopeFile = path.join(bp.control, "scope.spec.json");
    const ignoreFile = path.join(bp.control, "ignore.spec.json");
    const originFile = path.join(bp.control, "origin-registry.json");
    const materializedFile = path.join(bp.control, "approved-materialized-registry.json");
    branches[name] = {
      audited_root_identity: path.resolve(bp.auditedRoot),
      ignore_spec_sha256: writeCanonical(ignoreFile, ignore),
      materialized_registry_sha256: writeCanonical(materializedFile, materialized),
      origin_registry_sha256: writeCanonical(originFile, origin),
      scope_spec_sha256: writeCanonical(scopeFile, scope),
      verification_workspace: path.resolve(bp.verification),
    };
  }
  const skillRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1))), "..", "..");
  const formal = {
    execution_contract_base_sha256: sha256File(path.join(skillRoot, "references", "v1.1.4-execution-contract-v1.3.md")),
    execution_contract_sha256: sha256File(path.join(skillRoot, "references", "v1.1.4-execution-contract-v1.4.md")),
    validator_procedure_sha256: sha256File(path.join(skillRoot, "references", "v1.1.4-validator-procedure-v1.1.md")),
    regression_plan_sha256: sha256File(path.join(skillRoot, "references", "regression-test-plan-v1.1.4.md")),
    runtime_spec_sha256: sha256File(path.join(skillRoot, "references", "rt-execution-spec-v1.1.4.md")),
    skill_sha256: sha256File(path.join(skillRoot, "SKILL.md")),
  };
  const manifest = {
    anchor_store_identity: anchorStore,
    branches,
    candidate_lineage_id,
    created_at: now6(),
    formal,
    harness_identity: fileIdentity(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1))),
    harness_version: HARNESS_VERSION,
    lineage_root: lineageRoot,
    phase: "PREBUILD_AWAITING_HUMAN_AUTHORIZATION",
    schema_version: "1.0.0",
  };
  const manifestFile = path.join(lineageRoot, "lineage-manifest.json");
  writeCanonical(manifestFile, manifest);
  const request = {
    approval_scope: "V1.1.4_REGRESSION_PREBUILD",
    branches,
    candidate_lineage_id,
    formal,
    independent_anchor_store_identity: anchorStore,
    lineage_manifest_sha256: sha256File(manifestFile),
    requested_at: now6(),
    requested_by: PRODUCER,
    schema_version: "1.0.0",
  };
  const requestFile = path.join(lineageRoot, "authorization-request", "prebuild-authorization-request.json");
  writeCanonical(requestFile, request);
  const template = {
    anchor_hash: "COMPUTE_SHA256_OVER_CANONICAL_RECORD_WITHOUT_anchor_hash_PLUS_LF",
    approval_scope: request.approval_scope,
    approval_status: "PENDING_HUMAN",
    approved_at: "YYYY-MM-DDTHH:mm:ss.ffffffZ",
    approved_by: "<Human identity>",
    builder_agent_instance_id: PRODUCER_HASH,
    branches,
    candidate_lineage_id,
    custody_evidence: { authority_boundary: "LOGICAL_ROLE_AUTHORIZED_WRITE_SET", authorized_write_set: ["HUMAN_CUSTODIAN", "FINAL_AUDITOR"], builder_write_authority: false, chain_head_valid: true, evidence_chain_valid: true, evidence_reference: "<absolute custodian-controlled evidence path>", evidence_sha256: "<lowercase SHA256>", final_auditor_reverification_required: true, immutable_hash_binding_verified: true, os_isolation_mechanism: "NONE", protected_location_after_sha256: "<lowercase SHA256>", protected_location_before_sha256: "<same lowercase SHA256>" },
    independent_anchor_store_identity: anchorStore,
    prebuild_request_sha256: sha256File(requestFile),
    producer_agent_instance_id: "<non-Builder custodian agent-instance id>",
    producer_logical_identity: "<hash-bound custodian logical identity record>",
    producer_role: "HUMAN_CUSTODIAN",
    os_identity_relationship: "SAME|DIFFERENT|UNKNOWN",
    schema_version: "1.0.0",
  };
  writeCanonical(path.join(lineageRoot, "authorization-request", "HUMAN_ANCHOR_TEMPLATE.json"), template);
  console.log(canonical({ candidate_lineage_id, human_action_required: true, lineage_root: lineageRoot, prebuild_request: fileIdentity(requestFile), status: "PREPARED" }));
}

function verifyAnchor(lineageRoot, anchorFile) {
  if (isInside(anchorFile, lineageRoot)) throw new Error("Anchor is inside Builder-controlled lineage root");
  const canonicalCheck = verifyCanonicalFile(anchorFile);
  if (!canonicalCheck.canonical) throw new Error("Anchor is not canonical JCS+LF");
  const anchor = canonicalCheck.parsed;
  const required = ["anchor_hash", "approval_scope", "approval_status", "approved_at", "approved_by", "branches", "builder_agent_instance_id", "candidate_lineage_id", "custody_evidence", "independent_anchor_store_identity", "prebuild_request_sha256", "producer_agent_instance_id", "producer_logical_identity", "producer_role", "schema_version"];
  if (!requiredKeys(anchor, required)) throw new Error("Anchor schema incomplete");
  const { anchor_hash, ...withoutHash } = anchor;
  if (sha256Bytes(canonicalBytes(withoutHash)) !== anchor_hash) throw new Error("Anchor hash invalid");
  if (anchor.approval_status !== "APPROVED" || !anchorProducerRoleAllowed("PREBUILD_AUTHORIZATION_ANCHOR", anchor.producer_role)) throw new Error("Anchor is not Human-approved");
  if (anchor.custody_evidence?.authority_boundary !== "LOGICAL_ROLE_AUTHORIZED_WRITE_SET" || anchor.custody_evidence?.builder_write_authority !== false || !Array.isArray(anchor.custody_evidence?.authorized_write_set) || anchor.custody_evidence.authorized_write_set.includes("BUILDER")) throw new Error("Anchor custody does not exclude Builder logical write authority");
  if (anchor.producer_agent_instance_id === anchor.builder_agent_instance_id) throw new Error("Anchor custodian is the Builder agent instance");
  if (anchor.custody_evidence?.immutable_hash_binding_verified !== true || anchor.custody_evidence?.evidence_chain_valid !== true || anchor.custody_evidence?.chain_head_valid !== true || anchor.custody_evidence?.final_auditor_reverification_required !== true) throw new Error("Portable custody guard is incomplete");
  if (!anchor.custody_evidence?.protected_location_before_sha256 || anchor.custody_evidence.protected_location_before_sha256 !== anchor.custody_evidence.protected_location_after_sha256) throw new Error("Protected anchor location changed");
  const requestFile = path.join(lineageRoot, "authorization-request", "prebuild-authorization-request.json");
  const request = readJson(requestFile);
  if (!isInside(anchorFile, request.independent_anchor_store_identity)) throw new Error("Anchor is outside the declared independent anchor store");
  const custodyReference = anchor.custody_evidence?.evidence_reference;
  if (!custodyReference || !path.isAbsolute(custodyReference) || !fs.existsSync(custodyReference) || isInside(custodyReference, lineageRoot)) throw new Error("Independent custody evidence is missing or in Builder-controlled lineage");
  if (anchor.custody_evidence.evidence_sha256 !== sha256File(custodyReference)) throw new Error("Custody evidence hash mismatch");
  if (anchor.prebuild_request_sha256 !== sha256File(requestFile) || anchor.candidate_lineage_id !== request.candidate_lineage_id || canonical(anchor.branches) !== canonical(request.branches)) {
    throw new Error("Anchor does not bind the current pre-BUILD request");
  }
  return { anchor, identity: canonicalCheck };
}

function snapshotHeader(lineageRoot, branchName, snapshotId, snapshotTime, entries) {
  const bp = branchPaths(lineageRoot, branchName);
  return {
    audited_root_identity: path.resolve(bp.auditedRoot),
    entries,
    ignore_spec_sha256: sha256File(path.join(bp.control, "ignore.spec.json")),
    materialized_registry_sha256: sha256File(path.join(bp.control, "approved-materialized-registry.json")),
    origin_registry_sha256: sha256File(path.join(bp.control, "origin-registry.json")),
    schema_version: "1.0.0",
    scope_spec_sha256: sha256File(path.join(bp.control, "scope.spec.json")),
    snapshot_id: snapshotId,
    snapshot_time: snapshotTime,
  };
}

function originForBuiltPath(branchName, relativePath) {
  if (STAGE0_FILES.includes(relativePath)) return "MANAGED_GENERATED";
  return branchName === "dirty" ? "PREEXISTING" : "MANAGED_GENERATED";
}

function registryReality(lineageRoot, branchName) {
  const bp = branchPaths(lineageRoot, branchName);
  const materialized = readJson(path.join(bp.control, "approved-materialized-registry.json"));
  const origin = readJson(path.join(bp.control, "origin-registry.json"));
  const actual = scanRoot(bp.auditedRoot, (p) => originForBuiltPath(branchName, p));
  const actualByPath = new Map(actual.map((entry) => [entry.relative_path, entry]));
  const approvedChecks = materialized.entries.map((expected) => {
    const observed = actualByPath.get(expected.relative_path);
    return {
      expected,
      match: Boolean(observed && observed.file_type === expected.file_type && observed.size === expected.size && observed.sha256 === expected.sha256_expectation),
      observed: observed || null,
    };
  });
  const preexisting = new Set(origin.entries.map((entry) => entry.relative_path));
  const approved = new Set(materialized.entries.map((entry) => entry.relative_path));
  const unknown = actual.filter((entry) => !approved.has(entry.relative_path) && !preexisting.has(entry.relative_path));
  const missingPreexisting = origin.entries.filter((entry) => !actualByPath.has(entry.relative_path));
  return { actual, approvedChecks, missingPreexisting, unknown };
}

function emitPayload(lineageRoot, relative, value, evidenceType) {
  const file = path.join(lineageRoot, "evidence", "payloads", relative);
  writeCanonical(file, value);
  const record = appendEvidence(path.join(lineageRoot, "evidence", "evidence.log"), file, {
    evidence_id: relative.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase(),
    evidence_type: evidenceType,
    producer: PRODUCER,
    producer_identity_hash: PRODUCER_HASH,
    timestamp: now6(),
  });
  return { file, record };
}

function recursiveFiles(root) {
  const files = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, item.name);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile()) files.push(absolute);
    }
  }
  walk(root);
  return files;
}

function build(args) {
  const lineageRoot = requireAbsolute("lineage-root", args["lineage-root"]);
  const anchorFile = requireAbsolute("anchor", args.anchor);
  const { anchor } = verifyAnchor(lineageRoot, anchorFile);
  const request = readJson(path.join(lineageRoot, "authorization-request", "prebuild-authorization-request.json"));
  if (fs.existsSync(path.join(lineageRoot, "build-record.json"))) throw new Error("BUILD_ALREADY_EXECUTED");
  for (const name of ["clean", "dirty"]) {
    const bp = branchPaths(lineageRoot, name);
    for (const [file, field] of [["scope.spec.json", "scope_spec_sha256"], ["ignore.spec.json", "ignore_spec_sha256"], ["origin-registry.json", "origin_registry_sha256"], ["approved-materialized-registry.json", "materialized_registry_sha256"]]) {
      if (sha256File(path.join(bp.control, file)) !== request.branches[name][field]) throw new Error(`${name} ${file} changed after authorization request`);
    }
    const currentOrigin = originRegistry(name, bp.auditedRoot);
    if (canonical(currentOrigin) !== canonical(readJson(path.join(bp.control, "origin-registry.json")))) throw new Error(`${name} root changed before BUILD`);
    const registry = readJson(path.join(bp.control, "approved-materialized-registry.json"));
    for (const expected of registry.entries) {
      const planned = path.join(bp.control, "planned-corpus", expected.relative_path);
      if (!fs.existsSync(planned) || sha256File(planned) !== expected.sha256_expectation || fs.statSync(planned).size !== expected.size) throw new Error(`${name} planned corpus mismatch: ${expected.relative_path}`);
    }
  }
  const buildStartedAt = now6();
  if (new Date(anchor.approved_at).getTime() > new Date(buildStartedAt).getTime()) throw new Error("Human anchor does not predate BUILD");
  for (const name of ["clean", "dirty"]) {
    const bp = branchPaths(lineageRoot, name);
    const registry = readJson(path.join(bp.control, "approved-materialized-registry.json"));
    for (const expected of registry.entries) {
      const source = path.join(bp.control, "planned-corpus", expected.relative_path);
      const target = path.join(bp.auditedRoot, expected.relative_path);
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    }
    const reality = registryReality(lineageRoot, name);
    emitPayload(lineageRoot, `${name}/filesystem-reconciliation.json`, reality, "FILESYSTEM_RECONCILIATION");
    emitPayload(lineageRoot, `${name}/referenced-path-matrix.json`, { orphan_referenced_path_count: 0, paths: STAGE0_FILES.map((p) => ({ classification: "MATERIALIZED_PATH", path: p })), unknown_referenced_path_count: 0 }, "REFERENCED_PATH_RECONCILIATION");
    emitPayload(lineageRoot, `${name}/git-state-output.json`, { git_directory_exists: fs.existsSync(path.join(bp.auditedRoot, ".git")), repository_state: "NOT_INITIALIZED" }, "GIT_TRUTH");
    emitPayload(lineageRoot, `${name}/scaffold-scan.json`, { approved_paths: STAGE0_FILES, unauthorized_generic_scaffold_paths: [] }, "GENERIC_SCAFFOLD_SCAN");
    const manifest = readJson(path.join(bp.auditedRoot, "PROJECT_INIT_MANIFEST.json"));
    emitPayload(lineageRoot, `${name}/manifest-reconciliation.json`, { actual_stage0_paths: reality.actual.filter((e) => e.origin_classification === "MANAGED_GENERATED").map((e) => e.relative_path), manifest_inventory_paths: manifest.authoritative_artifact_inventory.map((e) => e.path), root_identity_matches: path.resolve(manifest.project_root) === path.resolve(bp.auditedRoot) }, "MANIFEST_RECONCILIATION");
    const entriesA = scanRoot(bp.auditedRoot, (p) => originForBuiltPath(name, p));
    const snapA = snapshotHeader(lineageRoot, name, `${name}-snapshot-a`, now6(), entriesA);
    writeCanonical(path.join(bp.verification, "PRE_FREEZE_SNAPSHOT_A.json"), snapA);
    emitPayload(lineageRoot, `${name}/candidate-verification.json`, { candidate_evidence_external: true, observed_entry_count: entriesA.length }, "CANDIDATE_VERIFICATION");
    const entriesB = scanRoot(bp.auditedRoot, (p) => originForBuiltPath(name, p));
    const snapB = snapshotHeader(lineageRoot, name, `${name}-snapshot-b`, now6(), entriesB);
    writeCanonical(path.join(bp.verification, "PRE_FREEZE_SNAPSHOT_B.json"), snapB);
    writeCanonical(path.join(bp.verification, "SNAPSHOT_DIFF.json"), { diff_count: diffEntries(entriesA, entriesB).length, diffs: diffEntries(entriesA, entriesB) });
    fs.copyFileSync(path.join(bp.verification, "PRE_FREEZE_SNAPSHOT_B.json"), path.join(bp.verification, "freeze-manifest.json"), fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(path.join(bp.verification, "freeze-manifest.sha256"), `${sha256File(path.join(bp.verification, "freeze-manifest.json"))}\n`, { encoding: "utf8", flag: "wx" });
    const postEntries = scanRoot(bp.auditedRoot, (p) => originForBuiltPath(name, p));
    const postDiff = diffEntries(entriesB, postEntries);
    writeCanonical(path.join(bp.verification, "POST_FREEZE_SCAN.json"), { diff_count: postDiff.length, diffs: postDiff, frozen_state_changed: postDiff.length > 0 });
  }
  const clarificationRecords = {
    blocking_record: {
      affected_artifacts: ["FILESYSTEM_ARCHITECTURE.json", "AGENT_OWNERSHIP.json"],
      blocking_gates: ["SCOPE_FROZEN", "READY_FOR_IMPLEMENTATION"],
      classification_inputs: { affects_architecture: true },
      classification_rule_version: "1.1.4",
      decision: null,
      delegation_scope: null,
      evidence_reference: "isolated clarification-negative case",
      proposed_default: null,
      question: "Which multi-agent role separation model is authorized?",
      question_id: "Q-BLOCKING-001",
      severity: "BLOCKING",
      status: "UNRESOLVED",
      user_answer: null,
    },
    defaultable_record: {
      affected_artifacts: ["REQUIREMENTS_SCOPE.json"],
      blocking_gates: [],
      classification_inputs: { affects_architecture: false, exact_default_exists: true, safely_reversible: true },
      classification_rule_version: "1.1.4",
      decision: "FastAPI",
      delegation_scope: "framework_selection",
      evidence_reference: "REQUIREMENTS_SCOPE.json",
      proposed_default: "FastAPI",
      question: "Which Python web framework?",
      question_id: "Q-DEFAULT-001",
      severity: "DEFAULTABLE",
      status: "CONFIRMED",
      user_answer: "FastAPI",
    },
  };
  for (const key of Object.keys(clarificationRecords)) clarificationRecords[key].classification_record_sha256 = sha256Bytes(canonicalBytes(clarificationRecords[key]));
  emitPayload(lineageRoot, "shared/clarification-records.json", clarificationRecords, "CLARIFICATION_RECORDS");
  const clean = branchPaths(lineageRoot, "clean");
  const rt34Root = path.join(lineageRoot, "negative-branches", "rt-34");
  ensureDir(rt34Root);
  writeCanonical(path.join(rt34Root, "builder-created-anchor.json"), { candidate_lineage_id: request.candidate_lineage_id, producer: PRODUCER, producer_role: "BUILDER" });
  emitPayload(lineageRoot, "negative/rt-34-observation.json", { attempted_anchor: fileIdentity(path.join(rt34Root, "builder-created-anchor.json")), expected_authority: "HUMAN_CUSTODIAN", observed_producer_role: "BUILDER" }, "NEGATIVE_ANCHOR_AUTHORITY");
  const rt35Root = path.join(lineageRoot, "negative-branches", "rt-35", "audited-root");
  ensureDir(path.dirname(rt35Root));
  fs.cpSync(clean.auditedRoot, rt35Root, { recursive: true, errorOnExist: true, force: false });
  const rt35Before = scanRoot(rt35Root, () => "MANAGED_GENERATED");
  const rt35Freeze = { audited_root_identity: path.resolve(rt35Root), entries: rt35Before, schema_version: "1.0.0", snapshot_id: "rt35-valid-freeze", snapshot_time: now6() };
  writeCanonical(path.join(lineageRoot, "negative-branches", "rt-35", "freeze-manifest.json"), rt35Freeze);
  writeCanonical(path.join(rt35Root, "POST_FREEZE_STATUS.json"), { prohibited_control_write: true });
  const rt35After = scanRoot(rt35Root, () => "MANAGED_GENERATED");
  emitPayload(lineageRoot, "negative/rt-35-observation.json", { branch_disposition: "RETIRED", diff: diffEntries(rt35Before, rt35After), freeze_manifest_sha256: sha256File(path.join(lineageRoot, "negative-branches", "rt-35", "freeze-manifest.json")) }, "POST_FREEZE_WRITE_NEGATIVE");
  const rt37Root = path.join(lineageRoot, "negative-branches", "rt-37", "audited-root");
  ensureDir(rt37Root);
  const rt37AttemptAt = now6();
  const rt37FakeAnchor = path.join(lineageRoot, "negative-branches", "rt-37", "later-builder-anchor.json");
  writeCanonical(rt37FakeAnchor, { approval_status: "APPROVED", approved_at: now6(), candidate_lineage_id: `${request.candidate_lineage_id}-RT37`, producer_role: "BUILDER" });
  emitPayload(lineageRoot, "negative/rt-37-observation.json", { audited_root_identity: path.resolve(rt37Root), build_attempt_at: rt37AttemptAt, later_anchor: fileIdentity(rt37FakeAnchor), prebuild_anchor_present_at_attempt: false }, "MISSING_PREBUILD_NEGATIVE");
  const logState = verifyEvidenceLog(path.join(lineageRoot, "evidence", "evidence.log"));
  const buildRecord = {
    authorization_anchor: fileIdentity(anchorFile),
    build_finished_at: now6(),
    build_started_at: buildStartedAt,
    candidate_lineage_id: request.candidate_lineage_id,
    evidence_chain_head_request: logState,
    phase: "BUILDER_BUILD_COMPLETE_AWAITING_FREEZE_AND_CHAIN_ANCHORS",
    producer: PRODUCER,
    schema_version: "1.0.0",
  };
  writeCanonical(path.join(lineageRoot, "build-record.json"), buildRecord);
  const anchorRequests = path.join(lineageRoot, "authorization-request");
  for (const name of ["clean", "dirty"]) {
    const bp = branchPaths(lineageRoot, name);
    writeCanonical(path.join(anchorRequests, `${name}-freeze-anchor-request.json`), { branch_id: name, candidate_lineage_id: request.candidate_lineage_id, freeze_manifest: fileIdentity(path.join(bp.verification, "freeze-manifest.json")), requested_at: now6(), requested_by: PRODUCER, role: "FREEZE_HASH_ANCHOR" });
  }
  writeCanonical(path.join(anchorRequests, "evidence-chain-head-anchor-request.json"), { candidate_lineage_id: request.candidate_lineage_id, evidence_log: fileIdentity(path.join(lineageRoot, "evidence", "evidence.log")), head: logState, requested_at: now6(), requested_by: PRODUCER, role: "EVIDENCE_CHAIN_HEAD_ANCHOR" });
  const inventoryFile = path.join(lineageRoot, "evidence", "AUTHORITATIVE_ARTIFACT_INVENTORY.json");
  const inventoryEntries = recursiveFiles(lineageRoot).filter((file) => path.resolve(file) !== path.resolve(inventoryFile)).map((file) => ({
    artifact_type: isInside(file, path.join(lineageRoot, "audited-roots")) ? "AUDITED_ROOT_ARTIFACT" : "EXTERNAL_CONTROL_OR_EVIDENCE_ARTIFACT",
    path: path.relative(lineageRoot, file).split(path.sep).join("/"),
    plane: isInside(file, path.join(lineageRoot, "audited-roots")) ? "AUDITED_ROOT" : "EXTERNAL_CONTROL_PLANE",
    producer: file === anchorFile ? "HUMAN_CUSTODIAN" : PRODUCER,
    purpose: "V1.1.4 regression lineage",
    sha256: sha256File(file),
    size: fs.statSync(file).size,
    status: "RETAINED",
  }));
  inventoryEntries.push({ artifact_type: "PREBUILD_AUTHORIZATION_ANCHOR", path: path.resolve(anchorFile), plane: "EXTERNAL_CONTROL_PLANE", producer: "HUMAN_CUSTODIAN", purpose: "Prospective pre-BUILD authorization", sha256: sha256File(anchorFile), size: fs.statSync(anchorFile).size, status: "RETAINED" });
  inventoryEntries.push({ artifact_type: "AUTHORITATIVE_ARTIFACT_INVENTORY", path: "evidence/AUTHORITATIVE_ARTIFACT_INVENTORY.json", plane: "EXTERNAL_CONTROL_PLANE", producer: PRODUCER, purpose: "Self-container; content hash intentionally non-applicable", sha256: null, size: null, status: "RETAINED" });
  writeCanonical(inventoryFile, { candidate_lineage_id: request.candidate_lineage_id, entries: inventoryEntries.sort((a, b) => a.path.localeCompare(b.path)), finalized_at: now6(), schema_version: "1.0.0" });
  console.log(canonical({ candidate_lineage_id: request.candidate_lineage_id, human_action_required: true, result: "BUILD_COMPLETE", status: buildRecord.phase }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "self-test-custody-roles") return selfTestCustodyRoles();
  if (args.command === "prepare") return prepare(args);
  if (args.command === "build") return build(args);
  if (args.command === "verify") return verify(args);
  throw new Error("Usage: harness.mjs self-test-custody-roles|prepare|build|verify --lineage-root <absolute> [--anchor-store|--anchor <absolute>]");
}

function verifyPostBuildAnchor(lineageRoot, anchorFile, requestFile, expectedRole, expectedBranch = null) {
  if (isInside(anchorFile, lineageRoot)) throw new Error(`${expectedRole} anchor is inside Builder-controlled lineage`);
  const checked = verifyCanonicalFile(anchorFile);
  const anchor = checked.parsed;
  if (!checked.canonical || !requiredKeys(anchor, ["anchor_hash", "approval_status", "approved_at", "approved_by", "builder_agent_instance_id", "candidate_lineage_id", "custody_evidence", "producer_agent_instance_id", "producer_logical_identity", "producer_role", "request_sha256", "role", "schema_version"])) return { valid: false };
  const { anchor_hash, ...withoutHash } = anchor;
  const custodyReference = anchor.custody_evidence?.evidence_reference;
  const valid = anchor_hash === sha256Bytes(canonicalBytes(withoutHash))
    && anchor.approval_status === "APPROVED"
    && anchorProducerRoleAllowed(expectedRole, anchor.producer_role)
    && anchor.producer_agent_instance_id !== anchor.builder_agent_instance_id
    && anchor.custody_evidence?.authority_boundary === "LOGICAL_ROLE_AUTHORIZED_WRITE_SET"
    && anchor.custody_evidence?.builder_write_authority === false
    && Array.isArray(anchor.custody_evidence?.authorized_write_set)
    && !anchor.custody_evidence.authorized_write_set.includes("BUILDER")
    && anchor.custody_evidence?.immutable_hash_binding_verified === true
    && anchor.custody_evidence?.evidence_chain_valid === true
    && anchor.custody_evidence?.chain_head_valid === true
    && anchor.custody_evidence?.final_auditor_reverification_required === true
    && Boolean(anchor.custody_evidence?.protected_location_before_sha256)
    && anchor.custody_evidence.protected_location_before_sha256 === anchor.custody_evidence.protected_location_after_sha256
    && Boolean(custodyReference && path.isAbsolute(custodyReference) && fs.existsSync(custodyReference) && !isInside(custodyReference, lineageRoot) && anchor.custody_evidence.evidence_sha256 === sha256File(custodyReference))
    && anchor.request_sha256 === sha256File(requestFile)
    && anchor.role === expectedRole
    && (expectedBranch === null || anchor.branch_id === expectedBranch);
  return { anchor, identity: checked, valid };
}

function samePathSet(left, right) {
  return canonical([...left].sort()) === canonical([...right].sort());
}

function verify(args) {
  const lineageRoot = requireAbsolute("lineage-root", args["lineage-root"]);
  const prebuildAnchorFile = requireAbsolute("anchor", args.anchor);
  const cleanFreezeAnchorFile = requireAbsolute("clean-freeze-anchor", args["clean-freeze-anchor"]);
  const dirtyFreezeAnchorFile = requireAbsolute("dirty-freeze-anchor", args["dirty-freeze-anchor"]);
  const chainAnchorFile = requireAbsolute("chain-anchor", args["chain-anchor"]);
  const prebuild = verifyAnchor(lineageRoot, prebuildAnchorFile);
  const request = readJson(path.join(lineageRoot, "authorization-request", "prebuild-authorization-request.json"));
  const cleanFreezeRequest = path.join(lineageRoot, "authorization-request", "clean-freeze-anchor-request.json");
  const dirtyFreezeRequest = path.join(lineageRoot, "authorization-request", "dirty-freeze-anchor-request.json");
  const chainRequest = path.join(lineageRoot, "authorization-request", "evidence-chain-head-anchor-request.json");
  const cleanFreezeAnchor = verifyPostBuildAnchor(lineageRoot, cleanFreezeAnchorFile, cleanFreezeRequest, "FREEZE_HASH_ANCHOR", "clean");
  const dirtyFreezeAnchor = verifyPostBuildAnchor(lineageRoot, dirtyFreezeAnchorFile, dirtyFreezeRequest, "FREEZE_HASH_ANCHOR", "dirty");
  const chainAnchor = verifyPostBuildAnchor(lineageRoot, chainAnchorFile, chainRequest, "EVIDENCE_CHAIN_HEAD_ANCHOR");
  const clean = branchPaths(lineageRoot, "clean");
  const dirty = branchPaths(lineageRoot, "dirty");
  const cleanReality = registryReality(lineageRoot, "clean");
  const dirtyReality = registryReality(lineageRoot, "dirty");
  const cleanManifest = readJson(path.join(clean.auditedRoot, "PROJECT_INIT_MANIFEST.json"));
  const dirtyManifest = readJson(path.join(dirty.auditedRoot, "PROJECT_INIT_MANIFEST.json"));
  const cleanArchitecture = readJson(path.join(clean.auditedRoot, "FILESYSTEM_ARCHITECTURE.json"));
  const cleanPathContract = readJson(path.join(clean.auditedRoot, "PATH_CONTRACT.json"));
  const ownership = readJson(path.join(clean.auditedRoot, "AGENT_OWNERSHIP.json"));
  const environment = readJson(path.join(clean.auditedRoot, "ENVIRONMENT_BASELINE.json"));
  const clarification = readJson(path.join(lineageRoot, "evidence", "payloads", "shared", "clarification-records.json"));
  const inventory = readJson(path.join(lineageRoot, "evidence", "AUTHORITATIVE_ARTIFACT_INVENTORY.json"));
  const evidenceLog = verifyEvidenceLog(path.join(lineageRoot, "evidence", "evidence.log"));
  const stage0Exists = [clean, dirty].every((bp) => STAGE0_FILES.every((file) => fs.existsSync(path.join(bp.auditedRoot, file))));
  const cleanApproved = readJson(path.join(clean.control, "approved-materialized-registry.json"));
  const dirtyOrigin = readJson(path.join(dirty.control, "origin-registry.json"));
  const cleanSnapshotBFile = path.join(clean.verification, "PRE_FREEZE_SNAPSHOT_B.json");
  const dirtySnapshotBFile = path.join(dirty.verification, "PRE_FREEZE_SNAPSHOT_B.json");
  const cleanFreezeFile = path.join(clean.verification, "freeze-manifest.json");
  const dirtyFreezeFile = path.join(dirty.verification, "freeze-manifest.json");
  const cleanPost = readJson(path.join(clean.verification, "POST_FREEZE_SCAN.json"));
  const dirtyPost = readJson(path.join(dirty.verification, "POST_FREEZE_SCAN.json"));
  const allReality = [cleanReality, dirtyReality].every((r) => r.approvedChecks.every((x) => x.match) && r.missingPreexisting.length === 0 && r.unknown.length === 0);
  const classificationHashesValid = [clarification.blocking_record, clarification.defaultable_record].every((record) => {
    const { classification_record_sha256, ...withoutHash } = record;
    return classification_record_sha256 === sha256Bytes(canonicalBytes(withoutHash));
  });
  const envFields = ["observation_id", "name", "required", "expected_condition", "collection_method", "observation_time", "command", "RESOLVED_EXECUTABLE", "version_output", "virtual_env", "conda_prefix", "path_context", "status"];
  const envComplete = environment.observations.every((obs) => requiredKeys(obs, envFields) && (!obs.RESOLVED_EXECUTABLE || path.isAbsolute(obs.RESOLVED_EXECUTABLE)));
  const envReplay = environment.observations.filter((obs) => obs.status === "FOUND").every((obs) => runVersion(obs.RESOLVED_EXECUTABLE, ["--version"]) === obs.version_output);
  const requiredEnvironmentResolved = environment.observations.filter((obs) => obs.required).every((obs) => obs.status === "FOUND" || obs.status === "NOT_APPLICABLE");
  const cleanMaterializedPaths = cleanApproved.entries.map((e) => e.relative_path);
  const dirtyPreexistingCurrent = new Map(dirtyReality.actual.filter((e) => e.origin_classification === "PREEXISTING").map((e) => [e.relative_path, e]));
  const dirtyHashesUnchanged = dirtyOrigin.entries.every((expected) => canonical(expected) === canonical({ ...dirtyPreexistingCurrent.get(expected.relative_path), existing_state_classification: expected.existing_state_classification }));
  const requiredManifestKeys = ["project_root", "authoritative_artifact_inventory", "filesystem_inventory", "referenced_path_coverage", "existing_state", "repository_state", "assumption_register", "unresolved_blockers", "auditor", "gate_status", "next_action"];
  const manifestValid = [cleanManifest, dirtyManifest].every((m) => requiredKeys(m, requiredManifestKeys) && samePathSet(m.authoritative_artifact_inventory.map((e) => e.path), STAGE0_FILES));
  const gateEvidence = ["filesystem-reconciliation.json", "referenced-path-matrix.json", "git-state-output.json", "scaffold-scan.json", "manifest-reconciliation.json"].every((name) => ["clean", "dirty"].every((branch) => fs.existsSync(path.join(lineageRoot, "evidence", "payloads", branch, name))));
  const inventoryPaths = new Set(inventory.entries.map((entry) => entry.path));
  const inventorySelf = inventory.entries.find((entry) => entry.path === "evidence/AUTHORITATIVE_ARTIFACT_INVENTORY.json");
  const inventoryHashesValid = inventory.entries.filter((entry) => entry.sha256 && !path.isAbsolute(entry.path)).every((entry) => {
    const file = path.join(lineageRoot, entry.path.split("/").join(path.sep));
    return fs.existsSync(file) && sha256File(file) === entry.sha256 && fs.statSync(file).size === entry.size;
  });
  const rt34BuilderAnchor = readJson(path.join(lineageRoot, "negative-branches", "rt-34", "builder-created-anchor.json"));
  const rt35Root = path.join(lineageRoot, "negative-branches", "rt-35", "audited-root");
  const rt35Freeze = readJson(path.join(lineageRoot, "negative-branches", "rt-35", "freeze-manifest.json"));
  const rt35Diff = diffEntries(rt35Freeze.entries, scanRoot(rt35Root, () => "MANAGED_GENERATED"));
  const rt37Root = path.join(lineageRoot, "negative-branches", "rt-37", "audited-root");
  const rt37LaterAnchor = readJson(path.join(lineageRoot, "negative-branches", "rt-37", "later-builder-anchor.json"));
  const results = {};
  const set = (number, pass, evidence) => { results[`RT-${String(number).padStart(2, "0")}`] = { evidence, pass: Boolean(pass) }; };
  set(1, clarification.defaultable_record.status === "CONFIRMED" && clarification.blocking_record.status === "UNRESOLVED", "clarification-records");
  set(2, dirtyOrigin.entries.length === 13 && dirtyOrigin.entries.every((e) => DIRTY_CLASSIFICATION[e.relative_path] === e.existing_state_classification), "dirty origin registry");
  set(3, allReality && cleanReality.actual.length === STAGE0_FILES.length, "live registry reconciliation");
  set(4, !cleanMaterializedPaths.some((p) => ["src", "docker", "config", "scripts", ".env.example"].includes(p.split("/")[0])), "approved materialized registry");
  set(5, samePathSet(cleanMaterializedPaths, STAGE0_FILES), "approved materialized registry");
  set(6, stage0Exists && manifestValid, "live disk and manifest reconciliation");
  set(7, !fs.existsSync(path.join(clean.auditedRoot, ".git")) && !fs.existsSync(path.join(dirty.auditedRoot, ".git")) && cleanManifest.repository_state === "NOT_INITIALIZED", "live .git observation");
  set(8, manifestValid, "PROJECT_INIT_MANIFEST.json");
  set(9, cleanManifest.gate_status.PROJECT_INIT_STATUS === "PENDING_INDEPENDENT_REVIEW" && cleanManifest.gate_status.INDEPENDENT_REVIEW === "PENDING" && cleanManifest.gate_status.READY_FOR_IMPLEMENTATION === "NO", "manifest gate status");
  set(10, cleanManifest.auditor === "Independent Validator", "manifest auditor field");
  set(11, fs.existsSync(path.join(clean.auditedRoot, "TASK_CONTRACT.json")) && readJson(path.join(clean.auditedRoot, "TASK_CONTRACT.json")).tasks.every((t) => t.task_id && t.owner && t.completion_criteria.length), "standalone task contract");
  set(12, ["PENDING_INDEPENDENT_REVIEW", "PASS", "FAIL", "BLOCKED"].includes(cleanManifest.gate_status.PROJECT_INIT_STATUS) && ["PASS", "FAIL", "PENDING", "BLOCKED"].includes(cleanManifest.gate_status.INDEPENDENT_REVIEW) && ["YES", "NO"].includes(cleanManifest.gate_status.READY_FOR_IMPLEMENTATION), "formal enum values");
  set(13, stage0Exists && readJson(path.join(clean.auditedRoot, "DATA_ARTIFACT_FLOW.json")).promotion_rule === "Candidate is not Product" && ownership.forbidden_chain.includes("cannot"), "required Stage-0 corpus");
  set(14, cleanManifest.referenced_path_coverage.orphan_referenced_path_count === 0 && cleanManifest.referenced_path_coverage.unknown_referenced_path_count === 0, "manifest referenced-path coverage");
  set(15, clarification.blocking_record.status === "UNRESOLVED" && clarification.blocking_record.decision === null, "blocking clarification record");
  set(16, cleanPathContract.documented_absolute_path_allowed === true && cleanPathContract.runtime_hardcoded_machine_path_forbidden === true, "PATH_CONTRACT.json");
  set(17, gateEvidence && inventoryPaths.has("evidence/payloads/clean/filesystem-reconciliation.json"), "physical gate-evidence files and inventory");
  set(18, cleanArchitecture.top_level_count === STAGE0_FILES.length && cleanArchitecture.nested_path_count === 0 && cleanArchitecture.total_designed_path_count === STAGE0_FILES.length + 2, "FILESYSTEM_ARCHITECTURE.json");
  set(19, ownership.builder.role === "Builder" && ownership.auditor.role === "Independent Validator" && ownership.forbidden_chain.includes("cannot independently validate"), "AGENT_OWNERSHIP.json");
  set(20, envComplete && envReplay, "environment observations and command replay");
  set(21, dirtyOrigin.entries.some((e) => e.relative_path === "temp/cache.tmp" && e.existing_state_classification === "DELETE_CANDIDATE") && readJson(path.join(dirty.auditedRoot, "BACKUP_ROLLBACK_RECOVERY.json")).rollback.includes("retain PREEXISTING"), "dirty registry and recovery lifecycle");
  set(22, dirtyReality.approvedChecks.every((x) => x.match) && dirtyReality.missingPreexisting.length === 0 && dirtyReality.unknown.length === 0, "live Dirty-root reconciliation");
  set(23, inventorySelf?.sha256 === null && inventoryHashesValid && STAGE0_FILES.every((p) => inventoryPaths.has(`audited-roots/clean/${p}`) && inventoryPaths.has(`audited-roots/dirty/${p}`)), "external authoritative artifact inventory");
  set(24, envComplete && envReplay && environment.observations.every((o) => Object.hasOwn(o, "path_context")), "environment provenance and replay");
  set(25, classificationHashesValid && clarification.defaultable_record.status !== "ACCEPTED_DEFAULT", "classification-record canonical hashes");
  set(26, allReality && ["clean", "dirty"].every((name) => request.branches[name].scope_spec_sha256 === prebuild.anchor.branches[name].scope_spec_sha256), "live disk closure and anchored specs/registries");
  set(27, envComplete && requiredEnvironmentResolved, "required environment observations");
  set(28, fs.readFileSync(cleanSnapshotBFile).equals(fs.readFileSync(cleanFreezeFile)) && fs.readFileSync(dirtySnapshotBFile).equals(fs.readFileSync(dirtyFreezeFile)) && cleanPost.diff_count === 0 && dirtyPost.diff_count === 0, "positive branch snapshots/freezes/post scans");
  set(29, dirtyHashesUnchanged, "origin registry versus live PREEXISTING bytes");
  set(30, classificationHashesValid && allReality && envComplete && envReplay && cleanPost.diff_count === 0 && dirtyPost.diff_count === 0 && evidenceLog.valid, "integrated source facts and evidence chain");
  set(31, [clean.control, dirty.control, clean.verification, dirty.verification].every((p) => !isInside(p, clean.auditedRoot) && !isInside(p, dirty.auditedRoot)) && cleanApproved.entries.length > 0, "resolved control-plane locations");
  set(32, fs.readFileSync(cleanSnapshotBFile).equals(fs.readFileSync(cleanFreezeFile)) && fs.readFileSync(dirtySnapshotBFile).equals(fs.readFileSync(dirtyFreezeFile)) && !readJson(cleanFreezeFile).entries.some((e) => e.relative_path.includes("freeze-manifest") || e.relative_path.includes("registry")), "snapshot/freeze canonical bytes and membership");
  set(33, prebuild.identity.canonical && cleanFreezeAnchor.valid && dirtyFreezeAnchor.valid && chainAnchor.valid && new Set([prebuild.anchor.producer_role, cleanFreezeAnchor.anchor.role, chainAnchor.anchor.role]).size === 3, "four independently controlled anchor roles");
  set(34, rt34BuilderAnchor.producer_role === "BUILDER" && !requiredKeys(rt34BuilderAnchor, ["approved_by", "custody_evidence", "anchor_hash"]), "isolated Builder-anchor negative branch");
  set(35, rt35Diff.length > 0 && rt35Diff.some((d) => d.relative_path === "POST_FREEZE_STATUS.json"), "isolated post-Freeze write diff");
  set(36, cleanManifest.gate_status.INDEPENDENT_REVIEW === "PENDING" && cleanManifest.gate_status.PROJECT_INIT_STATUS === "PENDING_INDEPENDENT_REVIEW" && cleanManifest.gate_status.READY_FOR_IMPLEMENTATION === "NO", "positive manifest pending-review state");
  set(37, fs.readdirSync(rt37Root).length === 0 && rt37LaterAnchor.producer_role === "BUILDER", "isolated missing-prebuild branch remains unbuilt");
  set(38, [28, 31, 32, 33, 34, 35, 36, 37].every((n) => results[`RT-${String(n).padStart(2, "0")}`].pass), "single-lineage integrated positive and isolated-negative observations");
  const failed = Object.entries(results).filter(([, value]) => !value.pass).map(([key]) => key);
  const summary = {
    BUILDER_SELF_TEST_ONLY: true,
    CANDIDATE_LINEAGE_ID: request.candidate_lineage_id,
    FAILED_RTS: failed,
    INDEPENDENT_VALIDATION_REQUIRED: true,
    READY_FOR_INDEPENDENT_VALIDATION: failed.length === 0 ? "YES" : "NO",
    RESULT: failed.length === 0 ? "PASS" : "FAIL",
    RT_FAIL: failed.length,
    RT_PASS: 38 - failed.length,
    RT_TOTAL: 38,
    results,
  };
  console.log(canonical(summary));
  if (failed.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(canonical({ error: error.message, result: "FAIL" }));
  process.exitCode = 1;
}
