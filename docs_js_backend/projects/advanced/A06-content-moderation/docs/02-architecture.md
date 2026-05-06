# A06: Content Moderation Pipeline - Architecture

## System Architecture

```
┌─────────────┐     Submit      ┌─────────────────────────────┐
│    User     │ ───────────────►│  Content Moderation Pipeline │
└─────────────┘                 │      (Express 5 + TS)        │
                                └─────────────────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          │                                │                                │
   ┌──────▼──────┐                ┌───────▼────────┐            ┌──────────▼─────────┐
   │  AI Check   │                │  Human Review  │            │     Appeals        │
   │   Engine    │                │     Queue      │            │    Process         │
   └─────────────┘                └────────────────┘            └────────────────────┘
          │                                │                                │
          └────────────────────────────────┼────────────────────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │ Audit Trail │
                                    │   Storage   │
                                    └─────────────┘
```

## Pipeline Flow

```
Submitted → AI Review → [Flagged?] → Human Review → Decision → [Approved?] → Published
                │           Yes              │          Yes
                │                            │
                └────── No ──────────────────┘          No
                                           └────────── Rejected
```

## Component Design

### Content Layer
- Stores user-generated content with metadata
- Tracks content status through the pipeline

### AI Check Layer
- Mock AI engine that flags content based on keyword matching
- Categories: spam, hate_speech, misinformation
- Confidence score included in results

### Human Review Layer
- Queue for content flagged by AI
- Reviewers make approve/reject decisions
- **Known Issue**: Race condition when two reviewers act simultaneously

### Audit Layer
- Logs every action in the content lifecycle
- **Known Issue**: Appeal processing overwrites history without preserving transitions

### Appeal Layer
- Users can appeal rejections
- Admin resolves appeals
- **Known Issue**: Original decision not fully preserved in audit trail

### Queue Layer
- Background job queue for pipeline stages
- Jobs: ai_check, human_review, publish

## Phase 2-3 Considerations

- **Real AI Integration**: Connect to OpenAI Moderation API, AWS Comprehend, or Google Perspective
- **Distributed Queue**: Use BullMQ, RabbitMQ, or Kafka for job processing
- **Database**: PostgreSQL with ACID transactions for audit trail integrity
- **Event Sourcing**: Store state transitions as immutable events
