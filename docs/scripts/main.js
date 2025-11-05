const randomizeButton = document.getElementById("randomize");
const root = document.getElementById("root");
const cols = Number(root.dataset.cols);
const rows = Number(root.dataset.rows);
root.style.gridTemplateColumns = `repeat(${cols + 1}, 1fr)`;
const cellTemplate = document.getElementById("cell");
const sizeSlider = document.getElementById("size-slider");
const screenshotButton = document.getElementById("screenshot");
const runTestsButton = document.getElementById("run-tests");
const testGallery = document.getElementById("test-gallery");
const uploadTestButton = document.getElementById("upload-test");
const imageUploadInput = document.getElementById("image-upload-input");
const testResults = document.getElementById("test-results");

const modalOverlay = document.getElementById("modal-overlay");
const templateModal = document.getElementById("template-modal");
const applyTemplateButton = document.getElementById("apply-template");
const cancelTemplateEditButton = document.getElementById("cancel-template-edit");
const openTemplateEditorButton = document.getElementById("open-template-editor");

const runTestsText = document.getElementById("run-tests-text");
let isTestRunning = false;

const aceEditor = ace.edit("template-editor");
aceEditor.setTheme("ace/theme/github");
aceEditor.session.setMode("ace/mode/html");
aceEditor.setOptions({
    fontSize: "16px",
    useWorker: false,
});

let testImageUrls = [
    './test_images/test1.png',
    './test_images/test2.png',
    './test_images/test3.png',
    './test_images/test4.png',
    './test_images/test5.png',
    './test_images/test6.png',
    './test_images/test7.png',
    './test_images/test8.png',
    './test_images/test9.png',
    './test_images/test10.png',
    './test_images/test11.png',
    './test_images/test12.png',
    './test_images/test13.png',
];

let testCases = [];

function buildGrid() {
    root.innerHTML = "";
    for (let j = 0; j < rows + 1; j++) {
        for (let i = 0; i < cols + 1; i++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.col = i;
            cell.dataset.row = j;
            cell.appendChild(document.importNode(cellTemplate.content, true));
            if (i !== cols && j !== rows) {
                const input = document.createElement("input");
                input.type = "checkbox";
                cell.appendChild(input);
            }
            root.appendChild(cell);
        }
    }
}

function openModal() {
    aceEditor.setValue(cellTemplate.innerHTML, 1);
    aceEditor.clearSelection();

    modalOverlay.classList.add("active");
    templateModal.classList.add("active");

    aceEditor.resize();
    aceEditor.focus();
}

function closeModal() {
    modalOverlay.classList.remove("active");
    templateModal.classList.remove("active");
}
openTemplateEditorButton.addEventListener("click", openModal);
cancelTemplateEditButton.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

applyTemplateButton.addEventListener("click", () => {
    cellTemplate.innerHTML = aceEditor.getValue();
    buildGrid();
    initializeTestGallery();
    closeModal();
});

