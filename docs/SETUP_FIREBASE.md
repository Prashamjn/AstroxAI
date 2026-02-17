# AstroxAI — Firebase Auth Setup (FREE Tier)

Complete step-by-step guide to get authentication running in the browser and in code. Do these **in order** in your browser and in the project.

---

## PART 1: What You Get

- **Email/password** signup and login  
- **Google OAuth** login  
- **Profile onboarding**: name, DOB, username (must end with `astai`), optional photo, bio, country, default agent  
- **Username rule**: unique, lowercase + numbers only, must end with `astai` (e.g. `codekingastai`)  
- **Firestore**: `users/{uid}`, `usernames/{username}`  
- **Firebase Storage**: profile pictures under `avatars/{uid}/`  
- **Session**: persisted in browser (local)  
- **Password reset** and **email verification** (optional)  

All of this stays within **Firebase free tier** if you stay under the limits below.

---

## PART 2: Browser Steps (Do This First)

### Step 1: Create Firebase project

1. Open **https://console.firebase.google.com**  
2. Sign in with your Google account  
3. Click **“Create a project”** (or “Add project”)  
4. Project name: **AstroxAI** (or any name)  
5. Disable Google Analytics if you don’t need it (optional)  
6. Click **“Create project”** and wait until it’s ready  

### Step 2: Enable Authentication

1. In the left sidebar, go to **Build → Authentication**  
2. Click **“Get started”**  
3. Open the **“Sign-in method”** tab  
4. **Email/Password**:  
   - Click **Email/Password** → turn **Enable** ON → **Save**  
5. **Google**:  
   - Click **Google** → **Enable** → choose a **Project support email** → **Save**  

### Step 3: Register your web app and get config

1. In Project Overview (home icon), click the **Web** icon (`</>`) to add an app  
2. App nickname: e.g. **AstroxAI Web**  
3. Do **not** check “Firebase Hosting” yet (you can add it later)  
4. Click **“Register app”**  
5. You’ll see a `firebaseConfig` object. Copy it; you’ll put it in `.env` next  

Example:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

6. Click **“Continue to console”** (you can skip the SDK snippets for now)  

### Step 4: Create `.env` in the client

1. In your repo, go to **`client/`**  
2. Copy **`client/.env.example`** to **`client/.env`**  
3. Fill **`client/.env`** with the values from the Firebase config:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
```

Use the **exact** names above (Vite only exposes env vars that start with `VITE_`).

### Step 5: Enable Firestore

1. In Firebase Console left sidebar: **Build → Firestore Database**  
2. Click **“Create database”**  
3. Choose **“Start in test mode”** for development (we’ll lock it down with rules next)  
4. Pick a location close to your users → **Enable**  

### Step 6: Deploy Firestore rules

1. In the project root, open **`firebase/firestore.rules`** (from this repo)  
2. In Firebase Console: **Firestore Database → Rules**  
3. Replace the default rules with the contents of **`firebase/firestore.rules`**  
4. Click **“Publish”**  

This gives:

- `users/{userId}`: read/write only by that user  
- `usernames/{username}`: read by any signed-in user; only create with `uid == auth.uid`; no update/delete  

### Step 7: Enable Storage and deploy Storage rules

1. **Build → Storage** → **Get started**  
2. Start in **test mode** for development → **Next** → choose location → **Done**  
3. Open **Storage → Rules**  
4. Replace with the contents of **`firebase/storage.rules`**  
5. **Publish**  

Rules allow read/write only under `avatars/{userId}/` for that user.

### Step 8: Authorized domains (for OAuth)

1. **Authentication → Settings → Authorized domains**  
2. You should see `localhost` already  
3. When you deploy, add your production domain (e.g. `yourapp.vercel.app`)  

---

## PART 3: Run the app locally

```bash
# From repo root
cd client
npm install
npm run dev
```

Open **http://localhost:5173** (or the port Vite shows).

- **Sign up** with email/password or Google  
- You’ll be sent to **/onboarding** to complete profile (name, DOB, username ending with `astai`)  
- After that you’ll land on the dashboard; sidebar shows **@username** and **Sign out**  

---

## PART 4: Firestore data shape

**Collection: `users`**  
Document ID = Firebase Auth `uid`.

```json
{
  "name": "Full Name",
  "dob": "2000-01-15",
  "username": "codekingastai",
  "photoURL": "https://...",
  "email": "user@example.com",
  "bio": "Optional bio",
  "country": "Optional",
  "settings": {
    "theme": "dark",
    "defaultAgent": "auto"
  },
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>"
}
```

**Collection: `usernames`**  
Document ID = username (e.g. `codekingastai`). One field: `uid` (string). Used to enforce uniqueness.

---

## PART 5: Free hosting options

All of these have free tiers suitable for AstroxAI.

| Platform        | Free tier notes                          |
|-----------------|------------------------------------------|
| **Vercel**      | Deploy `client` as Vite/React app        |
| **Netlify**     | Deploy `client`, env vars in dashboard   |
| **Cloudflare Pages** | Connect repo, build command `npm run build`, output `dist` |
| **Firebase Hosting** | `firebase init hosting`, then `firebase deploy` for `client/dist` |

For **Vercel** (example):

1. Push repo to GitHub  
2. Go to **vercel.com** → New Project → Import repo  
3. Root directory: **`client`**  
4. Build: **`npm run build`**, Output: **`dist`**  
5. Add **Environment variables** from `client/.env` (all `VITE_FIREBASE_*`)  
6. Deploy  
7. Add the Vercel URL to **Firebase → Authentication → Authorized domains**  

---

## PART 6: When does it become paid?

- **Firebase Auth**: Free for unlimited users; no automatic upgrade.  
- **Firestore**:  
  - 50K reads / 20K writes / 20K deletes per day free  
  - Above that you need Blaze (pay-as-you-go)  
- **Storage**: 5 GB stored, 1 GB/day download free  
- **Hosting (Vercel/Netlify/CF)**: Free tiers have bandwidth limits; fine for small/medium traffic  

So: the **account system** stays free until you get to large scale (millions of users or very heavy usage). For a typical small/medium app, you can stay on free tier.

---

## PART 7: Optional — Email verification and password reset

- **Password reset**: Already implemented; use **“Forgot password?”** on the login page.  
- **Email verification**: `sendVerificationEmail()` is in `client/src/lib/auth.js`. You can add a banner on the dashboard that calls it and shows “Check your email to verify.”  

No extra browser steps; just use the Auth UI you already have.

---

## PART 8: Checklist (what you must do in the browser)

- [ ] Create Firebase project at **console.firebase.google.com**  
- [ ] Enable **Email/Password** and **Google** in Authentication  
- [ ] Register **Web** app and copy `firebaseConfig`  
- [ ] Create **`client/.env`** with all `VITE_FIREBASE_*` variables  
- [ ] Create **Firestore** database (test mode first)  
- [ ] Paste **`firebase/firestore.rules`** in Firestore Rules and **Publish**  
- [ ] Enable **Storage**, then paste **`firebase/storage.rules`** and **Publish**  
- [ ] Add production domain to **Authorized domains** when you deploy  

After that, run `npm run dev` in `client`, sign up, complete onboarding, and use the app.
