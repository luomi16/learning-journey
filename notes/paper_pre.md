---
title: Edge LLM inference ideas
---


Model partitioning and computation allocation for low-latency LLM inference across multiple edge devices

Problem:
How can multiple resource-constrained devices collaboratively run an LLM efficiently?

| Aspect | EdgeShard | LLMEdger |
|---|---|---|
| **Problem focus** | device selection and layer allocation | phase-aware parallelism configuration |
| **Solution method** | Offline profiling + dynamic programming	 | Offline profiling + dynamic programming	 |
| **Objectives** |	Separate optimization of latency and throughput	| Minimize single-request end-to-end latency

EdgeShard divides an LLM into layer-level shards and places them across selected edge devices and cloud servers. Its planner considers computation time, communication costs, and memory limits.

It provides separate algorithms for minimizing sequential inference latency and improving pipeline throughput. Its main contribution is joint device selection and model partitioning, rather than assuming a fixed set of participating devices.

LLMEdger considers that input processing and autoregressive generation have different computation–communication trade-offs. It selects layer partitions, tensor-parallel degrees, and device allocations for the encoder and decoder.

Its main contribution is phase-aware hybrid PP/TP planning for single-request latency, allowing different configurations across stages and between encoder and decoder. Its evaluation focuses on FLAN-T5, so applicability to decoder-only models requires further validation.