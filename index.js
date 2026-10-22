require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');

// Import Mongoose Models
const Student = require('./models/Student');
const LostItem = require('./models/LostItem');
const FoundItem = require('./models/FoundItem');
const Claim = require('./models/Claim');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_lost_found';

// Common categories used across Lost & Found items
const ITEM_CATEGORIES = [
  'Electronics',
  'Accessories',
  'Documents & IDs',
  'Books & Stationery',
  'Keys',
  'Clothing',
  'Bottles & Flasks',
  'Other'
];

// Middleware configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Pass helper variables to all views
app.use((req, res, next) => {
  res.locals.categories = ITEM_CATEGORIES;
  res.locals.successMessage = req.query.success || null;
  res.locals.errorMessage = req.query.error || null;
  next();
});

// ==========================================
// 1. HOME / DASHBOARD ROUTE
// ==========================================
app.get('/', async (req, res, next) => {
  try {
    const [lostCount, foundCount, studentCount, returnedCount, recentLostItems, recentFoundItems] =
      await Promise.all([
        LostItem.countDocuments(),
        FoundItem.countDocuments(),
        Student.countDocuments(),
        FoundItem.countDocuments({ status: 'Returned' }),
        LostItem.find().sort({ createdAt: -1 }).limit(4).populate('reportedBy'),
        FoundItem.find().sort({ createdAt: -1 }).limit(4).populate('reportedBy')
      ]);

    res.render('home', {
      title: 'Dashboard',
      activeTab: 'home',
      stats: { lostCount, foundCount, studentCount, returnedCount },
      recentLostItems,
      recentFoundItems
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 2. STUDENT ROUTES
// ==========================================

// GET /students - List all student profiles with search
app.get('/students', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query = {
        $or: [
          { fullName: { $regex: cleanSearch, $options: 'i' } },
          { email: { $regex: cleanSearch, $options: 'i' } },
          { department: { $regex: cleanSearch, $options: 'i' } }
        ]
      };
    }

    const students = await Student.find(query).sort({ fullName: 1 });

    res.render('students', {
      title: 'Student Directory',
      activeTab: 'students',
      students,
      search: search || ''
    });
  } catch (error) {
    next(error);
  }
});

// GET /students/new - Display registration form
app.get('/students/new', (req, res) => {
  res.render('student-new', {
    title: 'Register Student Profile',
    activeTab: 'students',
    formData: {}
  });
});

// POST /students - Create a new student profile
app.post('/students', async (req, res, next) => {
  const { fullName, email, department, contactNumber } = req.body;

  try {
    // 1. Server-side validation for required fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: 'Student full name is required and cannot be empty.',
        formData: req.body
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: 'College email address is required.',
        formData: req.body
      });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: 'Please provide a valid email format (e.g., name@college.edu).',
        formData: req.body
      });
    }

    if (!department || !department.trim()) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: 'Department is required.',
        formData: req.body
      });
    }

    if (!contactNumber || !contactNumber.trim()) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: 'Contact phone number is required.',
        formData: req.body
      });
    }

    // 2. Check for duplicate email before saving
    const normalizedEmail = email.trim().toLowerCase();
    const existingStudent = await Student.findOne({ email: normalizedEmail });
    if (existingStudent) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: `A student profile with email "${normalizedEmail}" already exists.`,
        formData: req.body
      });
    }

    // 3. Save new student
    const newStudent = new Student({
      fullName: fullName.trim(),
      email: normalizedEmail,
      department: department.trim(),
      contactNumber: contactNumber.trim()
    });

    await newStudent.save();

    res.redirect(`/students/${newStudent._id}?success=${encodeURIComponent('Student profile created successfully!')}`);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).render('student-new', {
        title: 'Register Student Profile',
        activeTab: 'students',
        errorMessage: 'A student with this email address already exists in the system.',
        formData: req.body
      });
    }
    next(error);
  }
});

