import mongoose, { Schema } from "mongoose"

/**
 * Interaction — granular user-video event tracking for the recommendation engine.
 *
 * Every meaningful user action (impression, click, watch, like, dislike, skip, search)
 * is stored as a single document. The ML training pipeline reads these events to build
 * user-item interaction matrices for collaborative filtering, popularity scoring,
 * and engagement analysis.
 *
 * Design decisions:
 *   - userId is nullable: anonymous users are tracked via sessionId only.
 *   - videoId is nullable: "search" events don't reference a specific video.
 *   - Compound indexes are tuned for the three main query patterns:
 *       1. "Get all interactions for user X" (collaborative filtering)
 *       2. "Get all interactions for video Y" (popularity scoring)
 *       3. "Get all interactions of type Z in time range" (model training batches)
 *   - No TTL index — interaction history is valuable long-term. Archival is manual.
 */

const VALID_EVENT_TYPES = [
    "impression",  // video appeared in user's viewport
    "click",       // user clicked on a video card
    "watch",       // user watched a video (sent with duration data)
    "like",        // user liked a video (also stored in Like model for UI)
    "dislike",     // user disliked a video (also stored in Like model for UI)
    "skip",        // user navigated away within first few seconds
    "search"       // user submitted a search query
]

const VALID_SOURCES = [
    "home",        // home feed
    "similar",     // related videos sidebar on watch page
    "trending",    // trending section
    "search",      // search results page
    "channel",     // channel page
    "direct",      // direct URL / external link
    "history",     // watch history page
    "playlist"     // playlist page
]

const interactionSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },
        sessionId: {
            type: String,
            required: [true, "Session ID is required for interaction tracking"],
            index: true
        },
        videoId: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            default: null // null for search events
        },
        eventType: {
            type: String,
            required: true,
            enum: {
                values: VALID_EVENT_TYPES,
                message: "Event type must be one of: " + VALID_EVENT_TYPES.join(", ")
            }
        },

        // ── Watch-specific fields ──────────────────────────────
        watchDuration: {
            type: Number,
            default: null,
            min: 0
        },
        completionPct: {
            type: Number,
            default: null,
            min: 0,
            max: 100
        },

        // ── Search-specific fields ─────────────────────────────
        searchQuery: {
            type: String,
            default: null
        },
        resultCount: {
            type: Number,
            default: null,
            min: 0
        },

        // ── Context fields ─────────────────────────────────────
        source: {
            type: String,
            enum: {
                values: VALID_SOURCES,
                message: "Source must be one of: " + VALID_SOURCES.join(", ")
            },
            default: "direct"
        },
        position: {
            type: Number,
            default: null, // 0-indexed position in the list
            min: 0
        }
    },
    {
        timestamps: { createdAt: true, updatedAt: false } // we never update interactions
    }
)

// ── Compound Indexes ───────────────────────────────────────────
// Index 1: User's interactions with a specific video (dedup checks + user history)
interactionSchema.index(
    { userId: 1, videoId: 1, eventType: 1, createdAt: -1 },
    { name: "idx_user_video_event" }
)

// Index 2: All engagement for a video (popularity scoring)
interactionSchema.index(
    { videoId: 1, eventType: 1, createdAt: -1 },
    { name: "idx_video_event" }
)

// Index 3: All events of a type in time range (batch training data extraction)
interactionSchema.index(
    { eventType: 1, createdAt: -1 },
    { name: "idx_event_time" }
)

// Index 4: User's recent activity (collaborative filtering profile)
interactionSchema.index(
    { userId: 1, createdAt: -1 },
    { name: "idx_user_recent" }
)

// Index 5: Anonymous session history
interactionSchema.index(
    { sessionId: 1, createdAt: -1 },
    { name: "idx_session_recent" }
)

export const Interaction = mongoose.model("Interaction", interactionSchema)
export { VALID_EVENT_TYPES, VALID_SOURCES }
