"""Add all schema models

Revision ID: a389ba320666
Revises:
Create Date: 2025-12-21T12:49:38.846740

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a389ba320666'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables for the Everbound schema."""

    op.create_table('agent',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_key', sa.String(length=100), nullable=False),
        sa.Column('agent_name', sa.String(length=200), nullable=False),
        sa.Column('agent_description', sa.Text(), nullable=True),
        sa.Column('agent_type', sa.String(length=50), nullable=True),
        sa.Column('primary_objective', sa.Text(), nullable=True),
        sa.Column('secondary_objectives', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('base_constraints', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('default_tone', sa.String(length=50), nullable=True),
        sa.Column('persona_description', sa.Text(), nullable=True),
        sa.Column('communication_style', sa.Text(), nullable=True),
        sa.Column('can_create_artifacts', sa.Boolean(), nullable=True),
        sa.Column('can_analyze_content', sa.Boolean(), nullable=True),
        sa.Column('can_generate_prompts', sa.Boolean(), nullable=True),
        sa.Column('can_provide_feedback', sa.Boolean(), nullable=True),
        sa.Column('used_in_process_phases', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('suggested_for_node_types', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('system_prompt_template', sa.Text(), nullable=True),
        sa.Column('greeting_template', sa.Text(), nullable=True),
        sa.Column('closing_template', sa.Text(), nullable=True),
        sa.Column('default_model', sa.String(length=50), nullable=True),
        sa.Column('temperature', sa.Numeric(precision=2, scale=1), nullable=True),
        sa.Column('max_tokens', sa.Integer(), nullable=True),
        sa.Column('configuration', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('agent_instance',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('instance_objective', sa.Text(), nullable=True),
        sa.Column('instance_constraints', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('agent_context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('tone_override', sa.String(length=50), nullable=True),
        sa.Column('model_override', sa.String(length=50), nullable=True),
        sa.Column('temperature_override', sa.Numeric(precision=2, scale=1), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('paused_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('total_interactions', sa.Integer(), nullable=True),
        sa.Column('total_artifacts_created', sa.Integer(), nullable=True),
        sa.Column('average_response_time_ms', sa.Integer(), nullable=True),
        sa.Column('user_satisfaction_rating', sa.Integer(), nullable=True),
        sa.Column('flagged_for_review', sa.Boolean(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('archetype_analysis',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('analysis_scope', sa.String(length=50), nullable=True),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('analysis_version', sa.Integer(), nullable=True),
        sa.Column('analyzed_at', sa.DateTime(), nullable=True),
        sa.Column('inferred_archetype', sa.String(length=100), nullable=True),
        sa.Column('confidence_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('supporting_evidence', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('narrative_patterns', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('thematic_indicators', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('emotional_arc_description', sa.Text(), nullable=True),
        sa.Column('character_development_notes', sa.Text(), nullable=True),
        sa.Column('secondary_archetype', sa.String(length=100), nullable=True),
        sa.Column('secondary_confidence', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('alternative_archetypes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('identity_before', sa.Text(), nullable=True),
        sa.Column('identity_after', sa.Text(), nullable=True),
        sa.Column('identity_shift_type', sa.String(length=100), nullable=True),
        sa.Column('relationship_to_loss', sa.Text(), nullable=True),
        sa.Column('relationship_to_agency', sa.Text(), nullable=True),
        sa.Column('relationship_to_meaning', sa.Text(), nullable=True),
        sa.Column('revealed_to_user', sa.Boolean(), nullable=True),
        sa.Column('revealed_at', sa.DateTime(), nullable=True),
        sa.Column('user_feedback_received', sa.Boolean(), nullable=True),
        sa.Column('user_confirmed', sa.Boolean(), nullable=True),
        sa.Column('user_reframed_as', sa.String(length=100), nullable=True),
        sa.Column('user_reframe_notes', sa.Text(), nullable=True),
        sa.Column('analysis_method', sa.String(length=100), nullable=True),
        sa.Column('analysis_notes', sa.Text(), nullable=True),
        sa.Column('previous_analysis_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('book_export',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('export_format', sa.String(length=50), nullable=True),
        sa.Column('export_version', sa.Integer(), nullable=True),
        sa.Column('export_scope', sa.String(length=50), nullable=True),
        sa.Column('chapter_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('collection_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('format_options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('export_status', sa.String(length=50), nullable=True),
        sa.Column('generation_started_at', sa.DateTime(), nullable=True),
        sa.Column('generation_completed_at', sa.DateTime(), nullable=True),
        sa.Column('generation_duration_seconds', sa.Integer(), nullable=True),
        sa.Column('file_url', sa.Text(), nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('file_checksum', sa.String(length=64), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('downloaded_count', sa.Integer(), nullable=True),
        sa.Column('last_downloaded_at', sa.DateTime(), nullable=True),
        sa.Column('failed_at', sa.DateTime(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('error_log', sa.Text(), nullable=True),
        sa.Column('generated_by', sa.String(length=100), nullable=True),
        sa.Column('generation_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('book_export_delivery',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('book_export_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('delivery_method', sa.String(length=50), nullable=True),
        sa.Column('delivered_to', sa.String(length=300), nullable=True),
        sa.Column('delivery_status', sa.String(length=50), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('downloaded_at', sa.DateTime(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('chapter_section',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('section_number', sa.Integer(), nullable=False),
        sa.Column('section_title', sa.String(length=200), nullable=True),
        sa.Column('section_type', sa.String(length=50), nullable=True),
        sa.Column('scene_setting', sa.String(length=500), nullable=True),
        sa.Column('scene_characters', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('scene_purpose', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('uses_dialogue', sa.Boolean(), nullable=True),
        sa.Column('uses_sensory_details', sa.Boolean(), nullable=True),
        sa.Column('uses_internal_monologue', sa.Boolean(), nullable=True),
        sa.Column('show_vs_tell', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('sequence_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('chapter_theme',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('theme_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prominence', sa.String(length=50), nullable=True),
        sa.Column('how_explored', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chapter_id', 'theme_id', name='uq_chapter_theme'),
    )

    op.create_table('character_appearance',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('character_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role_in_scene', sa.String(length=100), nullable=True),
        sa.Column('significance_in_scene', sa.String(length=50), nullable=True),
        sa.Column('character_development', sa.Boolean(), nullable=True),
        sa.Column('development_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('character_relationship',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('character_a_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('character_b_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_type', sa.String(length=100), nullable=True),
        sa.Column('relationship_description', sa.Text(), nullable=True),
        sa.Column('has_arc', sa.Boolean(), nullable=True),
        sa.Column('relationship_arc', sa.String(length=100), nullable=True),
        sa.Column('initial_dynamic', sa.Text(), nullable=True),
        sa.Column('key_conflict', sa.Text(), nullable=True),
        sa.Column('resolution', sa.Text(), nullable=True),
        sa.Column('significance', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('character_a_id', 'character_b_id', name='uq_character_relationship'),
    )

    op.create_table('collection',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('organizing_principle', sa.String(length=100), nullable=True),
        sa.Column('organizing_value', sa.Text(), nullable=True),
        sa.Column('narrative_arc', sa.String(length=100), nullable=True),
        sa.Column('archetype_pattern', sa.String(length=100), nullable=True),
        sa.Column('collection_type', sa.String(length=50), nullable=True),
        sa.Column('is_provisional', sa.Boolean(), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('include_in_book', sa.Boolean(), nullable=True),
        sa.Column('book_section_type', sa.String(length=50), nullable=True),
        sa.Column('suggested_title', sa.String(length=200), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('synthesis_summary', sa.Text(), nullable=True),
        sa.Column('synthesis_themes', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('synthesis_tone', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('collection_grouping',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('grouping_name', sa.String(length=200), nullable=False),
        sa.Column('grouping_description', sa.Text(), nullable=True),
        sa.Column('grouping_type', sa.String(length=100), nullable=True),
        sa.Column('grouping_principle', sa.Text(), nullable=True),
        sa.Column('book_part_type', sa.String(length=50), nullable=True),
        sa.Column('suggested_part_title', sa.String(length=200), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('collection_grouping_member',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('grouping_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sequence_order', sa.Integer(), nullable=True),
        sa.Column('relationship_to_grouping', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('grouping_id', 'collection_id', name='uq_collection_grouping_member'),
    )

    op.create_table('collection_life_event',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sequence_order', sa.Integer(), nullable=True),
        sa.Column('is_anchor_event', sa.Boolean(), nullable=True),
        sa.Column('narrative_role', sa.String(length=100), nullable=True),
        sa.Column('narrative_function', sa.Text(), nullable=True),
        sa.Column('connection_to_theme', sa.Text(), nullable=True),
        sa.Column('added_at', sa.DateTime(), nullable=True),
        sa.Column('added_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('collection_id', 'life_event_id', name='uq_collection_life_event'),
    )

    op.create_table('collection_relationship',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_type', sa.String(length=100), nullable=True),
        sa.Column('relationship_description', sa.Text(), nullable=True),
        sa.Column('strength', sa.String(length=50), nullable=True),
        sa.Column('is_bidirectional', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_collection_id', 'target_collection_id', 'relationship_type', name='uq_collection_relationship'),
    )

    op.create_table('collection_synthesis',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('synthesis_type', sa.String(length=50), nullable=True),
        sa.Column('synthesis_version', sa.Integer(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('structured_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_provisional', sa.Boolean(), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('user_feedback', sa.Text(), nullable=True),
        sa.Column('needs_revision', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('collection_tag',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_category', sa.String(length=100), nullable=True),
        sa.Column('tag_value', sa.String(length=200), nullable=True),
        sa.Column('relevance_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('edit_requirement',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('character_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('theme_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('edit_type', sa.String(length=100), nullable=True),
        sa.Column('requirement_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('specific_changes', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(length=50), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completion_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_type', sa.String(length=150), nullable=False),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('task_context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=True),
        sa.Column('event_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('significance_level', sa.String(length=50), nullable=True),
        sa.Column('emotional_tone', sa.String(length=50), nullable=True),
        sa.Column('is_turning_point', sa.Boolean(), nullable=True),
        sa.Column('is_ongoing', sa.Boolean(), nullable=True),
        sa.Column('include_in_story', sa.Boolean(), nullable=True),
        sa.Column('include_level', sa.String(length=50), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_boundary',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('override_storyteller_default', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing', sa.Boolean(), nullable=True),
        sa.Column('privacy_level', sa.String(length=50), nullable=True),
        sa.Column('can_mention_but_not_detail', sa.Boolean(), nullable=True),
        sa.Column('requires_pseudonyms', sa.Boolean(), nullable=True),
        sa.Column('requires_location_anonymization', sa.Boolean(), nullable=True),
        sa.Column('consent_to_deepen', sa.Boolean(), nullable=True),
        sa.Column('consent_date', sa.DateTime(), nullable=True),
        sa.Column('off_limit_aspects', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('boundary_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_detail',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('detail_key', sa.String(length=100), nullable=False),
        sa.Column('detail_value', sa.Text(), nullable=False),
        sa.Column('detail_type', sa.String(length=50), nullable=True),
        sa.Column('display_label', sa.String(length=200), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('is_private', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_location',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location_name', sa.String(length=200), nullable=True),
        sa.Column('location_type', sa.String(length=50), nullable=True),
        sa.Column('is_primary_location', sa.Boolean(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_media',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('media_type', sa.String(length=50), nullable=True),
        sa.Column('file_url', sa.Text(), nullable=False),
        sa.Column('thumbnail_url', sa.Text(), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('approximate_date', sa.Date(), nullable=True),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('people_in_media', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('has_usage_rights', sa.Boolean(), nullable=True),
        sa.Column('can_publish', sa.Boolean(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_participant',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('nickname', sa.String(length=100), nullable=True),
        sa.Column('relationship_type', sa.String(length=100), nullable=True),
        sa.Column('role_in_event', sa.String(length=200), nullable=True),
        sa.Column('significance', sa.String(length=50), nullable=True),
        sa.Column('use_real_name', sa.Boolean(), nullable=True),
        sa.Column('pseudonym', sa.String(length=100), nullable=True),
        sa.Column('is_deceased', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_preference',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('preferred_depth', sa.String(length=50), nullable=True),
        sa.Column('preferred_approach', sa.String(length=50), nullable=True),
        sa.Column('wants_multiple_sessions', sa.Boolean(), nullable=True),
        sa.Column('estimated_sessions_needed', sa.Integer(), nullable=True),
        sa.Column('prefers_specific_prompts', sa.Boolean(), nullable=True),
        sa.Column('prefers_voice_for_this', sa.Boolean(), nullable=True),
        sa.Column('should_be_chapter', sa.Boolean(), nullable=True),
        sa.Column('suggested_chapter_title', sa.String(length=200), nullable=True),
        sa.Column('merge_with_other_event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('agent_should_be_gentle', sa.Boolean(), nullable=True),
        sa.Column('agent_should_validate_facts', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_timespan',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('timespan_type', sa.String(length=50), nullable=True),
        sa.Column('start_year', sa.Integer(), nullable=True),
        sa.Column('start_month', sa.Integer(), nullable=True),
        sa.Column('start_day', sa.Integer(), nullable=True),
        sa.Column('start_approximate', sa.Boolean(), nullable=True),
        sa.Column('end_year', sa.Integer(), nullable=True),
        sa.Column('end_month', sa.Integer(), nullable=True),
        sa.Column('end_day', sa.Integer(), nullable=True),
        sa.Column('end_approximate', sa.Boolean(), nullable=True),
        sa.Column('is_ongoing', sa.Boolean(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('life_event_trauma',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_trauma', sa.Boolean(), nullable=True),
        sa.Column('trauma_type', sa.String(length=100), nullable=True),
        sa.Column('trauma_status', sa.String(length=50), nullable=False),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('requires_explicit_consent', sa.Boolean(), nullable=True),
        sa.Column('consent_given', sa.Boolean(), nullable=True),
        sa.Column('consent_date', sa.DateTime(), nullable=True),
        sa.Column('recommends_professional_support', sa.Boolean(), nullable=True),
        sa.Column('support_notes', sa.Text(), nullable=True),
        sa.Column('default_privacy_level', sa.String(length=50), nullable=True),
        sa.Column('assessed_by', sa.String(length=100), nullable=True),
        sa.Column('assessed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_commitment',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_flow_edge',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('to_node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('condition_type', sa.String(length=50), nullable=True),
        sa.Column('condition_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('edge_label', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_node',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('node_type_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('node_key', sa.String(length=100), nullable=False),
        sa.Column('node_name', sa.String(length=200), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('purpose', sa.Text(), nullable=False),
        sa.Column('outcome', sa.Text(), nullable=True),
        sa.Column('user_facing_text', sa.Text(), nullable=True),
        sa.Column('is_optional', sa.Boolean(), nullable=True),
        sa.Column('requires_completion', sa.Boolean(), nullable=True),
        sa.Column('agent_objective', sa.Text(), nullable=True),
        sa.Column('agent_constraints', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_node_type',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type_name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('requires_user_input', sa.Boolean(), nullable=True),
        sa.Column('can_skip', sa.Boolean(), nullable=True),
        sa.Column('is_repeatable', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_prompt',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_node_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt_key', sa.String(length=100), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('prompt_type', sa.String(length=50), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), nullable=True),
        sa.Column('sensitivity_tier', sa.Integer(), nullable=True),
        sa.Column('response_format', sa.String(length=50), nullable=True),
        sa.Column('max_length', sa.Integer(), nullable=True),
        sa.Column('example_response', sa.Text(), nullable=True),
        sa.Column('condition_type', sa.String(length=50), nullable=True),
        sa.Column('condition_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_section',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('section_key', sa.String(length=100), nullable=False),
        sa.Column('section_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('is_core', sa.Boolean(), nullable=True),
        sa.Column('requires_scope', sa.String(length=50), nullable=True),
        sa.Column('requires_profile_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('unlock_after_section_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('minimum_prompts_required', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('process_version',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('prompt_pack_prompt',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt_pack_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('prompt_key', sa.String(length=100), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('prompt_type', sa.String(length=50), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('prompt_pack_template',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('template_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_global', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('requirement',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_section_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('requirement_type', sa.String(length=100), nullable=True),
        sa.Column('requirement_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(length=50), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completion_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('scope_type',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('scope_key', sa.String(length=50), nullable=False),
        sa.Column('scope_name', sa.String(length=200), nullable=False),
        sa.Column('scope_description', sa.Text(), nullable=True),
        sa.Column('user_facing_label', sa.String(length=200), nullable=True),
        sa.Column('user_facing_description', sa.Text(), nullable=True),
        sa.Column('example_use_cases', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('required_context_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('enabled_sections', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('suggested_sections', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('minimum_life_events', sa.Integer(), nullable=True),
        sa.Column('estimated_sessions', sa.Integer(), nullable=True),
        sa.Column('completion_criteria', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('default_narrative_structure', sa.String(length=100), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('section_prompt',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_prompt_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_process_node_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('session_name', sa.String(length=200), nullable=True),
        sa.Column('intention', sa.Text(), nullable=False),
        sa.Column('success_indicators', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('completion_indicators', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('constraints', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('procedure_notes', sa.Text(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('scheduled_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('actual_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('success_rating', sa.Integer(), nullable=True),
        sa.Column('completion_percentage', sa.Integer(), nullable=True),
        sa.Column('needs_followup', sa.Boolean(), nullable=True),
        sa.Column('followup_notes', sa.Text(), nullable=True),
        sa.Column('next_session_suggestion', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_archetype',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('detected_archetype', sa.String(length=100), nullable=True),
        sa.Column('confidence_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('supporting_themes', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('supporting_patterns', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('supporting_interactions', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('alternative_archetypes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('analysis_notes', sa.Text(), nullable=True),
        sa.Column('analyzed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_artifact',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('artifact_type', sa.String(length=50), nullable=True),
        sa.Column('artifact_name', sa.String(length=200), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('structured_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_provisional', sa.Boolean(), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('included_in_synthesis', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_interaction',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('interaction_sequence', sa.Integer(), nullable=False),
        sa.Column('interaction_type', sa.String(length=50), nullable=True),
        sa.Column('agent_prompt', sa.Text(), nullable=True),
        sa.Column('prompt_category', sa.String(length=100), nullable=True),
        sa.Column('storyteller_response', sa.Text(), nullable=True),
        sa.Column('response_method', sa.String(length=50), nullable=True),
        sa.Column('sentiment', sa.String(length=50), nullable=True),
        sa.Column('key_themes', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('mentions_people', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('mentions_places', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_life_event',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('is_primary_focus', sa.Boolean(), nullable=True),
        sa.Column('coverage_level', sa.String(length=50), nullable=True),
        sa.Column('prompts_completed', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'life_event_id', name='uq_session_life_event'),
    )

    op.create_table('session_note',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('note_type', sa.String(length=50), nullable=True),
        sa.Column('note_content', sa.Text(), nullable=False),
        sa.Column('noted_at_interaction_sequence', sa.Integer(), nullable=True),
        sa.Column('is_important', sa.Boolean(), nullable=True),
        sa.Column('requires_followup', sa.Boolean(), nullable=True),
        sa.Column('noted_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_profile',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('profile_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('contextual_facts', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('people_mentioned', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('places_mentioned', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('time_periods_mentioned', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('profile_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('current_node_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('overall_progress_percentage', sa.Integer(), nullable=True),
        sa.Column('goals_completed', sa.Integer(), nullable=True),
        sa.Column('goals_total', sa.Integer(), nullable=True),
        sa.Column('prompts_asked', sa.Integer(), nullable=True),
        sa.Column('prompts_answered', sa.Integer(), nullable=True),
        sa.Column('prompts_skipped', sa.Integer(), nullable=True),
        sa.Column('active_time_seconds', sa.Integer(), nullable=True),
        sa.Column('idle_time_seconds', sa.Integer(), nullable=True),
        sa.Column('nodes_visited', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('nodes_completed', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('last_activity_at', sa.DateTime(), nullable=True),
        sa.Column('progress_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_scope',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scope_type', sa.String(length=50), nullable=True),
        sa.Column('scope_description', sa.Text(), nullable=True),
        sa.Column('focus_areas', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('excluded_areas', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('start_year', sa.Integer(), nullable=True),
        sa.Column('end_year', sa.Integer(), nullable=True),
        sa.Column('scope_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_section_status',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_section_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('prompts_completed', sa.Integer(), nullable=True),
        sa.Column('prompts_total', sa.Integer(), nullable=True),
        sa.Column('completion_percentage', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('section_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'process_section_id', name='uq_session_section'),
    )

    op.create_table('session_synthesis',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_section_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('synthesis_type', sa.String(length=50), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('key_themes', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('key_insights', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('key_facts', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('confidence_score', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('included_in_story', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('session_template',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('template_name', sa.String(length=200), nullable=False),
        sa.Column('template_description', sa.Text(), nullable=True),
        sa.Column('suggested_for_event_types', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('suggested_for_process_nodes', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('default_intention', sa.Text(), nullable=True),
        sa.Column('default_success_indicators', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('default_completion_indicators', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('default_constraints', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('default_procedure_notes', sa.Text(), nullable=True),
        sa.Column('default_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('story',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('subtitle', sa.String(length=300), nullable=True),
        sa.Column('working_title', sa.String(length=300), nullable=True),
        sa.Column('overall_archetype', sa.String(length=100), nullable=True),
        sa.Column('secondary_archetypes', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('narrative_structure', sa.String(length=100), nullable=True),
        sa.Column('point_of_view', sa.String(length=50), nullable=True),
        sa.Column('narrative_voice', sa.String(length=100), nullable=True),
        sa.Column('tense', sa.String(length=50), nullable=True),
        sa.Column('tone', sa.String(length=100), nullable=True),
        sa.Column('intended_audience', sa.String(length=200), nullable=True),
        sa.Column('primary_purpose', sa.Text(), nullable=True),
        sa.Column('central_question', sa.Text(), nullable=True),
        sa.Column('central_themes', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('story_timeframe_start', sa.Integer(), nullable=True),
        sa.Column('story_timeframe_end', sa.Integer(), nullable=True),
        sa.Column('uses_flashback', sa.Boolean(), nullable=True),
        sa.Column('uses_flashforward', sa.Boolean(), nullable=True),
        sa.Column('opening_strategy', sa.String(length=100), nullable=True),
        sa.Column('closing_strategy', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('current_draft_version', sa.Integer(), nullable=True),
        sa.Column('estimated_word_count', sa.Integer(), nullable=True),
        sa.Column('target_word_count', sa.Integer(), nullable=True),
        sa.Column('estimated_page_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('story_chapter',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_number', sa.Integer(), nullable=False),
        sa.Column('chapter_title', sa.String(length=300), nullable=True),
        sa.Column('chapter_subtitle', sa.String(length=300), nullable=True),
        sa.Column('chapter_type', sa.String(length=100), nullable=True),
        sa.Column('narrative_purpose', sa.Text(), nullable=True),
        sa.Column('narrative_position', sa.String(length=50), nullable=True),
        sa.Column('chapter_arc', sa.String(length=100), nullable=True),
        sa.Column('emotional_arc', sa.Text(), nullable=True),
        sa.Column('opening_hook', sa.Text(), nullable=True),
        sa.Column('closing_resonance', sa.Text(), nullable=True),
        sa.Column('chapter_timeframe_start', sa.Integer(), nullable=True),
        sa.Column('chapter_timeframe_end', sa.Integer(), nullable=True),
        sa.Column('primary_mode', sa.String(length=50), nullable=True),
        sa.Column('scene_to_summary_ratio', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('epigraph', sa.Text(), nullable=True),
        sa.Column('epigraph_attribution', sa.String(length=200), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('current_draft_version', sa.Integer(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('estimated_word_count', sa.Integer(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('story_character',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('character_name', sa.String(length=200), nullable=False),
        sa.Column('real_name', sa.String(length=200), nullable=True),
        sa.Column('is_pseudonym', sa.Boolean(), nullable=True),
        sa.Column('character_type', sa.String(length=50), nullable=True),
        sa.Column('relationship_to_protagonist', sa.String(length=100), nullable=True),
        sa.Column('physical_description', sa.Text(), nullable=True),
        sa.Column('personality_traits', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('speech_patterns', sa.Text(), nullable=True),
        sa.Column('backstory', sa.Text(), nullable=True),
        sa.Column('motivation', sa.Text(), nullable=True),
        sa.Column('has_arc', sa.Boolean(), nullable=True),
        sa.Column('arc_type', sa.String(length=100), nullable=True),
        sa.Column('arc_description', sa.Text(), nullable=True),
        sa.Column('initial_state', sa.Text(), nullable=True),
        sa.Column('transformation', sa.Text(), nullable=True),
        sa.Column('final_state', sa.Text(), nullable=True),
        sa.Column('degree_of_revelation', sa.String(length=50), nullable=True),
        sa.Column('privacy_level', sa.String(length=50), nullable=True),
        sa.Column('composite_of', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('first_appearance_chapter_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('introduction_strategy', sa.Text(), nullable=True),
        sa.Column('is_living', sa.Boolean(), nullable=True),
        sa.Column('consent_obtained', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('story_collection',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('usage_type', sa.String(length=50), nullable=True),
        sa.Column('material_used', sa.Text(), nullable=True),
        sa.Column('transformation_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('story_id', 'chapter_id', 'collection_id', name='uq_story_collection'),
    )

    op.create_table('story_draft',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('draft_type', sa.String(length=50), nullable=True),
        sa.Column('draft_version', sa.Integer(), nullable=False),
        sa.Column('version_name', sa.String(length=100), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('revision_notes', sa.Text(), nullable=True),
        sa.Column('feedback_received', sa.Text(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('story_scene',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('section_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('life_event_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('scene_name', sa.String(length=200), nullable=True),
        sa.Column('scene_description', sa.Text(), nullable=True),
        sa.Column('scene_setting', sa.Text(), nullable=True),
        sa.Column('scene_time', sa.String(length=200), nullable=True),
        sa.Column('scene_place', sa.String(length=200), nullable=True),
        sa.Column('scene_purpose', sa.Text(), nullable=True),
        sa.Column('reveals_character', sa.Text(), nullable=True),
        sa.Column('advances_plot', sa.Text(), nullable=True),
        sa.Column('develops_theme', sa.Text(), nullable=True),
        sa.Column('visual_details', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('auditory_details', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('tactile_details', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('olfactory_details', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('gustatory_details', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('has_dialogue', sa.Boolean(), nullable=True),
        sa.Column('dialogue_snippet', sa.Text(), nullable=True),
        sa.Column('has_internal_monologue', sa.Boolean(), nullable=True),
        sa.Column('internal_thoughts', sa.Text(), nullable=True),
        sa.Column('emotional_tone', sa.String(length=50), nullable=True),
        sa.Column('opening_image', sa.Text(), nullable=True),
        sa.Column('inciting_action', sa.Text(), nullable=True),
        sa.Column('complication', sa.Text(), nullable=True),
        sa.Column('climax', sa.Text(), nullable=True),
        sa.Column('resolution', sa.Text(), nullable=True),
        sa.Column('reflection', sa.Text(), nullable=True),
        sa.Column('meaning_made', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('story_theme',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('story_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('theme_name', sa.String(length=200), nullable=False),
        sa.Column('theme_description', sa.Text(), nullable=True),
        sa.Column('theme_type', sa.String(length=50), nullable=True),
        sa.Column('symbols', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('motifs', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('imagery', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('theme_arc', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('storyteller',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('relationship_to_user', sa.String(length=50), nullable=True),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('middle_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('preferred_name', sa.String(length=100), nullable=True),
        sa.Column('birth_year', sa.Integer(), nullable=True),
        sa.Column('birth_month', sa.Integer(), nullable=True),
        sa.Column('birth_day', sa.Integer(), nullable=True),
        sa.Column('birth_place', sa.String(length=200), nullable=True),
        sa.Column('is_living', sa.Boolean(), nullable=True),
        sa.Column('current_location', sa.String(length=200), nullable=True),
        sa.Column('consent_given', sa.Boolean(), nullable=True),
        sa.Column('consent_date', sa.DateTime(), nullable=True),
        sa.Column('profile_image_url', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('storyteller_boundary',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comfortable_discussing_romance', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_intimacy', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_loss', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_trauma', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_illness', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_conflict', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_faith', sa.Boolean(), nullable=True),
        sa.Column('comfortable_discussing_finances', sa.Boolean(), nullable=True),
        sa.Column('prefers_some_private', sa.Boolean(), nullable=True),
        sa.Column('wants_explicit_warnings', sa.Boolean(), nullable=True),
        sa.Column('off_limit_topics', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('maximum_tier_comfortable', sa.Integer(), nullable=True),
        sa.Column('additional_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('storyteller_preference',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('preferred_input_method', sa.String(length=50), nullable=True),
        sa.Column('session_length_preference', sa.String(length=50), nullable=True),
        sa.Column('desired_book_tone', sa.String(length=50), nullable=True),
        sa.Column('desired_book_length', sa.String(length=50), nullable=True),
        sa.Column('wants_photos_included', sa.Boolean(), nullable=True),
        sa.Column('wants_documents_included', sa.Boolean(), nullable=True),
        sa.Column('wants_letters_quotes_included', sa.Boolean(), nullable=True),
        sa.Column('intended_audience', sa.String(length=100), nullable=True),
        sa.Column('primary_language', sa.String(length=50), nullable=True),
        sa.Column('additional_preferences', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('storyteller_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_phase', sa.String(length=100), nullable=True),
        sa.Column('phase_status', sa.String(length=50), nullable=True),
        sa.Column('overall_completion_percentage', sa.Integer(), nullable=True),
        sa.Column('phases_completed', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('phases_skipped', postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column('first_session_at', sa.DateTime(), nullable=True),
        sa.Column('first_capture_at', sa.DateTime(), nullable=True),
        sa.Column('first_synthesis_at', sa.DateTime(), nullable=True),
        sa.Column('book_started_at', sa.DateTime(), nullable=True),
        sa.Column('book_completed_at', sa.DateTime(), nullable=True),
        sa.Column('last_active_at', sa.DateTime(), nullable=True),
        sa.Column('total_sessions_count', sa.Integer(), nullable=True),
        sa.Column('total_interactions_count', sa.Integer(), nullable=True),
        sa.Column('total_artifacts_count', sa.Integer(), nullable=True),
        sa.Column('suggested_next_phase', sa.String(length=100), nullable=True),
        sa.Column('suggested_next_action', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('storyteller_section_selection',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_section_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('selected_during_phase', sa.String(length=50), nullable=True),
        sa.Column('selection_reason', sa.String(length=100), nullable=True),
        sa.Column('priority_level', sa.String(length=50), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.Column('selected_at', sa.DateTime(), nullable=True),
        sa.Column('user_notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('storyteller_id', 'process_section_id', name='uq_section_selection'),
    )

    op.create_table('storyteller_section_status',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('process_section_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('unlocked_at', sa.DateTime(), nullable=True),
        sa.Column('unlocked_by', sa.String(length=100), nullable=True),
        sa.Column('unlock_reason', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('skipped_at', sa.DateTime(), nullable=True),
        sa.Column('skip_reason', sa.Text(), nullable=True),
        sa.Column('prompts_answered', sa.Integer(), nullable=True),
        sa.Column('prompts_total', sa.Integer(), nullable=True),
        sa.Column('scenes_captured', sa.Integer(), nullable=True),
        sa.Column('life_events_created', sa.Integer(), nullable=True),
        sa.Column('completion_percentage', sa.Integer(), nullable=True),
        sa.Column('prerequisite_sections_met', sa.Boolean(), nullable=True),
        sa.Column('prerequisite_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('storyteller_id', 'process_section_id', name='uq_section_status'),
    )

    op.create_table('user_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storyteller_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('feedback_on_type', sa.String(length=50), nullable=True),
        sa.Column('feedback_on_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('feedback_on_name', sa.String(length=200), nullable=True),
        sa.Column('feedback_type', sa.String(length=50), nullable=True),
        sa.Column('feedback_category', sa.String(length=100), nullable=True),
        sa.Column('feedback_text', sa.Text(), nullable=False),
        sa.Column('specific_issue', sa.Text(), nullable=True),
        sa.Column('suggested_change', sa.Text(), nullable=True),
        sa.Column('sentiment', sa.String(length=50), nullable=True),
        sa.Column('priority', sa.String(length=50), nullable=True),
        sa.Column('requires_immediate_action', sa.Boolean(), nullable=True),
        sa.Column('agent_response', sa.Text(), nullable=True),
        sa.Column('resolution_status', sa.String(length=50), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('used_for_improvement', sa.Boolean(), nullable=True),
        sa.Column('improvement_notes', sa.Text(), nullable=True),
        sa.Column('feedback_given_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Add foreign key constraints
    op.create_foreign_key(None, 'agent_instance', 'agent', ['agent_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'agent_instance', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'agent_instance', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'archetype_analysis', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'archetype_analysis', 'archetype_analysis', ['previous_analysis_id'], ['id'])
    op.create_foreign_key(None, 'archetype_analysis', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'archetype_analysis', 'collection', ['collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'book_export', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'book_export', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'book_export_delivery', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'book_export_delivery', 'book_export', ['book_export_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'chapter_section', 'story_chapter', ['chapter_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'chapter_theme', 'story_chapter', ['chapter_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'chapter_theme', 'story_theme', ['theme_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'character_appearance', 'story_character', ['character_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'character_appearance', 'story_chapter', ['chapter_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'character_appearance', 'chapter_section', ['section_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'character_relationship', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'character_relationship', 'story_character', ['character_a_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'character_relationship', 'story_character', ['character_b_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_grouping', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_grouping_member', 'collection_grouping', ['grouping_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_grouping_member', 'collection', ['collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_life_event', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_life_event', 'collection', ['collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_relationship', 'collection', ['target_collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_relationship', 'collection', ['source_collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_synthesis', 'collection', ['collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'collection_tag', 'collection', ['collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'edit_requirement', 'story_theme', ['theme_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'edit_requirement', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'edit_requirement', 'story_chapter', ['chapter_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'edit_requirement', 'story_character', ['character_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'edit_requirement', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'edit_requirement', 'chapter_section', ['section_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'life_event', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_boundary', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_detail', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_location', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_media', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_participant', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_preference', 'life_event', ['merge_with_other_event_id'], ['id'])
    op.create_foreign_key(None, 'life_event_preference', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_timespan', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'life_event_trauma', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_commitment', 'process_version', ['process_version_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_flow_edge', 'process_version', ['process_version_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_flow_edge', 'process_node', ['to_node_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_flow_edge', 'process_node', ['from_node_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_node', 'process_version', ['process_version_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_node', 'process_node_type', ['node_type_id'], ['id'])
    op.create_foreign_key(None, 'process_prompt', 'process_node', ['process_node_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'process_section', 'process_section', ['unlock_after_section_id'], ['id'])
    op.create_foreign_key(None, 'process_section', 'process_version', ['process_version_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'prompt_pack_prompt', 'prompt_pack_template', ['prompt_pack_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'requirement', 'process_section', ['process_section_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'requirement', 'collection', ['collection_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'requirement', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'requirement', 'session', ['session_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'requirement', 'life_event', ['life_event_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'scope_type', 'process_version', ['process_version_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'section_prompt', 'process_section', ['section_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'section_prompt', 'process_prompt', ['process_prompt_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session', 'process_version', ['process_version_id'], ['id'])
    op.create_foreign_key(None, 'session', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session', 'process_node', ['current_process_node_id'], ['id'])
    op.create_foreign_key(None, 'session_archetype', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_artifact', 'life_event', ['life_event_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'session_artifact', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_interaction', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_interaction', 'life_event', ['life_event_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'session_life_event', 'life_event', ['life_event_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_life_event', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_note', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_profile', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_progress', 'process_node', ['current_node_id'], ['id'])
    op.create_foreign_key(None, 'session_progress', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_scope', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_section_status', 'process_section', ['process_section_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_section_status', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_synthesis', 'process_section', ['process_section_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'session_synthesis', 'session', ['session_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'session_template', 'process_version', ['process_version_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_chapter', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_character', 'storyteller', ['storyteller_id'], ['id'])
    op.create_foreign_key(None, 'story_character', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_character', 'story_chapter', ['first_appearance_chapter_id'], ['id'])
    op.create_foreign_key(None, 'story_collection', 'collection', ['collection_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_collection', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_collection', 'story_chapter', ['chapter_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_draft', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_draft', 'story_chapter', ['chapter_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_scene', 'life_event', ['life_event_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'story_scene', 'story_chapter', ['chapter_id'], ['id'])
    op.create_foreign_key(None, 'story_scene', 'chapter_section', ['section_id'], ['id'])
    op.create_foreign_key(None, 'story_scene', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'story_theme', 'story', ['story_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_boundary', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_preference', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_progress', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_progress', 'process_version', ['process_version_id'], ['id'])
    op.create_foreign_key(None, 'storyteller_section_selection', 'process_section', ['process_section_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_section_selection', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_section_status', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'storyteller_section_status', 'process_section', ['process_section_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key(None, 'user_feedback', 'storyteller', ['storyteller_id'], ['id'], ondelete='CASCADE')

    # Add indexes
    op.create_index('idx_agent_key', 'agent', ['agent_key'])
    op.create_index('idx_agent_type', 'agent', ['agent_type'])
    op.create_index('idx_agent_instance_status', 'agent_instance', ['status'])
    op.create_index('idx_agent_instance_session', 'agent_instance', ['session_id'])
    op.create_index('idx_agent_instance_storyteller', 'agent_instance', ['storyteller_id'])
    op.create_index('idx_agent_instance_agent', 'agent_instance', ['agent_id'])
    op.create_index('idx_archetype_analysis_storyteller', 'archetype_analysis', ['storyteller_id'])
    op.create_index('idx_archetype_analysis_collection', 'archetype_analysis', ['collection_id'])
    op.create_index('idx_archetype_analysis_story', 'archetype_analysis', ['story_id'])
    op.create_index('idx_archetype_analysis_revealed', 'archetype_analysis', ['revealed_to_user'])
    op.create_index('idx_book_export_status', 'book_export', ['export_status'])
    op.create_index('idx_book_export_story', 'book_export', ['story_id'])
    op.create_index('idx_book_export_storyteller', 'book_export', ['storyteller_id'])
    op.create_index('idx_book_export_expires', 'book_export', ['expires_at'])
    op.create_index('idx_book_export_delivery_export', 'book_export_delivery', ['book_export_id'])
    op.create_index('idx_book_export_delivery_status', 'book_export_delivery', ['delivery_status'])
    op.create_index('idx_chapter_section_chapter', 'chapter_section', ['chapter_id', 'sequence_order'])
    op.create_index('idx_chapter_theme_chapter', 'chapter_theme', ['chapter_id'])
    op.create_index('idx_chapter_theme_theme', 'chapter_theme', ['theme_id'])
    op.create_index('idx_character_appearance_character', 'character_appearance', ['character_id'])
    op.create_index('idx_character_appearance_chapter', 'character_appearance', ['chapter_id'])
    op.create_index('idx_character_relationship_story', 'character_relationship', ['story_id'])
    op.create_index('idx_collection_archetype', 'collection', ['archetype_pattern'])
    op.create_index('idx_collection_storyteller', 'collection', ['storyteller_id'])
    op.create_index('idx_collection_principle', 'collection', ['organizing_principle'])
    op.create_index('idx_collection_grouping_storyteller', 'collection_grouping', ['storyteller_id'])
    op.create_index('idx_collection_grouping_member_collection', 'collection_grouping_member', ['collection_id'])
    op.create_index('idx_collection_grouping_member_grouping', 'collection_grouping_member', ['grouping_id', 'sequence_order'])
    op.create_index('idx_collection_life_event_event', 'collection_life_event', ['life_event_id'])
    op.create_index('idx_collection_life_event_collection', 'collection_life_event', ['collection_id', 'sequence_order'])
    op.create_index('idx_collection_relationship_source', 'collection_relationship', ['source_collection_id'])
    op.create_index('idx_collection_relationship_target', 'collection_relationship', ['target_collection_id'])
    op.create_index('idx_collection_synthesis', 'collection_synthesis', ['collection_id', 'synthesis_version'])
    op.create_index('idx_collection_tag_collection', 'collection_tag', ['collection_id'])
    op.create_index('idx_collection_tag_category', 'collection_tag', ['tag_category', 'tag_value'])
    op.create_index('idx_edit_requirement_story', 'edit_requirement', ['story_id'])
    op.create_index('idx_edit_requirement_storyteller', 'edit_requirement', ['storyteller_id'])
    op.create_index('idx_edit_requirement_status', 'edit_requirement', ['status'])
    op.create_index('idx_life_event_type', 'life_event', ['event_type'])
    op.create_index('idx_life_event_storyteller', 'life_event', ['storyteller_id'])
    op.create_index('idx_life_event_detail', 'life_event_detail', ['life_event_id'])
    op.create_index('idx_life_event_detail_key', 'life_event_detail', ['life_event_id', 'detail_key'])
    op.create_index('idx_life_event_location', 'life_event_location', ['life_event_id'])
    op.create_index('idx_life_event_media', 'life_event_media', ['life_event_id'])
    op.create_index('idx_life_event_participant', 'life_event_participant', ['life_event_id'])
    op.create_index('idx_life_event_timespan', 'life_event_timespan', ['life_event_id'])
    op.create_index('idx_life_event_trauma', 'life_event_trauma', ['life_event_id'])
    op.create_index('idx_process_node_version', 'process_node', ['process_version_id', 'order_index'])
    op.create_index('idx_process_prompt_node', 'process_prompt', ['process_node_id', 'order_index'])
    op.create_index('idx_requirement_storyteller', 'requirement', ['storyteller_id'])
    op.create_index('idx_requirement_status', 'requirement', ['status'])
    op.create_index('idx_scope_type_key', 'scope_type', ['scope_key'])
    op.create_index('idx_session_storyteller', 'session', ['storyteller_id', 'status'])
    op.create_index('idx_session_status', 'session', ['status'])
    op.create_index('idx_session_scheduled', 'session', ['scheduled_at'])
    op.create_index('idx_session_archetype_session', 'session_archetype', ['session_id'])
    op.create_index('idx_session_artifact_session', 'session_artifact', ['session_id'])
    op.create_index('idx_session_artifact_type', 'session_artifact', ['artifact_type'])
    op.create_index('idx_session_interaction_session', 'session_interaction', ['session_id', 'interaction_sequence'])
    op.create_index('idx_session_interaction_event', 'session_interaction', ['life_event_id'])
    op.create_index('idx_session_life_event_session', 'session_life_event', ['session_id'])
    op.create_index('idx_session_life_event_event', 'session_life_event', ['life_event_id'])
    op.create_index('idx_session_note_session', 'session_note', ['session_id'])
    op.create_index('idx_session_section_status_section', 'session_section_status', ['process_section_id'])
    op.create_index('idx_session_section_status_session', 'session_section_status', ['session_id'])
    op.create_index('idx_session_synthesis_session', 'session_synthesis', ['session_id'])
    op.create_index('idx_story_storyteller', 'story', ['storyteller_id'])
    op.create_index('idx_story_chapter_story', 'story_chapter', ['story_id', 'chapter_number'])
    op.create_index('idx_story_chapter_order', 'story_chapter', ['story_id', 'display_order'])
    op.create_index('idx_story_character_type', 'story_character', ['character_type'])
    op.create_index('idx_story_character_story', 'story_character', ['story_id'])
    op.create_index('idx_story_collection_story', 'story_collection', ['story_id'])
    op.create_index('idx_story_collection_collection', 'story_collection', ['collection_id'])
    op.create_index('idx_story_collection_chapter', 'story_collection', ['chapter_id'])
    op.create_index('idx_story_draft_chapter', 'story_draft', ['chapter_id', 'draft_version'])
    op.create_index('idx_story_draft_story', 'story_draft', ['story_id', 'draft_version'])
    op.create_index('idx_story_scene_chapter', 'story_scene', ['chapter_id'])
    op.create_index('idx_story_scene_story', 'story_scene', ['story_id'])
    op.create_index('idx_story_theme_story', 'story_theme', ['story_id'])
    op.create_index('idx_storyteller_user', 'storyteller', ['user_id', 'is_active'])
    op.create_index('idx_storyteller_progress_phase', 'storyteller_progress', ['current_phase', 'phase_status'])
    op.create_index('idx_storyteller_progress', 'storyteller_progress', ['storyteller_id'])
    op.create_index('idx_section_selection_storyteller', 'storyteller_section_selection', ['storyteller_id'])
    op.create_index('idx_section_status_storyteller', 'storyteller_section_status', ['storyteller_id', 'status'])
    op.create_index('idx_section_status_section', 'storyteller_section_status', ['process_section_id'])
    op.create_index('idx_user_feedback_resolution', 'user_feedback', ['resolution_status'])
    op.create_index('idx_user_feedback_storyteller', 'user_feedback', ['storyteller_id'])
    op.create_index('idx_user_feedback_type', 'user_feedback', ['feedback_on_type', 'feedback_on_id'])
    op.create_index('idx_user_feedback_priority', 'user_feedback', ['priority', 'requires_immediate_action'])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('user_feedback')
    op.drop_table('storyteller_section_status')
    op.drop_table('storyteller_section_selection')
    op.drop_table('storyteller_progress')
    op.drop_table('storyteller_preference')
    op.drop_table('storyteller_boundary')
    op.drop_table('storyteller')
    op.drop_table('story_theme')
    op.drop_table('story_scene')
    op.drop_table('story_draft')
    op.drop_table('story_collection')
    op.drop_table('story_character')
    op.drop_table('story_chapter')
    op.drop_table('story')
    op.drop_table('session_template')
    op.drop_table('session_synthesis')
    op.drop_table('session_section_status')
    op.drop_table('session_scope')
    op.drop_table('session_progress')
    op.drop_table('session_profile')
    op.drop_table('session_note')
    op.drop_table('session_life_event')
    op.drop_table('session_interaction')
    op.drop_table('session_artifact')
    op.drop_table('session_archetype')
    op.drop_table('session')
    op.drop_table('section_prompt')
    op.drop_table('scope_type')
    op.drop_table('requirement')
    op.drop_table('prompt_pack_template')
    op.drop_table('prompt_pack_prompt')
    op.drop_table('process_version')
    op.drop_table('process_section')
    op.drop_table('process_prompt')
    op.drop_table('process_node_type')
    op.drop_table('process_node')
    op.drop_table('process_flow_edge')
    op.drop_table('process_commitment')
    op.drop_table('life_event_trauma')
    op.drop_table('life_event_timespan')
    op.drop_table('life_event_preference')
    op.drop_table('life_event_participant')
    op.drop_table('life_event_media')
    op.drop_table('life_event_location')
    op.drop_table('life_event_detail')
    op.drop_table('life_event_boundary')
    op.drop_table('life_event')
    op.drop_table('events')
    op.drop_table('edit_requirement')
    op.drop_table('collection_tag')
    op.drop_table('collection_synthesis')
    op.drop_table('collection_relationship')
    op.drop_table('collection_life_event')
    op.drop_table('collection_grouping_member')
    op.drop_table('collection_grouping')
    op.drop_table('collection')
    op.drop_table('character_relationship')
    op.drop_table('character_appearance')
    op.drop_table('chapter_theme')
    op.drop_table('chapter_section')
    op.drop_table('book_export_delivery')
    op.drop_table('book_export')
    op.drop_table('archetype_analysis')
    op.drop_table('agent_instance')
    op.drop_table('agent')
