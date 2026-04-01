import mongoose from 'mongoose';

const answerOptionSchema = new mongoose.Schema({
    option: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
}, { _id: false });

const questionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answers: {
        type: [answerOptionSchema],
        validate: {
            validator: (arr) => arr.length >= 2,
            message: 'Each question must have at least 2 answer options.'
        }
    }
}, { _id: false });

const examSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        unique: true
    },
    title: { type: String, required: true },
    questions: {
        type: [questionSchema],
        validate: {
            validator: (arr) => arr.length >= 1,
            message: 'Exam must have at least 1 question.'
        }
    },
    duration: { type: Number, default: 30 },       // in minutes
    passingScore: { type: Number, default: 50 }    // percentage required to pass
}, { timestamps: true });

const Exam = mongoose.model('Exam', examSchema);

export default Exam;
