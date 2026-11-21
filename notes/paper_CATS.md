---
title: Notes for CATS
date: 2026-11-19
tag: Multi-Cloud Workflow Scheduling
paper: https://doi.org/10.1109/CLOUD-SUMMIT64795.2025.00028
---

## Setting
LLM-driven IoT workflows executed as serverless functions
across multiple cloud platforms.

Tasks form a DAG, where edges represent dependencies.

## Questions
- Which ready task should run on which cloud platform?
- When should execution be deferred to benefit from cache reuse
  or better platform conditions?

## Method
Transformer-based policy network + PPO.

Ready tasks + dependencies + platform load
+ failure probabilities + cache-hit opportunities
→ Policy selects a task–platform pair or chooses to wait
→ Observe execution results and new state
→ PPO uses collected experiences to update the policy

## Goal
在满足任务依赖的前提下，综合减少工作流总完成时间、
计算成本和失败重试次数。

## Main Contributions
- 缓存感知调度：利用已缓存的函数结果，减少重复计算。
- 联合决定执行位置和时机：选择任务及云平台，或暂缓执行，
  权衡等待成本与潜在缓存收益。
- Transformer + PPO：结合任务依赖和多云平台状态，
  学习适应负载、故障和缓存机会的调度策略。

## Key Concepts
- DAG：有向无环图，表示任务及其先后依赖。
- Serverless Function：由云平台管理运行资源的函数任务。
- Cache：缓存可复用的函数执行结果，不是 LLM 的 KV cache。
- Deferral：暂缓执行，等待缓存结果或更好的执行条件。
- Makespan：所有工作流完成所需的总时间。

## Results
论文仿真报告，相比所比较的基线：
- Makespan 最多减少 30%。
- 计算成本减少 40%。
- 失败重试次数减少 50% 以上。

## Limitations
- 主要通过随机生成的 DAG 和事件驱动仿真验证。
- 缓存命中被简化为概率事件，命中后任务视为立即完成。
- 计算成本主要以累计执行时间衡量。
- 实际部署还需考虑缓存有效性、查询开销和跨云通信成本。

## Difference from Other Papers
- FTFormer：调度联邦分割训练中的层卸载，并处理故障。
- LLMEdger：优化 LLM 推理中的模型并行和设备分配。
- CATS：调度工作流中的函数任务，决定在哪里执行以及是否等待。