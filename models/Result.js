import mongoose from 'mongoose';

const submittedAnswerSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    selectedOption: { type: String, required: true }
}, { _id: false });

const resultSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    userId: {
        type: String,
        ref: 'User',
        required: true
    },
    submittedAnswers: [submittedAnswerSchema],
    score: { type: Number, required: true },           // number of correct answers
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },      // score / totalQuestions * 100
    passed: { type: Boolean, required: true }
}, { timestamps: true });

// A student can only have one result per exam
resultSchema.index({ examId: 1, userId: 1 }, { unique: true });

const Result = mongoose.model('Result', resultSchema);

export default Result;
