// Gerekli kütüphaneleri import ediyoruz
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Express uygulamasını başlatıyoruz
const app = express();
const PORT = 3000;
const DB_PATH = './dev.db';

// Veritabanı bağlantısını oluşturuyoruz
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error("Veritabanına bağlanırken hata oluştu:", err.message);
    } else {
        console.log("Veritabanı bağlantısı başarılı.");
    }
});

// JSON ve Form verilerini işlemek için middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- API ENDPOINTS ---

// --- Vendor API'ları ---
app.get('/api/vendors', (req, res) => {
    db.all(`SELECT * FROM Vendor ORDER BY id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});
app.post('/api/vendors', (req, res) => {
    const { name, makeCode } = req.body;
    if (!name || !makeCode || name.trim() === '' || makeCode.trim() === '') return res.status(400).json({ error: "Vendor adı ve kodu boş olamaz." });
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const sql = `INSERT INTO Vendor (name, makeCode, slug) VALUES (?, ?, ?)`;
    db.run(sql, [name.trim(), makeCode.trim(), slug], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: "Bu vendor adı, kodu veya slug zaten mevcut." });
            return res.status(500).json({ error: "Veritabanına kayıt sırasında bir hata oluştu." });
        }
        res.status(201).json({ id: this.lastID, name: name.trim(), makeCode: makeCode.trim(), slug: slug });
    });
});
app.put('/api/vendors/:id', (req, res) => {
    const { id } = req.params;
    const { name, makeCode } = req.body;
    if (!name || !makeCode || name.trim() === '' || makeCode.trim() === '') return res.status(400).json({ error: "Vendor adı ve kodu boş olamaz." });
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    const sql = `UPDATE Vendor SET name = ?, makeCode = ?, slug = ? WHERE id = ?`;
    db.run(sql, [name.trim(), makeCode.trim(), slug, id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: "Bu vendor adı, kodu veya slug zaten mevcut." });
            return res.status(500).json({ error: "Veritabanı güncelleme sırasında hata." });
        }
        if (this.changes === 0) return res.status(404).json({ error: "Güncellenecek vendor bulunamadı." });
        res.json({ message: "Vendor başarıyla güncellendi." });
    });
});
app.delete('/api/vendors/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM Vendor WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
             if (err.message.includes('FOREIGN KEY constraint failed')) return res.status(409).json({ error: 'Bu vendor silinemez çünkü kendisine bağlı modeller bulunmaktadır.' });
            return res.status(500).json({ error: "Veritabanından silme sırasında hata." });
        }
        if (this.changes === 0) return res.status(404).json({ error: "Silinecek vendor bulunamadı." });
        res.status(204).send();
    });
});

// --- Model API'ları ---
app.get('/api/models', (req, res) => {
    const sql = `SELECT Model.id, Model.name, Model.code, Model.vendorId, Vendor.name as vendorName FROM Model JOIN Vendor ON Model.vendorId = Vendor.id ORDER BY Vendor.name ASC, Model.name ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});
app.post('/api/models', (req, res) => {
    const { name, code, vendorId } = req.body;
    if (!name || !code || !vendorId || name.trim() === '' || code.trim() === '') {
        return res.status(400).json({ error: "Model adı, kodu ve vendor seçimi zorunludur." });
    }
    const sql = `INSERT INTO Model (name, code, vendorId) VALUES (?, ?, ?)`;
    db.run(sql, [name.trim(), code.trim(), vendorId], function(err) {
        if (err) {
            return res.status(500).json({ error: "Veritabanına model kaydı sırasında hata." });
        }
        res.status(201).json({ id: this.lastID, name: name.trim(), code: code.trim(), vendorId: vendorId });
    });
});
app.put('/api/models/:id', (req, res) => {
    const { id } = req.params;
    const { name, code, vendorId } = req.body;
    if (!name || !code || !vendorId || name.trim() === '' || code.trim() === '') {
        return res.status(400).json({ error: "Model adı, kodu ve vendor seçimi zorunludur." });
    }
    const sql = `UPDATE Model SET name = ?, code = ?, vendorId = ? WHERE id = ?`;
    db.run(sql, [name.trim(), code.trim(), vendorId, id], function(err) {
        if (err) {
            return res.status(500).json({ error: "Veritabanı model güncelleme sırasında hata." });
        }
        if (this.changes === 0) return res.status(404).json({ error: "Güncellenecek model bulunamadı." });
        res.json({ message: "Model başarıyla güncellendi." });
    });
});
app.delete('/api/models/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM Model WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            if (err.message.includes('FOREIGN KEY constraint failed')) return res.status(409).json({ error: 'Bu model silinemez çünkü kendisine bağlı versiyon veya bulgu bulunmaktadır.' });
            return res.status(500).json({ error: "Veritabanından model silme sırasında hata." });
        }
        if (this.changes === 0) return res.status(404).json({ error: "Silinecek model bulunamadı." });
        res.status(204).send();
    });
});

