/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PaymentType {
  SALARY = "Salário",
  FORTNIGHT = "Quinzena",
  DAILY = "Diária",
  VACATION = "Férias",
  THIRTEENTH = "Décimo Terceiro"
}

export enum EmployeeRole {
  TRACTOR_DRIVER = "Tratorista",
  COWBOY = "Vaqueiro",
  DAY_LABORER = "Diarista",
  DOMESTIC = "Doméstica",
  OTHER = "Outro"
}

export interface EmployeePayment {
  id: string;
  date: string;
  employeeName: string;
  role: EmployeeRole;
  paymentType: PaymentType;
  dailyQuantity?: number;
  dailyValue?: number;
  totalValue: number;
  observation?: string;
}

export enum ExpenseType {
  DIESEL = "Diesel",
  GASOLINE = "Gasolina",
  MEDICINE = "Medicamentos",
  SALT = "Sal",
  VACCINE = "Vacina",
  MAINTENANCE = "Manutenção",
  FOOD = "Alimentação",
  CONSTRUCTION = "Material de Construção",
  FEED = "Ração",
  OTHER = "Outras Despesas"
}

export interface Expense {
  id: string;
  date: string;
  dueDate?: string; // Optional due date
  type: ExpenseType;
  description: string;
  provider?: string; // Add provider/seller
  value: number;
  observation?: string;
  status?: 'pending' | 'paid';
}

export enum AnimalType {
  OWN = "Próprio",
  RENT = "Aluguel",
  PARTIAL = "Meia",
  THIRD_PARTY = "Terceiros",
  OTHER = "Outro"
}

export enum AnimalCategory {
  COW = "Vaca",
  BULL = "Boi",
  CALF = "Bezerro",
  HEIFER = "Novilha",
  SHEEP = "Ovelha",
  GOAT_FEMALE = "Cabra",
  GOAT_MALE = "Bode",
  HEN = "Galinha",
  ROOSTER = "Galo",
  HORSE = "Cavalo",
  MARE = "Égua",
  DONKEY_MALE = "Burro",
  DONKEY_FEMALE = "Burra"
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  admissionDate: string;
  noticeDate?: string;
  vacationDate?: string;
  status: 'active' | 'notice' | 'vacation' | 'inactive';
  vacationHistory?: { start: string; end: string }[];
  noticeHistory?: string[];
  paymentHistory?: { date: string; type: string; value: number }[];
}

export interface Animal {
  id: string;
  type: AnimalType;
  category: AnimalCategory;
  breed?: string; // Add breed
  ownerName?: string; // For Rent/Partial
  quantity: number;
  lotName: string; // Numeração ou Nome
  formerOwnerName?: string;
  formerOwnerCity?: string;
  formerOwnerPhone?: string;
  purchaseDate?: string;
  purchasePrice?: number; // Preço de compra por cabeça
  entryDate: string;
  currentPastureId: string;
  pastureHistory: { pastureId: string; date: string }[];
  pastureForecast?: string;
  exitForecast?: string;
  exitDate?: string;
  averageWeight: number;
  weightHistory?: { date: string; weight: number }[];
  aiTechnicalNote?: string;
  aiConfidence?: number;
  arrobaValue?: number;
  costs: number;
  profit?: number;
  rentValue?: number; // For Rent
  paymentDate?: string; // For Rent
  revenue?: number; // For Rent (value * duration)
  partnershipFarmShare?: number; // % that goes to farm for Meia (e.g. 50%)
  partnershipExitWeight?: number; // Weight at exit for Meia
  isSold?: boolean;
  saleDetails?: {
    saleDate: string;
    arrobaPrice: number;
    averageWeight: number;
    buyerName?: string;
    shippingCost?: number;
    funruralCost?: number;
    taxesCost?: number;
    otherSaleCosts?: number;
    totalSaleValue: number;
    grossProfit: number;
    netProfit: number;
    partnershipFarmShare?: number;
    partnershipExitWeight?: number;
  };
}

export interface Pasture {
  id: string;
  number: string;
  name: string;
  grassTypes: string[]; // Brachiaria, Mombaça, etc.
  capacityAguas: number;
  capacitySeca: number;
  size: number; // In Hectares
  stockingHistory: { date: string, count: number }[];
  purpose?: 'engorda' | 'manutenção' | 'finalização';
  mapX?: number;
  mapY?: number;
  aiAnalysis?: {
    grassType: string;
    heightCm: number;
    quality: string;
    isGoodToPutCattle: boolean;
    isTimeToTakeOutCattle: boolean;
    nutrients: string[];
    crudeProtein: string;
    ndt: string;
    recommendedAnimalSize: string;
    objective: string;
    technicalJustification: string;
    confidence: number;
    timestamp: string;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  category: "Supply" | "Equipment";
  quantity: number;
  unit: string;
  unitPrice?: number;
  totalPrice?: number;
  lastUpdated: string;
  storeName?: string;
  contactPhone?: string;
  responsiblePerson?: string;
  history?: {
    date: string;
    changeType: 'add' | 'edit' | 'adjustment';
    quantity: number;
    user?: string;
  }[];
}

export interface FarmTask {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  priority: "Low" | "Medium" | "High";
  assignedTo?: string; // Colaborador designado
  executionLocation?: string; // Local de execução
}

export interface TransactionHistory {
  id: string;
  date: string;
  animalId: string;
  type: "Buy" | "Sell";
  quantity: number;
  price: number;
}

export interface FixedExpense {
  id: string;
  description: string;
  dueDate: string;
  value: number;
  expenseType: string; // Energia, Internet, Pró-labore, etc.
}

export interface OccurrencePin {
  id: string;
  type: 'nascente' | 'cerca' | 'recuperacao' | 'outro';
  title: string;
  description: string;
  x: number;
  y: number;
  createdAt: string;
}

export interface FarmSettings {
  farmName: string;
  city: string;
  location?: {
    lat: number;
    lng: number;
  };
  customExpenseTypes?: string[];
  concludedObligations?: string[];
  farmMapUrl?: string;
  farmMapFileName?: string;
  occurrences?: OccurrencePin[];
}

export interface WeighingRow {
  id: string;
  quantity: number;
  weight: number; // in kg (per animal)
  arrobaValue: number; // in R$
  divisionBy15?: number; // in @ (per animal, editable)
}

export interface WeighingSheet {
  id: string;
  name: string;
  date: string;
  rows: WeighingRow[];
  notes?: string;
}

