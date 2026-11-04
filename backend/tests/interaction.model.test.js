import { test, describe } from "node:test"
import assert from "node:assert/strict"
import mongoose from "mongoose"
import { Interaction, VALID_EVENT_TYPES, VALID_SOURCES } from "../src/models/interaction.model.js"

describe("Interaction Model Schema", () => {
    test("defines all required event types", () => {
        const expectedTypes = ["impression", "click", "watch", "like", "dislike", "skip", "search"]
        for (const type of expectedTypes) {
            assert.ok(VALID_EVENT_TYPES.includes(type), `Expected VALID_EVENT_TYPES to contain ${type}`)
        }
    })

    test("defines all valid interaction sources", () => {
        const expectedSources = ["home", "similar", "trending", "search", "channel", "direct", "history", "playlist"]
        for (const source of expectedSources) {
            assert.ok(VALID_SOURCES.includes(source), `Expected VALID_SOURCES to contain ${source}`)
        }
    })

    test("fails validation when sessionId is missing", async () => {
        const interaction = new Interaction({
            eventType: "impression",
            videoId: new mongoose.Types.ObjectId()
        })
        let err
        try {
            await interaction.validate()
        } catch (e) {
            err = e
        }
        assert.ok(err, "Validation should fail without sessionId")
        assert.ok(err.errors.sessionId)
    })

    test("fails validation with invalid eventType", async () => {
        const interaction = new Interaction({
            sessionId: "test-session",
            eventType: "invalid_type",
            videoId: new mongoose.Types.ObjectId()
        })
        let err
        try {
            await interaction.validate()
        } catch (e) {
            err = e
        }
        assert.ok(err, "Validation should fail with invalid eventType")
        assert.ok(err.errors.eventType)
    })

    test("fails validation when completionPct exceeds 100 or is negative", async () => {
        const interactionHigh = new Interaction({
            sessionId: "test-session",
            eventType: "watch",
            videoId: new mongoose.Types.ObjectId(),
            completionPct: 150
        })
        let errHigh
        try {
            await interactionHigh.validate()
        } catch (e) {
            errHigh = e
        }
        assert.ok(errHigh?.errors.completionPct, "completionPct > 100 should be rejected")

        const interactionLow = new Interaction({
            sessionId: "test-session",
            eventType: "watch",
            videoId: new mongoose.Types.ObjectId(),
            completionPct: -5
        })
        let errLow
        try {
            await interactionLow.validate()
        } catch (e) {
            errLow = e
        }
        assert.ok(errLow?.errors.completionPct, "completionPct < 0 should be rejected")
    })

    test("validates successfully for valid search event without videoId", async () => {
        const interaction = new Interaction({
            sessionId: "test-session",
            eventType: "search",
            searchQuery: "machine learning tutorial",
            resultCount: 15,
            source: "search"
        })
        let err
        try {
            await interaction.validate()
        } catch (e) {
            err = e
        }
        assert.equal(err, undefined)
    })
})
