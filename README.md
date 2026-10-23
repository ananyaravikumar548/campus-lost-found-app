# Campus Lost & Found Management System

> **Full-Stack Development Project (Phase 1 & Phase 2 Complete)**  
> Built with **Node.js • Express.js • EJS • MongoDB • Mongoose**

---

## 📌 Project Overview
A complete full-stack web application designed for college campuses to manage lost and found belongings. It replaces fragmented messaging groups with a centralized, relational database system where students can report lost items, log found belongings, file claims with ownership proof, and safely execute the return workflow.

---

## 📁 Project Structure

```text
campus-lost-found/
├── .env                  # Environment configuration (PORT=3001, MONGODB_URI)
├── .env.example          # Sample environment variables
├── .gitignore            # Excludes node_modules, .env, and OS logs
├── package.json          # Dependencies & scripts
├── index.js              # Express server, route controllers & business logic
├── seed.js               # Database seeding script with realistic campus test records
├── test_phase1.js        # Automated Phase 1 test suite (18 test cases)
├── test_phase2.js        # Automated Phase 2 test suite (10 test cases)
├── models/
│   ├── Student.js        # Student schema (unique MongoDB ObjectId, unique email)
│   ├── LostItem.js       # Lost item schema (linked via reportedBy to Student)
│   ├── FoundItem.js      # Found item schema (linked via reportedBy to Student)
│   └── Claim.js          # Claim schema (links FoundItem & Student with compound index)
├── views/
│   ├── home.ejs               # Dynamic dashboard with real-time stats & recent activity
│   ├── lost-items.ejs         # Lost items listing with search & category/status filters
│   ├── lost-item-details.ejs  # Dynamic lost item view with reporter card & status updater
│   ├── lost-item-new.ejs      # Form to report a lost item (dynamic student dropdown)
│   ├── found-items.ejs        # Found items listing with search & category/status filters
│   ├── found-item-details.ejs # Dynamic found item view with claims list, review actions & claim form
│   ├── found-item-new.ejs     # Form to report a found item (dynamic student dropdown)
│   ├── claims.ejs             # Centralized Claims Management Hub with filters & search
│   ├── students.ejs           # Student directory with search
│   ├── student-details.ejs    # Student profile (/students/:id) with lost/found items & claims
│   ├── student-new.ejs        # Form to register a student profile
│   ├── 404.ejs                # Custom 404 Not Found error page
│   ├── error.ejs              # Clean HTTP error handler (400, 403, 404, 500)
│   └── partials/
│       ├── header.ejs         # Navigation bar, brand icon, flash alerts
│       └── footer.ejs         # Footer with links & tech tags
└── public/
    └── styles.css        # Modern dark-theme glassmorphism CSS design system
```

---

## 🚀 How to Run the Project

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** running locally on default port `27017`

### 2. Setup & Installation
```bash
# Navigate to project folder
cd /Users/ananyaravikumar/.gemini/antigravity-ide/scratch/campus-lost-found

# Install dependencies
npm install

# Seed database with realistic campus test data (Students, Lost/Found Items, Claims)
npm run seed
```

### 3. Start the Application
```bash
# Production mode (Port 3001):
npm start

# Or with live reload:
npm run dev
```

