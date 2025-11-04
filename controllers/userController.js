import Course from "../models/Course.js"
import { CourseProgress } from "../models/CourseProgress.js"
import { Purchase } from "../models/Purchase.js"
import User from "../models/User.js"
import stripe from "stripe"



// Get User Data
export const getUserData = async (req, res) => {
    try {

        const userId = req.auth.userId

        console.log(userId)

        const user = await User.findById(userId)

        if (!user) {
            return res.json({ success: false, message: 'User Not Found' })
        }

        res.json({ success: true, user })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Purchase Course 
export const purchaseCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const { origin } = req.headers;
        const userId = req.auth.userId;

        // Validate course
        const courseData = await Course.findById(courseId);
        if (!courseData) {
            return res.json({ success: false, message: "Course not found" });
        }

        // Compute final price after discount
        const finalAmount = (
            courseData.coursePrice -
            (courseData.discount * courseData.coursePrice) / 100
        ).toFixed(2);

        // Create purchase record
        const newPurchase = await Purchase.create({
            courseId: courseData._id,
            userId,
            amount: finalAmount,
            status: courseData.coursePrice === 0 ? "completed" : "pending",
        });

        // --------------------------------------------------------
        // 🆓 FREE COURSE LOGIC
        // --------------------------------------------------------
        if (courseData.coursePrice === 0 || Number(finalAmount) === 0) {
            // Mark purchase as completed
            newPurchase.status = "completed";
            await newPurchase.save();

            // Enroll the user in the course
            const userData = await User.findById(userId);
            if (userData && !userData.enrolledCourses.includes(courseData._id)) {
                userData.enrolledCourses.push(courseData._id);
                await userData.save();
            }

            if (!courseData.enrolledStudents.includes(userData._id)) {
                courseData.enrolledStudents.push(userData._id);
                await courseData.save();
            }

            return res.json({
                success: true,
                message: "Free course enrolled successfully",
                redirect: `${origin}/loading/my-enrollments`,
                purchase: newPurchase,
            });
        }

        // --------------------------------------------------------
        // 💳 PAID COURSE LOGIC
        // --------------------------------------------------------
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const currency = process.env.CURRENCY.toLowerCase();

        const line_items = [
            {
                price_data: {
                    currency,
                    product_data: { name: courseData.courseTitle },
                    unit_amount: Math.round(finalAmount * 100), // convert to cents
                },
                quantity: 1,
            },
        ];

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-enrollments`,
            cancel_url: `${origin}/`,
            line_items,
            mode: "payment",
            metadata: {
                purchaseId: newPurchase._id.toString(),
            },
        });

        return res.json({
            success: true,
            session_url: session.url,
        });
    } catch (error) {
        console.error("❌ purchaseCourse Error:", error);
        return res.json({ success: false, message: error.message });
    }
};


export const verifyPurchase = async (req, res) => {

    try {

        const { purchaseId } = req.body

        const purchase = await Purchase.findById(purchaseId)

        if (!purchase) {
            return res.json({ success: false, message: 'Purchase Not Found' })
        }

        res.json({ success: true, purchase })

    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}

// Users Enrolled Courses With Lecture Links
export const userEnrolledCourses = async (req, res) => {

    try {

        const userId = req.auth.userId

        const enrolledCourses = await Purchase.find({ userId, status: 'completed' })
            .populate({ path: 'courseId', select: '_id courseTitle courseDescription courseImage' })

        console.log(enrolledCourses)

        res.json({ success: true, enrolledCourses })

    } catch (error) {
        res.json({ success: false, message: error.message })
    }

}

// Update User Course Progress
export const updateUserCourseProgress = async (req, res) => {

    try {

        const userId = req.auth.userId

        const { courseId, lectureId } = req.body

        const progressData = await CourseProgress.findOne({ userId, courseId })

        if (progressData) {

            if (progressData.lectureCompleted.includes(lectureId)) {
                return res.json({ success: true, message: 'Lecture Already Completed' })
            }

            progressData.lectureCompleted.push(lectureId)
            await progressData.save()

        } else {

            await CourseProgress.create({
                userId,
                courseId,
                lectureCompleted: [lectureId]
            })

        }

        res.json({ success: true, message: 'Progress Updated' })

    } catch (error) {
        res.json({ success: false, message: error.message })
    }

}

// get User Course Progress
export const getUserCourseProgress = async (req, res) => {

    try {

        const userId = req.auth.userId

        const { courseId } = req.body

        const progressData = await CourseProgress.findOne({ userId, courseId })

        res.json({ success: true, progressData })

    } catch (error) {
        res.json({ success: false, message: error.message })
    }

}

// Add User Ratings to Course
export const addUserRating = async (req, res) => {

    const userId = req.auth.userId;
    const { courseId, rating } = req.body;

    // Validate inputs
    if (!courseId || !userId || !rating || rating < 1 || rating > 5) {
        return res.json({ success: false, message: 'InValid Details' });
    }

    try {
        // Find the course by ID
        const course = await Course.findById(courseId);

        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }

        const user = await User.findById(userId);

        if (!user || !user.enrolledCourses.includes(courseId)) {
            return res.json({ success: false, message: 'User has not purchased this course.' });
        }

        // Check is user already rated
        const existingRatingIndex = course.courseRatings.findIndex(r => r.userId === userId);

        if (existingRatingIndex > -1) {
            // Update the existing rating
            course.courseRatings[existingRatingIndex].rating = rating;
        } else {
            // Add a new rating
            course.courseRatings.push({ userId, rating });
        }

        await course.save();

        return res.json({ success: true, message: 'Rating added' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};