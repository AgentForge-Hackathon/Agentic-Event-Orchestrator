import mongoose, { type Document, type Model } from 'mongoose';

const { Schema, model } = mongoose;

// ─── Sub-document interfaces ───────────────────────────────────────────────

export interface IEventLocation {
  address: string;
  city: string;
  country: string;
}

export interface IEventPrice {
  min: number;
  max: number;
  currency: string;
}

/** Snapshot of an event stored inside each itinerary item. */
export interface IEventSnapshot {
  id: string;
  name: string;
  description?: string;
  url?: string | null;
  image?: string | null;
  venue?: string;
  location?: IEventLocation;
  startTime?: string;
  endTime?: string;
  price?: IEventPrice;
  category?: string;
  tags?: string[];
  rating?: number | null;
  availability?: string;
  source?: string;
}

export interface IItemTime {
  start: string;
  end: string;
}

export interface IItineraryItem {
  event: IEventSnapshot;
  /** The scheduled time block for this item within the itinerary. */
  time: IItemTime;
  notes?: string | null;
}

export interface ITotalCost {
  min: number;
  max: number;
  currency: string;
}

// ─── Root document interface ───────────────────────────────────────────────

export interface IItinerary {
  /** UUID from the Supabase auth session — indexed for fast per-user queries. */
  createdBy: string;
  items: IItineraryItem[];
  totalCost?: ITotalCost;
  summary?: string | null;
  /** ISO 8601 date string for the planned day (e.g. 2026-03-15T00:00:00.000Z). */
  plannedDate?: string | null;
}

export type ItineraryDocument = IItinerary & Document;

// ─── Sub-schemas ──────────────────────────────────────────────────────────

const EventLocationSchema = new Schema<IEventLocation>(
  {
    address: { type: String, required: true },
    city:    { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const EventPriceSchema = new Schema<IEventPrice>(
  {
    min:      { type: Number, required: true },
    max:      { type: Number, required: true },
    currency: { type: String, default: 'SGD' },
  },
  { _id: false },
);

const EventSnapshotSchema = new Schema<IEventSnapshot>(
  {
    id:           { type: String, required: true },
    name:         { type: String, required: true },
    description:  { type: String },
    url:          { type: String, default: null },
    image:        { type: String, default: null },
    venue:        { type: String },
    location:     { type: EventLocationSchema },
    startTime:    { type: String },
    endTime:      { type: String },
    price:        { type: EventPriceSchema },
    category:     { type: String },
    tags:         [{ type: String }],
    rating:       { type: Number, default: null },
    availability: { type: String },
    source:       { type: String },
  },
  { _id: false },
);

const ItemTimeSchema = new Schema<IItemTime>(
  {
    start: { type: String, required: true },
    end:   { type: String, required: true },
  },
  { _id: false },
);

const ItineraryItemSchema = new Schema<IItineraryItem>(
  {
    event: { type: EventSnapshotSchema, required: true },
    time:  { type: ItemTimeSchema,      required: true },
    notes: { type: String, default: null },
  },
  { _id: false },
);

const TotalCostSchema = new Schema<ITotalCost>(
  {
    min:      { type: Number, required: true },
    max:      { type: Number, required: true },
    currency: { type: String, default: 'SGD' },
  },
  { _id: false },
);

// ─── Root schema ──────────────────────────────────────────────────────────

const ItinerarySchema = new Schema<IItinerary>(
  {
    createdBy:   { type: String, required: true },
    items:       { type: [ItineraryItemSchema], default: [] },
    totalCost:   { type: TotalCostSchema },
    summary:     { type: String, default: null },
    plannedDate: { type: String, default: null },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
    collection: 'itineraries',
  },
)

// Index on createdBy so fetching a user's itineraries stays O(log n)
// regardless of total collection size. createIndex is idempotent — safe
// to define here; Mongoose syncs it on first model use.
ItinerarySchema.index({ createdBy: 1 }, { name: 'idx_itineraries_created_by' });

// ─── Model ────────────────────────────────────────────────────────────────

const ItineraryModel: Model<IItinerary> = model<IItinerary>('Itinerary', ItinerarySchema);

export default ItineraryModel;
