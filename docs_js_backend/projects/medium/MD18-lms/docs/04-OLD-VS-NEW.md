# Old vs New: LMS Tech (2015 vs 2025)

## Architecture Patterns

| Aspect | 2015 Approach | 2025 Approach |
|--------|---------------|---------------|
| **API Framework** | Express 4 with callbacks | Express 5 + async/await + ESM |
| **Database** | MySQL / MongoDB | PostgreSQL + Prisma (type-safe) |
| **Progress Tracking** | Session-based | Database-persisted with timestamps |
| **Quiz System** | Client-side grading | Server-side with encrypted answers |
| **Video Delivery** | Direct MP4 links | HLS streaming with CDN |
| **Certificates** | PDF generation | Blockchain-verified (optional) |
| **Analytics** | Basic completion % | Learning analytics with xAPI |

## Code Comparison

### Enrollment (2015 vs 2025)

**2015 (Race-prone):**
```javascript
// Express 4, check-then-create
app.post('/enroll', function(req, res) {
  db.query('SELECT COUNT(*) FROM enrollments WHERE course_id = ?', 
    [req.body.courseId], function(err, rows) {
    if (rows[0].count >= 50) return res.status(400).send('Full');
    
    db.query('INSERT INTO enrollments ...', [req.body.userId, req.body.courseId], function(err2) {
      if (err2) return res.status(500).send(err2);
      res.json({ success: true });
    });
  });
});
```

**2025 (Atomic):**
```typescript
// Express 5, atomic insert
app.post('/enroll', async (req, res) => {
  const result = await prisma.$queryRaw`
    INSERT INTO enrollments (user_id, course_id)
    SELECT ${req.body.userId}, ${req.body.courseId}
    WHERE (
      SELECT COUNT(*) FROM enrollments WHERE course_id = ${req.body.courseId}
    ) < (
      SELECT max_students FROM courses WHERE id = ${req.body.courseId}
    )
    RETURNING *
  `;
  
  if (!result || result.length === 0) {
    return res.status(409).json({ error: 'Course is full' });
  }
  
  res.json({ success: true });
});
```

### Progress Tracking (2015 vs 2025)

**2015 (No persistence):**
```javascript
// Progress stored in session/localStorage
function markComplete(lessonId) {
  localStorage.setItem(`progress_${lessonId}`, 'true');
  // Lost on logout or device switch!
}
```

**2025 (Database-persisted):**
```typescript
// Progress stored in PostgreSQL with conflict handling
async function markComplete(userId: string, lessonId: string) {
  await prisma.progress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completed: true },
    create: { userId, lessonId, completed: true },
  });
  
  // Update enrollment progress percentage
  const courseProgress = await calculateCourseProgress(userId, courseId);
  await prisma.enrollment.updateMany({
    where: { userId, courseId },
    data: { progress: courseProgress.percentage },
  });
}
```

### Quiz System (2015 vs 2025)

**2015 (Client-side grading):**
```javascript
// Answers visible in client JS
const questions = [
  { id: 'q1', question: '2+2=?', options: ['3','4','5'], correct: 'B' }
];

function grade(answers) {
  let score = 0;
  questions.forEach((q, i) => {
    if (q.correct === answers[i]) score++;
  });
  return score;
}
// CHEAT: User can inspect correct answers in DevTools!
```

**2025 (Server-side grading):**
```typescript
// Answers hidden from client
app.post('/quizzes/:id/submit', async (req, res) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: req.params.id } });
  const questions = quiz.questions as Question[];
  
  let correct = 0;
  for (const answer of req.body.answers) {
    const question = questions.find(q => q.id === answer.questionId);
    if (question?.correctAnswer === answer.answer) correct++;
  }
  
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= quiz.passingScore;
  
  await prisma.quizAttempt.create({
    data: { quizId: req.params.id, userId: req.body.userId, score, answers: req.body.answers, passed },
  });
  
  res.json({ score, passed });
});
```

## Technology Evolution

| Component | 2015 Stack | 2025 Stack |
|-----------|-----------|------------|
| Language | JavaScript (ES5) | TypeScript (strict, ESM) |
| ORM | Sequelize / Mongoose | Prisma |
| Testing | Mocha + Chai | Vitest + Supertest |
| Video | Direct MP4 | HLS + CDN (CloudFront) |
| Certificates | PDF | Blockchain (Blockcerts) |
| Analytics | Custom | xAPI (Tin Can) |
| Containerization | Docker (basic) | Docker Compose + K8s |

## Industry Milestones

- **2015**: Canvas LMS dominates higher education; basic progress tracking
- **2016**: Khan Academy introduces mastery learning with spaced repetition
- **2017**: Coursera reaches 30M+ learners; scalability challenges emerge
- **2018**: edX open-sources analytics pipeline
- **2019**: AI-driven personalized learning paths (Knewton, Squirrel AI)
- **2021**: Micro-credentials and digital badges become standard
- **2023**: LLM-powered tutoring assistants (Khanmigo, Duolingo Max)
- **2025**: Immersive learning with VR/AR integration
