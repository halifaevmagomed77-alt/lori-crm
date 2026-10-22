export type ID = string;
/** Calendar date in local time, "YYYY-MM-DD" */
export type DateStr = string;

export const SOURCES = ["Instagram", "Сайт", "Рекомендация", "Проходили мимо", "Другое"] as const;
export type Source = (typeof SOURCES)[number];

export type Measurements = { bust?: number; waist?: number; hips?: number; height?: number };

export type Client = {
  id: ID;
  name: string;
  phone: string;
  weddingDate?: DateStr;
  source: Source;
  measurements: Measurements;
  notes: string;
  createdAt: DateStr;
};

export const CATEGORIES = ["Свадебное", "Вечернее"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Dress = {
  id: ID;
  name: string;
  category: Category;
  size: string;
  color: string;
  salePrice: number;
  rentPrice: number;
  forSale: boolean;
  forRent: boolean;
  photo?: string;
  createdAt: DateStr;
};

export type FittingStatus = "planned" | "done" | "noshow" | "cancelled";

export type Fitting = {
  id: ID;
  clientId: ID;
  date: DateStr;
  time: string; // "HH:MM"
  dressIds: ID[];
  status: FittingStatus;
  notes: string;
};

export type OrderType = "sale" | "rent";
/** booked: оформлено, ждёт выдачи · issued: выдано (для аренды — у клиентки) · returned: аренда возвращена */
export type OrderStatus = "booked" | "issued" | "returned" | "cancelled";

export type Order = {
  id: ID;
  type: OrderType;
  clientId: ID;
  dressId: ID;
  fittingId?: ID;
  price: number;
  createdAt: DateStr;
  issueDate: DateStr;
  returnDate?: DateStr; // только для аренды
  status: OrderStatus;
  notes: string;
};

export type Role = "owner" | "admin";

export type DB = {
  version: 1;
  clients: Client[];
  dresses: Dress[];
  fittings: Fitting[];
  orders: Order[];
};