function getCell(col, row) {
    return root.querySelector(`[data-col="${col}"][data-row="${row}"]`);
}
function isChecked(col, row) {
    const cell = getCell(col, row);
    if (!cell) return false;
    const checkbox = cell.querySelector('input[type="checkbox"]');
    return checkbox && checkbox.checked;
}
function updateTileClasses(col, row) {
    const tileCell = getCell(col, row);
    if (!tileCell || !tileCell.querySelector(".tile")) return;
    tileCell.classList.remove("tl", "tr", "bl", "br");
    if (isChecked(col - 1, row - 1)) tileCell.classList.add("tl");
    if (isChecked(col, row - 1)) tileCell.classList.add("tr");
    if (isChecked(col - 1, row)) tileCell.classList.add("bl");
    if (isChecked(col, row)) tileCell.classList.add("br");
}
function updateAllTiles() {
    for (let i = 0; i < cols + 1; i++) {
        for (let j = 0; j < rows + 1; j++) {
            updateTileClasses(i, j);
        }
    }
}
function randomize() {
    const checkboxes = root.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach((checkbox) => {
        checkbox.checked = Math.random() > 0.5;
    });
    updateAllTiles();
}
function getCheckbox(col, row) {
    const cell = getCell(col, row);
    if (!cell) return null;
    return cell.querySelector('input[type="checkbox"]');
}
function setCheckboxState(col, row, state) {
    const checkbox = getCheckbox(col, row);
    if (checkbox) checkbox.checked = state;
}
function clearAllCheckboxes() {
    root
        .querySelectorAll("input[type='checkbox']")
        .forEach((checkbox) => (checkbox.checked = false));
}
async function takeSnapshot(element) {
    const canvas = await html2canvas(element, { scale: 1 });
    return canvas.toDataURL();
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getImageDataFromSrc(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve({
                data: ctx.getImageData(0, 0, img.width, img.height),
                width: img.width,
                height: img.height,
            });
        };
        img.onerror = reject;
        img.src = src;
    });
}
async function loadAndParseTestFromUrl(url, index) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                canvas.width = img.width; canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const etalonImageSrc = canvas.toDataURL();
                const coords = parseImageForCoords(
                    ctx, canvas.width, canvas.height
                );
                if (coords === null) {
                    return reject(new Error(`Ошибка парсинга изображения: ${url}`));
                }
                resolve({
                    id: `url-test-${index}`,
                    name: `Тест ${index + 1} (из URL)`,
                    coords: coords,
                    etalonImageSrc: etalonImageSrc,
                });
            } catch (e) {
                reject(
                    new Error(`Ошибка canvas (возможно CORS) для: ${url}. Ошибка: ${e.message}`)
                );
            }
        };
        img.onerror = () => {
            reject(new Error(`Не удалось загрузить изображение: ${url}`));
        };
        img.src = url;
    });
}

async function initializeTestGallery() {
    testGallery.innerHTML = "<p>Загрузка тестов из URL...</p>";
    testResults.textContent = "Загрузка...";
    let galleryHTML = "";
    document.documentElement.style.setProperty("--cell-size", "50px");
    sizeSlider.value = 50;

    testCases = [];

    clearAllCheckboxes();
    updateAllTiles();
    await delay(50);

    const emptyGridUrl = await takeSnapshot(root);

    if (!testImageUrls.length) {
        testImageUrls.push(emptyGridUrl);
    }

    const promises = testImageUrls.map((url, index) =>
        loadAndParseTestFromUrl(url, index)
    );

    try {
        testCases = await Promise.all(promises);
        if (testCases.length === 0) {
            testGallery.innerHTML = "<p>Не найдено тестов. Добавьте URL в массив testImageUrls.</p>";
            testResults.textContent = "⚠️ Тесты не загружены.";
            return;
        }
        testCases.forEach((testCase) => {
            galleryHTML += `
              <div class="test-case-container">
                <img id="${testCase.id}" src="${testCase.etalonImageSrc}" alt="${testCase.name}">
                <span>${testCase.name}</span>
                <img id="diff-${testCase.id}" class="diff-image" alt="Diff" style="display: none;">
              </div>
            `;
        });
        testGallery.innerHTML = galleryHTML;
        testResults.textContent = `📊 ${testCases.length} ${testCases.length === 1 ? 'тест' : 'тестов'
            } загружено. Готово к запуску.`;
    } catch (error) {
        console.error("Ошибка при загрузке тестов:", error);
        testGallery.innerHTML = `<p style="color: red;">Ошибка загрузки тестов: ${error.message}</p>`;
        testResults.textContent = "❌ Ошибка загрузки тестов.";
    }
    clearField();
}

function clearStatuses() {
    const tests = document.querySelectorAll('.test-fail, .test-pass');
    Array.from(tests).forEach((el) => el.classList.remove('test-fail', 'test-pass'));
    const diff = Array.from(document.querySelectorAll('.diff-image')).filter((el) => el.style.display !== 'none');
    diff.forEach((el) => el.style.display = 'none');
}

