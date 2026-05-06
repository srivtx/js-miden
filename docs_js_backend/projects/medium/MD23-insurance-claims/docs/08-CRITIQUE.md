# Critique & Reflection

## What Went Well

1. **Real-world relevance**: Insurance fraud is a $40B+ annual problem in the US
2. **Subtle bug**: Exact string matching feels correct but is wrong
3. **Rich domain**: Workflow engine, fraud detection, payment calculation
4. **Multiple fix approaches**: From simple normalization to ML embeddings

## What Could Be Better

1. **Simplified fraud detection**: Real systems use ML models, not just rules
2. **No OCR**: Real claims include scanned documents requiring OCR
3. **Missing integrations**: No connection to CLUE or other industry databases
4. **No appeal process**: Real systems allow denied claims to be appealed

## Design Critique

### Architecture
- **Good**: State machine for claims workflow
- **Bad**: Monolithic service handles everything
- **Suggestion**: Separate fraud detection into microservice

### Database Schema
- **Good**: Separate payments table supports partial payments
- **Bad**: No audit log table for compliance
- **Suggestion**: Add `claim_events` table for all state changes

### Duplicate Detection
- **Good**: Bug is realistic and educational
- **Bad**: Fix is simplistic (word-based Jaccard)
- **Suggestion**: Production would use embeddings + database vector search

### API Design
- **Good**: Clear workflow progression endpoints
- **Bad**: No batch operations for bulk claim submission
- **Suggestion**: Add `/api/claims/batch` for corporate clients

## Lessons Learned

1. **String comparison is dangerous**: Natural language requires fuzzy matching
2. **Normalization is essential**: Always clean user input
3. **Audit trails matter**: Financial systems need complete history
4. **Fraud evolves**: Detection rules must be regularly updated

## Alternative Architectures

### Event-Driven
Use Kafka/RabbitMQ for claim events. Fraud detection is a consumer that can replay events.

### Microservices
- Claim Submission Service
- Fraud Detection Service
- Payment Service
- Document Service
- Notification Service

### Blockchain
Some insurers experiment with blockchain for immutable claim records. Overkill for most cases.
