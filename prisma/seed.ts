/**
 * Medicare Hub - Database Seed Script
 * Run with: bun run prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'
import { TIME_SLOTS } from '../src/lib/medicare-types'

const db = new PrismaClient()

const departments = [
  { name: 'Cardiology', description: 'Heart and blood vessel care, ECG, angiography and cardiac rehabilitation.', headDoctor: 'Dr. Sarah Mitchell', location: 'Block A, Floor 3', phone: '+1 (555) 101-2001' },
  { name: 'Neurology', description: 'Brain, spine and nervous system disorders including stroke care.', headDoctor: 'Dr. James Chen', location: 'Block B, Floor 2', phone: '+1 (555) 101-2002' },
  { name: 'Orthopedics', description: 'Bone, joint and muscle care, joint replacement and sports medicine.', headDoctor: 'Dr. Priya Sharma', location: 'Block A, Floor 1', phone: '+1 (555) 101-2003' },
  { name: 'Pediatrics', description: 'Complete healthcare for infants, children and adolescents.', headDoctor: 'Dr. Michael Torres', location: 'Block C, Floor 1', phone: '+1 (555) 101-2004' },
  { name: 'Dermatology', description: 'Skin, hair and nail treatments, allergy testing and cosmetic care.', headDoctor: 'Dr. Emily Watson', location: 'Block B, Floor 1', phone: '+1 (555) 101-2005' },
  { name: 'General Medicine', description: 'Primary care, annual physicals and chronic disease management.', headDoctor: 'Dr. Robert Kim', location: 'Block A, Floor 2', phone: '+1 (555) 101-2006' },
]

const doctors = [
  { name: 'Dr. Sarah Mitchell', email: 'sarah.mitchell@medicarehub.com', phone: '+1 (555) 201-1001', specialty: 'Interventional Cardiologist', department: 'Cardiology', experience: 15, rating: 4.9, consultationFee: 250, availability: 'Available' },
  { name: 'Dr. James Chen', email: 'james.chen@medicarehub.com', phone: '+1 (555) 201-1002', specialty: 'Neurosurgeon', department: 'Neurology', experience: 18, rating: 4.8, consultationFee: 300, availability: 'Available' },
  { name: 'Dr. Priya Sharma', email: 'priya.sharma@medicarehub.com', phone: '+1 (555) 201-1003', specialty: 'Orthopedic Surgeon', department: 'Orthopedics', experience: 12, rating: 4.7, consultationFee: 200, availability: 'Available' },
  { name: 'Dr. Michael Torres', email: 'michael.torres@medicarehub.com', phone: '+1 (555) 201-1004', specialty: 'Pediatrician', department: 'Pediatrics', experience: 10, rating: 4.9, consultationFee: 120, availability: 'On Leave' },
  { name: 'Dr. Emily Watson', email: 'emily.watson@medicarehub.com', phone: '+1 (555) 201-1005', specialty: 'Dermatologist', department: 'Dermatology', experience: 8, rating: 4.6, consultationFee: 150, availability: 'Available' },
  { name: 'Dr. Robert Kim', email: 'robert.kim@medicarehub.com', phone: '+1 (555) 201-1006', specialty: 'Internal Medicine', department: 'General Medicine', experience: 20, rating: 4.8, consultationFee: 100, availability: 'Available' },
  { name: 'Dr. Aisha Patel', email: 'aisha.patel@medicarehub.com', phone: '+1 (555) 201-1007', specialty: 'Cardiologist', department: 'Cardiology', experience: 9, rating: 4.5, consultationFee: 180, availability: 'Off Duty' },
  { name: 'Dr. Daniel Okafor', email: 'daniel.okafor@medicarehub.com', phone: '+1 (555) 201-1008', specialty: 'Pediatric Surgeon', department: 'Pediatrics', experience: 14, rating: 4.7, consultationFee: 220, availability: 'Available' },
]

function birthDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

const patients = [
  { name: 'John Anderson', email: 'john.anderson@email.com', phone: '+1 (555) 301-5001', dateOfBirth: birthDate(1985, 4, 12), gender: 'Male', bloodGroup: 'O+', address: '42 Maple Street, Springfield', allergies: 'Penicillin' },
  { name: 'Maria Garcia', email: 'maria.garcia@email.com', phone: '+1 (555) 301-5002', dateOfBirth: birthDate(1992, 8, 25), gender: 'Female', bloodGroup: 'A+', address: '18 Oak Avenue, Riverside', allergies: 'None' },
  { name: 'William Lee', email: 'william.lee@email.com', phone: '+1 (555) 301-5003', dateOfBirth: birthDate(1978, 1, 30), gender: 'Male', bloodGroup: 'B+', address: '7 Pine Road, Lakeside', allergies: 'Pollen, Dust' },
  { name: 'Sophia Turner', email: 'sophia.turner@email.com', phone: '+1 (555) 301-5004', dateOfBirth: birthDate(2015, 11, 8), gender: 'Female', bloodGroup: 'AB+', address: '203 Cedar Lane, Hillview', allergies: 'None' },
  { name: 'Ethan Walker', email: 'ethan.walker@email.com', phone: '+1 (555) 301-5005', dateOfBirth: birthDate(1969, 6, 17), gender: 'Male', bloodGroup: 'O-', address: '56 Birch Blvd, Brookfield', allergies: 'Aspirin' },
  { name: 'Olivia Bennett', email: 'olivia.bennett@email.com', phone: '+1 (555) 301-5006', dateOfBirth: birthDate(1998, 3, 3), gender: 'Female', bloodGroup: 'A-', address: '9 Elm Court, Fairview', allergies: 'Latex' },
  { name: 'Noah Foster', email: 'noah.foster@email.com', phone: '+1 (555) 301-5007', dateOfBirth: birthDate(2001, 9, 21), gender: 'Male', bloodGroup: 'B-', address: '77 Walnut Way, Greendale', allergies: 'None' },
  { name: 'Ava Collins', email: 'ava.collins@email.com', phone: '+1 (555) 301-5008', dateOfBirth: birthDate(1988, 12, 14), gender: 'Female', bloodGroup: 'O+', address: '31 Spruce Drive, Meadowbrook', allergies: 'Sulfa drugs' },
  // Linked to the demo MEMBER login (user@medicarehub.com) — appended last so existing patientIdx stay stable
  { name: 'Emma Wilson', email: 'user@medicarehub.com', phone: '+1 (555) 301-5009', dateOfBirth: birthDate(1990, 5, 21), gender: 'Female', bloodGroup: 'A+', address: '12 Willow Crescent, Springfield', allergies: 'None' },
]

function isoDate(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

const appointments = [
  // today
  { patientIdx: 0, doctorIdx: 0, date: isoDate(0), timeSlot: '09:00 AM - 09:30 AM', status: 'Scheduled', reason: 'Chest pain and shortness of breath' },
  { patientIdx: 1, doctorIdx: 4, date: isoDate(0), timeSlot: '10:00 AM - 10:30 AM', status: 'Scheduled', reason: 'Persistent skin rash on arms' },
  { patientIdx: 4, doctorIdx: 5, date: isoDate(0), timeSlot: '11:00 AM - 11:30 AM', status: 'Completed', reason: 'Annual health check-up', notes: 'Blood pressure slightly elevated. Advised low-sodium diet.' },
  { patientIdx: 2, doctorIdx: 1, date: isoDate(0), timeSlot: '02:00 PM - 02:30 PM', status: 'Completed', reason: 'Recurring migraines', notes: 'Prescribed prophylactic medication. MRI scheduled.' },
  { patientIdx: 5, doctorIdx: 5, date: isoDate(0), timeSlot: '03:00 PM - 03:30 PM', status: 'Scheduled', reason: 'Fatigue and dizziness' },
  // past
  { patientIdx: 3, doctorIdx: 3, date: isoDate(-3), timeSlot: '09:30 AM - 10:00 AM', status: 'Completed', reason: 'Child wellness visit & vaccination', notes: 'Growth on track. Flu vaccine administered.' },
  { patientIdx: 6, doctorIdx: 2, date: isoDate(-5), timeSlot: '01:00 PM - 01:30 PM', status: 'Completed', reason: 'Right knee pain after running', notes: 'X-ray normal. Physiotherapy recommended.' },
  { patientIdx: 7, doctorIdx: 0, date: isoDate(-7), timeSlot: '04:00 PM - 04:30 PM', status: 'Completed', reason: 'Palpitations during exercise', notes: 'ECG normal. Holter monitor advised.' },
  { patientIdx: 0, doctorIdx: 5, date: isoDate(-10), timeSlot: '10:30 AM - 11:00 AM', status: 'Cancelled', reason: 'Follow-up for flu symptoms' },
  // upcoming
  { patientIdx: 2, doctorIdx: 1, date: isoDate(1), timeSlot: '09:00 AM - 09:30 AM', status: 'Scheduled', reason: 'MRI review consultation' },
  { patientIdx: 4, doctorIdx: 0, date: isoDate(2), timeSlot: '11:30 AM - 12:00 PM', status: 'Scheduled', reason: 'Cardiology evaluation' },
  { patientIdx: 7, doctorIdx: 4, date: isoDate(2), timeSlot: '02:30 PM - 03:00 PM', status: 'Scheduled', reason: 'Acne treatment follow-up' },
  { patientIdx: 1, doctorIdx: 6, date: isoDate(3), timeSlot: '10:00 AM - 10:30 AM', status: 'Scheduled', reason: 'Echocardiogram review' },
  { patientIdx: 6, doctorIdx: 2, date: isoDate(4), timeSlot: '03:30 PM - 04:00 PM', status: 'Scheduled', reason: 'Physiotherapy progress check' },
  { patientIdx: 3, doctorIdx: 7, date: isoDate(5), timeSlot: '09:30 AM - 10:00 AM', status: 'Scheduled', reason: 'Tonsillitis follow-up' },
  { patientIdx: 5, doctorIdx: 5, date: isoDate(6), timeSlot: '01:30 PM - 02:00 PM', status: 'Scheduled', reason: 'Thyroid function review' },
  // demo member (Emma Wilson) — one past completed + one pending request + one approved upcoming
  { patientIdx: 8, doctorIdx: 5, date: isoDate(-14), timeSlot: '09:00 AM - 09:30 AM', status: 'Completed', reason: 'Fatigue and low fever', notes: 'Blood work ordered. Advised rest and hydration.' },
  { patientIdx: 8, doctorIdx: 5, date: isoDate(3), timeSlot: '11:00 AM - 11:30 AM', status: 'Pending', reason: 'General consultation' },
  // one more member request so the admin has approvals to review
  { patientIdx: 1, doctorIdx: 4, date: isoDate(2), timeSlot: '03:00 PM - 03:30 PM', status: 'Pending', reason: 'Acne treatment consultation' },
]

const records = [
  { patientIdx: 4, doctorIdx: 5, diagnosis: 'Stage 1 Hypertension', prescription: 'Amlodipine 5mg once daily', treatment: 'Lifestyle modification, low-sodium diet, monthly BP monitoring', visitType: 'Consultation', notes: 'Recheck in 4 weeks.', daysAgo: 10 },
  { patientIdx: 2, doctorIdx: 1, diagnosis: 'Chronic Migraine without aura', prescription: 'Propranolol 40mg twice daily, Sumatriptan as needed', treatment: 'Headache diary, stress management, sleep hygiene', visitType: 'Consultation', notes: 'MRI to rule out structural causes.', daysAgo: 8 },
  { patientIdx: 6, doctorIdx: 2, diagnosis: 'Patellofemoral Pain Syndrome', prescription: 'Ibuprofen 400mg as needed', treatment: 'Physiotherapy 2x/week, quadriceps strengthening', visitType: 'Follow-up', notes: 'Avoid deep squats for 3 weeks.', daysAgo: 7 },
  { patientIdx: 7, doctorIdx: 0, diagnosis: 'Benign Palpitations', prescription: 'None', treatment: 'Holter monitor for 48 hours, caffeine reduction', visitType: 'Consultation', notes: 'ECG within normal limits.', daysAgo: 7 },
  { patientIdx: 3, doctorIdx: 3, diagnosis: 'Routine Pediatric Check-up', prescription: 'Flu vaccine (administered)', treatment: 'Continue balanced diet and outdoor activity', visitType: 'Follow-up', notes: 'Height and weight at 60th percentile.', daysAgo: 5 },
  { patientIdx: 0, doctorIdx: 0, diagnosis: 'Stable Angina (suspected)', prescription: 'Aspirin 75mg, Nitroglycerin PRN', treatment: 'Stress test scheduled, cardiac rehab referral', visitType: 'Emergency', notes: 'Advised to visit ER if pain worsens.', daysAgo: 3 },
  { patientIdx: 1, doctorIdx: 4, diagnosis: 'Contact Dermatitis', prescription: 'Hydrocortisone 1% cream twice daily', treatment: 'Avoid known irritants, fragrance-free moisturizer', visitType: 'Consultation', notes: 'Patch testing recommended.', daysAgo: 2 },
  { patientIdx: 8, doctorIdx: 5, diagnosis: 'Viral Fever Syndrome', prescription: 'Paracetamol 500mg as needed', treatment: 'Rest, hydration, follow-up in 1 week', visitType: 'Consultation', notes: 'Blood work within normal limits.', daysAgo: 14 },
]

/* ------------------------------ billing seed ------------------------------ */

