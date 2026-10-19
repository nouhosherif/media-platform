import { Link } from "react-router-dom";
import Icon from "../Icon";

const ITEMS = [
  ["home", "/feed", "home", "Home"],
  ["video", "/videos", "video", "Videos"],
  ["messages", "/messages", "message", "Messages"],
  ["notifications", "/notifications", "notification", "Notifications"],
  ["profile", "/profile", "user", "Profile"],
];

const BottomNav = ({ active, dark = false }) => (
  <nav aria-label="Main navigation" className={dark
    ? "fixed bottom-0 left-1/2 z-30 grid w-full max-w-app -translate-x-1/2 grid-cols-5 border-t border-white/10 bg-zinc-950/90 px-2 pt-2 text-white shadow-nav backdrop-blur-xl [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]"
    : "fixed bottom-0 left-1/2 z-30 grid w-full max-w-app -translate-x-1/2 grid-cols-5 border-t border-line bg-white/95 px-2 pt-2 shadow-nav backdrop-blur-xl [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]"}>
    {ITEMS.map(([name, path, icon, label]) => (
      <Link key={name} aria-current={active === name ? "page" : undefined}
        className={`min-w-0 rounded-xl py-1.5 transition grid place-items-center gap-1 ${dark
          ? (active === name ? "text-white" : "text-white/60")
          : (active === name ? "text-slate-950" : "text-slate-500")}`}
        to={path}>
        <Icon className="h-5 w-5" name={icon} />
        <span className="max-w-full truncate text-[10px] font-semibold">{label}</span>
      </Link>
    ))}
  </nav>
);

export default BottomNav;
