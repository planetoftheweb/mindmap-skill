# Release Process Guide

This document explains how to create a GitHub release for the mindmap-skill project.

## Current Release Status

**Version**: 1.0.0  
**Tag**: v1.0.0 (created locally, needs to be pushed)  
**Release ZIP**: mindmap-skill.zip (ready in repository)

## Steps to Complete the Release

### 1. Push the Tag to GitHub

The tag `v1.0.0` has been created locally. Push it to GitHub:

```bash
git push origin v1.0.0
```

### 2. Create GitHub Release

Once the tag is pushed, create a GitHub release:

**Option A: Using GitHub Web Interface**
1. Go to https://github.com/planetoftheweb/mindmap-skill/releases
2. Click "Create a new release"
3. Select tag: `v1.0.0`
4. Release title: `Interactive Mindmap Generator v1.0.0`
5. Copy release notes from `RELEASE_NOTES.md`
6. Upload `mindmap-skill.zip` as a release asset
7. Check "Set as the latest release"
8. Click "Publish release"

**Option B: Using GitHub CLI**
```bash
gh release create v1.0.0 \
  --title "Interactive Mindmap Generator v1.0.0" \
  --notes-file RELEASE_NOTES.md \
  mindmap-skill.zip
```

## Release Checklist

- [x] VERSION file created with version number
- [x] RELEASE_NOTES.md created with comprehensive release information
- [x] mindmap-skill.zip rebuilt with all current files
- [x] .gitignore added to exclude binary font files and macOS artifacts
- [x] Local git tag v1.0.0 created
- [ ] Tag pushed to GitHub (requires manual action)
- [ ] GitHub release created (requires manual action)

## What's Included in the Release

The `mindmap-skill.zip` file includes:

- **Source Files**:
  - `index.html` - HTML loader
  - `index.jsx` - React mindmap component
  - `styles.css` - Styling
  - `mindmap.opml` - Sample content
  - `palette.xml` - Color palette

- **Documentation**:
  - `README.md` - Usage guide
  - `SKILL.md` - Claude skill instructions
  - `RELEASE_NOTES.md` - Release information
  - `LICENSE.txt` - MIT license
  - `VERSION` - Version identifier

- **Assets**:
  - `fonts/hubot_sans.ttf` - Hubot Sans font file
  - `fonts/OFL.txt` - Font license

## Release Notes Summary

Version 1.0.0 is the initial release featuring:
- Interactive React-based mindmap with radial layout
- OPML and XML palette support
- Rich interactions (zoom, pan, drag, expand/collapse)
- Zero build step - runs directly in browser
- Web fonts with system fallbacks
- Complete documentation and Claude skill integration

## Future Releases

For future releases:

1. Update the `VERSION` file with the new version number
2. Update `RELEASE_NOTES.md` with new features/fixes
3. Rebuild the ZIP: `zip -r mindmap-skill.zip fonts/ *.html *.jsx *.css *.opml *.xml *.txt *.md -x "*.DS_Store"`
4. Commit changes
5. Create and push new tag: `git tag -a vX.Y.Z -m "Version X.Y.Z"`
6. Push tag: `git push origin vX.Y.Z`
7. Create GitHub release with the new ZIP file

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for new functionality in a backwards compatible manner
- PATCH version for backwards compatible bug fixes
