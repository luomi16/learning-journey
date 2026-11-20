---
title: Federated Learning / Split Learning
date: 2026-11-18
tag: Learning
---

**Federated Learning (FL)** and **Split Learning (SL)** both train models without pooling raw data centrally.

| | Federated Learning | Split Learning |
|---|---|---|
| Model location | Each client keeps a full model | Client and server each hold part of one model |
| Client sends | Model updates / gradients | Intermediate activations (“smashed data”) and gradients |
| Server role | Aggregates client models, e.g. FedAvg | Continues forward pass and backward pass |
| Client compute | Higher | Lower, since it runs only early layers |
| Communication | Periodic, usually per training round | Frequent, often per batch |
| Good for | Devices that can train a full local model | Resource-limited edge devices |

FL workflow:

```text
Server sends global model
→ each client trains locally on private data
→ clients send model updates
→ server aggregates updates
→ repeat
```

SL workflow:

```text
Client data
→ client-side layers
→ smashed data
→ server-side layers
→ prediction + loss
→ gradient returns to client
```

The core difference: FL distributes **complete local training**, while SL distributes **different layers of one model**.

A hybrid, **Split Federated Learning (SplitFed / SFL)**, combines both: each client trains a split model with the server, while client-side (and sometimes server-side) parameters are aggregated across clients.