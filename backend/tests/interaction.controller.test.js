import { test, describe } from "node:test"
import assert from "node:assert/strict"
import mongoose from "mongoose"
import { Interaction } from "../src/models/interaction.model.js"
import { Video } from "../src/models/video.model.js"
import {
    trackImpression,
    trackClick,
    trackWatch,
    trackSkip,
    trackSearch,
    trackBatch
} from "../src/controllers/interaction.controller.js"

describe("Interaction Controller Unit Tests", () => {
    test("trackImpression throws 400 for invalid videoId", async () => {
        const req = { body: { videoId: "invalid_id" }, sessionId: "sess-1" }
        const res = {}
        let caughtErr = null
        try {
            await trackImpression(req, res, (err) => { caughtErr = err })
        } catch (err) {
            caughtErr = err
        }
        assert.ok(caughtErr)
        assert.equal(caughtErr.statusCode, 400)
    })

    test("trackWatch throws 400 when watchDuration is not a number", async () => {
        const req = {
            body: { videoId: new mongoose.Types.ObjectId().toString(), watchDuration: "not_a_num" },
            sessionId: "sess-1"
        }
        let caughtErr = null
        try {
            await trackWatch(req, {}, (err) => { caughtErr = err })
        } catch (err) {
            caughtErr = err
        }
        assert.ok(caughtErr)
        assert.equal(caughtErr.statusCode, 400)
    })

    test("trackSearch throws 400 when searchQuery is empty", async () => {
        const req = { body: { searchQuery: "   " }, sessionId: "sess-1" }
        let caughtErr = null
        try {
            await trackSearch(req, {}, (err) => { caughtErr = err })
        } catch (err) {
            caughtErr = err
        }
        assert.ok(caughtErr)
        assert.equal(caughtErr.statusCode, 400)
    })

    test("trackBatch throws 400 when events is not an array or empty", async () => {
        const req = { body: { events: [] }, sessionId: "sess-1" }
        let caughtErr = null
        try {
            await trackBatch(req, {}, (err) => { caughtErr = err })
        } catch (err) {
            caughtErr = err
        }
        assert.ok(caughtErr)
        assert.equal(caughtErr.statusCode, 400)
    })
})
