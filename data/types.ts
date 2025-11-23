export enum SqlOperator {
  IN = 'IN',
  NOT_IN = 'NOT IN',
  EQUALS = '=',
  NOT_EQUALS = '<>',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  BETWEEN = 'BETWEEN',
  LIKE = 'LIKE',
  IS_NULL = 'IS NULL',
  IS_NOT_NULL = 'IS NOT NULL',
}

export interface ExcelData {
  headers: string[];
  rows: Record<string, any>[];
}

export interface QueryConfig {
  column: string;
  operator: SqlOperator;
  values: string[];
  rangeStart?: string;
  rangeEnd?: string;
}