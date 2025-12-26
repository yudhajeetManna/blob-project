const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static("frontend"));

app.get("/", (req, res) => {
    res.redirect("/login.html");
});

app.use(session({
    secret: "local-secret",
    resave: false,
    saveUninitialized: true
}));

const USERS_FILE = "backend/users.xlsx";
const BASE_UPLOAD_DIR = "blob-storage/uploads";

// Ensure base upload folder exists
fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });

function getUserDir(email) {
    const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.\./g, "__");
    const userDir = path.join(BASE_UPLOAD_DIR, safeEmail);
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }
    return userDir;
}

/* ================= USERS (EXCEL) ================= */

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    const wb = XLSX.readFile(USERS_FILE);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
}

function writeUsers(users) {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(users);
    XLSX.utils.book_append_sheet(wb, sheet, "Users");
    XLSX.writeFile(wb, USERS_FILE);
}

/* ================= CAPTCHA ================= */

app.get("/captcha", (req, res) => {
    const captcha = Math.random().toString(36).substring(2, 8);
    req.session.captcha = captcha;
    res.json({ captcha });
});

/* ================= SIGNUP ================= */

app.post("/signup", async (req, res) => {
    const { email, password, captcha } = req.body;

    if (captcha !== req.session.captcha)
        return res.status(400).send("Captcha incorrect");

    const users = readUsers();
    if (users.find(u => u.Email === email))
        return res.status(400).send("User already exists");

    const hash = await bcrypt.hash(password, 10);
    users.push({ Email: email, PasswordHash: hash });
    writeUsers(users);

    res.send("Signup successful");
});

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
    const { email, password, captcha } = req.body;

    if (captcha !== req.session.captcha)
        return res.status(400).send("Captcha incorrect");

    const users = readUsers();
    const user = users.find(u => u.Email === email);
    if (!user) return res.status(404).send("User not found");

    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return res.status(401).send("Wrong password");

    req.session.user = email;
    res.json({ success: true });
});

/* ================= RESET PASSWORD ================= */

app.post("/reset-password", async (req, res) => {
    const { email, newPassword, captcha } = req.body;

    if (captcha !== req.session.captcha)
        return res.status(400).send("Captcha incorrect");

    const users = readUsers();
    const userIndex = users.findIndex(u => u.Email === email);

    if (userIndex === -1)
        return res.status(404).send("User not found");

    const hash = await bcrypt.hash(newPassword, 10);
    users[userIndex].PasswordHash = hash;
    writeUsers(users);

    res.send("Password reset successful");
});

/* ================= AUTH MIDDLEWARE ================= */

function auth(req, res, next) {
    if (!req.session.user)
        return res.status(401).send("Unauthorized");
    next();
}

app.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Could not log out");
        res.send("Logged out");
    });
});

/* ================= FILE UPLOAD (BLOB) ================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.session.user) return cb(new Error("Unauthorized"));
        cb(null, getUserDir(req.session.user));
    },
    filename: (req, file, cb) =>
        cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

app.post("/upload", auth, upload.single("file"), (req, res) => {
    res.send("File uploaded");
});

app.get("/files", auth, (req, res) => {
    const userDir = getUserDir(req.session.user);
    res.json(fs.readdirSync(userDir));
});

app.get("/download/:name", auth, (req, res) => {
    const userDir = getUserDir(req.session.user);
    const filePath = path.join(userDir, req.params.name);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send("File not found");
    }
});

// New Endpoint for Preview
app.get("/preview/:name", auth, (req, res) => {
    const userDir = getUserDir(req.session.user);
    const filePath = path.resolve(userDir, req.params.name);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send("File not found");
    }
});

app.delete("/delete/:name", auth, (req, res) => {
    const userDir = getUserDir(req.session.user);
    const filePath = path.join(userDir, req.params.name);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.send("Deleted");
    } else {
        res.status(404).send("File not found");
    }
});

/* ================= CHATBOT ================= */
app.post("/chatbot", auth, (req, res) => {
    const message = req.body.message.toLowerCase();
    const userDir = getUserDir(req.session.user);
    const files = fs.readdirSync(userDir);

    let reply = "Sorry, I didn't understand that. Try asking about 'upload', 'download', 'blob storage', or 'security'.";

    // User's specific Rule-Based Logic
    if (message.includes("upload")) {
        reply = "To upload a file, click the 'Browse Files' button or drag and drop your file onto the dashboard.";
    }
    else if (message.includes("download")) {
        reply = "Click the Download icon (arrow down) on the file card you wish to download.";
    }
    else if (message.includes("blob")) {
        reply = "Blob storage is used to store large files like PDFs, images, and videos. In this local demo, we use the file system to simulate blobs.";
    }
    else if (message.includes("secure") || message.includes("security")) {
        reply = "Your files are secure and only accessible after login. Each user has their own isolated storage folder.";
    }
    else if (message.includes("file type")) {
        reply = "You can upload PDF, images, videos, and audio files.";
    }
    // Keep existing useful dynamic commands
    else if (message.includes("list") || message.includes("show") || message.includes("my files")) {
        if (files.length === 0) {
            reply = "You don't have any files yet.";
        } else {
            reply = "Here are your files:\n" + files.join("\n");
        }
    }
    else if (message.includes("count") || message.includes("how many")) {
        reply = `You have ${files.length} file(s).`;
    }
    else if (message.includes("hello") || message.includes("hi")) {
        reply = "Hello! I am your Help Assistant. Ask me about uploading files, blob storage, or security!";
    }

    res.json({ reply });
});

/* ================= DASHBOARD ================= */

app.get("/dashboard", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login.html");
    }
    res.sendFile(path.join(__dirname, "../frontend/dashboard.html"));
});

app.listen(3000, () =>
    console.log("Server running → http://localhost:3000")
);
