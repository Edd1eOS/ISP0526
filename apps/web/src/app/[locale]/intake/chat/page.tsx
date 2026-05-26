import { VoyageStage } from "../../../../features/intake-voyage/voyage-stage";

// Step 4: detail refinement. Replaces the legacy chat-bubble flow with the
// first-person voyage UI; each follow-up question is a waypoint that
// surfaces on a sailing scene. Backend still routes through the existing
// chatIntakeTurnAction / finalizeChatIntakeAction pipeline.
export default function IntakeChatPage() {
    return <VoyageStage />;
}
