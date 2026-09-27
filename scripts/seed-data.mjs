/**
 * Starter content for a fresh database. Everything here is ADJUSTABLE and meant to be edited in the admin:
 *  - categories follow the prompt's suggested list (Section 13) with 2–4 letter SKU codes;
 *  - delivery zones show one rule of each kind (upazila / district / division / default) — fees are placeholders;
 *  - sample products use made-up house brands and illustrated placeholder images.
 *
 * Honesty rules applied to the seed: no safety-certification badges (none are documented yet), no reviews,
 * and sold counts start at 0 — "best sellers" and review blocks stay hidden until real data exists.
 * Infant formula is intentionally not seeded: Bangladesh's Breast-Milk Substitutes Act 2013 restricts its
 * promotion, so check with a lawyer before listing or marketing it.
 */

export const categories = [
  { slug: "baby-clothing", code: "CLO", en: "Baby Clothing", bn: "শিশুর পোশাক", color: "mint", descEn: "Soft, breathable everyday wear for newborns to 5-year-olds.", descBn: "নবজাতক থেকে ৫ বছরের শিশুদের নরম, আরামদায়ক পোশাক।" },
  { slug: "rompers-onesies", parent: "baby-clothing", code: "CLO", en: "Rompers & Onesies", bn: "রম্পার ও ওয়ানসি", color: "mint" },
  { slug: "sets-dresses", parent: "baby-clothing", code: "CLO", en: "Sets & Dresses", bn: "সেট ও ফ্রক", color: "pink" },
  { slug: "feeding-nursing", code: "FED", en: "Feeding & Nursing", bn: "খাওয়ানো ও নার্সিং", color: "yellow", descEn: "Bottles, bibs, cups and nursing helpers.", descBn: "ফিডার, বিব, কাপ ও নার্সিংয়ের প্রয়োজনীয় জিনিস।" },
  { slug: "diapers-wipes", code: "DIA", en: "Diapers & Wipes", bn: "ডায়াপার ও ওয়াইপস", color: "sky", descEn: "Everyday diapers, wipes and changing essentials.", descBn: "প্রতিদিনের ডায়াপার, ওয়াইপস ও বদলানোর জিনিস।" },
  { slug: "toys-learning", code: "TOY", en: "Toys & Learning", bn: "খেলনা ও শেখা", color: "peach", descEn: "Age-appropriate toys that help little ones play and learn.", descBn: "বয়স উপযোগী খেলনা — খেলতে খেলতে শেখা।" },
  { slug: "soft-toys", parent: "toys-learning", code: "TOY", en: "Soft Toys", bn: "নরম খেলনা", color: "peach" },
  { slug: "learning-toys", parent: "toys-learning", code: "TOY", en: "Learning Toys", bn: "শিক্ষামূলক খেলনা", color: "lavender" },
  { slug: "nursery-bedding", code: "NUR", en: "Nursery & Bedding", bn: "নার্সারি ও বিছানা", color: "lavender", descEn: "Cosy sleep and nursery essentials.", descBn: "আরামের ঘুম ও নার্সারির প্রয়োজনীয় জিনিস।" },
  { slug: "bath-skincare", code: "BTH", en: "Bath & Skincare", bn: "গোসল ও ত্বকের যত্ন", color: "sky", descEn: "Gentle bath-time and skincare basics.", descBn: "কোমল গোসল ও ত্বকের যত্নের জিনিস।" },
  { slug: "gift-sets", code: "GFT", en: "Gift Sets", bn: "গিফট সেট", color: "pink", descEn: "Ready-to-gift hampers for baby showers, aqiqah and birthdays.", descBn: "বেবি শাওয়ার, আকিকা ও জন্মদিনের জন্য তৈরি উপহার।" },
];

// Dhaka city thanas added by scripts/build-geo.mjs (ids 9001–9050).
const dhakaCity = Array.from({ length: 50 }, (_, i) => 9001 + i);

