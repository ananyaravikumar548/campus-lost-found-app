require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');
const LostItem = require('./models/LostItem');
const FoundItem = require('./models/FoundItem');
const Claim = require('./models/Claim');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_lost_found';

async function seedDatabase() {
  try {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected. Clearing existing records for clean test run...');

    await Promise.all([
      Student.deleteMany({}),
      LostItem.deleteMany({}),
      FoundItem.deleteMany({}),
      Claim.deleteMany({})
    ]);

    console.log('✓ Creating sample student profiles...');
    const students = await Student.create([
      {
        fullName: 'Ananya Sharma',
        email: 'ananya.sharma@campus.edu',
        department: 'Computer Science & Engineering',
        contactNumber: '+91 9876543210'
      },
      {
        fullName: 'Rohan Verma',
        email: 'rohan.verma@campus.edu',
        department: 'Electronics & Communication',
        contactNumber: '+91 9811223344'
      },
      {
        fullName: 'Priya Patel',
        email: 'priya.patel@campus.edu',
        department: 'Mechanical Engineering',
        contactNumber: '+91 9822334455'
      },
      {
        fullName: 'Karthik Iyer',
        email: 'karthik.iyer@campus.edu',
        department: 'Biotechnology & Bioinformatics',
        contactNumber: '+91 9833445566'
      }
    ]);

    console.log(`✓ Seeded ${students.length} students with valid MongoDB ObjectIds.`);

    console.log('✓ Creating lost item reports linked to students...');
    const lostItems = await LostItem.create([
      {
        itemName: 'Matte Blue Hydro Flask (750ml)',
        category: 'Bottles & Flasks',
        description: 'Navy blue stainless steel vacuum insulated bottle with a small NASA sticker near the cap and a minor dent on base.',
        lastSeenLocation: 'Central Library, 2nd Floor Study Cubicle 4',
        dateLost: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'Open',
        reportedBy: students[1]._id // Rohan
      },
      {
        itemName: 'Brown Leather ID Card Holder with Campus Badge',
        category: 'Documents & IDs',
        description: 'Dark brown leather lanyard pouch containing student ID badge CS-2023-042 and hostel room key card.',
        lastSeenLocation: 'Main Cafeteria, Table 12 near beverage counter',
        dateLost: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'Open',
        reportedBy: students[0]._id // Ananya
      },
      {
        itemName: 'Advanced Engineering Mathematics Notebook',
        category: 'Books & Stationery',
        description: 'Classmate 200-page spiral ruled notebook with green cover. Contains handwritten differential calculus notes.',
        lastSeenLocation: 'Lecture Hall Complex, Room 102',
        dateLost: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        status: 'Recovered',
        reportedBy: students[2]._id // Priya
      }
    ]);

    console.log(`✓ Seeded ${lostItems.length} lost item reports.`);

    console.log('✓ Creating found item reports linked to students...');
    const foundItems = await FoundItem.create([
      {
        itemName: 'Wireless Bluetooth Earbuds (White Case)',
        category: 'Electronics',
        description: 'True wireless earbuds in a white glossy charging case. Found on a chair after the afternoon workshop.',
        foundLocation: 'Main Auditorium, Row G Seat 14',
        dateFound: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'Claimed', // One pending claim exists
        reportedBy: students[2]._id // Priya
      },
      {
        itemName: 'Silver Keychain with 3 Bike Keys & Honda Tag',
        category: 'Keys',
        description: 'Set of two bike keys and one small locker key attached to a metallic Honda logo keyring.',
        foundLocation: 'Sports Complex Pavilion Bench',
        dateFound: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: 'Available',
        reportedBy: students[3]._id // Karthik
      },
      {
        itemName: 'Black Casio FX-991CW Scientific Calculator',
        category: 'Electronics',
        description: 'Calculator in good condition with slide-on cover. Discovered on desk after semester midterm exams.',
        foundLocation: 'Seminar Hall B, Row 3 Desk 5',
        dateFound: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'Returned', // Successfully returned
        reportedBy: students[0]._id // Ananya
      }
    ]);

    console.log(`✓ Seeded ${foundItems.length} found item reports.`);

    console.log('✓ Creating sample claims for Phase 2 workflow...');
    const claims = await Claim.create([
      {
        foundItemId: foundItems[0]._id, // Earbuds
        claimedBy: students[1]._id,     // Rohan claiming
        reason: 'These are my Boat Airdopes 141 earbuds. The left earbud has a tiny nick on the plastic mesh and the case has an Apple sticker on the back.',
        status: 'Pending'
      },
      {
        foundItemId: foundItems[2]._id, // Calculator
        claimedBy: students[2]._id,     // Priya
        reason: 'My calculator has my roll number ME-2023-018 written in silver permanent marker on the inside of the slide-on battery compartment.',
        status: 'Approved',
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]);

    console.log(`✓ Seeded ${claims.length} claims (1 Pending, 1 Approved).`);

    console.log('\n==========================================');
    console.log('🎉 PHASE 2 SEEDING COMPLETE!');
    console.log('==========================================');
    console.log(`Total Students:    ${students.length}`);
    console.log(`Total Lost Items:  ${lostItems.length}`);
    console.log(`Total Found Items: ${foundItems.length}`);
    console.log(`Total Claims:      ${claims.length}`);
    console.log('You can now run: npm start or npm run dev');
    console.log('==========================================\n');

    process.exit(0);
  } catch (err) {
    console.error('✗ Seeding error:', err);
    process.exit(1);
  }
}

seedDatabase();
