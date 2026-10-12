// UnderAcademy Gradaition settings.
//
// Until you paste in your Firebase settings below, both pages run in
// REHEARSAL MODE: they only talk to other tabs in the same browser on the
// same computer. That is handy for testing, but the Zoom audience will not
// reach the Pig until the Firebase settings are filled in.
//
// To go live: replace `firebase: null` with the firebaseConfig object that
// the Firebase console gives you (see SETUP.md, Part 2). It looks like this:
//
//   firebase: {
//     apiKey: "AIza...",
//     authDomain: "underacademy-gradaition.firebaseapp.com",
//     databaseURL: "https://underacademy-gradaition-default-rtdb.firebaseio.com",
//     projectId: "underacademy-gradaition",
//     storageBucket: "underacademy-gradaition.appspot.com",
//     messagingSenderId: "1234567890",
//     appId: "1:1234567890:web:abc123"
//   },
//
// These values are not passwords. Firebase expects them to be public.

window.GRAD_CONFIG = {
  firebase: null,

  // Change this to start a fresh ceremony without deleting the old one
  // (for example "rehearsal" for practice, then "gradaition2026" for the real thing).
  room: "gradaition"
};