export const zones = [
  { code: "dhaka_city", en: "Inside Dhaka City", bn: "ঢাকা সিটির ভেতরে", fee: 70, free: 2000, upazilas: dhakaCity, etaEn: "1–2 days", etaBn: "১–২ দিন", sort: 1 },
  { code: "dhaka_suburbs", en: "Dhaka suburbs (Savar, Keraniganj, Gazipur, Narayanganj)", bn: "ঢাকার আশেপাশে (সাভার, কেরানীগঞ্জ, গাজীপুর, নারায়ণগঞ্জ)", fee: 100, free: 3000, districts: [47, 41, 43], etaEn: "2–3 days", etaBn: "২–৩ দিন", sort: 2 },
  { code: "dhaka_division", en: "Rest of Dhaka Division", bn: "ঢাকা বিভাগের অন্যান্য জেলা", fee: 120, divisions: [6], etaEn: "2–4 days", etaBn: "২–৪ দিন", sort: 3 },
  { code: "outside", en: "Rest of Bangladesh", bn: "সারা বাংলাদেশ", fee: 130, isDefault: true, etaEn: "3–5 days", etaBn: "৩–৫ দিন", sort: 4 },
];

const cloSizes = (colors) => [
  ["0–3 M", "0-6m"], ["3–6 M", "0-6m"], ["6–9 M", "6-12m"], ["9–12 M", "6-12m"],
].flatMap(([size, age]) => colors.map((color) => ({ size, age, color })));