interface SeedItem { description: string; quantity: number; unitPrice: number }

function calcTotals(items: SeedItem[], taxRate = 0, discount = 0) {
  const subtotal = Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100
  const taxAmount = Math.round(((subtotal * taxRate) / 100) * 100) / 100
  const total = Math.round((subtotal + taxAmount - discount) * 100) / 100
  return { subtotal, taxAmount, total }
}

interface SeedInvoice {
  patientIdx: number
  items: SeedItem[]
  taxRate?: number
  discount?: number
  status: 'Draft' | 'Pending' | 'Paid' | 'Cancelled'
  issuedDaysAgo: number
  dueInDays: number // days after the issue date
  payments?: { daysAgo: number; amount: number; method: string; note?: string }[]
  notes?: string
}

const invoices: SeedInvoice[] = [
  {
    patientIdx: 0, status: 'Paid', issuedDaysAgo: 12, dueInDays: 7,
    items: [
      { description: 'Cardiology consultation', quantity: 1, unitPrice: 250 },
      { description: 'Electrocardiogram (ECG)', quantity: 1, unitPrice: 120 },
      { description: 'Cardiac stress test', quantity: 1, unitPrice: 350 },
    ],
    payments: [{ daysAgo: 10, amount: 720, method: 'Card', note: 'Paid in full at the front desk' }],
  },
  {
    patientIdx: 2, status: 'Pending', issuedDaysAgo: 40, dueInDays: 15,
    items: [
      { description: 'Neurology consultation', quantity: 1, unitPrice: 300 },
      { description: 'Brain MRI with contrast', quantity: 1, unitPrice: 850 },
    ],
    payments: [{ daysAgo: 20, amount: 400, method: 'Insurance', note: 'Partial coverage remitted by insurer' }],
    notes: 'Second reminder sent. Patient requested a payment plan.',
  },
  {
    patientIdx: 1, status: 'Paid', issuedDaysAgo: 6, dueInDays: 14,
    items: [
      { description: 'Dermatology consultation', quantity: 1, unitPrice: 150 },
      { description: 'Patch allergy testing', quantity: 1, unitPrice: 200 },
    ],
    payments: [{ daysAgo: 5, amount: 350, method: 'Card' }],
  },
  {
    patientIdx: 4, status: 'Pending', issuedDaysAgo: 25, dueInDays: 14,
    items: [
      { description: 'General medicine consultation', quantity: 1, unitPrice: 100 },
      { description: 'Lipid panel', quantity: 1, unitPrice: 85 },
      { description: 'Complete blood count (CBC)', quantity: 1, unitPrice: 60 },
    ],
    notes: 'Second reminder sent via email.',
  },
  {
    patientIdx: 3, status: 'Paid', issuedDaysAgo: 8, dueInDays: 14,
    items: [
      { description: 'Pediatric wellness visit', quantity: 1, unitPrice: 120 },
      { description: 'Influenza vaccine', quantity: 1, unitPrice: 45 },
    ],
    payments: [{ daysAgo: 8, amount: 165, method: 'Insurance' }],
  },
  {
    patientIdx: 5, status: 'Draft', issuedDaysAgo: 1, dueInDays: 14,
    items: [{ description: 'Acne treatment plan (3-month program)', quantity: 1, unitPrice: 180 }],
    notes: 'Awaiting confirmation of the treatment schedule before sending.',
  },
  {
    patientIdx: 6, status: 'Pending', issuedDaysAgo: 3, dueInDays: 14,
    items: [{ description: 'Physiotherapy session', quantity: 4, unitPrice: 75 }],
  },
  {
    patientIdx: 7, status: 'Paid', issuedDaysAgo: 30, dueInDays: 15,
    items: [
      { description: 'Holter monitor (48 hours)', quantity: 1, unitPrice: 220 },
      { description: 'Electrocardiogram (ECG)', quantity: 1, unitPrice: 120 },
    ],
    payments: [{ daysAgo: 28, amount: 340, method: 'Bank Transfer' }],
  },
  {
    patientIdx: 1, status: 'Cancelled', issuedDaysAgo: 15, dueInDays: 8,
    items: [{ description: 'Dermatology follow-up visit', quantity: 1, unitPrice: 100 }],
    notes: 'Cancelled after the patient rescheduled; no charges apply.',
  },
  {
    patientIdx: 2, status: 'Paid', issuedDaysAgo: 60, dueInDays: 15,
    items: [{ description: 'Neurology follow-up consultation', quantity: 1, unitPrice: 150 }],
    payments: [{ daysAgo: 55, amount: 150, method: 'Cash' }],
  },
  {
    patientIdx: 4, status: 'Paid', issuedDaysAgo: 20, dueInDays: 15,
    items: [
      { description: 'Emergency room visit', quantity: 1, unitPrice: 500 },
      { description: 'Chest X-ray', quantity: 1, unitPrice: 180 },
      { description: 'Observation care (per hour)', quantity: 1, unitPrice: 250 },
    ],
    payments: [{ daysAgo: 18, amount: 930, method: 'Insurance', note: 'Settled by insurance' }],
  },
  {
    patientIdx: 3, status: 'Draft', issuedDaysAgo: 0, dueInDays: 14,
    items: [{ description: 'Pediatric tonsillitis follow-up', quantity: 1, unitPrice: 100 }],
  },
  {
    patientIdx: 6, status: 'Pending', issuedDaysAgo: 5, dueInDays: 10,
    items: [
      { description: 'Knee X-ray', quantity: 1, unitPrice: 140 },
      { description: 'Orthopedic consultation', quantity: 1, unitPrice: 200 },
    ],
  },
  {
    patientIdx: 0, status: 'Pending', issuedDaysAgo: 2, dueInDays: 12, taxRate: 5,
    items: [
      { description: 'Cardiology follow-up consultation', quantity: 1, unitPrice: 120 },
      { description: 'B-type natriuretic peptide (BNP) lab test', quantity: 1, unitPrice: 90 },
    ],
  },
  {
    patientIdx: 5, status: 'Pending', issuedDaysAgo: 10, dueInDays: 20,
    items: [{ description: 'Annual physical examination', quantity: 1, unitPrice: 150 }],
    payments: [{ daysAgo: 3, amount: 50, method: 'Cash', note: 'Good-faith deposit' }],
  },
  // demo member (Emma Wilson) — one paid + one pending
  {
    patientIdx: 8, status: 'Paid', issuedDaysAgo: 14, dueInDays: 15,
    items: [
      { description: 'General medicine consultation', quantity: 1, unitPrice: 100 },
      { description: 'Complete blood count (CBC)', quantity: 1, unitPrice: 60 },
    ],
    payments: [{ daysAgo: 13, amount: 160, method: 'Card', note: 'Paid at the front desk' }],
  },
  {
    patientIdx: 8, status: 'Pending', issuedDaysAgo: 4, dueInDays: 10,
    items: [
      { description: 'Physiotherapy session', quantity: 1, unitPrice: 75 },
      { description: 'Therapeutic ultrasound', quantity: 1, unitPrice: 45 },
    ],
    notes: 'Payable at the next visit.',
  },
]

