// 金額一律以「最小貨幣單位的整數」處理（日圓、台幣沒有小數；美元為分）。
// 這個檔案不依賴任何其他模組，伺服器、瀏覽器與測試共用。

export type CurrencyInfo = { name: string; symbol: string; decimals: number };

export const CURRENCIES: Record<string, CurrencyInfo> = {
  TWD: { name: '新台幣', symbol: 'NT$', decimals: 0 },
  JPY: { name: '日圓', symbol: '¥', decimals: 0 },
  KRW: { name: '韓元', symbol: '₩', decimals: 0 },
  USD: { name: '美元', symbol: 'US$', decimals: 2 },
  EUR: { name: '歐元', symbol: '€', decimals: 2 },
  CNY: { name: '人民幣', symbol: 'CN¥', decimals: 2 },
  HKD: { name: '港幣', symbol: 'HK$', decimals: 2 },
  THB: { name: '泰銖', symbol: '฿', decimals: 2 },
  VND: { name: '越南盾', symbol: '₫', decimals: 0 },
  SGD: { name: '新加坡幣', symbol: 'S$', decimals: 2 },
  MYR: { name: '馬來西亞令吉', symbol: 'RM', decimals: 2 },
  GBP: { name: '英鎊', symbol: '£', decimals: 2 },
  AUD: { name: '澳幣', symbol: 'A$', decimals: 2 },
};

export function decimalsOf(code: string): number {
  return CURRENCIES[code]?.decimals ?? 2;
}

export function symbolOf(code: string): string {
  return CURRENCIES[code]?.symbol ?? code + ' ';
}

/** 把使用者輸入的字串（可含千分位逗號）轉成最小單位整數；不合法回傳 null */
export function toMinor(input: string, code: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  const minor = Math.round(value * 10 ** decimalsOf(code));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatAmount(minor: number, code: string): string {
  const d = decimalsOf(code);
  return (minor / 10 ** d).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function formatMoney(minor: number, code: string): string {
  return symbolOf(code) + formatAmount(minor, code);
}

/** 帶正負號，例如 +8,085、−3,423 */
export function formatSigned(minor: number, code: string): string {
  if (minor === 0) return formatAmount(0, code);
  return (minor > 0 ? '+' : '−') + formatAmount(Math.abs(minor), code);
}

/** rates：1 單位外幣 = rate 單位結算幣 */
export function toSettle(
  amountMinor: number,
  currency: string,
  settleCurrency: string,
  rates: Record<string, number>,
): number {
  if (currency === settleCurrency) return amountMinor;
  const rate = rates[currency];
  if (!rate) return 0;
  const major = amountMinor / 10 ** decimalsOf(currency);
  return Math.round(major * rate * 10 ** decimalsOf(settleCurrency));
}

export type ExpenseLike = {
  amountMinor: number;
  currency: string;
  payerId: string;
  participantIds: string[];
  isPersonal: boolean;
};

export type PaymentLike = { fromId: string; toId: string; amountMinor: number };

export type Balances = {
  /** 淨額：正數＝應收，負數＝應付（已扣除標記已付的轉帳） */
  net: Record<string, number>;
  /** 每人旅費：分攤額加個人花費 */
  cost: Record<string, number>;
  total: number;
};

/**
 * 均分規則：每位參與者負擔 floor(金額 / 人數)，除不盡的尾數由付款人吸收。
 * 個人花費只計入付款人自己的旅費，不影響應收應付。
 */
export function computeBalances(
  memberIds: string[],
  expenses: ExpenseLike[],
  payments: PaymentLike[],
  settleCurrency: string,
  rates: Record<string, number>,
): Balances {
  const net: Record<string, number> = {};
  const cost: Record<string, number> = {};
  for (const id of memberIds) {
    net[id] = 0;
    cost[id] = 0;
  }
  const add = (rec: Record<string, number>, id: string, v: number) => {
    rec[id] = (rec[id] ?? 0) + v;
  };
  let total = 0;

  for (const e of expenses) {
    const amt = toSettle(e.amountMinor, e.currency, settleCurrency, rates);
    total += amt;
    if (e.isPersonal || e.participantIds.length === 0) {
      add(cost, e.payerId, amt);
      continue;
    }
    const n = e.participantIds.length;
    const share = Math.floor(amt / n);
    const remainder = amt - share * n;
    add(net, e.payerId, amt - remainder);
    add(cost, e.payerId, remainder);
    for (const p of e.participantIds) {
      add(net, p, -share);
      add(cost, p, share);
    }
  }

  for (const p of payments) {
    add(net, p.fromId, p.amountMinor);
    add(net, p.toId, -p.amountMinor);
  }

  return { net, cost, total };
}

export type Transfer = { fromId: string; toId: string; amountMinor: number };

/**
 * 以「最大債務人付給最大債權人」的貪婪法產生轉帳方案，
 * 筆數不超過（有餘額的人數 − 1）。
 */
export function planTransfers(net: Record<string, number>): Transfer[] {
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }));
  const byAmount = (a: { id: string; v: number }, b: { id: string; v: number }) =>
    b.v - a.v || (a.id < b.id ? -1 : 1);

  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.v, d.v);
    out.push({ fromId: d.id, toId: c.id, amountMinor: amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
  }
  return out;
}