export const products = [
  {
    slug: "soft-cotton-romper", cat: "rompers-onesies", brand: "Zamil Kids", en: "Soft Cotton Romper", bn: "নরম সুতির রম্পার", price: 650, sale: 590,
    ages: ["0-6m", "6-12m"], sizeChart: "clothing", art: "romper", color: "mint", featured: 1, gift: 1,
    materialEn: "100% cotton knit", materialBn: "১০০% সুতি নিট", careEn: "Machine wash cold, gentle cycle. Do not bleach. Dry in shade.", careBn: "ঠান্ডা পানিতে হালকা করে ধুয়ে নিন। ব্লিচ করবেন না। ছায়ায় শুকান।",
    descEn: "An easy snap-front romper in breathable cotton — quick nappy changes, no fuss.", descBn: "বাতাস চলাচলকারী সুতির রম্পার, সামনে বোতাম — ডায়াপার বদলানো সহজ।",
    variants: cloSizes(["Mint", "Lemon"]).map((v, i) => ({ ...v, stock: [8, 6, 10, 4, 7, 2, 5, 0][i] })),
  },
  {
    slug: "newborn-five-piece-set", cat: "sets-dresses", brand: "Zamil Kids", en: "Newborn 5-Piece Clothing Set", bn: "নবজাতকের ৫ পিসের পোশাক সেট", price: 1450,
    ages: ["0-6m"], sizeChart: "clothing", art: "set", color: "yellow", gift: 1,
    materialEn: "Cotton jersey", materialBn: "সুতি জার্সি", careEn: "Wash before first use. Machine wash cold.", careBn: "প্রথম ব্যবহারের আগে ধুয়ে নিন। ঠান্ডা পানিতে ধোয়া যাবে।",
    descEn: "Two bodysuits, a pair of pants, a cap and mittens — everything for the first weeks home.", descBn: "দুটি বডিস্যুট, একটি প্যান্ট, টুপি ও হাতমোজা — বাড়ি ফেরার প্রথম সপ্তাহের সব।",
    variants: [{ size: "0–3 M", age: "0-6m", color: "White & Yellow", stock: 12 }, { size: "3–6 M", age: "0-6m", color: "White & Yellow", stock: 9 }],
  },
  {
    slug: "cotton-frock-with-bloomer", cat: "sets-dresses", brand: "TinyBloom", en: "Cotton Frock with Bloomer", bn: "ব্লুমারসহ সুতির ফ্রক", price: 890, sale: 790,
    ages: ["1-3y", "3-5y"], sizeChart: "clothing", art: "frock", color: "pink",
    materialEn: "Cotton poplin", materialBn: "সুতি পপলিন", careEn: "Hand wash or gentle machine wash. Iron on low.", careBn: "হাতে বা হালকা মেশিনে ধুয়ে নিন। কম তাপে ইস্ত্রি করুন।",
    descEn: "A twirly everyday frock with a matching bloomer, cool enough for summer afternoons.", descBn: "গরমের দিনের জন্য হালকা ফ্রক, সাথে মানানসই ব্লুমার।",
    variants: [["1–2 Y", "1-3y"], ["2–3 Y", "1-3y"], ["3–4 Y", "3-5y"], ["4–5 Y", "3-5y"]].map(([size, age], i) => ({ size, age, color: "Peach", stock: [6, 8, 5, 3][i] })),
  },
  {
    slug: "muslin-swaddle-three-pack", cat: "nursery-bedding", brand: "SnugNest", en: "Muslin Swaddle Wraps (3-pack)", bn: "মসলিন সোয়াডল র‍্যাপ (৩টি)", price: 990,
    ages: ["0-6m"], art: "swaddle", color: "lavender", gift: 1,
    materialEn: "Cotton muslin, 100 × 100 cm", materialBn: "সুতি মসলিন, ১০০ × ১০০ সেমি", careEn: "Gets softer with every wash. Machine wash warm.", careBn: "প্রতিবার ধোয়ার পর আরও নরম হয়। কুসুম গরম পানিতে ধোয়া যাবে।",
    descEn: "Light, breathable wraps for swaddling, burping, or a pram cover on the way to the doctor.", descBn: "হালকা র‍্যাপ — জড়িয়ে রাখা, ঢেকুর তোলা বা প্র্যামের কাভার হিসেবে।",
    variants: [{ size: "Standard", age: "0-6m", color: "Stars & Moons", stock: 15 }],
  },
  {
    slug: "feeding-bottle-250ml", cat: "feeding-nursing", brand: "LittleSip", en: "Wide-Neck Feeding Bottle 250 ml", bn: "চওড়া মুখের ফিডার ২৫০ মি.লি.", price: 480,
    ages: ["0-6m", "6-12m", "1-3y"], art: "bottle", color: "yellow",
    materialEn: "Polypropylene bottle, silicone teat", materialBn: "পলিপ্রোপিলিন বোতল, সিলিকন নিপল", careEn: "Sterilise before first use. Replace the teat every 2–3 months.", careBn: "প্রথম ব্যবহারের আগে জীবাণুমুক্ত করুন। নিপল ২–৩ মাস পরপর বদলান।",
    descEn: "Wide neck for easy filling and cleaning. Comes with a slow-flow teat.", descBn: "চওড়া মুখ — ভরতে ও পরিষ্কার করতে সহজ। সাথে ধীর প্রবাহের নিপল।",
    variants: [{ size: "250 ml", age: null, color: "Clear", stock: 20 }],
  },
  {
    slug: "silicone-bib-two-pack", cat: "feeding-nursing", brand: "LittleSip", en: "Silicone Bibs with Food Catcher (2-pack)", bn: "খাবার ধরার পকেটসহ সিলিকন বিব (২টি)", price: 350,
    ages: ["6-12m", "1-3y"], art: "bib", color: "mint",
    materialEn: "Food-grade silicone", materialBn: "ফুড-গ্রেড সিলিকন", careEn: "Rinse or wipe clean after meals. Dishwasher safe.", careBn: "খাওয়ার পর ধুয়ে বা মুছে নিন।",
    descEn: "The deep pocket catches spills so more food ends up in the tummy.", descBn: "গভীর পকেট খাবার পড়ে যাওয়া আটকায়।",
    variants: [{ size: "Standard", age: null, color: "Mint & Grey", stock: 2 }],
  },
  {
    slug: "diaper-pants", cat: "diapers-wipes", brand: "SnugNest", en: "Diaper Pants (Pack of 40)", bn: "ডায়াপার প্যান্ট (৪০টির প্যাক)", price: 1150, sale: 1050,
    ages: ["0-6m", "6-12m", "1-3y"], art: "diaper", color: "sky", consumable: 1, reorder: 10, featured: 1,
    materialEn: "Soft top sheet, stretchy waist", materialBn: "নরম উপরের স্তর, ইলাস্টিক কোমর", careEn: "Store in a cool, dry place. Roll up and dispose; don't flush.", careBn: "ঠান্ডা ও শুকনো জায়গায় রাখুন। মুড়িয়ে ফেলুন; ফ্লাশ করবেন না।",
    descEn: "Pull-up style for wriggly babies. One pack usually lasts about 10 days.", descBn: "নড়াচড়া করা বাচ্চাদের জন্য প্যান্ট স্টাইল। একটি প্যাক সাধারণত প্রায় ১০ দিন চলে।",
    variants: [["S (4–8 kg)", "0-6m", 14], ["M (7–12 kg)", "6-12m", 18], ["L (9–14 kg)", "1-3y", 11], ["XL (12–17 kg)", "1-3y", 6]].map(([size, age, stock]) => ({ size, age, color: "", stock })),
  },
  {
    slug: "water-wipes-three-pack", cat: "diapers-wipes", brand: "SnugNest", en: "Gentle Water Wipes, 80 pcs (3-pack)", bn: "কোমল ওয়াটার ওয়াইপস, ৮০টি (৩ প্যাক)", price: 520,
    ages: ["0-6m", "6-12m", "1-3y", "3-5y"], art: "wipes", color: "mint", consumable: 1, reorder: 14,
    materialEn: "Spunlace wipes with water", materialBn: "পানিযুক্ত নরম ওয়াইপস", careEn: "Close the lid after use to keep wipes moist.", careBn: "ব্যবহারের পর ঢাকনা বন্ধ রাখুন।",
    descEn: "Everyday wipes for hands, faces and nappy changes.", descBn: "হাত, মুখ ও ডায়াপার বদলানোর জন্য প্রতিদিনের ওয়াইপস।",
    variants: [{ size: "3 × 80", age: null, color: "", stock: 25 }],
  },
  {
    slug: "plush-teddy-bear", cat: "soft-toys", brand: "PlayJoy", en: "Cuddly Plush Teddy Bear (30 cm)", bn: "তুলতুলে টেডি বিয়ার (৩০ সেমি)", price: 890,
    ages: ["1-3y", "3-5y"], art: "teddy", color: "peach", gift: 1, featured: 1,
    materialEn: "Plush fabric, polyester fibre filling; embroidered eyes", materialBn: "প্লাশ কাপড়, পলিয়েস্টার ফাইবার; সেলাই করা চোখ", careEn: "Surface wash with mild soap. Air dry.", careBn: "হালকা সাবানে উপর থেকে পরিষ্কার করুন। বাতাসে শুকান।",
    descEn: "A huggable bedtime friend with stitched (not button) eyes.", descBn: "ঘুমের সঙ্গী — চোখ সেলাই করা, বোতাম নয়।",
    variants: [{ size: "30 cm", age: null, color: "Honey", stock: 9 }, { size: "30 cm", age: null, color: "Cream", stock: 0 }],
  },
  {
    slug: "wooden-stacking-rings", cat: "learning-toys", brand: "PlayJoy", en: "Wooden Stacking Rings", bn: "কাঠের স্ট্যাকিং রিং", price: 690,
    ages: ["6-12m", "1-3y"], art: "rings", color: "lavender", gift: 1,
    materialEn: "Wood with water-based paint", materialBn: "পানিভিত্তিক রঙের কাঠ", careEn: "Wipe with a damp cloth. Do not soak.", careBn: "ভেজা কাপড়ে মুছে নিন। পানিতে ভিজিয়ে রাখবেন না।",
    descEn: "Seven colourful rings for stacking, sorting and learning colours.", descBn: "সাতটি রঙিন রিং — সাজানো, বাছাই ও রং চেনা।",
    variants: [{ size: "Standard", age: null, color: "Rainbow", stock: 7 }],
  },
  {
    slug: "musical-activity-cube", cat: "learning-toys", brand: "PlayJoy", en: "Musical Activity Cube", bn: "মিউজিক্যাল অ্যাক্টিভিটি কিউব", price: 1490, sale: 1350,
    ages: ["1-3y"], art: "cube", color: "yellow", gift: 1,
    materialEn: "Plastic; uses 3 × AA batteries (included)", materialBn: "প্লাস্টিক; ৩টি AA ব্যাটারি (সাথে দেওয়া)", careEn: "Wipe clean. Keep the battery cover screwed shut.", careBn: "মুছে পরিষ্কার করুন। ব্যাটারির ঢাকনা স্ক্রু দিয়ে বন্ধ রাখুন।",
    descEn: "Five sides of buttons, gears and songs to keep curious toddlers busy.", descBn: "পাঁচ দিকে বোতাম, গিয়ার ও গান — কৌতূহলী শিশুর জন্য।",
    variants: [{ size: "Standard", age: null, color: "", stock: 4 }],
  },
  {
    slug: "bangla-english-alphabet-mat", cat: "learning-toys", brand: "PlayJoy", en: "Bangla & English Alphabet Puzzle Mat", bn: "বাংলা ও ইংরেজি বর্ণমালা পাজল ম্যাট", price: 1250,
    ages: ["1-3y", "3-5y"], art: "puzzle", color: "mint", gift: 1,
    materialEn: "EVA foam tiles, 30 × 30 cm each", materialBn: "EVA ফোম টাইল, প্রতিটি ৩০ × ৩০ সেমি", careEn: "Wipe with a damp cloth.", careBn: "ভেজা কাপড়ে মুছে নিন।",
    descEn: "Soft floor tiles with অ–ঔ and A–Z letters — a play mat and first alphabet in one.", descBn: "অ–ঔ ও A–Z বর্ণের নরম টাইল — খেলার ম্যাট আর প্রথম বর্ণমালা একসাথে।",
    variants: [{ size: "36 tiles", age: null, color: "Multicolour", stock: 10 }],
  },
  {
    slug: "crib-mosquito-net", cat: "nursery-bedding", brand: "SnugNest", en: "Foldable Baby Mosquito Net", bn: "ভাঁজ করা যায় এমন বেবি মশারি", price: 1350,
    ages: ["0-6m", "6-12m", "1-3y"], art: "net", color: "sky",
    materialEn: "Polyester mesh with a padded mattress base", materialBn: "প্যাডেড বেসসহ পলিয়েস্টার জাল", careEn: "Hand wash the net. Fold flat to store.", careBn: "জাল হাতে ধুয়ে নিন। ভাঁজ করে রাখুন।",
    descEn: "Pops up in seconds for naps at home or at nanu-bari.", descBn: "কয়েক সেকেন্ডে খুলে যায় — বাসায় বা নানুবাড়িতে ঘুমের জন্য।",
    variants: [{ size: "Standard", age: null, color: "Blue", stock: 6 }, { size: "Standard", age: null, color: "Pink", stock: 5 }],
  },
  {
    slug: "cotton-crib-bedding-set", cat: "nursery-bedding", brand: "SnugNest", en: "Cotton Crib Bedding Set (4 pieces)", bn: "সুতির ক্রিব বেডিং সেট (৪ পিস)", price: 2200, sale: 1990,
    ages: ["0-6m", "6-12m"], art: "bedding", color: "lavender",
    materialEn: "Cotton percale", materialBn: "সুতি পারকেল", careEn: "Machine wash warm. Tumble dry low.", careBn: "কুসুম গরম পানিতে ধোয়া যাবে।",
    descEn: "Fitted sheet, quilt, pillow and bumper in a calm cloud print.", descBn: "ফিটেড চাদর, কাঁথা, বালিশ ও বাম্পার — মেঘের নকশায়।",
    variants: [{ size: "Standard crib", age: null, color: "Clouds", stock: 3 }],
  },
  {
    slug: "baby-bath-tub", cat: "bath-skincare", brand: "TinyBloom", en: "Baby Bath Tub with Newborn Support", bn: "নবজাতকের সাপোর্টসহ বেবি বাথটাব", price: 1650,
    ages: ["0-6m", "6-12m"], art: "tub", color: "sky",
    materialEn: "Plastic tub, removable fabric sling", materialBn: "প্লাস্টিক টাব, খোলা যায় এমন কাপড়ের সাপোর্ট", careEn: "Rinse and dry after each bath.", careBn: "প্রতিবার গোসলের পর ধুয়ে শুকিয়ে নিন।",
    descEn: "A snug sling for newborns, then a roomy tub as they grow. Always stay within arm's reach.", descBn: "নবজাতকের জন্য সাপোর্ট, বড় হলে বড় টাব। গোসলের সময় সবসময় পাশে থাকুন।",
    variants: [{ size: "Standard", age: null, color: "Aqua", stock: 5 }],
  },
  {
    slug: "gentle-baby-shampoo", cat: "bath-skincare", brand: "TinyBloom", en: "Gentle Baby Shampoo 200 ml", bn: "কোমল বেবি শ্যাম্পু ২০০ মি.লি.", price: 420,
    ages: ["0-6m", "6-12m", "1-3y", "3-5y"], art: "shampoo", color: "yellow", consumable: 1, reorder: 30,
    materialEn: "Mild cleanser. See the pack for the full ingredient list.", materialBn: "হালকা ক্লিনজার। সম্পূর্ণ উপাদান প্যাকে দেখুন।", careEn: "For external use. Avoid contact with eyes; rinse with water if needed.", careBn: "শুধু বাহ্যিক ব্যবহারের জন্য। চোখে লাগলে পানি দিয়ে ধুয়ে ফেলুন।",
    descEn: "A mild everyday shampoo for little heads.", descBn: "ছোট্ট মাথার জন্য প্রতিদিনের হালকা শ্যাম্পু।",
    variants: [{ size: "200 ml", age: null, color: "", stock: 30 }],
  },
  {
    slug: "hooded-bath-towel", cat: "bath-skincare", brand: "TinyBloom", en: "Hooded Bath Towel", bn: "হুডওয়ালা বাথ টাওয়েল", price: 590,
    ages: ["0-6m", "6-12m", "1-3y"], art: "towel", color: "peach", gift: 1,
    materialEn: "Cotton terry, 75 × 75 cm", materialBn: "সুতি টেরি, ৭৫ × ৭৫ সেমি", careEn: "Machine wash warm.", careBn: "কুসুম গরম পানিতে ধোয়া যাবে।",
    descEn: "A soft hooded towel with bunny ears for warm, snuggly after-bath hugs.", descBn: "খরগোশের কানওয়ালা নরম টাওয়েল — গোসলের পর উষ্ণ জড়িয়ে ধরা।",
    variants: [{ size: "Standard", age: null, color: "Peach", stock: 8 }, { size: "Standard", age: null, color: "Mint", stock: 8 }],
  },
  {
    slug: "welcome-baby-hamper", cat: "gift-sets", brand: "Zamil Kids", en: "Welcome Baby Gift Hamper", bn: "ওয়েলকাম বেবি গিফট হ্যাম্পার", price: 3490, sale: 3190,
    ages: ["0-6m"], art: "hamper", color: "pink", gift: 1, featured: 1,
    materialEn: "Romper, swaddle, hooded towel, soft rattle, gift box and card", materialBn: "রম্পার, সোয়াডল, হুডওয়ালা টাওয়েল, নরম ঝুনঝুনি, গিফট বক্স ও কার্ড", careEn: "See each item's label.", careBn: "প্রতিটি জিনিসের লেবেল দেখুন।",
    descEn: "A ready-to-give hamper for baby showers and aqiqah, with a handwritten card.", descBn: "বেবি শাওয়ার ও আকিকার জন্য তৈরি উপহার, সাথে হাতে লেখা কার্ড।",
    variants: [{ size: "Standard", age: "0-6m", color: "", stock: 5 }],
  },
  {
    slug: "first-birthday-gift-box", cat: "gift-sets", brand: "Zamil Kids", en: "First Birthday Gift Box", bn: "প্রথম জন্মদিনের গিফট বক্স", price: 2490,
    ages: ["6-12m", "1-3y"], art: "giftbox", color: "yellow", gift: 1,
    materialEn: "Stacking rings, bib, party outfit and a keepsake card", materialBn: "স্ট্যাকিং রিং, বিব, পার্টি পোশাক ও স্মারক কার্ড", careEn: "See each item's label.", careBn: "প্রতিটি জিনিসের লেবেল দেখুন।",
    descEn: "Everything for the big day number one, wrapped and ready.", descBn: "প্রথম জন্মদিনের সবকিছু, মোড়ানো ও প্রস্তুত।",
    variants: [{ size: "12–18 M", age: "1-3y", color: "", stock: 4 }],
  },
];

