/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimalCategory, AnimalType, EmployeeRole, ExpenseType, PaymentType } from "./types";

export const EMPLOYEE_ROLES = Object.values(EmployeeRole);
export const EXPENSE_TYPES = Object.values(ExpenseType);
export const PAYMENT_TYPES = Object.values(PaymentType);
export const ANIMAL_CATEGORIES = Object.values(AnimalCategory);
export const ANIMAL_TYPES = Object.values(AnimalType);

export const PASTURE_TYPES = [
  "Brachiaria",
  "Mombaça",
  "Quicuio",
  "Piatã",
  "Tanzânia",
  "Outro"
];
