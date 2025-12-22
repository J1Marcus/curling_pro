import json
import logging
import sys
from datetime import datetime
from pathlib import Path


sys.path.append(str(Path(__file__).parent.parent / "app"))
sys.path.append(str(Path(__file__).parent.parent))

import nest_asyncio
from workflows.workflow_registry import WorkflowRegistry

from playground.utils.event_loader import EventLoader

logging.basicConfig(level=logging.INFO)
nest_asyncio.apply()

"""
This playground is used to test the WorkflowRegistry and the workflows themselves.
"""

event_key = "placeholder_event"
event = EventLoader.load_event(event_key=event_key)
workflow = WorkflowRegistry.PLACEHOLDER.value()
output = workflow.run(event)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_dir = Path(__file__).parent.parent / "requests" / event_key
output_dir.mkdir(parents=True, exist_ok=True)
output_file = output_dir / f"{event_key}_{timestamp}.json"

with open(output_file, "w") as f:
    json.dump(output.model_dump(), f, indent=2)
