from enum import Enum

from workflows.example_streaming_workflow import ExampleStreamingWorkflow
from workflows.trust_building_subflow import TrustBuildingSubflow
from workflows.analyst_flow import AnalystFlow


class WorkflowRegistry(Enum):
    EXAMPLE_STREAMING_WORKFLOW = ExampleStreamingWorkflow
    TRUST_BUILDING = TrustBuildingSubflow
    ANALYST = AnalystFlow
