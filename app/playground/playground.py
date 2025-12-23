#!/usr/bin/env python3
"""
Workflow Playground

Run workflows with sample events and save results.

Usage:
    uv run playground/playground.py TRUST_BUILDING
    uv run playground/playground.py ANALYST
    uv run playground/playground.py <WORKFLOW_NAME> --event <path_to_event.json>

Results are saved to playground_requests/<workflow_name>_result_<timestamp>.json
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from workflows.workflow_registry import WorkflowRegistry

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("playground")

# Paths relative to app/ directory
PLAYGROUND_REQUESTS_DIR = Path("playground_requests")

# Default event files for each workflow
DEFAULT_EVENTS = {
    "TRUST_BUILDING": PLAYGROUND_REQUESTS_DIR / "trust_building_event_sample.json",
    "ANALYST": PLAYGROUND_REQUESTS_DIR / "analyst_event_sample.json",
}


def load_event(event_path: str) -> dict:
    """Load event JSON from file.

    Args:
        event_path: Path to event JSON file

    Returns:
        Event dictionary
    """
    path = Path(event_path)
    if not path.exists():
        raise FileNotFoundError(f"Event file not found: {event_path}")

    with open(path) as f:
        return json.load(f)


def save_result(workflow_name: str, result: dict) -> str:
    """Save workflow result to file.

    Args:
        workflow_name: Name of the workflow
        result: Result dictionary to save

    Returns:
        Path to saved file
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{workflow_name.lower()}_result_{timestamp}.json"
    output_path = PLAYGROUND_REQUESTS_DIR / filename

    # Ensure directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, default=str)

    return str(output_path)


def get_available_workflows() -> list[str]:
    """Get list of available workflow names from registry."""
    return [w.name for w in WorkflowRegistry]


async def run_workflow(workflow_name: str, event: dict) -> dict:
    """Run a workflow with the given event.

    Args:
        workflow_name: Name of workflow from WorkflowRegistry
        event: Event dictionary

    Returns:
        Result dictionary
    """
    try:
        workflow_enum = WorkflowRegistry[workflow_name]
    except KeyError:
        available = get_available_workflows()
        raise ValueError(f"Unknown workflow: {workflow_name}. Available: {available}")

    workflow_class = workflow_enum.value

    logger.info(f"Running workflow: {workflow_name}")
    logger.info(f"Event: {json.dumps(event, indent=2, default=str)[:500]}...")

    # Instantiate and run
    workflow = workflow_class()
    result = await workflow.run_async(event)

    # Convert to serializable dict
    result_dict = {
        "workflow": workflow_name,
        "timestamp": datetime.now().isoformat(),
        "status": result.status,
        "should_stop": result.should_stop,
        "required_stop": result.required_stop,
        "nodes": result.nodes,
        "metadata": {k: v for k, v in result.metadata.items() if k != "nodes"},
    }

    return result_dict


def main():
    available = get_available_workflows()

    parser = argparse.ArgumentParser(
        description="Run workflows with sample events",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Available workflows:
  {', '.join(available)}

Examples:
    uv run playground/playground.py TRUST_BUILDING
    uv run playground/playground.py ANALYST
    uv run playground/playground.py TRUST_BUILDING --event playground_requests/custom_event.json
        """,
    )
    parser.add_argument(
        "workflow",
        choices=available,
        help="Workflow to run (from WorkflowRegistry)",
    )
    parser.add_argument(
        "--event",
        "-e",
        help="Path to custom event JSON file (uses default if not provided)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save result to file",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Load event
    event_path = args.event or DEFAULT_EVENTS.get(args.workflow)
    if not event_path:
        logger.error(f"No default event for {args.workflow}. Use --event to specify one.")
        sys.exit(1)

    try:
        event = load_event(event_path)
        logger.info(f"Loaded event from: {event_path}")
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    # Run workflow
    try:
        result = asyncio.run(run_workflow(args.workflow, event))
    except Exception as e:
        logger.error(f"Workflow failed: {e}", exc_info=True)
        sys.exit(1)

    # Display result
    print("\n" + "=" * 60)
    print("WORKFLOW RESULT")
    print("=" * 60)
    print(json.dumps(result, indent=2, default=str))
    print("=" * 60 + "\n")

    # Save result
    if not args.no_save:
        output_path = save_result(args.workflow, result)
        logger.info(f"Result saved to: {output_path}")

    # Summary
    print(f"Status: {result['status']}")
    print(f"Should Stop: {result['should_stop']}")
    print(f"Required Stop: {result['required_stop']}")

    if result["status"] == "completed":
        print("\n✓ Workflow completed successfully")
    elif result["status"] == "stopped":
        print("\n✓ Workflow stopped by design (self-gating)")
    else:
        print(f"\n✗ Workflow ended with status: {result['status']}")


if __name__ == "__main__":
    main()
