# Our Days — setup guide

This is the first working version of the shared journal: login, split-screen
journal with photos, editable names, trivia, and a tap-score game. Data
syncs between your two phones through Firebase, and works offline (saves
locally, syncs when back online).

## 1. Create your Firebase project (free)

1. Go to https://console.firebase.google.com and create a project.
2. In the project, go to **Build > Authentication > Sign-in method** and
   enable **Email/Password**.
3. Go to **Build > Firestore Database > Create database**, start in
   **test mode** for now (you can tighten security rules later).
4. Go to **Project settings > General > Your apps**, click the web icon
   (`</>`) to register a new web app, and copy the `firebaseConfig` object
   it gives you.
5. Paste those values into `firebase-config.js` in this project, replacing
   the placeholders.

## 2. Put it on GitHub

1. Create a new repo, e.g. `our-days`.
2. Upload all the files in this folder to it.
3. Go to the repo's **Settings > Pages**, set source to the `main`
   branch, root folder.
4. GitHub gives you a URL like `https://yourname.github.io/our-days/` —
   that's the link both of you open on your phones.

## 3. Add to home screen

Open the link in your phone's browser, then use "Add to Home Screen"
(Chrome: menu > Add to Home screen). It'll behave like an installed app.

## 4. First login

- Tap your profile, choose "Use email instead," and create an account
  with an email + password (Firebase Authentication).
- You'll be asked to set a 4-digit PIN — that's saved on your device only,
  for quick daily access without retyping your password each time.
- Do the same on her phone with her own email.

## Notes on this version

- Both names, entries, trivia scores, and game high scores are stored in
  one shared Firestore document, so either phone can edit either name.
- Photos are stored inline as part of each entry (fine for a personal
  journal; if entries get very photo-heavy later, moving to Firebase
  Storage would be the next upgrade).
- Trivia questions are the fixed kind — add them yourselves under
  "Manage questions." A version that auto-generates questions from your
  journal entries is a natural next step.
- Firestore is currently in test mode, which means anyone with your
  config could technically read/write it. Worth tightening the security
  rules once you're both using it regularly — happy to help with that
  next.
