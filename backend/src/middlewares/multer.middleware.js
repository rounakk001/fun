import multer from "multer";
import fs from "fs";

const uploadDir = "./public/temp";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
      //original name is not recommended because it may overide filename if name kept same
      //consider change in future 
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
      cb(null, uniqueSuffix + "-" + file.originalname)
    }
  })
  
export const upload = multer({ 
    storage, 
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB (supports high-res / large video uploads)
})


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