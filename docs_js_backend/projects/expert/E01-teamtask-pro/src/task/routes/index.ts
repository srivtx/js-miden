import { Router } from 'express';
import { TaskController } from '../controllers/task.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const controller = new TaskController();

router.use(authenticate);

router.post('/projects', controller.createProject.bind(controller));
router.get('/projects', controller.getProjects.bind(controller));
router.post('/', controller.createTask.bind(controller));
router.get('/project/:projectId', controller.getTasksByProject.bind(controller));
router.get('/:id', controller.getTaskById.bind(controller));
router.patch('/:id', controller.updateTask.bind(controller));
router.delete('/:id', controller.deleteTask.bind(controller));
router.get('/search', controller.searchTasks.bind(controller));

export default router;
