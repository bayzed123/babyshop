// Bilingual strings (Bangla default, English toggle). Plain, friendly language throughout.
const STR = {
  bn: {
    skipToContent: "মূল অংশে যান", search: "খুঁজুন", searchPlaceholder: "রম্পার, ডায়াপার, খেলনা…", account: "অ্যাকাউন্ট", wishlist: "পছন্দের তালিকা", cart: "কার্ট",
    home: "হোম", shop: "শপ", about: "আমাদের কথা", contact: "যোগাযোগ", giftFinder: "গিফট ফাইন্ডার", track: "অর্ডার ট্র্যাক", registry: "গিফট রেজিস্ট্রি",
    shopByCategory: "ক্যাটাগরি অনুযায়ী কিনুন", shopByAge: "বয়স অনুযায়ী কিনুন", newArrivals: "নতুন এসেছে", bestSellers: "সবচেয়ে বেশি বিক্রি", viewAll: "সব দেখুন",
    giftingGuide: "উপহার গাইড", giftingGuideSub: "বেবি শাওয়ার, আকিকা বা জন্মদিন — বয়স বেছে নিন, আমরা সাজিয়ে দিচ্ছি।", findGift: "উপহার খুঁজুন",
    happyParents: "বাবা-মায়েরা যা বলছেন", noReviewsYet: "প্রথম রিভিউ আপনিই দিন — কেনার পর অর্ডার পেজ থেকে রিভিউ লিখতে পারবেন।",
    newsletter: "অফার ও নতুন পণ্যের খবর পান", newsletterSub: "মাসে ১–২টি মেসেজ, স্প্যাম নয়।", subscribe: "সাবস্ক্রাইব", emailOrPhone: "ইমেইল বা মোবাইল নম্বর",
    footerAbout: "সোনামণির জন্য নিরাপদ ও আরামদায়ক জিনিস — বাছাই করা, যত্ন করে প্যাক করা, সারা দেশে ক্যাশ অন ডেলিভারি।", policies: "নীতিমালা", visitUs: "আমাদের ঠিকানা",
    returnsPolicy: "রিটার্ন ও রিফান্ড", deliveryPolicy: "ডেলিভারি", privacyPolicy: "গোপনীয়তা", sizeGuidePage: "সাইজ গাইড", weAccept: "যেভাবে পেমেন্ট করবেন",
    chatWhatsApp: "হোয়াটসঅ্যাপে চ্যাট", callUs: "কল করুন",
    filters: "ফিল্টার", clearAll: "সব মুছুন", ageRange: "বয়স", category: "ক্যাটাগরি", brand: "ব্র্যান্ড", price: "দাম", min: "সর্বনিম্ন", max: "সর্বোচ্চ", apply: "প্রয়োগ করুন",
    inStockOnly: "শুধু স্টকে আছে", onSale: "ছাড়ে", sortBy: "সাজান", sort_newest: "নতুন আগে", sort_price_asc: "দাম: কম থেকে বেশি", sort_price_desc: "দাম: বেশি থেকে কম", sort_popular: "জনপ্রিয়", sort_rating: "রেটিং",
    results: "{n}টি পণ্য", noResults: "কিছু পাওয়া যায়নি", noResultsSub: "ফিল্টার কমিয়ে বা অন্য শব্দে খুঁজে দেখুন।", loadMore: "আরও দেখুন", searchResultsFor: "“{q}” এর ফলাফল",
    addToCart: "কার্টে যোগ করুন", buyNow: "এখনই কিনুন", added: "কার্টে যোগ হয়েছে", outOfStock: "স্টক শেষ", inStock: "স্টকে আছে", onlyLeft: "মাত্র {n}টি বাকি", chooseOption: "একটি অপশন বেছে নিন",
    size: "সাইজ", color: "রং", qty: "পরিমাণ", material: "উপাদান", care: "যত্নের নিয়ম", description: "বিবরণ", reviews: "রিভিউ", writeReview: "রিভিউ লিখুন", relatedProducts: "এ ধরনের আরও", completeTheSet: "সাথে নিতে পারেন",
    sizeChart: "সাইজ চার্ট", certified: "যাচাইকৃত সার্টিফিকেশন", certNote: "শুধু ডকুমেন্টসহ প্রকৃত সার্টিফিকেশন দেখানো হয়।", validUntil: "মেয়াদ", issuer: "প্রদানকারী",
    notifyMe: "স্টকে এলে জানান", notifyMeSub: "মোবাইল নম্বর দিন — স্টকে এলেই SMS পাবেন।", notifyDone: "স্টকে এলেই আপনাকে জানাবো।", addToRegistry: "রেজিস্ট্রিতে যোগ করুন", share: "শেয়ার",
    ages: "বয়স", allAges: "সব বয়স", codAvailable: "ক্যাশ অন ডেলিভারি", deliveryIn: "ডেলিভারি {eta}", easyReturns: "৭ দিনে সহজ রিটার্ন",
    yourCart: "আপনার কার্ট", cartEmpty: "কার্ট খালি। চলুন কিছু সুন্দর জিনিস খুঁজি!", continueShopping: "কেনাকাটা চালিয়ে যান", subtotal: "সাবটোটাল", discount: "ছাড়", delivery: "ডেলিভারি চার্জ", total: "মোট", vat: "ভ্যাট", vatIncluded: "ভ্যাট ({rate}%) অন্তর্ভুক্ত",
    free: "ফ্রি", freeDelivery: "ফ্রি ডেলিভারি", deliveryAuto: "ডেলিভারি চার্জ আপনার এলাকা অনুযায়ী চেকআউটে অটো হিসাব হবে", deliveryAtCheckout: "এলাকা বেছে নিলে হিসাব হবে", freeDeliveryCoupon: "কুপন", freeDeliveryItems: "এই পণ্যগুলোতে", popupClose: "বন্ধ করুন", proceedCheckout: "চেকআউট করুন", viewCart: "কার্ট দেখুন", remove: "সরান", coupon: "কুপন বা রেফারেল কোড", applyCoupon: "প্রয়োগ", couponApplied: "কোড প্রয়োগ হয়েছে", freeOver: "৳{n}+ অর্ডারে ফ্রি ডেলিভারি",
    checkout: "চেকআউট", contactDetails: "আপনার তথ্য", fullName: "পুরো নাম", mobile: "মোবাইল নম্বর", email: "ইমেইল (ঐচ্ছিক)", deliveryAddress: "ডেলিভারি ঠিকানা",
    division: "বিভাগ", district: "জেলা", upazila: "উপজেলা / থানা", area: "বাড়ি, রোড, এলাকা", areaHint: "যেমন: বাড়ি ১২, রোড ৩, সেকশন ১০", quickArea: "পোস্টকোড বা এলাকার নাম দিয়ে খুঁজুন", noAreaMatch: "মিল পাওয়া যায়নি", choose: "বেছে নিন",
    payment: "পেমেন্ট", cod: "ক্যাশ অন ডেলিভারি", codSub: "পণ্য হাতে পেয়ে টাকা দিন", card: "কার্ড (ভিসা/মাস্টারকার্ড)", cardSub: "নিরাপদ SSLCommerz পেজে", mfsSend: "{method} ({type}) নম্বরে ৳{total} Send Money করুন: {number}", trxId: "ট্রানজেকশন আইডি (TrxID)", payOnPage: "পরের ধাপে {method} পেজে পেমেন্ট করবেন",
    orderNote: "বিশেষ নির্দেশনা (ঐচ্ছিক)", giftMessage: "উপহার বার্তা (ঐচ্ছিক)", reminderOptIn: "ডায়াপার/ওয়াইপস শেষ হওয়ার আগে আমাকে মনে করিয়ে দিন (SMS)", placeOrder: "অর্ডার করুন", placing: "অর্ডার হচ্ছে…",
    verifyPhone: "মোবাইল নম্বর যাচাই", sendCode: "কোড পাঠান", resend: "আবার পাঠান", enterCode: "৬ সংখ্যার কোড", verify: "যাচাই করুন", verified: "যাচাই হয়েছে ✓", verifyWhy: "ভুয়া অর্ডার ঠেকাতে ক্যাশ অন ডেলিভারির আগে নম্বর যাচাই করা হয়।", skipOtp: "SMS আসছে না? আমরা কল করে কনফার্ম করবো।",
    orderSummary: "অর্ডার সারাংশ", secureCheckout: "আপনার তথ্য নিরাপদ। কার্ডের তথ্য আমরা কখনো দেখি না।", registryShipNote: "এই উপহার সরাসরি বাবা-মায়ের ঠিকানায় যাবে।",
    thankYou: "ধন্যবাদ! অর্ডারটি পেয়েছি", orderNumber: "অর্ডার নম্বর", invoice: "ইনভয়েস", downloadInvoice: "ইনভয়েস ডাউনলোড (PDF)", weWillCall: "অর্ডার কনফার্ম করতে আমরা শীঘ্রই আপনাকে কল করবো।", confirmedAuto: "আপনার অর্ডার কনফার্ম হয়েছে!",
    orderStatus: "অর্ডারের অবস্থা", trackOrder: "অর্ডার ট্র্যাক করুন", trackSub: "অর্ডার নম্বর ও মোবাইল নম্বর দিন", find: "খুঁজুন", courier: "কুরিয়ার", trackingId: "ট্র্যাকিং আইডি", trackWithCourier: "কুরিয়ারের সাইটে দেখুন",
    requestReturn: "রিটার্নের অনুরোধ", returnReason: "কারণ", reason_wrong_size: "সাইজ মেলেনি", reason_damaged: "ক্ষতিগ্রস্ত পণ্য", reason_wrong_item: "ভুল পণ্য এসেছে", reason_not_as_described: "বিবরণের সাথে মেলেনি", reason_changed_mind: "মত বদলেছি", reason_other: "অন্য কারণ", details: "বিস্তারিত", send: "পাঠান",
    rateProduct: "রেটিং দিন", yourReview: "আপনার অভিজ্ঞতা", yourName: "আপনার নাম", reviewThanks: "ধন্যবাদ! যাচাইয়ের পর রিভিউ দেখানো হবে।", verifiedPurchase: "যাচাইকৃত ক্রেতা",
    signIn: "সাইন ইন", register: "অ্যাকাউন্ট খুলুন", password: "পাসওয়ার্ড", forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?", signOut: "সাইন আউট", newHere: "নতুন? অ্যাকাউন্ট খুলুন", haveAccount: "অ্যাকাউন্ট আছে? সাইন ইন করুন", resetPassword: "পাসওয়ার্ড রিসেট", newPassword: "নতুন পাসওয়ার্ড", code: "কোড",
    myOrders: "আমার অর্ডার", addresses: "ঠিকানা", registries: "গিফট রেজিস্ট্রি", returns: "রিটার্ন", referral: "বন্ধুকে রেফার করুন", reminders: "রিমাইন্ডার", profile: "প্রোফাইল", save: "সংরক্ষণ", saved: "সংরক্ষণ হয়েছে", cancel: "বাতিল", delete: "মুছুন", edit: "এডিট", addNew: "নতুন যোগ করুন",
    noOrders: "এখনো কোনো অর্ডার নেই।", label: "লেবেল", recipient: "প্রাপকের নাম", makeDefault: "ডিফল্ট ঠিকানা", defaultTag: "ডিফল্ট",
    createRegistry: "রেজিস্ট্রি তৈরি করুন", registryTitle: "রেজিস্ট্রির নাম", eventType: "অনুষ্ঠান", event_baby_shower: "বেবি শাওয়ার", event_birthday: "জন্মদিন", event_aqiqah: "আকিকা", event_welcome_baby: "নতুন অতিথি", event_other: "অন্যান্য", eventDate: "তারিখ", babyName: "শিশুর নাম (ঐচ্ছিক)", message: "বার্তা", shipToMe: "উপহার আমার ঠিকানায় পাঠান", shareLink: "শেয়ার লিংক", copy: "কপি", copied: "কপি হয়েছে",
    registryEmpty: "শপ থেকে “রেজিস্ট্রিতে যোগ করুন” চাপুন।", wanted: "চাওয়া হয়েছে", bought: "কেনা হয়েছে", giftThis: "এটি উপহার দিন", registryClosed: "এই রেজিস্ট্রি বন্ধ।", fulfilled: "পূর্ণ হয়েছে",
    referralHeadline: "বন্ধুকে ৳{friend} ছাড় দিন, আপনি পান ৳{reward}", referralSub: "বন্ধুর প্রথম অর্ডার (৳{min}+) ডেলিভারি হলেই আপনার রিওয়ার্ড কোড SMS এ আসবে।", yourCode: "আপনার কোড", uses: "ব্যবহার", rewards: "রিওয়ার্ড",
    remindersSub: "ডায়াপার-ওয়াইপস শেষ হওয়ার আগে SMS রিমাইন্ডার।", remindersOn: "রিমাইন্ডার চালু", dueOn: "তারিখ",
    giftFinderTitle: "গিফট ফাইন্ডার", giftFinderSub: "বয়স আর বাজেট দিন — আমরা স্টকে থাকা মানানসই উপহার দেখাবো।", budget: "বাজেট (৳)", occasion: "উপলক্ষ", anythingElse: "আর কিছু জানাতে চান? (ঐচ্ছিক)", showGifts: "উপহার দেখুন",
    notFound: "পেজটি পাওয়া যায়নি", backHome: "হোমে ফিরে যান", somethingWrong: "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।", loading: "লোড হচ্ছে…", retry: "আবার চেষ্টা করুন",
    status_pending: "অপেক্ষমাণ", status_confirmation_attempted: "কনফার্মের অপেক্ষায়", status_confirmed: "কনফার্মড", status_packed: "প্যাক হয়েছে", status_shipped: "পাঠানো হয়েছে", status_delivered: "ডেলিভারি হয়েছে", status_cancelled: "বাতিল", status_refused: "ফেরত গেছে", status_returned: "রিটার্ন হয়েছে",
    pay_pending: "বাকি", pay_paid: "পরিশোধিত", pay_failed: "ব্যর্থ", pay_refunded: "ফেরত", pay_partially_refunded: "আংশিক ফেরত",
    installApp: "অ্যাপের মতো ব্যবহার করুন", enableUpdates: "অর্ডারের আপডেট নোটিফিকেশনে পান",
  },
  en: {
    skipToContent: "Skip to content", search: "Search", searchPlaceholder: "Rompers, diapers, toys…", account: "Account", wishlist: "Wishlist", cart: "Cart",
    home: "Home", shop: "Shop", about: "About us", contact: "Contact", giftFinder: "Gift finder", track: "Track order", registry: "Gift registry",
    shopByCategory: "Shop by category", shopByAge: "Shop by age", newArrivals: "New arrivals", bestSellers: "Best sellers", viewAll: "View all",
    giftingGuide: "Gifting guide", giftingGuideSub: "Baby shower, aqiqah or birthday — pick an age and we'll line up ideas.", findGift: "Find a gift",
    happyParents: "What parents say", noReviewsYet: "Be the first to review — after your order arrives you can write one from the order page.",
    newsletter: "Get offers & new arrivals", newsletterSub: "1–2 messages a month. No spam.", subscribe: "Subscribe", emailOrPhone: "Email or mobile number",
    footerAbout: "Safe, comfy things for little ones — hand-picked, packed with care, Cash on Delivery across Bangladesh.", policies: "Policies", visitUs: "Visit us",
    returnsPolicy: "Returns & refunds", deliveryPolicy: "Delivery", privacyPolicy: "Privacy", sizeGuidePage: "Size guide", weAccept: "Ways to pay",
    chatWhatsApp: "Chat on WhatsApp", callUs: "Call us",
    filters: "Filters", clearAll: "Clear all", ageRange: "Age", category: "Category", brand: "Brand", price: "Price", min: "Min", max: "Max", apply: "Apply",
    inStockOnly: "In stock only", onSale: "On sale", sortBy: "Sort", sort_newest: "Newest", sort_price_asc: "Price: low to high", sort_price_desc: "Price: high to low", sort_popular: "Popular", sort_rating: "Rating",
    results: "{n} products", noResults: "Nothing found", noResultsSub: "Try fewer filters or a different word.", loadMore: "Show more", searchResultsFor: "Results for “{q}”",
    addToCart: "Add to cart", buyNow: "Buy now", added: "Added to cart", outOfStock: "Out of stock", inStock: "In stock", onlyLeft: "Only {n} left", chooseOption: "Choose an option",
    size: "Size", color: "Colour", qty: "Quantity", material: "Material", care: "Care", description: "Description", reviews: "Reviews", writeReview: "Write a review", relatedProducts: "More like this", completeTheSet: "Complete the set",
    sizeChart: "Size chart", certified: "Verified certifications", certNote: "We only show certifications we hold documents for.", validUntil: "Valid until", issuer: "Issued by",
    notifyMe: "Notify me when back", notifyMeSub: "Leave your mobile number — we'll SMS you as soon as it's back.", notifyDone: "We'll let you know as soon as it's back.", addToRegistry: "Add to registry", share: "Share",
    ages: "Ages", allAges: "All ages", codAvailable: "Cash on Delivery", deliveryIn: "Delivery in {eta}", easyReturns: "Easy 7-day returns",
    yourCart: "Your cart", cartEmpty: "Your cart is empty. Let's find something lovely!", continueShopping: "Continue shopping", subtotal: "Subtotal", discount: "Discount", delivery: "Delivery", total: "Total", vat: "VAT", vatIncluded: "Includes VAT ({rate}%)",
    free: "Free", freeDelivery: "Free delivery", deliveryAuto: "Delivery charge is calculated automatically for your area at checkout", deliveryAtCheckout: "Calculated when you choose your area", freeDeliveryCoupon: "coupon", freeDeliveryItems: "on these items", popupClose: "Close", proceedCheckout: "Checkout", viewCart: "View cart", remove: "Remove", coupon: "Coupon or referral code", applyCoupon: "Apply", couponApplied: "Code applied", freeOver: "Free delivery over ৳{n}",
    checkout: "Checkout", contactDetails: "Your details", fullName: "Full name", mobile: "Mobile number", email: "Email (optional)", deliveryAddress: "Delivery address",
    division: "Division", district: "District", upazila: "Upazila / Thana", area: "House, road, area", areaHint: "e.g. House 12, Road 3, Section 10", quickArea: "Search by postcode or area name", noAreaMatch: "No match", choose: "Choose",
    payment: "Payment", cod: "Cash on Delivery", codSub: "Pay when it arrives", card: "Card (Visa/Mastercard)", cardSub: "On the secure SSLCommerz page", mfsSend: "Send Money ৳{total} to our {method} ({type}) number: {number}", trxId: "Transaction ID (TrxID)", payOnPage: "You'll pay on the {method} page next",
    orderNote: "Delivery instructions (optional)", giftMessage: "Gift message (optional)", reminderOptIn: "Remind me by SMS before my diapers/wipes run out", placeOrder: "Place order", placing: "Placing order…",
    verifyPhone: "Verify your mobile", sendCode: "Send code", resend: "Resend", enterCode: "6-digit code", verify: "Verify", verified: "Verified ✓", verifyWhy: "We verify numbers before Cash on Delivery to stop fake orders.", skipOtp: "No SMS? We'll call you to confirm instead.",
    orderSummary: "Order summary", secureCheckout: "Your details are safe. We never see card numbers.", registryShipNote: "This gift goes straight to the parents' address.",
    thankYou: "Thank you! We've got your order", orderNumber: "Order number", invoice: "Invoice", downloadInvoice: "Download invoice (PDF)", weWillCall: "We'll call you shortly to confirm your order.", confirmedAuto: "Your order is confirmed!",
    orderStatus: "Order status", trackOrder: "Track your order", trackSub: "Enter your order number and mobile number", find: "Find", courier: "Courier", trackingId: "Tracking ID", trackWithCourier: "Track on courier site",
    requestReturn: "Request a return", returnReason: "Reason", reason_wrong_size: "Wrong size", reason_damaged: "Damaged item", reason_wrong_item: "Wrong item sent", reason_not_as_described: "Not as described", reason_changed_mind: "Changed my mind", reason_other: "Other", details: "Details", send: "Send",
    rateProduct: "Your rating", yourReview: "Your experience", yourName: "Your name", reviewThanks: "Thank you! Your review will appear after a quick check.", verifiedPurchase: "Verified purchase",
    signIn: "Sign in", register: "Create account", password: "Password", forgotPassword: "Forgot password?", signOut: "Sign out", newHere: "New here? Create an account", haveAccount: "Have an account? Sign in", resetPassword: "Reset password", newPassword: "New password", code: "Code",
    myOrders: "My orders", addresses: "Addresses", registries: "Gift registries", returns: "Returns", referral: "Refer a friend", reminders: "Reminders", profile: "Profile", save: "Save", saved: "Saved", cancel: "Cancel", delete: "Delete", edit: "Edit", addNew: "Add new",
    noOrders: "No orders yet.", label: "Label", recipient: "Recipient name", makeDefault: "Default address", defaultTag: "Default",
    createRegistry: "Create a registry", registryTitle: "Registry name", eventType: "Occasion", event_baby_shower: "Baby shower", event_birthday: "Birthday", event_aqiqah: "Aqiqah", event_welcome_baby: "Welcome baby", event_other: "Other", eventDate: "Date", babyName: "Baby's name (optional)", message: "Message", shipToMe: "Ship gifts to my address", shareLink: "Share link", copy: "Copy", copied: "Copied",
    registryEmpty: "Tap “Add to registry” on any product.", wanted: "Wanted", bought: "Bought", giftThis: "Gift this", registryClosed: "This registry is closed.", fulfilled: "Fulfilled",
    referralHeadline: "Give a friend ৳{friend} off, get ৳{reward}", referralSub: "When your friend's first order (৳{min}+) is delivered, your reward code arrives by SMS.", yourCode: "Your code", uses: "Uses", rewards: "Rewards",
    remindersSub: "SMS reminders before your diapers and wipes run out.", remindersOn: "Reminders on", dueOn: "Due",
    giftFinderTitle: "Gift finder", giftFinderSub: "Tell us the age and budget — we'll show fitting gifts that are in stock.", budget: "Budget (৳)", occasion: "Occasion", anythingElse: "Anything else? (optional)", showGifts: "Show gifts",
    notFound: "Page not found", backHome: "Back to home", somethingWrong: "Something went wrong. Please try again.", loading: "Loading…", retry: "Try again",
    status_pending: "Pending", status_confirmation_attempted: "Awaiting confirmation", status_confirmed: "Confirmed", status_packed: "Packed", status_shipped: "Shipped", status_delivered: "Delivered", status_cancelled: "Cancelled", status_refused: "Returned to us", status_returned: "Returned",
    pay_pending: "Due", pay_paid: "Paid", pay_failed: "Failed", pay_refunded: "Refunded", pay_partially_refunded: "Partly refunded",
    installApp: "Use it like an app", enableUpdates: "Get order updates as notifications",
  },
};

