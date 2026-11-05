import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFilePromise = promisify(execFile);

/**
 * Detect media resource type from file extension
 */
const detectResourceType = (filePath) => {
    const ext = String(filePath).split(".").pop().toLowerCase();
    if (["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"].includes(ext)) {
        return "videos";
    }
    if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(ext)) {
        return "images";
    }
    return "others";
};

/**
 * Extract video duration (in seconds) via ffprobe if available
 */
const getVideoDuration = async (filePath) => {
    try {
        const { stdout } = await execFilePromise("ffprobe", [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            filePath
        ], { timeout: 15000 });
        const dur = parseFloat(stdout.trim());
        return isNaN(dur) ? 0 : Math.round(dur * 100) / 100;
    } catch {
        return 0;
    }
};

/**
 * Base URL for public media delivery
 */
const getBaseUrl = () => {
    if (process.env.PUBLIC_MEDIA_URL) {
        return process.env.PUBLIC_MEDIA_URL.replace(/\/+$/, "");
    }
    if (process.env.NODE_ENV === "production" || fs.existsSync("/home/ubuntu/yeonix-uploads")) {
        return "https://yeonix.duckdns.org/uploads";
    }
    const port = process.env.PORT || 8000;
    return `http://localhost:${port}/uploads`;
};

/**
 * Storage root directory on local disk or EC2
 */
const getStorageDir = (subDir = "") => {
    let baseDir = process.env.UPLOAD_DIR;
    if (!baseDir) {
        baseDir = fs.existsSync("/home/ubuntu/yeonix-uploads")
            ? "/home/ubuntu/yeonix-uploads"
            : "./public/uploads";
    }
    const fullPath = subDir ? path.join(baseDir, subDir) : baseDir;
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
};

/**
 * Upload & store media file permanently on self-hosted storage.
 * Completely free, zero third-party bans, supports legal adult media,
 * streams directly via Nginx byte-range requests.
 *
 * @param {string} localFilePath - Path of temp file uploaded by Multer
 * @returns {Promise<{ url: string, duration: number } | null>}
 */
const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath || !fs.existsSync(localFilePath)) {
        return null;
    }

    try {
        const subDir = detectResourceType(localFilePath);
        const targetDir = getStorageDir(subDir);

        const originalName = path.basename(localFilePath);
        const ext = path.extname(originalName) || "";
        const cleanName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${cleanName}${ext}`;
        const destPath = path.join(targetDir, uniqueFileName);

        // Move file directly to permanent storage (instant 0ms pointer move on same disk)
        try {
            await fs.promises.rename(localFilePath, destPath);
        } catch (renameErr) {
            // Fallback for cross-device mount (EXDEV): stream copy without blocking Node event loop
            await new Promise((resolve, reject) => {
                const rs = fs.createReadStream(localFilePath);
                const ws = fs.createWriteStream(destPath);
                rs.on("error", reject);
                ws.on("error", reject);
                ws.on("finish", () => {
                    fs.unlink(localFilePath, () => {});
                    resolve();
                });
                rs.pipe(ws);
            });
        }

        // Extract video duration if it's a video file
        let duration = 0;
        if (subDir === "videos") {
            duration = await getVideoDuration(destPath);
        }

        // Clean up temp file if still present
        if (fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch {
                // Ignore unlink errors
            }
        }

        const baseUrl = getBaseUrl();
        const publicUrl = `${baseUrl}/${subDir}/${uniqueFileName}`;

        return {
            url: publicUrl,
            duration: duration || 0
        };
    } catch (error) {
        console.error("[Storage] Failed to store media:", error.message || error);
        if (fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch {
                // Ignore
            }
        }
        return null;
    }
};

export { uploadOnCloudinary, uploadOnCloudinary as uploadMedia };