const articles = [
  {
    title: '10 Heart-Healthy Habits Everyone Should Adopt',
    category: 'Cardiology',
    summary: 'Simple daily habits that can dramatically reduce your risk of heart disease, from diet swaps to sleep hygiene.',
    content: 'Cardiovascular disease remains the leading cause of death worldwide, but the good news is that most risk factors are modifiable.\n\n1. Eat a Mediterranean-style diet rich in olive oil, nuts, fish and vegetables.\n2. Walk at least 30 minutes a day — brisk walking lowers blood pressure and LDL cholesterol.\n3. Prioritize 7-8 hours of sleep; poor sleep is linked to hypertension.\n4. Manage stress with mindfulness or breathing exercises.\n5. Quit smoking — risk of heart attack drops within a year of quitting.\n6. Limit alcohol to moderate levels.\n7. Monitor blood pressure at home monthly.\n8. Keep blood sugar in check with whole grains over refined carbs.\n9. Maintain a healthy weight — even 5% loss helps.\n10. Schedule annual check-ups after age 35.\n\nSmall consistent changes compound into years of healthier life. Talk to your primary care physician about a personalized prevention plan.',
    author: 'Dr. Sarah Mitchell',
    readTime: 6,
  },
  {
    title: 'Understanding Migraines: Triggers and Treatments',
    category: 'Neurology',
    summary: 'Migraines affect over a billion people. Learn to identify common triggers and the latest evidence-based treatments.',
    content: 'A migraine is more than a bad headache — it is a neurological condition that can cause throbbing pain, nausea, and sensitivity to light and sound lasting hours to days.\n\nCommon triggers include:\n- Stress and anxiety\n- Irregular sleep\n- Skipped meals and dehydration\n- Hormonal fluctuations\n- Aged cheese, processed meats, and red wine\n- Bright or flickering lights\n\nKeeping a headache diary is the single most useful tool for identifying your personal triggers.\n\nAcute treatments include NSAIDs, triptans, and newer gepants. For frequent migraines (4+ days per month), preventive options such as beta-blockers, CGRP monoclonal antibodies, or botulinum toxin injections may be appropriate.\n\nIf your headaches change in character, wake you from sleep, or are accompanied by fever or neurological symptoms, seek medical attention promptly.',
    author: 'Dr. James Chen',
    readTime: 5,
  },
  {
    title: 'Pediatric Vaccination Schedule: A Parent\'s Guide',
    category: 'Pediatrics',
    summary: 'A clear walkthrough of recommended vaccines from birth through adolescence, and why staying on schedule matters.',
    content: 'Vaccines are one of the safest and most effective tools in pediatric medicine. The standard schedule protects against 14+ serious diseases before age 6.\n\nKey milestones:\n- Birth: Hepatitis B\n- 2, 4, 6 months: DTaP, Hib, IPV, PCV, Rotavirus\n- 12-15 months: MMR, Varicella, Hepatitis A\n- 4-6 years: DTaP, IPV, MMR, Varicella boosters\n- 11-12 years: Tdap, HPV, Meningococcal\n\nFalling behind does not mean starting over — catch-up schedules exist. Mild fever or soreness after vaccination is normal and resolves in 1-2 days.\n\nHerd immunity protects newborns and immunocompromised children who cannot be vaccinated. Keeping your child\'s schedule on time protects the whole community.',
    author: 'Dr. Michael Torres',
    readTime: 7,
  },
  {
    title: 'Skin Cancer Awareness: The ABCDE Rule',
    category: 'Dermatology',
    summary: 'Early detection saves lives. Learn the five warning signs of melanoma and how to perform a monthly skin self-exam.',
    content: 'Skin cancer is the most common cancer, but it is also among the most curable when caught early.\n\nUse the ABCDE rule when examining moles:\n- A — Asymmetry: one half unlike the other\n- B — Border: irregular, ragged, or blurred edges\n- C — Color: uneven shades of brown, black, red or white\n- D — Diameter: larger than 6mm (pencil eraser size)\n- E — Evolving: changes in size, shape, or color\n\nPerform a monthly full-body self-exam in good lighting, using mirrors for hard-to-see areas. Photograph suspicious spots to track changes.\n\nPrevention: use broad-spectrum SPF 30+ daily, seek shade between 10am-4pm, and avoid tanning beds. Adults should have a professional skin check annually.',
    author: 'Dr. Emily Watson',
    readTime: 4,
  },
  {
    title: 'Strong Bones for Life: Osteoporosis Prevention',
    category: 'Orthopedics',
    summary: 'Bone health starts young. Nutrition, exercise and lifestyle strategies to keep your skeleton strong at every age.',
    content: 'Peak bone mass is reached around age 30, but bone is living tissue that constantly rebuilds itself.\n\nBuild and maintain bone density with:\n- Calcium: 1000-1200mg daily from dairy, leafy greens, or fortified foods\n- Vitamin D: 15-20 minutes of sunlight or supplements as advised\n- Weight-bearing exercise: walking, dancing, resistance training 3x/week\n- Protein: adequate intake supports bone matrix\n- Avoid smoking and excessive alcohol\n\nRisk factors for osteoporosis include age, family history, long-term steroid use, and low body weight. A DEXA scan is recommended for women over 65 and anyone with risk factors.\n\nFractures in older adults carry serious consequences — prevention is far easier than treatment.',
    author: 'Dr. Priya Sharma',
    readTime: 5,
  },
  {
    title: 'Managing Diabetes: Beyond Medication',
    category: 'General Medicine',
    summary: 'Practical strategies for blood sugar control — nutrition, movement, sleep and monitoring habits that make a difference.',
    content: 'Type 2 diabetes management rests on four pillars: medication, nutrition, activity, and monitoring.\n\nNutrition: Focus on fiber-rich carbohydrates, pair carbs with protein, and keep portions moderate. The plate method (half vegetables, quarter protein, quarter carbs) is a simple starting point.\n\nMovement: A 10-15 minute walk after meals can lower post-meal glucose spikes significantly. Aim for 150 minutes of moderate activity weekly.\n\nSleep: Poor sleep worsens insulin resistance. Target 7-8 hours consistently.\n\nMonitoring: Regular HbA1c tests (every 3-6 months) show your 3-month average. Home glucose meters help identify which foods spike you.\n\nSmall sustainable changes beat dramatic short-term diets. Work with your care team to set realistic targets.',
    author: 'Dr. Robert Kim',
    readTime: 6,
  },
]

