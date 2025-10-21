# Release Notes

## Version 1.0.0 (2025-10-21)

Initial release of the Interactive Mindmap Generator as a Claude Skill.

### Features

- **Interactive Visualizations**: React-based mindmap with radial layout
- **OPML Support**: Create hierarchies from OPML outline files
- **Custom Palettes**: Define color schemes via XML palette files
- **Rich Interactions**:
  - Click to expand/collapse nodes
  - Drag to reposition nodes and branches
  - Scroll to zoom in/out
  - Pan canvas by dragging background
  - Hover for detail popovers
- **Zero Build Step**: Runs directly in browser via CDN-hosted React
- **Web Fonts**: Hubot Sans from Google Fonts with system fallbacks

### What's Included

- `index.html` - Minimal loader that bootstraps the React app
- `index.jsx` - Complete React mindmap component with all interactive logic
- `styles.css` - Visual styling for nodes, popovers, and layout
- `mindmap.opml` - Sample content structure (customizable)
- `palette.xml` - Color palette definition (customizable)
- `SKILL.md` - Instructions for using as a Claude skill
- `README.md` - Complete documentation and usage guide
- `LICENSE.txt` - MIT License
- `fonts/` - Optional local Hubot Sans font files

### Usage

To use this mindmap generator:

1. Extract the `mindmap-skill.zip` file
2. Run a local server: `python3 -m http.server 3000`
3. Open browser to `http://localhost:3000/index.html`

Or use as a Claude Skill by following instructions in `SKILL.md`.

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires ES6+ and modern DOM APIs.

### License

MIT License - See LICENSE.txt for details.
