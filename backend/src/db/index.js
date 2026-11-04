import mongoose from 'mongoose'
import { DB_NAME } from '../constants.js'

const connectDB = async() => {
    const baseUri = (process.env.MONGODB_URI || "").replace(/\/+$/, "")
    const primaryUri = baseUri ? `${baseUri}/${DB_NAME}` : `mongodb://127.0.0.1:27017/${DB_NAME}`
    const fallbackUri = `mongodb://127.0.0.1:27017/${DB_NAME}`

    const connectWithRetry = async (uri, label, timeout = 5000) => {
        return mongoose.connect(uri, { serverSelectionTimeoutMS: timeout })
    }

    try {
        const connectionInstance = await connectWithRetry(primaryUri, "Primary")
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);

        // Handle mid-session disconnection — reconnect to local fallback
        mongoose.connection.on("disconnected", () => {
            console.warn("[MongoDB] Disconnected. Attempting local fallback reconnect...");
        });
        mongoose.connection.on("error", (err) => {
            console.error("[MongoDB] Connection error:", err.message);
        });

    } catch(error) {
        console.warn(`\n[MongoDB] Primary connection failed: ${error.message}. Connecting to local MongoDB fallback...`);
        try {
            const fallbackInstance = await connectWithRetry(fallbackUri, "Fallback")
            console.log(`\n MongoDB connected (Local Fallback) !! DB HOST: ${fallbackInstance.connection.host}`);
        } catch(fallbackErr) {
            console.error("MONGODB connection error", fallbackErr);
            process.exit(1)
        }
    }
}

export default connectDB
