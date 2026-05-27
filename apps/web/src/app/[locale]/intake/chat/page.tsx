import { StarChartStage } from "../../../../features/intake-stars/star-chart-stage";

// Step 4: detail refinement. The voyage chat is being replaced by the
// star-chart interaction; only Night 1 is functional in this prototype.
// VoyageStage is retained in the codebase for now but no longer mounted.
export default function IntakeChatPage() {
    return <StarChartStage />;
}
