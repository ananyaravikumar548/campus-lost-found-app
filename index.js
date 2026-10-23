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
const PORT = process.env.PORT || 3001;
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
    const [lostCount, foundCount, studentCount, returnedCount, claimCount, pendingClaimCount, recentLostItems, recentFoundItems] =
      await Promise.all([
        LostItem.countDocuments(),
        FoundItem.countDocuments(),
        Student.countDocuments(),
        FoundItem.countDocuments({ status: 'Returned' }),
        Claim.countDocuments(),
        Claim.countDocuments({ status: 'Pending' }),
        LostItem.find().sort({ createdAt: -1 }).limit(4).populate('reportedBy'),
        FoundItem.find().sort({ createdAt: -1 }).limit(4).populate('reportedBy')
      ]);

    res.render('home', {
      title: 'Dashboard',
      activeTab: 'home',
      stats: { lostCount, foundCount, studentCount, returnedCount, claimCount, pendingClaimCount },
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

// GET /students/:id - Display dynamic student profile with items & claims
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

    // Dynamic relationship queries: fetch items and claims
    const [lostItems, foundItems, claimsFiled] = await Promise.all([
      LostItem.find({ reportedBy: student._id }).sort({ createdAt: -1 }),
      FoundItem.find({ reportedBy: student._id }).sort({ createdAt: -1 }),
      Claim.find({ claimedBy: student._id }).populate('foundItemId').sort({ createdAt: -1 })
    ]);

    const foundItemIds = foundItems.map(f => f._id);
    const claimsReceived = await Claim.find({ foundItemId: { $in: foundItemIds } })
      .populate('foundItemId')
      .populate('claimedBy')
      .sort({ createdAt: -1 });

    res.render('student-details', {
      title: `${student.fullName} - Profile`,
      activeTab: 'students',
      student,
      lostItems,
      foundItems,
      claimsFiled,
      claimsReceived
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

// GET /found-items/:id - View one found item details, claims, and claim submission form
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
    const [item, claims, students] = await Promise.all([
      FoundItem.findById(id).populate('reportedBy'),
      Claim.find({ foundItemId: id }).populate('claimedBy').sort({ createdAt: -1 }),
      Student.find().sort({ fullName: 1 })
    ]);

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
      item,
      claims,
      students
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
// 5. PHASE 2: CLAIM ROUTES & BUSINESS RULES
// ==========================================

// POST /found-items/:id/claims - Submit a claim for a found item
app.post('/found-items/:id/claims', async (req, res, next) => {
  const { id } = req.params;
  const { claimedBy, reason } = req.body;

  // 1. Check valid MongoDB ID for found item
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Item Identifier',
      statusCode: 400,
      activeTab: 'found',
      message: `"${id}" is not a valid 24-character hexadecimal MongoDB ObjectId.`
    });
  }

  try {
    // 2. Relationship check: Found item must exist
    const foundItem = await FoundItem.findById(id);
    if (!foundItem) {
      return res.status(404).render('error', {
        title: 'Found Item Not Found',
        statusCode: 404,
        activeTab: 'found',
        message: 'The item you are attempting to claim could not be found in the database.'
      });
    }

    // 3. State check (Thinking Challenge 3): Cannot claim an already Returned item
    if (foundItem.status === 'Returned') {
      return res.status(400).render('error', {
        title: 'Item Already Returned',
        statusCode: 400,
        activeTab: 'found',
        message: 'This item has already been marked as Returned and cannot be claimed again.'
      });
    }

    // 4. Validate claimant student ID and relationship
    if (!claimedBy || !claimedBy.trim() || !mongoose.isValidObjectId(claimedBy)) {
      return res.status(400).render('error', {
        title: 'Invalid Claimant Student',
        statusCode: 400,
        activeTab: 'found',
        message: 'Please select a valid registered student profile to submit this claim.'
      });
    }

    const claimantStudent = await Student.findById(claimedBy);
    if (!claimantStudent) {
      return res.status(400).render('error', {
        title: 'Student Not Found',
        statusCode: 400,
        activeTab: 'found',
        message: 'The student record submitting this claim does not exist in the database.'
      });
    }

    // 5. Finder self-claim rule: A student who found the item cannot claim it
    if (foundItem.reportedBy && foundItem.reportedBy.toString() === claimantStudent._id.toString()) {
      return res.status(400).render('error', {
        title: 'Self-Claim Not Permitted',
        statusCode: 400,
        activeTab: 'found',
        message: 'You cannot submit an ownership claim on an item you personally reported as found.'
      });
    }

    // 6. Validate reason / proof of ownership
    if (!reason || !reason.trim() || reason.trim().length < 10) {
      return res.status(400).render('error', {
        title: 'Insufficient Proof of Ownership',
        statusCode: 400,
        activeTab: 'found',
        message: 'Please provide detailed proof of ownership (minimum 10 characters) explaining how this item belongs to you.'
      });
    }

    // 7. Duplicate-claim check (Thinking Challenge 4):
    // Prevent the same student submitting multiple claims for the same found item
    const existingClaim = await Claim.findOne({
      foundItemId: foundItem._id,
      claimedBy: claimantStudent._id
    });

    if (existingClaim) {
      return res.status(400).render('error', {
        title: 'Duplicate Claim Detected',
        statusCode: 400,
        activeTab: 'found',
        message: `You have already submitted a claim for this item (Status: ${existingClaim.status}). Duplicate claims by the same student are not permitted.`
      });
    }

    // 8. Create new claim with status Pending
    const newClaim = new Claim({
      foundItemId: foundItem._id,
      claimedBy: claimantStudent._id,
      reason: reason.trim(),
      status: 'Pending'
    });

    await newClaim.save();

    // 9. Update item status to 'Claimed' if it was 'Available'
    if (foundItem.status === 'Available') {
      foundItem.status = 'Claimed';
      await foundItem.save();
    }

    res.redirect(`/found-items/${foundItem._id}?success=${encodeURIComponent('Claim submitted successfully! The finder will review your ownership proof.')}`);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).render('error', {
        title: 'Duplicate Claim',
        statusCode: 400,
        activeTab: 'found',
        message: 'A claim for this item by this student already exists in the database.'
      });
    }
    next(error);
  }
});