async function runAllTests() {
    let passedCount = 0;
    let failedCount = 0;
    testResults.textContent = `Выполнение ${testCases.length} тестов... ⏳`;

    for (const testCase of testCases) {
        if (!isTestRunning) {
            testResults.textContent = `🚫 Тесты остановлены пользователем.`;
            break;
        }

        const imgElement = document.getElementById(testCase.id);
        const diffImgElement = document.getElementById(`diff-${testCase.id}`);
        if (!imgElement || !diffImgElement) continue;

        imgElement.classList.remove("test-pass", "test-fail");
        imgElement.classList.add("test-pending");
        diffImgElement.style.display = "none";
        diffImgElement.src = "";
        imgElement.scrollIntoView({
            behavior: "smooth", block: "nearest", inline: "center",
        });

        clearAllCheckboxes();
        testCase.coords.forEach(([col, row]) =>
            setCheckboxState(col, row, true)
        );
        updateAllTiles();
        await delay(50);

        const currentImageDataUrl = await takeSnapshot(root);
        const etalonSrc = testCase.etalonImageSrc;

        try {
            const etalonImg = await getImageDataFromSrc(etalonSrc);
            const currentImg = await getImageDataFromSrc(currentImageDataUrl);

            if (
                etalonImg.width !== currentImg.width ||
                etalonImg.height !== currentImg.height
            ) {
                console.error("Ошибка diff: Размеры изображений не совпадают!");
                imgElement.classList.replace("test-pending", "test-fail");
                failedCount++;
                continue;
            }

            const width = etalonImg.width;
            const height = etalonImg.height;
            const diffCanvas = document.createElement("canvas");
            diffCanvas.width = width; diffCanvas.height = height;
            const diffCtx = diffCanvas.getContext("2d");
            const diffImageData = diffCtx.createImageData(width, height);

            const expectedSizeNoBorder = (cols + 1) * 50;
            let pixelOffset = (width === expectedSizeNoBorder) ? 0 : 1;

            const maskCanvas = document.createElement("canvas");
            maskCanvas.width = width;
            maskCanvas.height = height;
            const maskCtx = maskCanvas.getContext("2d");

            maskCtx.fillStyle = "black";
            maskCtx.fillRect(0, 0, width, height);

            maskCtx.fillStyle = "white";
            const maskWidth = 20;
            const maskStart = 15;

            for (let j = 0; j < rows; j++) {
                for (let i = 0; i < cols; i++) {
                    const px = pixelOffset + i * 50 + maskStart;
                    const py = pixelOffset + j * 50 + maskStart;
                    maskCtx.fillRect(px, py, maskWidth, maskWidth);
                }
            }

            const maskImageData = maskCtx.getImageData(0, 0, width, height);

            const numDiffPixels = pixelmatch(
                etalonImg.data.data, currentImg.data.data,
                diffImageData.data, width, height,
                {
                    threshold: 0.1,
                    includeAA: true,
                    diffMask: maskImageData.data
                }
            );

            if (numDiffPixels === 0) {
                imgElement.classList.replace("test-pending", "test-pass");
                passedCount++;
            } else {
                imgElement.classList.replace("test-pending", "test-fail");
                failedCount++;

                console.log(`Тест ${testCase.name} УПАЛ: ${numDiffPixels} пикс. отличий (в НЕ-маскированных областях)`);

                diffCtx.putImageData(diffImageData, 0, 0);
                diffImgElement.src = diffCanvas.toDataURL();
                diffImgElement.style.display = "block";
            }
        } catch (error) {
            console.error("Ошибка при генерации diff-изображения:", error);
            imgElement.classList.replace("test-pending", "test-fail");
            failedCount++;
        }
        await delay(500);
    }

    if (isTestRunning) {
        testResults.textContent = `✅ Пройдено: ${passedCount} | ❌ Упало: ${failedCount} | 📊 Всего: ${testCases.length}`;
    }

    isTestRunning = false;
    runTestsButton.classList.remove("running");
    runTestsText.textContent = "Запуск тестов";
}

runTestsButton.addEventListener("click", () => {
    if (isTestRunning) {
        isTestRunning = false;
        runTestsButton.classList.remove("running");
        runTestsText.textContent = "Запуск тестов";
    } else {
        if (sizeSlider.value !== "50") {
            alert(
                "Для запуска тестов установите ползунок 'Размер' в '50px' (минимальное значение)."
            );
            return;
        }

        isTestRunning = true;
        runTestsButton.classList.add("running");
        runTestsText.textContent = "Стоп";
        runAllTests();
    }
});


