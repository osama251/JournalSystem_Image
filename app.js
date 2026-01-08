var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const fs = require("fs");
const cors = require('cors');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const multer = require('multer');
const pool = require('./db');

const { checkJwt } = require("./jwt");

// Replace 'YOUR_PUBLIC_KEY_STRING' with the actual key from the URL above
//const secret = `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyPQ0pC2So+tSSl5rLhG4bfhuj13Dbp9H39jHW7Jh3AWduEBTVhFQc4lmdwmmX0DyYfK8HUEKPF83l2z0PbIDHAzIGHOJndrC/ua/e4hRBUZxtdJQKDxnyrLcWVnZ0tWd0CJxQUZH9TS+p0rkhO/7dRPy8KQBqrX9GGQ+KxBj01gsLJyoCCOU+g/MdahlPVQO9Xg34tPD3iHdnCvJhjWWT8tdJF4AurL53BOMKuzNJGwkdH62SKFNkZRS5ciNExGgfJeS7ufNgIAsGXCDWa311c7eIxgaLWmYUrcBuSG0UZ1iB4taTZtHhqDE23NCrJ+8AMjqQdRibNFfOIGXB/OPOwIDAQAB`;
/*
const checkJwt = auth({
    audience: 'account',
    issuerBaseURL: 'http://localhost:30086/realms/journal',
    tokenSigningAlg: 'RS256',
});
*/
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');                    // folder we created
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));  // keep extension (.png, .jpg, ...)
    }
});

const upload = multer({ storage: storage });

var app = express();

app.use(cors()); //ALLOW ALL BABY

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.post("/upload", checkJwt, upload.single("image"), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Keycloak user id from token
        const userId = req.auth.payload.sub;

        const { filename, originalname, mimetype, size } = req.file;

        const [result] = await pool.execute(
            `INSERT INTO images (user_id, file_name, original_name, mime_type, size_bytes)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, filename, originalname, mimetype, size]
        );

        res.json({
            id: result.insertId,
            userId,
            originalName: originalname,
            fileName: filename,
            mimeType: mimetype,
            size,
            url: `/uploads/${filename}`,
        });
    } catch (err) {
        console.error("Error saving image metadata:", err);
        next(err);
    }
});

app.get("/image/by-original-name/:name", checkJwt, async (req, res, next) => {
    try {
        const originalName = req.params.name;

        const [rows] = await pool.execute(
            `SELECT id, user_id, file_name, original_name, mime_type, size_bytes, created_at
             FROM images
             WHERE original_name = ?
                 LIMIT 1`,
            [originalName]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Image not found" });
        }

        const row = rows[0];

        // Optional: lock access to only the owner
        // const userId = req.auth.payload.sub;
        // if (row.user_id !== userId) return res.status(403).json({ message: "Forbidden" });

        res.json({
            id: row.id,
            userId: row.user_id,
            originalName: row.original_name,
            fileName: row.file_name,
            mimeType: row.mime_type,
            size: row.size_bytes,
            createdAt: row.created_at,
            url: `/uploads/${row.file_name}`,
        });
    } catch (err) {
        console.error("Error fetching image by name:", err);
        next(err);
    }
});

app.put("/image/:originalName", checkJwt, upload.single("file"), async (req, res, next) => {
    try {
        const originalName = req.params.originalName;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Find existing record
        const [rows] = await pool.execute(
            `SELECT id, user_id, file_name
             FROM images
             WHERE original_name = ?
                 LIMIT 1`,
            [originalName]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Image not found" });
        }

        const existing = rows[0];

        // Optional: only owner can replace
        // const userId = req.auth.payload.sub;
        // if (existing.user_id !== userId) return res.status(403).json({ message: "Forbidden" });

        // Delete old file from disk
        const oldFilePath = path.join(__dirname, "uploads", existing.file_name);
        if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
        }

        // Update DB
        await pool.execute(
            `UPDATE images
       SET file_name = ?, mime_type = ?, size_bytes = ?
       WHERE id = ?`,
            [req.file.filename, req.file.mimetype, req.file.size, existing.id]
        );

        res.json({
            message: "Image replaced successfully",
            id: existing.id,
            userId: existing.user_id,
            originalName,
            fileName: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            url: `/uploads/${req.file.filename}`,
        });
    } catch (err) {
        console.error("Error replacing image:", err);
        next(err);
    }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});




// error handler
app.use(function(err, req, res, next) {
    // Add this line to see the real reason for the 401 in your terminal!
    if (err.name === 'UnauthorizedError' || err.status === 401) {
        console.error("JWT Validation Error:", err.message);
    }

    res.status(err.status || 500);
    res.json({ message: err.message }); // Return JSON instead of rendering a page
});



module.exports = app;
