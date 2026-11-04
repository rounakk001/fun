import { Router } from "express";
import {
  getSimilarVideos,
  getHomeFeed,
  getTrendingFeed
} from "../controllers/recommendation.controller.js";
import { verifyJWTOptional } from "../middlewares/auth.middleware.js";

const router = Router();

// All recommendation routes allow optional authentication (personalizes when logged in, graceful fallback when anonymous)
router.route("/similar/:videoId").get(verifyJWTOptional, getSimilarVideos);
router.route("/home").get(verifyJWTOptional, getHomeFeed);
router.route("/trending").get(verifyJWTOptional, getTrendingFeed);

export default router;
