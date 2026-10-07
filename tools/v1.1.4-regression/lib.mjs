import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const LF = "\n";

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function canonicalBytes(value) {
  return Buffer.from(canonical(value) + LF, "utf8");
}

export function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeCanonical(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, canonicalBytes(value), { flag: "wx" });
  return sha256File(file);
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text.endsWith(LF) ? text : text + LF, { encoding: "utf8", flag: "wx" });
  return sha256File(file);
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== "..");
}

export function scanRoot(root, originForPath = () => "MANAGED_GENERATED") {
  const entries = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, item.name);
      const relative_path = normalizeRelative(path.relative(root, absolute));
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        const symlink_target = fs.readlinkSync(absolute);
        entries.push({
          file_type: "symlink",
          mode: process.platform === "win32" ? "UNSUPPORTED" : String(stat.mode & 0o7777),
          origin_classification: originForPath(relative_path, "symlink"),
          relative_path,
          sha256: null,
          size: null,
          symlink_target,
          symlink_target_sha256: sha256Bytes(Buffer.from(symlink_target, "utf8")),
        });
      } else if (stat.isDirectory()) {
        entries.push({
          file_type: "directory",
          mode: process.platform === "win32" ? "UNSUPPORTED" : String(stat.mode & 0o7777),
          origin_classification: originForPath(relative_path, "directory"),
          relative_path,
          sha256: null,
          size: null,
          symlink_target: null,
        });
        walk(absolute);
      } else if (stat.isFile()) {
        entries.push({
          file_type: "file",
          mode: process.platform === "win32" ? "UNSUPPORTED" : String(stat.mode & 0o7777),
          origin_classification: originForPath(relative_path, "file"),
          relative_path,
          sha256: sha256File(absolute),
          size: stat.size,
          symlink_target: null,
        });
      }
    }
  }
  walk(root);
  return entries.sort((a, b) => a.relative_path.localeCompare(b.relative_path) || a.file_type.localeCompare(b.file_type));
}

export function diffEntries(before, after) {
  const left = new Map(before.map((entry) => [entry.relative_path, canonical(entry)]));
  const right = new Map(after.map((entry) => [entry.relative_path, canonical(entry)]));
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  return paths.filter((p) => left.get(p) !== right.get(p)).map((relative_path) => ({
    after: right.has(relative_path) ? JSON.parse(right.get(relative_path)) : null,
    before: left.has(relative_path) ? JSON.parse(left.get(relative_path)) : null,
    relative_path,
  }));
}

export function assertFreshDirectory(target) {
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length !== 0) {
      throw new Error(`Target must be absent or empty: ${target}`);
    }
  } else {
    fs.mkdirSync(target, { recursive: true });
  }
}

export function fileIdentity(file) {
  const stat = fs.statSync(file);
  return { path: path.resolve(file), sha256: sha256File(file), size: stat.size };
}

export function verifyCanonicalFile(file) {
  const raw = fs.readFileSync(file);
  const parsed = JSON.parse(raw.toString("utf8"));
  const expected = canonicalBytes(parsed);
  return {
    canonical: raw.equals(expected),
    parsed,
    sha256: sha256Bytes(raw),
    size: raw.length,
  };
}

export function appendEvidence(logFile, payloadFile, meta) {
  ensureDir(path.dirname(logFile));
  const records = fs.existsSync(logFile)
    ? fs.readFileSync(logFile, "utf8").trimEnd().split("\n").filter(Boolean).map(JSON.parse)
    : [];
  const previous = records.length ? records.at(-1).record_hash : "0".repeat(64);
  const recordWithoutHash = {
    evidence_id: meta.evidence_id,
    evidence_type: meta.evidence_type,
    payload_hash: sha256File(payloadFile),
    previous_evidence_hash: previous,
    producer: meta.producer,
    producer_identity_hash: meta.producer_identity_hash,
    schema_version: "1.0.0",
    sequence_number: records.length + 1,
    timestamp: meta.timestamp,
  };
  const record = { ...recordWithoutHash, record_hash: sha256Bytes(canonicalBytes(recordWithoutHash)) };
  fs.appendFileSync(logFile, canonical(record) + LF, "utf8");
  return record;
}

export function verifyEvidenceLog(logFile) {
  if (!fs.existsSync(logFile)) return { valid: false, reason: "MISSING" };
  const raw = fs.readFileSync(logFile, "utf8");
  if (!raw.endsWith(LF)) return { valid: false, reason: "NO_TERMINAL_LF" };
  const lines = raw.trimEnd().split("\n");
  let previous = "0".repeat(64);
  for (let i = 0; i < lines.length; i += 1) {
    const record = JSON.parse(lines[i]);
    const { record_hash, ...withoutHash } = record;
    if (canonical(record) !== lines[i]) return { valid: false, reason: `NON_CANONICAL_${i + 1}` };
    if (record.sequence_number !== i + 1 || record.previous_evidence_hash !== previous) {
      return { valid: false, reason: `CHAIN_${i + 1}` };
    }
    if (sha256Bytes(canonicalBytes(withoutHash)) !== record_hash) return { valid: false, reason: `HASH_${i + 1}` };
    previous = record_hash;
  }
  return { byte_length: raw.length, last_record_hash: previous, last_sequence_number: lines.length, valid: true };
}

export function requiredKeys(object, keys) {
  return keys.every((key) => Object.hasOwn(object, key));
}
