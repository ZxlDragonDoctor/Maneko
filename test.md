# AI Image Genertion Hero kelo

A full-screen, glassmorphic AI image/video-generation hero for the "Kelo" brand, built with React, Tailwind CSS, Framer Motion, and lucide-react. A looping background video sits behind a floating pill navbar, a left headline/CTA column, and a right glass "phone" card with an interactive image gallery and copy-prompt control.

## Tech stack
- React (client component, `useState`)
- Framer Motion (`motion`, `AnimatePresence`) for entrance animations and crossfading the active image
- lucide-react icon: `Sparkles`
- Uses `navigator.clipboard.writeText` for the copy-prompt button

## Fonts & global styles
Uses Tailwind `font-sans` (no external font import). A scoped `<style>` block holds the mobile media query (see Responsive). Scope all styles to this section.

## Section container
`<section>`: `relative min-h-screen w-full overflow-hidden font-sans`. Optional `className` appended.

## Data
An `IMAGES` array of 4 items (`id`, `url`, `prompt`, `label`). `activeImage` defaults to `IMAGES[3]` (the Poppy Field). `navLinks = ["Use Cases","Why Erie","Pricing","FAQ","Tutorials"]`. (Note: nav label "Why Erie" appears verbatim in the source.)

## Structure (section by section)

### 1. Background video + overlay
- `<video autoPlay muted loop playsInline>`: `absolute inset-0 w-full h-full object-cover z-0`, with `<source>` `https://cdn.jiro.build/Kelo/i-want-all-the-flowers-in-this-image-to-move-there.mp4` (`type="video/mp4"`).
- Readability overlay: `absolute inset-0 bg-black/40 z-0`.

### 2. Navbar (floating pill)
Wrapper: `absolute top-8 left-0 w-full flex justify-center px-[60px] z-[100]`. `<nav>`: `flex items-center justify-between w-full max-w-[1200px] p-2 pl-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.3)]`.
- Logo (`flex items-center group cursor-pointer`): `<img>` from `https://cdn.jiro.build/Kelo/Kelo%20White.svg`, alt "Kelo Logo", `h-[20px] w-auto`, `referrerPolicy="no-referrer"`.
- Nav links (`hidden md:flex items-center gap-8`): the five links, each `href="#" + lowercased-hyphenated`, `text-white/70 text-[13px] font-medium hover:text-white transition-all duration-200 relative`, with an animated underline span `absolute -bottom-1 left-0 w-0 h-[1px] bg-[#01bd7d] transition-all duration-300 group-hover/link:w-full`.
- Right group (`flex items-center gap-6`): "Explore creations" link (`hidden sm:block text-white/70 text-[13px] font-medium hover:text-white`); "Get Started" button `bg-white text-black px-5 py-2 rounded-full text-[13px] font-bold hover:bg-[#01bd7d] hover:text-white transition-all duration-300 shadow-lg shadow-black/20`.

### 3. Hero content (`<main>`)
`relative z-10 flex flex-col lg:flex-row items-center justify-center min-h-screen px-[60px] pt-[144px] pb-20 gap-10 lg:gap-20`.

**Left column** (`flex-1 max-w-[580px] mt-10 lg:mt-0`):
- `motion.h1` (`text-white text-[42px] md:text-[64px] font-extrabold leading-[1.05] tracking-[-0.02em] mb-6`), `initial {opacity:0,y:20} -> animate {opacity:1,y:0}`, duration 0.6 delay 0.1 ease `[0.25,0.1,0.25,1]`. Copy: "Create anything" + `<br/>` + "you can imagine."
- `motion.p` (`text-white/75 text-base leading-[1.65] max-w-[480px] mb-10`), delay 0.2: "The most powerful AI image and video generation engine. Turn words or sketches into photorealistic visuals in seconds. No design skills needed."
- CTA row (`motion.div`, delay 0.3, `flex items-center gap-5`):
  - "Start creating" button: `group relative flex items-center gap-3 bg-gradient-to-br from-[#01bd7d] to-[#00a36d] text-white pl-7 pr-6 py-4 rounded-full text-[15px] font-bold shadow-[0_10px_30px_-10px_rgba(0,188,125,0.5)] hover:shadow-[0_15px_40px_-10px_rgba(0,188,125,0.6)] hover:-translate-y-0.5 active:translate-y-0`. Contains a `w-8 h-8 bg-white/20 backdrop-blur-md rounded-full` circle with a `Sparkles` icon (size 16, `fill="currentColor"`, `group-hover:rotate-12`), and a white hover-overlay (`opacity-0 group-hover:opacity-10`).
  - "See use cases" button: `group flex items-center gap-2.5 px-7 py-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[15px] font-bold hover:bg-white/20 hover:border-white/30`, with an arrow glyph "↗" (`text-white/60 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5`).

