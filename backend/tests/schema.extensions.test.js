import { test, describe } from "node:test"
import assert from "node:assert/strict"
import mongoose from "mongoose"
import { Video } from "../src/models/video.model.js"
import { Like } from "../src/models/like.model.js"

describe("Video Schema Extensions", () => {
    test("has tags and category fields with defaults", () => {
        const video = new Video({
            title: "Test Video",
            description: "Test Description",
            videoFile: "http://example.com/video.mp4",
            thumbnail: "http://example.com/thumb.jpg",
            duration: 120,
            owner: new mongoose.Types.ObjectId()
        })

        assert.ok(Array.isArray(video.tags))
        assert.equal(video.tags.length, 0)
        assert.equal(video.category, "")
    })

    test("accepts custom tags and category", () => {
        const video = new Video({
            title: "ML in Production",
            description: "Building scalable recommendation systems",
            videoFile: "http://example.com/video.mp4",
            thumbnail: "http://example.com/thumb.jpg",
            duration: 360,
            tags: ["ml", "recommendation", "fastapi"],
            category: "Technology",
            owner: new mongoose.Types.ObjectId()
        })

        assert.equal(video.tags.length, 3)
        assert.deepEqual(video.tags, ["ml", "recommendation", "fastapi"])
        assert.equal(video.category, "Technology")
    })
})

describe("Like Schema Extensions", () => {
    test("has isDislike field defaulting to false", () => {
        const like = new Like({
            video: new mongoose.Types.ObjectId(),
            likedBy: new mongoose.Types.ObjectId()
        })

        assert.equal(like.isDislike, false)
    })

    test("allows setting isDislike to true", () => {
        const dislike = new Like({
            video: new mongoose.Types.ObjectId(),
            likedBy: new mongoose.Types.ObjectId(),
            isDislike: true
        })

        assert.equal(dislike.isDislike, true)
    })
})
