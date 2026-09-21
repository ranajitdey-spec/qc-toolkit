import { startTour, type TourStep } from "../lib/tour";
import { logEvent } from "../lib/log";
import styles from "./HelpButton.module.css";

interface Props {
  toolId: string;
  steps: TourStep[];
}

export default function HelpButton({ toolId, steps }: Props) {
  async function handleClick() {
    logEvent(toolId, "tour-start");
    await startTour(steps);
  }

  return (
    <button className={styles.helpBtn} onClick={handleClick} aria-label="Show tutorial" title="Show tutorial">
      ?
    </button>
  );
}