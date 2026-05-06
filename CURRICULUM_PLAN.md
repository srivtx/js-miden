# Learn-by-Building Curriculum: Python + NumPy from Scratch

**Student's current state (end of Phase 4):** A working 2-layer neural network (input → hidden → output) with manual forward pass, backpropagation, and vanilla gradient descent, built in pure Python/NumPy.

**Rules for all subsequent phases:**
- Pure Python + NumPy. No PyTorch, TensorFlow, JAX, or CuPy.
- Datasets are synthetic and tiny.
- Every phase must run end-to-end in **< 30 seconds** on a modern laptop CPU.
- Code is single-file scripts (or small modules) that the student writes line-by-line.

---

## Phase 5: Multi-Class Classification (Softmax & Cross-Entropy)
**Goal:** Generalize the binary classifier to arbitrary classes.

| | Details |
|---|---|
| **What they BUILD** | Extend Phase 4 to support a `Softmax` output layer and categorical cross-entropy loss. Refactor into a small `Dense` layer class so they stop hardcoding matrix shapes. Add support for multi-class output (one-hot targets). |
| **Dataset** | **Synthetic 3-Class Spirals** (N=300, 2D). Generate 3 interleaving spirals in NumPy. Small, visual, impossible to solve without a non-linear model. |
| **Success** | Decision boundary plot shows clean separation of all 3 spirals. Validation accuracy > 95%. Loss curve converges smoothly. |
| **LOC** | ~120 lines (refactoring + softmax + training loop). |
| **Visualizations** | 1. **Decision boundary** (contour plot over 2D plane, colored by predicted class). 2. **Loss curve** (train vs. validation). |

**Key concept:** Numerical stability of softmax (subtract max before exponentiation). One-hot encoding.

---

## Phase 6: Deep Networks (Arbitrary Depth, ReLU, Initialization)
**Goal:** Learn to train networks deeper than 2 layers without vanishing gradients.

| | Details |
|---|---|
| **What they BUILD** | A modular network where layers can be stacked arbitrarily (e.g., 4 hidden layers). Implement **ReLU** and **Tanh**. Add **Xavier/He initialization**. Add a small `MLP` class with `.forward()`, `.backward()`, `.update()`. |
| **Dataset** | **Noisy Concentric Circles** (N=400, 2D). Two rings with Gaussian noise. Requires depth to carve out an annular decision boundary. |
| **Success** | A 4-layer network trains stably and achieves > 92% accuracy. A poorly initialized version (e.g., all zeros or large random values) fails, demonstrating the importance of init. |
| **LOC** | ~180 lines (modular layer classes + init logic). |
| **Visualizations** | 1. **Decision boundary** for 2-layer vs 4-layer side-by-side. 2. **Gradient norm per layer** (bar chart) to show vanishing gradients without proper init. |

**Key concept:** Non-saturating activations, weight initialization scaling, dead ReLUs.

---

## Phase 7: Regularization (Dropout & L2)
**Goal:** Understand overfitting and how to fight it.

| | Details |
|---|---|
| **What they BUILD** | Add **inverted Dropout** (train-time mask, test-time scaling) and **L2 weight penalty** to the modular network from Phase 6. |
| **Dataset** | **Small Noisy Moons** (N=80 train, N=200 test). Use only 80 training points so the model overfits heavily. High noise. |
| **Success** | Run 3 experiments on the same model: (1) no regularization (massive train/test gap), (2) L2 only (smoother boundary), (3) Dropout + L2 (best generalization). Plot proves the point. |
| **LOC** | ~80 lines (additive to Phase 6). |
| **Visualizations** | 1. **Train vs. Validation Loss curves** (3 lines on one plot). 2. **Decision boundaries** (3 subplots) showing smoothness. |

**Key concept:** Ensemble interpretation of dropout, scaling at test time, weight decay.

---

## Phase 8: Convolutional Neural Network (CNN) from Scratch
**Goal:** Understand spatial structure and parameter sharing.

| | Details |
|---|---|
| **What they BUILD** | `Conv2D` (naive nested-loop implementation), `MaxPool2D`, `Flatten`, `Dense`, `Softmax`. Full backprop through the conv layer (gradient w.r.t. filters, input, bias). Use valid padding only to keep code small. |
| **Dataset** | **Synthetic 8×8 Images: X vs O** (N=400). Generate tiny grayscale images: class 0 = diagonal lines forming an X, class 1 = anti-diagonal lines forming an O/cross. 2 classes. Add slight noise. |
| **Success** | > 98% accuracy. The learned filters visibly resemble edge detectors (diagonal gradients). |
| **LOC** | ~350 lines (forward + backward for conv is verbose). |
| **Visualizations** | 1. **Sample input images** (grid). 2. **Learned conv filters** (heatmap). 3. **Feature maps** (input vs. output after conv + ReLU) for a test image. |

**Key concept:** Local receptive fields, parameter sharing, im2col intuition (even if writing loops).

