# Agentic Itinerary Planner

Autonomous itinerary and logistics agent for SgAI Hackathon. Discovers events, plans optimized schedules, and executes bookings end-to-end.

## Architecture

```
USER INPUT
   |
   v
INTENT UNDERSTANDING AGENT
   |
   v
EVENT DISCOVERY AGENT (Bright Data)
   |
   v
RECOMMENDATION/FILTERING AGENT
   |
   v
ITINERARY PLANNING AGENT
   |
   v
EXECUTION AGENT (ActionBook)
   |
   v
MONITORING AGENT
   |
   v
USER OUTPUT (confirmed itinerary)

SHARED MEMORY (Acontext)
ORCHESTRATION (Mastra-style)
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Run in development
npm run dev

# Build
npm run build
```

## Usage

```typescript
import { createItineraryPlanner, planItinerary } from 'agentic-itinerary-planner';

// Simple usage
const result = await planItinerary(
  "Plan a Saturday date under $150 in Singapore",
  "user-123"
);

// With full configuration
const planner = await createItineraryPlanner({
  openaiApiKey: process.env.OPENAI_API_KEY,
  brightDataConfig: {
    customerId: process.env.BRIGHT_DATA_CUSTOMER_ID,
    zone: process.env.BRIGHT_DATA_ZONE,
    password: process.env.BRIGHT_DATA_PASSWORD,
  },
  actionBookApiKey: process.env.ACTIONBOOK_API_KEY,
  acontextApiKey: process.env.ACONTEXT_API_KEY,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
});

const result = await planner.processRequest(
  "Find concerts in Tokyo next weekend",
  "user-456"
);

if (result.success) {
  console.log(result.itinerary);
  
  // Execute bookings (dry run first)
  const bookingResult = await planner.executeBookings(result.itinerary, true);
}
```

## Agents

| Agent | Responsibility |
|-------|----------------|
| Intent Understanding | Parse natural language, extract constraints |
| Event Discovery | Scrape events via Bright Data |
| Recommendation | Rank/filter by budget, distance, ratings |
| Itinerary Planning | Optimize schedule, handle travel time |
| Execution | Book via ActionBook browser automation |
| Monitoring | Track changes, send reminders |

## Environment Variables

```bash
OPENAI_API_KEY=sk-...
BRIGHT_DATA_CUSTOMER_ID=
BRIGHT_DATA_ZONE=
BRIGHT_DATA_PASSWORD=
ACTIONBOOK_API_KEY=
ACONTEXT_API_KEY=
GOOGLE_MAPS_API_KEY=
WEATHER_API_KEY=
```

## Project Structure

```
src/
  agents/
    intent-agent.ts      # Natural language understanding
    discovery-agent.ts   # Event scraping (Bright Data)
    recommendation-agent.ts
    planning-agent.ts    # Route optimization
    execution-agent.ts   # Booking (ActionBook)
    monitoring-agent.ts  # Change tracking
  context/
    context-manager.ts   # Shared state (Acontext)
  orchestration/
    orchestrator.ts      # Agent coordination
  types/
    index.ts             # Shared types
  index.ts               # Main exports
```

## Hackathon Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Data Acquisition | Bright Data | Web scraping, proxy, geo-targeting |
| Execution | ActionBook | Browser automation, form filling |
| Context/Memory | Acontext | Shared state, workflow tracking |
| Orchestration | Custom | Agent coordination |

## License

MIT
