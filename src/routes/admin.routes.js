import { Router } from 'express';


import { upload } from '../utils/multerConfig.js';
import { adminLogin } from '../controllers/adminAuth.controller.js';


const router = Router();


//admin login
router.post('/login', adminLogin);
//  (Admin)


export default router;