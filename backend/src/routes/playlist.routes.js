import { Router } from 'express';
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
    setPlaylistCover
} from "../controllers/playlist.controller.js"
import {verifyJWT, verifyJWTOptional} from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/").post(verifyJWT, createPlaylist)

router
    .route("/:playlistId")
    .get(verifyJWTOptional, getPlaylistById)
    .patch(verifyJWT, updatePlaylist)
    .delete(verifyJWT, deletePlaylist);

router.route("/add/:videoId/:playlistId").patch(verifyJWT, addVideoToPlaylist);
router.route("/remove/:videoId/:playlistId").patch(verifyJWT, removeVideoFromPlaylist);
router.route("/cover/:videoId/:playlistId").patch(verifyJWT, setPlaylistCover);
router.route("/user/:userId").get(verifyJWTOptional, getUserPlaylists);

export default router