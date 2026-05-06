# Task & Project Management

## Data Models

### Project
```typescript
interface Project {
  _id: string;
  name: string;
  description?: string;
  organizationId: string;
  ownerId: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}
```

### Task
```typescript
interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  assigneeId?: string;
  reporterId: string;
  organizationId: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Task Lifecycle

```
backlog → todo → in_progress → review → done
   ↑_________________________________________|
```

## API Endpoints

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/tasks/projects | Create project |
| GET | /api/v1/tasks/projects | List organization projects |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/tasks | Create task |
| GET | /api/v1/tasks/project/:projectId | List project tasks |
| GET | /api/v1/tasks/:id | Get task details |
| PATCH | /api/v1/tasks/:id | Update task |
| DELETE | /api/v1/tasks/:id | Delete task |
| GET | /api/v1/tasks/search?q=query | Search tasks |

## Activity Logs
All task operations generate activity log entries:
- Task created
- Task assigned
- Status changed
- Due date modified
- File attached

## Known Issues
- `GET /api/v1/tasks/:id` does not verify task belongs to user's organization
- `GET /api/v1/tasks/search` searches across all tenants
See `07-security.md` for details.
