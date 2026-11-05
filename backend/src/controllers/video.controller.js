import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId, isPremium, isShort } = req.query

    const matchStage = {
        isPublished: true
    }

    // Strict separation: Premium section vs Normal Home feed
    if (isPremium === "true" || isPremium === true) {
        if (!req.user) {
            throw new ApiError(401, "Authentication required to access VIP Vault")
        }
        if (!req.user.isPremiumUnlocked) {
            throw new ApiError(403, "VIP Vault is locked. Please enter the VIP passcode to unlock.")
        }
        matchStage.isPremium = true
    } else {
        matchStage.isPremium = { $ne: true }
    }

    // isShort filter — strict separation: shorts vs regular videos
    if (isShort === "true" || isShort === true) {
        matchStage.isShort = true
    } else {
        matchStage.isShort = { $ne: true }
    }

    if (query) {
        matchStage.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ]
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user ID")
        }
        matchStage.owner = new mongoose.Types.ObjectId(userId)
    }

    const sortStage = {}
    sortStage[sortBy || "createdAt"] = sortType === "asc" ? 1 : -1

    const aggregate = Video.aggregate([
        { $match: matchStage },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    { $project: { username: 1, fullName: 1, avatar: 1 } }
                ]
            }
        },
        { $addFields: { owner: { $first: "$owner" } } },
        { $sort: sortStage }
    ])

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    }

    const videos = await Video.aggregatePaginate(aggregate, options)

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, tags, category, isPremium, isShort } = req.body || {}

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required")
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required")
    }
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required")
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!videoFile?.url) {
        throw new ApiError(500, "Failed to upload video file to storage")
    }
    if (!thumbnail?.url) {
        throw new ApiError(500, "Failed to upload thumbnail to storage")
    }

    let parsedTags = []
    if (Array.isArray(tags)) {
        parsedTags = tags.map((t) => String(t).trim()).filter(Boolean)
    } else if (typeof tags === "string") {
        parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean)
    }

    const video = await Video.create({
        title,
        description,
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        duration: videoFile.duration ?? 0,
        tags: parsedTags,
        category: typeof category === "string" ? category.trim() : "",
        isPremium: isPremium === "true" || isPremium === true,
        isShort: isShort === "true" || isShort === true,
        owner: req.user._id
    })

    const createdVideo = await Video.findById(video._id)

    if (!createdVideo) {
        throw new ApiError(500, "Something went wrong while publishing the video")
    }

    return res
        .status(201)
        .json(new ApiResponse(201, createdVideo, "Video published successfully"))
})


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } })

    if (req.user?._id) {
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { watchHistory: videoId }
        })
    }

    const video = await Video.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    { $project: { username: 1, fullName: 1, avatar: 1 } }
                ]
            }
        },
        { $addFields: { owner: { $first: "$owner" } } },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                realLikes: {
                    $filter: {
                        input: "$likes",
                        as: "l",
                        cond: { $ne: ["$$l.isDislike", true] }
                    }
                },
                realDislikes: {
                    $filter: {
                        input: "$likes",
                        as: "l",
                        cond: { $eq: ["$$l.isDislike", true] }
                    }
                }
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$realLikes" },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$realLikes.likedBy"] },
                        then: true,
                        else: false
                    }
                },
                isDisliked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$realDislikes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        { $project: { likes: 0, realLikes: 0, realDislikes: 0 } }
    ])

    if (!video?.length) {
        throw new ApiError(404, "Video not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video[0], "Video fetched successfully"))
})


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description, tags, category } = req.body || {}

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video")
    }

    const updateFields = {}
    if (title?.trim()) updateFields.title = title
    if (description?.trim()) updateFields.description = description
    if (category !== undefined && typeof category === "string") {
        updateFields.category = category.trim()
    }
    if (tags !== undefined) {
        if (Array.isArray(tags)) {
            updateFields.tags = tags.map((t) => String(t).trim()).filter(Boolean)
        } else if (typeof tags === "string") {
            updateFields.tags = tags.split(",").map((t) => t.trim()).filter(Boolean)
        }
    }

    const thumbnailLocalPath = req.file?.path

    if (thumbnailLocalPath) {
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

        if (!thumbnail) {
            throw new ApiError(500, "Failed to upload new thumbnail")
        }

        updateFields.thumbnail = thumbnail.url
    }

    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, "At least one field is required to update")
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateFields },
        { returnDocument: "after" }
    )

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video")
    }

    await Video.findByIdAndDelete(videoId)

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to change this video's publish status")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Publish status toggled successfully"))
})

const verifyPremiumCode = asyncHandler(async (req, res) => {
    const { code } = req.body || {}
    const validCode = (process.env.PREMIUM_SECRET_CODE || "0000").trim()

    if (!code || code.trim().toLowerCase() !== validCode.toLowerCase()) {
        throw new ApiError(401, "Invalid access code. Please enter the correct code to unlock.")
    }

    if (req.user?._id) {
        await User.findByIdAndUpdate(req.user._id, { isPremiumUnlocked: true })
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { unlocked: true }, "Premium unlocked successfully!"))
})

const moveToPremium = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { code } = req.body || {}

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID")
    }

    if (!req.user?._id) {
        throw new ApiError(401, "Authentication required")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    // Strictly video owner only
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized: Only the creator of this video can move it to the VIP Vault")
    }

    // Strictly re-verify VIP passcode
    const validCode = (process.env.PREMIUM_SECRET_CODE || "0000").trim()
    if (!code || code.trim().toLowerCase() !== validCode.toLowerCase()) {
        throw new ApiError(401, "Invalid VIP access code. Please enter the correct code to unlock.")
    }

    video.isPremium = true
    await video.save({ validateBeforeSave: false })

    if (req.user?._id) {
        await User.findByIdAndUpdate(req.user._id, { isPremiumUnlocked: true })
    }

    const updatedVideo = await Video.findById(video._id).populate("owner", "username fullName avatar")

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video successfully moved to VIP Vault!"))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    verifyPremiumCode,
    moveToPremium
}