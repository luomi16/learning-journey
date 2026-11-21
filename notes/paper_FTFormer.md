---
title: Notes for FTFormer
date: 2026-11-18
tag: Federated Split Learning
paper: https://ieeexplore.ieee.org/document/11044444
---

## Setting
Federated split learning in an Edge–Fog–Cloud environment.

## Questions
- How should model layers be split and offloaded?
- How can training continue when nodes fail or become overloaded?

## Method
Transformer-based policy network + online PPO.

Dynamic Edge–Fog–Cloud state
→ Transformer-based policy selects split point and offloading target
→ Environment returns reward and new state
→ PPO updates the policy

When failure or overload occurs
→ Reroute tasks or activate backups
→ Maintain training progress

## Goal
动态选择每个设备、每一轮的层卸载方案，缩短受最慢设备影响的训练时间，并维持故障场景下的训练连续性。

## Main Contributions
- 自适应层卸载：根据实时环境调整切分点和卸载目标。
- Transformer + 在线 PPO：建模多节点状态关系，并持续学习和更新卸载策略。
- 容错机制：通过任务重新路由和备份，减少故障或过载造成的训练中断。