import Course from '../models/Course.js';
import { CourseProgress } from '../models/CourseProgress.js';
import { Purchase } from '../models/Purchase.js';
import Exam from '../models/Exam.js';
import Result from '../models/Result.js';

// Helper: check if a student is enrolled (completed purchase) in a course
const isEnrolled = async (userId, courseId) => {
    const purchase = await Purchase.findOne({ userId, courseId, status: 'completed' });
    return !!purchase;
};

// Helper: check if a student has completed the course
// Completion = CourseProgress.completed is true  OR  all lectures have been watched
const hasCourseCompleted = async (userId, courseId, course) => {
    const progress = await CourseProgress.findOne({ userId, courseId });
    if (!progress) return false;
    if (progress.completed) return true;

    // Compute total lectures from course content
    const totalLectures = course.courseContent.reduce(
        (sum, chapter) => sum + chapter.chapterContent.length,
        0
    );
    return progress.lectureCompleted.length >= totalLectures && totalLectures > 0;
};

// ─── Educator: Add / Update Exam for a Course ────────────────────────────────
// POST /api/exam/add
export const addExam = async (req, res) => {
    try {
        const educatorId = req.auth.userId;
        const { courseId, title, questions, duration, passingScore } = req.body;

        if (!courseId || !title || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.json({ success: false, message: 'courseId, title, and questions are required.' });
        }

        // Verify course ownership
        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }
        if (course.educator !== educatorId) {
            return res.json({ success: false, message: 'Unauthorized: You are not the owner of this course.' });
        }

        // Upsert exam (one exam per course)
        const exam = await Exam.findOneAndUpdate(
            { courseId },
            { title, questions, ...(duration !== undefined && { duration }), ...(passingScore !== undefined && { passingScore }) },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ success: true, message: 'Exam saved successfully.', exam });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─── Student: Get Exam for a Course (answers hidden) ─────────────────────────
// GET /api/exam/:courseId
export const getExam = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId } = req.params;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }

        // Must be enrolled
        if (!(await isEnrolled(userId, courseId))) {
            return res.json({ success: false, message: 'You must be enrolled in this course to take the exam.' });
        }

        // Must have completed the course
        if (!(await hasCourseCompleted(userId, courseId, course))) {
            return res.json({ success: false, message: 'You must complete the course before taking the exam.' });
        }

        const exam = await Exam.findOne({ courseId });
        if (!exam) {
            return res.json({ success: false, message: 'No exam found for this course.' });
        }

        // Strip isCorrect flag before sending to student
        const examData = exam.toObject();
        examData.questions = examData.questions.map(q => ({
            question: q.question,
            answers: q.answers.map(a => ({ option: a.option }))
        }));

        res.json({ success: true, exam: examData });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─── Student: Submit Exam ─────────────────────────────────────────────────────
