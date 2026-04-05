import express from 'express';
import {
    getDiscussions,
    createDiscussion,
    deleteDiscussion,
    boostDiscussion,
    pinDiscussion,
    upvoteDiscussion,
    addReply,
    deleteReply,
    addSubReply,
    deleteSubReply,
    upvoteReply,
} from '../controllers/discussionController.js';

const discussionRouter = express.Router();

// ── Course discussion board ─────────────────────────────────────────────────
// Public read access; write actions require Clerk auth (enforced by clerkMiddleware).

// GET  /api/discussion/:courseId          – list all discussions (public)
discussionRouter.get('/:courseId', getDiscussions);

// POST /api/discussion/:courseId          – create discussion (enrolled / educator)
discussionRouter.post('/:courseId', createDiscussion);

// DELETE /api/discussion/:courseId/:discussionId  – delete discussion (author / educator)
discussionRouter.delete('/:courseId/:discussionId', deleteDiscussion);

// ── Educator moderation ─────────────────────────────────────────────────────

// POST /api/discussion/:courseId/:discussionId/boost  – toggle boost (educator)
discussionRouter.post('/:courseId/:discussionId/boost', boostDiscussion);

// POST /api/discussion/:courseId/:discussionId/pin    – toggle pin (educator)
discussionRouter.post('/:courseId/:discussionId/pin', pinDiscussion);

// ── Upvotes ─────────────────────────────────────────────────────────────────

// POST /api/discussion/:courseId/:discussionId/upvote          – upvote discussion
discussionRouter.post('/:courseId/:discussionId/upvote', upvoteDiscussion);

// POST /api/discussion/:courseId/:discussionId/reply/:replyId/upvote – upvote reply
discussionRouter.post('/:courseId/:discussionId/reply/:replyId/upvote', upvoteReply);

// ── Replies ─────────────────────────────────────────────────────────────────

// POST   /api/discussion/:courseId/:discussionId/reply          – add reply
discussionRouter.post('/:courseId/:discussionId/reply', addReply);

// DELETE /api/discussion/:courseId/:discussionId/reply/:replyId – delete reply
discussionRouter.delete('/:courseId/:discussionId/reply/:replyId', deleteReply);

// ── Sub-replies ─────────────────────────────────────────────────────────────

// POST   /api/discussion/:courseId/:discussionId/reply/:replyId/subreply              – add sub-reply
discussionRouter.post('/:courseId/:discussionId/reply/:replyId/subreply', addSubReply);

// DELETE /api/discussion/:courseId/:discussionId/reply/:replyId/subreply/:subReplyId  – delete sub-reply
discussionRouter.delete('/:courseId/:discussionId/reply/:replyId/subreply/:subReplyId', deleteSubReply);

export default discussionRouter;
