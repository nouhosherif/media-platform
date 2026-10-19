// Profile-specific silhouettes from the supplied design; the shared icon set stays unchanged.
export default function OwnerProfileIcon({ name, className = "" }) {
  const paths = {
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    edit: <><path d="m4 20 1.2-5L16.5 3.7a2.1 2.1 0 0 1 3 3L8.2 18Z" /><path d="m14.8 5.4 3.8 3.8M5.2 15l3 3" /></>,
    pencil: <><path fill="currentColor" stroke="none" d="m3 18 1-4L15.5 2.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L9 19l-5 1Zm11-12 4 4 1.1-1.1-4-4Z" /><path d="M13 21h8" /></>,
    phone: <path d="M6.8 3.2 9.4 7a1.8 1.8 0 0 1-.2 2.2L7.5 11a14 14 0 0 0 5.5 5.5l1.8-1.7a1.8 1.8 0 0 1 2.2-.2l3.8 2.6a1.7 1.7 0 0 1 .5 2.2c-.8 1.6-2.3 2.2-4 1.8A22 22 0 0 1 2.8 6.7c-.4-1.7.2-3.2 1.8-4a1.7 1.7 0 0 1 2.2.5Z" />,
    location: <path fill="currentColor" fillRule="evenodd" stroke="none" d="M12 2a8 8 0 0 0-8 8c0 5.1 8 12 8 12s8-6.9 8-12a8 8 0 0 0-8-8Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 2v6M16 2v6M4 10h16" /></>,
    play: <path fill="currentColor" stroke="none" d="M5 4.6c0-1.4 1.6-2.2 2.7-1.5l12.2 7.4a1.8 1.8 0 0 1 0 3L7.7 20.9C6.6 21.6 5 20.8 5 19.4Z" />,
  };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
