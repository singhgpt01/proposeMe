import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Proposeme API")

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('models/gemini-flash-latest')

class GenerateRequest(BaseModel):
    prompt: str

@app.get("/")
async def root():
    return {"message": "Proposeme API is running (Gemini Edition)"}

@app.post("/api/generate")
async def generate_proposal(request: GenerateRequest, authorization: str = Header(None)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    try:
        # Generate content using Gemini
        response = model.generate_content(
            f"You are a professional proposal generator. Generate a structured, persuasive business proposal. DO NOT use markdown formatting (no asterisks, hash signs, or dashes for bold/headers). Use plain text only with clear, capitalized headings. Context: {request.prompt}"
        )
        
        if not response.text:
            raise HTTPException(status_code=500, detail="Gemini API returned empty response")
            
        return {"proposal": response.text}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
