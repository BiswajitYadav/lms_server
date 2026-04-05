import mongoose from 'mongoose';

const subReplySchema = new mongoose.Schema(
    {
        author: { type: String, ref: 'User', required: true },
        content: { type: String, required: true, trim: true },
        isEducatorReply: { type: Boolean, default: false },
        upvotes: [{ type: String, ref: 'User' }],
    },
    { timestamps: true }
);

const replySchema = new mongoose.Schema(
    {
        author: { type: String, ref: 'User', required: true },
        content: { type: String, required: true, trim: true },
        isEducatorReply: { type: Boolean, default: false },
        upvotes: [{ type: String, ref: 'User' }],
        subReplies: [subReplySchema],
    },
    { timestamps: true }
);

const discussionSchema = new mongoose.Schema(
    {
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true,
        },
        author: { type: String, ref: 'User', required: true },
        title: { type: String, required: true, trim: true },
        content: { type: String, required: true, trim: true },
        // Educator can boost a discussion to highlight it for all students
        isBoosted: { type: Boolean, default: false },
        // Educator can pin a discussion to the top of the board
        isPinned: { type: Boolean, default: false },
        upvotes: [{ type: String, ref: 'User' }],
        replies: [replySchema],
    },
    { timestamps: true }
);

// Index to efficiently query discussions for a given course
discussionSchema.index({ courseId: 1, isPinned: -1, isBoosted: -1, createdAt: -1 });

const Discussion = mongoose.model('Discussion', discussionSchema);
export default Discussion;
