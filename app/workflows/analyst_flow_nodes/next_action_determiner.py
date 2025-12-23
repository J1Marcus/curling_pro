"""
Next Action Determiner Node

Analyzes subflow results and determines what action to take next.
This could be starting a VAPI session, creating requirements, or
updating storyteller progress.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID

from sqlalchemy.orm import Session

from core.nodes.base import Node
from core.task import TaskContext
from database.session import SessionLocal
from services import RequirementService, StorytellerService

logger = logging.getLogger(__name__)


class NextActionDeterminer(Node):
    """Determines the next action based on subflow results.

    This node analyzes what each subflow accomplished (or didn't do
    due to self-gating) and determines:

    1. What requirements to create
    2. Whether to start a VAPI session
    3. What phase updates to make
    4. What the suggested next action is

    Action Types:
    - start_vapi_session: Begin a voice session for a specific purpose
    - create_requirement: Add a new requirement to track
    - update_progress: Update storyteller phase/progress
    - no_action: Nothing more to do right now
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Determine next action based on subflow results.

        Args:
            task_context: Current task context with subflow results

        Returns:
            TaskContext with next action determination
        """
        subflow_results = task_context.metadata.get("subflow_results", {})
        storyteller_id = task_context.metadata.get("storyteller_id")

        logger.info(
            f"NextActionDeterminer: Analyzing results for storyteller {storyteller_id}"
        )

        # Analyze each subflow result
        trust_result = subflow_results.get("trust_building", {})

        # Determine next action
        next_action = self._determine_next_action(
            trust_result=trust_result,
            contextual_result=subflow_results.get("contextual_grounding", {}),
            section_result=subflow_results.get("section_selection", {}),
            lane_result=subflow_results.get("lane_development", {}),
        )

        # Create any needed requirements
        requirements_created = await self._create_requirements(
            storyteller_id=storyteller_id,
            subflow_results=subflow_results,
        )

        # Build the action response
        task_context.update_node(
            "NextActionDeterminer",
            next_action=next_action,
            requirements_created=requirements_created,
            analysis={
                "trust_building": self._summarize_trust_result(trust_result),
            },
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store recommended action in metadata
        task_context.metadata["next_action"] = next_action
        task_context.metadata["requirements_created"] = requirements_created

        logger.info(
            f"NextActionDeterminer: Next action = {next_action.get('action_type')}"
        )

        return task_context

    def _determine_next_action(
        self,
        trust_result: Dict[str, Any],
        contextual_result: Dict[str, Any],
        section_result: Dict[str, Any],
        lane_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Determine the next action based on all subflow results.

        Priority order:
        1. Trust Building needs work → start trust session
        2. Contextual Grounding needs work → start grounding session
        3. Section Selection needs work → run section selection
        4. Lane Development ready → start lane session
        5. Nothing needed → no_action

        Args:
            trust_result: Result from Trust Building subflow
            contextual_result: Result from Contextual Grounding subflow
            section_result: Result from Section Selection subflow
            lane_result: Result from Lane Development subflow

        Returns:
            Action dictionary with type and parameters
        """
        # Check Trust Building
        if trust_result.get("gate_result") == "proceed":
            next_step = trust_result.get("next_step", "introduction")
            return {
                "action_type": "start_vapi_session",
                "purpose": "trust_building",
                "trust_step": next_step,
                "session_intention": f"Complete {next_step} step of trust building",
                "priority": "high",
            }

        # Trust Building self-gated (not needed)
        if trust_result.get("required_stop"):
            logger.info(
                "NextActionDeterminer: Trust Building complete, checking other subflows"
            )

        # Check other subflows (placeholders for now)
        if contextual_result.get("status") != "not_implemented":
            if contextual_result.get("gate_result") == "proceed":
                return {
                    "action_type": "start_vapi_session",
                    "purpose": "contextual_grounding",
                    "priority": "medium",
                }

        if section_result.get("status") != "not_implemented":
            if section_result.get("gate_result") == "proceed":
                return {
                    "action_type": "run_section_selection",
                    "priority": "medium",
                }

        if lane_result.get("status") != "not_implemented":
            if lane_result.get("gate_result") == "proceed":
                return {
                    "action_type": "start_vapi_session",
                    "purpose": "lane_development",
                    "priority": "low",
                }

        # Nothing to do right now
        return {
            "action_type": "no_action",
            "reason": "All subflows self-gated or not implemented",
            "suggestion": "Wait for next session or implement remaining subflows",
        }

    async def _create_requirements(
        self,
        storyteller_id: str,
        subflow_results: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Create requirements based on subflow results.

        Args:
            storyteller_id: Storyteller UUID string
            subflow_results: Results from all subflows

        Returns:
            List of created requirement summaries
        """
        created = []

        # Get database session
        db: Session = SessionLocal()

        try:
            requirement_svc = RequirementService(db)

            # Check Trust Building for requirement to create
            trust_result = subflow_results.get("trust_building", {})
            if trust_result.get("gate_result") == "proceed":
                next_step = trust_result.get("next_step")
                if next_step:
                    # Create requirement for the trust step
                    req = requirement_svc.create(
                        storyteller_id=UUID(storyteller_id),
                        requirement_name=f"Complete {next_step.replace('_', ' ').title()}",
                        requirement_type="trust_building",
                        description=f"Trust building step: {next_step}",
                        priority="high",
                    )
                    created.append({
                        "id": str(req.id),
                        "name": req.requirement_name,
                        "type": req.requirement_type,
                    })
                    logger.info(f"Created requirement: {req.requirement_name}")

            db.commit()

        except Exception as e:
            logger.error(f"Error creating requirements: {e}")
            db.rollback()
        finally:
            db.close()

        return created

    def _summarize_trust_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Create a summary of trust building result.

        Args:
            result: Trust Building subflow result

        Returns:
            Summary dictionary
        """
        if result.get("required_stop"):
            return {
                "status": "complete",
                "message": "All trust steps already done",
            }
        elif result.get("gate_result") == "proceed":
            return {
                "status": "in_progress",
                "next_step": result.get("next_step"),
                "message": f"Need to complete {result.get('next_step')}",
            }
        elif result.get("status") == "error":
            return {
                "status": "error",
                "message": result.get("error"),
            }
        else:
            return {
                "status": "unknown",
                "raw_result": result,
            }
