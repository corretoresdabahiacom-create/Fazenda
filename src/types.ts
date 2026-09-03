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

// Unidade de medida de área — varia por região do Brasil. Os valores de
// área (areaTotal, areaProdutiva etc.) são sempre guardados no número que o
// usuário digitou, na unidade escolhida aqui — sem conversão automática,
// para não criar confusão sobre "qual valor é o real".
export enum AreaUnit {
  HECTARE = "ha",
  ALQUEIRE_PAULISTA = "alqueire paulista",
  ALQUEIRE_MINEIRO = "alqueire mineiro/goiano",
  TAREFA = "tarefa",
  METRO_QUADRADO = "m²",
  ACRE = "acre",
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  areaUnit?: AreaUnit;
  areaTotal?: number;
  areaProdutiva?: number;
  areaPreservada?: number;
  reservaLegal?: number;
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
  minStock?: number; // abaixo disso, alerta de estoque mínimo
  criticalStock?: number; // abaixo disso, alerta de estoque crítico
  expirationDate?: string; // alerta de vencimento
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

// =====================================================================
// FASE 3/4 — AGRICULTURA
// Talhões, Planejamento Agrícola, Caderno de Campo, Manejo de Pragas e
// Irrigação. Nenhum campo é obrigatório — o usuário cadastra e salva do
// jeito que quiser, sem travas.
// =====================================================================

export enum TalhaoStatus {
  ATIVO = "Ativo",
  EM_DESCANSO = "Em descanso",
  EM_PREPARO = "Em preparo",
}

export interface Talhao {
  id: string;
  propertyId?: string;
  name: string;
  area?: number;
  areaUnit?: AreaUnit;
  currentCrop?: string;
  status: TalhaoStatus;
  soilType?: string;
  notes?: string;
  createdAt: string;
}

export enum Cultura {
  SOJA = "Soja",
  MILHO = "Milho",
  ALGODAO = "Algodão",
  LARANJA = "Laranja",
  CAFE = "Café",
  CANA = "Cana-de-açúcar",
  FEIJAO = "Feijão",
  TRIGO = "Trigo",
  EUCALIPTO = "Eucalipto",
  HORTALICAS = "Hortaliças",
  FRUTICULTURA = "Fruticultura",
  OUTRA = "Outra",
}

export enum CropPlanStatus {
  PLANEJADO = "Planejado",
  EM_ANDAMENTO = "Em andamento",
  COLHIDO = "Colhido",
  CANCELADO = "Cancelado",
}

export interface CropPlan {
  id: string;
  propertyId?: string;
  talhaoId?: string;
  cultura: Cultura;
  safra?: string; // ex: "2026/2027"
  plantingDateEstimate?: string;
  harvestDateEstimate?: string;
  areaPlanejada?: number;
  status: CropPlanStatus;
  notes?: string;
  createdAt: string;
}

export enum FieldLogType {
  PLANTIO = "Plantio",
  PULVERIZACAO = "Pulverização",
  IRRIGACAO = "Irrigação",
  ADUBACAO = "Adubação",
  APLICACAO_FOLIAR = "Aplicação Foliar",
  CONTROLE_PRAGAS = "Controle de Pragas",
  CONTROLE_DOENCAS = "Controle de Doenças",
  COLHEITA = "Colheita",
}

export interface FieldLogEntry {
  id: string;
  propertyId?: string;
  talhaoId?: string;
  type: FieldLogType;
  date: string;
  responsavel?: string;
  product?: string;
  quantity?: string;
  gpsLat?: number;
  gpsLng?: number;
  notes?: string;
  createdAt: string;
}

export enum PestType {
  LAGARTA = "Lagarta",
  PERCEVEJO = "Percevejo",
  MOSCA_BRANCA = "Mosca-branca",
  CIGARRINHA = "Cigarrinha",
  FERRUGEM = "Ferrugem",
  NEMATOIDE = "Nematoide",
  OUTRA = "Outra",
}

export enum InfestationLevel {
  BAIXO = "Baixo",
  MEDIO = "Médio",
  ALTO = "Alto",
  CRITICO = "Crítico",
}

export interface PestRecord {
  id: string;
  propertyId?: string;
  talhaoId?: string;
  pestType: PestType;
  date: string;
  infestationLevel: InfestationLevel;
  affectedArea?: number;
  controlAction?: string;
  notes?: string;
  createdAt: string;
}

export enum IrrigationMethod {
  GOTEJAMENTO = "Gotejamento",
  ASPERSAO = "Aspersão",
  PIVO_CENTRAL = "Pivô Central",
}

export interface IrrigationRecord {
  id: string;
  propertyId?: string;
  talhaoId?: string;
  method: IrrigationMethod;
  date: string;
  durationHours?: number;
  waterVolume?: number;
  notes?: string;
  createdAt: string;
}

// =====================================================================
// FASE 9 — FINANCEIRO, MÁQUINAS, RH RURAL
// Mesma filosofia das fases anteriores: nada obrigatório para salvar.
// =====================================================================

export enum CostCenterType {
  SAFRA = "Safra",
  LOTE_ANIMAL = "Lote Animal",
  GERAL = "Geral",
}

export interface CostCenter {
  id: string;
  propertyId?: string;
  name: string;
  type: CostCenterType;
  linkedRef?: string; // nome da safra/lote vinculado, texto livre
  createdAt: string;
}

export enum AccountStatus {
  PENDENTE = "Pendente",
  PAGO = "Pago",
  ATRASADO = "Atrasado",
}

export interface AccountPayable {
  id: string;
  propertyId?: string;
  description: string;
  dueDate?: string;
  value?: number;
  status: AccountStatus;
  costCenterId?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

export interface AccountReceivable {
  id: string;
  propertyId?: string;
  description: string;
  dueDate?: string;
  value?: number;
  status: AccountStatus;
  costCenterId?: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
}

export enum MachineType {
  TRATOR = "Trator",
  COLHEITADEIRA = "Colheitadeira",
  PULVERIZADOR = "Pulverizador",
  CAMINHAO = "Caminhão",
  OUTRO = "Outro",
}

export interface Machine {
  id: string;
  propertyId?: string;
  type: MachineType;
  name: string;
  plate?: string;
  hourMeter?: number;
  fuelConsumption?: number;
  notes?: string;
  createdAt: string;
}

export enum MaintenanceType {
  PREVENTIVA = "Preventiva",
  CORRETIVA = "Corretiva",
}

export interface MaintenanceRecord {
  id: string;
  propertyId?: string;
  machineId?: string;
  type: MaintenanceType;
  date: string;
  description?: string;
  cost?: number;
  hourMeterAtService?: number;
  nextServiceHourMeter?: number;
  notes?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  propertyId?: string;
  name: string;
  memberNames?: string;
  notes?: string;
  createdAt: string;
}

export interface WorkSchedule {
  id: string;
  propertyId?: string;
  employeeName?: string;
  teamId?: string;
  daysOfWeek?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  createdAt: string;
}

export interface Training {
  id: string;
  propertyId?: string;
  employeeName?: string;
  title: string;
  date?: string;
  provider?: string;
  notes?: string;
  createdAt: string;
}

export interface PPEItem {
  id: string;
  propertyId?: string;
  employeeName?: string;
  itemName: string;
  deliveryDate?: string;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Certification {
  id: string;
  propertyId?: string;
  employeeName?: string;
  name: string;
  issueDate?: string;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
}


