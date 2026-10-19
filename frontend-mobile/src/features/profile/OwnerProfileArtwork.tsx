import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

// Decorative vector artwork only. All identity, contact details and media remain API data.
const hero = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480" preserveAspectRatio="none"><defs><linearGradient id="pastel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0edff"/><stop offset=".48" stop-color="#e5eeff"/><stop offset="1" stop-color="#dcdffd"/></linearGradient><radialGradient id="lavender" cx=".3" cy=".8" r=".75"><stop stop-color="#e2dcfc" stop-opacity=".6"/><stop offset="1" stop-color="#e2dcfc" stop-opacity="0"/></radialGradient></defs><path d="M0 0H800V230C652 270 695 480 546 480H254C105 480 148 270 0 230Z" fill="url(#pastel)"/><path d="M0 0H800V230C652 270 695 480 546 480H254C105 480 148 270 0 230Z" fill="url(#lavender)"/></svg>`;
const artworkSource = { uri: `data:image/svg+xml;utf8,${encodeURIComponent(hero)}` };

const paths = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  edit: '<path d="m4 20 1.2-5L16.5 3.7a2.1 2.1 0 0 1 3 3L8.2 18Z"/><path d="m14.8 5.4 3.8 3.8M5.2 15l3 3"/>',
  pencil: '<path fill="currentColor" stroke="none" d="m3 18 1-4L15.5 2.5a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L9 19l-5 1Zm11-12 4 4 1.1-1.1-4-4Z"/><path d="M13 21h8"/>',
  phone: '<path d="M6.8 3.2 9.4 7a1.8 1.8 0 0 1-.2 2.2L7.5 11a14 14 0 0 0 5.5 5.5l1.8-1.7a1.8 1.8 0 0 1 2.2-.2l3.8 2.6a1.7 1.7 0 0 1 .5 2.2c-.8 1.6-2.3 2.2-4 1.8A22 22 0 0 1 2.8 6.7c-.4-1.7.2-3.2 1.8-4a1.7 1.7 0 0 1 2.2.5Z"/>',
  location: '<path fill="currentColor" fill-rule="evenodd" stroke="none" d="M12 2a8 8 0 0 0-8 8c0 5.1 8 12 8 12s8-6.9 8-12a8 8 0 0 0-8-8Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 2v6M16 2v6M4 10h16"/>',
  play: '<path fill="currentColor" stroke="none" d="M5 4.6c0-1.4 1.6-2.2 2.7-1.5l12.2 7.4a1.8 1.8 0 0 1 0 3L7.7 20.9C6.6 21.6 5 20.8 5 19.4Z"/>',
};

export function OwnerProfileBackground() {
  return <Image accessible={false} contentFit="fill" pointerEvents="none" source={artworkSource} style={StyleSheet.absoluteFill} />;
}

export function OwnerProfileIcon({ name, color = '#10111d', size = 22 }: {
  name: keyof typeof paths;
  color?: string;
  size?: number;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" color="${color}" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[name].replaceAll('currentColor', color)}</svg>`;
  return <Image accessible={false} source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ height: size, width: size }} />;
}