async function main() {
  console.log('Clearing existing data...')
  await db.invoice.deleteMany()
  await db.appointment.deleteMany()
  await db.appointmentSlot.deleteMany()
  await db.medicalRecord.deleteMany()
  await db.doctor.deleteMany()
  await db.patient.deleteMany()
  await db.department.deleteMany()
  await db.healthArticle.deleteMany()
  await db.user.deleteMany()

  console.log('Seeding departments...')
  await db.department.createMany({ data: departments })

  console.log('Seeding doctors...')
  await db.doctor.createMany({ data: doctors })

  console.log('Seeding patients...')
  await db.patient.createMany({ data: patients })

  console.log('Seeding appointments...')
  const docRows = await db.doctor.findMany({ orderBy: { createdAt: 'asc' } })
  const patRows = await db.patient.findMany({ orderBy: { createdAt: 'asc' } })
  await db.appointment.createMany({
    data: appointments.map((a) => ({
      patientId: patRows[a.patientIdx].id,
      doctorId: docRows[a.doctorIdx].id,
      date: a.date,
      timeSlot: a.timeSlot,
      status: a.status,
      reason: a.reason,
      notes: (a as { notes?: string }).notes ?? null,
    })),
  })

  console.log('Seeding medical records...')
  await db.medicalRecord.createMany({
    data: records.map((r) => ({
      patientId: patRows[r.patientIdx].id,
      doctorId: docRows[r.doctorIdx].id,
      diagnosis: r.diagnosis,
      prescription: r.prescription,
      treatment: r.treatment,
      notes: r.notes,
      visitType: r.visitType,
      recordDate: new Date(Date.now() - r.daysAgo * 86400000),
    })),
  })

  console.log('Seeding appointment slots (next 14 days, available doctors)...')
  const slotDays = 14
  const baseSlots = [
    '09:00 AM - 09:30 AM',
    '10:00 AM - 10:30 AM',
    '11:00 AM - 11:30 AM',
    '02:00 PM - 02:30 PM',
    '03:00 PM - 03:30 PM',
    '04:00 PM - 04:30 PM',
  ]
  const availableDoctors = docRows.filter((d) => d.availability === 'Available')
  const today = isoDate(0)
  const slotRows: { doctorId: string; date: string; timeSlot: string; sortKey: number }[] = []
  for (let day = 0; day < slotDays; day++) {
    const date = isoDate(day)
    availableDoctors.forEach((doctor, doctorIdx) => {
      baseSlots.forEach((timeSlot, slotIdx) => {
        // deterministic variation so the demo matrix doesn't look uniform
        if ((day + doctorIdx + slotIdx) % 4 === 3) return
        if (timeSlot === '09:00 AM - 09:30 AM' && date === today && doctorIdx % 2 === 0) return
        slotRows.push({
          doctorId: doctor.id,
          date,
          timeSlot,
          sortKey: (TIME_SLOTS as readonly string[]).indexOf(timeSlot),
        })
      })
    })
  }
  for (const row of slotRows) {
    try {
      await db.appointmentSlot.create({ data: row })
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') continue // slot already exists
      throw error
    }
  }

  console.log('Marking slots booked for active appointments...')
  const activeAppointments = await db.appointment.findMany({
    where: { status: { in: ['Pending', 'Scheduled'] } },
    select: { doctorId: true, date: true, timeSlot: true },
  })
  for (const appt of activeAppointments) {
    await db.appointmentSlot.updateMany({
      where: { doctorId: appt.doctorId, date: appt.date, timeSlot: appt.timeSlot, isBooked: false },
      data: { isBooked: true },
    })
  }

  console.log('Seeding health articles...')
  await db.healthArticle.createMany({ data: articles })

  console.log('Seeding invoices...')
  const year = new Date().getFullYear()
  await db.invoice.createMany({
    data: invoices.map((inv, idx) => {
      const { subtotal, taxAmount, total } = calcTotals(inv.items, inv.taxRate ?? 0, inv.discount ?? 0)
      const issueDate = isoDate(-inv.issuedDaysAgo)
      const dueDate = isoDate(-inv.issuedDaysAgo + inv.dueInDays)
      return {
        invoiceNumber: `INV-${year}-${String(idx + 1).padStart(4, '0')}`,
        patientId: patRows[inv.patientIdx].id,
        items: JSON.stringify(inv.items),
        subtotal,
        taxRate: inv.taxRate ?? 0,
        taxAmount,
        discount: inv.discount ?? 0,
        total,
        amountPaid: (inv.payments ?? []).reduce((s, p) => s + p.amount, 0),
        payments: JSON.stringify(
          (inv.payments ?? []).map((p) => ({
            date: new Date(Date.now() - p.daysAgo * 86400000).toISOString(),
            amount: p.amount,
            method: p.method,
            note: p.note ?? null,
          }))
        ),
        status: inv.status,
        issueDate,
        dueDate,
        notes: inv.notes ?? null,
      }
    }),
  })

  console.log('Seeding demo users (admin + member)...')
  await db.user.create({
    data: {
      name: 'Demo Admin',
      email: 'admin@medicarehub.com',
      passwordHash: hashPassword('demo1234'),
      role: 'ADMIN',
    },
  })
  await db.user.create({
    data: {
      name: 'Emma Wilson',
      email: 'user@medicarehub.com',
      passwordHash: hashPassword('demo1234'),
      role: 'USER',
    },
  })

  console.log('✅ Seed complete!')
  const counts = {
    departments: await db.department.count(),
    doctors: await db.doctor.count(),
    patients: await db.patient.count(),
    appointments: await db.appointment.count(),
    records: await db.medicalRecord.count(),
    articles: await db.healthArticle.count(),
    invoices: await db.invoice.count(),
    users: await db.user.count(),
  }
  console.log(counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
