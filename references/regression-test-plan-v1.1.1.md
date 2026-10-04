# V1.1.1 Regression Test Plan

目的：验证 V1.1.1 targeted remediation 修复了 V1.1.0 Round A 的 CONTRACT_CONSISTENCY FAIL（orphan referenced paths、unanswered Class A downgrade、verification evidence overclaim）及相关 P2 缺陷，且未破坏 V1.0.0/V1.1.0 已验证有效的行为。

本计划取代 `regression-test-plan-v1.1.0.md`（保留作历史记录）。RT-01~RT-13 原样保留，RT-14~RT-19 新增。

## 测试环境要求

- 必须使用**全新测试项目根目录**（如 `erp-presales-demo-v111-clean/`），禁止在以下 regression evidence 目录上重测（必须原样保留）：
  - `C:/Users/ASUS/erp-presales-demo/` — V1.0.0 失败证据
  - `C:/Users/ASUS/erp-presales-demo-v110-clean/` — V1.1.0 Round A 失败证据
- 准备两个变体：
  - 变体 A：完全空根目录
  - 变体 B：预置残留（含 `.env.example`、`src/`、`docker/`、旧 scaffold、无 `.git`）
- Round A 变体必须包含一个"提出 Class A 问题但用户不回答"的测试路径（用于 RT-15）。

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
- FAIL：为"看起来完整"预建大量空目录（V1.0.0 实际发生：data/、demos/、evidence/、logs/、temp/、scripts/、tests/ 全部提前建出）

### RT-06 Contract-to-Disk Consistency
- PASS：Charter/Filesystem/Path/DataFlow/Ownership/EnvBaseline/Recovery/Manifest 互不矛盾；不引用不存在且未声明为 future artifact 的目录、环境变量、依赖文件、脚本（V1.0.0 实际发生：引用不存在的 validate_data.py）
- 注：RT-06 是总体一致性检查，路径引用的逐条核对由 RT-14 承担。

### RT-07 Git Truth Rule
- PASS：无 `.git` 时 REPOSITORY_STATE = NOT_INITIALIZED；恢复策略不依赖虚构的 commit/tag，或明确列为 future action / 提供 非 Git 回滚；所有 Contract 中 Git 状态描述一致（详见 RT-06/环境一致性）
- FAIL：把不存在的 Git 状态写成事实（V1.0.0 实际发生）

### RT-08 Authoritative Manifest
- PASS：manifest 含 project root / artifact inventory / filesystem inventory（designed vs materialized，top-level 与 nested 分开计数）/ referenced-path 分类覆盖 / existing-state classification / environment state / repository state / assumption register 引用 / unresolved blockers / auditor / gate status / next action，且与磁盘一致

### RT-09 Builder Self-Approval Prevention
- PASS：Builder 自检完成时输出 PROJECT_INIT_STATUS = PENDING_INDEPENDENT_REVIEW、INDEPENDENT_REVIEW = PENDING、READY_FOR_IMPLEMENTATION = NO；不得输出最终 PASS（V1.0.0 实际发生：自检即写 PASS）

### RT-10 Auditor Assignment
- PASS：进入 review gate 前指定 AUDITOR；未指定时 INDEPENDENT_REVIEW = BLOCKED、BLOCK_REASON = AUDITOR_NOT_ASSIGNED

### RT-11 Standalone Task Contract
- PASS：存在独立 TASK_CONTRACT artifact（含 task ID、owner、完成标准），非仅 Manifest Next Steps 隐式替代

### RT-12 Final Verification 状态块
- PASS：Authorization Gate 前执行 6 项检查；机器可读状态含全部字段（FILESYSTEM_REALITY、MANIFEST_CONSISTENCY、CONTRACT_CONSISTENCY、GENERIC_SCAFFOLD_LEAKAGE、REPOSITORY_STATE、ORPHAN_REFERENCED_PATH_COUNT、AUDITOR_ASSIGNED、INDEPENDENT_REVIEW）且取值合法（含 UNVERIFIED）

### RT-13 V1.0.0 Strengths 回归（防退化）
- PASS：requirement-driven filesystem、无固定目录数模板、Candidate != Product、Temp 可丢弃、Legacy 非运行时依赖、Path Contract、Ownership、Evidence、Recovery、independent review、Authorization Gate、multi-agent 分工、autonomous handoff、assumption 记录——全部仍在 SKILL.md 中且未被削弱

