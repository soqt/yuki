import express from 'express';
// import * from '../services/service'
import { gm } from '../controllers/gmController';

const router = express.Router();

router.get('/gm', gm);

export default router;