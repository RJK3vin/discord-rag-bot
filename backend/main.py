import os
import re
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pydantic import BaseModel
from dotenv import load_dotenv
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential
from azure.ai.inference.models import SystemMessage, UserMessage
from database import feedback_collection 
from zoneinfo import ZoneInfo
from mock_rag import retrieve_context_with_keywords

# Load env
load_dotenv()

AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_KEY")
AZURE_MODEL = os.getenv("AZURE_MODEL")

# Azure DeepSeek client
client = ChatCompletionsClient(
    endpoint=AZURE_ENDPOINT,
    credential=AzureKeyCredential(AZURE_KEY),
    api_version="2024-05-01-preview"
)

# FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ET = ZoneInfo("America/New_York")

# Input schema
class QueryRequest(BaseModel):
    user_id: str
    question: str

class Feedback(BaseModel):
    question: str
    response: str
    rating: str  # thumbs_up or thumbs_down
    comment: str = ""
    timestamp: str

@app.post("/query")
async def query(data: QueryRequest):
    context = retrieve_context_with_keywords(data.question)

    messages = [
        SystemMessage(content="You are a helpful assistant. Be concise and clear."),
        UserMessage(content=f"Context: {context}\n\nQuestion: {data.question}")
    ]

    try:
        response = client.complete(
            stream=False,
            messages=messages,
            max_tokens=2048,
            model=AZURE_MODEL
        )

        answer = response.choices[0].message.content
        cleaned_answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL).strip()
        return {
            "answer": cleaned_answer,
            "thinking": None 
        }
    except Exception as e:
        print("DeepSeek error:", e)
        return {
            "answer": "⚠️ DeepSeek call failed.",
            "thinking": None
        }

@app.post("/feedback")
async def store_feedback(feedback: Feedback):
    data = feedback.model_dump()
    if not data.get("timestamp"):
        data["timestamp"] = datetime.now(ET).isoformat()
    print("[FEEDBACK RECEIVED]", data)
    try:
        result = feedback_collection.insert_one(data)
        print("[INSERT SUCCESS]", result.inserted_id)
        return {"status": "success", "inserted_id": str(result.inserted_id), "timestamp": data["timestamp"]}
    except Exception as e:
        print("[INSERT ERROR]", e)
        return {"status": "error", "message": str(e)}