export const banners = [
  {
    placement: "hero", titleEn: "Little joys, safely delivered", titleBn: "ছোট্ট সোনামণির আনন্দ, নিরাপদে পৌঁছে দিই",
    subEn: "Clothes, toys, feeding and nursery essentials for 0–5 years. Cash on Delivery across Bangladesh.", subBn: "০–৫ বছরের পোশাক, খেলনা, ফিডিং ও নার্সারির প্রয়োজনীয় জিনিস। সারা দেশে ক্যাশ অন ডেলিভারি।",
    ctaEn: "Shop by age", ctaBn: "বয়স অনুযায়ী কিনুন", link: "/shop", color: "yellow", sort: 1, image: "/img/products/plush-teddy-bear.svg",
  },
  {
    placement: "hero", titleEn: "Gifts they'll actually use", titleBn: "কাজের উপহার, মনের মতো",
    subEn: "Baby shower, aqiqah or first birthday — try our gift finder.", subBn: "বেবি শাওয়ার, আকিকা বা প্রথম জন্মদিন — গিফট ফাইন্ডার দেখুন।",
    ctaEn: "Find a gift", ctaBn: "উপহার খুঁজুন", link: "/gift-finder", color: "lavender", sort: 2, image: "/img/products/welcome-baby-hamper.svg",
  },
];

export const coupons = [{ code: "WELCOME100", description: "৳100 off a first order over ৳1,500 (sample — edit or delete)", type: "flat", value: 100, min: 1500, perCustomer: 1 }];

export const landingPages = [
  {
    slug: "diaper-deal", titleEn: "Diaper Pants — stock up & save", titleBn: "ডায়াপার প্যান্ট — একসাথে নিন, সাশ্রয় করুন",
    subEn: "Soft, stretchy pull-ups. Cash on Delivery, fast delivery in Dhaka.", subBn: "নরম, ইলাস্টিক প্যান্ট ডায়াপার। ক্যাশ অন ডেলিভারি, ঢাকায় দ্রুত ডেলিভারি।",
    offerEn: "Free delivery inside Dhaka on orders over ৳2,000", offerBn: "ঢাকার ভেতরে ৳২,০০০+ অর্ডারে ফ্রি ডেলিভারি", product: "diaper-pants", color: "sky",
  },
];
