import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";

const sora = loadSora("normal", { weights: ["600", "800"], subsets: ["latin"] });
const manrope = loadManrope("normal", { weights: ["500", "700"], subsets: ["latin"] });

export const displayFamily = `${sora.fontFamily}, "Liberation Sans", sans-serif`;
export const fontFamily = `${manrope.fontFamily}, "Liberation Sans", sans-serif`;
