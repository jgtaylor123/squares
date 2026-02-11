# Squares Grid - Football Squares Game

A Progressive Web App (PWA) for managing football squares pools with real-time updates using Firebase.

## Features

- 🏈 10x10 grid for football squares
- 🔐 Authentication (Google Sign-In & Email/Password)
- 📱 Progressive Web App (installable on mobile devices)
- 🔄 Real-time updates with Firestore
- 🔒 Password-protected boards
- 🎯 Short codes for easy board sharing
- 📊 Score tracking by quarter
- 🏷️ Automatic reservation tags (email-based or Google display name)
- 👁️ Email tooltip on hover (masked for privacy)
- 🔗 Board locking to prevent changes after game start

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **PWA**: Service Worker, Web Manifest
- **Admin Tools**: Firebase Admin SDK (Node.js)

## Project Structure

```
squares/
├── public/
│   ├── admin.html          # Admin board management
│   ├── grid.html           # Main game grid
│   ├── index.html          # Homepage/login
│   ├── grid-common.js      # Core grid logic
│   ├── styles.css          # Global styles
│   ├── service-worker.js   # PWA offline support
│   ├── manifest.json       # PWA manifest
│   ├── icon.svg            # App icon
│   └── favicon.svg         # Favicon
├── firebase.json           # Firebase hosting config
├── firestore.rules         # Firestore security rules
└── package.json            # Node.js dependencies
```

## Dependencies

### Runtime (Client-side)
- Firebase JS SDK 10.14.0 (loaded via CDN)
  - firebase-app-compat
  - firebase-auth-compat  
  - firebase-firestore-compat

### Development (Server-side)
- Node.js (v14 or higher recommended)
- firebase-admin: ^13.6.1
- firebase-tools (global): `npm install -g firebase-tools`

## Setup

### 1. Prerequisites
- Node.js installed
- Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)
- Firebase CLI installed: `npm install -g firebase-tools`

### 2. Firebase Configuration

1. Create a Firebase project
2. Enable Firestore Database
3. Enable Authentication (Google & Email/Password providers)
4. Download service account key (for admin scripts):
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Save as `serviceAccountKey.json` in project root (**DO NOT COMMIT**)

### 3. Local Setup

```bash
# Install dependencies
npm install

# Login to Firebase
firebase login

# Set your Firebase project
firebase use --add

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Deploy hosting and Firestore rules
firebase deploy --only hosting,firestore
```

### 4. Firebase Hosting Configuration

The `/__/firebase/init.js` script automatically loads your Firebase config from your project settings when deployed to Firebase Hosting.

## Firestore Collections

### grids
Stores board data for each game.

```javascript
{
  boardId: string,           // Random 32-char ID
  label: string,             // Board name
  teamA: string,             // Team A name
  teamB: string,             // Team B name
  password: string,          // Board password
  shortCode: string,         // Optional short code (e.g., "sb60")
  locked: boolean,           // Prevent reservations when true
  reservations: {            // Cell reservations
    "1-1": {
      userId: string,
      label: string,
      email: string
    }
  },
  firstColumn: number[],     // Random digits 0-9
  topRow: number[],          // Random digits 0-9
  scoreQ1: string,           // Quarter 1 score
  scoreQ2: string,           // Quarter 2 score
  scoreQ3: string,           // Quarter 3 score
  scoreFinal: string,        // Final score
  createdBy: string,
  updatedAt: timestamp
}
```

### users
Stores user data and board access.

```javascript
{
  email: string,
  displayName: string,
  partyId: string,           // Random 32-char user ID
  accessedBoards: string[],  // Array of board IDs
  updatedAt: timestamp
}
```

### shortCodes
Maps short codes to board IDs.

```javascript
{
  boardId: string,
  createdBy: string,
  createdAt: timestamp
}
```

## Features Detail

### Short Codes
Boards can have memorable short codes (e.g., "sb60") instead of long random IDs:
- URL: `https://your-app.web.app/grid.html?code=sb60`
- Validates format: lowercase letters, numbers, hyphens, underscores only
- Checks uniqueness before creation

### Reservation Tags
- **Google users**: First 4 letters of first name + first 4 of last name
- **Email users with dot/hyphen**: Split on special char, first 4 of each part
- **Email users without special chars**: First 4 of email + @ + first 3 of domain

### Email Privacy
- Hover over reserved cell for 5 seconds to see masked email
- Format: `jo******or@domain.com` (first 2 + stars + last 2)

### PWA Features
- Installable on mobile devices
- Offline-capable with service worker
- Network-first caching strategy
- Auto-updates on new deployments

## Security

### Important Files to Keep Private
- `serviceAccountKey.json` - Firebase admin credentials (**NEVER COMMIT**)
- Firebase project credentials are auto-loaded from `/__/firebase/init.js` on hosting

### Firestore Rules
See `firestore.rules` for current security configuration:
- Grids: Read by all, write by authenticated users
- Users: Read by all, write to own document only
- Short codes: Read by all, write by authenticated users

## Deployment

```bash
# Deploy everything
npm run deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore
```

## Admin Functions

All authenticated users can:
- Create new boards with passwords and short codes
- Update board details (teams, passwords, short codes)
- Lock/unlock boards
- Clear or populate random numbers
- Delete boards
- View boards they have created or accessed

## Browser Support

- Modern browsers with ES6+ support
- Progressive Web App features require HTTPS
- Service Worker requires modern browser

## License

Private project - All rights reserved

## Contact

For issues or questions, contact project maintainer.
