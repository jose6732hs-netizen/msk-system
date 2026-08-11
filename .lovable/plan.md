# Plan: Plan Cards & Carousel Improvements

Enhance the user experience on the plans page by providing full control over carousel movement, making mobile cards more compact and professional, and ensuring high-quality, uncropped images.

## User Review Required

> [!IMPORTANT]
> - Do you prefer the carousel to have a visible scrollbar on mobile, or just smooth touch-swiping without visual clutter?
> - Should the "loop" (duplicated cards) be kept for infinite scrolling, or would you prefer a standard list that ends at the last plan?

## Proposed Changes

### 1. Carousel & Movement (src/routes/planos.tsx)
- **Remove CSS Animation**: Disable `animate-carousel-loop` which forces automatic movement and can be frustrating.
- **Enable Free Movement**: Ensure the container has `overflow-x-auto` and `snap-x` for smooth manual swiping/scrolling.
- **Interactive Controls**: Improve the "Next/Previous" buttons to handle variable scroll amounts based on screen size.
- **Visual Feedback**: Add a subtle "swipe to explore" hint or visible scroll indicator if needed.

### 2. Mobile Layout & Card Sizing (src/routes/planos.tsx)
- **Compact Cards**: Reduce padding and font sizes on mobile to allow more of the card content to be visible without overwhelming the screen.
- **Image Preservation**: Use `aspect-video` or `aspect-[4/3]` with `object-contain` or `object-cover` depending on the specific asset type to ensure no cropping happens on smaller screens.
- **Scaling**: Adjust `max-width` of cards on mobile (e.g., from `320px` to `280px`) to fit better on standard phone screens.

### 3. Professional Polish
- **Glassmorphism**: Enhance the "Material Adicionado" notification and card backgrounds for a more premium look.
- **Transitions**: Add smoother hover and active states for touch interactions.

## Technical Details
- Modify `src/routes/planos.tsx` to remove `animate-carousel-loop`.
- Update Tailwind classes on the `article` element inside the plans map for mobile responsiveness (`sm:min-w-[380px] min-w-[280px]`).
- Adjust the `img` container inside the card to use `object-contain` to prevent "cuts" in the branding images.