// --- Version API'ları (Tamamlandı) ---
app.get('/api/versions', (req, res) => {
    const sql = `
        SELECT 
          v.id, v.versionNumber, v.deliveryDate, v.status, v.prodOnayDate,
          ven.name as vendorName,
          ven.id as vendorId, 
          GROUP_CONCAT(m.name, ', ') as models,
          GROUP_CONCAT(m.id, ', ') as modelIds
        FROM AppVersion v
        JOIN Vendor ven ON v.vendorId = ven.id
        LEFT JOIN VersionModel vm ON v.id = vm.versionId
        LEFT JOIN Model m ON vm.modelId = m.id
        GROUP BY v.id
        ORDER BY v.deliveryDate DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ "error": err.message });
        res.json(rows);
    });
});

app.post('/api/versions', (req, res) => {
    const { versionNumber, deliveryDate, vendorId, modelIds } = req.body;
    if (!versionNumber || !deliveryDate || !vendorId || !modelIds || modelIds.length === 0) {
        return res.status(400).json({ error: 'Versiyon numarası, teslim tarihi, vendor ve en az bir model seçimi zorunludur.' });
    }
    const versionSql = 'INSERT INTO AppVersion (versionNumber, vendorId, deliveryDate, status) VALUES (?, ?, ?, "Test")';
    db.run(versionSql, [versionNumber, vendorId, deliveryDate], function(err) {
        if (err) return res.status(500).json({ error: "Ana versiyon kaydı sırasında hata." });
        
        const newVersionId = this.lastID;
        const promises = modelIds.map(modelId => {
            return new Promise((resolve, reject) => {
                db.run('INSERT INTO VersionModel (versionId, modelId) VALUES (?, ?)', [newVersionId, modelId], (err) => {
                    if (err) reject(err); else resolve();
                });
            });
        });

        Promise.all(promises)
            .then(() => res.status(201).json({ id: newVersionId }))
            .catch(err => res.status(500).json({ error: "Model bağlantıları kaydedilirken hata oluştu." }));
    });
});

app.put('/api/versions/:id', (req, res) => {
    const { id } = req.params;
    const { versionNumber, deliveryDate, status, prodOnayDate, modelIds } = req.body;
    if (!versionNumber || !deliveryDate || !status || !modelIds || modelIds.length === 0) {
        return res.status(400).json({ error: 'Tüm alanların doldurulması ve en az bir model seçimi zorunludur.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const updateSql = `UPDATE AppVersion SET versionNumber = ?, deliveryDate = ?, status = ?, prodOnayDate = ? WHERE id = ?`;
        db.run(updateSql, [versionNumber, deliveryDate, status, status === 'Prod' ? prodOnayDate : null, id]);

        db.run('DELETE FROM VersionModel WHERE versionId = ?', [id]);

        const insertPromises = modelIds.map(modelId => {
            return new Promise((resolve, reject) => {
                db.run('INSERT INTO VersionModel (versionId, modelId) VALUES (?, ?)', [id, modelId], (err) => {
                    if (err) reject(err); else resolve();
                });
            });
        });

        Promise.all(insertPromises)
            .then(() => {
                db.run('COMMIT');
                res.json({ message: "Versiyon başarıyla güncellendi." });
            })
            .catch(err => {
                db.run('ROLLBACK');
                res.status(500).json({ error: "Versiyon güncellenirken bir hata oluştu." });
            });
    });
});

app.delete('/api/versions/:id', (req, res) => {
    const { id } = req.params;
    // ON DELETE CASCADE sayesinde VersionModel'deki kayıtlar otomatik silinecek.
    const sql = `DELETE FROM AppVersion WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: "Veritabanından versiyon silme sırasında hata." });
        }
        if (this.changes === 0) return res.status(404).json({ error: "Silinecek versiyon bulunamadı." });
        res.status(204).send();
    });
});


// 'public' klasöründeki statik dosyaları sunmak için (Cache'i devre dışı bırakan ayarla)
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path, stat) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    },
}));

// --- Sunucuyu Başlatma ---
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});

