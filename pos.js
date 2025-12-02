document.addEventListener('DOMContentLoaded', () => {
    // State
    let menuData = null;
    let currentTable = null;
    let currentOrder = [];
    let selectedCategory = null;
    let tableOrders = {}; // Map tableId -> orderArray

    // DOM Elements
    const orderListEl = document.getElementById('order-list');
    const totalAmountEl = document.getElementById('total-amount');
    const subtotalAmountEl = document.getElementById('subtotal-amount');
    const categoryListEl = document.getElementById('category-list');
    const productListEl = document.getElementById('product-list');
    const tableOverlay = document.getElementById('table-overlay');
    const tableGrid = document.getElementById('table-grid');
    const currentTableDisplay = document.getElementById('current-table-display');
    const btnCharge = document.getElementById('btn-charge');
    const btnChangeTable = document.getElementById('btn-change-table');

    // Initialization
    init();

    async function init() {
        // Load saved orders
        try {
            const savedOrders = localStorage.getItem('pos_table_orders');
            if (savedOrders) {
                tableOrders = JSON.parse(savedOrders);
            }
        } catch (e) {
            console.error('Error loading saved orders:', e);
            tableOrders = {};
        }

        await loadMenuData();
        renderCategories();
        showTableSelection();
        setupEventListeners();
    }

    async function loadMenuData() {
        try {
            const response = await fetch('menu.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            menuData = await response.json();
            renderCategories(); // Re-render if successful
        } catch (error) {
            console.error('Error loading menu data:', error);
            showManualLoadUI();
        }
    }

    function showManualLoadUI() {
        // Create a modal or overlay to ask for the file
        const overlay = document.createElement('div');
        overlay.className = 'overlay active';
        overlay.style.zIndex = '2000'; // Above everything
        overlay.innerHTML = `
            <div class="overlay-content">
                <h2 style="color: var(--danger)">Error cargando menú</h2>
                <p style="margin-bottom: 2rem; color: var(--text-muted)">No se ha podido cargar 'menu.json' automáticamente.</p>
                <button id="btn-load-manual" class="btn-primary" style="width: auto; padding: 1rem 2rem;">
                    <span class="material-icons">folder_open</span> Seleccionar fichero menu.json
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        const fileInput = document.getElementById('menu-file-input');
        const btnLoad = overlay.querySelector('#btn-load-manual');

        btnLoad.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    menuData = JSON.parse(event.target.result);
                    renderCategories();
                    document.body.removeChild(overlay); // Remove error overlay
                    // If we were stuck at init, we might need to trigger table selection if not already there
                    if (!currentTable) {
                        showTableSelection();
                    }
                } catch (parseError) {
                    alert('Error al leer el archivo JSON: ' + parseError.message);
                }
            };
            reader.readAsText(file);
        };
    }

    function setupEventListeners() {
        btnChangeTable.addEventListener('click', showTableSelection);
        btnCharge.addEventListener('click', handleCharge);
    }

    // --- Table Management ---
    function showTableSelection() {
        renderTables();
        tableOverlay.classList.add('active');
    }

    function renderTables() {
        tableGrid.innerHTML = '';

        // Add Barra (Bar) button first
        const barBtn = document.createElement('div');
        barBtn.className = 'table-btn bar-btn';

        if (currentTable === 'barra') {
            barBtn.classList.add('active-table');
        }

        // Visual indicator for occupied bar
        if (tableOrders['barra'] && tableOrders['barra'].length > 0) {
            barBtn.classList.add('occupied-table');
        }

        barBtn.innerHTML = '<span class="material-icons">local_bar</span><br>Barra';
        barBtn.onclick = () => selectTable('barra');
        tableGrid.appendChild(barBtn);

        // Get table count from localStorage or default to 10
        let tableCount = parseInt(localStorage.getItem('pos_table_count')) || 10;

        for (let i = 1; i <= tableCount; i++) {
            const tableBtn = document.createElement('div');
            tableBtn.className = 'table-btn';

            if (currentTable === i) {
                tableBtn.classList.add('active-table');
            }

            // Visual indicator for occupied tables
            if (tableOrders[i] && tableOrders[i].length > 0) {
                tableBtn.classList.add('occupied-table');
            }

            tableBtn.textContent = `Mesa ${i}`;
            tableBtn.onclick = () => selectTable(i);
            tableGrid.appendChild(tableBtn);
        }

        // Add Control Buttons
        const controlsDiv = document.createElement('div');
        controlsDiv.style.gridColumn = "1 / -1";
        controlsDiv.style.display = "flex";
        controlsDiv.style.justifyContent = "center";
        controlsDiv.style.gap = "1rem";
        controlsDiv.style.marginTop = "1rem";

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary';
        addBtn.innerHTML = '<span class="material-icons">add</span> Añadir Mesa';
        addBtn.onclick = addTable;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-secondary';
        removeBtn.style.color = 'var(--danger)';
        removeBtn.innerHTML = '<span class="material-icons">remove</span> Quitar Mesa';
        removeBtn.onclick = removeTable;

        controlsDiv.appendChild(addBtn);
        controlsDiv.appendChild(removeBtn);
        tableGrid.appendChild(controlsDiv);
    }

    function addTable() {
        let tableCount = parseInt(localStorage.getItem('pos_table_count')) || 10;
        tableCount++;
        localStorage.setItem('pos_table_count', tableCount);
        renderTables();
    }

    function removeTable() {
        let tableCount = parseInt(localStorage.getItem('pos_table_count')) || 10;
        if (tableCount > 1) {
            if (confirm('¿Seguro que quieres eliminar la última mesa?')) {
                // Check if last table has orders
                if (tableOrders[tableCount] && tableOrders[tableCount].length > 0) {
                    if (!confirm('La mesa tiene pedidos pendientes. ¿Eliminar de todas formas?')) {
                        return;
                    }
                    delete tableOrders[tableCount];
                    saveOrders();
                }

                tableCount--;
                localStorage.setItem('pos_table_count', tableCount);
                renderTables();
            }
        } else {
            alert('Debe haber al menos una mesa.');
        }
    }

    function selectTable(tableId) {
        currentTable = tableId;

        // Display appropriate text
        if (tableId === 'barra') {
            currentTableDisplay.textContent = 'Barra';
        } else {
            currentTableDisplay.textContent = `Mesa ${tableId}`;
        }

        tableOverlay.classList.remove('active');

        // Load order for this table
        currentOrder = tableOrders[tableId] || [];
        updateOrderView();
    }

    function saveOrders() {
        localStorage.setItem('pos_table_orders', JSON.stringify(tableOrders));
    }

    // --- Category & Product Rendering ---
    function renderCategories() {
        if (!menuData || !menuData.categories) return;

        categoryListEl.innerHTML = '';
        menuData.categories.forEach((cat, index) => {
            const catEl = document.createElement('div');
            catEl.className = 'category-chip';
            catEl.textContent = cat.name;
            catEl.onclick = () => selectCategory(cat);
            categoryListEl.appendChild(catEl);
        });

        // Auto-select first category if available
        if (menuData.categories.length > 0 && !selectedCategory) {
            selectCategory(menuData.categories[0]);
        }
    }

    function selectCategory(category) {
        selectedCategory = category;

        // Update UI active state
        document.querySelectorAll('.category-chip').forEach(el => {
            el.classList.toggle('active', el.textContent === category.name);
        });

        renderProducts(category);
    }

    function renderProducts(category) {
        productListEl.innerHTML = '';
        if (!category.items) return;

        // Build a map to find products with multiple prices
        const productVariants = new Map();

        // Collect main category items
        category.items.forEach(item => {
            const cleanName = item.name.replace(/^\./, '');
            if (!productVariants.has(cleanName)) {
                productVariants.set(cleanName, []);
            }
            productVariants.get(cleanName).push({
                ...item,
                source: 'main',
                displayPrice: item.price
            });
        });

        // Collect subcategory items
        if (category.subcategories) {
            category.subcategories.forEach(subcat => {
                if (subcat.items) {
                    subcat.items.forEach(item => {
                        const cleanName = item.name.replace(/^\./, '');
                        if (!productVariants.has(cleanName)) {
                            productVariants.set(cleanName, []);
                        }
                        productVariants.get(cleanName).push({
                            ...item,
                            source: subcat.name,
                            displayPrice: item.price
                        });
                    });
                }
            });
        }

        // Render products
        category.items.forEach(item => {
            const prodEl = document.createElement('div');
            prodEl.className = 'product-card';

            const cleanName = item.name.replace(/^\./, '');
            const variants = productVariants.get(cleanName);

            // Check if product has multiple price variants
            const hasMultiplePrices = variants && variants.length > 1;

            // Use image if available
            const imgStyle = item.image ? `background-image: url('${item.image.replace(/\\/g, '/')}')` : '';

            // Show price range if multiple variants exist
            let priceDisplay = `${item.price.toFixed(2)}€`;
            if (hasMultiplePrices) {
                const prices = variants.map(v => v.displayPrice);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                if (minPrice !== maxPrice) {
                    priceDisplay = `${minPrice.toFixed(2)}€ - ${maxPrice.toFixed(2)}€`;
                }
            }

            prodEl.innerHTML = `
                <div class="product-image" style="${imgStyle}"></div>
                <div class="product-info">
                    <div class="product-name">${item.name}</div>
                    <div class="product-price">${priceDisplay}</div>
                </div>
            `;

            prodEl.onclick = () => {
                if (hasMultiplePrices) {
                    showPriceSelectionModal(cleanName, variants);
                } else {
                    addToOrder(item);
                }
            };

            productListEl.appendChild(prodEl);
        });
    }

    function showPriceSelectionModal(productName, variants) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'overlay active';
        overlay.style.zIndex = '2000';

        let optionsHtml = '';
        variants.forEach((variant, index) => {
            const label = variant.source === 'main' ? 'Normal' : variant.source;
            optionsHtml += `
                <button class="price-option-btn" data-index="${index}">
                    <span class="price-option-label">${label}</span>
                    <span class="price-option-price">${variant.displayPrice.toFixed(2)}€</span>
                </button>
            `;
        });

        overlay.innerHTML = `
            <div class="overlay-content" style="max-width: 500px;">
                <h2 style="color: var(--text-main); margin-bottom: 1rem;">${productName}</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">Selecciona el tamaño:</p>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${optionsHtml}
                </div>
                <button id="btn-cancel-price" class="btn-secondary" style="margin-top: 2rem; width: 100%;">
                    Cancelar
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add event listeners
        overlay.querySelectorAll('.price-option-btn').forEach(btn => {
            btn.onclick = () => {
                const index = parseInt(btn.dataset.index);
                const selectedVariant = variants[index];
                addToOrder(selectedVariant);
                document.body.removeChild(overlay);
            };
        });

        overlay.querySelector('#btn-cancel-price').onclick = () => {
            document.body.removeChild(overlay);
        };

        // Close on overlay click (outside content)
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };
    }

    // --- Order Management ---
    function addToOrder(item) {
        if (!currentTable) return;

        currentOrder.push(item);

        // Update table orders map and save
        tableOrders[currentTable] = currentOrder;
        saveOrders();

        updateOrderView();
    }

    function updateOrderView() {
        orderListEl.innerHTML = '';
        let total = 0;

        currentOrder.forEach((item, index) => {
            total += item.price;
            const row = document.createElement('tr');

            row.innerHTML = `
                <td class="col-qty">1</td>
                <td class="col-item">${item.name}</td>
                <td class="col-price">${item.price.toFixed(2)}€</td>
                <td class="col-action">
                    <button class="btn-delete" onclick="window.removeFromOrder(${index})">
                        <span class="material-icons">close</span>
                    </button>
                </td>
            `;
            orderListEl.appendChild(row);
        });

        const totalFormatted = `${total.toFixed(2)}€`;
        totalAmountEl.textContent = totalFormatted;
        if (subtotalAmountEl) subtotalAmountEl.textContent = totalFormatted;
    }

    // Expose to window for inline onclick
    window.removeFromOrder = function (index) {
        currentOrder.splice(index, 1);

        // Update table orders map and save
        if (currentTable) {
            tableOrders[currentTable] = currentOrder;
            saveOrders();
        }

        updateOrderView();
    }

    function handleCharge() {
        if (currentOrder.length === 0) return;

        const total = currentOrder.reduce((sum, item) => sum + item.price, 0);
        if (confirm(`Cobrar ${total.toFixed(2)}€ a la Mesa ${currentTable}?`)) {
            alert('Cobrado correctamente!');

            // Clear order for this table
            currentOrder = [];
            if (currentTable) {
                tableOrders[currentTable] = [];
                saveOrders();
            }

            updateOrderView();
            showTableSelection(); // Return to table selection after charge
        }
    }

    // --- Menu Export ---
    const btnExport = document.getElementById('btn-export-menu');
    if (btnExport) {
        btnExport.addEventListener('click', exportMenu);
    }

    async function exportMenu() {
        if (!menuData || !menuData.categories) {
            alert('No hay datos de menú para exportar.');
            return;
        }

        try {
            // 1. Ask user to select a directory
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'documents'
            });

            // 2. Iterate categories and write files
            let count = 0;
            for (const category of menuData.categories) {
                const fileName = `${category.name}.txt`;

                // Create file handle
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();

                // Format content
                let content = `${category.name}\n`;
                content += "=".repeat(category.name.length) + "\n\n";

                // Build a map of products with their prices
                const productPrices = new Map();

                // Collect main category items
                if (category.items && category.items.length > 0) {
                    category.items.forEach(item => {
                        const cleanName = item.name.replace(/^\./, ''); // Remove leading dot if exists
                        if (!productPrices.has(cleanName)) {
                            productPrices.set(cleanName, []);
                        }
                        productPrices.get(cleanName).push(item.price);
                    });
                }

                // Collect subcategory items
                if (category.subcategories && category.subcategories.length > 0) {
                    category.subcategories.forEach(subcat => {
                        if (subcat.items && subcat.items.length > 0) {
                            subcat.items.forEach(item => {
                                const cleanName = item.name.replace(/^\./, '');
                                if (!productPrices.has(cleanName)) {
                                    productPrices.set(cleanName, []);
                                }
                                productPrices.get(cleanName).push(item.price);
                            });
                        }
                    });
                }

                // Write all products with their prices
                productPrices.forEach((prices, name) => {
                    // Remove duplicates and sort prices (highest first)
                    const uniquePrices = [...new Set(prices)].sort((a, b) => b - a);

                    let priceStr;
                    if (uniquePrices.length > 1) {
                        // Multiple prices: show as "price1 / price2"
                        priceStr = uniquePrices.map(p => p.toFixed(2) + "€").join(" / ");
                    } else {
                        // Single price
                        priceStr = uniquePrices[0].toFixed(2) + "€";
                    }

                    const nameWidth = 50;
                    const dots = ".".repeat(Math.max(2, nameWidth - name.length - priceStr.length));
                    content += `${name} ${dots} ${priceStr}\n`;
                });

                // Write and close
                await writable.write(content);
                await writable.close();
                count++;
            }

            alert(`Exportado correctamente: ${count} archivos de categoría creados.`);

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error exportando menú:', error);
                alert('Error al exportar: ' + error.message);
            }
        }
    }
});

