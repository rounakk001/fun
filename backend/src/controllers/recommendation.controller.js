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
