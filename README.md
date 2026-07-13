# Kaarigar Marketplace

Kaarigar is a digital local marketplace platform designed to onboard and empower micro-entrepreneurs (local artisans, tailors, cobblers, potters, etc.) and connect them directly with patrons (customers) who wish to support local handmade crafts.

---

## 🏗️ Architecture & Technology Stack

The application uses a lightweight, high-performance architecture optimized for reliability and accessibility:

1.  **Frontend**: Static **Vanilla HTML5**, **CSS3** (custom themed design system), and **Vanilla JavaScript** (using async fetch APIs) served directly by the backend. No heavy framework hydration or build-step dependencies.
2.  **Backend**: **Node.js** with **Express.js** providing secure JWT authentication, session handling, static routing, and REST API collections.
3.  **Database**: Hybrid support for **MongoDB Atlas** or an **Automatic In-Memory Mock Database Fallback** for seamless local execution.
4.  **AI Assistant**: Powered by the **Gemini 2.5 Flash API** to guide users on traditional Indian crafts.

---

## 📋 Core Features

### 👤 Micro-Entrepreneurs (Artisans)
*   **Structured Profiles**: Dedicated fields for business name, craft category, experience level, location, phone, and biography.
*   **Dual-Catalog Management**: Tabbed creation tools to separately publish physical handmade products and skill-based workshops/services.
*   **Availability Management**: Toggles to mark the artisan as active/inactive for bespoke service bookings, automatically updating public profile pages.
*   **Earnings Overview**: Real-time stats computing completed and pending transaction values on the dashboard.

### 👥 Patrons (Customers)
*   **Category Search**: Browse local artisans by category (Potter, Cobbler, Tailor, Artisan, Vendor).
*   **Direct Ordering**: Make direct product purchases or submit custom bespoke instructions.
*   **Feedback System**: Write rating reviews (1-5 stars) and post comments for completed service bookings.
*   **Disputes System**: Log formal dispute claims directly from completed order cards.

### 🛡️ Super Administrator Portal
*   **Analytics Overview**: Track user role distribution, category breakdowns, and platform metrics.
*   **Artisan Verification**: Review and verify/revoke status badges for micro-entrepreneurs.
*   **Moderation Controls**: Add/delete categories and remove/moderate unverified services.
*   **Dispute Resolution**: Review customer dispute claims and override order states.

---

## 🎯 Scope of Work

### In-Scope
*   **Web-based Responsive Platform**: Optimized layout structures for desktops and mobile viewports.
*   **Artisan Profiles & Service Listings**: Standard and custom catalog listings detailing skills and services.
*   **Product Marketplace**: Standard product shopping cards for physical, handmade items.
*   **Order & Service Request Management**: End-to-end request pipelines linking customers, artisans, and disputes.

### Out of Scope
*   **Native Mobile Applications**: Platform operates entirely as a responsive web app.
*   **International Shipping**: Limited strictly to local geographical boundaries.
*   **Advanced AI Recommendations**: Employs static queries and interactive AI chat helpers (via Gemini) but no automated recommendation ranking models.
*   **Logistics & Delivery Management**: Third-party deliveries or logistics portals are not supported (manual coordination).

---

## ⚙️ Project Assumptions & Constraints

### Assumptions
*   **Digital Onboarding**: Local micro-entrepreneurs are willing to transition onto a digital platform to find patrons.
*   **Local Support**: Customers are actively seeking and willing to support local craftsmen.
*   **Basic Internet Access**: Low bandwidth or basic internet access is available on smartphones.

### Constraints
*   **Digital Literacy**: The platform features a simplified, highly visual user interface with minimal inputs to accommodate varied digital literacy levels.
*   **Geographic Boundaries**: Limited initial geographic coverage focusing on local artisan clusters.
*   **Manual Fulfillment**: Order coordination and service delivery are handled manually via direct messaging or phone calls facilitated by the platform.

---

## 📈 Key Performance Indicators (KPIs)
The Admin Portal monitors the following core KPIs:
1.  **Registered Artisans**: Total verified micro-entrepreneurs onboarded.
2.  **Active Users**: Total registered buyers and sellers.
3.  **Service Conversion Rate**: Percentage of bespoke bookings successfully fulfilled.
4.  **Product Sales Volume**: Total unit count of physical product sales.
5.  **Average Artisan Earnings**: Average sales volume calculated per registered artisan.
6.  **Customer Satisfaction**: Average star rating across all reviews.

---

## 🚀 Running the Project Locally

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the dev server**:
    ```bash
    npm run dev
    ```
3.  **Open in browser**: Navigate to `http://localhost:3000` to interact with the platform.
