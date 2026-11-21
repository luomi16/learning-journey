---
title: Forward Propagation / Backward Propagation
date: 2026-11-18
tag: Learning
---

**Forward propagation**: data is computed layer by layer from the input to the output.

**Backward propagation**: start from the prediction error and work backwards to calculate how much every parameter contributed to that error.

Training a neural network repeats this loop:

`Forward propagation → Loss → Backpropagation → Gradient descent`

## A forward-propagation example

```python
def relu(x):
    return max(0, x)


def neuron(inputs, weights, bias):
    """One neuron: weighted sum + bias + activation."""
    total = 0
    # zip() pairs items from multiple iterables by position.
    for x, w in zip(inputs, weights):
        total += x * w
    total += bias
    return relu(total)


def neural_network(inputs):
    # Hidden layer: two neurons see the same inputs with different parameters.
    h1 = neuron(inputs, weights=[0.5, 1.0], bias=1.0)
    h2 = neuron(inputs, weights=[1.0, -1.0], bias=0.0)

    print("Hidden neuron 1 output:", h1)
    print("Hidden neuron 2 output:", h2)

    # Output layer: combine the two hidden-layer outputs.
    output = h1 * 0.6 + h2 * 0.4 + 0.5
    return output


result = neural_network([2, 3])
print("Final network output:", result)
```

For the input `[2, 3]`, the first hidden neuron outputs `5.0`, the second outputs `0`, and the final prediction is `3.5`.

## From prediction to loss

Suppose the desired target is `4.0`. A simple squared-error loss is:

`loss = (prediction - target) ** 2`

If the prediction is `3.5`, then the loss is `(3.5 - 4.0)² = 0.25`. Training changes the parameters so that later predictions move closer to `4.0`.

## Backpropagation and gradient descent

`d_` is a common name for a derivative. For example, `d_prediction` means `∂loss / ∂prediction`: how the loss changes when the prediction changes.

For squared error:

`d_prediction = 2 * (prediction - target)`

The chain rule sends this signal backwards through the output layer, the ReLU activation, and then the hidden-layer weights and biases. ReLU’s gradient is `1` when its pre-activation value is positive; otherwise, this example uses `0`.

Gradient descent updates every parameter after **all** gradients have been calculated:

`parameter = parameter - learning_rate * gradient`

## Complete training example

This is the same two-neuron network, trained on one input-target pair for 100 steps. It uses only plain Python so that every calculation stays visible.

```python
def relu(x):
    return max(0, x)


# Input and target.
x = [2.0, 3.0]
target = 4.0

# Hidden-layer parameters.
w1 = [0.5, 1.0]
b1 = 1.0
w2 = [1.0, -1.0]
b2 = 0.0

# Output-layer parameters.
v = [0.6, 0.4]
b_out = 0.5
learning_rate = 0.01

for step in range(100):
    # 1. Forward propagation.
    z1 = x[0] * w1[0] + x[1] * w1[1] + b1
    z2 = x[0] * w2[0] + x[1] * w2[1] + b2
    h1 = relu(z1)
    h2 = relu(z2)
    prediction = h1 * v[0] + h2 * v[1] + b_out

    # 2. Compute loss.
    loss = (prediction - target) ** 2
    if step in [0, 1, 9, 99]:
        print(
            f"Step {step + 1}: "
            f"prediction={prediction:.6f}, loss={loss:.6f}"
        )

    # 3. Backpropagation.
    d_prediction = 2 * (prediction - target)

    # Gradients of the output-layer parameters.
    d_v = [d_prediction * h1, d_prediction * h2]
    d_b_out = d_prediction

    # Send the gradient back through ReLU to the hidden layer.
    relu_grad1 = 1 if z1 > 0 else 0
    relu_grad2 = 1 if z2 > 0 else 0
    d_z1 = d_prediction * v[0] * relu_grad1
    d_z2 = d_prediction * v[1] * relu_grad2

    # Gradients of hidden-layer weights and biases.
    d_w1 = [d_z1 * x[0], d_z1 * x[1]]
    d_w2 = [d_z2 * x[0], d_z2 * x[1]]
    d_b1 = d_z1
    d_b2 = d_z2

    # 4. Gradient descent: update after computing every gradient.
    for i in range(2):
        v[i] -= learning_rate * d_v[i]
        w1[i] -= learning_rate * d_w1[i]
        w2[i] -= learning_rate * d_w2[i]
    b_out -= learning_rate * d_b_out
    b1 -= learning_rate * d_b1
    b2 -= learning_rate * d_b2
```

## What to observe

- The loss should decrease across the printed steps.
- In this example, `z2` starts negative, so the second ReLU neuron outputs `0` and receives a zero gradient. This illustrates how an inactive ReLU can stop learning for that input.
- The code calculates gradients first and updates parameters afterwards. Updating a parameter too early would make later gradients inconsistent with the forward pass.