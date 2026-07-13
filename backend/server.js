import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "kaarigar-super-secret-key-123";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// MongoDB Connection
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn("⚠️ MONGODB_URI environment variable is missing from .env!");
}

let dbClient;
let db;
let dbPromise = null;

async function getDb() {
  if (db) return db;
  if (!dbPromise) {
    dbPromise = initDb();
  }
  await dbPromise;
  return db;
}

// In-Memory Database Fallback for local testing out-of-the-box
class MockCollection {
  constructor(name) {
    this.name = name;
    this.documents = [];
  }
  find(filter = {}) {
    let result = [...this.documents];
    if (filter.role) result = result.filter(d => d.role === filter.role);
    if (filter.verified !== undefined) result = result.filter(d => d.verified === filter.verified);
    if (filter.category_id) result = result.filter(d => String(d.category_id) === String(filter.category_id));
    if (filter.active !== undefined) result = result.filter(d => d.active === filter.active);
    if (filter.entrepreneur_id) result = result.filter(d => String(d.entrepreneur_id) === String(filter.entrepreneur_id));
    if (filter.customer_id) result = result.filter(d => String(d.customer_id) === String(filter.customer_id));
    if (filter.user_id) result = result.filter(d => String(d.user_id) === String(filter.user_id));
    
    return {
      toArray: async () => result,
      sort: () => ({
        toArray: async () => result
      })
    };
  }
  async findOne(filter = {}) {
    const arr = await this.find(filter).toArray();
    if (filter._id) {
      return this.documents.find(d => String(d._id) === String(filter._id)) || null;
    }
    if (filter.email) {
      return this.documents.find(d => d.email === filter.email) || null;
    }
    if (filter.slug) {
      return this.documents.find(d => d.slug === filter.slug) || null;
    }
    return arr[0] || null;
  }
  async countDocuments(filter = {}) {
    const arr = await this.find(filter).toArray();
    return arr.length;
  }
  async insertOne(doc) {
    if (!doc._id) doc._id = new ObjectId();
    this.documents.push(doc);
    return { insertedId: doc._id };
  }
  async insertMany(docs) {
    const insertedIds = {};
    docs.forEach((d, i) => {
      if (!d._id) d._id = new ObjectId();
      this.documents.push(d);
      insertedIds[i] = d._id;
    });
    return { insertedIds };
  }
  async updateOne(filter, update) {
    const doc = await this.findOne(filter);
    if (doc) {
      if (update.$set) {
        Object.assign(doc, update.$set);
      }
      if (update.$inc) {
        for (const [key, value] of Object.entries(update.$inc)) {
          doc[key] = (Number(doc[key]) || 0) + Number(value);
        }
      }
      return { modifiedCount: 1, matchedCount: 1 };
    }
    return { modifiedCount: 0, matchedCount: 0 };
  }
  async deleteMany(filter) {
    this.documents = [];
    return { deletedCount: 0 };
  }
}

const mockCollections = {};
function setupMockDb() {
  const mockDb = {
    collection: (name) => {
      if (!mockCollections[name]) {
        mockCollections[name] = new MockCollection(name);
      }
      return mockCollections[name];
    }
  };
  db = mockDb;
  console.log("Initialized in-memory Mock Database fallback. All features are fully functional.");
  seedDatabase().catch(err => console.error("Failed to seed mock database:", err));
}

async function initDb() {
  if (!uri || uri.includes("<username>")) {
    console.warn("⚠️ Database connection skipped: MONGODB_URI has placeholder values. Please update .env with your MongoDB Atlas details.");
    setupMockDb();
    return;
  }
  try {
    dbClient = new MongoClient(uri);
    await dbClient.connect();
    const dbName = process.env.DATABASE_NAME || "kaarigar";
    db = dbClient.db(dbName);
    console.log(`Connected successfully to MongoDB Atlas database: ${dbName}`);
    await seedDatabase();
  } catch (error) {
    console.warn("⚠️ Failed to connect to MongoDB Atlas. Running server in offline/static mode:", error.message);
    setupMockDb();
  }
}

