import mongoose, { isValidObjectId } from "mongoose"
import { Interaction, VALID_EVENT_TYPES, VALID_SOURCES } from "../models/interaction.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

/**
 * Interaction controller — ingests user-video interaction events for the
 * recommendation engine. All endpoints use verifyJWTOptional + resolveSession,
 * so both authenticated and anonymous interactions are captured.
 *
 * Design principles:
 *   - Never block the user's experience on a tracking failure
 *   - Validate inputs but be lenient (drop bad events silently when appropriate)
 *   - Deduplicate impressions to avoid inflating metrics
 *   - Accept all watch events (ML uses max completion per user-video pair)
 */

// ── Impression dedup window (milliseconds) ──────────────────────
const IMPRESSION_DEDUP_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Helper: build the identifier object for dedup queries.
 * Uses userId if authenticated, otherwise sessionId.
 */
const buildIdentifier = (req) => {
    const identifier = { sessionId: req.sessionId }
    if (req.user?._id) {
        identifier.userId = req.user._id
    }
    return identifier
}

/**
 * POST /interactions/impression
 *
 * Body: { videoId, source?, position? }
 *
 * Tracks that a video appeared in the user's viewport. Deduplicated:
 * at most 1 impression per (user/session, video) per 30 minutes.
 */
const trackImpression = asyncHandler(async (req, res) => {
    const { videoId, source, position } = req.body || {}

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Valid videoId is required")
    }

    const identifier = buildIdentifier(req)

    // Dedup check: was this video already impressed for this user/session recently?
    const dedupCutoff = new Date(Date.now() - IMPRESSION_DEDUP_MS)
    const existing = await Interaction.findOne({
        ...identifier,
        videoId,
        eventType: "impression",
        createdAt: { $gte: dedupCutoff }
    }).lean()

    if (existing) {
        // Already tracked recently — respond success without creating a duplicate
        return res
            .status(200)
            .json(new ApiResponse(200, { deduplicated: true }, "Impression already tracked"))
    }

    await Interaction.create({
        userId: req.user?._id || null,
        sessionId: req.sessionId,
        videoId,
        eventType: "impression",
        source: VALID_SOURCES.includes(source) ? source : "direct",
        position: typeof position === "number" && position >= 0 ? Math.floor(position) : null
    })

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Impression tracked"))
})

/**
 * POST /interactions/click
 *
 * Body: { videoId, source?, position? }
 *
 * Tracks that the user clicked on a video card. No deduplication —
 * every click is a meaningful signal.
 */
const trackClick = asyncHandler(async (req, res) => {
    const { videoId, source, position } = req.body || {}

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Valid videoId is required")
    }

    await Interaction.create({
        userId: req.user?._id || null,
        sessionId: req.sessionId,
        videoId,
        eventType: "click",
        source: VALID_SOURCES.includes(source) ? source : "direct",
        position: typeof position === "number" && position >= 0 ? Math.floor(position) : null
    })

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Click tracked"))
})

/**
 * POST /interactions/watch
 *
 * Body: { videoId, watchDuration, source? }
 *
 * Tracks watch progress. Called periodically by the frontend (e.g., every 30s)
 * and on video pause/end/navigate-away. The ML pipeline uses the maximum
 * completionPct per (user, video) pair, so sending multiple updates is fine.
 *
 * completionPct is computed server-side from watchDuration and video.duration
 * to prevent client-side manipulation.
 */
const trackWatch = asyncHandler(async (req, res) => {
    const { videoId, watchDuration, source } = req.body || {}

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Valid videoId is required")
    }

    if (typeof watchDuration !== "number" || watchDuration < 0) {
        throw new ApiError(400, "watchDuration must be a non-negative number")
    }

    // Look up video duration for server-side completion calculation
    const video = await Video.findById(videoId).select("duration").lean()

    let completionPct = null
    if (video?.duration && video.duration > 0) {
        completionPct = Math.min(100, Math.round((watchDuration / video.duration) * 100))
    }

    await Interaction.create({
        userId: req.user?._id || null,
        sessionId: req.sessionId,
        videoId,
        eventType: "watch",
        watchDuration: Math.round(watchDuration),
        completionPct,
        source: VALID_SOURCES.includes(source) ? source : "direct"
    })

    return res
        .status(201)
        .json(new ApiResponse(201, { completionPct }, "Watch progress tracked"))
})

