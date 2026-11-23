import Image, { generateStaticParams } from "./opengraph-image";

export const alt = "Disease Observer: a disease page, with its latest figure and its datasets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { generateStaticParams };

/** The same picture as the Open Graph image, for Twitter cards. */
export default Image;
