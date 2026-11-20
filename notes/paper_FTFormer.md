---
title: Notes for FTFormer
date: 2026-11-18
tag: Federated Split Learning
paper: https://ieeexplore.ieee.org/document/11044444
---

Dynamic Edge–Fog–Cloud state

→ Transformer policy observes all nodes

→ PPO selects split point + offloading target

→ reroute when failure / overload occurs

→ reduce round completion time


论文把优化目标定义为动态选择每个设备、每一轮的层卸载决策，以缩短受最慢设备影响的训练时间，并维持故障场景下的训练连续性。