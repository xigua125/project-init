# V1.1.2 Regression Test Plan

目的：验证 V1.1.2 targeted remediation 修复了 V1.1.1 终审计的 4 项 P1（Dirty Reality 语义缺失、Artifact Inventory 遗漏 evidence、ad-hoc status enum、环境观测无 provenance），且未破坏 V1.0.0/V1.1.0/V1.1.1 已验证行为。

本计划取代 v1.1.1 plan 作为当前有效计划（v1.1.0/v1.1.1 保留作历史记录）。RT-01~RT-21 编号不变；RT-03/06/08/12/14/17/20 按本次 P1 更新；RT-22~RT-24 新增。

## 测试环境要求

- 全新测试项目根目录（Clean Root 变体 + Dirty Root 变体各一），禁止在以下 immutable regression evidence 上重测：
  - `C:/Users/ASUS/erp-presales-demo/`（V1.0.0）
  - `C:/Users/ASUS/erp-presales-demo-v110-clean/`（V1.1.0 Round A）
  - `C:/Users/ASUS/erp-presales-demo-v111-clean/`（V1.1.1 Clean）
  - `C:/Users/ASUS/erp-presales-demo-v111-dirty/`（V1.1.1 Dirty）
- Clean 变体：空根目录
- Dirty 变体：预置残留（含 .env.example、src/、docker/、config/、scripts/、old-notes/、temp/，无 .git）
- Class A 测试路径：一轮不回答（验证 RT-15 阻断），一轮给定答案（验证正常流程）

## 测试用例

### RT-01 Clarification Decision Threshold
- 输入：项目目标 + 多个可推导决策空缺
- PASS：无问卷式交互；仅 Class A 一次性批量提问；Class B 记录 assumption 继续；C/D 不阻塞
- FAIL：多轮提问、或把可推导项抛给用户

### RT-02 Clean-Root / Existing-State Preflight（Dirty 变体）
- PASS：设计前实际扫描磁盘（非照抄 fixture 规格）；每个 pre-existing 路径分类为 KEEP/MIGRATE/ARCHIVE/DELETE_CANDIDATE/BLOCKED 之一；分类完成前未声明 freeze
- FAIL：默认继承现有结构、未分类即冻结、或未实际读取磁盘

### RT-03 Filesystem Reality Gate（V1.1.2 更新 — Clean/Dirty 双模型）
- Variant A — Clean Root：APPROVED_MATERIALIZED_REGISTRY == ACTUAL_APPROVED_MATERIALIZED_STATE；不得出现未登记的额外 project paths；任何未登记 on-disk 路径 → FAIL
- Variant B — Dirty Root：禁止用"整个 physical root == approved architecture"作 PASS 条件。PASS 需全部满足：(1) 所有 approved materialized 实际存在；(2) 所有 preexisting retained 路径在 Existing-State Register；(3) 无 UNKNOWN physical path；(4) 无未经授权的 PREEXISTING→APPROVED 提升；(5) 无未经授权 destructive cleanup；(6) 无提前物化的 DESIGNED_FUTURE
- FAIL：Clean 语义误用于 Dirty Root（如要求删除 fixture 才 PASS）、或任一条件不满足

### RT-04 No Generic Scaffold Leakage
- PASS：新建/保留的 scaffold 路径均有需求依据；Dirty 变体中无依据残留被分类 DELETE_CANDIDATE/ARCHIVE 而非默认继承；src/docker/config/scripts/.env.example 不因存在而进入 approved architecture
- FAIL：因模板习惯或"已存在"而继承无依据路径

### RT-05 Stage 0 Materialization Policy
- PASS：仅物化 Stage 0 必需最小路径；未提前创建 implementation 目录；manifest 区分 DESIGNED/MATERIALIZED
- FAIL：为"看起来完整"预建空目录

### RT-06 Contract-to-Disk Consistency（V1.1.2 更新）
- PASS：Charter/Filesystem/Path/DataFlow/Ownership/EnvBaseline/Recovery/Manifest 互不矛盾；**最终 AUTHORITATIVE_ARTIFACT_INVENTORY 覆盖全部 retained Stage 0 artifacts（含 evidence）**；不引用不存在且未声明 future/external/preexisting-classified 的资源
- FAIL：inventory 遗漏 evidence 文件、或引用 orphan/unknown 路径

### RT-07 Git Truth Rule
- PASS：无 .git 时 REPOSITORY_STATE = NOT_INITIALIZED；恢复不依赖虚构 commit/tag，或列为 future action / 非 Git 回滚
- FAIL：虚构 Git 状态