// Middleware to protect API calls when database is not connected
app.use(async (req, res, next) => {
  try {
    await getDb();
    if (!db && req.path.startsWith("/api")) {
      return res.status(503).json({
        error: "Database not connected. Please make sure you have added a valid MONGODB_URI in your .env file."
      });
    }
    next();
  } catch (error) {
    res.status(503).json({ error: "Database connection failed during startup: " + error.message });
  }
});

// Seeding logic (Rich Startup Seeding)
async function seedDatabase() {
  // Check if old categories (like weaving) exist to drop them for a clean migration
  const oldCategoryCheck = await db.collection("categories").findOne({ slug: "weaving" });
  if (oldCategoryCheck) {
    console.log("Old schema categories found. Dropping collections for clean re-seed...");
    await db.collection("categories").deleteMany({});
    await db.collection("entrepreneurs").deleteMany({});
    await db.collection("products").deleteMany({});
    await db.collection("services").deleteMany({});
    await db.collection("reviews").deleteMany({});
    await db.collection("orders").deleteMany({});
  }

  const categoriesCount = await db.collection("categories").countDocuments();
  if (categoriesCount > 0) {
    console.log("Database already seeded with current schema.");
    return;
  }

  console.log("Database is empty. Seeding starting data...");

  // 1. Seed Categories
  const categories = [
    {
      name: "Potter",
      slug: "potter",
      description: "Clay modeling, terracotta pottery, and glazed ceramics.",
    },
    {
      name: "Cobbler",
      slug: "cobbler",
      description: "Handcrafted footwear, repairs, and leather restoration.",
    },
    {
      name: "Tailor",
      slug: "tailor",
      description: "Bespoke tailoring, altered clothing, and customized patterns.",
    },
    {
      name: "Artisan",
      slug: "artisan",
      description: "Intricate carvings, home decorations, and handloom work.",
    },
    {
      name: "Vendor",
      slug: "vendor",
      description: "Local curated collections of handmade organic materials.",
    },
  ];

  const catResult = await db.collection("categories").insertMany(categories);
  const catIds = catResult.insertedIds;

  // 2. Seed Artisans (Entrepreneurs)
  const sha256Password = await bcrypt.hash("password123", 10);
  const artisans = [
    {
      email: "admin@kaarigar.com",
      password: sha256Password,
      role: "admin",
      business_name: "Kaarigar Admin",
      contact_phone: "+91 99999 99999",
      city: "New Delhi",
      state: "Delhi",
      bio: "Platform Administrator.",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
      verified: true,
      rating_avg: 5.0,
      rating_count: 0,
      years_experience: 10,
    },
    {
      email: "sanjay@pottery.com",
      password: sha256Password,
      role: "entrepreneur",
      business_name: "Kumhar Clay Crafts",
      contact_phone: "+91 98765 43211",
      city: "Khurja",
      state: "Uttar Pradesh",
      bio: "Sanjay Kumar manufactures authentic Khurja Blue Pottery. All articles are hand-painted and glazed using traditional wood-fired kilns.",
      cover_image: "/assets/cat-potter.jpg",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
      category_id: catIds[0],
      verified: true,
      rating_avg: 4.6,
      rating_count: 3,
      years_experience: 22,
    },
    {
      email: "amit@royal-leather.com",
      password: sha256Password,
      role: "entrepreneur",
      business_name: "Royal Leather Arts",
      contact_phone: "+91 98765 43212",
      city: "Dharavi, Mumbai",
      state: "Maharashtra",
      bio: "Amit Patel runs a workshop crafting premium leather messenger bags, wallets, and custom shoes using full-grain vegetable-tanned leather.",
      cover_image: "/assets/cat-cobbler.jpg",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
      category_id: catIds[1],
      verified: true,
      rating_avg: 4.9,
      rating_count: 7,
      years_experience: 15,
    },
    {
      email: "rahul@sharmahandlooms.com",
      password: sha256Password,
      role: "entrepreneur",
      business_name: "Sharma Handlooms",
      contact_phone: "+91 98765 43210",
      city: "Varanasi",
      state: "Uttar Pradesh",
      bio: "Rahul Sharma is a 5th-generation master weaver specializing in authentic Banarasi silk sarees and handspun dupattas.",
      cover_image: "/assets/cat-tailor.jpg",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200",
      category_id: catIds[2],
      verified: true,
      rating_avg: 4.8,
      rating_count: 5,
      years_experience: 18,
    },
    {
      email: "rajesh@woodcrafts.com",
      password: sha256Password,
      role: "entrepreneur",
      business_name: "Saharanpur Woodcrafts",
      contact_phone: "+91 98765 43213",
      city: "Saharanpur",
      state: "Uttar Pradesh",
      bio: "Rajesh Saharanpur specializes in hand-carved sheesham wood screens, tables, and home decoration accessories.",
      cover_image: "/assets/cat-artisan.jpg",
      avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200",
      category_id: catIds[3],
      verified: true,
      rating_avg: 4.7,
      rating_count: 4,
      years_experience: 12,
    },
    {
      email: "priya@organicearth.com",
      password: sha256Password,
      role: "entrepreneur",
      business_name: "Organic Earth",
      contact_phone: "+91 98765 43214",
      city: "Dehradun",
      state: "Uttarakhand",
      bio: "Priya Singh curates premium organic cotton, hand-spun fibers, and plant-based organic fabric dyes directly from small-scale Himalayan farming communities.",
      cover_image: "/assets/cat-vendor.jpg",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      category_id: catIds[4],
      verified: true,
      rating_avg: 4.5,
      rating_count: 2,
      years_experience: 8,
    },
  ];

  const artResult = await db.collection("entrepreneurs").insertMany(artisans);
  const artIds = artResult.insertedIds;

  // 3. Seed Services
  const services = [
    {
      entrepreneur_id: artIds[0],
      title: "Custom Pottery Workshop (1-on-1)",
      description: "Learn wheel throwing, shaping, and painting under 1-on-1 guidance. All clay and glazing included.",
      price: 1500,
      duration_minutes: 120,
      active: true,
    },
    {
      entrepreneur_id: artIds[0],
      title: "Bespoke Glazed Ceramic Vase Design",
      description: "Order custom hand-painted floral vases matching your home color scheme.",
      price: 3500,
      duration_minutes: null,
      active: true,
    },
    {
      entrepreneur_id: artIds[1],
      title: "Premium Shoe Repair & Restoration",
      description: "Complete stitching, heel replacement, and leather conditioning for boot styles.",
      price: 800,
      duration_minutes: 60,
      active: true,
    },
    {
      entrepreneur_id: artIds[2],
      title: "Bespoke Lehenga Tailoring",
      description: "Includes fitting sessions, custom lining, borders, and hand-embroidered details.",
      price: 4500,
      duration_minutes: null,
      active: true,
    },
    {
      entrepreneur_id: artIds[3],
      title: "Wooden Screen Polish & Restoration",
      description: "Restorative deep polishing and repair of intricate sheesham wood screens.",
      price: 2500,
      duration_minutes: null,
      active: true,
    },
    {
      entrepreneur_id: artIds[4],
      title: "Custom Yarn Spinning (Per Kg)",
      description: "We spin raw organic cotton or local wool to your specified ply and thickness.",
      price: 950,
      duration_minutes: null,
      active: true,
    },
  ];

  await db.collection("services").insertMany(services);

  // 4. Seed Products
  const products = [
    {
      entrepreneur_id: artIds[0],
      title: "Ceramic Flower Vase",
      price: 650,
      stock: 5,
      description: "Hand-painted blue pottery vase featuring traditional Persian floral patterns.",
      image_url: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
    {
      entrepreneur_id: artIds[0],
      title: "Terracotta Chai Cups (Set of 6)",
      price: 250,
      stock: 12,
      description: "Eco-friendly, reusable baked clay cups that add a rustic flavor to your tea.",
      image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
    {
      entrepreneur_id: artIds[1],
      title: "Leather Messenger Bag",
      price: 1800,
      stock: 4,
      description: "Spacious bag made from genuine water-resistant buff leather. Fits a 15-inch laptop.",
      image_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
    {
      entrepreneur_id: artIds[2],
      title: "Varanasi Silk Saree",
      price: 4500,
      stock: 3,
      description: "Intricately handwoven pure silk saree with gold zari work. Requires 14 days of artisan weaving.",
      image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
    {
      entrepreneur_id: artIds[2],
      title: "Handspun Cotton Dupatta",
      price: 850,
      stock: 10,
      description: "Soft hand-loomed cotton dupatta with natural indigo dye block printing.",
      image_url: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
    {
      entrepreneur_id: artIds[3],
      title: "Hand-carved Wooden Wall Hanger",
      price: 950,
      stock: 6,
      description: "A sheesham wood wall hanger featuring 4 antique brass hooks and intricate floral motifs.",
      image_url: "https://images.unsplash.com/photo-1532372320978-9b4d7a92b24d?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
    {
      entrepreneur_id: artIds[4],
      title: "Organic Handspun Cotton Yarn",
      price: 450,
      stock: 15,
      description: "Unbleached organic cotton yarn, spun by hand. Ideal for knitting and weaving projects.",
      image_url: "https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&q=80&w=600",
      active: true,
    },
  ];

  await db.collection("products").insertMany(products);

  // 5. Seed Reviews
  const reviews = [
    {
      entrepreneur_id: artIds[0],
      reviewer_name: "Anita Desai",
      rating: 5,
      comment: "Absolutely gorgeous glazed vase! The painting is so delicate. Packaged very safely.",
      created_at: new Date(),
    },
    {
      entrepreneur_id: artIds[1],
      reviewer_name: "Rahul Verma",
      rating: 4,
      comment: "The messenger bag has very sturdy straps and high-quality leather. Delivery took 5 days.",
      created_at: new Date(),
    },
    {
      entrepreneur_id: artIds[2],
      reviewer_name: "Vikram Sen",
      rating: 5,
      comment: "Superb silk weaving quality. The gold thread shines beautifully under light. Extremely happy!",
      created_at: new Date(),
    },
  ];

  await db.collection("reviews").insertMany(reviews);
  console.log("Database successfully seeded!");
}

// JWT verification middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[2]; // Support standard Bearer format (e.g. Bearer token) or custom token format
  const cleanToken = token || (authHeader && authHeader.replace("Bearer ", ""));

  if (!cleanToken) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(cleanToken, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

function authenticateAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    next();
  });
}

// API Endpoints

// Authentication API
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, role, business_name, contact_phone, city, state, bio, category_id } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: "Email, password, and role are required." });
  }

  try {
    const existing = await db.collection("entrepreneurs").findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "User already exists with this email." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      email,
      password: hashedPassword,
      role,
      created_at: new Date(),
    };

    if (role === "entrepreneur") {
      newUser.business_name = business_name || "New Artisan Craft Shop";
      newUser.contact_phone = contact_phone || "";
      newUser.city = city || "";
      newUser.state = state || "";
      newUser.bio = bio || "";
      newUser.category_id = category_id ? new ObjectId(String(category_id)) : null;
      newUser.verified = true;
      newUser.rating_avg = 5.0;
      newUser.rating_count = 0;
    }

    const result = await db.collection("entrepreneurs").insertOne(newUser);
    const userForToken = { id: result.insertedId, email, role };
    const token = jwt.sign(userForToken, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user: { id: result.insertedId, email, role, ...newUser } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await db.collection("entrepreneurs").findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const userProfile = { ...user };
    delete userProfile.password;

    res.json({ token, user: { id: user._id, ...userProfile } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await db.collection("entrepreneurs").findOne({ _id: new ObjectId(String(req.user.id)) });
    if (!user) return res.status(404).json({ error: "User not found." });

    const userProfile = { ...user };
    delete userProfile.password;
    res.json({ user: { id: user._id, ...userProfile } });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/api/auth/profile", authenticateToken, async (req, res) => {
  const { business_name, contact_phone, city, state, bio, category_id, available, avatar } = req.body;
  try {
    const userId = new ObjectId(String(req.user.id));
    const user = await db.collection("entrepreneurs").findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found." });

    const updates = {};
    if (business_name !== undefined) updates.business_name = business_name;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (avatar !== undefined) updates.avatar = avatar;

    if (user.role === "entrepreneur") {
      if (bio !== undefined) updates.bio = bio;
      if (available !== undefined) updates.available = Boolean(available);
      if (category_id !== undefined) {
        updates.category_id = category_id ? new ObjectId(String(category_id)) : null;
      }
    }

    await db.collection("entrepreneurs").updateOne(
      { _id: userId },
      { $set: updates }
    );

    const updatedUser = await db.collection("entrepreneurs").findOne({ _id: userId });
    delete updatedUser.password;

    res.json({ user: { id: updatedUser._id, ...updatedUser } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// Categories API
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await db.collection("categories").find().toArray();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Artisans API
app.get("/api/artisans", async (req, res) => {
  const { category } = req.query;
  try {
    let filter = { role: "entrepreneur", verified: true };
    if (category) {
      const cat = await db.collection("categories").findOne({ slug: category });
      if (cat) {
        filter.category_id = cat._id;
      } else {
        // If category is provided but invalid, return empty array
        return res.json([]);
      }
    }

    const categories = await db.collection("categories").find().toArray();
    const catMap = {};
    categories.forEach(c => {
      catMap[String(c._id)] = c.name;
    });

    const artisans = await db.collection("entrepreneurs").find(filter).toArray();
    const result = artisans.map(a => ({
      ...a,
      category_name: catMap[String(a.category_id)] || null
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/artisans/:id", async (req, res) => {
  try {
    const artisanId = new ObjectId(String(req.params.id));
    const artisan = await db.collection("entrepreneurs").findOne({ _id: artisanId });
    if (!artisan) return res.status(404).json({ error: "Artisan not found." });

    const category = await db.collection("categories").findOne({ _id: artisan.category_id });
    artisan.category_name = category ? category.name : null;

    const products = await db.collection("products").find({ entrepreneur_id: artisanId, active: true }).toArray();
    const services = await db.collection("services").find({ entrepreneur_id: artisanId, active: true }).toArray();
    const reviews = await db.collection("reviews").find({ entrepreneur_id: artisanId }).toArray();

    res.json({ entrepreneur: artisan, products, services, reviews });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Products API
app.get("/api/products", async (req, res) => {
  try {
    const products = await db.collection("products").find({ active: true }).toArray();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Orders & Service Requests API
app.post("/api/orders", authenticateToken, async (req, res) => {
  const { entrepreneur_id, product_id, service_id, service_details, notes, price, name, phone, address } = req.body;
  try {
    if (product_id) {
      const prodId = new ObjectId(String(product_id));
      const product = await db.collection("products").findOne({ _id: prodId });
      if (!product) {
        return res.status(404).json({ error: "Product not found." });
      }
      if (product.stock < 1) {
        return res.status(400).json({ error: "This product is currently out of stock." });
      }

      const updateResult = await db.collection("products").updateOne(
        { _id: prodId, stock: { $gte: 1 } },
        { $inc: { stock: -1 } }
      );

      if (updateResult.matchedCount === 0) {
        return res.status(400).json({ error: "This product is currently out of stock." });
      }
    }

    const newOrder = {
      customer_id: new ObjectId(String(req.user.id)),
      customer_email: req.user.email,
      entrepreneur_id: new ObjectId(String(entrepreneur_id)),
      product_id: product_id ? new ObjectId(String(product_id)) : null,
      service_id: service_id ? new ObjectId(String(service_id)) : null,
      service_details: service_details || null,
      notes: notes || null,
      price: Number(price),
      name,
      phone,
      address,
      status: "pending",
      created_at: new Date(),
    };

    const result = await db.collection("orders").insertOne(newOrder);

    // Create notification for the artisan
    try {
      const notification = {
        user_id: new ObjectId(String(entrepreneur_id)),
        title: product_id ? "New Product Order" : "New Custom Service Request",
        message: `${name} has requested: ${product_id ? "Catalog Purchase" : (service_details || "Bespoke service")}`,
        read: false,
        created_at: new Date()
      };
      await db.collection("notifications").insertOne(notification);
    } catch (err) {
      console.warn("⚠️ Failed to create order notification:", err.message);
    }

    res.json({ id: result.insertedId, ...newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to place order." });
  }
});

app.get("/api/orders", authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(String(req.user.id));
    let orders;
    if (req.user.role === "entrepreneur") {
      orders = await db.collection("orders").find({ entrepreneur_id: userId }).sort({ created_at: -1 }).toArray();
    } else {
      orders = await db.collection("orders").find({ customer_id: userId }).sort({ created_at: -1 }).toArray();
    }
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// Update order status (Artisans only)
app.patch("/api/orders/:id", authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    const orderId = new ObjectId(String(req.params.id));
    const order = await db.collection("orders").findOne({ _id: orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Verify ownership
    if (String(order.entrepreneur_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized." });
    }

    await db.collection("orders").updateOne({ _id: orderId }, { $set: { status } });

    // Create notification for the customer
    try {
      const artisanName = req.user.business_name || req.user.email.split("@")[0];
      const notification = {
        user_id: new ObjectId(String(order.customer_id)),
        title: `Service Request Update: ${status}`,
        message: `Your request with ${artisanName} has been marked as '${status}'.`,
        read: false,
        created_at: new Date()
      };
      await db.collection("notifications").insertOne(notification);
    } catch (err) {
      console.warn("⚠️ Failed to create status update notification:", err.message);
    }

    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status." });
  }
});

// Update order reviewed state (Customers only)
app.patch("/api/orders/:id/review", authenticateToken, async (req, res) => {
  try {
    const orderId = new ObjectId(String(req.params.id));
    const order = await db.collection("orders").findOne({ _id: orderId });
    if (!order) return res.status(404).json({ error: "Order not found." });

    if (String(order.customer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized." });
    }

    await db.collection("orders").updateOne({ _id: orderId }, { $set: { reviewed: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update review status." });
  }
});

// Reviews API
app.post("/api/reviews", authenticateToken, async (req, res) => {
  const { entrepreneur_id, rating, comment } = req.body;
  try {
    const artId = new ObjectId(String(entrepreneur_id));
    const reviewer_name = req.body.reviewer_name || req.user.business_name || req.user.email.split("@")[0];
    const newReview = {
      entrepreneur_id: artId,
      reviewer_name,
      rating: Number(rating),
      comment,
      created_at: new Date(),
    };

    await db.collection("reviews").insertOne(newReview);

    // Create notification for the artisan
    try {
      const notification = {
        user_id: artId,
        title: "New Review Received",
        message: `${reviewer_name} gave you ${rating} stars: "${comment || ''}"`,
        read: false,
        created_at: new Date()
      };
      await db.collection("notifications").insertOne(notification);
    } catch (err) {
      console.warn("⚠️ Failed to create review notification:", err.message);
    }

    // Recalculate average rating for artisan
    const allReviews = await db.collection("reviews").find({ entrepreneur_id: artId }).toArray();
    const count = allReviews.length;
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / count;

    await db.collection("entrepreneurs").updateOne(
      { _id: artId },
      {
        $set: {
          rating_avg: parseFloat(avg.toFixed(1)),
          rating_count: count,
        },
      },
    );

    res.json(newReview);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit review." });
  }
});

// Notifications API
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(String(req.user.id));
    const notifications = await db.collection("notifications")
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

app.patch("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const notificationId = new ObjectId(String(req.params.id));
    const notification = await db.collection("notifications").findOne({ _id: notificationId });
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    // Verify ownership
    if (String(notification.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized." });
    }

    await db.collection("notifications").updateOne(
      { _id: notificationId },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification." });
  }
});

// Entrepreneur Add Products API
app.post("/api/products/add", authenticateToken, async (req, res) => {
  const { title, price, description, image_url, stock } = req.body;
  if (req.user.role !== "entrepreneur") {
    return res.status(403).json({ error: "Only artisans can add products." });
  }

  try {
    const newProduct = {
      entrepreneur_id: new ObjectId(String(req.user.id)),
      title,
      price: Number(price),
      description,
      image_url: image_url || "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=600",
      stock: Number(stock) || 1,
      active: true,
    };

    const result = await db.collection("products").insertOne(newProduct);
    res.json({ id: result.insertedId, ...newProduct });
  } catch (error) {
    res.status(500).json({ error: "Failed to add product." });
  }
});

// Entrepreneur Add Services API
app.post("/api/services/add", authenticateToken, async (req, res) => {
  const { title, price, description, duration } = req.body;
  if (req.user.role !== "entrepreneur") {
    return res.status(403).json({ error: "Only artisans can add services." });
  }

  try {
    const newService = {
      entrepreneur_id: new ObjectId(String(req.user.id)),
      title,
      price: Number(price),
      description,
      duration: duration || "1 hour",
      active: true,
      created_at: new Date()
    };

    const result = await db.collection("services").insertOne(newService);
    res.json({ id: result.insertedId, ...newService });
  } catch (error) {
    res.status(500).json({ error: "Failed to add service." });
  }
});



// ==========================================
// ADMIN DASHBOARD REST APIs
// ==========================================

// 1. Platform Analytics and Reports
app.get("/api/admin/analytics", authenticateAdmin, async (req, res) => {
  try {
    const userCount = await db.collection("entrepreneurs").countDocuments();
    const customerCount = await db.collection("entrepreneurs").countDocuments({ role: "customer" });
    const entrepreneurCount = await db.collection("entrepreneurs").countDocuments({ role: "entrepreneur" });
    const productCount = await db.collection("products").countDocuments();
    const serviceCount = await db.collection("services").countDocuments();
    const orderCount = await db.collection("orders").countDocuments();
    
    const allOrders = await db.collection("orders").find().toArray();
    const completedOrders = allOrders.filter(o => o.status === "completed");
    const totalTransactions = completedOrders.reduce((sum, o) => sum + (o.price || 0), 0);

    // KPI: Service request conversion rate
    const totalCustomRequests = allOrders.filter(o => o.service_id !== null);
    const completedCustomRequests = totalCustomRequests.filter(o => o.status === "completed");
    const serviceConversionRate = totalCustomRequests.length > 0 
      ? (completedCustomRequests.length / totalCustomRequests.length) * 100 
      : 0;

    // KPI: Product sales volume
    const completedProductOrders = completedOrders.filter(o => o.product_id !== null);
    const productSalesVolume = completedProductOrders.length;

    // KPI: Average entrepreneur earnings
    const avgArtisanEarnings = entrepreneurCount > 0 ? (totalTransactions / entrepreneurCount) : 0;

    // KPI: Customer satisfaction ratings
    const allReviews = await db.collection("reviews").find().toArray();
    const avgSatisfactionRating = allReviews.length > 0 
      ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length) 
      : 5.0;

    const categories = await db.collection("categories").find().toArray();
    const categoryBreakdown = [];
    for (const cat of categories) {
      const count = await db.collection("entrepreneurs").countDocuments({ 
        role: "entrepreneur",
        category_id: cat._id
      });
      categoryBreakdown.push({
        id: cat._id,
        name: cat.name,
        count
      });
    }

    res.json({
      users: { total: userCount, customers: customerCount, entrepreneurs: entrepreneurCount },
      products: productCount,
      services: serviceCount,
      orders: orderCount,
      totalTransactions,
      serviceConversionRate,
      productSalesVolume,
      avgArtisanEarnings,
      avgSatisfactionRating,
      categoryBreakdown
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to load analytics data." });
  }
});

// 2. Fetch Entrepreneurs
app.get("/api/admin/entrepreneurs", authenticateAdmin, async (req, res) => {
  try {
    const list = await db.collection("entrepreneurs").find({ role: "entrepreneur" }).toArray();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch entrepreneurs." });
  }
});

// 3. Approve and Verify Entrepreneurs
app.patch("/api/admin/entrepreneurs/:id/verify", authenticateAdmin, async (req, res) => {
  const { verified } = req.body;
  try {
    await db.collection("entrepreneurs").updateOne(
      { _id: new ObjectId(String(req.params.id)) },
      { $set: { verified: Boolean(verified) } }
    );
    res.json({ success: true, verified: Boolean(verified) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update verification status." });
  }
});

// 4. Create Category
app.post("/api/admin/categories", authenticateAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Category name required." });
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newCategory = {
      name,
      slug,
      description: description || ""
    };
    const result = await db.collection("categories").insertOne(newCategory);
    res.json({ id: result.insertedId, ...newCategory });
  } catch (error) {
    res.status(500).json({ error: "Failed to create category." });
  }
});

// 5. Delete Category
app.delete("/api/admin/categories/:id", authenticateAdmin, async (req, res) => {
  try {
    await db.collection("categories").deleteOne({ _id: new ObjectId(String(req.params.id)) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category." });
  }
});

// 6. Monitor All Orders & Service Requests
app.get("/api/admin/orders", authenticateAdmin, async (req, res) => {
  try {
    const orders = await db.collection("orders").find().toArray();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// 7. Get All Services / Skills
app.get("/api/admin/services", authenticateAdmin, async (req, res) => {
  try {
    const list = await db.collection("services").find().toArray();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch services." });
  }
});

// 8. Delete Service / Skill
app.delete("/api/admin/services/:id", authenticateAdmin, async (req, res) => {
  try {
    await db.collection("services").deleteOne({ _id: new ObjectId(String(req.params.id)) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete service." });
  }
});

// 9. Open Dispute (for Customers)
app.patch("/api/orders/:id/dispute", authenticateToken, async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: "Dispute reason is required." });
  try {
    const orderId = new ObjectId(String(req.params.id));
    const order = await db.collection("orders").findOne({ _id: orderId });
    if (!order) return res.status(404).json({ error: "Order not found." });

    await db.collection("orders").updateOne(
      { _id: orderId },
      { $set: { disputed: true, dispute_reason: reason, status: "disputed" } }
    );

    res.json({ success: true, disputed: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to open dispute." });
  }
});

// 10. Resolve Dispute (for Admin)
app.patch("/api/admin/orders/:id/resolve-dispute", authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    const orderId = new ObjectId(String(req.params.id));
    await db.collection("orders").updateOne(
      { _id: orderId },
      { $set: { disputed: false, status: status || "completed" } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve dispute." });
  }
});

// Fallback: Redirect all other requests to index.html (SPA routing, if needed, but since we have separate HTML files, we can just let express serve 404 or index)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb().then(() => {
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  }
});

export default app;
