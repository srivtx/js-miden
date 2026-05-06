# 07-avoiding-bias.md

## WHAT

Biases can invalidate experiment results.

## WHY

Common biases include selection bias, novelty effect, and network effects.

## HOW

- **Randomization**: Hash-based assignment prevents self-selection
- **Sample Ratio Mismatch (SRM)**: Check that variants have expected traffic split
- **Novelty Effect**: Run experiments long enough for novelty to wear off
- **Network Effects**: Be aware that users interact (e.g., marketplaces)
- **Carryover Effects**: Avoid testing the same users in overlapping experiments on the same feature
