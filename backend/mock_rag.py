# mock_rag.py

def retrieve_context(question: str) -> str:
    # Mock context lookup based on a few keywords
    if "refund" in question.lower():
        return "Our refund policy allows returns within 30 days of purchase."
    elif "onboarding" in question.lower():
        return "The onboarding process starts with account setup and orientation."
    elif "pricing" in question.lower():
        return "We offer a free tier and two paid plans: Pro and Enterprise."
    else:
        return "This is general context about our company to assist with your query."

