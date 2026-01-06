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

app.post('/upload', upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Optional: who uploaded this image (can send from frontend / Postman)
        const userId = req.body.userId ? String(req.body.userId) : null;

        const { filename, originalname, mimetype, size } = req.file;

        // Insert metadata into MySQL
        const [result] = await pool.execute(
            `
      INSERT INTO images (user_id, file_name, original_name, mime_type, size_bytes)
      VALUES (?, ?, ?, ?, ?)
      `,
            [userId, filename, originalname, mimetype, size]
        );

        const recordId = result.insertId;

        res.json({
            id: recordId,
            userId,
            originalName: originalname,
            fileName: filename,
            mimeType: mimetype,
            size,
            url: `/uploads/${filename}`,
        });
    } catch (err) {
        console.error('Error saving image metadata:', err);
        next(err);
    }
});

app.get('/image/by-original-name/:name', async (req, res, next) => {
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

        const result = {
            id: row.id,
            userId: row.user_id,
            originalName: row.original_name,
            fileName: row.file_name,
            mimeType: row.mime_type,
            size: row.size_bytes,
            createdAt: row.created_at,
            url: `/uploads/${row.file_name}`
        };

        res.json(result);

    } catch (err) {
        console.error("Error fetching image by name:", err);
        next(err);
    }
});

// PUT endpoint to replace an existing image
app.put("/image/:originalName", upload.single("file"), async (req, res, next) => {
    try {
        const originalName = req.params.originalName;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // 1. Find the existing image by original_name
        const [rows] = await pool.execute(
            `SELECT id, file_name FROM images WHERE original_name = ? LIMIT 1`,
            [originalName]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Image not found" });
        }

        const existing = rows[0];
        const oldFilePath = path.join(__dirname, "uploads", existing.file_name);

        // 2. Delete old file from disk (if it exists)
        if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
        }

        // 3. Update database with new file info
        await pool.execute(
            `UPDATE images
       SET file_name = ?, mime_type = ?, size_bytes = ?
       WHERE id = ?`,
            [file.filename, file.mimetype, file.size, existing.id]
        );

        // 4. Respond with updated info
        res.json({
            message: "Image replaced successfully",
            id: existing.id,
            originalName: originalName,
            fileName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            url: "/uploads/" + file.filename
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
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



module.exports = app;
