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
  rentDueDay?: number; // Dia do mês (1-31) em que o aluguel vence, todo mês
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
  nextRotationDate?: string; // data planejada para o próximo remanejo/troca de pasto
  nextRotationTime?: string; // horário planejado (HH:mm), opcional
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
  ownerBirthday?: string; // MM-DD, sem ano — usado para notificações de aniversário do admin
  pushNotificationsDisabled?: boolean; // true = usuário desativou a ativação automática de notificações push
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

// =====================================================================
// ASSINATURA / COBRANÇA / ADMIN — dados de conta e pagamento, separados
// dos dados da fazenda em si. Vivem numa coleção própria no Firestore
// (não dentro de users/{uid}/...), porque o painel admin precisa listar
// TODOS os usuários — algo que a estrutura de dados por fazenda não
// permite fazer com segurança.
// =====================================================================

export enum PlanTier {
  UMA_FAZENDA = "1 Fazenda",
  TRES_FAZENDAS = "3 Fazendas",
  CINCO_FAZENDAS = "5 Fazendas",
  AGRO_TOTAL = "Agro Total",
}

// Preço padrão de cada plano — null no Agro Total porque esse é
// negociado/definido manualmente pelo admin por cliente.
export const PLAN_PRICES: Record<PlanTier, number | null> = {
  [PlanTier.UMA_FAZENDA]: 29.90,
  [PlanTier.TRES_FAZENDAS]: 49.90,
  [PlanTier.CINCO_FAZENDAS]: 79.90,
  [PlanTier.AGRO_TOTAL]: null,
};

export const PLAN_MAX_PROPERTIES: Record<PlanTier, number | null> = {
  [PlanTier.UMA_FAZENDA]: 1,
  [PlanTier.TRES_FAZENDAS]: 3,
  [PlanTier.CINCO_FAZENDAS]: 5,
  [PlanTier.AGRO_TOTAL]: null, // combinado com o cliente
};

export enum SubscriptionStatus {
  TRIAL = "Teste",
  ATIVA = "Ativa",
  ATRASADA = "Atrasada", // pagamento não confirmado no prazo
  CANCELADA = "Cancelada", // cancelada pelo usuário ou pelo admin
  SUSPENSA = "Suspensa", // pausa temporária definida pelo admin
  BLOQUEADA = "Bloqueada", // bloqueio definitivo definido pelo admin
}

export enum PaymentGateway {
  MERCADO_PAGO = "mercadopago",
  PAYPAL = "paypal",
  STRIPE = "stripe",
}

export interface Subscription {
  userId: string; // = uid do Firebase Auth, também é o id do documento
  email: string;
  plan: PlanTier;
  customPrice?: number; // usado só no plano Agro Total
  status: SubscriptionStatus;
  gateway?: PaymentGateway;
  externalSubscriptionId?: string; // id da assinatura no gateway de pagamento
  externalCustomerId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  lastPaymentDate?: string;
  lastPaymentValue?: number;
  paymentHistory?: { date: string; value: number; gateway: PaymentGateway; status: string }[];
  createdAt: string;
  canceledAt?: string;
  canceledBy?: 'user' | 'admin';
  suspendedReason?: string;
  suspendedBy?: string; // e-mail do admin que suspendeu/bloqueou
}

// Índice leve de usuários — criado/atualizado no cadastro e no login,
// separado dos dados de fazenda, para o admin conseguir listar e filtrar
// usuários (por cidade, região, aniversário etc.) sem precisar de acesso
// direto a cada conta individual.
export interface UserDirectoryEntry {
  userId: string;
  email: string;
  displayName?: string;
  city?: string;
  region?: string; // estado/UF
  birthday?: string; // MM-DD, sem o ano, por privacidade
  createdAt: string;
  lastLoginAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  fcmTokens?: string[]; // tokens de notificação push dos dispositivos deste usuário
}

// Notificação enviada pelo admin — individual, para todos, ou filtrada.
export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  targetType: 'all' | 'individual' | 'filtered';
  targetUserId?: string; // usado quando targetType === 'individual'
  filter?: {
    status?: SubscriptionStatus[];
    city?: string;
    region?: string;
    birthdayMonth?: number; // 1-12
  };
  createdAt: string;
  createdBy: string; // e-mail do admin
  readBy?: string[]; // uids que já visualizaram
}

// Publicidade exibida na tela inicial, acima do rodapé — carrossel
// controlado pelo admin.
export enum AdContentType {
  BANNER_IMAGEM = "Banner (imagem)",
  VIDEO = "Vídeo",
  TEXTO = "Texto",
  TEXTO_LINK = "Texto + Link",
  IMAGEM_LINK = "Imagem + Link",
}

