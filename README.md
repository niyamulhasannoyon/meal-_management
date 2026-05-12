# Mess & Rent Manager

A comprehensive web application for managing mess meals, house rent, and shared utility bills efficiently.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Backend:** Firebase (Firestore & Authentication)
- **Icons:** Lucide React
- **Date Handling:** date-fns

## Key Features
- **User Management:** Administrative control over members, roles, and rent status.
- **Daily Meals:** Track daily meal counts with automatic defaulting from the previous day and 10 PM auto-submission.
- **Monthly Ledger:** Real-time calculation of meal rates, bazar costs, and per-person balances.
- **Rent Manager:** Manage fixed and variable house costs (Gas, WiFi, Electricity, etc.) across permanent members.
- **Activity Logs:** Auditing for all administrative actions.
- **Security:** Role-based access control (Admin, Moderator, Member, Visitor).

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file in the root directory and add your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Production Build:**
   ```bash
   npm run build
   ```
   The static export will be generated in the `out` directory (or customized to `public_html` for Hostinger).

## License
MIT
# meal-_management
