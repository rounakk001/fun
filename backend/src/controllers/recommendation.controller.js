import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js";
import { mlClient } from "../utils/mlClient.js";

/**
 * Helper to hydrate an array of { video_id, score, ... } items from ML into full Video docs,
 * preserving the exact ranking order returned by the ML model.
 *
 * @param {Array}   recItems  - Array of { video_id, score, algorithm } from ML service
 * @param {string}  excludeId - videoId to exclude (the currently-playing video)
 * @param {boolean} isPremium - true  → only return premium videos
 *                              false → only return non-premium videos (default)
 */
async function hydrateRecommendations(recItems, excludeId = null, isPremium = false) {
  if (!recItems || recItems.length === 0) return [];

  const rawIds = recItems.map((r) => r.video_id).filter((id) => id !== excludeId);
  const objectIds = rawIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) return [];

  // Strict separation: premium watch page only gets premium, normal gets non-premium
  const premiumFilter = isPremium ? { isPremium: true } : { isPremium: { $ne: true } };

  const videos = await Video.find({
    _id: { $in: objectIds },
    isPublished: true,
    isShort: { $ne: true },
    ...premiumFilter
  }).populate("owner", "fullName username avatar");

  const videoMap = new Map(videos.map((v) => [v._id.toString(), v]));

  // Re-order strictly according to ML model's ranking
  const ranked = [];
  for (const item of recItems) {
    const doc = videoMap.get(item.video_id);
    if (doc) {
      const plainDoc = doc.toObject();
      plainDoc.recommendationScore = item.score;
      plainDoc.recommendationAlgorithm = item.algorithm;
      ranked.push(plainDoc);
    }
  }

  return ranked;
}

/**
 * Fallback: Get recent published videos directly from MongoDB.
 *
 * @param {number}  limit     - Max videos to return
 * @param {string}  excludeId - videoId to exclude
 * @param {boolean} isPremium - true → premium only, false → non-premium only
 */
async function getFallbackVideos(limit = 10, excludeId = null, isPremium = false) {
  const premiumFilter = isPremium ? { isPremium: true } : { isPremium: { $ne: true } };
  const query = { isPublished: true, isShort: { $ne: true }, ...premiumFilter };
  if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }

  return await Video.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("owner", "fullName username avatar");
}

export const getSimilarVideos = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const userId = req.user?._id?.toString() || null;

  // isPremium=true → watch page is in premium context, only recommend premium videos
  // isPremium=false/absent → normal watch page, only recommend non-premium videos
  const isPremium = req.query.isPremium === "true";

  // 1. Query ML recommendation service
  const mlRes = await mlClient.getSimilarVideos(videoId, userId, limit);

  let recommendations = [];
  let strategy = "mongodb_fallback";

  if (mlRes && mlRes.recommendations && mlRes.recommendations.length > 0) {
    recommendations = await hydrateRecommendations(mlRes.recommendations, videoId, isPremium);
    strategy = mlRes.strategy || "hybrid_ml";
  }

  // 2. If ML service gave fewer than requested or failed, backfill with fallback
  if (recommendations.length < limit) {
    const existingIds = new Set(recommendations.map((v) => v._id.toString()));
    existingIds.add(videoId);

    const fallbacks = await getFallbackVideos(limit, videoId, isPremium);
    for (const f of fallbacks) {
      if (!existingIds.has(f._id.toString()) && recommendations.length < limit) {
        recommendations.push(f);
      }
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        recommendations,
        total: recommendations.length,
        strategy
      },
      "Similar video recommendations fetched successfully"
    )
  );
});

