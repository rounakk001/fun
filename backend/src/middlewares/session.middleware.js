import crypto from "crypto"

/**
 * Session middleware — ensures every request has a sessionId.
 *
 * Resolution order:
 *   1. X-Session-Id header   (frontend-generated UUID stored in localStorage)
 *   2. yeonix_session cookie (server-generated fallback for header-less clients)
 *   3. Fresh UUID            (generated on the spot, set as cookie for future requests)
 *
 * After this middleware runs, `req.sessionId` is always a non-empty string.
 * Authenticated requests also have `req.user._id` from verifyJWTOptional,
 * but sessionId is always present regardless of auth state.
 */
export const resolveSession = (req, res, next) => {
    // Priority 1: frontend-supplied header
    let sessionId = req.header("X-Session-Id")

    // Priority 2: existing cookie
    if (!sessionId) {
        sessionId = req.cookies?.yeonix_session
    }

    // Priority 3: generate a new one and set it as a cookie
    if (!sessionId) {
        sessionId = crypto.randomUUID()
        res.cookie("yeonix_session", sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        })
    }

    req.sessionId = sessionId
    next()
}
