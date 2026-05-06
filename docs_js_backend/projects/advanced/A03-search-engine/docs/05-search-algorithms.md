# A03 Search Engine Backend - Search Algorithms

## Tokenization Pipeline

1. **Lowercase**: Convert to lowercase for case-insensitive matching
2. **Punctuation Removal**: Replace non-alphanumeric with spaces
3. **Split**: Tokenize on whitespace
4. **Filter**: Remove tokens shorter than 2 characters

Example:
```
"Hello, world! Running fast." → ["hello", "world", "running", "fast"]
```

## Porter Stemmer

Implements the Porter Stemming Algorithm (simplified) to reduce words to their root form.

**Examples:**
| Original | Stemmed |
|----------|---------|
| running  | run     |
| flies    | fli     |
| agreed   | agre    |
| programming | program |
| cats     | cat     |

**Benefits:**
- "run" matches "running", "runs", "ran"
- Reduces index size by conflating variants

## BM25 Scoring

BM25 (Best Match 25) is a probabilistic ranking function used to estimate the relevance of documents to a query.

### Formula

```
score(D, Q) = Σ IDF(qᵢ) · (f(qᵢ, D) · (k₁ + 1)) / (f(qᵢ, D) + k₁ · (1 - b + b · |D| / avgdl))
```

Where:
- `f(qᵢ, D)` = term frequency in document
- `|D|` = document length
- `avgdl` = average document length
- `k₁` = term frequency saturation parameter (default: 1.2)
- `b` = length normalization parameter (default: 0.75)

### IDF Calculation

```
IDF(q) = log((N - df + 0.5) / (df + 0.5) + 1)
```

Where:
- `N` = total number of documents
- `df` = document frequency (number of docs containing term)

### Field Weights

Title terms are weighted 2x compared to content terms:
- Title: stored twice in postings list
- Content: stored once

This reflects the intuition that title matches are more relevant.

### Scoring Properties

1. **Term Frequency Saturation**: Additional occurrences provide diminishing returns
2. **Length Normalization**: Longer documents are penalized
3. **Rare Term Boost**: Terms appearing in fewer documents score higher