---

## Phase 9: Recurrent Neural Networks (RNN) & BPTT
**Goal:** Handle sequences and backprop through time.

| | Details |
|---|---|
| **What they BUILD** | A vanilla RNN cell from scratch: `h_t = tanh(W_hh @ h_{t-1} + W_xh @ x_t + b)`. Implement forward by unrolling the sequence manually in a loop. Implement **BPTT** manually (truncated to full sequence length). Many-to-one (read entire sequence, output single prediction at end). |
| **Dataset** | **Binary Parity** (sequence length = 20). Generate 1000 sequences of random bits. Label = parity (XOR) of all bits (0 or 1). |
| **Success** | Achieves > 90% accuracy on parity. A non-recurrent baseline (flattening the sequence) fails (~50%), proving recurrence is necessary. |
| **LOC** | ~200 lines. |
| **Visualizations** | 1. **Hidden state trajectory** (plot `h` over time for a single test sequence; color by timestep). 2. **Loss curve**. |

**Key concept:** Unrolling, shared parameters across time, hidden state as memory.

---

## Phase 10: Long Short-Term Memory (LSTM)
**Goal:** Solve the vanishing gradient problem in time.

| | Details |
|---|---|
| **What they BUILD** | Full LSTM cell with input/forget/output gates and candidate cell state. BPTT through the gates. Compare directly against the Phase 9 vanilla RNN on the same codebase. |
| **Dataset** | **Long-Range Copy Task** (sequence length = 50). First bit is the target class (0 or 1). The next 48 bits are random noise. The last bit is a dummy separator. Model must remember the first bit across 50 steps. 2000 sequences. |
| **Success** | Vanilla RNN plateaus at ~55% (random). LSTM converges to > 95%. |
| **LOC** | ~300 lines (additive/refactoring of Phase 9). |
| **Visualizations** | 1. **Loss curves** (RNN vs LSTM on same plot). 2. **Forget gate activations** over time (heatmap for a batch) showing it preserves the first bit. |

**Key concept:** Gating, cell state vs hidden state, additive gradients.

---

## Phase 11: Word Embeddings (Skip-Gram with Negative Sampling)
**Goal:** Learn distributed representations of discrete tokens.

| | Details |
|---|---|
| **What they BUILD** | Skip-gram model with **negative sampling**. Two embedding matrices (`W_in`, `W_out`). Sigmoid + binary cross-entropy. No neural network hidden layers—just embeddings. Generate positive (context) pairs and negative samples from a noise distribution. |
| **Dataset** | **Tiny Royal Corpus** (~8 sentences, vocab size ≈ 20). E.g., *"the king rules the kingdom"*, *"the queen rules the realm"*, *"the princess is the daughter of the king"*, etc. |
| **Success** | After training, a 2D PCA of the embedding vectors shows: (a) "king" and "queen" are close to "royal" words, far from "dog"/"cat", and (b) a rough gender axis (man ↔ woman, king ↔ queen). |
| **LOC** | ~220 lines. |
| **Visualizations** | 1. **2D scatter plot** of word vectors (labeled). 2. **Cosine similarity matrix** (heatmap). |

**Key concept:** Distributional hypothesis, noise contrastive estimation, sub-sampling (skipped for simplicity).

---

## Phase 12: Seq2Seq (Encoder-Decoder without Attention)
**Goal:** Map variable-length input to variable-length output.

| | Details |
|---|---|
| **What they BUILD** | An encoder-decoder using LSTMs from Phase 10. Encoder reads input sequence, produces final hidden/cell states. Decoder uses those as initial states and generates output tokens one-by-one (teacher forcing during training). Character-level. |
| **Dataset** | **Character Reversal** (length 4–10). Vocab = lowercase letters. Input = random string (e.g., `"hello"`), Target = reversed string (`"olleh"`). 2000 pairs. |
| **Success** | Perfectly reverses unseen test strings of length ≤ 10. |
| **LOC** | ~350 lines. |
| **Visualizations** | 1. **Translation samples** (input / predicted / target table). |

**Key concept:** Bottleneck (context vector), teacher forcing, autoregressive generation.

---

## Phase 13: Attention Mechanism
**Goal:** Allow the decoder to focus on relevant encoder states.

| | Details |
|---|---|
| **What they BUILD** | Add **scaled dot-product attention** to the Phase 12 Seq2Seq model. Compute alignment scores between decoder hidden state and all encoder hidden states. Weighted sum of encoder states becomes the "context" vector fed into the decoder at each step. |
| **Dataset** | **Longer Character Reversal** (length 15–25). Same vocab. 2000 pairs. The vanilla Seq2Seq from Phase 12 should struggle here; attention fixes it. |
| **Success** | > 95% character-level accuracy on length-25 sequences. |
| **LOC** | ~120 lines (additive to Phase 12). |
| **Visualizations** | 1. **Attention heatmap** (decoder steps × encoder steps) for a few test examples. Should show a clean anti-diagonal line for the reversal task. |

