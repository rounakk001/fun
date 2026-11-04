import { Router } from "express"
import {
    trackImpression,
    trackClick,
    trackWatch,
    trackSkip,
    trackSearch,
    trackBatch
} from "../controllers/interaction.controller.js"
import { verifyJWTOptional } from "../middlewares/auth.middleware.js"
import { resolveSession } from "../middlewares/session.middleware.js"

const router = Router()

// All interaction routes use optional auth + session resolution.
// Authenticated users get userId populated; anonymous users get sessionId only.
router.use(verifyJWTOptional, resolveSession)

router.route("/impression").post(trackImpression)
router.route("/click").post(trackClick)
router.route("/watch").post(trackWatch)
router.route("/skip").post(trackSkip)
router.route("/search").post(trackSearch)
router.route("/batch").post(trackBatch)

export default router
