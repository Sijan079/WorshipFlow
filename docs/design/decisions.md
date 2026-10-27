# Design decisions

A log of the design decisions behind `DESIGN.md`, by topic, so each is recorded once and every screen
shares it. Each entry has the rule, **Why:** (the owner's reasoning, in the author's words), where it is
built, and its status. A page gets its own notes only when it has reasoning no other page shares.

Status is **Built** (the app does it), **Trial** (in the app on purpose, for the owner to judge), or
**Target** (decided, not yet in the code). Changing this file or `DESIGN.md` goes through a grilling
session with the owner (see `AGENTS.md`), and the change is recorded in `docs/changes/YYYYMMDD.md`.

First written 2026-10-27 from the Sermon Captions screen and the grilling session that followed.

## Pages and structure

### One screen, no tabs
Running captions is one page. Setup lives in a dialog opened by an options icon, and Start with no input
chosen opens that dialog instead of being a dead button.
**Why:** setup happens once, running happens every week, and switching views to start is a step nobody
should have to take.
Built in: Sermon Captions. Status: Built.

### The next action sits at the top right
Start and Stop go in the page header, in the same place as Add person and Add service, never inside a
card. Start is the one purple button; Stop is solid red (`ui-btn-danger-solid`).
**Why:** a person always knows where to look, and there is only ever one primary action.
Built in: Sermon Captions, People, Ministries, Services. Status: Built.

### Never nest cards
A surface (the page card, a dialog) holds panels that extend vertically, divided by hairline rules, and
its content fills the card in width and height. A panel has no border, radius, or shadow of its own.
**Why:** boxes inside boxes add borders without meaning, and make the page harder on small screens and
older eyes.
Built in: Sermon Captions. Status: Built there, Target elsewhere (19 older files still draw boxes).

### Captions keep running in the background
The captions session lives above every workspace page, so moving around the app does not stop it. Its
heartbeat runs in a worker so a hidden tab does not make listeners see "interrupted", the screen is kept
awake while live, and reloading, closing the tab or signing out asks first.
**Why:** a booth operator should be able to use the rest of the app, or switch windows, during a service
without the broadcast ending. Closing the tab or putting the computer to sleep still ends it; a browser
cannot do otherwise.
Built in: the workspace layout. Status: Built; behaviour in a real booth is still to be checked.

### Pages that are not lists
A page that is not a list (Sermon Captions, the Song Formatter) is one surface, or none, divided into
vertical panels, with the next action in the header.
**Why:** the list rule ("one register per page") describes People and Services; other pages are not
lists, and the owner pointed to the Song Formatter as another example.
Built in: Sermon Captions. Status: Built there, Target for the Song Formatter.

## Controls

### Quiet controls
A secondary action that needs no words is an icon with no border and no fill, muted at rest, with an
accessible label and a tooltip, at least 44px. If it needs words, the word sits beside the icon (Test).
A secondary button that must be seen (Test) looks like our default secondary button without its border,
lifted by a soft shadow.
**Why:** the interface around the content (the borders, frames and filled buttons, often called chrome)
should disappear so the primary action stands out, and a screen of bordered buttons reads as noise.
Built in: Sermon Captions. Status: Built there, Target elsewhere.

### Controls match their surroundings
A dropdown list is exactly as wide as the field that opens it. A dialog title is short, with its
information icon beside it, and has no subtitle that repeats it. A line that repeats another line is
removed.
**Why:** small mismatches of a few pixels or a few words are what make a screen feel unfinished.
Built in: the shared select; Sermon Captions. Status: Built.

## Color

### Red means error, or destructive or disruptive
Red marks an error, or an action that is destructive or disruptive to an operation (Stop, Delete).
**Why:** Stop and Delete each end or destroy something, so they should look unlike the actions that
continue, and read as a deliberate choice.
Built in: Sermon Captions (Stop). Status: Built; older Delete buttons turn red only on hover (Target).

### The secondary accent (sky blue)
Sky blue `#0369a1` is the secondary accent for accent text, links, and the hover and active states of
secondary actions. Purple stays for primary actions, focus rings, selection, and the active tab.
**Why:** the owner wanted a colour that complements the purple theme, so secondary actions do not all
read as primary ones. It is one token, so it is easy to undo.
Built in: the whole light workspace, as a trial from 2026-10-27. Status: Trial. The owner decides after
living with it.

## Status