// GET /students/:id - Display dynamic student profile
app.get('/students/:id', async (req, res, next) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Student ID',
      statusCode: 400,
      activeTab: 'students',
      message: `The provided identifier "${id}" is not a valid 24-character hexadecimal MongoDB ObjectId.`
    });
  }

  try {
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).render('error', {
        title: 'Student Not Found',
        statusCode: 404,
        activeTab: 'students',
        message: `No student was found with database ID "${id}". The record may have been deleted.`
      });
    }

    // Dynamic relationship queries: fetch items reported by this student
    const [lostItems, foundItems] = await Promise.all([
      LostItem.find({ reportedBy: student._id }).sort({ createdAt: -1 }),
      FoundItem.find({ reportedBy: student._id }).sort({ createdAt: -1 })
    ]);

    res.render('student-details', {
      title: `${student.fullName} - Profile`,
      activeTab: 'students',
      student,
      lostItems,
      foundItems
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 3. LOST ITEM ROUTES
// ==========================================

// GET /lost-items - List lost items with search & filter
app.get('/lost-items', async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    const query = {};

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { itemName: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
        { lastSeenLocation: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    if (status && status.trim()) {
      query.status = status.trim();
    }

    const items = await LostItem.find(query)
      .sort({ createdAt: -1 })
      .populate('reportedBy');

    res.render('lost-items', {
      title: 'Lost Items',
      activeTab: 'lost',
      items,
      filters: { search, category, status }
    });
  } catch (error) {
    next(error);
  }
});

// GET /lost-items/new - Form to report a lost item
app.get('/lost-items/new', async (req, res, next) => {
  try {
    const students = await Student.find().sort({ fullName: 1 });
    const selectedStudentId = req.query.studentId || null;

    res.render('lost-item-new', {
      title: 'Report Lost Item',
      activeTab: 'lost',
      students,
      selectedStudentId,
      formData: {}
    });
  } catch (error) {
    next(error);
  }
});

// POST /lost-items - Create a lost item report
app.post('/lost-items', async (req, res, next) => {
  const { itemName, category, description, lastSeenLocation, dateLost, reportedBy } = req.body;

  try {
    const students = await Student.find().sort({ fullName: 1 });

    // Validate required fields
    if (!itemName || !itemName.trim() ||
        !category || !category.trim() ||
        !description || !description.trim() ||
        !lastSeenLocation || !lastSeenLocation.trim() ||
        !reportedBy || !reportedBy.trim()) {
      return res.status(400).render('lost-item-new', {
        title: 'Report Lost Item',
        activeTab: 'lost',
        students,
        selectedStudentId: reportedBy,
        formData: req.body,
        errorMessage: 'Please fill in all required fields. Empty or whitespace-only values are not permitted.'
      });
    }

    // Validate MongoDB ID of reporting student
    if (!mongoose.isValidObjectId(reportedBy)) {
      return res.status(400).render('lost-item-new', {
        title: 'Report Lost Item',
        activeTab: 'lost',
        students,
        selectedStudentId: null,
        formData: req.body,
        errorMessage: 'The selected student ID is not a valid database identifier.'
      });
    }

    // Verify relationship: student must exist
    const studentExists = await Student.findById(reportedBy);
    if (!studentExists) {
      return res.status(400).render('lost-item-new', {
        title: 'Report Lost Item',
        activeTab: 'lost',
        students,
        selectedStudentId: null,
        formData: req.body,
        errorMessage: 'The selected student record does not exist in the database.'
      });
    }

    const newLostItem = new LostItem({
      itemName: itemName.trim(),
      category: category.trim(),
      description: description.trim(),
      lastSeenLocation: lastSeenLocation.trim(),
      dateLost: dateLost ? new Date(dateLost) : new Date(),
      status: 'Open',
      reportedBy: studentExists._id
    });

    await newLostItem.save();

    res.redirect(`/lost-items/${newLostItem._id}?success=${encodeURIComponent('Lost item report submitted successfully!')}`);
  } catch (error) {
    next(error);
  }
});

// GET /lost-items/:id - View full details of one lost item report
app.get('/lost-items/:id', async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Item ID',
      statusCode: 400,
      activeTab: 'lost',
      message: `The provided lost item ID "${id}" is not a valid 24-character hexadecimal MongoDB ObjectId.`
    });
  }

  try {
    const item = await LostItem.findById(id).populate('reportedBy');

    if (!item) {
      return res.status(404).render('error', {
        title: 'Lost Item Not Found',
        statusCode: 404,
        activeTab: 'lost',
        message: `No lost item report was found matching database ID "${id}".`
      });
    }

    res.render('lost-item-details', {
      title: `${item.itemName} - Lost Item Details`,
      activeTab: 'lost',
      item
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /lost-items/:id/status - Update lost item status
app.patch('/lost-items/:id/status', async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Item ID',
      statusCode: 400,
      activeTab: 'lost',
      message: 'Invalid MongoDB ObjectId supplied.'
    });
  }

  const validStatuses = ['Open', 'Recovered', 'Closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).render('error', {
      title: 'Invalid Status Value',
      statusCode: 400,
      activeTab: 'lost',
      message: `Status must be one of: ${validStatuses.join(', ')}.`
    });
  }

  try {
    const item = await LostItem.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).render('error', {
        title: 'Lost Item Not Found',
        statusCode: 404,
        activeTab: 'lost',
        message: 'Lost item report not found.'
      });
    }

    res.redirect(`/lost-items/${item._id}?success=${encodeURIComponent(`Item status updated to ${status}`)}`);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 4. FOUND ITEM ROUTES
// ==========================================

// GET /found-items - List all found items
app.get('/found-items', async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    const query = {};

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { itemName: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
        { foundLocation: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    if (status && status.trim()) {
      query.status = status.trim();
    }

    const items = await FoundItem.find(query)
      .sort({ createdAt: -1 })
      .populate('reportedBy');

    res.render('found-items', {
      title: 'Found Items',
      activeTab: 'found',
      items,
      filters: { search, category, status }
    });
  } catch (error) {
    next(error);
  }
});

