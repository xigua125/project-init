# Project Init

**Project Initialization Skill** — 在正式编码前完成需求澄清、项目初始化、证据留存、独立审核与开发授权。

当前版本：**V1.1.3**

## 它解决什么问题

AI 开发项目很容易出现“需求没问清楚就开始写”“自己做完又自己宣布通过”“文档和实际磁盘不一致”等问题。Project Init 把项目初始化变成一套可检查的流程：

**需求澄清 → Scope → Existing-State Preflight → Filesystem → Evidence → Independent Review → Final Verification → Authorization → Implementation**

## 核心能力

- **Clarification / 需求澄清**：把缺失决策区分为架构级阻塞项和可安全默认项。
- **Scope Freeze / 范围冻结**：重大需求没有确认前，不允许假装项目已经可以实施。
- **Filesystem Reality / 文件系统真实性**：设计、Manifest 与真实磁盘必须一致。
- **Evidence / 证据链**：关键 PASS 必须有可检查证据，不能只靠 Agent 自我声明。
- **Builder / Auditor 分离**：施工者不能同时担任最终独立验收者。
- **Pre-BUILD Freeze**：正式 BUILD 前冻结并核验 Scope、Registry、Snapshot 与 Evidence。
- **Authorization Gate**：只有阻塞 Gate 全部满足后才允许进入实现。

## 适用场景

适合新项目、重大子系统、多 Agent 项目，以及重要架构或存储结构调整。

不建议为单文件小修改、普通 Bug 修复或纯文档修改运行完整流程，除非这些修改会影响项目架构。

## 文件结构

```text
project-init/
├─ SKILL.md
└─ references/
   ├─ regression-test-plan-v1.1.0.md
   ├─ regression-test-plan-v1.1.1.md
   ├─ regression-test-plan-v1.1.2.md
   ├─ regression-test-plan-v1.1.3.md
   ├─ rt-execution-spec-v1.1.3.md
   ├─ v1.1.3-change-proposal-r2.md
   ├─ v1.1.3-execution-contract-v1.1.md
   └─ v1.1.3-execution-contract-v1.2.md
```

## 使用

将仓库放入支持 Skill 的 Agent/工具对应 skills 目录，并让 Agent 在项目初始化或架构准备阶段读取 `SKILL.md`。

具体安装目录和 Skill 自动发现方式取决于你使用的 Agent。请以对应工具的 Skill 机制为准。

## 当前状态

V1.1.3 已包含 Clarification 分类、Origin Classification、Scope/Ignore Spec、Origin/Materialized Registry、Freeze、Evidence Hash Chain、独立审核与 Final Verification 等机制。

仓库中的历史 regression test plan 和 execution contract 用于记录版本演进与验证规则。

## License

MIT License。你可以使用、复制、修改和分发本项目，但需保留版权与许可证声明。

## Author

wangdeli / Hermes Agent
