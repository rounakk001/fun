import multer from "multer";
import fs from "fs";
import path from "path";

const getUploadDir = () => {
    if (process.env.UPLOAD_DIR) {
        const p = path.join(process.env.UPLOAD_DIR, "temp");
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        return p;
    }
    if (fs.existsSync("/home/ubuntu/yeonix-uploads")) {
        const p = "/home/ubuntu/yeonix-uploads/temp";
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        return p;
    }
    const p = "./public/temp";
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return p;
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const dir = getUploadDir();
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"));
    }
});
  
export const upload = multer({ 
    storage, 
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB (supports high-res / large video uploads)
});


/* 

Frontend
    ↓
avatar.png
    ↓
Route
    ↓
Multer Middleware
    ↓
public/temp/avatar.png
    ↓
Controller
    ↓
uploadOnCloudinary()
    ↓
Cloudinary
    ↓
Returns URL
    ↓
Delete temp file
    ↓
MongoDB stores URL

*/