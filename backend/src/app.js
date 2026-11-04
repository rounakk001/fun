import "dotenv/config";
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { ApiError } from "./utils/ApiError.js"

const app = express()

console.log("CORS_ORIGIN =", process.env.CORS_ORIGIN);

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://13.235.77.209",
        "http://ec2-13-235-77-209.ap-south-1.compute.amazonaws.com"
    ],
    credentials: true
}));

//use is used when configuring middleware
app.use(express.json({limit: "16kb"})) 
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(express.static("public")) 
app.use(cookieParser())

//importing routes
import userRouter from './routes/user.routes.js'
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"
import interactionRouter from "./routes/interaction.routes.js"
import recommendationRouter from "./routes/recommendation.routes.js"

//routes declaration
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/users", userRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlists", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)
app.use("/api/v1/interactions", interactionRouter)
app.use("/api/v1/recommendations", recommendationRouter)
//the above line will be met first, which will lead request to api/v1/users (user router) -> this will further lead to respective controller

app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors,
            data: null
        })
    }

    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File size exceeds the 1GB limit. Please upload a smaller video.",
                errors: [err.message],
                data: null
            })
        }
        return res.status(400).json({
            success: false,
            message: err.message,
            errors: [err.code],
            data: null
        })
    }

    console.error(err) // unexpected errors — log for now
    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        data: null
    })
})

export { app }