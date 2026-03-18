import { cookies } from "next/headers";
import styles from "./page.module.css";
import StartupLoadingExperience from "./components/StartupLoadingExperience";
import { getMessages, type Locale } from "@/lib/i18n";

export default async function Loading() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("lang")?.value as Locale | undefined) ?? "en";
  const messages = getMessages(locale);

  return (
    <main className={styles.main} data-app-main="true">
      <div className={styles.scaleContainer} data-scale-container="true">
        <StartupLoadingExperience
          title={messages.startupLoadingTitle}
          subtitle={messages.startupLoadingSubtitle}
          statuses={[
            messages.startupLoadingTeamContext,
            messages.startupLoadingPlayers,
            messages.startupLoadingMatches,
            messages.startupLoadingRatings,
            messages.startupLoadingFinalize,
          ]}
        />
      </div>
    </main>
  );
}
