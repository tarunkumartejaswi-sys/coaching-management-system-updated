# Firestore Rules Fix

This version updates the admin role check to accept `admin`, `Admin`, or `ADMIN` and keeps Director writes restricted to authenticated admins.

## Deploy Firestore rules

From this project root:

```bash
firebase login
firebase use coaching-management-system-new
firebase deploy --only firestore:rules
```

After deployment, log out of the website and log in again so the app receives a fresh Firebase Auth session.

## If Director still says "Missing or insufficient permissions"

Open Firebase Console -> Firestore Database -> Rules and confirm the published rules contain:

```text
function isAdmin() { return signedIn() && userData().role in ["admin", "Admin", "ADMIN"]; }
```

and:

```text
match /director/{directorId} {
  allow read: if signedIn();
  allow create, update, delete: if isAdmin();
}
```

Do not use `allow read, write: if true;` because that would allow anyone to modify the coaching data.