**Key concept:** Query/Key/Value, alignment scores, soft dictionary lookup.

---

## Phase 14: Transformer from Scratch
**Goal:** Parallelize sequence modeling and eliminate recurrence.

| | Details |
|---|---|
| **What they BUILD** | A minimal but complete **Encoder-Decoder Transformer** in NumPy: positional encoding, multi-head attention (2 heads), scaled dot-product, causal mask for decoder, layer norm, residual connections, feed-forward blocks. Keep dimensions tiny to ensure speed. |
| **Dataset** | **Copy Task** (sequence length = 12, vocab size = 8). Input = random tokens. Target = identical sequence. Forces the model to learn attention and identity mapping via residuals. 1000 sequences. |
| **Success** | Perfect copy on held-out sequences. Attention heads show clear "copy" patterns (each output position attends strongly to its corresponding input position). |
| **LOC** | ~600 lines. |
| **Visualizations** | 1. **Encoder-decoder attention heatmaps** (one per head). 2. **Loss curve**. 3. **Sample input/target/prediction** triples. |

**Key concept:** Self-attention, multi-head parallelism, causal masking, why residuals matter.

**Performance guardrails:** `d_model=16`, `num_heads=2`, `num_layers=2`, `d_ff=32`, batch_size=32, train_steps=500. This runs in ~5–10 seconds.

---

## Phase 15: GPT-style Decoder-Only Transformer
**Goal:** Build an autoregressive language model.

| | Details |
|---|---|
| **What they BUILD** | Take the Transformer decoder from Phase 14, remove the encoder, and stack it into a **decoder-only, left-to-right autoregressive model** (GPT). Add an LM head (projection to vocab). Train with causal masking to predict the next token at every position. Implement greedy generation at inference time. |
| **Dataset** | **Synthetic Grammar: Repeating Pattern** (~5,000 tokens). A highly regular language: `abcabcabc...` with occasional noise, OR a simple bracket language `(()())` generated synthetically. Vocab size = 8 (e.g., `a,b,c, (, ) , <PAD>, <EOS>`). Sequence length = 16. |
| **Success** | 1. Training loss converges to near-zero. 2. **Generation:** Given a prompt like `"abc"`, the model greedily generates `"abcabcabc..."` perfectly. Given `"("`, it generates valid bracket strings (e.g., `"()"`). |
| **LOC** | ~500 lines (reuses attention/FFN blocks from Phase 14, adds embedding + causal LM head + generation loop). |
| **Visualizations** | 1. **Loss curve**. 2. **Generated text samples** at epochs 10, 100, 300 (showing convergence). 3. **Causal attention heatmap** (lower-triangular). |

**Key concept:** Autoregressive modeling, causal (look-ahead) mask, next-token prediction, inference-time generation loop.

**Performance guardrails:** `d_model=32`, `num_heads=2`, `num_layers=2`, `seq_len=16`, train_steps=1000. Runs in ~10–15 seconds.

---

## Summary Table

| Phase | Topic | What They Build | Dataset | LOC |
|-------|-------|-----------------|---------|-----|
| 5 | Multi-Class Classifier | Softmax + modular `Dense` layer | 3-Class Spirals (2D) | ~120 |
| 6 | Deep Networks | 4-layer MLP, ReLU, He/Xavier init | Noisy Circles (2D) | ~180 |
| 7 | Regularization | Dropout + L2 | Noisy Moons (tiny) | ~80 |
| 8 | CNN | Conv2D, MaxPool, backprop | 8×8 X vs O images | ~350 |
| 9 | RNN | Vanilla RNN + BPTT | Binary Parity (len 20) | ~200 |
| 10 | LSTM | LSTM gates + BPTT | Long-Range Copy (len 50) | ~300 |
| 11 | Word Embeddings | Skip-gram + Negative Sampling | Tiny Royal Corpus | ~220 |
| 12 | Seq2Seq | LSTM Encoder-Decoder | Char Reversal (len 4-10) | ~350 |
| 13 | Attention | Scaled Dot-Product Attention | Char Reversal (len 15-25) | ~120 |
| 14 | Transformer | Full Encoder-Decoder Transformer | Copy Task (len 12) | ~600 |
| 15 | GPT | Decoder-only Autoregressive LM | Repeating Pattern / Brackets | ~500 |

**Total incremental LOC from Phase 4 to GPT:** ~3,000 lines (not all written fresh; lots of reuse).

---

## Recommended File Structure

```
building-ai/
├── phase05_softmax/
│   ├── network.py
│   └── train.py
├── phase06_deepnet/
│   └── ...
├── ...
├── phase14_transformer/
│   └── transformer.py
└── utils/
    └── viz.py          # Shared matplotlib helpers
```

Each phase should be runnable as:
```bash
python train.py
```
and produce both printed metrics and a `figs/` folder with visualizations.
