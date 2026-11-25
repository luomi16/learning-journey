大模型需要多台边缘设备共同运行时，怎样分配模型和计算，让一次回答尽快完成？
点有三个：
1. 单台设备内存不够：模型必须拆开，放到多台设备上。
2. 并行有通信成本：设备越多，计算可能越快，但传输和同步也可能更慢。
3. 输入处理和输出生成特点不同：同一套 PP/TP 配置，不一定同时适合 encoder 和 decoder。
所以它根据输入长度、预计输出长度和设备内存，选择层怎么切、每个阶段用几台设备、encoder 和 decoder 怎么分配设备。

| 论文 | 给出的解决方案 | 与 LLMEdger 的主要区别 |
|---|---|---|
| **[Jupiter](https://arxiv.org/abs/2504.08242)**，INFOCOM 2025 | 对 prefill 和 decoding 分别设计流水线机制；解码阶段结合推测解码 | 同样关注阶段差异，但重点是**改进流水线执行和生成机制**；LLMEdger 重点选择 PP/TP 配置 |
| **[EdgeShard](https://arxiv.org/abs/2405.14371)**，预印本 2024 | 联合选择设备和模型切分，用动态规划优化延迟或吞吐 | 与 LLMEdger 的**设备分配、模型切分和 DP 求解**最容易形成对照 |
| **[TPI-LLM](https://arxiv.org/abs/2410.00531)**，预印本 2024 | 以 TP 为核心，结合滑动窗口权重管理、磁盘 I/O 重叠和通信优化 | 重点是**让大模型在低内存设备上运行，并降低 TP 开销** |
| **[When the Edge Meets Transformers](https://iqua.ece.toronto.edu/papers/chenghao-icdcs24.pdf)**，ICDCS 2024 | 将 Transformer 计算分布到多台边缘设备上加速推理 | 可以作为理解跨设备 Transformer 推理的基础工作 |