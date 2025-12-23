"""
Workflows Package

This package contains the workflow definitions for the Everbound backend.
Workflows follow the GenAI Launchpad pattern with self-gating subflows.

Subflows:
- TrustBuildingSubflow: Establish comfort and rapport
- ContextualGroundingSubflow: Surface life events (not yet implemented)
- SectionSelectionSubflow: Choose story sections (not yet implemented)
- LaneDevelopmentSubflow: Deep story capture via VAPI (not yet implemented)

Orchestrators:
- AnalystFlow: Runs all subflows, determines next action
- SessionFlow: Manages real-time VAPI session routing (not yet implemented)
"""

from workflows.trust_building_subflow import TrustBuildingSubflow
from workflows.analyst_flow import AnalystFlow

__all__ = [
    "TrustBuildingSubflow",
    "AnalystFlow",
]
