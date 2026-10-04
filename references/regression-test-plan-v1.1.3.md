# V1.1.3 Regression Test Plan

目的：验证 V1.1.3 targeted hardening 关闭了 Production Validation #01 的四项 P1（澄清证据/默认语义未链接、证据/路径闭合非确定性、required environment provenance 完整性不足、Final Verification/Freeze 非零侧效应且漂移未失败），同时保留 V1.1.2 RT-01..RT-24 的全部语义且不退化。

本计划以 v1.1.2 plan 为基线：RT-01~RT-24 不变（编号、输入、PASS/FAIL 语义全部保留）；RT-25~RT-30 新增覆盖 V1.1.3 四个 P1 类。V1.1.2 plan 保持不变作为 Historical Baseline。

## 测试环境要求

- 全新测试项目根目录（Clean Root 变体 + Dirty Root 变体各一），禁止在以下 immutable regression evidence 上重测：
  - `C:/Users/ASUS/erp-presales-demo/`（V1.0.0）
  - `C:/Users/ASUS/erp-presales-demo-v110-clean/`（V1.1.0 Round A）
  - `C:/Users/ASUS/erp-presales-demo-v111-clean/`（V1.1.1 Clean）
  - `C:/Users/ASUS/erp-presales-demo-v111-dirty/`（V1.1.1 Dirty）
  - `C:/Users/ASUS/erp-presales-demo-v112-clean/`（V1.1.2 Clean）
  - `C:/Users/ASUS/erp-presales-demo-v112-dirty/`（V1.1.2 Dirty）
- Clean 变体：空根目录
- Dirty 变体：预置残留（含 .env.example、src/、docker/、config/、scripts/、old-notes/、temp/，无 .git）
- Class A 测试路径：一轮不回答（验证 RT-15 阻断），一轮给定答案（验证正常流程）

## 测试用例（RT-01~RT-24 同 V1.1.2，此处不重复，见 v1.1.2 plan）

RT-01 至 RT-24 完整定义见 `regression-test-plan-v1.1.2.md`。V1.1.3 不修改、不重编、不替代其中任何一项。RT-25~RT-30 如下：

### RT-25 Clarification Evidence / Default Semantics
- 输入：一次 Stage 0 运行中产生至少一个 BLOCKING 和一个 DEFAULTABLE 澄清
- PASS：每条澄清记录 question_id / classification_rule_version / classification_inputs / severity / question / proposed_default / user_answer / delegation_scope / decision / status / affected_artifacts / blocking_gates / evidence_reference / classification_record_sha256；BLOCKING 仅通过 CONFIRMED 或合法 ACCEPTED_DEFAULT 解决；用户沉默不得成为 ACCEPTED_DEFAULT；分类算法严格按（1）影响判定（2）不可逆性（3）精确默认存在（4）歧义→BLOCKING 的优先级执行；classification_record_sha256 为 Section 9 规范序列化后 SHA256
- FAIL：分类无 rule version 或 inputs 记录、BLOCKING 通过沉默"接受"、classification_record 可事后修改、reclassification 不经过 Contract Change Procedure

### RT-26 Evidence / Path Closure
- 输入：包含 PREEXISTING_CLASSIFIED、DESIGNED_FUTURE、EXTERNAL、MATERIALIZED 四类路径的 Dirty Root 变体
- PASS：origin-registry 中每个 in-scope 对象分类为 PREEXISTING / MANAGED_GENERATED / EPHEMERAL_IGNORED；unclassified → UNEXPECTED_ARTIFACT → FAIL；missing_path_count = 0；unexpected_artifact_count = 0；orphan_referenced_path_count = 0；unknown_referenced_path_count = 0；scope/ignore spec 在 BUILD 前锚定且 immutability 通过 hash 校验
- FAIL：origin registry 遗漏 in-scope 对象、出现 UNKNOWN physical path、scope/ignore spec 在 BUILD 后被修改且未检测到

