# Security Configuration & Implementation Guide

This project is configured with a high-security architecture separating Client-side Route Locks and Server-side Database Validation rules.

## 1. Page-Level Access Locking (Client-Side)

We have implemented a route security wrapper inside the global [DashboardLayout](file:///Users/niyamulhasan/Desktop/Code/meal%20management/src/app/%28dashboard%29/layout.tsx):
* Newly registered accounts default to the `visitor` role.
* Visitors are fully blocked from accessing any system dashboards (Meals, Ledger, Rent, Rules, Users, Settings) and are redirected to a **"Pending Approval"** screen.
* Once an administrator approves and elevates the visitor's role to `member`, `moderator`, or `admin`, they automatically gain access dynamically.

---

## 2. Firestore Database Security Rules (Server-Side)

All write operations originating from client-side devices are strictly audited by the Firebase server. We have created a [firestore.rules](file:///Users/niyamulhasan/Desktop/Code/meal%20management/firestore.rules) file in the root directory.

### Collection Validations Summary:
* **`users` (Profiles)**: 
  * Any authenticated user can read profiles.
  * A user can only register/create their own document with default settings (role: `visitor`, balance: `0`, guest status).
  * Only `admin` role can promote/change roles or edit balances.
  * Self-role promotion or self-balance tampering is physically blocked on the server.
* **`meals` (Daily Logs)**:
  * Only admins and moderators can write logs freely.
  * Regular members can only write their own daily logs, and only if the system settings allow member editing (`allowMemberEditing`).
* **`bazar_costs` (Expenses)**:
  * Restricts write access only to authorized roles (`admin`, `moderator`, `member`). Visitors cannot write expense entries.
* **`payments` (Deposits)**:
  * Extremely critical collections involving funds. Only the `admin` role can create, modify, or delete deposit and payment transactions.
* **`system_config` (Settings)**:
  * Settings are read-only for general members and visitors. Only `admin` role can update configurations.

---

## 3. How to Deploy Security Rules to Firebase

To deploy these security rules directly to your Firebase project:

### Option A: Using Firebase CLI (Recommended)
If you have the Firebase CLI set up, deploy rules with:
```bash
firebase deploy --only firestore:rules
```

### Option B: Firebase Web Console
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Click on **Firestore Database** on the left menu.
4. Click on the **Rules** tab.
5. Copy the contents of the [firestore.rules](file:///Users/niyamulhasan/Desktop/Code/meal%20management/firestore.rules) file and paste it there.
6. Click **Publish**.
