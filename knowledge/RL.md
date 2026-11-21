---
title: RL
date: 2026-11-19
tag: Learning
---

## Components
- State
- Policy
- Action
- Reward

Based on the current state, the policy selects an action.
Through repeated interactions, the agent collects experiences (states, actions, rewards, and next states) and uses them to evaluate and improve its policy, aiming to maximize cumulative reward.

观察状态 → 按策略行动 → 获得奖励和新状态 → 利用经验改进策略，争取更高的长期累计奖励。

FTFormer:
训练过程可以理解为：
1. RL Agent 观察网络和设备状态。
2. 按当前 policy(Transformer: 策略网络采用的模型结构，处理状态信息) 选择卸载方案。
3. 执行后获得奖励，反映方案的效果。
4. PPO (更新策略网络参数的训练算法) 利用这些经验更新 policy，提高有利动作的选择概率。