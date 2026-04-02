import Discussion from '../models/Discussion.js';
import Course from '../models/Course.js';
import User from '../models/User.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true if userId is the educator who owns the given course document.
 */
const isEducator = (course, userId) => course.educator === userId || course.educator?.toString() === userId;

/**
 * Return true if userId is enrolled in the course OR is the educator.
 */
const isEnrolledOrEducator = (course, userId) =>
    isEducator(course, userId) ||
    course.enrolledStudents.some((s) => s.toString() === userId);

// ---------------------------------------------------------------------------
// GET /api/discussion/:courseId
// Read-only for everyone; no auth required.
// ---------------------------------------------------------------------------
export const getDiscussions = async (req, res) => {
    try {
        const { courseId } = req.params;

        const discussions = await Discussion.find({ courseId })
            .populate('author', 'name imageUrl')
            .populate('replies.author', 'name imageUrl')
            .populate('replies.subReplies.author', 'name imageUrl')
            .sort({ isPinned: -1, isBoosted: -1, createdAt: -1 });

        res.json({ success: true, discussions });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId
// Create a new discussion – enrolled students and educator only.
// ---------------------------------------------------------------------------
export const createDiscussion = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, content } = req.body;
        const userId = req.auth.userId;

        if (!title || !content) {
            return res.json({ success: false, message: 'Title and content are required' });
        }

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });

        if (!isEnrolledOrEducator(course, userId)) {
            return res.json({
                success: false,
                message: 'Only enrolled students or the course educator can post discussions',
            });
        }

        const discussion = await Discussion.create({ courseId, author: userId, title, content });

        const populated = await discussion.populate('author', 'name imageUrl');
        res.json({ success: true, discussion: populated });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/discussion/:courseId/:discussionId
