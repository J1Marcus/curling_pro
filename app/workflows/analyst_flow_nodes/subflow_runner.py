"""
Subflow Runner Node

Runs all subflows in sequence. Each subflow self-gates,
so we can invoke them all without checking preconditions.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from uuid import UUID

from core.nodes.base import Node
from core.task import TaskContext
from schemas.subflow_events import TrustBuildingEvent
from workflows.trust_building_subflow import TrustBuildingSubflow

logger = logging.getLogger(__name__)


class SubflowRunner(Node):
    """Runs all subflows in sequence.

    This node implements the "run all subflows" pattern from the
    high-level plan. Each subflow has self-gating logic, so we
    can invoke them all without checking preconditions.

    Subflow Execution Order:
    1. Trust Building - Establish rapport
    2. Contextual Grounding - Surface life events (not yet implemented)
    3. Section Selection - Choose story sections (not yet implemented)
    4. Lane Development - Deep story capture (not yet implemented)

    Each subflow receives the full context and determines internally
    whether it needs to do any work.
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Run all subflows in sequence.

        Args:
            task_context: Current task context with loaded context

        Returns:
            TaskContext with subflow results
        """
        storyteller_id = task_context.metadata.get("storyteller_id")
        session_id = task_context.metadata.get("session_id")
        storyteller_context = task_context.metadata.get("storyteller_context", {})

        logger.info(f"SubflowRunner: Running subflows for storyteller {storyteller_id}")

        subflow_results: Dict[str, Any] = {}

        # =====================================================================
        # 1. Trust Building Subflow
        # =====================================================================
        logger.info("SubflowRunner: Running Trust Building Subflow")

        trust_result = await self._run_trust_building(
            storyteller_id=UUID(storyteller_id),
            session_id=UUID(session_id) if session_id else None,
            storyteller_context=storyteller_context,
        )
        subflow_results["trust_building"] = trust_result

        # =====================================================================
        # 2. Contextual Grounding Subflow (placeholder)
        # =====================================================================
        logger.info("SubflowRunner: Contextual Grounding not yet implemented")
        subflow_results["contextual_grounding"] = {"status": "not_implemented"}

        # =====================================================================
        # 3. Section Selection Subflow (placeholder)
        # =====================================================================
        logger.info("SubflowRunner: Section Selection not yet implemented")
        subflow_results["section_selection"] = {"status": "not_implemented"}

        # =====================================================================
        # 4. Lane Development Subflow (placeholder)
        # =====================================================================
        logger.info("SubflowRunner: Lane Development not yet implemented")
        subflow_results["lane_development"] = {"status": "not_implemented"}

        # Store all results
        task_context.update_node(
            "SubflowRunner",
            subflow_results=subflow_results,
            subflows_executed=list(subflow_results.keys()),
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store in metadata for next action determiner
        task_context.metadata["subflow_results"] = subflow_results

        logger.info(f"SubflowRunner: All subflows complete")
        return task_context

    async def _run_trust_building(
        self,
        storyteller_id: UUID,
        session_id: UUID | None,
        storyteller_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Run the Trust Building Subflow.

        Args:
            storyteller_id: Storyteller UUID
            session_id: Optional session UUID
            storyteller_context: Full storyteller context

        Returns:
            Result dictionary with subflow outcome
        """
        try:
            # Determine completed trust steps from progress
            progress = storyteller_context.get("progress", {})
            current_phase = progress.get("current_phase", "trust_setup")

            # For now, assume no trust steps completed if in trust_setup phase
            # In reality, we'd track this in the database
            completed_trust_steps: List[str] = []
            if current_phase != "trust_setup":
                # Trust setup is complete, all steps done
                completed_trust_steps = [
                    "introduction",
                    "subject_clarification",
                    "scope_selection",
                    "gentle_profile",
                ]

            # Build the event
            event = TrustBuildingEvent(
                storyteller_id=storyteller_id,
                session_id=session_id,
                storyteller_context=storyteller_context,
                is_first_session=(progress.get("overall_completion_percentage", 0) == 0),
                completed_trust_steps=completed_trust_steps,
            )

            # Run the subflow
            workflow = TrustBuildingSubflow()
            result = await workflow.run_async(event.model_dump())

            # Extract results
            return {
                "status": result.status,
                "gate_result": result.nodes.get("TrustBuildingGate", {}).get("gate_result"),
                "next_step": result.nodes.get("TrustBuildingGate", {}).get("next_step"),
                "introduction_ready": result.nodes.get("IntroductionNode", {}).get("introduction_ready"),
                "required_stop": result.required_stop,
            }

        except Exception as e:
            logger.error(f"SubflowRunner: Trust Building failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
