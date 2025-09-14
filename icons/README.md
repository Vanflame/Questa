# Questa Earn PWA Icons

This folder contains the required icons for the Questa Earn Progressive Web App.

## Required Icons

You need to create the following icon files:

1. **icon-192.png** - 192x192 pixels PNG icon
2. **icon-512.png** - 512x512 pixels PNG icon

## Creating Icons

### Option 1: Use your existing logo
1. Take your existing logo from `/assets/images/logo.png`
2. Resize it to 192x192 pixels and save as `icon-192.png`
3. Resize it to 512x512 pixels and save as `icon-512.png`

### Option 2: Use online tools
1. Go to https://realfavicongenerator.net/ or https://favicon.io/
2. Upload your logo
3. Generate the required sizes
4. Download and place them in this folder

### Option 3: Use design software
1. Open your logo in Photoshop, GIMP, or Canva
2. Create new images with dimensions 192x192 and 512x512
3. Paste your logo and center it
4. Export as PNG files

## Icon Requirements

- **Format**: PNG
- **Background**: Should be transparent or match your app's theme
- **Content**: Should be recognizable at small sizes
- **Purpose**: Both icons should be marked as "any maskable" in the manifest

## Current Status

⚠️ **IMPORTANT**: The current icon files are placeholders. You must replace them with actual PNG icons before deploying your PWA.

The PWA will not pass PWABuilder validation without proper icon files.
