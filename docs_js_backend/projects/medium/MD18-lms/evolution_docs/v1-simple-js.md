# MD18 LMS — v1 Simple JS

## Goal
Build a basic Learning Management System in plain JavaScript.

## Stack
- Node.js 18+
- Express 4 (CommonJS)
- SQLite

## File Structure
```
src/
  app.js
  routes/
    courses.js
    enrollments.js
    lessons.js
  db.js
package.json
```

## Key Code

### `src/db.js`
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    instructor_id TEXT,
    max_students INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    course_id INTEGER,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = { db };
```

### `src/routes/enrollments.js`
```javascript
const express = require('express');
const { db } = require('../db');
const router = express.Router();

router.post('/', (req, res) => {
  const { userId, courseId } = req.body;
  // No capacity check — just insert
  db.run(
    'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
    [userId, courseId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

module.exports = router;
```

### `src/app.js`
```javascript
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/courses', require('./routes/courses'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/lessons', require('./routes/lessons'));
app.listen(3002, () => console.log('MD18 v1 running on 3002'));
```

## What Works
- Courses can be created and listed
- Users can enroll (no limit)
- Lessons can be added to courses

## What’s Missing
- No enrollment cap enforcement
- No progress tracking
- No quiz or certificate logic
- No validation
