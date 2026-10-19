import { Link } from "react-router-dom";

import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";
import { designTheme } from "../../../theme";

const SettingsPrivacy = () => (
  <div className={designTheme.page}>
    <div className={`${designTheme.appShell} pb-28`}>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 px-5 py-5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link
            aria-label="Back to menu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-950/10"
            to="/menu"
          >
            <Icon className="h-5 w-5 rotate-180" name="chevronRight" />
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Account
            </p>
            <h1 className="text-2xl font-black tracking-[-0.025em]">
              Settings &amp; Privacy
            </h1>
          </div>
        </div>
      </header>

      <main className="px-5 py-6">
        <section className={`${designTheme.card} px-6 py-12 text-center`}>
          <span
            className={`mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl ${designTheme.iconSurface} ${designTheme.iconPrimary}`}
          >
            <Icon className="h-7 w-7" name="shield" />
          </span>
          <h2 className="text-lg font-black tracking-tight">
            Settings &amp; Privacy
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            No additional privacy controls are available for this account yet.
          </p>
        </section>
      </main>

      <BottomNav active="profile" />
    </div>
  </div>
);

export default SettingsPrivacy;
