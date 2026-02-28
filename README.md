# Physics Ball - Impact Lab

Interactive browser-based 2D physics sandbox where a launched ball collides with a wall, explodes into fragments, and now supports a train that can demolish the wall into flying bricks.

## Features

- Meter-based physics (`m`, `m/s`, `m/s^2`)
- Adjustable launch speed and launch angle
- Adjustable gravity and wind acceleration
- Adjustable cannon elevation, wall distance, and wall height
- Ball-to-wall explosion into fragments
- Fragment-to-fragment collisions
- Fragment life rule: fragments disappear after 2 fragment impacts
- Ground, wall, and world-bound collisions
- Sky obliteration when objects go above the world limit
- Train demolition mode:
  - Send a train through the map
  - Train crushes wall into physical brick debris
  - Rebuild wall button to restore it
- Extra controls: trails, auto-fire, time scale, shockwave click interaction

## Run Locally

You only need a static file server.

### Option 1 (Python)

```bash
cd "/Users/matthewli/Documents/physics engine again"
python3 -m http.server 8000
```

Open: `http://localhost:8000`

### Option 2 (Node)

```bash
npx serve "/Users/matthewli/Documents/physics engine again"
```

## Controls

### UI Buttons

- `Launch`: fire one projectile
- `Send train`: spawn a train that can break the wall
- `Rebuild wall`: remove brick rubble and restore the wall
- `Pause`: pause/resume simulation
- `Clear debris`: clear non-projectile bodies
- `Reset`: reset all state and counters

### Keyboard Shortcuts

- `Space`: launch projectile
- `P`: pause/resume
- `R`: reset simulation
- `T`: send train
- `B`: rebuild wall

### Pointer

- Click/tap canvas to emit a radial shockwave impulse.

## Project Files

- `index.html` - UI and control layout
- `styles.css` - page and control styling
- `app.js` - simulation, collisions, train logic, rendering

## Notes

- This is intentionally a lightweight custom physics loop (not Box2D/Matter).
- Behavior is tuned for interactive gameplay feel, not strict real-world material modeling.
