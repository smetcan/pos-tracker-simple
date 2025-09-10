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

        const bulgularTableRows = bulgular.map(bulgu => `
            <tr class="border-b">
                <td class="p-3 text-sm text-gray-500">#${bulgu.id}</td>
                <td class="p-3 font-medium">${bulgu.baslik}</td>
                <td class="p-3 text-sm text-gray-600">${bulgu.vendorName || ''}</td>
                <td class="p-3 text-xs text-gray-500">${bulgu.models || '-'}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${getBadgeClass(bulgu.bulguTipi)}">${bulgu.bulguTipi}</span></td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${getBadgeClass(bulgu.etkiSeviyesi)}">${bulgu.etkiSeviyesi}</span></td>
                <td class="p-3"><span class="px-2 py-1 text-xs font-medium rounded-full ${getBadgeClass(bulgu.status)}">${bulgu.status}</span></td>
                <td class="p-3 text-right">
                    <button class="edit-bulgu-btn p-1 text-sm text-blue-600" data-bulgu-id="${bulgu.id}">Düzenle</button>
                    <button class="delete-bulgu-btn p-1 text-sm text-red-600" data-bulgu-id="${bulgu.id}" data-bulgu-baslik="${bulgu.baslik}">Sil</button>
                </td>
            </tr>
        `).join('');

        return `
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h1 class="text-3xl font-bold">Bulgu Takibi</h1>
                    <p class="text-gray-500">Tüm program hatalarını ve yeni talepleri buradan yönetebilirsiniz.</p>
                </div>
                <button id="add-bulgu-btn" class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md">Yeni Bulgu/Talep Ekle</button>
            </div>
            <div class="bg-white rounded-lg shadow">
                <div class="p-6">
                    <div class="rounded-md border">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b bg-gray-50">
                                    <th class="p-3 text-left">ID</th><th class="p-3 text-left">Başlık</th><th class="p-3 text-left">Vendor</th>
                                    <th class="p-3 text-left">Modeller</th><th class="p-3 text-left">Tip</th>
                                    <th class="p-3 text-left">Etki</th><th class="p-3 text-left">Durum</th><th class="p-3 text-right">İşlemler</th>
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
                            <div class="col-span-full"><label class="text-sm font-medium">Etkilenen Modeller</label><div id="bulgu-models-checklist" class="mt-1 max-h-32 overflow-y-auto border p-2 rounded-md grid grid-cols-2 md:grid-cols-3 gap-2"></div></div>
                            <div><label class="text-sm font-medium">Kayıt Tipi</label><select name="bulguTipi" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option>${tipOptions}</select></div>
                            <div><label class="text-sm font-medium">Etki Seviyesi</label><select name="etkiSeviyesi" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"><option value="">Seçiniz...</option>${etkiOptions}</select></div>
                            <div><label class="text-sm font-medium">Durum</label><select name="status" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${statusOptions}</select></div>
                            <div><label class="text-sm font-medium">Tespit Tarihi</label><input type="date" name="tespitTarihi" value="${tespitTarihi}" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div class="col-span-full"><label class="text-sm font-medium">Detaylı Açıklama</label><textarea name="detayliAciklama" rows="4" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">${detayliAciklama}</textarea></div>
                            <div><label class="text-sm font-medium">Giren Kişi</label><input type="text" name="girenKullanici" value="${girenKullanici}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div><label class="text-sm font-medium">Vendor Takip No</label><input type="text" name="vendorTrackerNo" value="${vendorTrackerNo}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div><label class="text-sm font-medium">Onaylayan Kişi</label><input type="text" name="cozumOnaylayanKullanici" value="${cozumOnaylayanKullanici}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
                            <div><label class="text-sm font-medium">Onay Tarihi</label><input type="date" name="cozumOnayTarihi" value="${cozumOnayTarihi}" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></div>
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
                            <div class="text-left"><label class="text-sm font-medium">Geçerli Modeller</label><div id="version-models-checklist" class="mt-1 max-h-32 overflow-y-auto border p-2 rounded-md"></div></div>
                        </form>
                        <div class="items-center px-4 py-3">
                            <button id="cancel-modal" class="px-4 py-2 bg-gray-200 rounded-md mr-2">İptal</button>
                            <button form="${formId}" type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md">${buttonText}</button>
                        </div>
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
        [vendorsData, modelsData, versionsData, bulgularData] = await Promise.all([
            apiRequest('/api/vendors'),
            apiRequest('/api/models'),
            apiRequest('/api/versions'),
            apiRequest('/api/bulgular'),
        ]);
        mainContent.innerHTML = getBulgularHTML(bulgularData);
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
                    <div class="flex items-center space-x-2"><input type="checkbox" id="model-${model.id}" name="modelIds" value="${model.id}" ${selectedModelIds.includes(String(model.id)) ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300"><label for="model-${model.id}" class="text-sm font-medium">${model.name}</label></div>`).join('');
            } else {
                modelsChecklist.innerHTML = '<p class="text-xs text-gray-500">Bu vendor\'a ait model bulunamadı.</p>';
            }
        };
        document.getElementById('cancel-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
        vendorSelect?.addEventListener('change', (e) => updateModelList(e.target.value));
        statusSelect?.addEventListener('change', (e) => {
            prodDateContainer.classList.toggle('hidden', e.target.value !== 'Prod');
        });
        if (isEdit) {
            vendorSelect.value = version.vendorId;
            updateModelList(version.vendorId);
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
                try {
                    await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                    await navigateTo('yonetim');
                } catch (error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
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
            modelsChecklist.innerHTML = filteredModels.length > 0
                ? filteredModels.map(m => `<div class="flex items-center space-x-2"><input type="checkbox" id="bulgu-model-${m.id}" name="modelIds" value="${m.id}" ${selectedModelIds.includes(String(m.id)) ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300"><label for="bulgu-model-${m.id}" class="text-sm font-medium">${m.name}</label></div>`).join('')
                : '<p class="text-xs text-gray-500">Bu vendor\'a ait model bulunamadı.</p>';
            versionSelect.innerHTML = '<option value="">Seçiniz...</option>' + filteredVersions.map(v => `<option value="${v.id}" ${v.id == (isEdit ? bulgu.cozumVersiyonId : null) ? 'selected' : ''}>${v.versionNumber}</option>`).join('');
        };
        document.getElementById('cancel-modal')?.addEventListener('click', () => modalContainer.innerHTML = '');
        vendorSelect?.addEventListener('change', (e) => updateLists(e.target.value));
        if (isEdit) {
            updateLists(bulgu.vendorId);
        }
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                data.modelIds = formData.getAll('modelIds');
                if (data.status === 'Kapalı' && !data.cozumOnayTarihi) {
                    showErrorModal('Durum "Kapalı" olarak seçildiğinde "Onay Tarihi" girmek zorunludur.');
                    return;
                }
                const url = isEdit ? `/api/bulgular/${bulgu.id}` : '/api/bulgular';
                const method = isEdit ? 'PUT' : 'POST';
                try {
                    await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                    await navigateTo('bulgular');
                } catch(error) { showErrorModal(error.message); } finally { modalContainer.innerHTML = ''; }
            });
        }
    }


    // --- BAŞLANGIÇ ---
    loadSidebarVendors();
    navigateTo('dashboard');
});

