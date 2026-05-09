import { ConsentTogglesCard } from "@/components/profile/ConsentToggles";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getMyConsents } from "@/lib/profile/get-user-consents";

export const metadata = {
  title: "通知・広告配信の設定",
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const consents = await getMyConsents();
  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          通知・広告配信の設定
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          メール配信、サイト内のパーソナライズ広告、第三者広告ネットワーク経由の配信などについて、いつでも個別に切替えできます。
        </p>
      </div>
      <ConsentTogglesCard initial={consents} />
    </section>
  );
}
