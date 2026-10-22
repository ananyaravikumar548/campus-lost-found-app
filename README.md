# Campus Lost & Found Management System

> **Phase 1: Foundation and Core Functionality**  
> Built with **Node.js • Express.js • EJS • MongoDB • Mongoose**

---

## 📌 Project Overview
A full-stack web application designed for college campuses to manage lost and found belongings. It replaces messy messaging groups with a centralized, relational database system where students can report lost items, log found belongings, and link them to verified student profiles.

---

## 📁 Project Structure

```text
campus-lost-found/
├── .env                  # Environment configuration (Port, MongoDB URI)
├── .env.example          # Sample environment variables
├── package.json          # Dependencies & scripts
├── index.js              # Main Express server, routing & error middleware
├── seed.js               # Database seeding script with realistic campus test data
├── test_phase1.js        # Automated test suite (18 test cases)
├── models/
│   ├── Student.js        # Student profile schema (unique MongoDB ObjectId, unique email)
│   ├── LostItem.js       # Lost item schema (linked via reportedBy to Student)
│   ├── FoundItem.js      # Found item schema (linked via reportedBy to Student)
│   └── Claim.js          # Claim schema (prepared for Phase 2 workflow)
├── views/
│   ├── home.ejs               # Dynamic dashboard with stats & recent items
│   ├── lost-items.ejs         # Lost items listing with search & category/status filters
│   ├── lost-item-details.ejs  # Dynamic lost item view with reporter card & status update
│   ├── lost-item-new.ejs      # Form to report a lost item (dynamic student dropdown)
│   ├── found-items.ejs        # Found items listing with search & filters
│   ├── found-item-details.ejs # Dynamic found item view with finder card & claim preview
│   ├── found-item-new.ejs     # Form to report a found item (dynamic student dropdown)
│   ├── students.ejs           # Student directory with search
│   ├── student-details.ejs    # Dynamic student profile (/students/:id) with their lost & found items
│   ├── student-new.ejs        # Form to register a student profile
│   ├── 404.ejs                # Custom 404 Not Found error page
│   ├── error.ejs              # Clean HTTP error handler (400, 404, 500)
│   └── partials/
│       ├── header.ejs         # Navigation bar, brand icon, flash alerts
│       └── footer.ejs         # Footer with links & tech tags
└── public/
    └── styles.css        # Modern dark-theme glassmorphism CSS design system
```

---

## 🚀 How to Run the Project

### 1. Project Directory
The project is located at:
```bash
/Users/ananyaravikumar/.gemini/antigravity-ide/scratch/campus-lost-found
```

### 2. Prerequisites
- **Node.js** (v18+)
- **MongoDB** running locally on default port `27017`

### 3. Open in Terminal
```bash
cd /Users/ananyaravikumar/.gemini/antigravity-ide/scratch/campus-lost-found
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Seed Database (Optional but Recommended)
Populates realistic campus profiles and sample lost/found reports:
```bash
npm run seed
```

### 6. Start the Server
```bash
# Production mode:
npm start

# Or with live reload:
npm run dev
```

The system will start at:
👉 **[http://localhost:3001](http://localhost:3001)**

### 7. Run Automated Tests
Execute the 18 comprehensive test cases covering routes, validations, relationships, and edge cases:
```bash
npm test
```

---

## 🗄️ Database Design & Relationships

| Collection / Model | Key Fields | Relationship / Purpose |
| :--- | :--- | :--- |
| **`Student`** | `_id`, `fullName`, `email`, `department`, `contactNumber` | Unique MongoDB ObjectId (`_id`). One student can report multiple lost and found items. Email is strictly unique (`unique: true`). |
| **`LostItem`** | `_id`, `itemName`, `category`, `description`, `lastSeenLocation`, `dateLost`, `status`, `reportedBy` | `reportedBy` is a Mongoose reference (`ref: 'Student'`) pointing to a valid Student `_id`. |
| **`FoundItem`** | `_id`, `itemName`, `category`, `description`, `foundLocation`, `dateFound`, `status`, `reportedBy` | `reportedBy` is a Mongoose reference (`ref: 'Student'`) pointing to the finder Student `_id`. |
| **`Claim`** | `_id`, `foundItemId`, `claimedBy`, `reason`, `status`, `createdAt` | Links a student to a found item with compound unique index preventing duplicate claims. |

---

## 🛣️ Phase 1 Route List

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Home dashboard with live counts, quick actions, and recent lost/found items |
| `GET` | `/students` | List all students with search by name, email, or department |
| `GET` | `/students/new` | Form to register a new student profile |
| `POST` | `/students` | Create student profile with validation & duplicate email checks |
| `GET` | `/students/:id` | Dynamic student profile displaying their contact info and items they reported |
| `GET` | `/lost-items` | Dynamic listing of all lost items with keyword search & category/status filters |
| `GET` | `/lost-items/new` | Form to report a lost item (dynamic student selector) |
| `POST` | `/lost-items` | Create lost item report; verifies student existence in DB |
| `GET` | `/lost-items/:id` | View full details of one lost item report with populated student info |
| `PATCH` | `/lost-items/:id/status` | Update lost item status (`Open`, `Recovered`, `Closed`) |
| `GET` | `/found-items` | Dynamic listing of all found items with search & category/status filters |
| `GET` | `/found-items/new` | Form to report a found item (dynamic student selector) |
| `POST` | `/found-items` | Create found item report linked to finder student |
| `GET` | `/found-items/:id` | View full details of one found item report and finder info |
| `PATCH` | `/found-items/:id/status` | Update found item status (`Available`, `Claimed`, `Returned`) |

---

## 🛡️ Validation & Error Handling
1. **Invalid MongoDB ObjectIds**: Intercepted using `mongoose.isValidObjectId(id)`. Returns HTTP `400 Bad Request` with a friendly error page instead of crashing the server with a `CastError`.
2. **Missing Records**: If an ID is valid hex but does not exist in MongoDB, returns HTTP `404 Not Found`.
3. **Empty/Whitespace Inputs**: Trims all string inputs; rejects empty strings or missing required fields with HTTP `400`.
4. **Duplicate Student Emails**: Handled via Mongoose unique index and pre-validation check; returns HTTP `400` with user-friendly message.
5. **Relationship Integrity**: When reporting an item, verifies that the selected `reportedBy` student actually exists in the database before saving.
