# Hospital Management System

A MERN-based Hospital Management System for patient, staff, appointment, billing, pharmacy, laboratory, and room operations. The React client uses the existing Express API, MongoDB models, and cookie-based authentication.

---

## 📌 Features

### 👨‍⚕️ Admin Module

* Secure Admin Login
* Dashboard with Statistics
* Manage Doctors
* Manage Patients
* Manage Staff
* Manage Departments
* Manage User Accounts and Roles
* Appointment Management
* Billing & Payments
* Laboratory Management
* Pharmacy Management
* Reports & Analytics

Billing supports itemized invoices, recorded payment methods, searchable billing history, and printable invoices. Pharmacy inventory uses live database records for stock and expiry metrics and supports create, edit, and delete operations. Laboratory totals are derived from persisted test requests; daily billing revenue is based only on bills with a recorded payment date.

Appointments can be scheduled from existing patient and available-doctor records, filtered by status/date, and viewed in a calendar. The dashboard compares recent patient/appointment activity and daily revenue against the preceding period using saved database records; its activity feed reflects record update timestamps.

### Current implementation boundaries

Role-based page and API permissions are enforced: administrators have full access; doctors can read patients and lab records, create/read/update medical records, and read/update appointments; receptionists can manage patients, appointments, and billing while reading doctors, departments, and rooms; nurses can read/update patients, rooms, and lab records and create/read/update medical records; pharmacy staff manage inventory; and lab staff manage tests and read patients and departments. Unmapped account roles are denied module access. Appointment records are linked to people by name, not user/staff IDs, so doctor appointments are not restricted to an assigned-doctor relationship. Medical records capture the patient and author; all authorized doctors and nurses can access the records because staff accounts are not linked to patient assignments.

Room capacity generates individual bed slots, with legacy room-level assignments migrated to the first slot; nurses and administrators can manage bed allocations, while receptionists can read them. Occupied/reserved beds prevent room deletion, and occupied assignments cannot be duplicated. Administrators can manage departments and accounts/roles; clinical and reception roles can read department details. Department names cannot be changed while referenced and departments cannot be deleted while referenced by staff or appointments. Users can change their own password from Settings after verifying the current password. Passwords are stored as scrypt hashes, password/role/status changes revoke other active sessions, and at least one active administrator is required.

Notifications, payment-gateway processing, and file uploads for lab reports are not yet integrated. Razorpay and SMTP credentials are required before those external integrations can be enabled; no placeholder transactions or notifications are generated.

## Technologies

* **Frontend:** React, Vite, React Router, Recharts, Lucide
* **Backend:** Node.js, Express
* **Database:** MongoDB with Mongoose
* **Authentication:** Server-verified sessions in HttpOnly cookies

The project is separated into `frontend/` (React client and legacy page fallback) and `backend/` (Express API, MongoDB models, and environment configuration). Root `package.json` provides convenience scripts only.
Use Node.js 20.19 or newer.

## 🔐 Configuration and first run

Copy `backend/.env.example` to `backend/.env` and set a unique `ADMIN_PASSWORD` before starting with a new database. The administrator account is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` only when the user collection is empty. Existing legacy plaintext passwords are upgraded to a salted scrypt hash after a successful login.

Set a long, private `SESSION_SECRET` for deployments and keep `.env` out of source control. Demo patient and operational records are not created by default; set `SEED_DEMO_DATA=true` only when you explicitly want sample data in a non-production environment.

MongoDB must be available at `MONGODB_URI`. Install both application folders' dependencies:

```powershell
npm run install:all
```

For development, run the API and React client in separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`; Vite proxies `/api` and `/assets` to the Express server on port 3000.

For a production-style run, build React and start Express:

```powershell
npm run build
npm start
```

Express serves the compiled client and preserves the existing `.html` page URLs as React route aliases. The legacy HTML files remain available as a fallback if the React build has not been generated.

---

## 📸 Screenshots

Add screenshots of:

* Login Page
  <img width="938" height="473" alt="image" src="https://github.com/user-attachments/assets/00a18715-0060-4f60-a7e4-18fc02796478" />

* Admin Dashboard
  <img width="948" height="470" alt="image" src="https://github.com/user-attachments/assets/5a3a9440-0867-4aba-807d-e8408f313393" />

* Patient Dashboard
<img width="953" height="466" alt="image" src="https://github.com/user-attachments/assets/c2825f6c-fa2f-4168-ae69-cfe69676012e" />

* Doctor Dashboard

<img width="956" height="465" alt="image" src="https://github.com/user-attachments/assets/046e88a4-cc35-4c99-80f5-4efdb8283405" />

* Appointment Module

  <img width="956" height="470" alt="image" src="https://github.com/user-attachments/assets/fb6a4a36-a149-438c-b20c-8453650e2817" />

* Laboratory Module

  <img width="942" height="477" alt="image" src="https://github.com/user-attachments/assets/70b5a4f0-4af9-410c-8b09-3f358a383012" />

* Billing Module
![Uploading image.png…]()

---

## 🎯 Future Enhancements

* Online Payment Gateway
* Email Notifications
* SMS Alerts

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.



## 👨‍💻 Developer

**Chetan patel**

* Final Year BE/CSE.
* S N patel institute of tech College, bardoli
* Gujarat, India

---

⭐ If you found this project useful, don't forget to **Star** the repository!
