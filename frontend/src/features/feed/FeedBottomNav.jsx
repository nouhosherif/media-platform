import { Link } from "react-router-dom";
import FeedIcon from "./FeedIcon";

const items = [
  ["Home", "/feed", "home"], ["Videos", "/videos", "video"],
  ["Message", "/messages", "message"], ["Notification", "/notifications", "notification"],
  ["Profile", "/profile", "user"],
];

export default function FeedBottomNav() {
  return <nav aria-label="Main navigation" className="reference-feed-nav">
    {items.map(([label, to, icon]) => <Link key={to} to={to} aria-current={to === "/feed" ? "page" : undefined}>
      <FeedIcon name={icon} /><span>{label}</span>
    </Link>)}
  </nav>;
}
