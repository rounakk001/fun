import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
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
  const userId = req.user?._id?.toString() || null;
  const isPremium = req.query.isPremium === "true" || req.query.isPremium === true;
  const currentShortId = req.query.currentShortId || null;

  const premiumFilter = isPremium ? { isPremium: true } : { isPremium: { $ne: true } };

  let recVideoIds = [];
  let strategy = "mongodb_fallback";

  if (currentShortId) {
    // 1. Query ML recommendation service for similar relatable shorts
    const mlRes = await mlClient.getSimilarVideos(currentShortId, userId, limit);
    if (mlRes && mlRes.recommendations && mlRes.recommendations.length > 0) {
      recVideoIds = mlRes.recommendations
        .map((r) => r.video_id)
        .filter((id) => id !== currentShortId && mongoose.Types.ObjectId.isValid(id));
      strategy = mlRes.strategy || "hybrid_ml";
    }
  } else {
    // Initial feed: query home recommendation from ML
    const mlRes = await mlClient.getHomeRecommendations(userId, limit);
    if (mlRes && mlRes.recommendations && mlRes.recommendations.length > 0) {
      recVideoIds = mlRes.recommendations
        .map((r) => r.video_id)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      strategy = mlRes.strategy || "hybrid_ml";
    }
  }

  // Hydrate from MongoDB with isShort: true and strict premiumFilter
  const objectIds = recVideoIds.map((id) => new mongoose.Types.ObjectId(id));
  let shorts = [];

  if (objectIds.length > 0) {
    const found = await Video.find({
      _id: { $in: objectIds },
      isPublished: true,
      isShort: true,
      ...premiumFilter
    }).populate("owner", "fullName username avatar");

    const foundMap = new Map(found.map((v) => [v._id.toString(), v]));
    for (const idStr of recVideoIds) {
      if (foundMap.has(idStr)) {
        shorts.push(foundMap.get(idStr));
      }
    }
  }

  // Backfill if fewer than limit
  if (shorts.length < limit) {
    const existingIds = new Set(shorts.map((s) => s._id.toString()));
    if (currentShortId) existingIds.add(currentShortId);

    const query = {
      isPublished: true,
      isShort: true,
      _id: { $nin: Array.from(existingIds).map((id) => new mongoose.Types.ObjectId(id)) },
      ...premiumFilter
    };

    const fallbackShorts = await Video.find(query)
      .sort({ createdAt: -1 })
      .limit(limit - shorts.length)
      .populate("owner", "fullName username avatar");

    shorts = [...shorts, ...fallbackShorts];
  }

  // Enrich with likesCount, isLiked, isDisliked, commentsCount
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
        strategy
      },
      "Shorts feed fetched successfully"
    )
  );
});
