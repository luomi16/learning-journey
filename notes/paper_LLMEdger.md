---
title: Notes for LLMEdger
date: 2026-11-19
tag: Edge LLM Inference
paper: https://ieeexplore.ieee.org/document/11619227
---

## Setting
LLM inference on memory-constrained CPU-based edge clusters,
using encoder–decoder models such as FLAN-T5.

## Questions
- How should model layers and computations be distributed across devices?
- How should parallelism configurations differ between prefill and decoding?

## Method
Offline profiling(性能剖析) + dynamic programming (DP).

Input length + expected output length + device memory
→ Estimate computation, communication, and memory costs
→ DP selects layer partitions, TP degrees, and device assignments
→ Allocate disjoint device sets to encoder and decoder
→ Execute inference using the selected plan

LLMEdger 怎样结合它们？

例如用 4 台设备执行 12 层模型：
```
阶段 1：第 1–6 层          阶段 2：第 7–12 层
┌─────────────────┐       ┌─────────────────┐
│ A、B 做张量并行   │ ───→  │ C、D 做张量并行   │
└─────────────────┘       └─────────────────┘
          TP                       TP
             两个阶段之间使用 PP
```
这是 PP=2、每阶段 TP=2 的混合并行示例。

## Goal
在设备内存约束下，为输入处理和输出生成选择合适的模型并行方案，
尽量缩短单个请求的端到端推理时间。

## Main Contributions
- 阶段感知调度：根据 prefill 和 decoding 的不同计算、通信特点，
  分别选择并行配置，并适应不同输入和输出长度。
- 联合优化：使用动态规划决定流水线切分位置、各阶段的张量并行度，
  以及 encoder 和 decoder 的设备分配。
- 实验验证：在 CPU 边缘集群上运行 FLAN-T5-XXL，
  相比非阶段感知的混合并行方案，延迟最多降低 14.95%。

## Key Concepts
- Pipeline Parallelism (PP)：按连续层划分模型，不同设备负责不同层块。
- Tensor Parallelism (TP)：把同一层的计算拆给多台设备共同完成。
- Hybrid Parallelism (PP×TP)：按层划分阶段，并在阶段内部使用 TP。
- 离线性能测量（Profiling）	
- 动态规划（DP）dynamic programming

## Limitations
- 依赖离线性能测量和预计输出长度。
- 动态规划复杂度随设备数量呈指数增长。
- 主要在 T5 模型和模拟边缘环境中验证。
- 设备更多不一定更快，通信开销可能抵消计算收益。

# Tech
PP - pipeline-parallel
TP - tensor-parallel