import os
import json
import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

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

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-flash-latest"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

class GenerateRequest(BaseModel):
    title: str
    client_name: str
    proposal_type: str
    description: str
    deliverables: Optional[str] = ""
    timeline: Optional[str] = ""
    budget: Optional[str] = ""
    additional_notes: Optional[str] = ""
    tone: Optional[str] = "Professional"

class RegenerateRequest(BaseModel):
    prompt: str

def build_dynamic_prompt(data: GenerateRequest) -> str:
    # Base instructions
    prompt = f"""
    You are an expert business proposal writer specializing in {data.proposal_type} proposals.
    Generate a high-end, persuasive business proposal for a project titled '{data.title}' for client '{data.client_name}'.
    
    TONE: {data.tone}
    
    PROJECT CONTEXT:
    {data.description}
    
    DELIVERABLES:
    {data.deliverables}
    
    TIMELINE:
    {data.timeline}
    
    BUDGET:
    {data.budget}
    
    NOTES:
    {data.additional_notes}
    """

    # Industry-specific additions
    if data.proposal_type == "Architecture":
        prompt += "\nInclude specialized sections: 'Design Concept', 'Site Analysis', 'Material Suggestions'."
    elif data.proposal_type == "Freelance":
        prompt += "\nFocus on milestones, communication workflow, and specific deliverables."
    elif data.proposal_type == "Web Development":
        prompt += "\nInclude technical stack recommendations, responsive design approach, and post-launch support."
    elif data.proposal_type == "Digital Marketing":
        prompt += "\nInclude KPI targets, channel strategy, and reporting frequency."
    
    # Conditional tuning
    if data.budget:
        prompt += "\nProvide a detailed pricing justification based on the budget provided."
    if "urgent" in data.timeline.lower() or "fast" in data.timeline.lower():
        prompt += "\nEmphasize efficiency and rapid delivery in the project understanding."

    prompt += """
    OUTPUT FORMAT:
    Return a JSON object with the following structure. Each section should be a string.
    Do NOT use markdown (no **, #, etc.) inside the strings.
    
    {
      "introduction": "...",
      "project_understanding": "...",
      "solution": "...",
      "scope": "...",
      "timeline": "...",
      "pricing": "...",
      "terms": "...",
      "closing": "..."
    }
    
    If the proposal type is 'Architecture', replace 'solution' with 'design_concept' and add 'site_analysis'.
    Adjust sections dynamically based on the industry while keeping the overall JSON structure.
    """
    
    return prompt

@app.get("/")
async def root():
    return {"message": "Proposeme API is running (Gemini 1.5 Flash JSON Edition)"}

@app.post("/api/generate")
async def generate_proposal(request: GenerateRequest, authorization: str = Header(None)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    try:
        prompt = build_dynamic_prompt(request)
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "response_mime_type": "application/json"
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                GEMINI_ENDPOINT,
                json=payload,
                headers=headers,
                timeout=60.0
            )
            
            if response.status_code != 200:
                error_detail = response.json().get("error", {}).get("message", "Unknown Gemini API error")
                raise HTTPException(status_code=response.status_code, detail=f"Gemini API Error: {error_detail}")

            data = response.json()
            
            # Extract content from Gemini response
            try:
                candidate = data["candidates"][0]
                text_response = candidate["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as e:
                raise HTTPException(status_code=500, detail="Unexpected Gemini API response structure")

            if not text_response:
                raise HTTPException(status_code=500, detail="Gemini API returned empty response")
                
            try:
                proposal_json = json.loads(text_response)
                return {"proposal": proposal_json}
            except json.JSONDecodeError:
                # Fallback if AI fails to return valid JSON despite the instruction
                return {"proposal": {"content": text_response}}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/regenerate")
async def regenerate_section(request: RegenerateRequest, authorization: str = Header(None)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    try:
        payload = {
            "contents": [{
                "parts": [{"text": request.prompt}]
            }]
        }
        
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                GEMINI_ENDPOINT,
                json=payload,
                headers=headers,
                timeout=60.0
            )
            
            if response.status_code != 200:
                error_detail = response.json().get("error", {}).get("message", "Unknown Gemini API error")
                raise HTTPException(status_code=response.status_code, detail=f"Gemini API Error: {error_detail}")

            data = response.json()
            
            try:
                candidate = data["candidates"][0]
                text_response = candidate["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                raise HTTPException(status_code=500, detail="Unexpected Gemini API response structure")

            if not text_response:
                raise HTTPException(status_code=500, detail="Gemini API returned empty response")
                
            return {"proposal": text_response}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
