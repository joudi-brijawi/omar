const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// إعدادات أساسية لتمكين السيرفر من قراءة الملفات
app.use(express.static('public'));
app.use(express.json());

// التأكد من وجود مجلد لحفظ الصور المرفوعة
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد Multer لحفظ الصور وإعطائها أسماء فريدة
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// إعداد قاعدة بيانات SQLite
const db = new sqlite3.Database('./wardrobe.sqlite', (err) => {
    if (err) console.error('خطأ في الاتصال بقاعدة البيانات:', err);
    else console.log('database ok');
});

// إنشاء جدول المنتجات إذا لم يكن موجوداً
db.run(`CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    price TEXT,
    season TEXT,
    category TEXT,
    image_url TEXT
)`);

// مسار استقبال بيانات القطعة الجديدة والصورة من لوحة التحكم
app.post('/api/products', upload.single('image'), (req, res) => {
    const { title, description, price, season, category } = req.body;
    const imageUrl = req.file ? '/uploads/' + req.file.filename : '';

    const sql = `INSERT INTO products (title, description, price, season, category, image_url) VALUES(?, ?, ?, ?, ?, ?)`;
    db.run(sql, [title, description, price, season, category, imageUrl], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'the save done', id: this.lastID });
    });
});

// مسار جلب المنتجات مع الفلترة النظيفة لتجنب أخطاء الدمج
app.get('/api/products', (req, res) => {
    const { season, category } = req.query;

    let sql = 'SELECT * FROM products';
    let params = [];
    let conditions = [];

    if (season) {
        conditions.push('season = ?');
        params.push(season);
    }
    if (category) {
        conditions.push('category = ?');
        params.push(category);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// مسار حذف قطعة
app.delete('/api/products/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM products WHERE id = ?`, id, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'تم الحذف بنجاح' });
    });
});

// تشغيل السيرفر
app.listen(PORT, '0.0.0.0', () => {
    console.log(`done http://localhost:3000`);
});