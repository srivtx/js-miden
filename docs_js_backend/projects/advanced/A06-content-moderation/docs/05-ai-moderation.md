# A06: Content Moderation Pipeline - AI Moderation

## Overview

The AI moderation layer provides automated content screening before human review.

## Current Implementation (Mock)

The mock AI engine uses keyword matching:

| Keyword Pattern | Category | Confidence |
|-----------------|----------|------------|
| spam, buy now | spam | 0.85 |
| hate, attack | hate_speech | 0.92 |
| fake, scam | misinformation | 0.78 |

## Data Model

```typescript
interface AIResult {
  flagged: boolean;
  categories: string[];
  confidence: number;
  checkedAt: number;
}
```

## Integration Flow

1. Content submitted
2. AI check triggered (synchronously or via queue)
3. Result stored with content
4. If flagged, content queued for human review
5. Audit log entry created

## False Positives and Negatives

### False Positives
- Benign content incorrectly flagged
- Example: "I love to buy now-noodles" flagged as spam

### False Negatives
- Harmful content not detected
- Example: Slang, misspellings, or context-dependent toxicity

### Handling Strategies

1. **Confidence Thresholds**: Adjust thresholds to balance precision/recall
2. **Human Override**: Reviewers can override AI decisions
3. **Feedback Loop**: Track reviewer overrides to retrain AI models
4. **Multiple Models**: Ensemble of different AI detectors

## Phase 2-3: Production AI Integration

### OpenAI Moderation API
```typescript
const response = await openai.moderations.create({ input: content.text });
```

### AWS Comprehend
```typescript
const result = await comprehend.detectToxicity({ Text: content.text });
```

### Google Perspective API
```typescript
const result = await perspective.analyze({ comment: { text: content.text } });
```

## Performance Considerations

- AI checks should be asynchronous to avoid blocking submissions
- Cache results for duplicate/similar content
- Rate limit AI API calls to control costs