### A status is a signal
A small dot and a label in the same colour, so the colour is the message. Live pulses so it is noticed
from across the booth; Reconnecting and Starting are amber; red is an error; waiting is grey.
**Why:** the state should be understood at a glance, without reading.
Built in: Sermon Captions. Status: Built.

### The floating live button
While this browser is broadcasting captions and the Captions page is not open, one floating button sits at
the bottom right: a purple microphone that pulses (amber while starting or recovering, red when it needs
attention). Pressing it opens a small panel with the status, the input in use, Open Captions, and Stop
captions (which asks first). It sits under dialogs and above the phone's safe area, is hidden on the
Captions, login, and listener pages, and is the only floating button in the app, reserved for "something
is running for you".
**Why:** captions can keep running behind other pages, so people need to see that they still are, and to
stop them from anywhere. The owner chose purple, the app's own signal, over the green status dot used on
the page itself, and the purple rule was amended to allow it.
Built in: the workspace layout (the captions engine). Status: Built.

## Information

### Information on request
Facts that matter now and then sit behind an information icon (From, To, the chosen input, where the
audio goes). The link is not printed on the screen; copying it is the action. A disclosure is never
deleted, only moved one tap away.
**Why:** keep the screen quiet but honest.
Built in: Sermon Captions. Status: Built.

## Help

### Help is closed by default
One collapsible area, split into Setup and Troubleshooting sub-sections that open on their own. Setup is
numbered steps; Troubleshooting is the problem you see, then what to do, in the words the app shows. It
names no mixer and no church, and covers Windows and Mac.
**Why:** a first-timer needs it, a regular should not scroll past it, and the product serves more than
one church.
Built in: Sermon Captions. Status: Built.

## Dialogs and confirmations

### A deliberate action needs an aware yes
Stopping captions and regenerating the link ask first. The question says what will happen, the safe
choice is Cancel and keyboard focus lands on it, and the positive button reads **Yes, I am sure**. While
the question is open, the button that asked it is hidden. An action that cannot happen right now stays
pressable and a toast says why.
**Why:** stopping should be a decision, not a stray click, and a person should never be left guessing why
nothing happened.
Built in: Sermon Captions. Status: Built there; older delete dialogs are Target.

### Cancel and Done
A dialog that asks a question or holds unsaved changes has an explicit Cancel. A dialog whose choices
apply the moment they are made ends with Done. The close button is always there.
**Why:** the button should say what pressing it does: abandon, or finish.
Built in: Sermon Captions. Status: Built there, Target elsewhere.

### Dialog titles are in Title Case
Dialog titles are in Title Case, with small words such as "a" and "or" in lower case (Audio Input,
Invite a Member). Headings inside a page and form labels stay sentence case.
**Why:** the owner's own Services dialogs already used Title Case (Edit Service, Create Worship
Service); the rest of the app now matches them.
Built in: every dialog, from 2026-10-27. Status: Built.

## Motion

### Things open and close smoothly
Collapsible panels, the confirmation that slides open, and dropdown lists all animate in and out.
**Why:** a page that jumps feels broken.
Built in: Sermon Captions, the shared select. Status: Built.

### Two motion exceptions
A panel that opens and closes may animate its height, and one status may pulse (the Live dot).
**Why:** panels have limited space and cannot slide smoothly any other way, and the pulse carries
meaning.
Built in: Sermon Captions. Status: Built.

### Things travel from where they were to where they are, and never jump
When something moves, appears, or disappears, it travels from its old place to its new one.
**Why:** motion shows where a thing came from, so people do not lose track of it.
Built in: panels, dropdowns, the confirmation slide. Status: Built there; Target where an item still
vanishes at once (the Regenerate button when its confirmation opens).

## Unity and wording

### Unity
An element that does the same job looks and behaves the same everywhere in the app.
**Why:** polish comes from that consistency: the owner's way of designing is that a page only feels
finished when its elements are the same as everywhere else.
Built in: spreading by the design unification pass (Roadmap step 10). Status: Target.

### One link, one control
The congregation gets one stable link and a QR code that never changes. Start and Stop only decide
whether captions are live, so listeners are never sent a new link.
**Why:** it should work the way people already behave: share it once and it keeps working.
Built in: Sermon Captions. Status: Built.

### Words are plain and honest
Messages say what was found and what to do, and tell the truth about uncertainty (a copy that may not
work in this browser says so and points to the download).
**Why:** many users are elderly and not technical.
Built in: Sermon Captions. Status: Built.
