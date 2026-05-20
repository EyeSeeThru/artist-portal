# ArtCanon — Black American Visual Artists Portal

A contemplative portal for exploring ~85 Black American visual artists drawn from the Wikipedia "List of African-American visual artists." Five views: Home, Gallery, Timeline, Movements, Map.

## Stack

- React 18 + Vite 6
- TypeScript
- Tailwind CSS v4 + shadcn/ui
- wouter for routing
- framer-motion for page transitions
- react-leaflet + Leaflet for the Map view
- zustand for the selected-artist global store
- next-themes for light/dark mode
- @tanstack/react-query for Wikipedia/Commons API fetching

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run preview  # preview production build
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript type checking |