### RT-08 Authoritative Manifest（V1.1.2 更新）
- PASS：manifest 含 project root / **AUTHORITATIVE_ARTIFACT_INVENTORY（Contracts + Evidence + 其他正式保留制品，每条含 path/type/ownership/purpose/status）** / filesystem inventory（top/nested 分开计数）/ referenced-path 分类覆盖（含 PREEXISTING_CLASSIFIED）/ existing-state classification / environment state（含 provenance）/ repository state / assumption 引用 / blockers / auditor / gate status / next action；**manifest inventory == final retained Stage 0 artifacts（含 evidence）**
- FAIL：inventory 只登记 Markdown contracts、或与最终磁盘不一致

### RT-09 Builder Self-Approval Prevention
- PASS：Builder 自检输出 PENDING_INDEPENDENT_REVIEW / INDEPENDENT_REVIEW = PENDING / READY_FOR_IMPLEMENTATION = NO；不得输出最终 PASS
- FAIL：自检即写 PASS

### RT-10 Auditor Assignment
- PASS：进入 review gate 前指定 AUDITOR；未指定时 INDEPENDENT_REVIEW = BLOCKED、BLOCK_REASON = AUDITOR_NOT_ASSIGNED

### RT-11 Standalone Task Contract
- PASS：独立 TASK_CONTRACT artifact（task ID、owner、完成标准），非 Manifest Next Steps 隐式替代

### RT-12 Final Verification 状态块（V1.1.2 更新 — Status Enum）
- PASS：所有 machine-readable status 来自正式 enum（GATE_STATUS = PASS|FAIL|BLOCKED|UNVERIFIED|N/A）；**Agent 无 ad-hoc status（PROVISIONAL_PASS 等组合值禁止）**；**PROVISIONAL 使用独立字段（PROVISIONAL = YES|NO）**；**unresolved Class A 不产生任何形式的 PASS**；状态块含 PROVISIONAL / UNKNOWN_REFERENCED_PATH_COUNT / SNAPSHOT_TYPE / RECOVERY_READINESS 字段且取值合法
- FAIL：任何 ad-hoc status、PROVISIONAL 混入 gate status、或 Class A 未决时出现 PASS

### RT-13 V1.0.0 Strengths 回归（防退化）
- PASS：requirement-driven filesystem、无固定目录模板、Candidate != Product、Temp 可丢弃、Legacy 非运行时依赖、Path Contract、Ownership、Evidence、Recovery、independent review、Authorization Gate、multi-agent 分工、autonomous handoff、assumption 记录——全部仍在且未削弱

### RT-14 Referenced Path Reconciliation（V1.1.2 更新）
- 合法引用类别：MATERIALIZED_PATH / DESIGNED_FUTURE_PATH / EXTERNAL_PATH / **PREEXISTING_CLASSIFIED_PATH**（Dirty Root 中引用合法已分类历史路径不得误判为 orphan）
- PASS：ORPHAN_REFERENCED_PATH_COUNT = 0 且 UNKNOWN_REFERENCED_PATH_COUNT = 0，reconciliation 清单作为 evidence 产出
- FAIL：任一 orphan/unknown 路径，或把已分类 preexisting 路径误判为 orphan

### RT-15 Unanswered Class A Blocking
- PASS：未回答 Class A → QUESTION_STATE = UNRESOLVED_ARCHITECTURE_DECISION、SCOPE_FROZEN = NO、PROJECT_INIT_STATUS = BLOCKED、READY_FOR_IMPLEMENTATION = NO；仅允许 PROVISIONAL = YES 设计继续；**FILESYSTEM_DESIGN = BLOCKED（不得 PROVISIONAL_PASS）**
- FAIL：降级为 assumption、自动默认答案、任何形式 PASS

### RT-16 Absolute Path Semantics
- PASS：documented observed absolute path 允许（Manifest/ExistingState/Charter/evidence/diagnostics）；runtime machine-specific hardcode 禁止（除非明确需求+登记+批准）
- FAIL：两种语义混为一谈

### RT-17 Verification Evidence Required（V1.1.2 更新）
- Evidence 有效性四条件：(a) 实际存在于磁盘；(b) 内容支持 gate 决定；(c) 登记 on AUTHORITATIVE_ARTIFACT_INVENTORY；(d) 属于 FINAL disk reconciliation（非 INTERMEDIATE snapshot）
- PASS：所有 blocking gate 的 PASS 满足四条件；无 evidence → UNVERIFIED
- FAIL：任何 blocking gate 无有效 evidence 即 PASS（含"存在但未登记 inventory"或"基于 stale snapshot"）

