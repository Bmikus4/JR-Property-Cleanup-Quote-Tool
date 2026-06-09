// Pre-built sample quotes for admin testing. Each is a complete quote in the
// ITEM: section | service | price format produced by the property cleanup assistant.

export const TEST_QUOTES: string[] = [
  `JR PROPERTY CLEANUP — QUOTE (TEST)
Property: 123 Maple Street, Springfield, IL
Homeowner: John Smith

ITEM: Front Driveway | Pressure washing | $150
ITEM: Front Yard | Mowing overgrown, edging, debris removal | $165
ITEM: Front Porch | Pressure washing, cobweb removal | $100
ITEM: Front Gutters | Gutter cleaning + downspout flush | $75
ITEM: Front Siding | Soft wash vinyl siding | $125

SUBTOTAL: $615`,

  `JR PROPERTY CLEANUP — QUOTE (TEST)
Property: 456 Oak Avenue, Riverside, IL
Homeowner: Sarah Johnson

ITEM: Front Yard | Leaf removal, weed treatment | $175
ITEM: Back Yard | Mowing, debris removal, bush trimming | $200
ITEM: Back Deck | Pressure washing, railing cleaning | $185
ITEM: Garage Interior | Cleanout/junk removal (50% full) | $225
ITEM: Junk Removal | Pickup truck load of bulk items | $225

SUBTOTAL: $1,010`,
];

export function randomTestQuote(): string {
  return TEST_QUOTES[Math.floor(Math.random() * TEST_QUOTES.length)];
}
