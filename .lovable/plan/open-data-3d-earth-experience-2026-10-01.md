# Open-data 3D Earth experience

## What will change
- Replace the flat space color with an original, locally stored galaxy-and-star backdrop that moves subtly behind the globe.
- Upgrade the world view from a road-map appearance to free, openly licensed satellite-style Earth imagery, with clear attribution and an opaque planet surface.
- Refine the atmosphere, horizon glow, globe scale, lighting, and idle rotation to create a realistic Earth-from-space opening without copying Google branding or proprietary assets.
- Add smooth globe controls expected from an Earth viewer: drag to orbit, wheel/pinch zoom, tilt, compass/reset orientation, geolocation, and animated flights to searched countries, saved cities, clusters, and freelancer pins.
- Preserve every Atlaswork workflow: profile pins, back-of-globe occlusion, clustering, location picking, country filtering, favourites, saved-city startup, and profile panels.

## Experience details
- Signed-out visitors begin on the full rotating Earth; signed-in users with a saved location get a smooth space-to-city flight.
- The galaxy drifts much more slowly than the Earth, producing depth without adding another heavy 3D renderer.
- Earth rotation stops on user interaction and respects reduced-motion settings.
- Freelancer pins remain hidden on the far side of the planet and collapse into counted groups at wide zoom levels.
- At closer zooms, place labels and the existing detailed street map take priority so locations remain useful and readable.

## Technical details
- Keep MapLibre as the globe engine to avoid a large rewrite and preserve performance.
- Use a generated local space image and GPU-composited CSS motion; no remote galaxy asset or Google imagery.
- Use a free/open Earth imagery source at world and regional zooms, while retaining OpenStreetMap-derived detail for close navigation. Provider attribution will remain visible.
- Improve rotation timing so it is frame-rate independent and does not chain long camera animations.
- Verify desktop and mobile rendering, smooth zoom/orbit, far-side marker hiding, clusters, country/city flights, picking mode, reduced motion, and clean console/build output.

## Boundaries
- This will reproduce the immersive behavior and visual quality, not Google Earth itself. Google's satellite mosaic, photorealistic city mesh, historical imagery, Street View, interface, and branding are proprietary and cannot be copied into a free open-data app.
- Free public imagery varies by region and will not provide Google's worldwide photogrammetric buildings or identical resolution.
