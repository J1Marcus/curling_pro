"""
Trust Building Subflow

This subflow establishes comfort and rapport with the storyteller.
It is invoked by the Analyst Flow and handles:

1. Introduction - Warm welcome and initial rapport
2. Subject Clarification - Understanding who the story is about
3. Scope Selection - Defining the scope of the story
4. Gentle Profile - Building initial profile without pressure

Self-Gating Pattern:
- TrustBuildingGate checks if Trust Building work is needed
- If all trust steps are complete, calls required_stop_workflow()
- This allows the Analyst to invoke all subflows without checking preconditions

Flow:
1. TrustBuildingGate → Check if work needed (self-gate if not)
2. TrustBuildingRouter → Route to appropriate step node
3. IntroductionNode → Handle introduction (if current step)
4. SubjectClarificationNode → Clarify who the story is about (if current step)
5. ScopeSelectionNode → Handle scope selection (if current step)
6. GentleProfileNode → Gather boundaries and preferences (if current step)
"""

from core.schema import WorkflowSchema, NodeConfig
from core.workflow import Workflow
from schemas.subflow_events import TrustBuildingEvent

from workflows.trust_building_subflow_nodes.trust_building_gate import TrustBuildingGate
from workflows.trust_building_subflow_nodes.trust_building_router import TrustBuildingRouter
from workflows.trust_building_subflow_nodes.introduction_node import IntroductionNode
from workflows.trust_building_subflow_nodes.subject_clarification_node import SubjectClarificationNode
from workflows.trust_building_subflow_nodes.scope_selection_node import ScopeSelectionNode
from workflows.trust_building_subflow_nodes.gentle_profile_node import GentleProfileNode


class TrustBuildingSubflow(Workflow):
    """Trust Building Subflow.

    Establishes comfort and rapport with the storyteller through:
    - Warm introduction and welcome
    - Subject clarification (who is the story about)
    - Scope selection (whole life, chapter, or event)
    - Gentle profile building

    This subflow implements self-gating: if all trust steps are
    already complete, it stops early via required_stop_workflow().
    This allows the Analyst to invoke it unconditionally.
    """

    workflow_schema = WorkflowSchema(
        description="Trust Building: Establish comfort and rapport with the storyteller",
        event_schema=TrustBuildingEvent,
        start=TrustBuildingGate,
        nodes=[
            NodeConfig(
                node=TrustBuildingGate,
                connections=[TrustBuildingRouter],
                description="Self-gating check: determine if Trust Building is needed",
            ),
            NodeConfig(
                node=TrustBuildingRouter,
                connections=[IntroductionNode, SubjectClarificationNode, ScopeSelectionNode, GentleProfileNode],
                is_router=True,
                description="Route to appropriate trust step based on current step",
            ),
            NodeConfig(
                node=IntroductionNode,
                connections=[],
                description="Handle introduction and initial rapport",
            ),
            NodeConfig(
                node=SubjectClarificationNode,
                connections=[],
                description="Clarify who the story is about (storyteller or someone else)",
            ),
            NodeConfig(
                node=ScopeSelectionNode,
                connections=[],
                description="Handle scope selection for story capture",
            ),
            NodeConfig(
                node=GentleProfileNode,
                connections=[],
                description="Gather boundaries and preferences without pressure",
            ),
        ],
    )
