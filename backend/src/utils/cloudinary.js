import {v2 as cloudinary} from "cloudinary"
import fs from "fs"


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});
 
const detectResourceType = (filePath) => {
    const ext = String(filePath).split(".").pop().toLowerCase();
    if (["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"].includes(ext)) {
        return "video";
    }
    if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(ext)) {
        return "image";
    }
    return "auto";
};

const uploadLargePromise = (filePath, options) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(filePath, options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
    });
};

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        const fileStats = fs.existsSync(localFilePath) ? fs.statSync(localFilePath) : null;
        const isLarge = fileStats && fileStats.size > 80 * 1024 * 1024; // > 80MB
        const detectedType = detectResourceType(localFilePath);

        // Upload to Cloudinary (using chunked upload_large for files > 80MB)
        let response;
        if (isLarge) {
            response = await uploadLargePromise(localFilePath, {
                resource_type: detectedType === "auto" ? "video" : detectedType,
                chunk_size: 6 * 1024 * 1024 // 6MB chunk size
            });
        } else {
            response = await cloudinary.uploader.upload(localFilePath, {
                resource_type: "auto"
            });
        }

        if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);

        if (!response || (!response.secure_url && !response.url)) {
            throw new Error("Cloudinary response missing URL");
        }

        return {
            ...response,
            url: response.secure_url || response.url,
            duration: response.duration || 0
        };

    } catch (error) {
        console.error("Cloudinary upload failed, using local storage fallback:", error.message || error);
        try {
            const uploadsDir = "./public/uploads";
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const pathParts = localFilePath.split(/[\\/]/);
            const fileName = pathParts[pathParts.length - 1];
            const destPath = `${uploadsDir}/${fileName}`;
            fs.copyFileSync(localFilePath, destPath);
            if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
            const port = process.env.PORT || 8000;
            return {
                url: `http://localhost:${port}/uploads/${fileName}`,
                duration: 0
            };
        } catch (fallbackError) {
            if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
            return null;
        }
    }
}



export {uploadOnCloudinary}


/* 

Multer = Gets file from client

Cloudinary = Stores file permanently

MongoDB = Stores Cloudinary URL

*/