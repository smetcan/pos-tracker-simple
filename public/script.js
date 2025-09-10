// Sayfa tamamen yüklendiğinde bu fonksiyon çalışır
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SEÇİMLERİ ---
    const mainContent = document.getElementById('main-content');
    const modalContainer = document.getElementById('modal-container');
    const sidebarVendorList = document.getElementById('vendor-list');
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        bulgular: document.getElementById('nav-bulgular'),
        yonetim: document.getElementById('nav-yonetim'),
    };

    // --- STATE MANAGEMENT (Durum Yönetimi) ---
    let currentActiveTab = 'vendors';
    let vendorsData = [];
    let modelsData = [];
    let versionsData = [];
    let bulgularData = [];
    let vendorSort = { key: 'id', direction: 'asc' };
    let modelSort = { key: 'vendorName', direction: 'asc' };
    let modelFilters = {
        searchTerm: '',
        vendorId: 'all',
        isTechpos: 'all',
        isAndroidPos: 'all',
        isOkcPos: 'all'
    };
    // Filters for Bulgular page
    let bulguFilters = {
        searchTerm: '',
        vendorId: 'all',
        status: 'all',
        tip: 'all'
    };


    // --- OLAY DİNLEYİCİLER (EVENT LISTENERS) ---
    navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    navLinks.yonetim.addEventListener('click', (e) => { e.preventDefault(); navigateTo('yonetim'); });
    navLinks.bulgular.addEventListener('click', (e) => { e.preventDefault(); navigateTo('bulgular'); });


    // --- YARDIMCI FONKSİYONLAR ---
    async function apiRequest(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                if (contentType?.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Bilinmeyen bir sunucu hatası.');
                } else {
                    const errorText = await response.text();
                    console.error("Sunucudan gelen beklenmedik yanıt:", errorText);
                    throw new Error('Sunucuyla iletişimde bir sorun oluştu.');
                }
            }
            if (response.status === 204 || !contentType?.includes('application/json')) return {};
            return response.json();
        } catch (error) {
            console.error('API isteği sırasında hata:', error);
            throw error;
        }
    }

    function showErrorModal(message) {
        modalContainer.innerHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50">
                <div class="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-red-600">Bir Hata Oluştu</h3>
                        <p class="text-sm text-gray-600 mt-2 px-7 py-3">${message}</p>
                        <div class="items-center px-4 py-3">
                            <button id="close-error-modal" class="px-4 py-2 bg-gray-200 rounded-md">Kapat</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.getElementById('close-error-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
    }

    function sortData(data, sortConfig) {
        const { key, direction } = sortConfig;
        return [...data].sort((a, b) => {
            const valA = a[key];
            const valB = b[key];
            let comparison = 0;
            if (valA > valB) { comparison = 1; } 
            else if (valA < valB) { comparison = -1; }
            return direction === 'asc' ? comparison : comparison * -1;
        });
    }

    // --- ANA NAVİGASYON FONKSİYONU ---
    async function navigateTo(page) {
        Object.values(navLinks).forEach(link => link.classList.remove('active'));
        mainContent.innerHTML = '<h1 class="text-3xl font-bold">Yükleniyor...</h1>';
        try {
            switch (page) {
                case 'yonetim': await renderYonetimPage(); navLinks.yonetim.classList.add('active'); break;
                case 'bulgular': await renderBulgularPage(); navLinks.bulgular.classList.add('active'); break;
                default: mainContent.innerHTML = getDashboardHTML(); navLinks.dashboard.classList.add('active'); break;
            }
        } catch (error) {
            mainContent.innerHTML = `<h1 class="text-3xl font-bold text-red-600">Hata!</h1><p>${error.message}</p>`;
        }
    }

    // --- HTML OLUŞTURMA FONKSİYONLARI ---
    function getDashboardHTML() { return `<h1 class="text-3xl font-bold mb-6">Ana Sayfa</h1><div class="bg-white p-6 rounded-lg shadow"><p>POS Takip Uygulamasına hoş geldiniz. Sol menüden işlem yapmak istediğiniz bölümü seçebilirsiniz.</p></div>`; }
    
    function getBulgularHTML(bulgular) {
        const getBadgeClass = (text) => {
             switch (text) {
                case "Açık": case "Yüksek": case "Program Hatası": return 'bg-red-100 text-red-800';
                case "Test Edilecek": case "Yeni Talep": return 'bg-blue-100 text-blue-800';
                case "Orta": return 'bg-yellow-100 text-yellow-800';
                case "Kapalı": case "Düşük": return 'bg-gray-100 text-gray-800';
                default: return 'bg-gray-100 text-gray-800';
            }
        };

        const bulgularTableRows = bulgular.map(bulgu => {
            const vendorName = bulgu.vendorName || (vendorsData.find(v => v.id == bulgu.vendorId)?.name) || '';
            const versionName = bulgu.cozumVersiyonId ? (versionsData.find(v => v.id == bulgu.cozumVersiyonId)?.versionNumber || '') : '';
            // Compute affected model names as an array (prefer modelIds), then render as multi-line HTML with 4 models per line
            let affectedModelsArray = [];
            if (bulgu.modelIds) {
                const ids = (typeof bulgu.modelIds === 'string') ? bulgu.modelIds.split(',').map(s => s.trim()) : bulgu.modelIds;
                affectedModelsArray = ids.map(id => modelsData.find(m => String(m.id) === String(id))?.name).filter(Boolean);
            }
            if (!affectedModelsArray.length && bulgu.models) {
                affectedModelsArray = (typeof bulgu.models === 'string') ? bulgu.models.split(',').map(s => s.trim()).filter(Boolean) : (Array.isArray(bulgu.models) ? bulgu.models : []);
            }
            // Helper to chunk array into groups
            const chunkArray = (arr, size) => {
                const res = [];
                for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
                return res;
            };
            const formattedModelsHtml = (affectedModelsArray.length > 0) ? chunkArray(affectedModelsArray, 4).map(group => `<div class="mb-1">${group.map(m => `<span class="inline-block mr-2 text-xs text-gray-700">${m}</span>`).join('')}</div>`).join('') : '-';
            const tespit = bulgu.tespitTarihi || '';
            const onaylayan = bulgu.cozumOnaylayanKullanici || '';
            const onayTarihi = bulgu.cozumOnayTarihi || '';
            return `
            <tr class="border-b">
                <td class="p-3 text-sm text-gray-500"><a href="#" class="view-bulgu-btn text-blue-600" data-bulgu-id="${bulgu.id}">#${bulgu.id}</a></td>
                <td class="p-3 font-medium">${bulgu.baslik}</td>
                <td class="p-3 text-sm text-gray-600">${vendorName}</td>
                <td class="p-3 text-sm text-gray-600">${versionName || '-'}</td>
                <td class="p-3 text-xs text-gray-500">${formattedModelsHtml}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${getBadgeClass(bulgu.bulguTipi)}">${bulgu.bulguTipi}</span></td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${getBadgeClass(bulgu.etkiSeviyesi)}">${bulgu.etkiSeviyesi}</span></td>
                <td class="p-3 text-sm text-gray-600">${tespit}</td>
                <td class="p-3 text-sm text-gray-600">${onaylayan}</td>
                <td class="p-3 text-sm text-gray-600">${onayTarihi}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${getBadgeClass(bulgu.status)}">${bulgu.status}</span></td>
                <td class="p-3 text-right">
                    <button class="edit-bulgu-btn p-1 text-sm text-blue-600" data-bulgu-id="${bulgu.id}">Düzenle</button>
                    <button class="delete-bulgu-btn p-1 text-sm text-red-600" data-bulgu-id="${bulgu.id}" data-bulgu-baslik="${bulgu.baslik}">Sil</button>
                </td>
            </tr>
        `}).join('');

        // Build vendor options for filter
        const vendorFilterOptions = [{ id: 'all', name: 'Tümü' }].concat(vendorsData.map(v => ({ id: v.id, name: v.name }))).map(v => `<option value="${v.id}">${v.name}</option>`).join('');
        const statusOptions = ['all','Açık','Test Edilecek','Kapalı'].map(s => `<option value="${s}">${s === 'all' ? 'Tümü' : s}</option>`).join('');
        const tipOptionsFilter = ['all','Program Hatası','Yeni Talep'].map(t => `<option value="${t}">${t === 'all' ? 'Tümü' : t}</option>`).join('');

        return `
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-3xl font-bold">Bulgu Takibi</h1>
                    <p class="text-gray-500">Tüm program hatalarını ve yeni talepleri buradan yönetebilirsiniz.</p>
                </div>
                <button id="add-bulgu-btn" class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md">Yeni Bulgu/Talep Ekle</button>
            </div>
            <div class="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                    <label class="text-xs text-gray-500">Ara (Başlık / Açıklama)</label>
                    <input id="bulgu-search-input" type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="Ara..." value="${bulguFilters.searchTerm}">
                </div>
                <div>
                    <label class="text-xs text-gray-500">Vendor</label>
                    <select id="bulgu-vendor-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${vendorFilterOptions}</select>
                </div>
                <div>
                    <label class="text-xs text-gray-500">Durum</label>
                    <select id="bulgu-status-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${statusOptions}</select>
                </div>
                <div>
                    <label class="text-xs text-gray-500">Kayıt Tipi</label>
                    <select id="bulgu-tip-filter" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${tipOptionsFilter}</select>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow">
                <div class="p-6">
                    <div class="rounded-md border overflow-x-auto">
                        <table class="w-full text-sm min-w-[1100px]">
                            <thead>
                                <tr class="border-b bg-gray-50">
                                    <th class="p-3 text-left">ID</th>
                                    <th class="p-3 text-left">Başlık</th>
                                    <th class="p-3 text-left">Vendor</th>
                                    <th class="p-3 text-left">Çözüm Beklenen Versiyon</th>
                                    <th class="p-3 text-left">Modeller</th>
                                    <th class="p-3 text-left">Tip</th>
                                    <th class="p-3 text-left">Etki</th>
                                    <th class="p-3 text-left">Tespit Tarihi</th>
                                    <th class="p-3 text-left">Onaylayan Kişi</th>
                                    <th class="p-3 text-left">Onay Tarihi</th>
                                    <th class="p-3 text-left">Durum</th>
                                    <th class="p-3 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>${bulgularTableRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    function getBulguModalHTML(vendors, models, versions, bulgu = null) {
        const isEdit = bulgu !== null;
        const title = isEdit ? 'Bulgu Düzenle' : 'Yeni Bulgu/Talep Ekle';
        const buttonText = isEdit ? 'Güncelle' : 'Kaydet';
        const formId = isEdit ? 'edit-bulgu-form' : 'add-bulgu-form';
        
        const baslik = isEdit ? bulgu.baslik : '';
        const selectedVendorId = isEdit ? bulgu.vendorId : null;
        const selectedCozumVersiyonId = isEdit ? bulgu.cozumVersiyonId : null;
        const selectedBulguTipi = isEdit ? bulgu.bulguTipi : '';
        const selectedEtkiSeviyesi = isEdit ? bulgu.etkiSeviyesi : '';
        const tespitTarihi = isEdit ? bulgu.tespitTarihi : '';
        const girenKullanici = isEdit ? (bulgu.girenKullanici || '') : '';
        const detayliAciklama = isEdit ? (bulgu.detayliAciklama || '') : '';
        const vendorTrackerNo = isEdit ? (bulgu.vendorTrackerNo || '') : '';
        const status = isEdit ? bulgu.status : 'Açık';
        const cozumOnaylayanKullanici = isEdit ? (bulgu.cozumOnaylayanKullanici || '') : '';
        const cozumOnayTarihi = isEdit ? (bulgu.cozumOnayTarihi || '') : '';

        const vendorOptions = vendors.map(v => `<option value="${v.id}" ${v.id == selectedVendorId ? 'selected' : ''}>${v.name}</option>`).join('');
        const BULGU_TIPLERI = ['Program Hatası', 'Yeni Talep'];
        const ETKI_SEVIYELERI = ['Yüksek', 'Orta', 'Düşük'];
        const STATUSLAR = ['Açık', 'Test Edilecek', 'Kapalı'];
        const tipOptions = BULGU_TIPLERI.map(t => `<option value="${t}" ${t === selectedBulguTipi ? 'selected' : ''}>${t}</option>`).join('');
        const etkiOptions = ETKI_SEVIYELERI.map(e => `<option value="${e}" ${e === selectedEtkiSeviyesi ? 'selected' : ''}>${e}</option>`).join('');
        const statusOptions = STATUSLAR.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('');

        return `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50">
                <div class="relative mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
                    <div class="mt-3">
                        <h3 class="text-lg text-center leading-6 font-medium text-gray-900">${title}</h3>
                        <form id="${formId}" class="mt-4 px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-[80vh] overflow-y-auto">
                            <div class="col-span-full"><label class="text-sm font-medium">Başlık</label><input type="text" name="baslik" value="${baslik}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div><label class="text-sm font-medium">İlgili Vendor</label><select id="bulgu-vendor-select" name="vendorId" ${isEdit ? 'disabled' : ''} required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option>${vendorOptions}</select></div>
                            <div><label class="text-sm font-medium">Çözüm Beklenen Versiyon</label><select id="bulgu-version-select" name="cozumVersiyonId" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option></select></div>
                            <div class="col-span-full">
                                <label class="text-sm font-medium">Etkilenen Modeller</label>
                                <div class="flex items-center justify-between mt-1 mb-2">
                                    <div class="text-xs text-gray-500">Vendor'a ait modelleri seçin</div>
                                    <div class="text-xs"><input type="checkbox" id="bulgu-select-all-models" class="mr-1 align-middle"><label for="bulgu-select-all-models" class="align-middle">Tümünü seç</label></div>
                                </div>
                                <div id="bulgu-models-checklist" class="mt-1 max-h-32 overflow-y-auto border p-2 rounded-md grid grid-cols-2 md:grid-cols-3 gap-2"></div>
                            </div>
                            <div><label class="text-sm font-medium">Kayıt Tipi</label><select name="bulguTipi" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option>${tipOptions}</select></div>
                            <div><label class="text-sm font-medium">Etki Seviyesi</label><select name="etkiSeviyesi" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option>${etkiOptions}</select></div>
                            <div><label class="text-sm font-medium">Durum</label><select name="status" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${statusOptions}</select></div>
                            <div><label class="text-sm font-medium">Tespit Tarihi</label><input type="date" name="tespitTarihi" value="${tespitTarihi}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="col-span-full"><label class="text-sm font-medium">Detaylı Açıklama</label><textarea name="detayliAciklama" rows="4" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${detayliAciklama}</textarea></div>
                            <div><label class="text-sm font-medium">Giren Kişi</label><input type="text" name="girenKullanici" value="${girenKullanici}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div><label class="text-sm font-medium">Vendor Takip No</label><input type="text" name="vendorTrackerNo" value="${vendorTrackerNo}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div id="bulgu-approval-container" class="col-span-full ${status !== 'Kapalı' ? 'hidden' : ''}">
                                <div class="md:grid md:grid-cols-2 md:gap-x-4">
                                    <div><label class="text-sm font-medium">Onaylayan Kişi</label><input type="text" name="cozumOnaylayanKullanici" value="${cozumOnaylayanKullanici}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                                    <div><label class="text-sm font-medium">Onay Tarihi</label><input type="date" name="cozumOnayTarihi" value="${cozumOnayTarihi}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                                </div>
                            </div>
                        </form>
                        <div class="items-center px-4 py-3 text-right">
                            <button id="cancel-modal" class="px-4 py-2 bg-gray-200 rounded-md mr-2">İptal</button>
                            <button form="${formId}" type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md">${buttonText}</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function getVendorModalHTML(vendor = null) {
        const isEdit = vendor !== null;
        const title = isEdit ? 'Vendor Düzenle' : 'Yeni Vendor Ekle';
        const buttonText = isEdit ? 'Güncelle' : 'Kaydet';
        const formId = isEdit ? 'edit-vendor-form' : 'add-vendor-form';
        const vendorName = isEdit ? vendor.name : '';
        const vendorCode = isEdit ? vendor.makeCode : '';
        return `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50">
                <div class="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">${title}</h3>
                        <form id="${formId}" class="mt-2 px-7 py-3 space-y-4">
                            <div class="text-left"><label class="text-sm font-medium">Vendor Adı</label><input type="text" name="name" value="${vendorName}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="text-left"><label class="text-sm font-medium">Vendor Kodu</label><input type="text" name="makeCode" value="${vendorCode}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                        </form>
                        <div class="items-center px-4 py-3">
                            <button id="cancel-modal" class="px-4 py-2 bg-gray-200 rounded-md mr-2">İptal</button>
                            <button form="${formId}" type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md">${buttonText}</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    
    function getModelModalHTML(vendors, model = null) {
        const isEdit = model !== null;
        const title = isEdit ? 'Model Düzenle' : 'Yeni Model Ekle';
        const buttonText = isEdit ? 'Güncelle' : 'Kaydet';
        const formId = isEdit ? 'edit-model-form' : 'add-model-form';
        const modelName = isEdit ? model.name : '';
        const modelCode = isEdit ? (model.code || '') : '';
        const vendorOptions = vendors.map(v => `<option value="${v.id}" ${isEdit && v.id === model.vendorId ? 'selected' : ''}>${v.name}</option>`).join('');

        return `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50">
                <div class="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">${title}</h3>
                        <form id="${formId}" class="mt-2 px-7 py-3 space-y-4">
                            <div class="text-left"><label class="text-sm font-medium">Model Adı</label><input type="text" name="name" value="${modelName}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="text-left"><label class="text-sm font-medium">Model Kodu</label><input type="text" name="code" value="${modelCode}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="text-left"><label class="text-sm font-medium">Ait Olduğu Vendor</label><select name="vendorId" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${vendorOptions}</select></div>
                            <div class="border-t pt-4 mt-4 text-left">
                                <div class="flex items-center space-x-2"><input type="checkbox" id="isTechpos" name="isTechpos" ${isEdit && model.isTechpos ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300"><label for="isTechpos" class="text-sm font-medium">TechPOS mu?</label></div>
                                <div class="flex items-center space-x-2"><input type="checkbox" id="isAndroidPos" name="isAndroidPos" ${isEdit && model.isAndroidPos ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300"><label for="isAndroidPos" class="text-sm font-medium">Android POS mu?</label></div>
                                <div class="flex items-center space-x-2"><input type="checkbox" id="isOkcPos" name="isOkcPos" ${isEdit && model.isOkcPos ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300"><label for="isOkcPos" class="text-sm font-medium">ÖKC POS mu?</label></div>
                            </div>
                        </form>
                        <div class="items-center px-4 py-3">
                            <button id="cancel-modal" class="px-4 py-2 bg-gray-200 rounded-md mr-2">İptal</button>
                            <button form="${formId}" type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md">${buttonText}</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function getVersionModalHTML(vendors, models, version = null) {
        const isEdit = version !== null;
        const title = isEdit ? 'Versiyon Düzenle' : 'Yeni Versiyon Ekle';
        const buttonText = isEdit ? 'Güncelle' : 'Kaydet';
        const formId = isEdit ? 'edit-version-form' : 'add-version-form';
        const versionNumber = isEdit ? version.versionNumber : '';
        const deliveryDate = isEdit ? version.deliveryDate : '';
        const status = isEdit ? version.status : 'Test';
        const prodOnayDate = isEdit ? (version.prodOnayDate || '') : '';
        const selectedVendorId = isEdit ? version.vendorId : null;
        const vendorOptions = vendors.map(v => `<option value="${v.id}" ${isEdit && v.id === selectedVendorId ? 'selected' : ''}>${v.name}</option>`).join('');
        return `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50">
                <div class="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">${title}</h3>
                        <form id="${formId}" class="mt-2 px-7 py-3 space-y-4">
                            <div class="text-left"><label class="text-sm font-medium">Ait Olduğu Vendor</label><select id="version-vendor-select" name="vendorId" ${isEdit ? 'disabled' : ''} required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option>${vendorOptions}</select></div>
                            <div class="text-left"><label class="text-sm font-medium">Versiyon Numarası</label><input type="text" name="versionNumber" value="${versionNumber}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="text-left"><label class="text-sm font-medium">Teslim Tarihi</label><input type="date" name="deliveryDate" value="${deliveryDate}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="text-left"><label class="text-sm font-medium">Durum</label><select id="version-status-select" name="status" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="Test" ${status === 'Test' ? 'selected' : ''}>Test</option><option value="Prod" ${status === 'Prod' ? 'selected' : ''}>Prod</option></select></div>
                            <div id="prod-date-container" class="text-left ${status !== 'Prod' ? 'hidden' : ''}"><label class="text-sm font-medium">Prod Onay Tarihi</label><input type="date" name="prodOnayDate" value="${prodOnayDate}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="text-left"><label class="text-sm font-medium">Geçerli Modeller</label>
                                <div class="mt-1 mb-2 flex items-center space-x-2"><input type="checkbox" id="version-select-all-models" class="h-4 w-4 rounded border-gray-300"><label for="version-select-all-models" class="text-sm">Tümünü seç</label></div>
                                <div id="version-models-checklist" class="mt-1 max-h-32 overflow-y-auto border p-2 rounded-md"></div>
                            </div>
                        </form>
                        <div class="items-center px-4 py-3">
                            <button id="cancel-modal" class="px-4 py-2 bg-gray-200 rounded-md mr-2">İptal</button>
                            <button form="${formId}" type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md">${buttonText}</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function getBulguViewModalHTML(bulgu) {
        const vendorName = bulgu.vendorName || (vendorsData.find(v => v.id == bulgu.vendorId)?.name) || '';
        const versionName = bulgu.cozumVersiyonId ? (versionsData.find(v => v.id == bulgu.cozumVersiyonId)?.versionNumber || '-') : '-';
        const modelsList = bulgu.models || (bulgu.modelIds ? (Array.isArray(bulgu.modelIds) ? bulgu.modelIds.map(id => modelsData.find(m => String(m.id) === String(id))?.name).filter(Boolean).join(', ') : bulgu.modelIds) : '-');
        // Render models as chips for nicer presentation
        const modelChips = modelsList && modelsList !== '-' ? modelsList.split(',').map(m => `<span class="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded mr-1 mb-1 text-xs">${m.trim()}</span>`).join('') : '-';
        return `
            <div class="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center">
                <div class="relative w-full max-w-3xl bg-white rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden">
                    <div class="flex items-start justify-between p-6 border-b">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">Bulgu Detayları</h3>
                            <p class="text-sm text-gray-500 mt-1">#${bulgu.id} — ${bulgu.baslik}</p>
                        </div>
                        <button data-close-bulgu-view class="inline-flex items-center justify-center h-9 w-9 rounded-md text-gray-500 hover:bg-gray-100">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                        </button>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                            <div>
                                <div class="text-xs text-gray-500">Vendor</div>
                                <div class="mt-1 font-medium text-gray-900">${vendorName}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Çözüm Beklenen Versiyon</div>
                                <div class="mt-1 font-medium text-gray-900">${versionName || '-'}</div>
                            </div>
                            <div class="md:col-span-2">
                                <div class="text-xs text-gray-500">Modeller</div>
                                <div class="mt-2">${modelChips}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Kayıt Tipi</div>
                                <div class="mt-1">${bulgu.bulguTipi}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Etki Seviyesi</div>
                                <div class="mt-1">${bulgu.etkiSeviyesi}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Durum</div>
                                <div class="mt-1">${bulgu.status}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Tespit Tarihi</div>
                                <div class="mt-1">${bulgu.tespitTarihi || '-'}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Giren Kişi</div>
                                <div class="mt-1">${bulgu.girenKullanici || '-'}</div>
                            </div>
                            <div class="md:col-span-2">
                                <div class="text-xs text-gray-500">Detaylı Açıklama</div>
                                <div class="mt-2 whitespace-pre-wrap text-gray-800">${bulgu.detayliAciklama || '-'}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Onaylayan Kişi</div>
                                <div class="mt-1">${bulgu.cozumOnaylayanKullanici || '-'}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Onay Tarihi</div>
                                <div class="mt-1">${bulgu.cozumOnayTarihi || '-'}</div>
                            </div>
                            <div>
                                <div class="text-xs text-gray-500">Vendor Takip No</div>
                                <div class="mt-1">${bulgu.vendorTrackerNo || '-'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                        <button data-close-bulgu-view class="px-4 py-2 rounded-md bg-white border text-sm text-gray-700 hover:bg-gray-100">Kapat</button>
                    </div>
                </div>
            </div>`;
    }

    function getDeleteConfirmModalHTML(title, description) {
         return `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full flex items-center justify-center z-50">
                <div class="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">${title}</h3>
                        <p class="text-sm text-gray-500 mt-2 px-7 py-3">${description}</p>
                        <div class="items-center px-4 py-3">
                            <button id="cancel-delete" class="px-4 py-2 bg-gray-200 rounded-md mr-2">İptal</button>
                            <button id="confirm-delete" class="px-4 py-2 bg-red-500 text-white rounded-md">Evet, Sil</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function getYonetimHTML(vendors, models, versions, activeTab) {
        const getSortIcon = (sortState, key) => (sortState.key !== key) ? '<span>&nbsp;</span>' : (sortState.direction === 'asc' ? '▲' : '▼');
        const boolToText = (value) => value ? 'Evet' : 'Hayır';
        const vendorsTableRows = vendors.map(vendor => `
            <tr class="border-b"><td class="p-3">${vendor.id}</td><td class="p-3 font-medium">${vendor.name}</td><td class="p-3">${vendor.makeCode}</td><td class="p-3 text-right">
                <button class="edit-vendor-btn p-1 text-sm text-blue-600" data-vendor-id="${vendor.id}">Düzenle</button>
                <button class="delete-vendor-btn p-1 text-sm text-red-600" data-vendor-id="${vendor.id}" data-vendor-name="${vendor.name}">Sil</button>
            </td></tr>`).join('');
        const modelsTableRows = models.map(model => `
             <tr class="border-b">
                <td class="p-3">${model.id}</td><td class="p-3 font-medium">${model.name}</td><td class="p-3">${model.code || ''}</td>
                <td class="p-3">${model.vendorName}</td>
                <td class="p-3 text-center">${boolToText(model.isTechpos)}</td>
                <td class="p-3 text-center">${boolToText(model.isAndroidPos)}</td>
                <td class="p-3 text-center">${boolToText(model.isOkcPos)}</td>
                <td class="p-3 text-right">
                    <button class="edit-model-btn p-1 text-sm text-blue-600" data-model-id="${model.id}">Düzenle</button>
                    <button class="delete-model-btn p-1 text-sm text-red-600" data-model-id="${model.id}" data-model-name="${model.name}">Sil</button>
                </td>
             </tr>`).join('');
        const versionsTableRows = versions.map(version => {
            const statusClass = version.status === 'Prod' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            return `
             <tr class="border-b"><td class="p-3 font-medium">${version.versionNumber}</td><td class="p-3">${version.vendorName}</td><td class="p-3">${version.deliveryDate}</td><td class="p-3 text-xs text-gray-600">${version.models || ''}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${version.status}</span></td><td class="p-3">${version.prodOnayDate || '-'}</td>
                <td class="p-3 text-right">
                    <button class="edit-version-btn p-1 text-sm text-blue-600" data-version-id="${version.id}">Düzenle</button>
                    <button class="delete-version-btn p-1 text-sm text-red-600" data-version-id="${version.id}" data-version-number="${version.versionNumber}">Sil</button>
                </td></tr>`;
        }).join('');
        const modelFilterBarHTML = `
            <div class="flex flex-wrap items-center gap-2 mb-4 p-4 border rounded-md bg-gray-50">
                <input id="model-search-input" type="text" placeholder="Model adı/kodu ara..." class="flex-grow px-3 py-2 text-sm border border-gray-300 rounded-md" style="min-width: 200px;">
                <select id="model-vendor-filter" class="px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="all">Tüm Vendorlar</option>
                    ${vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                </select>
                <select id="model-techpos-filter" class="px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="all">TechPOS (Tümü)</option><option value="1">Evet</option><option value="0">Hayır</option>
                </select>
                <select id="model-android-filter" class="px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="all">Android (Tümü)</option><option value="1">Evet</option><option value="0">Hayır</option>
                </select>
                <select id="model-okc-filter" class="px-3 py-2 text-sm border border-gray-300 rounded-md">
                    <option value="all">ÖKC (Tümü)</option><option value="1">Evet</option><option value="0">Hayır</option>
                </select>
                <button id="clear-model-filters-btn" class="px-3 py-2 text-sm border bg-gray-200 hover:bg-gray-300 rounded-md">Temizle</button>
            </div>
        `;
        return `
            <h1 class="text-3xl font-bold mb-6">Yönetim Paneli</h1>
            <div class="bg-white rounded-lg shadow">
                <div class="border-b"><nav class="-mb-px flex space-x-6 px-6">
                    <button class="tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'vendors' ? 'active' : ''}" data-tab="vendors">Vendorlar</button>
                    <button class="tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'models' ? 'active' : ''}" data-tab="models">Modeller</button>
                    <button class="tab-btn py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'versions' ? 'active' : ''}" data-tab="versions">Versiyonlar</button>
                </nav></div>
                <div class="p-6">
                    <div id="vendors-tab" class="tab-content ${activeTab === 'vendors' ? 'active' : ''}">
                        <div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Vendor Tanımları</h2><button id="add-vendor-btn" class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md">Yeni Vendor Ekle</button></div>
                        <div class="rounded-md border"><table class="w-full text-sm"><thead><tr class="border-b">
                            <th class="p-3 text-left sortable-header" data-table="vendors" data-sort-key="id">ID ${getSortIcon(vendorSort, 'id')}</th>
                            <th class="p-3 text-left sortable-header" data-table="vendors" data-sort-key="name">Vendor Adı ${getSortIcon(vendorSort, 'name')}</th>
                            <th class="p-3 text-left sortable-header" data-table="vendors" data-sort-key="makeCode">Vendor Kodu ${getSortIcon(vendorSort, 'makeCode')}</th>
                            <th class="p-3 text-right">İşlemler</th></tr></thead><tbody>${vendorsTableRows}</tbody></table></div>
                    </div>
                    <div id="models-tab" class="tab-content ${activeTab === 'models' ? 'active' : ''}">
                         <div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Model Tanımları</h2><button id="add-model-btn" class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md">Yeni Model Ekle</button></div>
                         ${modelFilterBarHTML}
                        <div class="rounded-md border"><table class="w-full text-sm"><thead><tr class="border-b">
                            <th class="p-3 text-left sortable-header" data-table="models" data-sort-key="id">ID ${getSortIcon(modelSort, 'id')}</th>
                            <th class="p-3 text-left sortable-header" data-table="models" data-sort-key="name">Model Adı ${getSortIcon(modelSort, 'name')}</th>
                            <th class="p-3 text-left sortable-header" data-table="models" data-sort-key="code">Model Kodu ${getSortIcon(modelSort, 'code')}</th>
                            <th class="p-3 text-left sortable-header" data-table="models" data-sort-key="vendorName">Vendor ${getSortIcon(modelSort, 'vendorName')}</th>
                            <th class="p-3 text-center">TechPOS</th>
                            <th class="p-3 text-center">Android</th>
                            <th class="p-3 text-center">ÖKC</th>
                            <th class="p-3 text-right">İşlemler</th></tr></thead><tbody>${modelsTableRows}</tbody></table></div>
                    </div>
                    <div id="versions-tab" class="tab-content ${activeTab === 'versions' ? 'active' : ''}">
                        <div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold">Versiyon Tanımları</h2><button id="add-version-btn" class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md">Yeni Versiyon Ekle</button></div>
                        <div class="rounded-md border"><table class="w-full text-sm"><thead><tr class="border-b">
                            <th class="p-3 text-left">Versiyon No</th><th class="p-3 text-left">Vendor</th><th class="p-3 text-left">Teslim Tarihi</th><th class="p-3 text-left">Geçerli Modeller</th>
                            <th class="p-3 text-left">Durum</th><th class="p-3 text-left">Prod Onay Tarihi</th>
                            <th class="p-3 text-right">İşlemler</th></tr></thead><tbody>${versionsTableRows}</tbody></table></div>
                    </div>
                </div>
            </div>`;
    }

    // --- VERİ ÇEKME VE SAYFA GÜNCELLEME ---
    async function renderYonetimPage() {
        if (vendorsData.length === 0 || modelsData.length === 0 || versionsData.length === 0) {
             [vendorsData, modelsData, versionsData] = await Promise.all([ 
                apiRequest('/api/vendors'), 
                apiRequest('/api/models'),
                apiRequest('/api/versions') 
            ]);
        }
        const filteredModels = modelsData.filter(model => {
            const searchTermMatch = model.name.toLowerCase().includes(modelFilters.searchTerm.toLowerCase()) || 
                                    (model.code && model.code.toLowerCase().includes(modelFilters.searchTerm.toLowerCase()));
            const vendorMatch = modelFilters.vendorId === 'all' || model.vendorId == modelFilters.vendorId;
            const techposMatch = modelFilters.isTechpos === 'all' || model.isTechpos == modelFilters.isTechpos;
            const androidMatch = modelFilters.isAndroidPos === 'all' || model.isAndroidPos == modelFilters.isAndroidPos;
            const okcMatch = modelFilters.isOkcPos === 'all' || model.isOkcPos == modelFilters.isOkcPos;
            return searchTermMatch && vendorMatch && techposMatch && androidMatch && okcMatch;
        });
        const sortedVendors = sortData(vendorsData, vendorSort);
        const sortedModels = sortData(filteredModels, modelSort);
        mainContent.innerHTML = getYonetimHTML(sortedVendors, sortedModels, versionsData, currentActiveTab);
        attachYonetimEventListeners();
    }
    
    async function renderBulgularPage() {
        // Load caches if empty (avoid refetching on every filter interaction)
        if (!vendorsData.length || !modelsData.length || !versionsData.length) {
            [vendorsData, modelsData, versionsData] = await Promise.all([
                apiRequest('/api/vendors'),
                apiRequest('/api/models'),
                apiRequest('/api/versions'),
            ]);
        }
        if (!bulgularData.length) {
            bulgularData = await apiRequest('/api/bulgular');
        }
        // Apply client-side filters
        const filtered = bulgularData.filter(b => {
            const term = bulguFilters.searchTerm.trim().toLowerCase();
            if (term) {
                const inTitle = (b.baslik || '').toLowerCase().includes(term);
                const inDesc = (b.detayliAciklama || '').toLowerCase().includes(term);
                if (!inTitle && !inDesc) return false;
            }
            if (bulguFilters.vendorId !== 'all' && String(bulguFilters.vendorId) !== String(b.vendorId)) return false;
            if (bulguFilters.status !== 'all' && bulguFilters.status !== b.status) return false;
            if (bulguFilters.tip !== 'all' && bulguFilters.tip !== b.bulguTipi) return false;
            return true;
        });
        mainContent.innerHTML = getBulgularHTML(filtered);
        attachBulgularEventListeners();
    }

    async function loadSidebarVendors() {
        try {
            const vendors = await apiRequest('/api/vendors');
            sidebarVendorList.innerHTML = ''; 
            vendors.forEach(vendor => {
                const link = document.createElement('a'); link.href = '#'; link.className = 'sidebar-link text-sm'; link.textContent = vendor.name;
                sidebarVendorList.appendChild(link);
            });
        } catch (error) {
            sidebarVendorList.innerHTML = '<p class="text-red-500 text-xs px-3">Yüklenemedi.</p>';
        }
    }
    
    // --- OLAY YÖNETİMİ (EVENT HANDLING) ---
    function attachYonetimEventListeners() {
        document.getElementById('add-vendor-btn')?.addEventListener('click', () => { modalContainer.innerHTML = getVendorModalHTML(); attachVendorModalListeners(); });
        document.querySelectorAll('.edit-vendor-btn').forEach(button => {
            button.addEventListener('click', () => {
                const vendorToEdit = vendorsData.find(v => v.id == button.dataset.vendorId);
                if (vendorToEdit) { modalContainer.innerHTML = getVendorModalHTML(vendorToEdit); attachVendorModalListeners(vendorToEdit); }
            });
        });
        document.querySelectorAll('.delete-vendor-btn').forEach(button => {
            button.addEventListener('click', () => {
                const vendorId = button.dataset.vendorId;
                const vendorName = button.dataset.vendorName;
                modalContainer.innerHTML = getDeleteConfirmModalHTML(`"${vendorName}" Silinsin mi?`, 'Bu işlem geri alınamaz.');
                document.getElementById('cancel-delete').addEventListener('click', () => modalContainer.innerHTML = '');
                document.getElementById('confirm-delete').addEventListener('click', async () => {
                    try {
                        await apiRequest(`/api/vendors/${vendorId}`, { method: 'DELETE' });
                        // Invalidate vendors cache and refresh
                        vendorsData = [];
                        await Promise.all([loadSidebarVendors(), navigateTo('yonetim')]);
                    } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
                });
            });
        });
        document.getElementById('add-model-btn')?.addEventListener('click', () => { modalContainer.innerHTML = getModelModalHTML(vendorsData); attachModelModalListeners(); });
        document.querySelectorAll('.edit-model-btn').forEach(button => {
            button.addEventListener('click', () => {
                const modelToEdit = modelsData.find(m => m.id == button.dataset.modelId);
                if (modelToEdit) { modalContainer.innerHTML = getModelModalHTML(vendorsData, modelToEdit); attachModelModalListeners(modelToEdit); }
            });
        });
         document.querySelectorAll('.delete-model-btn').forEach(button => {
            button.addEventListener('click', () => {
                const modelId = button.dataset.modelId;
                const modelName = button.dataset.modelName;
                modalContainer.innerHTML = getDeleteConfirmModalHTML(`"${modelName}" Silinsin mi?`, 'Bu işlem geri alınamaz.');
                document.getElementById('cancel-delete').addEventListener('click', () => modalContainer.innerHTML = '');
                document.getElementById('confirm-delete').addEventListener('click', async () => {
                    try {
                        await apiRequest(`/api/models/${modelId}`, { method: 'DELETE' });
                        // Invalidate models cache and refresh
                        modelsData = [];
                        await navigateTo('yonetim');
                    } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
                });
            });
        });
        document.getElementById('add-version-btn')?.addEventListener('click', () => {
            modalContainer.innerHTML = getVersionModalHTML(vendorsData, modelsData);
            attachVersionModalListeners();
        });
        document.querySelectorAll('.edit-version-btn').forEach(button => {
            button.addEventListener('click', () => {
                const versionToEdit = versionsData.find(v => v.id == button.dataset.versionId);
                if (versionToEdit) {
                    modalContainer.innerHTML = getVersionModalHTML(vendorsData, modelsData, versionToEdit);
                    attachVersionModalListeners(versionToEdit);
                }
            });
        });
        document.querySelectorAll('.delete-version-btn').forEach(button => {
            button.addEventListener('click', () => {
                const versionId = button.dataset.versionId;
                const versionNumber = button.dataset.versionNumber;
                modalContainer.innerHTML = getDeleteConfirmModalHTML(`"${versionNumber}" versiyonu silinsin mi?`, 'Bu işlem geri alınamaz.');
                document.getElementById('cancel-delete').addEventListener('click', () => modalContainer.innerHTML = '');
                document.getElementById('confirm-delete').addEventListener('click', async () => {
                    try {
                        await apiRequest(`/api/versions/${versionId}`, { method: 'DELETE' });
                        // Invalidate versions cache and refresh
                        versionsData = [];
                        await navigateTo('yonetim');
                    } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
                });
            });
        });
        document.getElementById('model-search-input')?.addEventListener('input', (e) => {
            modelFilters.searchTerm = e.target.value;
            renderYonetimPage();
        });
        document.getElementById('model-vendor-filter')?.addEventListener('change', (e) => {
            modelFilters.vendorId = e.target.value;
            renderYonetimPage();
        });
        document.getElementById('model-techpos-filter')?.addEventListener('change', (e) => {
            modelFilters.isTechpos = e.target.value;
            renderYonetimPage();
        });
         document.getElementById('model-android-filter')?.addEventListener('change', (e) => {
            modelFilters.isAndroidPos = e.target.value;
            renderYonetimPage();
        });
        document.getElementById('model-okc-filter')?.addEventListener('change', (e) => {
            modelFilters.isOkcPos = e.target.value;
            renderYonetimPage();
        });
        document.getElementById('clear-model-filters-btn')?.addEventListener('click', () => {
            modelFilters = { searchTerm: '', vendorId: 'all', isTechpos: 'all', isAndroidPos: 'all', isOkcPos: 'all' };
            renderYonetimPage();
        });
        document.querySelectorAll('.sortable-header').forEach(header => {
            header.addEventListener('click', () => {
                const table = header.dataset.table;
                const key = header.dataset.sortKey;
                const sortState = table === 'vendors' ? vendorSort : modelSort;
                if (sortState.key === key) { sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc'; } 
                else { sortState.key = key; sortState.direction = 'asc'; }
                renderYonetimPage();
            });
        });
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTabId = button.dataset.tab + '-tab';
                currentActiveTab = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.id === targetTabId ? content.classList.add('active') : content.classList.remove('active'));
            });
        });
         // Filtrelerin mevcut değerlerini her render sonrası ayarla
        document.getElementById('model-search-input').value = modelFilters.searchTerm;
        document.getElementById('model-vendor-filter').value = modelFilters.vendorId;
        document.getElementById('model-techpos-filter').value = modelFilters.isTechpos;
        document.getElementById('model-android-filter').value = modelFilters.isAndroidPos;
        document.getElementById('model-okc-filter').value = modelFilters.isOkcPos;
    }

    function attachBulgularEventListeners() {
        document.getElementById('add-bulgu-btn')?.addEventListener('click', () => {
            modalContainer.innerHTML = getBulguModalHTML(vendorsData, modelsData, versionsData);
            attachBulguModalListeners();
        });
        // View detail handler for ID links
        document.querySelectorAll('.view-bulgu-btn').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.dataset.bulguId;
                const bulgu = bulgularData.find(b => String(b.id) === String(id));
                if (bulgu) {
                    modalContainer.innerHTML = getBulguViewModalHTML(bulgu);
                    document.querySelectorAll('[data-close-bulgu-view]').forEach(btn => btn.addEventListener('click', () => modalContainer.innerHTML = ''));
                }
            });
        });
        document.querySelectorAll('.edit-bulgu-btn').forEach(button => {
            button.addEventListener('click', () => {
                const bulguToEdit = bulgularData.find(b => b.id == button.dataset.bulguId);
                if(bulguToEdit) {
                    modalContainer.innerHTML = getBulguModalHTML(vendorsData, modelsData, versionsData, bulguToEdit);
                    attachBulguModalListeners(bulguToEdit);
                }
            });
        });
        document.querySelectorAll('.delete-bulgu-btn').forEach(button => {
            button.addEventListener('click', () => {
                const bulguId = button.dataset.bulguId;
                const bulguBaslik = button.dataset.bulguBaslik;
                modalContainer.innerHTML = getDeleteConfirmModalHTML(`"${bulguBaslik}" kaydı silinsin mi?`, 'Bu işlem geri alınamaz.');
                document.getElementById('cancel-delete').addEventListener('click', () => modalContainer.innerHTML = '');
                document.getElementById('confirm-delete').addEventListener('click', async () => {
                    try {
                        await apiRequest(`/api/bulgular/${bulguId}`, { method: 'DELETE' });
                        await navigateTo('bulgular');
                    } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
                });
            });
        });
    // Bulgu filters wiring
        const searchInput = document.getElementById('bulgu-search-input');
    const vendorFilter = document.getElementById('bulgu-vendor-filter');
    const statusFilter = document.getElementById('bulgu-status-filter');
    const tipFilter = document.getElementById('bulgu-tip-filter');
        // Debounced search: avoid re-rendering on every keystroke which causes the input to lose focus
        if (searchInput) {
            let bulguSearchDebounce = null;
            searchInput.addEventListener('input', (e) => {
                bulguFilters.searchTerm = e.target.value;
                // preserve caret position to restore after re-render
                const caretPos = e.target.selectionStart || e.target.value.length;
                if (bulguSearchDebounce) clearTimeout(bulguSearchDebounce);
                bulguSearchDebounce = setTimeout(async () => {
                    bulguSearchDebounce = null;
                    await renderBulgularPage();
                    const next = document.getElementById('bulgu-search-input');
                    if (next) {
                        try { next.focus(); next.setSelectionRange(caretPos, caretPos); } catch (err) { next.focus(); }
                    }
                }, 300);
            });
        }
    if (vendorFilter) vendorFilter.addEventListener('change', (e) => { bulguFilters.vendorId = e.target.value; renderBulgularPage(); });
    if (statusFilter) statusFilter.addEventListener('change', (e) => { bulguFilters.status = e.target.value; renderBulgularPage(); });
    if (tipFilter) tipFilter.addEventListener('change', (e) => { bulguFilters.tip = e.target.value; renderBulgularPage(); });
    // Restore filter values after each render
    if (searchInput) searchInput.value = bulguFilters.searchTerm;
    if (vendorFilter) vendorFilter.value = bulguFilters.vendorId;
    if (statusFilter) statusFilter.value = bulguFilters.status;
    if (tipFilter) tipFilter.value = bulguFilters.tip;
    }


    function attachVendorModalListeners(vendor = null) {
        const form = document.getElementById(vendor ? 'edit-vendor-form' : 'add-vendor-form');
        document.getElementById('cancel-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(form).entries());
                const url = vendor ? `/api/vendors/${vendor.id}` : '/api/vendors';
                const method = vendor ? 'PUT' : 'POST';
                try {
                        await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        // Invalidate cached vendors so renderYonetimPage reloads latest data
                        vendorsData = [];
                        await Promise.all([loadSidebarVendors(), navigateTo('yonetim')]);
                } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
            });
        }
    }

    function attachModelModalListeners(model = null) {
        const form = document.getElementById(model ? 'edit-model-form' : 'add-model-form');
        document.getElementById('cancel-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = {
                    name: formData.get('name'), code: formData.get('code'),
                    vendorId: formData.get('vendorId'), isTechpos: formData.has('isTechpos'),
                    isAndroidPos: formData.has('isAndroidPos'), isOkcPos: formData.has('isOkcPos'),
                };
                const url = model ? `/api/models/${model.id}` : '/api/models';
                const method = model ? 'PUT' : 'POST';
                try {
                    await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                    // Invalidate models cache so the Yönetim page fetches fresh data
                    modelsData = [];
                    await navigateTo('yonetim');
                } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
            });
        }
    }
    
    function attachVersionModalListeners(version = null) {
        const isEdit = version !== null;
        const form = document.getElementById(isEdit ? 'edit-version-form' : 'add-version-form');
        const vendorSelect = document.getElementById('version-vendor-select');
        const modelsChecklist = document.getElementById('version-models-checklist');
        const statusSelect = document.getElementById('version-status-select');
        const prodDateContainer = document.getElementById('prod-date-container');
            const updateModelList = (vendorId) => {
             if (!vendorId) {
                modelsChecklist.innerHTML = '<p class="text-xs text-gray-500">Önce vendor seçiniz.</p>'; return;
            }
            const filteredModels = modelsData.filter(m => m.vendorId == vendorId);
            const selectedModelIds = isEdit ? (version.modelIds?.split(',').map(id => id.trim()) || []) : [];
            if (filteredModels.length > 0) {
                modelsChecklist.innerHTML = filteredModels.map(model => `
                    <div class="flex items-center space-x-2"><input type="checkbox" id="model-${model.id}" name="modelIds" value="${model.id}" ${selectedModelIds.includes(String(model.id)) ? 'checked' : ''} class="version-model-checkbox h-4 w-4 rounded border-gray-300"><label for="model-${model.id}" class="text-sm font-medium">${model.name}</label></div>`).join('');
                // Ensure select-all checkbox reflects current selection
                const selectAll = document.getElementById('version-select-all-models');
                if (selectAll) {
                    const allChecked = filteredModels.every(m => selectedModelIds.includes(String(m.id)));
                    selectAll.checked = allChecked;
                }
            } else {
                modelsChecklist.innerHTML = '<p class="text-xs text-gray-500">Bu vendor\'a ait model bulunamadı.</p>';
            }
        };
        document.getElementById('cancel-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
        vendorSelect?.addEventListener('change', (e) => updateModelList(e.target.value));
        // Wire select-all behavior
        const selectAllCheckbox = document.getElementById('version-select-all-models');
        const wireSelectAll = () => {
            if (!selectAllCheckbox) return;
            // Toggle all currently rendered model checkboxes
            selectAllCheckbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('#version-models-checklist .version-model-checkbox').forEach(cb => { cb.checked = checked; });
            });
            // Keep select-all in sync when individual boxes change (event delegation)
            modelsChecklist.addEventListener('change', (e) => {
                if (!e.target.classList.contains('version-model-checkbox')) return;
                const boxes = Array.from(document.querySelectorAll('#version-models-checklist .version-model-checkbox'));
                if (boxes.length === 0) return;
                selectAllCheckbox.checked = boxes.every(b => b.checked);
            });
        };
        // Activate the wiring once so it works for both add and edit flows
        wireSelectAll();
        statusSelect?.addEventListener('change', (e) => {
            prodDateContainer.classList.toggle('hidden', e.target.value !== 'Prod');
        });
        if (isEdit) {
            vendorSelect.value = version.vendorId;
            updateModelList(version.vendorId);
            // After populating model list for edit, ensure select-all wiring is active
            wireSelectAll();
        }
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = {
                    vendorId: formData.get('vendorId'), versionNumber: formData.get('versionNumber'),
                    deliveryDate: formData.get('deliveryDate'), status: formData.get('status'),
                    prodOnayDate: formData.get('prodOnayDate'), modelIds: formData.getAll('modelIds')
                };
                const url = isEdit ? `/api/versions/${version.id}` : '/api/versions';
                const method = isEdit ? 'PUT' : 'POST';
                // Validation: at least one model must be selected
                if (!data.modelIds || data.modelIds.length === 0) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>En az bir model seçili olmalıdır.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                // If editing and status is Prod, require prodOnayDate
                if (isEdit && data.status === 'Prod' && (!data.prodOnayDate || data.prodOnayDate.trim() === '')) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>Durum "Prod" ise "Prod Onay Tarihi" zorunludur.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                // Validate dates are not in the future (compare as local YYYY-MM-DD)
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                if (data.deliveryDate && data.deliveryDate > todayStr) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>"Teslim Tarihi" sistem tarihinden daha ileri olamaz.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                if (data.prodOnayDate && data.prodOnayDate > todayStr) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>"Prod Onay Tarihi" sistem tarihinden daha ileri olamaz.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                try {
                    await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                    // Invalidate versions cache so the Yönetim page fetches fresh data
                    versionsData = [];
                    await navigateTo('yonetim');
                } catch (error) {
                    showErrorModal(error.message);
                } finally {
                    modalContainer.innerHTML = '';
                }
            });
        }
    }

    function attachBulguModalListeners(bulgu = null) {
        const isEdit = bulgu !== null;
        const form = document.getElementById(isEdit ? 'edit-bulgu-form' : 'add-bulgu-form');
        const vendorSelect = document.getElementById('bulgu-vendor-select');
        const versionSelect = document.getElementById('bulgu-version-select');
        const modelsChecklist = document.getElementById('bulgu-models-checklist');
        const updateLists = (vendorId) => {
            if (!vendorId) {
                modelsChecklist.innerHTML = '<p class="text-xs text-gray-500">Önce vendor seçiniz.</p>';
                versionSelect.innerHTML = '<option value="">Önce vendor seçin</option>';
                return;
            }
            const filteredModels = modelsData.filter(m => m.vendorId == vendorId);
            const filteredVersions = versionsData.filter(v => v.vendorId == vendorId);
            const selectedModelIds = isEdit ? (bulgu.modelIds?.split(',').map(id => id.trim()) || []) : [];
            if (filteredModels.length > 0) {
                modelsChecklist.innerHTML = filteredModels.map(m => `<div class="flex items-center space-x-2"><input type="checkbox" id="bulgu-model-${m.id}" name="modelIds" value="${m.id}" ${selectedModelIds.includes(String(m.id)) ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 model-checkbox"><label for="bulgu-model-${m.id}" class="text-sm font-medium">${m.name}</label></div>`).join('');
                // After inserting, wire select-all and individual checkbox events
                const selectAll = document.getElementById('bulgu-select-all-models');
                const modelCheckboxes = Array.from(modelsChecklist.querySelectorAll('.model-checkbox'));
                // Set selectAll checked state based on model checkboxes
                if (selectAll) selectAll.checked = modelCheckboxes.length > 0 && modelCheckboxes.every(cb => cb.checked);
                // When selectAll toggled, set all model checkboxes
                if (selectAll) {
                    selectAll.onchange = () => {
                        modelCheckboxes.forEach(cb => cb.checked = selectAll.checked);
                    };
                }
                // When any model checkbox changes, update selectAll state
                modelCheckboxes.forEach(cb => cb.addEventListener('change', () => {
                    if (selectAll) selectAll.checked = modelCheckboxes.every(ch => ch.checked);
                }));
            } else {
                modelsChecklist.innerHTML = '<p class="text-xs text-gray-500">Bu vendor\'a ait model bulunamadı.</p>';
                const selectAll = document.getElementById('bulgu-select-all-models');
                if (selectAll) selectAll.checked = false;
            }
            versionSelect.innerHTML = '<option value="">Seçiniz...</option>' + filteredVersions.map(v => `<option value="${v.id}" ${v.id == (isEdit ? bulgu.cozumVersiyonId : null) ? 'selected' : ''}>${v.versionNumber}</option>`).join('');
        };
        document.getElementById('cancel-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
        vendorSelect?.addEventListener('change', (e) => updateLists(e.target.value));
        // Show/hide approval fields when status changes
        const approvalContainer = document.getElementById('bulgu-approval-container');
        const statusSelect = form ? form.querySelector('select[name="status"]') : null;
        const toggleApprovalVisibility = (val) => {
            if (!approvalContainer) return;
            approvalContainer.classList.toggle('hidden', val !== 'Kapalı');
        };
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => toggleApprovalVisibility(e.target.value));
            // initialize visibility for edit mode
            if (isEdit) toggleApprovalVisibility(statusSelect.value);
        }
        if (isEdit) {
            updateLists(bulgu.vendorId);
        }
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                data.modelIds = formData.getAll('modelIds');
                // For new records, require 'girenKullanici'
                if (!isEdit && (!data.girenKullanici || data.girenKullanici.trim() === '')) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>Yeni kayıt eklerken "Giren Kişi" alanı zorunludur.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                if (data.status === 'Kapalı') {
                    const missing = [];
                    if (!data.cozumOnayTarihi) missing.push('Onay Tarihi');
                    if (!data.cozumOnaylayanKullanici) missing.push('Onaylayan Kişi');
                    if (missing.length > 0) {
                        // Show inline validation error inside the current modal and keep it open
                        const existingErr = modalContainer.querySelector('.inline-error');
                        if (existingErr) existingErr.remove();
                        const errEl = document.createElement('div');
                        errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                        errEl.innerHTML = `
                            <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span>Durum "Kapalı" seçildiğinde şu alanlar zorunludur: ${missing.join(', ')}</span>
                        `;
                        // insert before the form so it's visible to the user
                        form.parentElement.insertBefore(errEl, form);
                        return;
                    }
                }
                // Validate dates are not in the future for bulgu form
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                if (data.tespitTarihi && data.tespitTarihi > todayStr) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>"Tespit Tarihi" sistem tarihinden daha ileri olamaz.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                if (data.cozumOnayTarihi && data.cozumOnayTarihi > todayStr) {
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>"Onay Tarihi" sistem tarihinden daha ileri olamaz.</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                    return;
                }
                const url = isEdit ? `/api/bulgular/${bulgu.id}` : '/api/bulgular';
                const method = isEdit ? 'PUT' : 'POST';
                try {
                    await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                    await navigateTo('bulgular');
                    // Only clear modal on successful submit/navigation
                    modalContainer.innerHTML = '';
                } catch (error) {
                    // Keep modal open so user can fix the input; show inline error above the form
                    const existingErr = modalContainer.querySelector('.inline-error');
                    if (existingErr) existingErr.remove();
                    const errEl = document.createElement('div');
                    errEl.className = 'inline-error mb-3 text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded p-2 flex items-center';
                    errEl.innerHTML = `
                        <svg class="w-4 h-4 mr-2 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span>${error.message}</span>
                    `;
                    form.parentElement.insertBefore(errEl, form);
                }
            });
        }
    }


    // --- BAŞLANGIÇ ---
    loadSidebarVendors();
    navigateTo('dashboard');
});

