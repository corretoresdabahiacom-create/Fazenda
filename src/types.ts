/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PropertyType {
  FAZENDA = "Fazenda",
  SITIO = "Sítio",
  CHACARA = "Chácara",
  ARRENDAMENTO = "Arrendamento",
  PARCEIRO = "Parceiro"
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  areaTotal?: number; // hectares
  areaProdutiva?: number; // hectares
  areaPreservada?: number; // hectares
  reservaLegal?: number; // hectares
  car?: string; // Cadastro Ambiental Rural
  location?: {
    lat: number;
    lng: number;
  };
  partnerName?: string; // para tipo "Parceiro" ou "Arrendamento"
  createdAt: string;
}

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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
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
  propertyId?: string; // vincula o registro a uma propriedade (Fase 2 - multi-propriedade)
  name: string;
  date: string;
  rows: WeighingRow[];
  notes?: string;
}

// =====================================================================
// FASE 6/7 — PECUÁRIA PROFISSIONAL
// Cadastro individual (complementa, não substitui, o controle por lote já
// existente em `Animal`), Reprodução, Sanidade e Produção Leiteira.
// =====================================================================

export enum AnimalSex {
  MALE = "Macho",
  FEMALE = "Fêmea",
}

export enum LotGroup {
  BEZERROS = "Bezerros",
  NOVILHAS = "Novilhas",
  MATRIZES = "Matrizes",
  TOUROS = "Touros",
  CONFINAMENTO = "Confinamento",
}

// Representa UM animal específico (brinco/RFID) — diferente de `Animal`,
// que representa um LOTE (várias cabeças agrupadas). Um IndividualAnimal
// pode opcionalmente pertencer a um lote (lotGroup) para fins de manejo.
export interface IndividualAnimal {
  id: string;
  propertyId?: string;
  earTag: string; // Brinco — identificação visual
  rfid?: string; // Identificação eletrônica
  name?: string;
  breed?: string;
  sex: AnimalSex;
  category: AnimalCategory;
  lotGroup?: LotGroup;
  birthDate?: string;
  motherEarTag?: string;
  fatherEarTag?: string;
  currentPastureId?: string;
  status: "active" | "sold" | "dead";
  weightHistory?: { date: string; weight: number }[];
  photoUrl?: string;
  notes?: string;
  createdAt: string;
}

export enum ReproductionEventType {
  COBERTURA = "Cobertura",
  INSEMINACAO = "Inseminação Artificial",
  IATF = "IATF",
  DIAGNOSTICO_PRENHEZ = "Diagnóstico de Prenhez",
  PARTO = "Parto",
  DESMAMA = "Desmama",
}

// Gestação bovina ~283 dias — usado para sugerir a data provável de parto
// automaticamente a partir da cobertura/inseminação/IATF.
export const GESTACAO_BOVINA_DIAS = 283;

export interface ReproductionEvent {
  id: string;
  propertyId?: string;
  animalEarTag: string; // fêmea envolvida
  type: ReproductionEventType;
  date: string;
  sireEarTag?: string; // touro/reprodutor (cobertura/inseminação/IATF)
  semenBatch?: string; // partida de sêmen (inseminação/IATF)
  pregnancyResult?: "positivo" | "negativo" | "pendente"; // diagnóstico de prenhez
  expectedBirthDate?: string; // calculado automaticamente
  offspringEarTag?: string; // bezerro nascido (parto)
  weaningWeight?: number; // peso à desmama (desmama)
  notes?: string;
}

export enum HealthEventType {
  VACINACAO = "Vacinação",
  VERMIFUGACAO = "Vermifugação",
  MEDICAMENTO = "Medicamento",
  EXAME = "Exame",
}

export interface HealthEvent {
  id: string;
  propertyId?: string;
  animalEarTag: string;
  type: HealthEventType;
  productName: string;
  date: string;
  nextDoseDate?: string; // controle de reforço/vencimento
  dosage?: string;
  veterinarian?: string;
  cost?: number;
  notes?: string;
}

export interface MilkProductionRecord {
  id: string;
  propertyId?: string;
  animalEarTag?: string; // registro individual
  lotGroup?: LotGroup; // ou registro por lote
  date: string;
  period: "manha" | "tarde" | "dia";
  liters: number;
  ccs?: number; // Contagem de Células Somáticas (mil cel/mL)
  cbt?: number; // Contagem Bacteriana Total (UFC/mL)
  notes?: string;
}