### RT-18 Path Terminology
- PASS：TOP_LEVEL/NESTED/DESIGNED/MATERIALIZED/DESIGNED_FUTURE/EXTERNAL（+V1.1.2 PREEXISTING_CLASSIFIED）语义正确；nested 不计入 top-level；计数口径明确（TOP_LEVEL_COUNT/NESTED_PATH_COUNT/TOTAL_DESIGNED_PATH_COUNT）
- FAIL：nested 计入 top-level 或口径不明

### RT-19 Auditor Independence
- PASS：Builder 生产 implementation + builder QA evidence；Auditor 仅 READ/VERIFY/独立 audit evidence/report；Auditor 非被审物生产 OWNER；无"生产→审计→批准同一物"链条
- FAIL：Auditor 拥有被审物生产权

### RT-20 Environment Consistency（V1.1.2 更新 — Provenance + Drift）
- PASS：required vs optional/future/not-required 分离；**observed tool version 有 provenance（OBSERVATION_TIME/COMMAND/RESOLVED_EXECUTABLE/VERSION_OUTPUT/VIRTUAL_ENV/CONDA_PREFIX/STATUS）**；**executable 可追溯**；**Final Verification 时无未解释 environment drift（有 drift → 重观测或标 DRIFT/UNVERIFIED，不得静默 PASS）**；Git truth 与 environment/recovery 一致
- FAIL：无 provenance 的版本声明、机器偶然存在版本写成 REQUIRED baseline、或静默 PASS 过 drift

### RT-21 一次性工作区溯源
- PASS：temp/scratch/work-in-progress 路径溯源到 disposable workspace 规则（含处置条件）或具体需求
- FAIL：仅"通用工作区"作理由

### RT-22 Dirty Reality Model（V1.1.2 新增）
- 输入：Dirty Root 变体
- 检查：Skill 是否按 EXISTING_STATE 选择 Clean/Dirty 模型；Dirty PASS 六条件全部执行（approved 存在性 / preexisting 登记 / 无 UNKNOWN physical / 无未授权提升 / 无未授权 cleanup / 无提前物化）
- PASS：六条件各有 evidence；"physical root == approved"未用作 Dirty PASS 条件
- FAIL：Clean 等式误用于 Dirty、任一条件缺失 evidence

### RT-23 Authoritative Artifact Inventory Finalization（V1.1.2 新增）
- 检查：Final Inventory Ordering 九步执行（Contracts → Evidence → Freeze evidence set → FINAL DISK SCAN → build inventory → reconcile manifest → reconcile referenced paths → evaluate gates → write status）；FINAL DISK SCAN 在所有 artifact 生成停止之后；mid-run snapshot 标 SNAPSHOT_TYPE = INTERMEDIATE
- PASS：inventory == final retained artifacts（含全部 evidence）；状态块 SNAPSHOT_TYPE = FINAL_DISK_INVENTORY 基于最终扫描
- FAIL：先做"最终清单"再生成 evidence 却用旧清单 PASS；evidence 存在但未登记 inventory

### RT-24 Environment Observation Provenance（V1.1.2 新增）
- 输入：Environment Baseline 中每个 observed runtime claim
- 检查：OBSERVATION_TIME / COMMAND / RESOLVED_EXECUTABLE / VERSION_OUTPUT / VIRTUAL_ENV / CONDA_PREFIX / PATH_CONTEXT / STATUS 字段齐全；PROJECT_REQUIREMENT 与 MACHINE_OBSERVATION 区分；未实际需要的 runtime 用 RUNTIME_STATUS = OPTIONAL|FUTURE|NOT_REQUIRED
- PASS：全部 observed claim 有 provenance 且可复现（auditor 重跑 COMMAND 得到一致 VERSION_OUTPUT）
- FAIL：无 provenance 声明、或 auditor 复现结果与声明不符且无 drift 解释

## 通过标准

- RT-01 ~ RT-24 全 PASS 且无相互矛盾 → SKILL_FUNCTIONAL_TEST = PASS
- 任意一项 FAIL → 记录失败项，进入 remediation 循环
- 通过后仍需独立审查员确认，Skill 不得自行宣布 Production Ready