export const getHomeFeed = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const userId = req.user?._id?.toString() || null;
  const lastWatchedId = req.query.lastWatchedVideoId || null;

  // 1. Query ML recommendation service
  const mlRes = await mlClient.getHomeRecommendations(userId, limit, lastWatchedId);

  let recommendations = [];
  let strategy = "mongodb_fallback";

  if (mlRes && mlRes.recommendations && mlRes.recommendations.length > 0) {
    recommendations = await hydrateRecommendations(mlRes.recommendations);
    strategy = mlRes.strategy || "hybrid_ml";
  }

  // 2. If ML service returned no items or fewer, backfill
  if (recommendations.length < limit) {
    const existingIds = new Set(recommendations.map((v) => v._id.toString()));
    const fallbacks = await getFallbackVideos(limit);
    for (const f of fallbacks) {
      if (!existingIds.has(f._id.toString()) && recommendations.length < limit) {
        recommendations.push(f);
      }
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        recommendations,
        total: recommendations.length,
        strategy
      },
      "Home feed recommendations fetched successfully"
    )
  );
});

export const getTrendingFeed = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  const mlRes = await mlClient.getTrendingVideos(limit);

  let recommendations = [];
  let strategy = "mongodb_fallback";

  if (mlRes && mlRes.recommendations && mlRes.recommendations.length > 0) {
    recommendations = await hydrateRecommendations(mlRes.recommendations);
    strategy = "time_decay_trending";
  } else {
    recommendations = await getFallbackVideos(limit);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        recommendations,
        total: recommendations.length,
        strategy
      },
      "Trending recommendations fetched successfully"
    )
  );
});

export const getShortsFeed = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const isPremium = req.query.isPremium === "true" || req.query.isPremium === true;
  const excludeIdsParam = req.query.excludeIds || "";

  if (isPremium) {
    if (!req.user) {
      throw new ApiError(401, "Authentication required to access VIP Vault");
    }
    if (!req.user.isPremiumUnlocked) {
      throw new ApiError(403, "VIP Vault is locked. Please enter the VIP passcode to unlock.");
    }
  }

  const premiumFilter = isPremium ? { isPremium: true } : { isPremium: { $ne: true } };

  // Parse excluded IDs to seamlessly stream next latest shorts while scrolling
  const rawList = Array.isArray(excludeIdsParam)
    ? excludeIdsParam
    : typeof excludeIdsParam === "string"
    ? excludeIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const excludeObjectIds = rawList
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const query = {
    isPublished: true,
    isShort: true,
    ...premiumFilter
  };

  if (excludeObjectIds.length > 0) {
    query._id = { $nin: excludeObjectIds };
  }

  // Strict latest first: newest createdAt first
  const shorts = await Video.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("owner", "fullName username avatar");

  // Enrich with likesCount, isLiked, isDisliked, commentsCount, isSubscribed
  const userObjectId = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null;
  const enrichedShorts = await Promise.all(
    shorts.map(async (doc) => {
      const shortObj = doc.toObject();

      const [likes, commentsCount, subscription] = await Promise.all([
        import("../models/like.model.js").then(({ Like }) =>
          Like.find({ video: doc._id })
        ),
        import("../models/comment.model.js").then(({ Comment }) =>
          Comment.countDocuments({ video: doc._id })
        ),
        userObjectId && doc.owner?._id
          ? import("../models/subscription.model.js").then(({ Subscription }) =>
              Subscription.findOne({ channel: doc.owner._id, subscriber: userObjectId })
            )
          : Promise.resolve(null)
      ]);

      const realLikes = likes.filter((l) => !l.isDislike);
      const realDislikes = likes.filter((l) => l.isDislike);

      shortObj.likesCount = realLikes.length;
      shortObj.commentsCount = commentsCount;
      shortObj.isLiked = userObjectId
        ? realLikes.some((l) => l.likedBy?.toString() === userObjectId.toString())
        : false;
      shortObj.isDisliked = userObjectId
        ? realDislikes.some((l) => l.likedBy?.toString() === userObjectId.toString())
        : false;
      shortObj.isSubscribed = Boolean(subscription);

      return shortObj;
    })
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        shorts: enrichedShorts,
        total: enrichedShorts.length,
        strategy: "latest_chronological"
      },
      "Latest shorts feed fetched successfully"
    )
  );
});
