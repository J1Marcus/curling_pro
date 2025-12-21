"""
Process Management Models Module

This module defines SQLAlchemy models for the process management domain.
Process management handles the data-driven, versionable workflow that guides
users through the Everbound story capture experience.

Models included:
- ProcessVersion: Versions of the entire process flow
- ProcessCommitment: Non-negotiable design principles
- ProcessNodeType: Enum-like table for node behavior patterns
- ProcessNode: Individual phases in the flow
- ProcessFlowEdge: Flow between nodes with conditional branching
- ProcessPrompt: Questions asked to users within nodes
- PromptPackTemplate: Reusable prompt sequences
- PromptPackPrompt: Individual prompts within a pack
- ProcessSection: Narrative lanes users can work on
- SectionPrompt: Links prompts to sections
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from database.session import Base


class ProcessVersion(Base):
    """Versions of the entire process flow.

    Allows testing new flows without breaking active sessions.
    Only one version should be active at a time.
    """

    __tablename__ = "process_version"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the process version",
    )
    version_name = Column(
        String(100),
        nullable=False,
        doc="Version name, e.g., 'v1.0', 'experimental-2024-12'",
    )
    description = Column(
        Text,
        doc="Description of this process version",
    )
    is_active = Column(
        Boolean,
        default=False,
        doc="Only one active version at a time",
    )
    created_by = Column(
        UUID(as_uuid=True),
        nullable=True,
        doc="Reference to the user who created this version",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the version was created",
    )

    # Relationships
    commitments = relationship(
        "ProcessCommitment",
        back_populates="process_version",
        cascade="all, delete-orphan",
    )
    nodes = relationship(
        "ProcessNode",
        back_populates="process_version",
        cascade="all, delete-orphan",
    )
    flow_edges = relationship(
        "ProcessFlowEdge",
        back_populates="process_version",
        cascade="all, delete-orphan",
    )
    sections = relationship(
        "ProcessSection",
        back_populates="process_version",
        cascade="all, delete-orphan",
    )


class ProcessCommitment(Base):
    """Non-negotiable design principles that rarely change."""

    __tablename__ = "process_commitment"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the commitment",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent process version",
    )
    order_index = Column(
        Integer,
        nullable=False,
        doc="Order position of this commitment",
    )
    title = Column(
        String(200),
        nullable=False,
        doc="Commitment title, e.g., 'Context before meaning'",
    )
    description = Column(
        Text,
        nullable=False,
        doc="Full explanation of the commitment",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the commitment was created",
    )

    # Relationships
    process_version = relationship(
        "ProcessVersion",
        back_populates="commitments",
    )


class ProcessNodeType(Base):
    """Enum-like table defining node behavior patterns."""

    __tablename__ = "process_node_type"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the node type",
    )
    type_name = Column(
        String(50),
        unique=True,
        nullable=False,
        doc="Type name: 'informational', 'fork', 'data_collection', 'iterative', 'synthesis'",
    )
    description = Column(
        Text,
        doc="Description of this node type behavior",
    )
    requires_user_input = Column(
        Boolean,
        default=True,
        doc="Whether this node type requires user input",
    )
    can_skip = Column(
        Boolean,
        default=False,
        doc="Whether this node type can be skipped",
    )
    is_repeatable = Column(
        Boolean,
        default=False,
        doc="Whether this node type can be repeated",
    )

    # Relationships
    nodes = relationship(
        "ProcessNode",
        back_populates="node_type",
    )


class ProcessNode(Base):
    """Individual phases in the flow. The core building blocks."""

    __tablename__ = "process_node"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the node",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent process version",
    )
    node_type_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_node_type.id"),
        nullable=True,
        doc="Reference to the node type",
    )
    node_key = Column(
        String(100),
        nullable=False,
        doc="Code-friendly key, e.g., 'trust_setup', 'scope_selection'",
    )
    node_name = Column(
        String(200),
        nullable=False,
        doc="Display name, e.g., 'Phase 1: Introduction & Trust Setup'",
    )
    order_index = Column(
        Integer,
        nullable=False,
        doc="Position in flow",
    )

    # Core content
    purpose = Column(
        Text,
        nullable=False,
        doc="Why this phase exists",
    )
    outcome = Column(
        Text,
        doc="What should be achieved",
    )
    user_facing_text = Column(
        Text,
        doc="What the user is told",
    )

    # Behavior flags
    is_optional = Column(
        Boolean,
        default=False,
        doc="Whether this node is optional",
    )
    requires_completion = Column(
        Boolean,
        default=True,
        doc="Whether completion is required to proceed",
    )

    # Agent configuration
    agent_objective = Column(
        Text,
        doc="What the agent should accomplish",
    )
    agent_constraints = Column(
        Text,
        doc="Guardrails for the agent",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the node was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the node was last updated",
    )

    # Relationships
    process_version = relationship(
        "ProcessVersion",
        back_populates="nodes",
    )
    node_type = relationship(
        "ProcessNodeType",
        back_populates="nodes",
    )
    prompts = relationship(
        "ProcessPrompt",
        back_populates="process_node",
        cascade="all, delete-orphan",
    )
    outgoing_edges = relationship(
        "ProcessFlowEdge",
        back_populates="from_node",
        foreign_keys="ProcessFlowEdge.from_node_id",
        cascade="all, delete-orphan",
    )
    incoming_edges = relationship(
        "ProcessFlowEdge",
        back_populates="to_node",
        foreign_keys="ProcessFlowEdge.to_node_id",
        cascade="all, delete-orphan",
    )


# Index for process_node
Index("idx_process_node_version", ProcessNode.process_version_id, ProcessNode.order_index)


class ProcessFlowEdge(Base):
    """Defines the flow between nodes. Supports branching and conditional paths."""

    __tablename__ = "process_flow_edge"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the edge",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent process version",
    )
    from_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_node.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the source node",
    )
    to_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_node.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the destination node",
    )

    # Conditional logic
    condition_type = Column(
        String(50),
        doc="Condition type: 'scope_match', 'profile_flag', 'always', 'section_selected'",
    )
    condition_value = Column(
        JSONB,
        doc="Flexible condition data",
    )

    order_index = Column(
        Integer,
        doc="Order for multiple edges from same node",
    )
    edge_label = Column(
        String(100),
        doc="Label, e.g., 'whole_life_path', 'single_event_path'",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the edge was created",
    )

    # Relationships
    process_version = relationship(
        "ProcessVersion",
        back_populates="flow_edges",
    )
    from_node = relationship(
        "ProcessNode",
        back_populates="outgoing_edges",
        foreign_keys=[from_node_id],
    )
    to_node = relationship(
        "ProcessNode",
        back_populates="incoming_edges",
        foreign_keys=[to_node_id],
    )


class ProcessPrompt(Base):
    """Individual prompts within nodes. The questions asked to users."""

    __tablename__ = "process_prompt"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the prompt",
    )
    process_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_node.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent node",
    )

    prompt_key = Column(
        String(100),
        nullable=False,
        doc="Prompt key, e.g., 'scene', 'people', 'tension'",
    )
    prompt_text = Column(
        Text,
        nullable=False,
        doc="The actual question",
    )
    prompt_type = Column(
        String(50),
        doc="Type: 'scene', 'people', 'tension', 'change', 'meaning'",
    )

    order_index = Column(
        Integer,
        nullable=False,
        doc="Order position within the node",
    )
    is_required = Column(
        Boolean,
        default=False,
        doc="Whether this prompt is required",
    )
    is_sensitive = Column(
        Boolean,
        default=False,
        doc="Triggers tier check for sensitive content",
    )
    sensitivity_tier = Column(
        Integer,
        doc="Sensitivity tier: 1=safe, 2=optional, 3=private",
    )

    # Response handling
    response_format = Column(
        String(50),
        doc="Format: 'text', 'voice', 'checkbox', 'multi_select'",
    )
    max_length = Column(
        Integer,
        doc="Maximum response length",
    )
    example_response = Column(
        Text,
        doc="Example response for guidance",
    )

    # Conditional display
    condition_type = Column(
        String(50),
        doc="Condition type: 'profile_boundary', 'scope_match', 'section_active'",
    )
    condition_value = Column(
        JSONB,
        doc="Flexible condition data",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the prompt was created",
    )

    # Relationships
    process_node = relationship(
        "ProcessNode",
        back_populates="prompts",
    )
    section_prompts = relationship(
        "SectionPrompt",
        back_populates="process_prompt",
        cascade="all, delete-orphan",
    )


# Index for process_prompt
Index("idx_process_prompt_node", ProcessPrompt.process_node_id, ProcessPrompt.order_index)


class PromptPackTemplate(Base):
    """Reusable prompt sequences (like the Scene-People-Tension-Change-Meaning pattern)."""

    __tablename__ = "prompt_pack_template"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the template",
    )
    template_name = Column(
        String(100),
        nullable=False,
        doc="Template name, e.g., 'standard_scene_pack'",
    )
    description = Column(
        Text,
        doc="Description of the template",
    )
    is_global = Column(
        Boolean,
        default=True,
        doc="Can be used across multiple nodes",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the template was created",
    )

    # Relationships
    prompts = relationship(
        "PromptPackPrompt",
        back_populates="prompt_pack",
        cascade="all, delete-orphan",
    )


class PromptPackPrompt(Base):
    """Individual prompts within a prompt pack template."""

    __tablename__ = "prompt_pack_prompt"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the prompt pack prompt",
    )
    prompt_pack_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_pack_template.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent prompt pack template",
    )
    prompt_key = Column(
        String(100),
        nullable=False,
        doc="Prompt key identifier",
    )
    prompt_text = Column(
        Text,
        nullable=False,
        doc="The actual prompt text",
    )
    prompt_type = Column(
        String(50),
        doc="Type of prompt",
    )
    order_index = Column(
        Integer,
        nullable=False,
        doc="Order position within the pack",
    )
    is_required = Column(
        Boolean,
        default=False,
        doc="Whether this prompt is required",
    )

    # Relationships
    prompt_pack = relationship(
        "PromptPackTemplate",
        back_populates="prompts",
    )


class ProcessSection(Base):
    """Narrative lanes users can work on (Origins, Childhood, Work & Purpose, etc.)."""

    __tablename__ = "process_section"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the section",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent process version",
    )

    section_key = Column(
        String(100),
        nullable=False,
        doc="Code-friendly key, e.g., 'origins', 'childhood', 'love_partnership'",
    )
    section_name = Column(
        String(200),
        nullable=False,
        doc="Display name, e.g., 'Love & Partnership'",
    )
    description = Column(
        Text,
        doc="Description of the section",
    )

    order_index = Column(
        Integer,
        doc="Order position in the section list",
    )
    is_core = Column(
        Boolean,
        default=True,
        doc="Core vs conditional sections",
    )

    # Conditional activation
    requires_scope = Column(
        String(50),
        doc="Scope requirement: 'whole_life', 'major_chapter', 'single_event', null=any",
    )
    requires_profile_flags = Column(
        JSONB,
        doc="Profile flags required, e.g., {'has_children': true}",
    )

    # Unlocking logic (self-reference)
    unlock_after_section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_section.id"),
        nullable=True,
        doc="Reference to section that must be completed first",
    )
    minimum_prompts_required = Column(
        Integer,
        default=0,
        doc="Number of prompts required for progressive unlocking",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the section was created",
    )

    # Relationships
    process_version = relationship(
        "ProcessVersion",
        back_populates="sections",
    )
    unlock_after_section = relationship(
        "ProcessSection",
        remote_side=[id],
        foreign_keys=[unlock_after_section_id],
    )
    section_prompts = relationship(
        "SectionPrompt",
        back_populates="section",
        cascade="all, delete-orphan",
    )


class SectionPrompt(Base):
    """Links prompts to sections. A section can have multiple prompt packs."""

    __tablename__ = "section_prompt"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the section prompt link",
    )
    section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_section.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent section",
    )
    process_prompt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_prompt.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the process prompt",
    )
    order_index = Column(
        Integer,
        doc="Order position within the section",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the link was created",
    )

    # Relationships
    section = relationship(
        "ProcessSection",
        back_populates="section_prompts",
    )
    process_prompt = relationship(
        "ProcessPrompt",
        back_populates="section_prompts",
    )


# Export all models
__all__ = [
    "ProcessVersion",
    "ProcessCommitment",
    "ProcessNodeType",
    "ProcessNode",
    "ProcessFlowEdge",
    "ProcessPrompt",
    "PromptPackTemplate",
    "PromptPackPrompt",
    "ProcessSection",
    "SectionPrompt",
]
