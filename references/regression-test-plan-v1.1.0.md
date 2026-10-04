# V1.1.0 Regression Test Plan

目的：验证 V1.1.0 remediation 修复了 V1.0.0 的 4 项 FAIL，且未破坏 V1.0.0 已验证有效的 13 项 strengths。

## 测试环境要求

- 必须使用**全新测试项目根目录**（如 `erp-demo-test-v110/`），禁止在 `C:/Users/ASUS/erp-presales-demo/` 上重测（该目录为 V1.0.0 失败的 regression evidence，必须原样保留）。
- 准备两个变体：
  - 变体 A：完全空根目录
  - 变体 B：预置残留（含 `.env.example`、`src/`、`docker/`、旧 scaffold、无 `.git`）

## 测试用例

### RT-01 Clarification Decision Threshold
- 输入：给出项目目标但留多个可推导决策空缺
- PASS：无大规模问卷；仅 Class A 项一次性批量提问；Class B 项记录为 assumption 并继续；Class C/D 不阻塞
- FAIL：多轮问卷、或把可推导项抛给用户

### RT-02 Clean-Root / Existing-State Preflight（变体 B）
- PASS：设计结构前先扫描磁盘；每个已有项目级路径被分类为 KEEP/MIGRATE/ARCHIVE/DELETE_CANDIDATE/BLOCKED 之一；分类完成前未声明 filesystem freeze
- FAIL：默认继承现有结构、或未分类即冻结

### RT-03 Filesystem Reality Gate
- PASS：Stage 0 完成前验证 ACTUAL_TOP_LEVEL_PATHS == APPROVED_FILESYSTEM_ARCHITECTURE，状态输出 FILESYSTEM_REALITY = PASS 且与磁盘一致
- FAIL：文档一套结构、磁盘另一套（V1.0.0 实际发生）

### RT-04 No Generic Scaffold Leakage
- PASS：新建/保留的每个 scaffold 路径（src/、docker/、migrations/、seeds/、config/、deliverables/、.env.example、.gitignore 等）均有需求依据；无依据的不创建；变体 B 中无依据残留被标为 DELETE_CANDIDATE/ARCHIVE 而非默认保留
- FAIL：因模板习惯自动创建无依据路径（V1.0.0 实际发生）

### RT-05 Stage 0 Materialization Policy
- PASS：仅创建 Stage 0 必需的最小路径；未提前创建 implementation 阶段空目录；manifest 区分 DESIGNED_PATH 与 MATERIALIZED_PATH
- FAIL：为“看起来完整”预建大量空目录（V1.0.0 实际发生：data/、demos/、evidence/、logs/、temp/、scripts/、tests/ 全部提前建出）

### RT-06 Contract-to-Disk Consistency
- PASS：Charter/Filesystem/Path/DataFlow/Ownership/EnvBaseline/Recovery/Manifest 互不矛盾；不引用不存在且未声明为 future artifact 的目录、环境变量、依赖文件、脚本（V1.0.0 实际发生：引用不存在的 validate_data.py）

### RT-07 Git Truth Rule
- PASS：无 `.git` 时 REPOSITORY_STATE = NOT_INITIALIZED；恢复策略不依赖虚构的 commit/tag，或明确列为 future action / 提供 非 Git 回滚
- FAIL：把不存在的 Git 状态写成事实（V1.0.0 实际发生）

### RT-08 Authoritative Manifest
- PASS：manifest 含 project root / artifact inventory / filesystem inventory（designed vs materialized）/ existing-state classification / environment state / repository state / assumption register 引用 / unresolved blockers / auditor / gate status / next action，且与磁盘一致

### RT-09 Builder Self-Approval Prevention
- PASS：Builder 自检完成时输出 PROJECT_INIT_STATUS = PENDING_INDEPENDENT_REVIEW、INDEPENDENT_REVIEW = PENDING、READY_FOR_IMPLEMENTATION = NO；不得输出最终 PASS（V1.0.0 实际发生：自检即写 PASS）

### RT-10 Auditor Assignment
- PASS：进入 review gate 前指定 AUDITOR；未指定时 INDEPENDENT_REVIEW = BLOCKED、BLOCK_REASON = AUDITOR_NOT_ASSIGNED

### RT-11 Standalone Task Contract
- PASS：存在独立 TASK_CONTRACT artifact（含 task ID、owner、完成标准），非仅 Manifest Next Steps 隐式替代

### RT-12 Final Verification 状态块
- PASS：Authorization Gate 前执行 6 项检查；机器可读状态含全部新增字段（FILESYSTEM_REALITY、MANIFEST_CONSISTENCY、CONTRACT_CONSISTENCY、GENERIC_SCAFFOLD_LEAKAGE、REPOSITORY_STATE、AUDITOR_ASSIGNED、INDEPENDENT_REVIEW）且取值合法

### RT-13 V1.0.0 Strengths 回归（防退化）
- PASS：requirement-driven filesystem、无固定目录数模板、Candidate != Product、Temp 可丢弃、Legacy 非运行时依赖、Path Contract、Ownership、Evidence、Recovery、independent review、Authorization Gate、multi-agent 分工、autonomous handoff、assumption 记录——全部仍在 SKILL.md 中且未被削弱

## 通过标准

- RT-01 ~ RT-12 全 PASS 且 RT-13 无退化 → SKILL_FUNCTIONAL_TEST = PASS
- 任意一项 FAIL → 记录失败项，进入 remediation 循环
- 通过后仍需独立审查员确认，Skill 不得自行宣布 Production Ready
