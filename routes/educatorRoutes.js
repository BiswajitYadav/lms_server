import express from 'express'
import { addCourse, educatorDashboardData, getEducatorCourses, getEnrolledStudentsData, updateRoleToEducator, updateCourse, deleteCourse } from '../controllers/educatorController.js';
import upload from '../configs/multer.js';
import { protectEducator } from '../middlewares/authMiddleware.js';


const educatorRouter = express.Router()

// Add Educator Role 
educatorRouter.get('/update-role', updateRoleToEducator)

// Add Courses 
educatorRouter.post('/add-course', upload.single('image'), protectEducator, addCourse)

// Get Educator Courses 
educatorRouter.get('/courses', protectEducator, getEducatorCourses)

// Get Educator Dashboard Data
educatorRouter.get('/dashboard', protectEducator, educatorDashboardData)

// Get Educator Students Data
educatorRouter.get('/enrolled-students', protectEducator, getEnrolledStudentsData)

// Update Course (owner only)
educatorRouter.put('/course/:courseId', upload.single('image'), protectEducator, updateCourse)

// Delete Course (owner only)
educatorRouter.delete('/course/:courseId', protectEducator, deleteCourse)


export default educatorRouter;