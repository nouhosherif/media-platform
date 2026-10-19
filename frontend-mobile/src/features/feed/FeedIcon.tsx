import { Image } from 'expo-image';

const paths = {
  menu: '<path d="M4 5.5h16M4 12h16M4 18.5h16"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g>',
  heart: '<path d="M20.6 4.9a5.6 5.6 0 0 0-8.6.7 5.6 5.6 0 0 0-8.6-.7C-2 10.5 7.6 17.5 12 21c4.4-3.5 14-10.5 8.6-16.1Z"/>',
  message: '<path d="M21.5 10.8c0 5-4.4 8.6-9.7 8.6-1.5 0-3-.3-4.3-.9L2.5 21l1.7-5.1a7.8 7.8 0 0 1-2-5.1C2.2 6 6.5 2.5 11.8 2.5s9.7 3.5 9.7 8.3Z"/>',
  send: '<path d="m2 7 20-5-7 20-4-10-9-5Z"/><path d="M11 12 22 2"/>',
  bookmark: '<path d="M5 21V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v17l-7-5-7 5Z"/>',
  home: '<path fill="currentColor" stroke="none" d="M2 10.2a2 2 0 0 1 .7-1.5l8-6.8a2 2 0 0 1 2.6 0l8 6.8a2 2 0 0 1 .7 1.5V20a2 2 0 0 1-2 2h-5v-7a3 3 0 0 0-6 0v7H4a2 2 0 0 1-2-2Z"/>',
  video: '<rect x="2" y="3" width="20" height="18" rx="4"/><path fill="currentColor" stroke="none" d="m9 7 8 5-8 5Z"/>',
  notification: '<path d="M4 17c2-2 2-4.5 2-8a6 6 0 0 1 12 0c0 3.5 0 6 2 8H4Z"/><path d="M9 20a3.2 3.2 0 0 0 6 0"/>',
  user: '<circle cx="12" cy="6.5" r="4"/><path d="M3.5 22c0-5.1 3.6-8 8.5-8s8.5 2.9 8.5 8"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};
export type FeedIconName = keyof typeof paths;

export default function FeedIcon({ name, color = '#101114', size = 24, filled = false }: {
  name: FeedIconName; color?: string; size?: number; filled?: boolean;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name].replaceAll('currentColor', color)}</svg>`;
  return <Image accessible={false} source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ width: size, height: size }} />;
}
