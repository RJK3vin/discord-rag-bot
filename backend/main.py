import os
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential
from azure.ai.inference.models import SystemMessage, UserMessage
from database import feedback_collection 

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
    messages = [
        SystemMessage(content="You are a helpful assistant. Wrap internal thoughts with <think>...</think>."),
        UserMessage(content=data.question)
    ]

    try:
        response = client.complete(
            stream=False,
            messages=messages,
            max_tokens=2048,
            model=AZURE_MODEL
        )

        answer = response.choices[0].message.content
        return {
            "answer": answer,
            "thinking": None  # Can add parsing later
        }
    except Exception as e:
        print("DeepSeek error:", e)
        return {
            "answer": "⚠️ DeepSeek call failed.",
            "thinking": None
        }

@app.post("/feedback")
async def store_feedback(feedback: Feedback):
    feedback_dict = feedback.model_dump()
    feedback_collection.insert_one(feedback_dict)
    return {"message": "Feedback saved."}
