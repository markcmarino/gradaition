# ChatP.I.G. at the Podium: setup guide

Two pages, one shared database:

- **index.html** is the audience page. People open it from the Zoom chat, pick a PhuD name, and send ChatP.I.G. one line at a time.
- **stage.html** is ChatP.I.G. Only the host opens it, and screen-shares it into Zoom with sound.
- **Firebase** carries lines from the audience to ChatP.I.G. in real time. It is free at this size.

You can try everything before setting anything up. Open `stage.html` and `index.html` in two tabs of the same browser. Until Firebase is connected, the pages run in **rehearsal mode** and only talk to tabs in that one browser.

Total setup time: about 30 minutes, once.

---

## Part 1. Put the pages on GitHub Pages (about 10 minutes)

1. Sign in at **github.com**.
2. Click the **+** at the top right, then **New repository**.
3. Name it `gradaition`. Choose **Public** (GitHub Pages is free for public repositories). Leave everything else as is and click **Create repository**.
4. On the empty repository page, click the link **uploading an existing file**.
5. Unzip the folder I sent you. Drag all the files inside it (`index.html`, `stage.html`, `stage.js`, `projector.js`, `store.js`, `config.js`, `database.rules.json`, `SETUP.md`) onto the upload area. Drag the files themselves, not the folder.
6. Scroll down and click **Commit changes**.
7. Click **Settings** (top of the repository), then **Pages** in the left sidebar.
8. Under **Branch**, choose `main`, keep the folder as `/ (root)`, and click **Save**.
9. Wait a minute or two and refresh. A box will say **Your site is live at** a web address like `https://YOURNAME.github.io/gradaition/`.

- The audience link is that address: `https://YOURNAME.github.io/gradaition/`
- ChatP.I.G. is at: `https://YOURNAME.github.io/gradaition/stage.html`

At this point the pages work, but only in rehearsal mode. Part 2 connects them.

## Part 2. Create the Firebase database (about 15 minutes)

1. Go to **console.firebase.google.com** and sign in with a Google account.
2. Click **Create a project** (or **Add project**). Name it `underacademy-gradaition`. When it asks about Google Analytics, turn it **off**. Click **Create project**, then **Continue**.
3. In the left sidebar, open **Build**, then **Realtime Database**. Click **Create Database**.
4. Choose the **United States** location and click **Next**. Choose **Start in locked mode** and click **Enable**.
5. Click the **Rules** tab. Delete everything in the box and paste in the whole contents of `database.rules.json`. Click **Publish**.
6. Click the gear icon next to **Project Overview** (top left), then **Project settings**.
7. Scroll to **Your apps** and click the web icon, which looks like `</>`.
8. Give the app a nickname, such as `pig`. Leave Firebase Hosting **unchecked**. Click **Register app**.
9. Firebase shows a block of code containing `const firebaseConfig = { ... }`. Copy just the part from the `{` to the matching `}`, including the braces. Check that it includes a `databaseURL` line. If it does not, go back to step 3; the database has to exist first.

## Part 3. Connect the two (about 5 minutes)

1. On GitHub, open your `gradaition` repository and click `config.js`.
2. Click the pencil icon (**Edit this file**).
3. Find the line `firebase: null,` and replace `null` with what you copied, so it reads like this:

   ```js
   firebase: {
     apiKey: "AIza...",
     authDomain: "underacademy-gradaition.firebaseapp.com",
     databaseURL: "https://underacademy-gradaition-default-rtdb.firebaseio.com",
     projectId: "underacademy-gradaition",
     storageBucket: "underacademy-gradaition.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   },
   ```

   Keep the comma after the closing `}`.
4. Click **Commit changes** (twice).
5. Wait a minute, then open `stage.html` on your site. The **Audience link** panel should say **live** instead of **rehearsal mode**.

These Firebase values are not passwords. Firebase is designed for them to sit in public web pages.

If you'd rather not edit code, send me the copied block and I'll send back a finished `config.js` to upload.

---

## Rehearsing with Rob

1. You open `stage.html`. Rob opens the audience link on his phone.
2. Rob picks a PhuD name and sends a line. It appears in your queue.
3. Click **Begin ceremony**, then **Speak next line** (or press the spacebar).
4. Use **Add sample lines for rehearsal** to fill the queue, and **Remove sample lines** before the real thing.
5. **Clear everything** erases lines and the transcript for everyone. It asks you to click twice.

For a clean slate without erasing the rehearsal, change `room: "gradaition"` in `config.js` to a new name, such as `room: "ceremony"`.

## On the night

You'll have two windows: a **control window** you keep to yourself, and a **stage window** that shows only ChatP.I.G. and his captions. The Zoom audience sees only the stage window.

1. Open `stage.html` in Chrome on the computer that will run ChatP.I.G. This is your control window. Click **Test voice** to check sound and pick a voice.
2. Click **Open stage window** (top of the controls). A second window opens with just ChatP.I.G. If nothing opens, allow pop-ups for your site and click again.
3. Arrange them. With two monitors, drag the stage window to the second one. With one screen, put the two windows side by side.
4. In Zoom, click **Share**, choose the **ChatP.I.G. on stage** window (not the control window), and turn on **Share sound** at the bottom of the share dialog.
5. Click **Copy** next to the audience link and paste it into the Zoom chat. Tell people: open the link on your phone, watch ChatP.I.G. in Zoom.
6. Run everything from the control window. Scroll, veto, and click freely; the audience never sees it.
7. Keyboard shortcuts work in either window: **Space** speaks the next line, **A** turns auto-run on and off, **N** moves to the next section, **X** cuts ChatP.I.G. off. Double-click the stage window to make it fill the screen.
8. Afterward, click **Copy transcript** for the Journal of Untrained Models.

Keep the control window open the whole time. The voice comes from it, and the stage window only mirrors it.

## If something goes wrong

- **The stage window is frozen or blank.** Close it and click **Open stage window** again. It picks up where things are.
- **A red "Standby" box appears.** Another control window is running somewhere: another tab, another browser, or someone else's computer. Only one window speaks at a time. Close the others, or click **Make this the active window** on the one you want.
- **Lines overlap or cut each other off.** Pick a voice without "online" in its name. On-device voices are the most reliable.
- **ChatP.I.G. is silent.** Click **Test voice**. If you hear nothing, try another voice from the list. Chrome and Edge have the most voices. Check that **Share sound** is on in Zoom.
- **Audience lines don't arrive.** The stage's **Audience link** panel must say **live**. If it says rehearsal mode, `config.js` is missing the Firebase settings or has a typo, such as a missing comma.
- **Someone is stuck on "Waiting its turn."** That's the fairness rule working. Their line is in the queue, and ChatP.I.G. reads whoever has been heard least first.
- **The fallback.** Lines typed in the Zoom chat can still reach ChatP.I.G.: copy the chat and use **Paste a chunk of Zoom chat** on the stage.