// GET /found-items/new - Form to report a found item
app.get('/found-items/new', async (req, res, next) => {
  try {
    const students = await Student.find().sort({ fullName: 1 });
    const selectedStudentId = req.query.studentId || null;

    res.render('found-item-new', {
      title: 'Report Found Item',
      activeTab: 'found',
      students,
      selectedStudentId,
      formData: {}
    });
  } catch (error) {
    next(error);
  }
});

// POST /found-items - Create a found item report
app.post('/found-items', async (req, res, next) => {
  const { itemName, category, description, foundLocation, dateFound, reportedBy } = req.body;

  try {
    const students = await Student.find().sort({ fullName: 1 });

    // Validate required fields
    if (!itemName || !itemName.trim() ||
        !category || !category.trim() ||
        !description || !description.trim() ||
        !foundLocation || !foundLocation.trim() ||
        !reportedBy || !reportedBy.trim()) {
      return res.status(400).render('found-item-new', {
        title: 'Report Found Item',
        activeTab: 'found',
        students,
        selectedStudentId: reportedBy,
        formData: req.body,
        errorMessage: 'Please fill in all required fields. Empty or whitespace-only inputs are rejected.'
      });
    }

    // Validate MongoDB ID of reporting student
    if (!mongoose.isValidObjectId(reportedBy)) {
      return res.status(400).render('found-item-new', {
        title: 'Report Found Item',
        activeTab: 'found',
        students,
        selectedStudentId: null,
        formData: req.body,
        errorMessage: 'The selected student ID is invalid.'
      });
    }

    // Check relationship
    const studentExists = await Student.findById(reportedBy);
    if (!studentExists) {
      return res.status(400).render('found-item-new', {
        title: 'Report Found Item',
        activeTab: 'found',
        students,
        selectedStudentId: null,
        formData: req.body,
        errorMessage: 'The reporting student could not be found in the database.'
      });
    }

    const newFoundItem = new FoundItem({
      itemName: itemName.trim(),
      category: category.trim(),
      description: description.trim(),
      foundLocation: foundLocation.trim(),
      dateFound: dateFound ? new Date(dateFound) : new Date(),
      status: 'Available',
      reportedBy: studentExists._id
    });

    await newFoundItem.save();

    res.redirect(`/found-items/${newFoundItem._id}?success=${encodeURIComponent('Found item report published successfully!')}`);
  } catch (error) {
    next(error);
  }
});

// GET /found-items/:id - View one found item details & claim status
app.get('/found-items/:id', async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Found Item ID',
      statusCode: 400,
      activeTab: 'found',
      message: `The provided found item ID "${id}" is not a valid 24-character hexadecimal MongoDB ObjectId.`
    });
  }

  try {
    const item = await FoundItem.findById(id).populate('reportedBy');

    if (!item) {
      return res.status(404).render('error', {
        title: 'Found Item Not Found',
        statusCode: 404,
        activeTab: 'found',
        message: `No found item report was found matching database ID "${id}".`
      });
    }

    res.render('found-item-details', {
      title: `${item.itemName} - Found Item Details`,
      activeTab: 'found',
      item
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /found-items/:id/status - Update found item status
app.patch('/found-items/:id/status', async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Item ID',
      statusCode: 400,
      activeTab: 'found',
      message: 'Invalid MongoDB ObjectId supplied.'
    });
  }

  const validStatuses = ['Available', 'Claimed', 'Returned'];
  if (!validStatuses.includes(status)) {
    return res.status(400).render('error', {
      title: 'Invalid Status Value',
      statusCode: 400,
      activeTab: 'found',
      message: `Status must be one of: ${validStatuses.join(', ')}.`
    });
  }

  try {
    const item = await FoundItem.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).render('error', {
        title: 'Found Item Not Found',
        statusCode: 404,
        activeTab: 'found',
        message: 'Found item report not found.'
      });
    }

    res.redirect(`/found-items/${item._id}?success=${encodeURIComponent(`Item status updated to ${status}`)}`);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 5. 404 HANDLER & GLOBAL ERROR MIDDLEWARE
// ==========================================

// 404 Catch-all handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Page Not Found',
    message: `The requested URL "${req.originalUrl}" was not found on this server.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Campus Lost & Found Error]', err);

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).render('error', {
      title: 'Invalid Identifier Format',
      statusCode: 400,
      message: `The value "${err.value}" is not a valid database identifier.`,
      details: [`Field: ${err.path}`]
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errorMessages = Object.values(err.errors).map(e => e.message);
    return res.status(400).render('error', {
      title: 'Validation Error',
      statusCode: 400,
      message: 'One or more submitted fields failed validation rules.',
      details: errorMessages
    });
  }

  // Duplicate Key Error (E11000)
  if (err.code === 11000) {
    return res.status(400).render('error', {
      title: 'Duplicate Record Conflict',
      statusCode: 400,
      message: 'A record with the specified unique field already exists in the system.'
    });
  }

  // Generic 500 Server Error
  res.status(500).render('error', {
    title: 'Internal Server Error',
    statusCode: 500,
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected internal error occurred. Please try again later.'
  });
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Successfully connected to MongoDB database.');

    app.listen(PORT, () => {
      console.log(`✓ Campus Lost & Found System running at: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
