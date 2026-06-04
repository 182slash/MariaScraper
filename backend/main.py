import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Clinic Scraper API")

# CORS — update after first Vercel deploy with exact domain
origins = [
    "http://localhost:3000",
    "https://localhost:3000",
    "*",  # Replace with "https://your-app.vercel.app" in production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include your existing routes
from .routes import router
app.include_router(router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# DigitalOcean App Platform provides PORT env var
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)