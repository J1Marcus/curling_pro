# GenAI Launchpad Workflow Visualization Template

This template provides the structure for documenting backend feature workflows using Mermaid diagrams, specifically for the GenAI Launchpad event-driven architecture.

## Overview
Brief description of the feature and its primary workflows using the GenAI Launchpad framework.

## GenAI Launchpad Event-Driven Architecture

### 1. Complete Event Processing Flow
Shows the full flow from API request to workflow completion.

```mermaid
flowchart TD
    A[Client POST /events/] --> B[FastAPI endpoint.py]
    B --> C[Validate PlaceholderEventSchema]
    C --> D{Valid Schema?}
    D -->|No| E[Return 400 Bad Request]
    D -->|Yes| F[Create Event Record]
    F --> G[GenericRepository.create]
    G --> H[Store in Event Table]
    H --> I[Queue Celery Task]
    I --> J[celery_app.send_task]
    J --> K[Return 202 Accepted + task_id]
    
    L[Celery Worker] --> M[process_incoming_event]
    M --> N[Retrieve Event from DB]
    N --> O[WorkflowRegistry Lookup]
    O --> P[Instantiate Workflow]
    P --> Q[workflow.run event.data]
    Q --> R[TaskContext Creation]
    R --> S[Node Execution Loop]
    S --> T[Update Event.task_context]
    T --> U[Workflow Complete]
    
    I -.-> L
```

### 2. GenAI Launchpad Workflow Execution
Shows how workflows execute through the DAG-based node system.

```mermaid
flowchart TD
    A[workflow.run event] --> B[Create TaskContext]
    B --> C[Validate event_schema]
    C --> D[Set current_node = start]
    D --> E[Node Execution Loop]
    
    E --> F{should_stop?}
    F -->|Yes| G[End Workflow]
    F -->|No| H[Get Node Instance]
    H --> I[node_context logging]
    I --> J{Is Router Node?}
    
    J -->|No| K[node.process TaskContext]
    J -->|Yes| L[router.route TaskContext]
    
    K --> M[Update task_context.nodes]
    M --> N[Get Next Node]
    L --> N
    
    N --> O{Next Node Exists?}
    O -->|Yes| P[Set current_node]
    P --> E
    O -->|No| Q[Return TaskContext]
    
    G --> Q
```

### 3. TaskContext State Management
Shows how state flows through workflow nodes.

```mermaid
flowchart TD
    A[TaskContext Creation] --> B[event: validated_event]
    B --> C[nodes: empty dict]
    C --> D[metadata: workflow config]
    D --> E[should_stop: false]
    
    E --> F[Node 1 Processing]
    F --> G[task_context.update_node]
    G --> H[nodes: Node1: results]
    
    H --> I[Node 2 Processing]
    I --> J[Access previous results]
    J --> K[task_context.nodes.get Node1]
    K --> L[Process with context]
    L --> M[Update own results]
    
    M --> N[Continue to Next Node]
    N --> O[Final TaskContext]
    O --> P[All node results preserved]
```

### 4. Node Types and Patterns
Shows the different node types available in GenAI Launchpad.

```mermaid
flowchart TD
    A[Base Node] --> B[AgentNode]
    A --> C[ConcurrentNode]
    A --> D[BaseRouter]
    
    B --> E[AI Processing]
    E --> F[OpenAI/Anthropic/Gemini]
    F --> G[Structured Output]
    
    C --> H[Parallel Execution]
    H --> I[asyncio.gather]
    I --> J[Multiple Results]
    
    D --> K[Conditional Routing]
    K --> L[RouterNode.determine_next_node]
    L --> M[Dynamic Flow Control]
    
    N[Custom Node] --> O[Business Logic]
    O --> P[Database Operations]
    O --> Q[External API Calls]
    O --> R[File Processing]
```

### 5. Error Handling and Logging
Shows how errors are handled within the workflow framework.

```mermaid
flowchart TD
    A[Node Execution] --> B[node_context manager]
    B --> C[Log: Starting node]
    C --> D[Try: node.process]
    
    D --> E{Exception?}
    E -->|No| F[Log: Finished node]
    E -->|Yes| G[Log: Error in node]
    G --> H[Re-raise Exception]
    
    F --> I[Continue Workflow]
    H --> J[Workflow Termination]
    J --> K[TaskContext with Error]
    K --> L[Store in Event.task_context]
```

## Workflow Implementation Patterns

### Event Schema Definition
```python
class FeatureEventSchema(BaseModel):
    user_input: str
    metadata: Dict[str, Any]
    priority: Optional[str] = "normal"
```

### Node Implementation Pattern
```python
class ProcessingNode(Node):
    async def process(self, task_context: TaskContext) -> TaskContext:
        # Access event data
        event_data = task_context.event
        
        # Access previous node results
        previous_result = task_context.nodes.get("PreviousNode", {})
        
        # Perform processing
        result = await self.do_processing(event_data, previous_result)
        
        # Store results
        task_context.update_node(self.node_name,
                               result=result,
                               timestamp=datetime.now())
        
        return task_context
```

### Workflow Definition Pattern
```python
class FeatureWorkflow(Workflow):
    workflow_schema = WorkflowSchema(
        description="Feature processing workflow",
        event_schema=FeatureEventSchema,
        start=ValidationNode,
        nodes=[
            NodeConfig(
                node=ValidationNode,
                connections=[ProcessingNode],
                description="Validate input data"
            ),
            NodeConfig(
                node=ProcessingNode,
                connections=[RouterNode],
                description="Process the data"
            ),
            NodeConfig(
                node=RouterNode,
                connections=[SuccessNode, ErrorNode],
                is_router=True,
                description="Route based on processing result"
            )
        ]
    )
```

## Key Architecture Decisions

1. **Accept-and-Delegate Pattern**: API immediately returns 202 Accepted, processing happens asynchronously
2. **Event Sourcing**: All events stored in Event table with complete audit trail
3. **DAG-based Workflows**: Chain of Responsibility pattern with type-safe node execution
4. **TaskContext State**: Immutable state container flowing through all nodes
5. **Workflow Registry**: Centralized workflow discovery and instantiation

## Performance Characteristics

- **API Response Time**: Immediate 202 Accepted (< 50ms)
- **Workflow Execution**: Asynchronous via Celery workers
- **Node Processing**: Sequential with optional concurrent execution
- **State Management**: In-memory TaskContext during execution
- **Result Storage**: Final TaskContext stored in Event.task_context JSON field

## Integration Points

- **Database**: Event table via GenericRepository pattern
- **Queue**: Redis-backed Celery for async processing
- **AI Providers**: Multi-provider support through pydantic-ai
- **External APIs**: Custom nodes for third-party integrations
- **Monitoring**: Structured logging throughout workflow execution

## Workflow Validation

The framework includes comprehensive validation:
- **DAG Structure**: Ensures no cycles in workflow definition
- **Node Reachability**: Validates all nodes are reachable from start
- **Connection Rules**: Enforces single connections except for router nodes
- **Schema Validation**: Type-safe event and output validation