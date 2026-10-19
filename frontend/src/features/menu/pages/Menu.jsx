import { Link, useNavigate } from "react-router-dom";

import Icon from "../../../components/Icon";
import BottomNav from "../../../components/ui/BottomNav";
import { session } from "../../../services/api/index.js";
import { designTheme } from "../../../theme";

const options = [
  { icon: "help", label: "Help and Support", to: "/menu/help-support" },
  {
    icon: "shield",
    label: "Settings and Privacy",
    to: "/menu/settings-privacy",
  },
];

const Menu = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    session.clear();
    navigate("/", { replace: true });
  };

  return (
    <div className={designTheme.page}>
      <div className={`${designTheme.appShell} pb-28`}>
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 px-5 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Link
              aria-label="Back to profile"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-950/10"
              to="/profile"
            >
              <Icon className="h-5 w-5 rotate-180" name="chevronRight" />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                Account
              </p>
              <h1 className="text-2xl font-black tracking-[-0.025em]">Menu</h1>
            </div>
          </div>
        </header>

        <main className="space-y-5 px-5 py-6">
          <section aria-labelledby="menu-options-heading">
            <h2
              className="mb-3 px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted"
              id="menu-options-heading"
            >
              Support and settings
            </h2>
            <div
              className={`${designTheme.card} divide-y divide-line overflow-hidden`}
            >
              {options.map((option) => (
                <Link
                  className="flex min-h-[4.5rem] items-center gap-4 px-4 py-3 text-ink transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  key={option.to}
                  to={option.to}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${designTheme.iconSurface} ${designTheme.iconPrimary}`}
                  >
                    <Icon name={option.icon} />
                  </span>
                  <span className="flex-1 text-[15px] font-bold">
                    {option.label}
                  </span>
                  <span className="text-subtle">
                    <Icon className="h-5 w-5" name="chevronRight" />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-label="Session">
            <button
              className="flex h-14 w-full items-center justify-center rounded-control border border-line bg-white px-5 font-bold text-red-600 shadow-card transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
              onClick={handleLogout}
              type="button"
            >
              Log out
            </button>
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </div>
  );
};

export default Menu;