// PATCH /claims/:id/status - Approve or reject a claim (Enforces Ownership & Safe Update)
app.patch('/claims/:id/status', async (req, res, next) => {
  const { id } = req.params;
  const { status, reviewerStudentId } = req.body;

  // 1. Validate Claim ID
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).render('error', {
      title: 'Invalid Claim Identifier',
      statusCode: 400,
      activeTab: 'found',
      message: 'The supplied Claim ID is not a valid MongoDB ObjectId.'
    });
  }

  // 2. Validate Target Status
  const validStatuses = ['Approved', 'Rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).render('error', {
      title: 'Invalid Claim Status',
      statusCode: 400,
      activeTab: 'found',
      message: `Status must be one of: ${validStatuses.join(', ')}.`
    });
  }

  try {
    // 3. Retrieve claim with populated foundItem and claimant
    const claim = await Claim.findById(id).populate('foundItemId');
    if (!claim) {
      return res.status(404).render('error', {
        title: 'Claim Not Found',
        statusCode: 404,
        activeTab: 'found',
        message: `No claim found with ID "${id}".`
      });
    }

    const foundItem = claim.foundItemId;
    if (!foundItem) {
      return res.status(404).render('error', {
        title: 'Associated Item Missing',
        statusCode: 404,
        activeTab: 'found',
        message: 'The found item associated with this claim no longer exists.'
      });
    }

    // 4. Ownership Check (Thinking Challenge 1):
    // Only the student who reported finding the item is authorized to approve/reject claims for it
    if (!reviewerStudentId || !mongoose.isValidObjectId(reviewerStudentId) ||
        foundItem.reportedBy.toString() !== reviewerStudentId.toString()) {
      return res.status(403).render('error', {
        title: 'Unauthorized Action',
        statusCode: 403,
        activeTab: 'found',
        message: 'Permission denied: Only the student who reported finding this item is authorized to approve or reject claims for it. Verification failed on the server.'
      });
    }

    // 5. State Check (Thinking Challenge 3):
    // Once an item is marked Returned, further claim approvals must be rejected
    if (foundItem.status === 'Returned' && status === 'Approved') {
      return res.status(400).render('error', {
        title: 'Item Already Returned',
        statusCode: 400,
        activeTab: 'found',
        message: 'This item has already been marked as Returned and cannot be approved for another claim.'
      });
    }

    // 6. Safe Update (Thinking Challenge 5):
    // Use $set to update ONLY intended fields (status, reviewedAt) without touching reason or relations
    const updatedClaim = await Claim.findByIdAndUpdate(
      id,
      { $set: { status, reviewedAt: new Date() } },
      { new: true, runValidators: true }
    );

    // 7. Workflow Transition Logic
    if (status === 'Approved') {
      // Mark found item as Returned
      await FoundItem.findByIdAndUpdate(foundItem._id, { $set: { status: 'Returned' } });

      // Automatically reject any other pending claims for this item
      await Claim.updateMany(
        { foundItemId: foundItem._id, _id: { $ne: claim._id }, status: 'Pending' },
        { $set: { status: 'Rejected', reviewedAt: new Date() } }
      );
    } else if (status === 'Rejected') {
      // If rejected, check if there are remaining pending or approved claims
      const remainingPendingOrApproved = await Claim.countDocuments({
        foundItemId: foundItem._id,
        status: { $in: ['Pending', 'Approved'] }
      });

      // If no other claims remain, return item status to 'Available'
      if (remainingPendingOrApproved === 0 && foundItem.status !== 'Returned') {
        await FoundItem.findByIdAndUpdate(foundItem._id, { $set: { status: 'Available' } });
      }
    }

    res.redirect(`/found-items/${foundItem._id}?success=${encodeURIComponent(`Claim has been successfully marked as ${status}!`)}`);
  } catch (error) {
    next(error);
  }
});

// GET /claims - Centralized Claims Hub with search & filters
app.get('/claims', async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let query = {};

    if (status && status.trim()) {
      query.status = status.trim();
    }

    let claims = await Claim.find(query)
      .populate('foundItemId')
      .populate('claimedBy')
      .sort({ createdAt: -1 });

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      claims = claims.filter(c => {
        const itemMatch = c.foundItemId && c.foundItemId.itemName.toLowerCase().includes(term);
        const reasonMatch = c.reason && c.reason.toLowerCase().includes(term);
        const claimantMatch = c.claimedBy && c.claimedBy.fullName.toLowerCase().includes(term);
        return itemMatch || reasonMatch || claimantMatch;
      });
    }

    res.render('claims', {
      title: 'Claims Management Hub',
      activeTab: 'claims',
      claims,
      filters: { search, status }
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 6. 404 HANDLER & GLOBAL ERROR MIDDLEWARE
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
