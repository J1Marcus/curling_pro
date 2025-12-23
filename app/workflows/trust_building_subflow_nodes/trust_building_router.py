"""
Trust Building Router

Routes to the appropriate trust step node based on the current step
determined by the gate.
"""

import logging
from typing import Optional

from core.nodes.base import Node
from core.nodes.router import BaseRouter, RouterNode
from core.task import TaskContext

from workflows.trust_building_subflow_nodes.introduction_node import IntroductionNode
from workflows.trust_building_subflow_nodes.subject_clarification_node import SubjectClarificationNode
from workflows.trust_building_subflow_nodes.scope_selection_node import ScopeSelectionNode
from workflows.trust_building_subflow_nodes.gentle_profile_node import GentleProfileNode

logger = logging.getLogger(__name__)


class IntroductionRoute(RouterNode):
    """Routes to IntroductionNode if current step is 'introduction'."""

    def determine_next_node(self, task_context: TaskContext) -> Optional[Node]:
        current_step = task_context.metadata.get("current_trust_step")
        if current_step == "introduction":
            logger.info("TrustBuildingRouter: Routing to IntroductionNode")
            return IntroductionNode()
        return None


class SubjectClarificationRoute(RouterNode):
    """Routes to SubjectClarificationNode if current step is 'subject_clarification'."""

    def determine_next_node(self, task_context: TaskContext) -> Optional[Node]:
        current_step = task_context.metadata.get("current_trust_step")
        if current_step == "subject_clarification":
            logger.info("TrustBuildingRouter: Routing to SubjectClarificationNode")
            return SubjectClarificationNode()
        return None


class ScopeSelectionRoute(RouterNode):
    """Routes to ScopeSelectionNode if current step is 'scope_selection'."""

    def determine_next_node(self, task_context: TaskContext) -> Optional[Node]:
        current_step = task_context.metadata.get("current_trust_step")
        if current_step == "scope_selection":
            logger.info("TrustBuildingRouter: Routing to ScopeSelectionNode")
            return ScopeSelectionNode()
        return None


class GentleProfileRoute(RouterNode):
    """Routes to GentleProfileNode if current step is 'gentle_profile'."""

    def determine_next_node(self, task_context: TaskContext) -> Optional[Node]:
        current_step = task_context.metadata.get("current_trust_step")
        if current_step == "gentle_profile":
            logger.info("TrustBuildingRouter: Routing to GentleProfileNode")
            return GentleProfileNode()
        return None


class TrustBuildingRouter(BaseRouter):
    """Router for Trust Building Subflow.

    Routes to the appropriate node based on the current trust step:
    - introduction → IntroductionNode
    - subject_clarification → SubjectClarificationNode
    - scope_selection → ScopeSelectionNode
    - gentle_profile → GentleProfileNode

    Falls back to IntroductionNode if no route matches.
    """

    routes = [
        IntroductionRoute(),
        SubjectClarificationRoute(),
        ScopeSelectionRoute(),
        GentleProfileRoute(),
    ]
    fallback = IntroductionNode()
