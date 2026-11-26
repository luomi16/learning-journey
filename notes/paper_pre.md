---
title: Edge LLM inference ideas
---


## Model partitioning and computation allocation for low-latency LLM inference across multiple edge devices

## Problem:
How can multiple resource-constrained devices collaboratively run an LLM efficiently?

## Comparison
| Aspect | LLMEdger | EdgeShard |
|---|---|---|
| **Objectives** |	 Minimize single-request end-to-end latency | Separate optimization of latency and throughput |
| **Problem focus** | phase-aware parallelism configuration | device selection and layer allocation with chosed LLM |
| **Solution method** | Offline profiling + dynamic programming <br> Four steps: <br> 1. Profile the hardware. Measure how fast layer blocks run and memory needed at different tensor parallelism levels. <br> 2. Plan the encoder. For each possible device set, find the fastest layer split and worker assignment that fits in memory. <br> 3. Plan the decoder. Repeat the same search for the decoder. <br> 4. Pick the best split. Give one set of devices to the encoder and the rest to the decoder. Choose the split with the lowest combined latency. | Offline profiling + dynamic programming <br>Three steps: <br> 1. Measure the model(each layer's execution time, memeory requirement, and output size) and devices(device memory and network bandwidth) <br> 2.Compare possible placements ??? <br> 3. Use DP to build the assignment.(computer cost)	 |

## Paper 1 LLMEdger: Phase-Aware Model Parallelism Scheduler for LLM Inference on Edge
LLMEdger considers that input processing and autoregressive generation have different computation–communication trade-offs. It selects layer partitions, tensor-parallel degrees, and device allocations for the encoder and decoder.

Its main contribution is phase-aware hybrid PP/TP planning for single-request latency, allowing different configurations across stages and between encoder and decoder. Its evaluation focuses on FLAN-T5, so applicability to decoder-only models requires further validation.

## Paper 2 EdgeShard: Efficient LLM Inference via Collaborative Edge Computing
EdgeShard divides an LLM into layer-level shards and places them across selected edge devices and cloud servers. Its planner considers computation time, communication costs, and memory limits.

It provides separate algorithms for minimizing sequential inference latency and improving pipeline throughput. Its main contribution is joint device selection and model partitioning, rather than assuming a fixed set of participating devices.

## Paper 3 Jupiter: Fast and Resource-Efficient Collaborative Inference of Generative LLMs on Edge Devices