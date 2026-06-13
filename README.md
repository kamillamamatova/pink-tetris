# Pink Tetris

A complete classic browser Tetris game with seven-bag piece generation, ghost
pieces, keyboard and touch controls, progressive levels, and a pink block
palette.

## Run it

Open `index.html` directly, or start a local server:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- Left / Right arrows: move
- Up arrow: rotate
- Down arrow: soft drop
- Space: hard drop
- P: pause

With a mouse, move the cursor left or right across the board to guide the falling
piece while it descends at the normal game speed. Left-click the board to place
the piece at that horizontal position and lock it onto the bottom or existing
stack. As the cursor moves, the piece automatically tests its orientations and
turns toward the closest valid fit against the floor or existing blocks.
The placement preview can also target empty cavities beneath overhangs when the
piece fits.
Double-click the board to hold the active piece. Hold can only be used once per
active piece, and becomes available again after that piece locks.
Touchscreen controls appear below the board on smaller screens.
