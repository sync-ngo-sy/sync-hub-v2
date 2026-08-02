# English only, no i18n layer

All three portals ship in English with no internationalization layer — no translation
framework, no RTL support, plain string literals in components. Decided deliberately
despite the Syrian context: it removes a whole class of cost (Arabic-capable font
pairing, logical-properties discipline, translation upkeep) from every frontend ticket.
The trade-off is accepted knowingly: retrofitting Arabic/RTL later would be a
weeks-scale rework, and we are choosing that risk over paying the tax now.