/**
 * POST /interactions/skip
 *
 * Body: { videoId, watchDuration?, source? }
 *
 * Tracks that the user navigated away from a video very quickly (< 10s).
 * This is a negative signal for the recommendation engine.
 */
const trackSkip = asyncHandler(async (req, res) => {
    const { videoId, watchDuration, source } = req.body || {}

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Valid videoId is required")
    }

    await Interaction.create({
        userId: req.user?._id || null,
        sessionId: req.sessionId,
        videoId,
        eventType: "skip",
        watchDuration: typeof watchDuration === "number" ? Math.max(0, Math.round(watchDuration)) : null,
        source: VALID_SOURCES.includes(source) ? source : "direct"
    })

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Skip tracked"))
})

/**
 * POST /interactions/search
 *
 * Body: { searchQuery, resultCount? }
 *
 * Tracks that the user submitted a search query. videoId is null for search events.
 */
const trackSearch = asyncHandler(async (req, res) => {
    const { searchQuery, resultCount } = req.body || {}

    if (!searchQuery || typeof searchQuery !== "string" || !searchQuery.trim()) {
        throw new ApiError(400, "searchQuery is required")
    }

    await Interaction.create({
        userId: req.user?._id || null,
        sessionId: req.sessionId,
        videoId: null,
        eventType: "search",
        searchQuery: searchQuery.trim().slice(0, 500), // cap length
        resultCount: typeof resultCount === "number" && resultCount >= 0 ? resultCount : null,
        source: "search"
    })

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Search query tracked"))
})

/**
 * POST /interactions/batch
 *
 * Body: { events: [{ eventType, videoId?, source?, position?, watchDuration?, searchQuery?, resultCount? }] }
 *
 * Batch endpoint for sending multiple interaction events in a single request.
 * Useful for flushing queued impressions when the user navigates away.
 * Invalid individual events are silently skipped (partial success).
 */
const trackBatch = asyncHandler(async (req, res) => {
    const { events } = req.body || {}

    if (!Array.isArray(events) || events.length === 0) {
        throw new ApiError(400, "events must be a non-empty array")
    }

    // Cap at 50 events per batch to prevent abuse
    const capped = events.slice(0, 50)

    const docs = []
    for (const event of capped) {
        // Skip invalid events silently
        if (!event.eventType || !VALID_EVENT_TYPES.includes(event.eventType)) continue
        if (event.eventType !== "search" && (!event.videoId || !isValidObjectId(event.videoId))) continue
        if (event.eventType === "search" && (!event.searchQuery || !event.searchQuery.trim())) continue

        docs.push({
            userId: req.user?._id || null,
            sessionId: req.sessionId,
            videoId: event.videoId || null,
            eventType: event.eventType,
            watchDuration: typeof event.watchDuration === "number" ? Math.max(0, Math.round(event.watchDuration)) : null,
            completionPct: null, // batch does not compute completion (use individual /watch for that)
            searchQuery: event.searchQuery ? String(event.searchQuery).trim().slice(0, 500) : null,
            resultCount: typeof event.resultCount === "number" ? event.resultCount : null,
            source: VALID_SOURCES.includes(event.source) ? event.source : "direct",
            position: typeof event.position === "number" && event.position >= 0 ? Math.floor(event.position) : null
        })
    }

    if (docs.length > 0) {
        await Interaction.insertMany(docs, { ordered: false })
    }

    return res
        .status(201)
        .json(new ApiResponse(201, { tracked: docs.length, dropped: capped.length - docs.length }, "Batch tracked"))
})

export {
    trackImpression,
    trackClick,
    trackWatch,
    trackSkip,
    trackSearch,
    trackBatch
}
