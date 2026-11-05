import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
    verifyPremiumCode,
    moveToPremium,
} from "../controllers/video.controller.js"
import {verifyJWT, verifyJWTOptional} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"

const router = Router();

router
    .route("/")
    .get(verifyJWTOptional, getAllVideos)
    .post(
        verifyJWT,
        upload.fields([
            { name: "videoFile", maxCount: 1 },
            { name: "thumbnail", maxCount: 1 },
        ]),
        publishAVideo
    );

router.route("/verify-premium-code").post(verifyJWTOptional, verifyPremiumCode);

router.route("/:videoId/move-to-premium").post(verifyJWT, moveToPremium);

router
    .route("/:videoId")
    .get(verifyJWTOptional, getVideoById)
    .delete(verifyJWT, deleteVideo)
    .patch(verifyJWT, upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);

export default router