### RT-27 Required Environment Provenance Completeness
- 输入：Stage 0 Environment Baseline 中每个 observed runtime claim
- PASS：每个 required observation 有 FOUND / NOT_FOUND / NOT_APPLICABLE / UNVERIFIED 之一；每个 FOUND 记录 OBSERVATION_TIME / COMMAND / RESOLVED_EXECUTABLE / VERSION_OUTPUT / VIRTUAL_ENV / CONDA_PREFIX / PATH_CONTEXT / STATUS；required + UNVERIFIED → NOT_READY（不 PASS）；required expected-present + NOT_FOUND → FAIL；PROJECT_REQUIREMENT 与 MACHINE_OBSERVATION 严格区分；机器偶然存在的 runtime 标注 OPTIONAL|FUTURE|NOT_REQUIRED
- FAIL：版本声明无 provenance、required UNVERIFIED 仍 PASS、机器存在 runtime 写成 REQUIRED baseline

### RT-28 Freeze / Final Verification Drift
- 输入：完整 BUILD 流程（Builder STOP WRITING → Snapshot A → Snapshot B → Freeze 建立 → 验证 → 验证后重扫）
- PASS：Snapshot A/B 完全相等（prefreeze_double_snapshot_match=true）；Freeze Manifest = Snapshot B 的 Section 9 规范序列化；验证期间零 protected-project side effect；验证后 rescanning real root 不产生 FROZEN_STATE_CHANGED；post-freeze 任何 drift 触发 fail；evidence log append-only 且 hash-chained
- FAIL：A/B diff 非空仍建立 Freeze、验证写入 audited scope、post-freeze drift 被忽略、evidence chain 被篡改

### RT-29 Dirty Root + Protected PREEXISTING Drift
- 输入：Dirty Root 变体 + 受保护的 PREEXISTING 路径（如已分类 KEEP 的历史残留文件）
- PASS：PREEXISTING_CLASSIFIED_PATH 不因存在而提升为 APPROVED；KEEP 仅在有 current-requirement trace 时才进入 approved architecture；受保护 preexisting 路径在 BUILD 前后 byte 一致（sha256 不变）；任何 PREEXISTING 内容 drift → FAIL
- FAIL：PREEXISTING 路径被自动提升为 APPROVED、受保护 preexisting 路径被 Builder 修改、KEEP 无 requirement trace

### RT-30 Cross-Case Runtime Behavior（集成测试）
- 输入：一次完整执行同时覆盖澄清（Class A 不回答路径）+ 磁盘闭合（Dirty Root）+ environment provenance（Python/Node 观测）+ freeze（Snapshot A/B）+ 验证（side-effect free）+ 受保护 preexisting 不动
- PASS：所有上述子系统的规则在同一执行中协同工作不互相矛盾；Class A 未回答正确阻断整个流程（SCOPE_FROZEN=NO, PROJECT_INIT_STATUS=BLOCKED, READY_FOR_IMPLEMENTATION=NO）；freeze 后无 drift；evidence log 完整 hash chain 可审计；最终无 orphan/unknown referenced path；整体 SKILL_FUNCTIONAL_TEST 仅当 RT-01~RT-30 全 PASS
- FAIL：任意子系统规则冲突、Class A 阻断失效、freeze 失败、evidence chain 断裂、orphan path > 0

## 通过标准

- RT-01 ~ RT-30 全 PASS 且无相互矛盾 → SKILL_FUNCTIONAL_TEST = PASS
- 任意一项 FAIL → 记录失败项，进入 remediation 循环
- 通过后仍需独立审查员确认，Skill 不得自行宣布 Production Ready

## V1.1.3 RT 与 V1.1.2 RT 的映射

| V1.1.2 RT | V1.1.3 状态 |
|-----------|-------------|
| RT-01..RT-24 | 完全保留，编号/语义不变 |

| V1.1.3 新增 RT | 覆盖 P1 类 |
|---------------|------------|
| RT-25 Clarification evidence/default semantics | P1-1 |
| RT-26 Evidence/path closure | P1-2 |
| RT-27 Required environment provenance completeness | P1-3 |
| RT-28 Freeze/final verification drift | P1-4 |
| RT-29 Dirty Root + protected PREEXISTING drift | P1-4 |
| RT-30 Cross-case runtime behavior | P1-1..P4 集成 |
