// Site configuration. This is the only JS file you should need to edit.

export const CONFIG = {
  map: {
    // Size in pixels [width, height] of the FULL-RESOLUTION source image.
    // Every x/y in data/*.json is a pixel position on an image of this size.
    // Swapping in your own map: replace assets/map/map.jpg and change this line.
    size: [34816, 45056],

    // 'overlay' = one image file (map.image).
    // 'tiles'   = tile pyramid cut by scripts/make-tiles.js (map.tiles).
    mode: 'tiles',

    image: 'assets/map/map.jpg',

    tiles: {
      url: 'assets/map/tiles/{z}/{x}/{y}.jpg',
      tileSize: 256, // must match the --tile-size used with make-tiles.js
      // Lowest zoom level that has tiles on disk (0 for make-tiles.js output).
      // Below it the map scales these tiles down.
      minZoom: 3,
    },

    // Zoom level used when flying to a marker. Leave out for "one below 1:1".
    focusZoom: 6,

    // How many zoom levels past 1:1 the user may zoom in.
    extraZoom: 1,
  },

  cluster: {
    // Markers are clustered only once there are at least this many of them.
    minMarkers: 40,
    // Cluster radius in screen pixels.
    radius: 46,
  },

  // Prefix for localStorage keys (found markers, preferences, edit drafts).
  storagePrefix: 'leonida-atlas',
};
