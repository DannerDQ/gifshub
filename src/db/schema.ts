import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const collectionKind = pgEnum("collection_kind", ["favorites", "custom"]);
export const mediaType = pgEnum("media_type", ["gif", "sticker"]);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: collectionKind("kind").notNull().default("custom"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("collections_user_name_uq").on(t.userId, t.name),
    // One favorites collection per user.
    uniqueIndex("collections_user_favorites_uq")
      .on(t.userId)
      .where(sql`${t.kind} = 'favorites'`),
  ],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    // Only the Giphy ID is stored; media is never rehosted.
    giphyId: text("giphy_id").notNull(),
    mediaType: mediaType("media_type").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.giphyId] })],
);
