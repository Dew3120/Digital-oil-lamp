# Digital Oil Lamp 0.1

Offline ceremony control for CompuVate Association's Problem Lab 1.0.

## Download the project

Download or clone [Dew3120/Digital-oil-lamp](https://github.com/Dew3120/Digital-oil-lamp), keeping the entire project folder together. This repository contains the complete offline app and bundled assets. Node.js must be installed separately to use the source download; see the start instructions below. Browser-saved setup changes do not transfer to another computer with the source files.
## Start

In VS Code's terminal, run `node server.js` from this folder, then open `http://localhost:8766` in Chrome or Edge. Press Ctrl+C in the terminal to stop the server. Node.js is the only runtime needed; no packages or internet connection are required.

Keep the entire folder together; the images and fonts in `assets` are needed.

Sign in with the operator username and password supplied by CompuVate.

## Set up the ceremony

1. Enter the event title, select a title font, and optionally upload a background image. The approved blue kovil image is the default. **Use Approved Stage** restores it after a custom upload.
2. Set the total lamp count and the number of rows. The row totals and visual layout update immediately.
3. For modes displaying guest information, add or edit one guest for each lamp. Each guest can have a name, designation, and photo. Use **Edit Order** or the row menu to arrange the lighting order. **Lamps only** generates directly from the lamp count without requiring guest records.
4. Optionally open **Display Settings** and choose **Photos & names**, **Photos only** (no names or designations), **Names only** (no photos), or **Lamps only** (no guest photos, names or designations). Lamps only keeps the event title, branding, lamp status and the complete finale; guest records remain available in Setup. The choice is saved on this device. Cancel leaves the previous choice unchanged.
5. Adjust flame size (height), flame volume (width), and light intensity in the live 3D lamp preview, then select **Save Setup**. Select **Generate** to open the ceremony view.

## During the ceremony

The current guest appears beside the large 3D lamp using the selected display mode. A guest can touch the lamp on a touchscreen, or an operator can click it with a mouse or touchpad. **Previous**, **Undo**, and **Reset** recover from mistakes. The next guest normally appears automatically; **Next Guest** is available in the operator menu when revisiting a lamp that was already lit. The visible **Fullscreen** button opens a presentation view and hides all operator controls. Press **Esc** or use the browser's native fullscreen exit to return to the normal view and restore controls without resetting progress. Tablets without native fullscreen use a presentation view with an **Exit Presentation** button.

The **Generate** screen starts with every lamp unlit and displays the configured lamps on the stage steps. The small lamps and large lamp share the same actual 3D brass bowl, oil, charred wick and animated flame. Touch or click the large lamp once: both flames grow from the wick and the fully lit flame holds for 1.6 seconds. The current guest's portrait stays upright and glides slowly to the space above their small lamp, then the next guest appears automatically. The portrait glide takes 2.3 seconds. Repeated touches are ignored while it runs.

**Emergency shortcut: press Space during the ceremony to begin the closing animation immediately**, even if some lamps remain unlit. Repeated presses do not restart the finale. **Exit Finale** restores the progress from before the shortcut. Enter retains the normal lamp-lighting shortcut.

The kovil background fades away for the lamp circle. The circle and CompuVate emblem stay aligned when entering or exiting fullscreen and resizing the display. The circle caption reads **MANY FLAMES. ONE FUTURE.** On the welcome screen, two matching 3D scroll flags unfurl downward, each with NSBM above CompuVate, navy and cyan silk, lotus and paisley borders, polished decorative bars, and moving thread fringes.

After the last guest, portraits dissolve from the bottom row upward while the large lamp stays still. The first lamp row queues in from the left, the second from the right, and additional rows alternate sides. The queues join a circular orbit at a shared speed, then slow down together. Circle size, lamp sizes and spacing adapt to the configured count from 1 to 30, including uneven rows. At the center, a glowing CompuVate emblem makes a full 360° turn. The lamps spiral inward and shrink into the CompuVate emblem, then dissolve inside it before the extruded Problem Lab logo and an animated **Welcome to Problem Lab 1.0** title appear. The title uses the configured event name. Interface accents and titles use a navy, ice blue and cyan palette; the brass lamps and official artwork retain their natural colors.

**Pause / Resume** freezes the entire timeline, including the flames and logos. **Undo** cancels a transition safely and returns to the last lighting. The top-right **⋯** operator menu contains Next Guest, Edit Setup, Preview Finale, Reset Ceremony, and Fullscreen. **Preview Finale** rehearses the closing sequence without saving changes to ceremony progress; **Exit Preview** returns to the prior guest. **Replay Finale** repeats the closing sequence after it finishes.

The nine guests are preloaded in ceremony order. Portraits are bundled for Professor Thilini De Silva, Dr. Rasika Ranaweera, Senior Lecturer Nasiketha Sarawanapawan, Ms. Pavithra Subhashini, Mr. Chmindra Aththanayake, Ms. Yasanthika Mathotaarachchi, and Ms. Kavishka Rajapaksha. Mr. Chamara Rathnayake and Semali Perera show a photo placeholder until their images are added in Setup.

The app saves setup and ceremony progress in the browser's local storage on that device. Use the same browser and device for the event. Clearing browser site data clears the saved setup. Uploaded images are compressed in the browser before they are saved.

The lamp geometry and flame shader are shared in `assets/lamp3d/lamp-factory.js`. The ceremony uses one transparent WebGL renderer with shared instanced brass geometry for its main lamp and up to 30 small lamps, plus the two waving cloth flags. The original background image remains unchanged; local runtime masks replace its pictured sample lamps and controls with live app elements. The finale uses actual beveled geometry for both logos. If WebGL is unavailable, the small lamps retain an image fallback. All models, fonts, images and Three.js are bundled for offline operation; its license is in `assets/lamp3d/THREE-LICENSE.txt`.

The sign-in is a simple offline operator gate built into the page. It is not suitable as secure authentication for an internet-facing deployment.

Bundled fonts are provided under the licenses in `assets/fonts`.