Open your browser at:  
👉 **[http://localhost:3001](http://localhost:3001)**

---

## 🧪 Automated Test Suites

We provide automated test suites covering all **Phase 1** and **Phase 2** specifications:

```bash
# Run all 28 automated tests:
npm test

# Or run by phase:
npm run test:phase1   # 18 Phase 1 foundation tests
npm run test:phase2   # 10 Phase 2 business rule & claim workflow tests
```

---

## 🗄️ Database Design & Relationships

| Collection / Model | Key Fields | Relationship / Purpose |
| :--- | :--- | :--- |
| **`Student`** | `_id`, `fullName`, `email`, `department`, `contactNumber` | Unique MongoDB ObjectId (`_id`). One student can report multiple lost and found items. Email is strictly unique (`unique: true`). |
| **`LostItem`** | `_id`, `itemName`, `category`, `description`, `lastSeenLocation`, `dateLost`, `status`, `reportedBy` | `reportedBy` is a Mongoose reference (`ref: 'Student'`) pointing to a valid Student `_id`. |
| **`FoundItem`** | `_id`, `itemName`, `category`, `description`, `foundLocation`, `dateFound`, `status`, `reportedBy` | `reportedBy` is a Mongoose reference (`ref: 'Student'`) pointing to the finder Student `_id`. |
| **`Claim`** | `_id`, `foundItemId`, `claimedBy`, `reason`, `status`, `reviewedAt`, `createdAt` | Links a student to a found item with a compound unique index `{ foundItemId: 1, claimedBy: 1 }` preventing duplicate claims. |

---

## 🛣️ Complete Route List

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Home dashboard with live counts (lost, found, claims, returned), quick actions, and recent activity |
| `GET` | `/students` | List all students with search by name, email, or department |
| `GET` | `/students/new` | Form to register a new student profile |
| `POST` | `/students` | Create student profile with validation & duplicate email checks |
| `GET` | `/students/:id` | Dynamic student profile with items reported and claims filed/received |
| `GET` | `/lost-items` | Listing of lost items with keyword search & category/status filters |
| `GET` | `/lost-items/new` | Form to report a lost item (dynamic student selector) |
| `POST` | `/lost-items` | Create lost item report; verifies student existence in DB |
| `GET` | `/lost-items/:id` | View full details of one lost item report with populated student info |
| `PATCH` | `/lost-items/:id/status` | Update lost item status (`Open`, `Recovered`, `Closed`) |
| `GET` | `/found-items` | Listing of found items with search & category/status filters |
| `GET` | `/found-items/new` | Form to report a found item (dynamic student selector) |
| `POST` | `/found-items` | Create found item report linked to finder student |
| `GET` | `/found-items/:id` | View found item details, submitted claims, review actions, and claim submission form |
| `PATCH` | `/found-items/:id/status` | Update found item status (`Available`, `Claimed`, `Returned`) |
| `POST` | `/found-items/:id/claims` | **(Phase 2)** Submit an ownership claim for a found item with proof |
| `PATCH` | `/claims/:id/status` | **(Phase 2)** Approve or reject a claim (enforces ownership verification) |
| `GET` | `/claims` | **(Phase 2)** Centralized Claims Management Hub with status filtering & search |

---

## 🧠 Solutions to the 5 Thinking Challenges

### 1. Ownership Check
*Requirement: If Student A reported a found item, Student B must not be able to approve a claim for it by changing an ID in the URL or request body.*
- **Enforcement (`index.js` under `PATCH /claims/:id/status`)**:
  The backend retrieves the claim and populates its associated `foundItemId`. It checks whether `reviewerStudentId` matches `foundItem.reportedBy`.
  ```javascript
  if (!reviewerStudentId || foundItem.reportedBy.toString() !== reviewerStudentId.toString()) {
    return res.status(403).render('error', {
      title: 'Unauthorized Action',
      statusCode: 403,
      message: 'Permission denied: Only the student who reported finding this item is authorized to approve or reject claims.'
    });
  }
  ```
  If unauthorized, the server responds with **HTTP 403 Forbidden** and aborts the update.

### 2. Relationship Check
*Requirement: A claim must refer to an existing found item and an existing student. It must not be saved if either record is missing.*
- **Enforcement (`index.js` under `POST /found-items/:id/claims`)**:
  Validates both IDs using `mongoose.isValidObjectId()`, queries `FoundItem.findById(id)` and `Student.findById(claimedBy)`. If either record is null, the server returns **HTTP 404** or **HTTP 400** before touching the database.

### 3. State Check
*Requirement: Once an item is marked Returned, a new claim must be rejected.*
- **Enforcement (`index.js` under `POST /found-items/:id/claims`)**:
  ```javascript
  if (foundItem.status === 'Returned') {
    return res.status(400).render('error', {
      title: 'Item Already Returned',
      statusCode: 400,
      message: 'This item has already been marked as Returned and cannot be claimed again.'
    });
  }
  ```
  The UI also locks the claim form and renders an alert informing users that the item is closed for claims. In `PATCH /claims/:id/status`, approvals for an already returned item are similarly blocked.

### 4. Duplicate-Claim Check
*Requirement: Prevent the same student from submitting multiple claims for the same found item.*
- **Enforcement**:
  1. **Database Schema Level (`models/Claim.js`)**: Compound unique index `claimSchema.index({ foundItemId: 1, claimedBy: 1 }, { unique: true });`.
  2. **Route Controller Level (`index.js`)**: Before saving, queries `Claim.findOne({ foundItemId: foundItem._id, claimedBy: claimantStudent._id })`. If an existing claim is found, returns **HTTP 400 Bad Request** with a friendly error: *"You have already submitted a claim for this item (Status: ...). Duplicate claims are not permitted."*

### 5. Safe Update
*Requirement: When changing a claim's status, update only the intended fields without overwriting unrelated data.*
- **Enforcement (`index.js` under `PATCH /claims/:id/status`)**:
  Uses Mongoose `$set` atomic operator:
  ```javascript
  await Claim.findByIdAndUpdate(
    id,
    { $set: { status, reviewedAt: new Date() } },
    { new: true, runValidators: true }
  );
  ```
  This guarantees `reason`, `claimedBy`, `foundItemId`, and timestamps remain untouched.

---

## 🎬 Step-by-Step Presentation Demonstration (Claim-to-Return Workflow)

1. **View Found Items**: Go to `/found-items` and select **"Wireless Bluetooth Earbuds (White Case)"** reported by **Priya Patel**.
2. **Submit a Claim**: In the claim form, select **Rohan Verma**, enter ownership proof: *"These are my Boat earbuds with an Apple sticker on the back"*, and submit.
   - The claim is saved with status **Pending**.
   - The found item status updates to **Claimed**.
3. **Attempt Unauthorized Approval**:
   - In the review form, change the reviewer dropdown to **Ananya Sharma** (not the finder) and click Approve.
   - The server catches this in the backend and blocks it with **HTTP 403 Forbidden**.
4. **Authorized Approval**:
   - Select the actual finder, **Priya Patel**, and click **Approve Claim**.
   - The claim is marked as **Approved**.
   - The found item status changes to **Returned**.
5. **Verify State Locking**:
   - Return to the item page: Notice the claim form is replaced with a locked message *"Item Returned & Closed for Claims"*.
   - Any attempt to submit a claim returns **HTTP 400**.
6. **Student Profile**: Visit `/students/:id` for Rohan Verma and Priya Patel to observe their updated activity and claims history.
