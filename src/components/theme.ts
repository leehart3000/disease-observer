/** The localStorage key that holds the visitor's chosen theme. */
export const THEME_STORAGE_KEY = "theme";

/**
 * Inline script that applies a stored theme to `<html>` before the first
 * paint. When nothing valid is stored, it does nothing and the stylesheet
 * follows `prefers-color-scheme`.
 */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
