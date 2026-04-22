rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // --- Global Helpers ---
    function isSignedIn() { return request.auth != null; }
    function isVerified() { return request.auth.token.email_verified == true; }
    function isValidId(id) { return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$'); }
    function getRole() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
    function isAdmin() { return isSignedIn() && getRole() == 'BM'; }

    // --- Global Catch-all ---
    match /{document=**} {
      allow read, write: if false;
    }

    // --- Users Collection ---
    match /users/{userId} {
      allow get: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow update: if isSignedIn() && request.auth.uid == userId && 
                    request.resource.data.role == resource.data.role; // Cannot change own role
      
      // Allow user creation by themselves (initial profile setup)
      allow create: if isSignedIn() && request.auth.uid == userId &&
                    request.resource.data.role in ['店長', 'AM'];
    }

    // --- Reports Collection ---
    match /reports/{reportId} {
      allow list: if isSignedIn() && (
        getRole() == 'BM' || 
        (getRole() == 'AM' && resource.data.authorRole in ['AM', 'BM']) ||
        getRole() == '店長'
      );
      allow get: if isSignedIn();
      allow create: if isSignedIn() && isVerified() && request.resource.data.authorId == request.auth.uid;
      allow update: if isSignedIn() && (
        isAdmin() || 
        (request.auth.uid == resource.data.authorId)
      );
      allow delete: if isAdmin();
    }
  }
}
