import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
    DB_NAME: str = os.getenv("DB_NAME", "yt-database")
    PORT: int = int(os.getenv("PORT", "5000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # Model configuration
    MIN_INTERACTIONS_FOR_CF: int = 2
    GRAVITY_EXPONENT: float = 1.5
    DEFAULT_REC_LIMIT: int = 10
    MAX_REC_LIMIT: int = 50

settings = Settings()
