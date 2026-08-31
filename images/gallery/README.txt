On Tour photo gallery.

Drop a photo in this folder and it appears on the On Tour page. Any number of
photos; there is no list to update and no markup to edit.

ORDER is filename order, which is why the files are numbered. To slot a photo
between two others, name it with a number in between (035-something.jpg). To
put one at the end, give it a higher number than everything else.

DESCRIPTIONS live in alt.json, keyed by filename. These are read aloud by
screen readers and read by Google, so they are worth writing. If a photo has no
entry, the site still shows it and derives a description from the filename —
that works, but it is a placeholder, not a description.

SIZES are handled automatically. Drop in a full-size photo; the build makes the
smaller copy phones download and caps the large one. You do not need to resize
anything first.

LOCATION DATA is stripped automatically. Photos from a phone carry GPS
coordinates in their metadata, and this repository is public — so anything
processed here has that removed before it is published.
