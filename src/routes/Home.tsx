import { Link } from "react-router-dom";
import { tools } from "../tools/registry";
import styles from "./Home.module.css";

// Flat, saturated blocks — cycles regardless of how many tools get added.
const PALETTE = ["#c9b8ff", "#d4f565", "#ff9eb5", "#ffe066", "#a8e6f0", "#ffc08a"];

export default function Home() {
  return (
    <div>
      <h1 className={styles.title}>QC Toolkit</h1>
      <p className={styles.sub}>Personal utilities. Everything runs in the browser — nothing is uploaded anywhere.</p>
      <div className={styles.grid}>
        {tools.map((tool, i) => (
          <Link key={tool.id} to={tool.path} className={styles.card} style={{ background: PALETTE[i % PALETTE.length] }}>
            <div className={styles.cardTop}>
              <span className={styles.kicker}>{tool.description}</span>
              <span className={styles.arrow}>↗</span>
            </div>
            <span className={styles.cardTitle}>{tool.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}