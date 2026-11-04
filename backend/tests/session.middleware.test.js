import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { resolveSession } from "../src/middlewares/session.middleware.js"

describe("Session Middleware", () => {
    test("uses X-Session-Id header if present", () => {
        let cookieSet = null
        const req = {
            header: (name) => (name.toLowerCase() === "x-session-id" ? "header-uuid-123" : null),
            cookies: {}
        }
        const res = {
            cookie: (name, val) => { cookieSet = { name, val } }
        }
        let nextCalled = false
        resolveSession(req, res, () => { nextCalled = true })

        assert.equal(nextCalled, true)
        assert.equal(req.sessionId, "header-uuid-123")
        assert.equal(cookieSet, null)
    })

    test("falls back to yeonix_session cookie if header is absent", () => {
        let cookieSet = null
        const req = {
            header: () => null,
            cookies: { yeonix_session: "cookie-uuid-456" }
        }
        const res = {
            cookie: (name, val) => { cookieSet = { name, val } }
        }
        let nextCalled = false
        resolveSession(req, res, () => { nextCalled = true })

        assert.equal(nextCalled, true)
        assert.equal(req.sessionId, "cookie-uuid-456")
        assert.equal(cookieSet, null)
    })

    test("generates new UUID and sets cookie if neither header nor cookie is present", () => {
        let cookieSet = null
        const req = {
            header: () => null,
            cookies: {}
        }
        const res = {
            cookie: (name, val, options) => { cookieSet = { name, val, options } }
        }
        let nextCalled = false
        resolveSession(req, res, () => { nextCalled = true })

        assert.equal(nextCalled, true)
        assert.ok(req.sessionId)
        assert.equal(typeof req.sessionId, "string")
        assert.equal(cookieSet.name, "yeonix_session")
        assert.equal(cookieSet.val, req.sessionId)
        assert.equal(cookieSet.options.httpOnly, true)
    })
})
