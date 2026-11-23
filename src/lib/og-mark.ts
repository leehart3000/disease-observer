/**
 * The site's mark as SVG text, for the sharing pictures (`og-image.tsx`).
 *
 * It is a copy of `public/brand/mark-light.svg`, written here as text so that
 * making a picture reads no file from disk (a file read at run time is a file
 * that a host's file tracing can leave out). `e2e/runtime-files.spec.ts`
 * checks that this and the file are the same. If the mark changes, copy the new
 * file's text here.
 */
export const MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Disease Observer"><title>Disease Observer</title><ellipse cx="32" cy="32" rx="20" ry="32" fill="#2B5C9E"/><g transform="translate(12.16 12.94) scale(.62)"><path d="M22 52C22 48.0 42 48.0 42 44" fill="none" stroke="#F7F9FB" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/><path d="M42 44C42 40.0 22 40.0 22 36" fill="none" stroke="#F7F9FB" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/><path d="M22 36C22 31.5 42 31.5 42 27" fill="none" stroke="#F7F9FB" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/><path d="M42 27C42 23.0 22 23.0 22 19" fill="none" stroke="#F7F9FB" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/><path d="M32 7V58" stroke="#F7F9FB" stroke-width="4.5" stroke-linecap="round"/><circle cx="22" cy="52" r="2.86" fill="#F7F9FB"/><circle cx="42" cy="44" r="4.40" fill="#F7F9FB"/><circle cx="22" cy="36" r="5.50" fill="#F7F9FB"/><circle cx="42" cy="27" r="4.40" fill="#F7F9FB"/><circle cx="22" cy="19" r="2.86" fill="#F7F9FB"/><circle cx="32" cy="7" r="7" fill="#F7F9FB"/><circle cx="32" cy="7" r="4.5" fill="#BC4034"/></g></svg>';
