import type { Metadata } from "next";
import { LocalTaskConsole } from "./task-console";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "本地AI任务操作台 | AI-PET-WORLD",
};

export default function LocalTaskConsolePage() {
  return (
    <main className={styles.page}>
      <LocalTaskConsole />
    </main>
  );
}