**Right column — glass phone card** (`motion.div`, `w-full max-w-[380px] shrink-0`), `initial {opacity:0,scale:0.9} -> animate {opacity:1,scale:1}`, duration 0.8 delay 0.2:
Outer card: `bg-white/15 backdrop-blur-[20px] border-[1.5px] border-white/40 rounded-[28px] p-3 shadow-[0_20px_60px_rgba(0,0,80,0.2)]`.
- Main image area (`relative h-[440px] rounded-[20px] overflow-hidden bg-white/5`): `AnimatePresence mode="wait"` crossfades `motion.img` keyed on `activeImage.id` (`opacity 0->1`, duration 0.4), `absolute inset-0 w-full h-full object-cover`, `referrerPolicy="no-referrer"`.
  - Top-left badge: `absolute top-3 left-3 px-3 py-1.5 bg-black/45 backdrop-blur-md rounded-full border border-white/10` with "▣" + "4k" (`text-[12px] font-semibold`).
  - Top-right badge: `absolute top-3 right-3 px-3.5 py-1.5 bg-black/45 ...` with "✦" + "Video Model v7".
  - Bottom overlay row: `absolute bottom-0 left-0 right-0 p-4 pt-10 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-2.5` — a `w-8 h-8 bg-white/15 border border-white/30 rounded-full` "✦" avatar; the active prompt `<p>` (`flex-1 text-white/85 text-[12px] leading-tight line-clamp-2`); and a Copy button (`px-4 py-1.5 rounded-full text-[12px] font-semibold`) that toggles to "Copied!" (`bg-[#01bd7d] text-white`) for 2s, else "Copy" (`bg-white text-[#111] hover:bg-[#f4f5f5]`).
- Thumbnail strip (`flex gap-2 mt-2.5`): the 4 images; each `flex-1 h-20 rounded-[14px] overflow-hidden cursor-pointer relative`, `onMouseEnter` sets it active; active gets `border-2 border-white/80 scale-[1.02]`, others `hover:opacity-80`. Inner `<img>` `w-full h-full object-cover`, `referrerPolicy="no-referrer"`.

## Assets (every URL)
- Background video: `https://cdn.jiro.build/Kelo/i-want-all-the-flowers-in-this-image-to-move-there.mp4`
- Logo: `https://cdn.jiro.build/Kelo/Kelo%20White.svg`
- Gallery images (id order, with labels & prompts):
  1. `https://images.unsplash.com/photo-1605142859862-978be7eba909?q=80&w=800&auto=format&fit=crop` — "Cyberpunk" — prompt: "a sprawling cyberpunk city at night, neon lights reflecting on wet pavement, flying vehicles, futuristic architecture..."
  2. `https://images.unsplash.com/photo-1509316785289-025f5b846b35?q=80&w=800&auto=format&fit=crop` — "Oasis" — prompt: "a hidden desert oasis with crystal clear turquoise water, palm trees, golden sand dunes, cinematic lighting..."
  3. `https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop` — "Global Network" — prompt: "a global digital network connecting the entire world, glowing data streams, futuristic technology, cinematic lighting..."
  4. `https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800&auto=format&fit=crop` — "Poppy Field" (default active) — prompt: "a beautiful redhead woman looking at the camera in a field of poppies, a soft breeze, cinematic..."

## Animations
- h1 / p / CTA row: `y 20->0, opacity 0->1`, duration 0.6, ease `[0.25,0.1,0.25,1]`, delays 0.1 / 0.2 / 0.3.
- Right card: `scale 0.9->1, opacity 0->1`, duration 0.8, delay 0.2.
- Active image swap: `AnimatePresence mode="wait"`, opacity crossfade 0.4.
- Nav link underline grows `w-0 -> w-full` on hover.
- Buttons: lift/translate, sparkle rotate-12, hover overlays.
- Copy button: shows "Copied!" state for 2000ms.

## Responsive
- Nav links at `md`, "Explore creations" at `sm`.
- Hero `flex-col` then `lg:flex-row`; left column `mt-10 lg:mt-0`.
- Headline `42px -> md:64px`.
- Scoped `<style>` media query at `max-width: 1024px`: `main { flex-direction: column; text-align: center; padding-top: 120px; }`, `h1 { font-size: 48px; }`, `p { margin-left:auto; margin-right:auto; }`.

## Key design principles
- Glassmorphism throughout: translucent white surfaces, `backdrop-blur`, subtle white borders over a darkened video.
- Brand green `#01bd7d` (gradient pairs with `#00a36d`) used for accents, active states, and the primary CTA gradient.
- Interactive product showcase: hover a thumbnail to swap the main image + prompt; copy prompt to clipboard.

## Common mistakes to avoid
- Keep `referrerPolicy="no-referrer"` on the logo and all gallery images.
- Default active image is `IMAGES[3]` (Poppy Field), not the first.
- Keep `AnimatePresence mode="wait"` keyed on `activeImage.id` for clean crossfades.
- Preserve the scoped `<style>` mobile overrides; don't move them to global styles.
- Use exact green hexes (`#01bd7d`, `#00a36d`).

## Page title
Kelo — Create anything you can imagine.

## Integration (build-safety — do not skip)
- Add this section as a **new** component file with a unique name. Don't edit or overwrite any existing file except to add its import and render it.
- Render it **after** all existing sections; keep every previously built section exactly as-is — never replace or remove them.
- If no project exists, create a minimal React + Tailwind app; if one exists, use it as-is — don't re-scaffold or change the Tailwind/build config or version.
- Keep it self-contained: scope its fonts and any resets to this section; never set global body/html/* styles or a global font.
- Install only the libraries this section names.