export interface Advertisement {
  id: string;
  type: AdContentType;
  title?: string;
  text?: string;
  imageUrl?: string; // base64 (mesma abordagem gratuita usada em Documentos)
  videoUrl?: string; // link externo (YouTube/Vimeo embed), não upload direto
  linkUrl?: string;
  active: boolean;
  order: number; // posição no carrossel
  startDate?: string; // opcional: veiculação programada
  endDate?: string;
  createdAt: string;
  createdBy: string;
}

// Despesa do NEGÓCIO do aplicativo (hospedagem, taxas de gateway etc.) —
// diferente das despesas de cada fazenda cliente. Só o admin vê isso.
export interface AppExpense {
  id: string;
  description: string;
  category: string;
  value: number;
  date: string;
  createdAt: string;
}

// =====================================================================
// ESTAÇÃO DE MONTA — período concentrado de reprodução (monta natural ou
// IA/IATF), prática padrão em bovinocultura de corte para concentrar
// nascimentos numa época favorável. Duração usual: 60 a 120 dias
// (mais comum 90 dias), começando geralmente no início do período das
// chuvas, quando as pastagens estão em melhor condição nutricional.
// =====================================================================

export enum BreedingMethod {
  MONTA_NATURAL = "Monta Natural",
  INSEMINACAO_ARTIFICIAL = "Inseminação Artificial",
  IATF = "IATF",
  MISTA = "Mista (Natural + IA)",
}

export enum BreedingSeasonStatus {
  PLANEJADA = "Planejada",
  EM_ANDAMENTO = "Em Andamento",
  ENCERRADA = "Encerrada",
}

export interface BreedingSeason {
  id: string;
  propertyId?: string;
  name?: string; // ex: "Estação de Monta 2026/2027"
  startDate: string;
  durationDays?: number; // padrão sugerido: 90 (usual entre 60 e 120)
  endDate?: string; // calculado a partir de startDate + durationDays
  method: BreedingMethod;
  bullEarTags?: string; // brincos dos touros usados (monta natural), texto livre
  bullToCowRatio?: string; // proporção touro:vaca na monta natural, ex: "1:25"
  femaleLotGroup?: string; // lote/grupo de fêmeas envolvidas
  femaleCount?: number; // quantidade de fêmeas expostas à reprodução
  bullAndrologicalExamDone?: boolean; // exame andrológico do(s) touro(s) realizado
  status: BreedingSeasonStatus;
  notes?: string;
  createdAt: string;
}

// =====================================================================
// PULVERIZAÇÃO PROGRAMADA — planejamento de aplicações futuras de
// defensivos, com os parâmetros técnicos que a receita agronômica exige:
// dose, taxa de aplicação, período de carência (segurança antes da
// colheita) e intervalo de reentrada de pessoas na área.
// =====================================================================

export enum SprayStatus {
  PROGRAMADA = "Programada",
  REALIZADA = "Realizada",
  ADIADA = "Adiada",
  CANCELADA = "Cancelada",
}

export interface ScheduledSpray {
  id: string;
  propertyId?: string;
  talhaoId?: string;
  scheduledDate: string;
  product?: string; // nome comercial do defensivo
  target?: string; // praga, doença ou erva daninha alvo
  dosage?: string; // dose recomendada (conforme receituário agronômico)
  sprayVolumePerHa?: number; // taxa de aplicação — litros de calda por hectare
  equipment?: string; // ex: pulverizador de barra, costal, drone, aéreo
  preHarvestIntervalDays?: number; // período de carência (dias) antes da colheita
  reentryIntervalHours?: number; // intervalo de reentrada de pessoas na área (horas)
  hasAgronomicPrescription?: boolean; // se há receituário agronômico assinado por profissional habilitado
  status: SprayStatus;
  notes?: string;
  createdAt: string;
}


// =====================================================================
// DOCUMENTOS — CAR, CCIR, ITR, contratos, licenças ambientais,
// receituários agronômicos. Arquivos ficam no Firebase Storage; aqui só
// guardamos os metadados + o link de download.
// =====================================================================

export enum DocumentCategory {
  CAR = "CAR",
  CCIR = "CCIR",
  ITR = "ITR",
  CONTRATO = "Contrato",
  LICENCA_AMBIENTAL = "Licença Ambiental",
  RECEITUARIO_AGRONOMICO = "Receituário Agronômico",
  OUTRO = "Outro",
}

export interface FarmDocument {
  id: string;
  propertyId?: string;
  category: DocumentCategory;
  title: string;
  issueDate?: string;
  expirationDate?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  notes?: string;
  createdAt: string;
}


