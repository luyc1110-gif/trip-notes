export type Member = {
  id: string;
  name: string;
  color: number;
  isOwner: boolean;
  claimed: boolean;
  sort: number;
};

export type Expense = {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
  payerId: string;
  participantIds: string[];
  category: string;
  spentOn: string; // YYYY-MM-DD
  isPersonal: boolean;
  createdBy: string | null;
  /** 只存在用戶端：離線時新增、尚未上傳 */
  pending?: boolean;
};

export type Payment = {
  id: string;
  fromId: string;
  toId: string;
  amountMinor: number;
  createdBy: string | null;
  createdAt: string;
};

export type ItineraryItem = {
  id: string;
  day: string; // YYYY-MM-DD
  sort: number;
  time: string | null; // HH:MM
  name: string;
  category: string;
  note: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
};

export type Todo = { id: string; text: string; done: boolean };

export type TripInfo = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  settleCurrency: string;
  cover: string;
  locked: boolean;
  /** 只有建立者拿得到 */
  inviteToken?: string;
};

export type Snapshot = {
  trip: TripInfo;
  me: { memberId: string; role: 'owner' | 'guest' };
  members: Member[];
  currencies: { code: string; rate: number }[];
  expenses: Expense[];
  payments: Payment[];
  itinerary: ItineraryItem[];
  todos: Todo[];
};

export type Op =
  | { op: 'expense.upsert'; expense: Omit<Expense, 'createdBy' | 'pending'> }
  | { op: 'expense.delete'; id: string }
  | { op: 'payment.add'; fromId: string; toId: string; amountMinor: number }
  | { op: 'payment.remove'; id: string }
  | {
      op: 'itinerary.add';
      item: Omit<ItineraryItem, 'id' | 'sort'>;
    }
  | { op: 'itinerary.update'; id: string; item: Omit<ItineraryItem, 'id' | 'sort'> }
  | { op: 'itinerary.delete'; id: string }
  | { op: 'itinerary.reorder'; day: string; ids: string[] }
  | { op: 'todo.add'; text: string }
  | { op: 'todo.toggle'; id: string; done: boolean }
  | { op: 'todo.delete'; id: string }
  // 以下只有建立者可用
  | { op: 'trip.update'; name: string; startDate: string; endDate: string; cover: string }
  | { op: 'trip.unlock' }
  | { op: 'trip.delete' }
  | { op: 'member.add'; name: string }
  | { op: 'member.rename'; id: string; name: string }
  | { op: 'member.remove'; id: string }
  | { op: 'member.unclaim'; id: string }
  | { op: 'currency.set'; code: string; rate: number }
  | { op: 'currency.remove'; code: string }
  | { op: 'invite.reset' };

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'food', label: '餐飲' },
  { key: 'transit', label: '交通' },
  { key: 'stay', label: '住宿' },
  { key: 'ticket', label: '門票' },
  { key: 'shopping', label: '購物' },
  { key: 'other', label: '其他' },
];

export const PLACE_KINDS: { key: string; label: string }[] = [
  { key: 'sight', label: '景點' },
  { key: 'food', label: '餐廳' },
  { key: 'transit', label: '交通' },
  { key: 'stay', label: '住宿' },
  { key: 'other', label: '其他' },
];

export const COVERS: { key: string; label: string }[] = [
  { key: 'town', label: '山城' },
  { key: 'coast', label: '山海' },
  { key: 'beach', label: '海邊' },
  { key: 'city', label: '都市' },
];