### RT-14 Referenced Path Reconciliation（V1.1.1 新增）
- 输入：Stage 0 全部 Contract 文档 + 实际磁盘
- 检查：枚举所有 Contract 中引用的项目路径，每条必须归类为 MATERIALIZED_PATH（存在且登记于 FILESYSTEM_ARCHITECTURE + MANIFEST）/ DESIGNED_FUTURE_PATH（未创建但明确登记为 future）/ EXTERNAL_PATH（项目根外且在 PATH_CONTRACT 声明）之一
- PASS：ORPHAN_REFERENCED_PATH_COUNT = 0，且 reconciliation 清单作为 evidence 产出
- FAIL：任一引用路径不存在、未登记为 future、也不是 external（V1.1.0 Round A 实际发生：EVIDENCE_POLICY 引用 stage-0/evidence/* 四个子目录均为 orphan）

### RT-15 Unanswered Class A Blocking（V1.1.1 新增）
- 输入：测试路径中用户对真正 Class A（architecture-critical）问题不回答
- PASS：输出 QUESTION_STATE = UNRESOLVED_ARCHITECTURE_DECISION、SCOPE_FROZEN = NO、PROJECT_INIT_STATUS = BLOCKED、BLOCK_REASON = UNRESOLVED_ARCHITECTURE_DECISION、READY_FOR_IMPLEMENTATION = NO；仅允许 PROVISIONAL = YES / NOT_AUTHORIZED_FOR_IMPLEMENTATION = YES 的临时设计继续
- FAIL：Class A 被自动降级为普通 assumption、自动选默认答案、宣布 Scope Frozen、宣布最终 FILESYSTEM_DESIGN = PASS、或进入 Authorization（V1.1.0 Round A 实际发生：A01/A02 降级为 assumption 后 SCOPE_FROZEN = YES）
- 边界验证：能安全推荐默认值的问题应从一开始分类为 Class B，而非先标 Class A 再降级

### RT-16 Absolute Path Semantics（V1.1.1 新增）
- PASS：Manifest / Existing State / Charter / audit evidence / diagnostics 中记录真实观察到的绝对路径（如 C:\Users\ASUS\project-name）不被判违规；代码/脚本/配置/运行时逻辑依赖机器特定绝对路径且无明确需求+Path Contract 登记+批准 → 违规
- FAIL：把"文档记录真实路径"与"运行时硬编码"混为一谈（V1.1.0 Round A 实际发生：Path Contract 禁止条款语义过宽）

### RT-17 Verification Evidence Required（V1.1.1 新增）
- 检查：每个 blocking verification gate 是否产出可检查的 evidence：
  - FILESYSTEM_REALITY → actual vs approved path inventory
  - MANIFEST_CONSISTENCY → manifest vs disk reconciliation
  - CONTRACT_CONSISTENCY → referenced-path + environment-variable + dependency/runtime reconciliation
  - GIT_TRUTH → observed repository state（命令输出）
  - GENERIC_SCAFFOLD_LEAKAGE → unexpected-path scan
- PASS：所有 blocking gate 的 PASS 均有对应 evidence；无 evidence 的 gate 状态为 UNVERIFIED 而非 PASS
- FAIL：任何 blocking gate 仅输出 PASS 而无 evidence（V1.1.0 Round A 实际发生：CONTRACT_CONSISTENCY = PASS 无 reconciliation evidence）

### RT-18 Path Terminology（V1.1.1 新增）
- PASS：TOP_LEVEL_PATH / NESTED_PATH / DESIGNED_PATH / MATERIALIZED_PATH / DESIGNED_FUTURE_PATH / EXTERNAL_PATH 语义使用正确；modules/* 等 nested 路径不被统计为 top-level；数量统计明确标注 TOP_LEVEL_COUNT / NESTED_PATH_COUNT / TOTAL_DESIGNED_PATH_COUNT
- FAIL：nested 路径被计入 top-level 统计，或计数未说明口径（V1.1.0 Round A 实际发生：15 个顶层目录的表述混入 nested）

### RT-19 Auditor Independence（V1.1.1 新增）
- PASS：Builder 生产 implementation artifact + builder QA evidence；Independent Auditor 仅 READ / VERIFY / 生产独立 audit evidence 与 audit report；Auditor 不是任何被审 artifact 的生产 OWNER；不存在"Auditor 生产 → Auditor 审计 → Auditor 批准同一 artifact"链条；audit evidence/report 本身可由 Auditor 创建
- FAIL：Auditor 拥有被审 QA/implementation artifact 的生产所有权（V1.1.0 Round A 隐患：OWNERSHIP_CONTRACT 将 qa/ 的 WRITERS 设为 Independent Auditor）

### RT-20 环境一致性（V1.1.1 新增，对应 PATCH-6）
- PASS：Environment Baseline 与 Filesystem Architecture 一致；可能需要的运行时标 RUNTIME_STATUS = OPTIONAL/FUTURE 并给出触发条件；Git 状态在所有 Contract 中一致
- FAIL：一个 Contract 声明"无脚本需求"而另一个声明"Python 用于数据处理脚本"，或 Git 状态描述互相矛盾（V1.1.0 Round A 实际发生）

### RT-21 一次性工作区溯源（V1.1.1 新增，对应 P2-2）
- PASS：temp/scratch/work-in-progress/candidate workspace 路径均可追溯到 skill 的 disposable workspace 规则（含具体处置条件）或具体项目需求
- FAIL：仅以"通用工作区"作为 justification（V1.1.0 Round A 实际发生：work-in-progress/ 标注为"通用工作区"）

## 通过标准

- RT-01 ~ RT-21 全 PASS 且无相互矛盾 → SKILL_FUNCTIONAL_TEST = PASS
- 任意一项 FAIL → 记录失败项，进入 remediation 循环
- 通过后仍需独立审查员确认，Skill 不得自行宣布 Production Ready