// Author can delete their own discussion; educator can delete any.
// ---------------------------------------------------------------------------
export const deleteDiscussion = async (req, res) => {
    try {
        const { courseId, discussionId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const canDelete = discussion.author === userId || isEducator(course, userId);
        if (!canDelete) {
            return res.json({ success: false, message: 'Not authorized to delete this discussion' });
        }

        await discussion.deleteOne();
        res.json({ success: true, message: 'Discussion deleted' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId/:discussionId/boost
// Toggle boost on a discussion – educator only.
// ---------------------------------------------------------------------------
export const boostDiscussion = async (req, res) => {
    try {
        const { courseId, discussionId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });
        if (!isEducator(course, userId)) {
            return res.json({ success: false, message: 'Only the course educator can boost discussions' });
        }

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        discussion.isBoosted = !discussion.isBoosted;
        await discussion.save();

        res.json({ success: true, isBoosted: discussion.isBoosted });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId/:discussionId/pin
// Toggle pin on a discussion – educator only.
// ---------------------------------------------------------------------------
export const pinDiscussion = async (req, res) => {
    try {
        const { courseId, discussionId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });
        if (!isEducator(course, userId)) {
            return res.json({ success: false, message: 'Only the course educator can pin discussions' });
        }

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        discussion.isPinned = !discussion.isPinned;
        await discussion.save();

        res.json({ success: true, isPinned: discussion.isPinned });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId/:discussionId/upvote
// Toggle upvote – enrolled students and educator only.
// ---------------------------------------------------------------------------
export const upvoteDiscussion = async (req, res) => {
    try {
        const { courseId, discussionId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });
        if (!isEnrolledOrEducator(course, userId)) {
            return res.json({ success: false, message: 'Only enrolled students or the educator can upvote' });
        }

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const index = discussion.upvotes.indexOf(userId);
        if (index === -1) {
            discussion.upvotes.push(userId);
        } else {
            discussion.upvotes.splice(index, 1);
        }
        await discussion.save();

        res.json({ success: true, upvotes: discussion.upvotes.length, upvoted: index === -1 });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId/:discussionId/reply
// Add a reply – enrolled students and educator only.
// ---------------------------------------------------------------------------
export const addReply = async (req, res) => {
    try {
        const { courseId, discussionId } = req.params;
        const { content } = req.body;
        const userId = req.auth.userId;

        if (!content) return res.json({ success: false, message: 'Content is required' });

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });
        if (!isEnrolledOrEducator(course, userId)) {
            return res.json({ success: false, message: 'Only enrolled students or the educator can reply' });
        }

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const educatorReply = isEducator(course, userId);
        discussion.replies.push({ author: userId, content, isEducatorReply: educatorReply });
        await discussion.save();

        await discussion.populate('replies.author', 'name imageUrl');
        const newReply = discussion.replies[discussion.replies.length - 1];

        res.json({ success: true, reply: newReply });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/discussion/:courseId/:discussionId/reply/:replyId
// Author can delete their own reply; educator can delete any.
// ---------------------------------------------------------------------------
export const deleteReply = async (req, res) => {
    try {
        const { courseId, discussionId, replyId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const reply = discussion.replies.id(replyId);
        if (!reply) return res.json({ success: false, message: 'Reply not found' });

        const canDelete = reply.author === userId || reply.author?.toString() === userId || isEducator(course, userId);
        if (!canDelete) {
            return res.json({ success: false, message: 'Not authorized to delete this reply' });
        }

        reply.deleteOne();
        await discussion.save();

        res.json({ success: true, message: 'Reply deleted' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId/:discussionId/reply/:replyId/subreply
// Add a sub-reply – enrolled students and educator only.
// ---------------------------------------------------------------------------
export const addSubReply = async (req, res) => {
    try {
        const { courseId, discussionId, replyId } = req.params;
        const { content } = req.body;
        const userId = req.auth.userId;

        if (!content) return res.json({ success: false, message: 'Content is required' });

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });
        if (!isEnrolledOrEducator(course, userId)) {
            return res.json({ success: false, message: 'Only enrolled students or the educator can reply' });
        }

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const reply = discussion.replies.id(replyId);
        if (!reply) return res.json({ success: false, message: 'Reply not found' });

        const educatorReply = isEducator(course, userId);
        reply.subReplies.push({ author: userId, content, isEducatorReply: educatorReply });
        await discussion.save();

        await discussion.populate('replies.subReplies.author', 'name imageUrl');
        const updatedReply = discussion.replies.id(replyId);
        const newSubReply = updatedReply.subReplies[updatedReply.subReplies.length - 1];

        res.json({ success: true, subReply: newSubReply });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/discussion/:courseId/:discussionId/reply/:replyId/subreply/:subReplyId
// Author can delete their own sub-reply; educator can delete any.
// ---------------------------------------------------------------------------
export const deleteSubReply = async (req, res) => {
    try {
        const { courseId, discussionId, replyId, subReplyId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const reply = discussion.replies.id(replyId);
        if (!reply) return res.json({ success: false, message: 'Reply not found' });

        const subReply = reply.subReplies.id(subReplyId);
        if (!subReply) return res.json({ success: false, message: 'Sub-reply not found' });

        const canDelete =
            subReply.author === userId ||
            subReply.author?.toString() === userId ||
            isEducator(course, userId);
        if (!canDelete) {
            return res.json({ success: false, message: 'Not authorized to delete this sub-reply' });
        }

        subReply.deleteOne();
        await discussion.save();

        res.json({ success: true, message: 'Sub-reply deleted' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// POST /api/discussion/:courseId/:discussionId/reply/:replyId/upvote
// Toggle upvote on a reply – enrolled students and educator only.
// ---------------------------------------------------------------------------
export const upvoteReply = async (req, res) => {
    try {
        const { courseId, discussionId, replyId } = req.params;
        const userId = req.auth.userId;

        const course = await Course.findById(courseId);
        if (!course) return res.json({ success: false, message: 'Course not found' });
        if (!isEnrolledOrEducator(course, userId)) {
            return res.json({ success: false, message: 'Only enrolled students or the educator can upvote' });
        }

        const discussion = await Discussion.findOne({ _id: discussionId, courseId });
        if (!discussion) return res.json({ success: false, message: 'Discussion not found' });

        const reply = discussion.replies.id(replyId);
        if (!reply) return res.json({ success: false, message: 'Reply not found' });

        const index = reply.upvotes.indexOf(userId);
        if (index === -1) {
            reply.upvotes.push(userId);
        } else {
            reply.upvotes.splice(index, 1);
        }
        await discussion.save();

        res.json({ success: true, upvotes: reply.upvotes.length, upvoted: index === -1 });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};
