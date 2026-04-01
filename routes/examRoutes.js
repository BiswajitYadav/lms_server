import express from 'express';
import { protectEducator } from '../middlewares/authMiddleware.js';
import {
    addExam,
    getExam,
    submitExam,
    getResult,
    getCourseExamResults,
    deleteExam
} from '../controllers/examController.js';

const examRouter = express.Router();

// Educator: add/update exam for a course (must be course owner)
examRouter.post('/add', protectEducator, addExam);

// Student: submit exam answers
examRouter.post('/submit', submitExam);

// Educator: view all student results for their course exam
examRouter.get('/results/:courseId', protectEducator, getCourseExamResults);

// Student: get their own result for a course exam
examRouter.get('/result/:courseId', getResult);

// Student: get exam questions for a course (enrolled + completed only)
examRouter.get('/:courseId', getExam);

// Educator: delete exam for a course (must be course owner)
examRouter.delete('/:courseId', protectEducator, deleteExam);

export default examRouter;
