import { Router } from 'express';
import { getCertificate, getUserCertificates, issueCertificate } from '../controllers/certificates.js';

const router = Router();

router.post('/', issueCertificate);
router.get('/user/:userId', getUserCertificates);
router.get('/:id', getCertificate);

export { router as certificateRoutes };