// POST /api/exam/submit
export const submitExam = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId, answers } = req.body;
        // answers = [{ questionIndex: 0, selectedOption: "Paris" }, ...]

        if (!courseId || !Array.isArray(answers)) {
            return res.json({ success: false, message: 'courseId and answers array are required.' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }

        // Must be enrolled
        if (!(await isEnrolled(userId, courseId))) {
            return res.json({ success: false, message: 'You must be enrolled in this course to take the exam.' });
        }

        // Must have completed the course
        if (!(await hasCourseCompleted(userId, courseId, course))) {
            return res.json({ success: false, message: 'You must complete the course before taking the exam.' });
        }

        const exam = await Exam.findOne({ courseId });
        if (!exam) {
            return res.json({ success: false, message: 'No exam found for this course.' });
        }

        // Check if student already submitted
        const existingResult = await Result.findOne({ examId: exam._id, userId });
        if (existingResult) {
            return res.json({ success: false, message: 'You have already submitted this exam.' });
        }

        // Validate no duplicate questionIndex values
        const seenIndices = new Set();
        for (const ans of answers) {
            if (seenIndices.has(ans.questionIndex)) {
                return res.json({ success: false, message: 'Duplicate questionIndex detected in submitted answers.' });
            }
            seenIndices.add(ans.questionIndex);
        }

        // Grade the exam
        let score = 0;
        const totalQuestions = exam.questions.length;

        answers.forEach(({ questionIndex, selectedOption }) => {
            const question = exam.questions[questionIndex];
            if (!question) return;
            const correctAnswer = question.answers.find(a => a.isCorrect);
            if (correctAnswer && correctAnswer.option === selectedOption) {
                score += 1;
            }
        });

        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        const passed = percentage >= exam.passingScore;

        const result = await Result.create({
            examId: exam._id,
            courseId,
            userId,
            submittedAnswers: answers,
            score,
            totalQuestions,
            percentage,
            passed
        });

        res.json({
            success: true,
            message: passed ? 'Congratulations! You passed the exam.' : 'You did not pass. Better luck next time.',
            result: {
                score,
                totalQuestions,
                percentage,
                passed,
                passingScore: exam.passingScore,
                resultId: result._id
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─── Student: Get Their Result for a Course Exam ─────────────────────────────
// GET /api/exam/result/:courseId
export const getResult = async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { courseId } = req.params;

        const exam = await Exam.findOne({ courseId });
        if (!exam) {
            return res.json({ success: false, message: 'No exam found for this course.' });
        }

        const result = await Result.findOne({ examId: exam._id, userId });
        if (!result) {
            return res.json({ success: false, message: 'No result found. You have not submitted this exam yet.' });
        }

        // Build detailed answer review
        const review = exam.questions.map((q, index) => {
            const submitted = result.submittedAnswers.find(a => a.questionIndex === index);
            const correctAnswer = q.answers.find(a => a.isCorrect);
            return {
                questionIndex: index,
                question: q.question,
                options: q.answers.map(a => a.option),
                selectedOption: submitted ? submitted.selectedOption : null,
                correctOption: correctAnswer ? correctAnswer.option : null,
                isCorrect: submitted ? submitted.selectedOption === (correctAnswer ? correctAnswer.option : null) : false
            };
        });

        res.json({
            success: true,
            result: {
                resultId: result._id,
                score: result.score,
                totalQuestions: result.totalQuestions,
                percentage: result.percentage,
                passed: result.passed,
                passingScore: exam.passingScore,
                submittedAt: result.createdAt,
                review
            }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─── Educator: Get All Results for Their Course Exam ─────────────────────────
// GET /api/exam/results/:courseId
export const getCourseExamResults = async (req, res) => {
    try {
        const educatorId = req.auth.userId;
        const { courseId } = req.params;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }
        if (course.educator !== educatorId) {
            return res.json({ success: false, message: 'Unauthorized: You are not the owner of this course.' });
        }

        const exam = await Exam.findOne({ courseId });
        if (!exam) {
            return res.json({ success: false, message: 'No exam found for this course.' });
        }

        const results = await Result.find({ examId: exam._id })
            .populate('userId', 'name email imageUrl')
            .sort({ createdAt: -1 });

        res.json({ success: true, examTitle: exam.title, results });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ─── Educator: Delete Exam for a Course ──────────────────────────────────────
// DELETE /api/exam/:courseId
export const deleteExam = async (req, res) => {
    try {
        const educatorId = req.auth.userId;
        const { courseId } = req.params;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.json({ success: false, message: 'Course not found.' });
        }
        if (course.educator !== educatorId) {
            return res.json({ success: false, message: 'Unauthorized: You are not the owner of this course.' });
        }

        const exam = await Exam.findOne({ courseId });
        if (!exam) {
            return res.json({ success: false, message: 'No exam found for this course.' });
        }

        // Cascade: delete all student results for this exam
        await Result.deleteMany({ examId: exam._id });
        await exam.deleteOne();

        res.json({ success: true, message: 'Exam deleted successfully.' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
