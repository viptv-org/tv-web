/**
 * Bundled VIPTV fonts (no network fonts). Import once, before any stylesheet
 * that uses them (see main.tsx). The @font-face rules live in fonts.css:
 *
 * - Display: 'Bricolage Grotesque Variable' (opsz + wght axes), latin + latin-ext,
 *   from @fontsource-variable/bricolage-grotesque.
 * - UI: 'Onest' 400/500/600/700, latin + latin-ext, from @fontsource/onest.
 *
 * Both names appear in the generated --viptv-font-family-display / -ui stacks.
 */
import "./fonts.css";
