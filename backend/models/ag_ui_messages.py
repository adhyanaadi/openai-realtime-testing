from pydantic import BaseModel, Field
from typing import Dict, Any, Literal, Optional # Added Optional

class AGUIMessage(BaseModel):
    event_type: Literal[
        "AGENT_RESPONSE", 
        "TOOL_CALL_START", 
        "TOOL_OUTPUT",
        "A2A_DELEGATION_START", # New event type for A2A delegation
        "A2A_DELEGATION_RESULT", # New event type for A2A delegation result
        "ERROR"
    ]
    data: Dict[str, Any] = Field(default_factory=dict)
    message: Optional[str] = None # For simple AGENT_RESPONSE or error text

    # Example usage:
    # AGUIMessage(event_type="AGENT_RESPONSE", message="Hello there!")
    # AGUIMessage(event_type="TOOL_CALL_START", data={"tool_name": "get_weather", "inputs": {"location": "London"}})
    # AGUIMessage(event_type="TOOL_OUTPUT", data={"tool_name": "get_weather", "output": {"temp": "10C"}, "status": "SUCCESS"})
    # AGUIMessage(event_type="A2A_DELEGATION_START", data={"target_agent_id": "translator", "task_name": "translate", "inputs": {"text": "hello"}})
    # AGUIMessage(event_type="A2A_DELEGATION_RESULT", data={"target_agent_id": "translator", "task_name": "translate", "status": "SUCCESS", "outputs": {"translated_text": "hola"}})
    # AGUIMessage(event_type="ERROR", message="An error occurred.")
