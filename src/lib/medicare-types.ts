/**
 * Shared domain types for Medicare Hub.
 * JSON dates arrive as ISO strings over the wire.
 * NOTE: 3-b / 3-c frontend agents — import everything from here.
 */

export type DoctorAvailability = "Available" | "On Leave" | "Off Duty";
/** Lifecycle: member books -> Pending; admin approves -> Scheduled; visit done -> Completed. */
export type AppointmentStatus = "Pending" | "Scheduled" | "Completed" | "Cancelled";
export type VisitType = "Consultation" | "Follow-up" | "Emergency" | "Surgery";
export type InvoiceStatus = "Draft" | "Pending" | "Paid" | "Cancelled";
/** Status shown in the UI — "Overdue" is derived server-side from Pending + past dueDate. */
export type InvoiceDisplayStatus = InvoiceStatus | "Overdue";
export type PaymentMethod = "Cash" | "Card" | "Insurance" | "Bank Transfer" | "Other";

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  department: string;
  experience: number;
  rating: number;
  consultationFee: number;
  availability: DoctorAvailability;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  gender: "Male" | "Female" | "Other";
  bloodGroup: string | null;
  address: string | null;
  allergies: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientBrief {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoicePayment {
  date: string; // ISO datetime string
  amount: number;
  method: PaymentMethod;
  note?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  appointmentId: string | null;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  payments: InvoicePayment[];
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: PatientBrief;
}

export interface DoctorBrief {
  id: string;
  name: string;
  specialty: string;
  department?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: PatientBrief;
  doctor?: DoctorBrief;
}

/** A bookable time window published by the admin for a doctor on a given date. */
export interface AppointmentSlot {
  id: string;
  doctorId: string;
  date: string;
  timeSlot: string;
  sortKey: number;
  isBooked: boolean;
  createdAt: string;
  updatedAt: string;
  doctor?: DoctorBrief;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  prescription: string | null;
  treatment: string | null;
  notes: string | null;
  visitType: VisitType;
  recordDate: string;
  createdAt: string;
  updatedAt: string;
  patient?: { id: string; name: string };
  doctor?: { id: string; name: string; specialty: string };
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  headDoctor: string | null;
  location: string | null;
  phone: string | null;
  createdAt: string;
  doctorCount?: number;
}

export interface HealthArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  author: string;
  readTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  totals: {
    patients: number;
    doctors: number;
    appointments: number;
    records: number;
    departments: number;
    articles: number;
  };
  todayAppointments: number;
  upcomingAppointments: number;
  statusBreakdown: {
    Pending: number;
    Scheduled: number;
    Completed: number;
    Cancelled: number;
  };
  pendingAppointments: number;
  appointmentsByDepartment: { department: string; count: number }[];
  recentAppointments: Appointment[];
  weeklyTrend: { date: string; count: number }[];
}

/** Canonical time slots used by the appointment form (backend validates against free text, these are UI-canonical). */
export const TIME_SLOTS = [
  "09:00 AM - 09:30 AM",
  "10:00 AM - 10:30 AM",
  "11:00 AM - 11:30 AM",
  "12:00 PM - 12:30 PM",
  "01:00 PM - 01:30 PM",
  "02:00 PM - 02:30 PM",
  "03:00 PM - 03:30 PM",
  "04:00 PM - 04:30 PM",
  "05:00 PM - 05:30 PM",
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Methods offered when recording a payment against an invoice. */
export const PAYMENT_METHODS = ["Cash", "Card", "Insurance", "Bank Transfer", "Other"] as const;