function isPixelCheckboxGreen(ctx, x, y) {
    try {
        const pixelData = ctx.getImageData(x, y, 1, 1).data;
        const [r, g, b] = pixelData;
        const isGreenDominant = g > r && g > b;
        const isGreenBrightEnough = g > 100;
        const isGrayish = Math.abs(r - b) < 60;
        const isNotFillRed = r > 30;
        return isGreenDominant && isGreenBrightEnough && isGrayish && isNotFillRed;
    } catch (e) { return false; }
}
function parseImageForCoords(ctx, width, height) {
    const cellSize = 50; let pixelOffset = 0;
    const expectedSizeNoBorder = (cols + 1) * cellSize;
    const expectedSizeWithBorder = expectedSizeNoBorder + 2;
    if (width === expectedSizeWithBorder && height === expectedSizeWithBorder) {
        pixelOffset = 1;
    } else if (
        width !== expectedSizeNoBorder || height !== expectedSizeNoBorder
    ) {
        alert(`Ошибка: Изображение ${width}x${height}px. Ожидалось ${expectedSizeNoBorder}x${expectedSizeNoBorder}px или ${expectedSizeWithBorder}x${expectedSizeWithBorder}px.`);
        return null;
    }
    const coords = []; const scanStart = 17; const scanEnd = 32;
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            let isChecked = false;
            const absYBase = pixelOffset + j * cellSize;
            const absXBase = pixelOffset + i * cellSize;
            for (let y = scanStart; y <= scanEnd; y++) {
                if (isChecked) break;
                for (let x = scanStart; x <= scanEnd; x++) {
                    const px = absXBase + x; const py = absYBase + y;
                    if (isPixelCheckboxGreen(ctx, px, py)) {
                        isChecked = true; break;
                    }
                }
            }
            if (isChecked) { coords.push([i, j]); }
        }
    }
    return coords;
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        processUploadedImage(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
    event.target.value = null;
}
function processUploadedImage(imageDataUrl, filename) {
    const img = new Image();
    img.onload = async function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const parsedCoords = parseImageForCoords(
            ctx, canvas.width, canvas.height
        );
        if (!parsedCoords) return;
        document.documentElement.style.setProperty("--cell-size", "50px");
        sizeSlider.value = 50;
        clearAllCheckboxes();
        parsedCoords.forEach(([col, row]) =>
            setCheckboxState(col, row, true)
        );
        updateAllTiles();
        await delay(50);
        const newEtalonSrc = await takeSnapshot(root);
        const newTestCase = {
            id: `uploaded-${Date.now()}`,
            name: `(Загружен) ${filename.substring(0, 20)}...`,
            coords: parsedCoords,
            etalonImageSrc: newEtalonSrc,
        };
        testCases.push(newTestCase);
        const newImageHTML = `
            <div class="test-case-container">
              <img id="${newTestCase.id}" src="${newTestCase.etalonImageSrc}" alt="${newTestCase.name}">
              <span>${newTestCase.name}</span>
              <img id="diff-${newTestCase.id}" class="diff-image" alt="Diff" style="display: none;">
            </div>
          `;
        testGallery.insertAdjacentHTML("beforeend", newImageHTML);
        testResults.textContent = `📊 ${testCases.length} ${testCases.length === 1 ? 'тест' : 'тестов'
            } загружено. Готово к запуску.`;
        clearField();
    };
    img.src = imageDataUrl;
}
uploadTestButton.addEventListener("click", () => {
    imageUploadInput.click();
});
imageUploadInput.addEventListener("change", handleImageUpload);

root.addEventListener("change", (e) => {
    if (e.target.type === "checkbox") updateAllTiles();
});
randomizeButton.addEventListener("click", () => {
    randomize();
});
sizeSlider.addEventListener("input", (e) => {
    const newSize = e.target.value + "px";
    document.documentElement.style.setProperty("--cell-size", newSize);
});
screenshotButton.addEventListener("click", () => {
    html2canvas(root, { scale: 1 }).then((canvas) => {
        const link = document.createElement("a");
        link.download = "marching-squares-screenshot.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
});

function clearField() {
    clearAllCheckboxes();
    updateAllTiles();
}

buildGrid();
initializeTestGallery();