const KEY = "zsb_lang";
export function lang() {
  try {
    const q = new URL(location.href).searchParams.get("lang");
    if (q === "en" || q === "bn") return q;
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "bn") return v;
  } catch { /* storage blocked */ }
  return document.documentElement.getAttribute("data-default-lang") === "en" ? "en" : "bn";
}
export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  document.cookie = `zsb_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = l;
}
export function t(key, vars = {}) {
  const s = STR[lang()][key] ?? STR.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}
/** Picks the bilingual field: L(product, "name") → product.name_bn / name_en. */
export const L = (obj, field) => (obj ? (lang() === "bn" ? obj[`${field}_bn`] || obj[`${field}_en`] : obj[`${field}_en`] || obj[`${field}_bn`]) ?? "" : "");
/** Picks from {en, bn}. */
export const tt = (o) => (o ? (lang() === "bn" ? o.bn || o.en : o.en || o.bn) : "");

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const digits = (s) => (lang() === "bn" ? String(s).replace(/\d/g, (d) => BN_DIGITS[d]) : String(s));
export const num = (n) => digits(Number(n ?? 0).toLocaleString("en-IN"));
export const money = (n) => `৳${num(n)}`;
export const date = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(lang() === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Applies data-i18n / data-i18n-placeholder / data-i18n-label attributes in static HTML. */
export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder)));
  root.querySelectorAll("[data-i18n-label]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
}
